/* Health Sync client: reads Apple Health from the authenticated Health Sync API (health-sync/CONTRACT.md) instead of
   the clipboard. The iPhone shortcuts upload; this file pairs, downloads, validates, merges ONLY the hk fields of
   S.days[date], and shows a truthful status. Calculations (sleep policy, workouts, units) are shared with the
   emergency paste import and live in health.js.

   Where things live:
   - read token ........ localStorage 'fs_hk_read' only (never in S, never synced, never in a URL or a log)
   - API address ....... HK_API below, overridable in Settings > Apple Health > Advanced (localStorage 'fs_hk_api')
   - revision + status . localStorage 'fs_hk_meta' (never in S)
   - raw rows .......... IndexedDB 'fresh-start-hk' (about 400 days) so summaries can be rebuilt and offline works
   The upload token is shown once after pairing, held in memory only, and never stored. */
'use strict';

const HK_API = 'https://fresh-start-health.nadunj95.workers.dev'; // Cloudflare Worker (free plan), health-sync/api
const HKS_RELEASE = '1.1.0'; // newest shortcut release (health-sync/RELEASE); older shortcuts get an "update" note
const HKS_RUN_URL = 'shortcuts://run-shortcut?name=' + encodeURIComponent('Fresh Start Sync');
const HKS_READ_KEY = 'fs_hk_read', HKS_META_KEY = 'fs_hk_meta', HKS_API_KEY = 'fs_hk_api';
const HKS_STALE_H = 36, HKS_POLL_MS = 4000, HKS_POLL_MAX = 3 * 60000, HKS_KEEP_DAYS = 400, HKS_MIN_GAP = 20000;
/* API daily metric → the field in S.days[date].hk */
const HKS_FIELDS = { steps: 'steps', active_energy: 'kcal', exercise_min: 'exmin', resting_hr: 'rhr', walking_hr: 'whr', hrv: 'hrv', resp_rate: 'resp', spo2: 'spo2', heart_rate: 'hr', vo2max: 'vo2', weight: 'weight' };
const HKS_ORDER = ['steps', 'active_energy', 'exercise_min', 'sleep', 'workout', 'resting_hr', 'hrv', 'walking_hr', 'resp_rate', 'spo2', 'heart_rate', 'vo2max', 'weight'];
const HKS_LABEL = { steps: 'Steps', active_energy: 'Active energy', exercise_min: 'Exercise', sleep: 'Sleep', workout: 'Workouts', resting_hr: 'Resting HR', hrv: 'HRV', walking_hr: 'Walking HR', resp_rate: 'Breathing', spo2: 'Blood oxygen', heart_rate: 'Heart rate', vo2max: 'VO2 max', weight: 'Weight' };
const HKS_JOB = { steps: 'FS Activity', active_energy: 'FS Activity', exercise_min: 'FS Activity', sleep: 'FS Sleep', workout: 'FS Workouts', resting_hr: 'FS Heart', hrv: 'FS Heart', walking_hr: 'FS Heart', resp_rate: 'FS Heart', spo2: 'FS Heart', heart_rate: 'FS Heart', vo2max: 'FS Heart', weight: 'FS Body' };
const HKS_DATE = /^\d{4}-\d{2}-\d{2}$/;

const hks = { meta: null, cache: null, ready: null, busy: null, err: null, lastTry: 0, poll: null, uploadOnce: null, pairing: false, apiDb: null };

/* ------------------------------------------------------------------ storage (every access guarded: storage can be blocked) */
const hksLS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const hksTok = () => hksLS.get(HKS_READ_KEY) || '';
const hksPaired = () => !!hksTok();
function hksBase() {
  const o = (hksLS.get(HKS_API_KEY) || '').trim();
  return (o || HK_API).replace(/\/+$/, '');
}
const hksBaseUnset = () => /REPLACE/.test(hksBase());
function hksMeta() {
  if (!hks.meta) { let m = null; try { m = JSON.parse(hksLS.get(HKS_META_KEY) || 'null'); } catch (e) { m = null; } hks.meta = m && typeof m === 'object' ? m : {}; }
  return hks.meta;
}
function hksMetaSave() { hksLS.set(HKS_META_KEY, JSON.stringify(hks.meta || {})); }

/* raw rows: a separate IndexedDB so core.js's store is untouched. If IndexedDB is unavailable the cache lives in memory. */
const hksIDB = {
  p: null,
  open() {
    if (this.p) return this.p;
    this.p = new Promise((res) => {
      try {
        const r = indexedDB.open('fresh-start-hk', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { const db = r.result; db.onclose = () => { this.p = null; }; db.onversionchange = () => { try { db.close(); } catch (e) { /* ignore */ } this.p = null; }; res(db); };
        r.onerror = r.onblocked = () => { this.p = null; res(null); };
      } catch (e) { this.p = null; res(null); }
    });
    return this.p;
  },
  async get() {
    const db = await this.open(); if (!db) return null;
    return new Promise((res) => { try { const r = db.transaction('kv').objectStore('kv').get('cache'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); } catch (e) { this.p = null; res(null); } });
  },
  async put(v, retry = true) {
    const db = await this.open(); if (!db) return false;
    return new Promise((res) => {
      try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, 'cache'); tx.oncomplete = () => res(true); tx.onerror = tx.onabort = () => res(false); }
      catch (e) { this.p = null; res(retry ? this.put(v, false) : false); }
    });
  },
};
const hksNewCache = () => ({ v: 1, rev: 0, daily: {}, sleep: {}, wk: {} });
function hksCacheOk(c) { return !!(c && c.v === 1 && isFinite(c.rev) && c.daily && typeof c.daily === 'object' && c.sleep && c.wk); }
function hksLoadCache() {
  if (!hks.ready) hks.ready = hksIDB.get().then((c) => { hks.cache = hksCacheOk(c) ? c : hksNewCache(); }, () => { hks.cache = hksNewCache(); });
  return hks.ready;
}

/* ------------------------------------------------------------------ pure: validate + adapt API rows */
const hksT = (v) => { // any timestamp the API might use → ms, or null
  if (v == null || v === '') return null;
  const d = hkDate(typeof v === 'number' && v < 1e11 ? v * 1000 : v);
  const t = d ? d.getTime() : NaN; return isFinite(t) ? t : null;
};
const hksN = (v) => (typeof v === 'number' ? (isFinite(v) ? v : null) : hkNum(v));
/* [start, end] ms from {start,end} / [start,end] */
function hksWin(w) {
  const a = Array.isArray(w) ? hksT(w[0]) : w && typeof w === 'object' ? hksT(w.start != null ? w.start : w.from != null ? w.from : w.start_at) : null;
  const b = Array.isArray(w) ? hksT(w[1]) : w && typeof w === 'object' ? hksT(w.end != null ? w.end : w.to != null ? w.to : w.end_at) : null;
  return a == null || b == null || b < a ? null : [a, b];
}
const hksIn = (t, wins) => wins.some(([a, b]) => t >= a && (t < b || (t === b && a === b)));

/* one daily value → the unit and range the app uses, or null (missing stays missing: never 0 for "no reading") */
function hksDailyValue(field, v, unit, target) {
  const x = hksN(v); if (x == null) return null;
  const r1 = (n) => Math.round(n * 10) / 10, rng = (n, a, b) => (n >= a && n <= b ? n : null);
  switch (field) {
    case 'steps': { const n = rng(x, 0, 200000); return n == null ? null : Math.round(n); }
    case 'kcal': { const n = rng(hkKcal(x, unit), 0, 20000); return n == null ? null : Math.round(n); }
    case 'exmin': { const n = rng(hkMinutes(x, unit), 0, 1440); return n == null ? null : Math.round(n); }
    case 'rhr': { const n = rng(x, 25, 140); return n == null ? null : Math.round(n); }
    case 'whr': { const n = rng(x, 30, 200); return n == null ? null : Math.round(n); }
    case 'hr': { const n = rng(x, 30, 200); return n == null ? null : Math.round(n); }
    case 'hrv': { const n = rng(hkHrvMs(x, unit), 5, 300); return n == null ? null : Math.round(n); }
    case 'resp': { const n = rng(x, 4, 40); return n == null ? null : r1(n); }
    case 'spo2': { const n = rng(hkSpo2(x, unit), 70, 100); return n == null ? null : Math.round(n); }
    case 'vo2': { const n = rng(x, 10, 90); return n == null ? null : r1(n); }
    case 'weight': { const kg = hkWeight(x, unit, 'kg'); return rng(kg, 20, 400) == null ? null : r1(hkWeight(x, unit, target || 'lb')); }
  }
  return null;
}

/* Apply one /v1/health payload to a raw cache. Order matters: `deleted` windows are removed FIRST so a correction
   (or a deletion in Health) drops the stale rows, then the rows the server sent are upserted. Returns counts of
   rows that were rejected as malformed. Throws if the payload isn't the contract's shape (nothing is applied). */
function hksApplyDelta(c, p, today) {
  if (!p || typeof p !== 'object' || !isFinite(+p.revision)) throw new Error('unexpected payload');
  const arr = (x) => (Array.isArray(x) ? x : []), del = p.deleted && typeof p.deleted === 'object' ? p.deleted : {}, rej = { daily: 0, sleep: 0, wk: 0 };
  arr(del.daily).forEach((x) => {
    const m = Array.isArray(x) ? x[0] : x && x.metric, d = Array.isArray(x) ? x[1] : x && x.date;
    if (m && HKS_DATE.test(String(d))) delete c.daily[m + '|' + d];
  });
  const sw = arr(del.sleep).map(hksWin).filter(Boolean), ww = arr(del.workouts).map(hksWin).filter(Boolean);
  if (sw.length) Object.keys(c.sleep).forEach((k) => { if (hksIn(c.sleep[k][0], sw)) delete c.sleep[k]; });
  if (ww.length) Object.keys(c.wk).forEach((k) => { if (hksIn(c.wk[k].start, ww)) delete c.wk[k]; });
  arr(p.daily).forEach((r) => {
    if (!r || !HKS_FIELDS[r.metric]) return;
    const d = String(r.date || '').slice(0, 10), v = hksN(r.value);
    if (!HKS_DATE.test(d) || v == null) { rej.daily++; return; }
    c.daily[r.metric + '|' + d] = { m: r.metric, d, v, u: String(r.unit || ''), c: r.collected_at || '' };
  });
  arr(p.sleep).forEach((r) => {
    const s = r && hksT(r.start != null ? r.start : r.start_at), e = r && hksT(r.end != null ? r.end : r.end_at), st = r && hkStage(r.stage, true);
    if (s == null || e == null || !st || !(e > s) || e - s > 24 * 3600000) { rej.sleep++; return; }
    const src = String(r.source || '');
    c.sleep[s + '|' + e + '|' + st + '|' + src] = [s, e, st, src];
  });
  arr(p.workouts).forEach((r) => {
    const s = r && hksT(r.start != null ? r.start : r.start_at); let e = r && hksT(r.end != null ? r.end : r.end_at);
    const type = r && String(r.type || r.name || 'Workout');
    if (s == null) { rej.wk++; return; }
    if (e == null || e < s) e = s;
    let dur = hksN(r.duration_min != null ? r.duration_min : r.dur_min != null ? r.dur_min : r.duration != null ? hkMinutes(hksN(r.duration), r.duration_unit) : null);
    if (dur != null && !(dur > 0 && dur <= 1440)) dur = null;
    let kcal = hksN(r.energy_kcal != null ? r.energy_kcal : r.energy != null ? hkKcal(hksN(r.energy), r.energy_unit) : null);
    if (kcal != null && !(kcal >= 0 && kcal <= 20000)) kcal = null;
    if (!(e > s) && dur == null) { rej.wk++; return; }
    const src = String(r.source || '');
    c.wk[s + '|' + type + '|' + src] = { n: type, start: s, end: e, dur, kcal, src };
  });
  c.rev = +p.revision;
  // keep about 400 days
  const cut = addDays(today || todayISO(), -HKS_KEEP_DAYS), cutMs = pISO(cut).getTime();
  Object.keys(c.daily).forEach((k) => { if (c.daily[k].d < cut) delete c.daily[k]; });
  Object.keys(c.sleep).forEach((k) => { if (c.sleep[k][0] < cutMs) delete c.sleep[k]; });
  Object.keys(c.wk).forEach((k) => { if (c.wk[k].start < cutMs) delete c.wk[k]; });
  c.cut = cut;
  return rej;
}
const hksCopy = (c) => ({ v: 1, rev: c.rev, daily: Object.assign({}, c.daily), sleep: Object.assign({}, c.sleep), wk: Object.assign({}, c.wk), cut: c.cut });

/* the raw cache → { date: {steps, kcal, sleep: {...}, wk: [...] …} } in the shape of S.days[date].hk */
function hksDerive(c, unit) {
  const out = {}, at = (d) => out[d] || (out[d] = {});
  Object.keys(c.daily).forEach((k) => {
    const r = c.daily[k], f = HKS_FIELDS[r.m]; if (!f) return;
    const v = hksDailyValue(f, r.v, r.u, unit); if (v != null) at(r.d)[f] = v;
  });
  const night = {};
  Object.keys(c.sleep).forEach((k) => { const x = c.sleep[k], n = hkNight(x[1]); (night[n] = night[n] || []).push(x); });
  Object.keys(night).forEach((n) => { const s = hkSleepNight(night[n]); if (s) at(n).sleep = s; });
  const byDay = {};
  Object.keys(c.wk).forEach((k) => { const x = c.wk[k], w = hkMkWorkout(x); if (w) { const d = iso(new Date(x.start)); (byDay[d] = byDay[d] || []).push(w); } });
  Object.keys(byDay).forEach((d) => { at(d).wk = byDay[d].sort((a, b) => a.start - b.start); });
  return out;
}

/* merge derived days into S.days[date].hk. ONLY hk fields are touched: meals, sessions, check-ins, mind, ex and any
   weight or steps the user typed stay as they are (hkFillManual honours wsrc/ssrc). hk.api lists the fields the API
   owns, so a field the API stops sending (a correction or a deletion) is removed, while fields that came from a paste
   are left alone. Re-applying the same data changes nothing (no timestamp bump, no save). */
function hksMerge(fields, floor, now) {
  const dates = new Set(Object.keys(fields));
  Object.keys(S.days).forEach((d) => { const h = S.days[d].hk; if (h && h.api && h.api.length && d >= (floor || '')) dates.add(d); });
  const strip = (h) => { const o = Object.assign({}, h); delete o.at; return JSON.stringify(o); };
  const changedDates = [];
  Array.from(dates).sort().forEach((date) => {
    const old = (S.days[date] && S.days[date].hk) || null, fresh = fields[date] || {}, m = Object.assign({}, old || {});
    const gone = [];
    ((old && old.api) || []).forEach((f) => { if (!(f in fresh)) { delete m[f]; gone.push(f); } });
    Object.keys(fresh).forEach((f) => { m[f] = fresh[f]; });
    const keys = Object.keys(fresh).sort();
    if (keys.length) m.api = keys; else delete m.api;
    const empty = !Object.keys(m).some((k) => k !== 'at' && k !== 'api');
    if ((old ? strip(old) : '') === (empty ? '' : strip(m))) return;
    changedDates.push(date);
    const d = day(date);
    if (empty) delete d.hk; else { m.at = now; d.hk = m; hkFillManual(d, m); }
    if (gone.includes('weight') && d.wsrc === 'hk' && (empty || m.weight == null)) { delete d.weight; delete d.wsrc; }
    if (gone.includes('steps') && d.ssrc === 'hk' && (empty || m.steps == null)) { delete d.steps; delete d.ssrc; }
    d.u = now; Cloud.dirty.add('w-' + mondayOf(date));
  });
  return changedDates;
}

/* ------------------------------------------------------------------ pure: truthful status */
const hksVer = (s) => { const m = String(s || '').match(/@(\d+)\.(\d+)\.(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
const hksVerLt = (a, b) => { const x = hksVer('@' + a), y = hksVer('@' + b); if (!x || !y) return false; for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] < y[i]; } return false; };
function hksMetricsOf(run) {
  const m = run && run.metrics, out = {};
  if (Array.isArray(m)) m.forEach((x) => { if (x && x.metric) out[x.metric] = x; });
  else if (m && typeof m === 'object') Object.keys(m).forEach((k) => { out[k] = m[k] || {}; });
  return out;
}
const hksList = (xs) => (xs.length < 3 ? xs.join(' and ') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
/* i = { paired, online, st (last /v1/status body), err ({kind,code}), now (ms), skew (server − device ms), imported (ms), rev (local revision) }
   → { key: notpaired|waiting|syncing|offline|failed|stale|partial|complete, label, tone, collected, ageH, run, metrics[], actions[] } */
function hksStatus(i) {
  const R = { key: '', label: '', tone: '', collected: null, ageH: null, run: null, metrics: [], actions: [], version: null };
  if (!i.paired) { R.key = 'notpaired'; R.label = 'Not paired'; R.actions.push('Enter your setup code below to connect Apple Health.'); return R; }
  const st = i.st && typeof i.st === 'object' ? i.st : null, run = st && st.last_run && typeof st.last_run === 'object' ? st.last_run : null;
  const now = i.now + (i.skew || 0), err = i.err || null;
  R.collected = st ? hksT(st.last_collection_at) : null;
  R.ageH = R.collected != null ? Math.max(0, (now - R.collected) / 3600000) : null;
  R.run = run ? { id: run.id || null, shortcut: run.shortcut || '', started: hksT(run.started), ended: hksT(run.ended), status: String(run.status || '') } : null;
  const cov = (st && (st.coverage || st.metric_coverage)) || {}, rm = hksMetricsOf(run), seen = new Set(Object.keys(rm).concat(Object.keys(cov).filter((k) => cov[k] && typeof cov[k] === 'object' && cov[k].last_date)));
  HKS_ORDER.filter((k) => seen.has(k)).forEach((k) => {
    const s = rm[k] ? String(rm[k].state || '') : '', c = cov[k] || {};
    const state = ['received', 'empty', 'failed', 'not_attempted', 'pending'].includes(s) ? s : 'earlier';
    R.metrics.push({ key: k, label: HKS_LABEL[k] || k, state, text: { received: 'received', empty: 'no readings', failed: 'failed', not_attempted: 'not attempted', pending: 'pending', earlier: 'earlier run' }[state], tone: { received: 'good', empty: '', failed: 'bad', not_attempted: '', pending: 'train', earlier: '' }[state], first: c.first_date || null, last: c.last_date || null, rows: rm[k] ? rm[k].rows : null });
  });
  const failed = R.metrics.filter((m) => m.state === 'failed'), notTried = R.metrics.filter((m) => m.state === 'not_attempted'), pend = R.metrics.filter((m) => m.state === 'pending');
  const rs = R.run ? R.run.status : '', stalled = rs === 'stalled', pending = rs === 'pending' || (!rs && pend.length > 0);
  const stale = R.ageH != null && R.ageH > HKS_STALE_H, partial = rs === 'partial' || failed.length > 0 || notTried.length > 0;
  const offline = i.online === false || (err && ['network', 'timeout', 'offline'].includes(err.kind));
  const A = R.actions, jobs = (ms) => hksList(Array.from(new Set(ms.map((m) => HKS_JOB[m.key] || 'its shortcut'))));
  if (err && err.kind === 'auth') A.push('The app’s read token was rejected (revoked or rotated). Pair again with your setup code below.');
  else if (err && err.kind === 'config') A.push('Set the Health Sync server address under Advanced first.');
  else if (offline) A.push(i.online === false ? 'You’re offline. Showing what this phone last downloaded; it refreshes when you’re back online.' : 'Couldn’t reach the Health Sync server. Showing what this phone last downloaded; it will try again.');
  else if (err && (err.kind === 'server' || err.kind === 'busy' || err.kind === 'rejected')) A.push('The Health Sync server answered with an error' + (err.code ? ' (' + err.code + ')' : '') + '. It will try again; nothing is lost.');
  else if (err && err.kind === 'payload') A.push('The server sent data this app couldn’t read, so nothing was imported. Update the app.');
  if (pending && R.run) A.push('A run started ' + (R.run.started ? hksAgo(now - R.run.started) : 'just now') + ' and hasn’t finished. Keep the iPhone unlocked until it does.');
  if (stalled) A.push('The last run never finished. Unlock the iPhone and run Fresh Start Sync again; if it keeps happening, check Shortcuts → Health access.');
  failed.length && hksGroup(failed).forEach((g) => A.push(hksList(g.labels) + ' failed in the last run — open Shortcuts and run ' + g.job + ' to see the error.'));
  if (notTried.length) A.push(hksList(notTried.map((m) => m.label)) + (notTried.length === 1 ? ' wasn’t' : ' weren’t') + ' attempted because an earlier step failed. Fix that first, then Sync now again.');
  if (stale && !stalled) A.push('No new data for ' + (R.ageH >= 48 ? Math.round(R.ageH / 24) + ' days' : Math.round(R.ageH) + ' h') + '. Open Shortcuts and run Fresh Start Sync (keep the iPhone unlocked), or check your automation.');
  if (rs === 'partial' && !failed.length && !notTried.length) A.push('The last run finished with some metrics missing. Run Fresh Start Sync again.');
  const ver = hksVer(R.run && R.run.shortcut); R.version = ver ? ver.join('.') : null;
  if (R.version && hksVerLt(R.version, i.release || HKS_RELEASE)) A.push((R.run.shortcut.split('@')[0] || 'The shortcut') + ' ' + R.version + ' is older than the current ' + (i.release || HKS_RELEASE) + '. Re-install it from Settings.');
  if (st && isFinite(+st.revision) && isFinite(+i.rev) && +st.revision > +i.rev && !offline) A.push('A newer revision is on the server and isn’t on this phone yet. It will download shortly.');
  const waiting = !st || (R.collected == null && !run);
  if (waiting && !offline && !(err && err.kind)) A.push('Paired. Install the Fresh Start shortcuts, then tap Sync now. Keep the iPhone unlocked on the first run to allow Health access.');
  let key;
  if (err && (err.kind === 'auth' || err.kind === 'config')) key = 'failed';
  else if (offline) key = 'offline';
  else if (err && ['server', 'busy', 'rejected', 'payload'].includes(err.kind)) key = 'failed';
  else if (waiting) key = 'waiting';
  else if (pending) key = 'syncing';
  else if (stalled) key = 'failed';
  else if (stale) key = 'stale';
  else if (partial) key = 'partial';
  else key = 'complete';
  R.key = key;
  R.label = { complete: 'Complete', partial: 'Partial', stale: 'Stale', offline: 'Offline', failed: 'Failed', syncing: 'Syncing', waiting: 'Waiting for data' }[key];
  R.tone = { complete: 'good', partial: 'warn', stale: 'warn', offline: '', failed: 'bad', syncing: 'train', waiting: '' }[key];
  return R;
}
function hksGroup(ms) { const g = {}; ms.forEach((m) => { const j = HKS_JOB[m.key] || 'its shortcut'; (g[j] = g[j] || { job: j, labels: [] }).labels.push(m.label); }); return Object.keys(g).map((k) => g[k]); }
function hksAgo(ms) {
  const m = Math.round(ms / 60000);
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 48 * 60 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago';
}
/* did a run that started after the Sync tap finish? (returning from Shortcuts alone is never success) */
function hksPollJudge(p, st, skew, now) {
  const run = st && st.last_run, started = run ? hksT(run.started) : null;
  const newer = started != null && started - (skew || 0) >= p.tap - 15000;
  if (newer && run.status && run.status !== 'pending') return { state: 'done', status: run.status };
  if (now >= p.until) return { state: 'timeout', started: newer, status: run && run.status };
  return { state: 'waiting' };
}

/* ------------------------------------------------------------------ network */
async function hksReq(path, o) {
  o = o || {};
  const tok = o.noAuth ? '' : hksTok();
  if (!o.noAuth && !tok) throw { kind: 'auth' };
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(() => { if (ctl) ctl.abort(); }, o.timeout || 15000);
  const headers = { Accept: 'application/json' };
  if (tok) headers.Authorization = 'Bearer ' + tok; // header only, never a URL
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(hksBase() + path, { method: o.method || 'GET', headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined });
  } catch (e) { throw { kind: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : e && e.name === 'AbortError' ? 'timeout' : 'network' }; }
  finally { clearTimeout(to); }
  let body = null; try { body = await res.json(); } catch (e) { body = null; }
  if (res.status === 401) throw { kind: 'auth', code: 401, msg: body && body.error };
  if (!res.ok) throw { kind: res.status === 429 ? 'busy' : res.status === 403 || res.status === 422 ? 'rejected' : 'server', code: res.status, msg: body && body.error };
  return body;
}

/* GET /v1/status, then GET /v1/health?since=<revision> when there is something new. Never blocks rendering. */
function hksRefresh(o) {
  o = o || {};
  if (!hksPaired()) return Promise.resolve(null);
  if (hks.busy) return hks.busy;
  if (hksBaseUnset()) { hks.err = { kind: 'config' }; hksRerender(); return Promise.resolve(null); }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { hks.err = { kind: 'offline' }; hksRerender(); return Promise.resolve(null); }
  if (!o.force && Date.now() - hks.lastTry < HKS_MIN_GAP) return Promise.resolve(null);
  hks.lastTry = Date.now();
  hks.busy = (async () => {
    const meta = hksMeta();
    let imported = false;
    try {
      await hksLoadCache();
      const t0 = Date.now(), st = await hksReq('/v1/status'), t1 = Date.now();
      if (!st || typeof st !== 'object') throw { kind: 'payload' };
      const sv = hksT(st.server_time);
      meta.skew = sv != null ? sv - Math.round((t0 + t1) / 2) : meta.skew || 0;
      meta.st = st; meta.lastOk = t1; meta.lastFetch = t1; hks.err = null;
      const srv = +st.revision;
      let since = hks.cache.rev;
      if (isFinite(srv) && srv < since) { hks.cache = hksNewCache(); since = 0; } // the server was reset: start over
      if (!isFinite(srv) || srv !== hks.cache.rev || !meta.lastImport) {
        const p = await hksReq('/v1/health?since=' + (since | 0), { timeout: 30000 });
        imported = await hksApplyPayload(p);
      }
    } catch (e) {
      hks.err = e && e.kind ? e : { kind: 'payload' };
      meta.lastFetch = Date.now();
    } finally {
      hksMetaSave(); hks.busy = null;
    }
    hksRerender();
    return imported;
  })();
  return hks.busy;
}
/* validate → apply to a copy of the cache → derive → merge into S.days → persist. Returns true if the log changed. */
async function hksApplyPayload(p) {
  const next = hksCopy(hks.cache);
  const rej = hksApplyDelta(next, p); // throws on a bad payload; hks.cache is untouched
  hks.cache = next;
  hksIDB.put(next);
  const meta = hksMeta(), now = Date.now();
  meta.rev = next.rev; meta.lastImport = now; meta.rej = rej;
  const fields = hksDerive(next, S.settings.unit || 'lb'), changed = hksMerge(fields, next.cut, now);
  if (changed.length || !(S.settings.hk && S.settings.hk.src === 'api')) {
    const ds = Object.keys(fields).sort(), has = new Set();
    ds.forEach((d) => Object.keys(fields[d]).forEach((f) => has.add(f)));
    S.settings.hk = { at: now, from: ds[0] || todayISO(), to: ds[ds.length - 1] || todayISO(), n: ds.length, has: Array.from(has), src: 'api' };
    S.u = now; Cloud.dirty.add('meta');
    lsSet(); Cloud.schedule();
  }
  hkInvalidate();
  return changed.length > 0;
}
/* re-render only when it can't disturb something: not while typing, not over a sheet, not over a workout player */
function hksRerender() {
  if (typeof hkTyping === 'function' && hkTyping()) return;
  if (ui.sheet) return;
  const top = ui.stack[ui.stack.length - 1];
  if (top && top.v !== 'health' && top.v !== 'settings') return;
  render();
}

/* ------------------------------------------------------------------ Sync now + bounded polling */
function hksPollStart(tap) {
  clearTimeout(hks.poll && hks.poll.timer);
  const run = (hksMeta().st || {}).last_run || {};
  hks.poll = { tap, until: tap + HKS_POLL_MAX, base: run.id || null, state: 'waiting', timer: null };
}
async function hksPollTick() {
  const p = hks.poll; if (!p || p.state !== 'waiting') return;
  clearTimeout(p.timer);
  if (!document.hidden) await hksRefresh({ force: true });
  if (hks.poll !== p) return;
  const j = hksPollJudge(p, hksMeta().st, hksMeta().skew, Date.now());
  if (j.state === 'waiting') { p.timer = setTimeout(hksPollTick, HKS_POLL_MS); hksRerender(); return; }
  p.state = j.state; p.status = j.status; p.started = j.started;
  if (j.state === 'done') toast(j.status === 'complete' ? 'Apple Health data received' : j.status === 'partial' ? 'Health data received; some metrics are missing' : 'The shortcut run didn’t finish');
  hksRerender();
}
A.hkSync = () => {
  if (!hksPaired()) { toast('Pair Apple Health first'); if (!ui.stack.some((l) => l.v === 'health')) push('health'); return; }
  hksPollStart(Date.now());
  hks.poll.timer = setTimeout(hksPollTick, HKS_POLL_MS);
  hksRerender();
  location.href = HKS_RUN_URL;
};
A.hkCheck = async () => { // "Check again": a plain refresh, no shortcut
  if (!hksPaired()) return;
  const before = hksMeta().lastImport;
  await hksRefresh({ force: true });
  toast(hks.err ? ({ offline: 'You’re offline', network: 'Couldn’t reach the server', timeout: 'The server is slow to answer', auth: 'The read token was rejected' }[hks.err.kind] || 'The server didn’t answer') : hksMeta().lastImport !== before ? 'Checked: new data downloaded' : 'Checked: nothing new on the server');
};

/* ------------------------------------------------------------------ pairing + token controls */
IN.hksCode = (el) => { ui.hksCode = el.value; };
IN.hksApi = (el) => { ui.hksApi = el.value; };
function hksResetLocal() { // the cache and revision mirror the server; start over (S.days keep whatever they hold)
  hks.cache = hksNewCache(); hks.ready = Promise.resolve();
  hksIDB.put(hks.cache);
  const m = hksMeta(); m.rev = 0; m.lastImport = null; hksMetaSave();
}
function hksConfirm(key) {
  if (ui.hksArm === key) { ui.hksArm = null; return true; }
  ui.hksArm = key; render();
  setTimeout(() => { if (ui.hksArm === key) { ui.hksArm = null; if (!hkTyping()) render(); } }, 4000);
  return false;
}
const hksErrTxt = (e) => (e && e.kind === 'auth' ? 'That code wasn’t accepted.' : e && e.kind === 'rejected' ? 'That code wasn’t accepted (' + esc(e.msg || e.code) + ').' : e && e.kind === 'busy' ? 'Too many tries. Wait a minute.' : e && e.kind === 'server' ? 'The server had a problem (' + e.code + '). Try again.' : e && e.kind === 'offline' ? 'You’re offline.' : 'Couldn’t reach the server. Check the address under Advanced and your connection.');
A.hksPair = async () => {
  if (hks.pairing) return;
  const el = $('#hksCode'), code = String((el && el.value) || ui.hksCode || '').trim();
  ui.hksCode = code;
  if (!code) { ui.hksErr = 'Type the setup code first.'; render(); return; }
  if (hksBaseUnset()) { ui.hksErr = 'The server address isn’t set yet. Open Advanced below and enter it.'; render(); return; }
  hks.pairing = true; ui.hksErr = ''; render();
  try {
    const r = await hksReq('/v1/pair', { method: 'POST', noAuth: true, body: { setup_code: code }, timeout: 20000 });
    if (!r || typeof r.read_token !== 'string' || r.read_token.length < 20 || typeof r.upload_token !== 'string') throw { kind: 'payload' };
    if (!hksLS.set(HKS_READ_KEY, r.read_token)) throw { kind: 'storage' };
    hks.uploadOnce = r.upload_token; // shown once; never stored
    hks.meta = {}; hksMetaSave(); hks.err = null; hks.poll = null;
    hks.cache = hksNewCache(); hks.ready = Promise.resolve(); hksIDB.put(hks.cache);
    ui.hksCode = ''; ui.hksErr = '';
    toast('Paired');
    hksRefresh({ force: true });
  } catch (e) {
    ui.hksErr = e && e.kind === 'storage' ? 'Couldn’t save the token on this device (storage is blocked).' : e && e.kind === 'payload' ? 'The server’s answer wasn’t what the app expects.' : hksErrTxt(e);
  } finally { hks.pairing = false; render(); }
};
A.hksCopyUp = async () => {
  const t = hks.uploadOnce; if (!t) return;
  try { await navigator.clipboard.writeText(t); toast('Upload token copied'); }
  catch (e) { const el = $('#hksUp'); if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Select the token and copy it'); }
};
A.hksUpDone = () => { hks.uploadOnce = null; render(); };
A.hksRotate = async (el) => {
  const scope = el.dataset.v === 'read' ? 'read' : 'upload';
  if (!hksConfirm('rot-' + scope)) return;
  try {
    const r = await hksReq('/v1/tokens/rotate', { method: 'POST', body: { scope } });
    const t = r && (r.token || r[scope + '_token'] || r.read_token || r.upload_token);
    if (typeof t !== 'string' || t.length < 20) throw { kind: 'payload' };
    if (scope === 'read') { hksLS.set(HKS_READ_KEY, t); toast('Read token replaced'); }
    else { hks.uploadOnce = t; toast('New upload token: copy it now'); }
  } catch (e) { toast(e && e.kind === 'auth' ? 'The read token was rejected' : 'Couldn’t rotate: ' + (e && e.kind === 'offline' ? 'you’re offline' : 'the server didn’t answer')); }
  render();
};
A.hksDisconnect = async () => {
  if (!hksConfirm('disc')) return;
  try { await hksReq('/v1/disconnect', { method: 'POST' }); }
  catch (e) { if (!(e && e.kind === 'auth')) { toast('Couldn’t reach the server, so nothing was disconnected. Try again online.'); return; } } // an already-revoked token is fine
  hksLS.del(HKS_READ_KEY); hks.meta = {}; hksMetaSave(); hks.poll = null; hks.err = null; hks.uploadOnce = null; hksResetLocal();
  toast('Disconnected. Your data stays on the server until you delete it.'); render();
};
A.hksDeleteData = async () => {
  if (!hksConfirm('del')) return;
  try { await hksReq('/v1/data', { method: 'DELETE' }); }
  catch (e) { toast(e && e.kind === 'auth' ? 'The read token was rejected' : 'Couldn’t reach the server, so nothing was deleted.'); return; }
  hksResetLocal(); hksMeta().st = null; hksMetaSave();
  toast('Server data deleted. Imported days stay here until you remove them.'); render();
};
A.hksApiSave = () => {
  const v = String(ui.hksApi != null ? ui.hksApi : hksLS.get(HKS_API_KEY) || '').trim().replace(/\/+$/, '');
  if (!v) { hksLS.del(HKS_API_KEY); ui.hksApi = null; toast('Using the built-in address'); render(); return; }
  if (!/^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/i.test(v) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s?#]*)?$/i.test(v)) { toast('Use an https:// address'); return; }
  hksLS.set(HKS_API_KEY, v); ui.hksApi = null; hks.err = null; toast('Address saved'); render(); hksRefresh({ force: true });
};
A.hksApiReset = () => { hksLS.del(HKS_API_KEY); ui.hksApi = null; hks.err = null; toast('Using the built-in address'); render(); };
A.hksFold = (el) => { ui.hksOpen = ui.hksOpen || {}; ui.hksOpen[el.dataset.v] = !ui.hksOpen[el.dataset.v]; render(); };

/* ------------------------------------------------------------------ UI */
function hksStatusNow() {
  const m = hksMeta();
  return hksStatus({ paired: hksPaired(), online: typeof navigator === 'undefined' || navigator.onLine !== false, st: m.st, err: hks.err, now: Date.now(), skew: m.skew || 0, imported: m.lastImport, rev: hks.cache ? hks.cache.rev : m.rev });
}
const hksTone = (t) => (t === 'good' || t === 'warn' || t === 'bad' ? 'var(--' + t + ')' : t === 'train' ? 'var(--train)' : 'var(--fg-2)');
/* plain text for settings; collection time, never the moment old data was downloaded */
function hksSyncedLabel() {
  if (!hksPaired()) { const st = S.settings.hk; return st && st.at ? 'Pasted ' + hkWhen(st.at) : 'Not connected'; }
  const X = hksStatusNow();
  return X.label + (X.collected != null ? ' · collected ' + hkWhen(X.collected) : '');
}
function hksFooterHTML() {
  if (!hksPaired()) { const st = S.settings.hk; return st && st.at ? 'Pasted ' + hkWhen(st.at) : 'Not synced yet'; }
  const X = hksStatusNow();
  return '<span style="color:' + hksTone(X.tone) + ';font-weight:600">' + X.label + '</span>' + (X.collected != null ? ' · collected ' + esc(hkWhen(X.collected)) : '');
}
function hksCollectedToday() {
  if (!hksPaired()) { const st = S.settings.hk; return !!(st && st.at && iso(new Date(st.at)) === todayISO()); }
  const X = hksStatusNow(); return X.collected != null && iso(new Date(X.collected)) === todayISO();
}
const hksNoDataHint = () => (hksPaired() ? 'Tap Sync to run Fresh Start Sync.' : 'Open Apple Health to connect.');

function hksCovTxt(m) {
  if (!m.last) return m.state === 'failed' || m.state === 'not_attempted' ? 'no data yet' : '';
  return m.first && m.first !== m.last ? fmtShort(m.first) + ' – ' + fmtShort(m.last) : fmtShort(m.last);
}
function hksStatusCard(R) {
  const X = hksStatusNow(), m = hksMeta(), poll = hks.poll;
  let h = '<div class="card"><div class="row" style="gap:12px"><span style="width:40px;height:40px;border-radius:10px;background:var(--fuel);color:#fff;display:grid;place-items:center;flex:none">' + ic('heart') + '</span><span class="grow" style="min-width:0"><span style="font-weight:600;display:block">Apple Health</span><span class="small muted">' + (X.key === 'notpaired' ? 'Not paired yet' : X.collected != null ? 'Collected ' + esc(hkWhen(X.collected)) + ' · ' + hksAgo(Date.now() + (m.skew || 0) - X.collected) : 'No data collected yet') + '</span></span><span class="chip ' + X.tone + '">' + X.label + '</span></div>';
  if (X.key !== 'notpaired') {
    const kv = (k, v) => '<div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><span class="small muted" style="flex:none">' + k + '</span><span class="small tnum" style="text-align:right;min-width:0">' + v + '</span></div>';
    h += '<div class="stack" style="gap:6px;margin-top:14px">' +
      kv('Last collected on the phone', X.collected != null ? esc(hkWhen(X.collected)) : '–') +
      kv('Imported on this device', m.lastImport ? esc(hkWhen(m.lastImport)) : 'Not yet') +
      kv('Last run', X.run ? (X.run.started ? esc(hkWhen(X.run.started)) : '–') + ' · ' + esc(X.run.shortcut || 'shortcut') + ' · ' + esc(X.run.status || '?') : 'No run yet') +
      kv('Checked', m.lastOk ? esc(hkWhen(m.lastOk)) : 'Never') + '</div>';
  }
  if (poll && poll.state === 'waiting') {
    const left = Math.max(0, Math.ceil((poll.until - Date.now()) / 1000));
    h += '<div style="margin-top:12px">' + bannerHTML('train', '<b>Waiting for the shortcut to report.</b> Coming back from Shortcuts isn’t enough: this finishes only when a new run reaches the server (checking every few seconds, up to ' + Math.round(left / 60 * 10) / 10 + ' more min).') + '</div>';
  } else if (poll && poll.state === 'timeout') {
    h += '<div style="margin-top:12px">' + bannerHTML('warn', poll.started ? '<b>The run started but never finished.</b> Run Fresh Start Sync again and keep the iPhone unlocked.' : '<b>No new run reached the server in 3 minutes.</b> Open Shortcuts and run Fresh Start Sync to see its error.') + '</div>';
  }
  if (X.actions.length) h += '<div class="stack" style="gap:8px;margin-top:12px">' + X.actions.slice(0, 4).map((a) => bannerHTML(X.key === 'failed' ? 'bad' : X.key === 'complete' ? 'good' : X.key === 'offline' ? '' : 'warn', esc(a))).join('') + '</div>';
  if (X.metrics.length) h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-top:14px">' + X.metrics.map((x) => '<div class="hkc"><div class="xs muted">' + esc(x.label) + '</div><div class="small" style="font-weight:700;color:' + hksTone(x.tone) + '">' + x.text + '</div><div class="xs muted tnum">' + esc(hksCovTxt(x)) + '</div></div>').join('') + '</div>';
  if (X.key !== 'notpaired') h += '<div class="row" style="gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn train sm" data-a="hkSync">Sync now</button><button class="btn ghost sm" data-a="hkCheck">' + (hks.busy ? 'Checking…' : 'Check again') + '</button></div>';
  if (R && R.score != null) h += '<p class="small fg2" style="margin:12px 0 0">Today: recovery ' + R.score + ' · ' + esc(PUSH_TXT[R.tier][0]) + '.</p>';
  return h + '</div>';
}
function hksTokenCard() {
  if (!hks.uploadOnce) return '';
  return '<div class="card"><div class="eyebrow">Upload token · shown once</div><p class="small fg2" style="margin:6px 0 10px">Paste this when each Fresh Start shortcut asks for its <b>upload token</b> as you add it. It isn’t saved anywhere, so copy it now. If you lose it, rotate it below for a new one.</p><div class="hkcode" id="hksUp" style="user-select:text;-webkit-user-select:text">' + esc(hks.uploadOnce) + '</div><div class="row" style="gap:10px;margin-top:12px"><button class="btn train sm" data-a="hksCopyUp">Copy</button><button class="btn ghost sm" data-a="hksUpDone">I’ve pasted it</button></div></div>';
}
function hksPairCard() {
  return '<div class="card stack"><div><h3 class="h-sm">Connect Apple Health</h3><p class="small fg2" style="margin:6px 0 0">Enter the setup code for your Health Sync server. The app keeps a read token on this device; you’ll get a separate upload token to paste into the iPhone shortcuts.</p></div>' +
    '<input class="field" id="hksCode" data-in="hksCode" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Setup code" aria-label="Setup code" value="' + esc(ui.hksCode || '') + '">' +
    (ui.hksErr ? '<p class="small" style="margin:0;color:var(--bad)">' + esc(ui.hksErr) + '</p>' : '') +
    (hksBaseUnset() ? '<p class="xs muted" style="margin:0">The server address isn’t set. Open <b>Advanced</b> at the bottom of this screen first.</p>' : '') +
    '<button class="btn train block" data-a="hksPair"' + (hks.pairing ? ' disabled' : '') + '>' + (hks.pairing ? 'Pairing…' : 'Pair') + '</button></div>';
}
function hksControlsCard() {
  const arm = (k, idle, sure) => (ui.hksArm === k ? sure : idle);
  const row = (t, sub, btn) => '<div class="row" style="gap:12px"><span class="grow"><span style="font-weight:600;display:block">' + t + '</span><span class="small muted">' + sub + '</span></span>' + btn + '</div>';
  return '<div class="card stack"><h3 class="h-sm">Pairing and data</h3>' +
    row('Rotate upload token', 'Makes a new token for the shortcuts and revokes the old one', '<button class="btn ghost sm" data-a="hksRotate" data-v="upload">' + arm('rot-upload', 'Rotate', 'Tap to confirm') + '</button>') +
    row('Rotate read token', 'Replaces this device’s token', '<button class="btn ghost sm" data-a="hksRotate" data-v="read">' + arm('rot-read', 'Rotate', 'Tap to confirm') + '</button>') +
    row('Delete server data', 'Deletes every Health row and run on the server. Days already imported here stay.', '<button class="btn ghost sm" style="color:var(--bad)" data-a="hksDeleteData">' + arm('del', 'Delete', 'Tap to confirm') + '</button>') +
    row('Disconnect', 'Revokes both tokens. The shortcuts stop uploading. Data on the server stays.', '<button class="btn ghost sm" style="color:var(--bad)" data-a="hksDisconnect">' + arm('disc', 'Disconnect', 'Tap to confirm') + '</button>') + '</div>';
}
function hksFold(id, title, body) {
  const open = !!(ui.hksOpen && ui.hksOpen[id]);
  return '<details class="fold"' + (open ? ' open' : '') + '><summary data-a="hksFold" data-v="' + id + '">' + title + '</summary><div class="fb">' + body + '</div></details>';
}
function hksAdvancedCard() {
  const cur = ui.hksApi != null ? ui.hksApi : hksLS.get(HKS_API_KEY) || '';
  return hksFold('adv', 'Advanced', '<p class="small fg2" style="margin:0 0 10px">The Health Sync server address. The read token is sent to this address, so only use your own. Leave it empty for the built-in address (<span class="tnum" style="word-break:break-all">' + esc(HK_API) + '</span>).</p>' +
    '<input class="field" data-in="hksApi" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://…workers.dev" aria-label="Health Sync server address" value="' + esc(cur) + '">' +
    '<div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost sm" data-a="hksApiSave">Save address</button><button class="btn ghost sm" data-a="hksApiReset">Use built-in</button></div>');
}
function hksEmergencyCard() {
  return hksFold('emg', 'Emergency import', '<p class="small fg2" style="margin:0 0 12px">Only if the server route is down. Paste Health text or Health Auto Export JSON, or pick a file. Numbers pasted here use the same rules as the server route.</p>' +
    '<div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn ghost sm" data-a="sheet" data-v="hkpaste">Paste or import a file</button></div>' +
    '<div style="margin-top:16px">' + hkSetupCard() + '</div>' +
    '<details class="fold" style="margin-top:12px"><summary>Build the clipboard shortcut by hand</summary><div class="fb"><ol class="hksteps">' + HK_STEPS.map(([a, b]) => '<li><div class="small">' + a + '</div>' + (b ? '<div class="xs muted" style="margin-top:3px">' + b + '</div>' : '') + '</li>').join('') + '</ol></div></details>');
}

/* ------------------------------------------------------------------ when to look
   Launch (after boot has rendered; never awaited), whenever the app returns to the foreground, and when the network
   comes back. hksRefresh throttles itself. Returning to the app mid-poll continues the poll at once. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (hks.poll && hks.poll.state === 'waiting') hksPollTick(); else hksRefresh();
});
window.addEventListener('online', () => { hks.err = null; hksRefresh({ force: true }); if (hks.poll && hks.poll.state === 'waiting') hksPollTick(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) hksRefresh(); });
if (typeof boot === 'function') {
  const bootBeforeSync = boot;
  boot = function () { // eslint-disable-line no-global-assign
    const p = bootBeforeSync.apply(this, arguments);
    Promise.race([p, new Promise((r) => setTimeout(r, 2500))]).then(() => hksLoadCache()).then(() => hksRefresh({ force: true }), () => {});
    return p;
  };
}
