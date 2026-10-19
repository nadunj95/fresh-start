/* Apple Health bridge + recovery model.
   The iOS Shortcut "Fresh Start Sync" writes recent Health samples as text lines
   (Type|Start|End|Value|Unit) into a secret GitHub gist, which the app reads whenever it opens
   (automatic sync, below); the same text can also be pasted, and Health Auto Export JSON works too. Each import is boiled down to one
   summary per day in S.days[date].hk, which saves and syncs like every other log. recovery() turns
   sleep, HRV, resting heart rate and training load into today's push level, and readiness() in
   core.js combines it with the neck/back check-in. */
'use strict';

const HK_SHIFT = 6 * 3600000; // sleep and HRV belong to the morning they end on (an 18:00 → 18:00 day)
const MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const KG_LB = 2.20462;

/* ------------------------------------------------------------------ parsing */
function hkDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v > 1e11 ? v : v * 1000);
  const s = String(v).trim().replace(/[  ]/g, ' ');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const t = [+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
    if (!m[7]) return new Date(t[0], t[1], t[2], t[3], t[4], t[5]);
    const z = m[7].toUpperCase(), off = z === 'Z' ? 0 : (z[0] === '-' ? -1 : 1) * (+z.slice(1, 3) * 60 + +z.replace(':', '').slice(3, 5));
    return new Date(Date.UTC(t[0], t[1], t[2], t[3], t[4], t[5]) - off * 60000);
  }
  // Shortcuts' default formats: "Oct 17, 2026 at 11:42 PM", "17 Oct 2026 at 23:42", "10/17/26, 11:42 PM"
  const low = s.toLowerCase().replace(/\bat\b/g, ' ').replace(/,/g, ' ');
  const tm = low.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
  let hh = 0, mi = 0, ss = 0;
  if (tm) {
    hh = +tm[1]; mi = +tm[2]; ss = +(tm[3] || 0);
    if (tm[4]) { const pm = tm[4][0] === 'p'; if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
  }
  const rest = tm ? low.replace(tm[0], ' ') : low;
  let y, mon, d;
  const mo = MON3.findIndex((x) => new RegExp('\\b' + x).test(rest));
  if (mo >= 0) {
    const ns = (rest.match(/\d+/g) || []).map(Number);
    y = ns.find((n) => n > 31); d = ns.find((n) => n >= 1 && n <= 31); mon = mo;
  } else {
    const n = rest.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
    if (!n) { const t = Date.parse(s); return isNaN(t) ? null : new Date(t); }
    mon = +n[1] - 1; d = +n[2]; y = +n[3]; // month first, as en-US Shortcuts writes it
    if (mon > 11) { mon = +n[2] - 1; d = +n[1]; }
  }
  if (y == null || d == null) return null;
  if (y < 100) y += 2000;
  return new Date(y, mon, d, hh, mi, ss);
}
function hkNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).replace(/[\s  ]/g, '');
  if (/^-?\d+,\d{1,2}(?!\d)/.test(s) && s.indexOf('.') < 0) s = s.replace(',', '.'); // "52,3 ms"
  const m = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? +m[0] : null;
}
function hkKind(t) {
  t = String(t || '').toLowerCase().replace(/_/g, ' ');
  if (/sleep/.test(t)) return 'sleep';
  if (/variab|hrv/.test(t)) return 'hrv';
  if (/resting/.test(t)) return 'rhr';
  if (/walking/.test(t) && /heart/.test(t)) return 'whr';
  if (/respirat/.test(t)) return 'resp';
  if (/oxygen|spo2|saturation/.test(t)) return 'spo2';
  if (/vo2|cardio fitness/.test(t)) return 'vo2';
  if (/heart ?rate/.test(t)) return 'hr';
  if (/active ?(energy|calories)/.test(t)) return 'kcal';
  if (/step/.test(t)) return 'steps';
  if (/exercise/.test(t)) return 'exmin';
  if (/body ?mass|weight/.test(t) && !/lean|index/.test(t)) return 'weight';
  if (/workout/.test(t)) return 'workout';
  return null;
}
function hkStage(v) {
  v = String(v || '').toLowerCase();
  if (/awake/.test(v)) return 'awake';
  if (/in ?bed/.test(v)) return 'inbed';
  if (/deep/.test(v)) return 'deep';
  if (/\brem\b/.test(v)) return 'rem';
  if (/core|light/.test(v)) return 'core';
  const n = parseInt(v, 10); // HealthKit category codes
  if (!isNaN(n) && n >= 0 && n <= 5) return ['inbed', 'asleep', 'awake', 'core', 'deep', 'rem'][n];
  return 'asleep';
}

/* text from the Shortcut, or JSON from Health Auto Export / a native bridge → { samples } or { days } */
function hkParse(text) {
  text = String(text || '').trim();
  if (!text) return null;
  if (text[0] === '{' || text[0] === '[') { try { return hkFromJSON(JSON.parse(text)); } catch (e) { /* not JSON: read as lines */ } }
  const samples = [];
  text.split(/\r?\n/).forEach((line) => {
    const f = line.split(/\s*[|\t]\s*/);
    if (f.length < 3) return;
    const kind = hkKind(f[0]); if (!kind) return;
    const start = hkDate(f[1]), end = hkDate(f[2]) || start;
    if (!start) return;
    samples.push({ kind, start, end, val: f[3] || '', unit: (f[4] || '').trim(), extra: f.slice(5).join(' ') });
  });
  return { samples };
}
function hkFromJSON(o) {
  if (o && o.days && typeof o.days === 'object' && !Array.isArray(o.days)) return { days: o.days };
  const data = (o && o.data) || o || {}, out = [];
  (data.metrics || []).forEach((m) => {
    const kind = hkKind(m.name); if (!kind) return;
    (m.data || []).forEach((e) => {
      if (kind === 'sleep' && !(e.startDate || e.start)) {
        const end = hkDate(e.sleepEnd || e.inBedEnd || e.date), h = (k) => (hkNum(e[k]) == null ? null : hkNum(e[k]) * 60);
        if (end) out.push({ kind: 'sleepday', start: hkDate(e.sleepStart || e.inBedStart) || end, end, asleep: h('totalSleep') != null ? h('totalSleep') : h('asleep'), deep: h('deep'), rem: h('rem'), core: h('core'), awake: h('awake'), inbed: h('inBed') });
      } else if (kind === 'sleep') {
        out.push({ kind, start: hkDate(e.startDate || e.start), end: hkDate(e.endDate || e.end), val: e.value || e.stage || '', unit: '' });
      } else {
        const d = hkDate(e.date || e.startDate);
        out.push({ kind, start: d, end: hkDate(e.endDate) || d, val: e.qty != null ? e.qty : e.Avg != null ? e.Avg : e.avg, unit: m.units || '' });
      }
    });
  });
  (data.workouts || []).forEach((w) => {
    const start = hkDate(w.start || w.startDate), en = w.activeEnergyBurned || w.activeEnergy || {};
    const kcal = hkNum(en.qty != null ? en.qty : en);
    out.push({ kind: 'workout', start, end: hkDate(w.end || w.endDate) || start, val: w.name || '', unit: '', min: hkNum(w.duration) != null ? hkNum(w.duration) / 60 : null, kcal: kcal != null && /kj/i.test(en.units || '') ? kcal / 4.184 : kcal });
  });
  return { samples: out.filter((s) => s.start) };
}

/* union length of [start, end] intervals, in minutes (iPhone + Watch often record the same night) */
function hkUnion(iv) {
  const a = iv.filter((x) => x[1] > x[0]).sort((p, q) => p[0] - q[0]);
  let tot = 0, cs = null, ce = null;
  a.forEach(([s, e]) => { if (ce == null || s > ce) { if (ce != null) tot += ce - cs; cs = s; ce = e; } else ce = Math.max(ce, e); });
  if (ce != null) tot += ce - cs;
  return tot / 60000;
}
function hkSummarize(samples) {
  const days = {}, at = (k) => days[k] || (days[k] = {});
  const night = {}, hrv = {}, rhr = {}, wt = {}, whr = {}, resp = {}, spo2 = {}, vo2 = {}, hr = {};
  const cal = (t) => iso(t), shifted = (t) => iso(new Date(t.getTime() + HK_SHIFT));
  const unit = S.settings.unit || 'lb';
  const eIv = [], hIv = [], wks = []; // hourly energy / heart rate, matched to workouts below
  samples.forEach((s) => {
    const v = hkNum(s.val);
    switch (s.kind) {
      case 'sleep': { const k = shifted(s.end); (night[k] = night[k] || []).push([s.start.getTime(), s.end.getTime(), hkStage(s.val + ' ' + (s.extra || ''))]); break; }
      case 'sleepday': {
        const r = (x) => (x == null ? null : Math.round(x));
        at(shifted(s.end)).sleep = { asleep: r(s.asleep), deep: r(s.deep), rem: r(s.rem), core: r(s.core), awake: r(s.awake), inbed: r(s.inbed), start: s.start.getTime(), end: s.end.getTime() };
        break;
      }
      case 'hrv': if (v != null && v > 5 && v < 300) { const k = shifted(s.start); (hrv[k] = hrv[k] || []).push(v); } break;
      case 'rhr': if (v != null && v > 25 && v < 140) { const k = cal(s.start); (rhr[k] = rhr[k] || []).push(v); } break;
      case 'whr': if (v != null && v > 30 && v < 200) { const k = cal(s.start); (whr[k] = whr[k] || []).push(v); } break;
      case 'resp': if (v != null && v > 4 && v < 40) { const k = cal(s.start); (resp[k] = resp[k] || []).push(v); } break;
      case 'spo2': { if (v == null) break; const x = v <= 1.5 ? v * 100 : v; if (x >= 70 && x <= 100) { const k = cal(s.start); (spo2[k] = spo2[k] || []).push(x); } break; }
      case 'vo2': if (v != null && v >= 10 && v <= 90) { const k = cal(s.start); if (!vo2[k] || s.start >= vo2[k].t) vo2[k] = { t: s.start, x: v }; } break;
      case 'hr': if (v != null && v >= 30 && v <= 200) { const k = cal(s.start); (hr[k] = hr[k] || []).push(v); if (s.end - s.start <= 2 * 3600000) hIv.push([s.start.getTime(), s.end.getTime(), v]); } break;
      case 'kcal': case 'steps': case 'exmin': {
        if (v == null) break;
        let x = v;
        if (s.kind === 'kcal' && /kj/i.test(s.unit)) x = v / 4.184;
        if (s.kind === 'exmin' && /^(s|sec)/i.test(s.unit)) x = v / 60;
        const d = at(cal(s.start)); d[s.kind] = (d[s.kind] || 0) + x;
        if (s.kind === 'kcal' && s.end - s.start <= 2 * 3600000) eIv.push([s.start.getTime(), s.end.getTime(), x]);
        break;
      }
      case 'weight': {
        if (v == null) break;
        let x = v;
        if (/kg/i.test(s.unit) && unit === 'lb') x = v * KG_LB;
        else if (/lb|pound/i.test(s.unit) && unit === 'kg') x = v / KG_LB;
        const k = cal(s.start);
        if (!wt[k] || s.start >= wt[k].t) wt[k] = { t: s.start, x };
        break;
      }
      case 'workout': {
        const min = s.min != null ? s.min : (s.end - s.start) / 60000;
        if (!(min > 0)) break;
        const d = at(cal(s.start)); d.wk = d.wk || [];
        const w = { n: String(s.val || 'Workout').slice(0, 40).replace(/[\s,;:|·-]*[\d.,:]+\s*(?:min(?:ute)?s?|kcal|cal|km|mi|m|kj|bpm|h|hr)?\s*$/i, '').trim() || 'Workout', min: Math.round(min), kcal: s.kcal != null ? Math.round(s.kcal) : hkNum(s.extra) };
        d.wk.push(w); wks.push([s.start.getTime(), s.end.getTime(), w]);
        break;
      }
    }
  });
  Object.keys(night).forEach((k) => {
    const iv = night[k], of = (...st) => iv.filter((x) => st.includes(x[2]));
    const sl = of('asleep', 'core', 'deep', 'rem');
    if (!sl.length) return;
    // the main sleep is the longest block (gaps under 90 min joined); naps still count toward the total
    const blocks = [];
    sl.slice().sort((a, b) => a[0] - b[0]).forEach(([s, e]) => { const b = blocks[blocks.length - 1]; if (b && s - b[1] < 90 * 60000) b[1] = Math.max(b[1], e); else blocks.push([s, e]); });
    const main = blocks.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
    const n = (x) => { const m = Math.round(hkUnion(x)); return m || null; };
    at(k).sleep = { asleep: Math.round(hkUnion(sl)), deep: n(of('deep')), rem: n(of('rem')), core: n(of('core')), awake: n(of('awake')), inbed: n(of('inbed', 'asleep', 'core', 'deep', 'rem')), start: main[0], end: main[1] };
  });
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  Object.keys(hrv).forEach((k) => { at(k).hrv = Math.round(avg(hrv[k])); });
  Object.keys(rhr).forEach((k) => { at(k).rhr = Math.round(avg(rhr[k])); });
  const r1 = (x) => Math.round(x * 10) / 10;
  Object.keys(whr).forEach((k) => { at(k).whr = Math.round(avg(whr[k])); });
  Object.keys(resp).forEach((k) => { at(k).resp = r1(avg(resp[k])); });
  Object.keys(spo2).forEach((k) => { at(k).spo2 = Math.round(avg(spo2[k])); });
  Object.keys(vo2).forEach((k) => { at(k).vo2 = r1(vo2[k].x); });
  Object.keys(hr).forEach((k) => { at(k).hr = Math.round(avg(hr[k])); });
  Object.keys(wt).forEach((k) => { at(k).weight = Math.round(wt[k].x * 10) / 10; });
  Object.keys(days).forEach((k) => { ['kcal', 'steps', 'exmin'].forEach((f) => { if (days[k][f] != null) days[k][f] = Math.round(days[k][f]); }); });
  // workouts carry no calories or heart rate of their own in the Shortcut text: share out the hourly (never daily)
  // active energy by overlap, and average the hourly heart rate across the hours it covers (approximate)
  const lap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  wks.forEach(([ws, we, w]) => {
    if (w.kcal == null) {
      let k = 0, hit = false;
      eIv.forEach(([s0, s1, x]) => { const o = lap(ws, we, s0, s1); if (o > 0 && s1 > s0) { k += x * o / (s1 - s0); hit = true; } });
      if (hit) { w.kcal = Math.round(k); w.est = 1; }
    }
    let hs = 0, hw = 0;
    hIv.forEach(([s0, s1, x]) => { const o = lap(ws, we, s0, Math.max(s1, s0 + 1)); if (o > 0) { hs += x * o; hw += o; } });
    if (hw) w.hr = Math.round(hs / hw);
  });
  return days;
}

/* merge an import into the log. The oldest day in a window is usually only partly covered, so there
   existing values win (cumulative ones take the larger). Weight and steps fill the manual fields
   unless you typed your own. */
function hkImport(text) {
  const p = hkParse(text);
  if (!p) return { n: 0 };
  const days = p.days || hkSummarize(p.samples || []);
  const keys = Object.keys(days).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && days[k] && Object.keys(days[k]).length).sort();
  if (!keys.length) return { n: 0 };
  const edge = p.days || keys.length < 2 ? null : keys[0], now = Date.now(), found = new Set();
  keys.forEach((k) => {
    const nw = days[k], d = day(k), old = d.hk || {}, m = Object.assign({}, old);
    Object.keys(nw).forEach((f) => {
      const v = nw[f]; if (v == null) return;
      found.add(f);
      if (k === edge && old[f] != null) { if (['steps', 'kcal', 'exmin'].includes(f)) m[f] = Math.max(v, old[f]); }
      else m[f] = v;
    });
    m.at = now; d.hk = m;
    if (m.weight != null && (!d.weight || d.wsrc === 'hk')) { d.weight = m.weight.toFixed(1); d.wsrc = 'hk'; }
    if (m.steps != null && (!d.steps || d.ssrc === 'hk')) { d.steps = String(m.steps); d.ssrc = 'hk'; }
    d.u = now; Cloud.dirty.add('w-' + mondayOf(k));
  });
  S.settings.hk = { at: now, from: keys[0], to: keys[keys.length - 1], n: keys.length, has: Array.from(found) };
  S.u = now; Cloud.dirty.add('meta');
  lsSet(); Cloud.schedule();
  hkMemo = {};
  return { n: keys.length, has: Array.from(found) };
}

/* ------------------------------------------------------------------ recovery model */
let hkMemo = {};
const hkOf = (date) => peek(date).hk || null;
const hkConnected = () => !!(S.settings.hk && S.settings.hk.at);
const sleepGoal = () => S.settings.sleepGoal || 7.5;
function sleepH(date) { const h = hkOf(date); return h && h.sleep && h.sleep.asleep != null ? h.sleep.asleep / 60 : null; }
function hkSeries(date, key, n) { const xs = []; for (let i = 1; i <= n; i++) { const h = hkOf(addDays(date, -i)); if (h && h[key] != null) xs.push(h[key]); } return xs; }
const hkMean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const hkSd = (xs) => { const m = hkMean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, xs.length - 1)); };
const hkMedian = (xs) => { const a = xs.slice().sort((p, q) => p - q), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };

/* a rough session-RPE × minutes load per day: the larger of what you logged here and what the Watch saw */
function dayLoad(date) {
  const d = peek(date), h = d.hk || {};
  let app = 0;
  Object.keys(d.done || {}).forEach((k) => {
    if (!k.startsWith('s:')) return;
    const sid = k.slice(2);
    const s = ['min', 'minA', 'minB'].includes(sid) ? { type: 'lift', min: true } : plan(date).sessions.find((x) => x.sid === sid);
    if (!s) return;
    app += s.type === 'lift' ? (s.min ? 180 : 360) : s.type === 'hiit' ? 320 : s.type === 'cardio' ? ((s.cardio && s.cardio.min) || 30) * 5 : 0;
  });
  let watch = 0;
  if (h.wk && h.wk.length) watch = h.wk.reduce((a, w) => { const r = w.kcal && w.min ? w.kcal / w.min : 6; return a + w.min * (r >= 10 ? 8 : r >= 6 ? 6 : 4); }, 0);
  else if (h.exmin) watch = h.exmin * 4;
  return Math.max(app, watch);
}

const PUSH_TXT = {
  push: ['Push', 'Recovered and fresh. Go after it inside the plan: top of every rep range, take the load jumps, finisher at full effort.'],
  green: ['Train as written', 'A normal day. Full session as planned.'],
  yellow: ['Hold back', 'Recovery is down. One set fewer per exercise, skip the finisher.'],
  red: ['Recover', 'Armor + walk, or the 30-minute Minimum session.'],
};

function recovery(date) {
  const key = (S.savedAt || 0) + '|' + sleepGoal();
  if (hkMemo[date] && hkMemo[date].key === key) return hkMemo[date].r;
  const goal = sleepGoal(), h = hkOf(date) || {};
  const R = { score: null, tier: null, flags: [], parts: [], why: [], sleepH: sleepH(date), hrv: h.hrv != null ? h.hrv : null, rhr: h.rhr != null ? h.rhr : null };

  if (R.sleepH != null) {
    let sc = clamp((R.sleepH - 5) / (goal - 5), 0, 1) * 100, debt = 0;
    for (let i = 0; i < 3; i++) { const x = sleepH(addDays(date, -i)); if (x != null) debt += Math.max(0, goal - x); }
    R.debt = debt;
    if (debt > 1.5) sc -= Math.min(25, (debt - 1.5) * 10);
    R.parts.push({ k: 'sleep', score: clamp(sc, 0, 100), w: 40 });
    if (debt > 3) R.why.push(debt.toFixed(1) + ' h short on sleep over 3 nights');
  }
  const hb = hkSeries(date, 'hrv', 28);
  if (R.hrv != null && hb.length >= 7) {
    const L = hb.map(Math.log), m = hkMean(L), s = Math.max(0.06, hkSd(L)), z = (Math.log(R.hrv) - m) / s;
    R.hrvBase = Math.exp(m); R.hrvZ = z;
    R.parts.push({ k: 'hrv', score: clamp(55 + z * 22, 0, 100), w: 30 });
    if (z <= -1.5) { R.flags.push('hrv'); R.why.push('HRV ' + Math.round((1 - R.hrv / R.hrvBase) * 100) + '% under your normal'); }
  }
  const rb = hkSeries(date, 'rhr', 28);
  if (R.rhr != null && rb.length >= 7) {
    R.rhrBase = hkMean(rb); R.rhrD = R.rhr - R.rhrBase;
    R.parts.push({ k: 'rhr', score: clamp(75 - R.rhrD * 7, 0, 100), w: 15 });
    if (R.rhrD >= 7) { R.flags.push('rhr'); R.why.push('resting HR up ' + Math.round(R.rhrD) + ' bpm'); }
  }
  const loads = []; let logged = 0;
  for (let i = 1; i <= 28; i++) { const dd = addDays(date, -i); loads.push(dayLoad(dd)); if (Object.keys(peek(dd)).length > 1) logged++; }
  const chronic = hkMean(loads);
  if (logged >= 14 && chronic > 30) {
    R.acwr = hkMean(loads.slice(0, 7)) / chronic;
    R.parts.push({ k: 'load', score: R.acwr < 0.8 ? 85 : R.acwr <= 1.3 ? 80 : R.acwr <= 1.5 ? 50 : 25, w: 15 });
    if (R.acwr > 1.5) { R.flags.push('load'); R.why.push('this week’s load is ' + R.acwr.toFixed(1) + '× your 4-week average'); }
  }
  if (R.parts.some((p) => p.k === 'sleep' || p.k === 'hrv')) {
    const W = R.parts.reduce((a, p) => a + p.w, 0);
    R.score = Math.round(R.parts.reduce((a, p) => a + p.score * p.w, 0) / W);
    const body = R.parts.some((p) => p.k === 'hrv' || p.k === 'rhr');
    let t = R.score >= 80 ? 'push' : R.score >= 60 ? 'green' : R.score >= 45 ? 'yellow' : 'red';
    // a push day needs a body signal (HRV or resting HR), a clean slate and a full night
    if (t === 'push' && (!body || R.flags.length || (R.sleepH != null && R.sleepH < Math.min(7, goal)))) t = 'green';
    if (R.flags.length && t === 'green') t = 'yellow';
    if (R.flags.includes('hrv') && R.flags.includes('rhr')) { t = 'red'; R.why.push('together these often come before getting sick'); }
    R.tier = t;
  }
  hkMemo[date] = { key, r: R };
  return R;
}
/* final level for a day: the plan's check-in rules, made stricter (never looser) by Health, plus push days */
function pushDay(date) { return readiness(date) === 'green' && recovery(date).tier === 'push'; }
function dayTier(date) { const r = readiness(date); return r === 'green' && recovery(date).tier === 'push' ? 'push' : r; }

/* when to be in bed tonight: median wake time over the last week, minus the sleep goal stretched by
   your usual efficiency (time asleep / time in bed) */
function bedtime(date) {
  const wakes = [], effs = [];
  for (let i = 0; i < 7; i++) {
    const s = (hkOf(addDays(date, -i)) || {}).sleep;
    if (!s || !s.end || !s.asleep) continue;
    const e = new Date(s.end); wakes.push(e.getHours() * 60 + e.getMinutes());
    const bed = s.inbed || (s.end > s.start ? (s.end - s.start) / 60000 : 0);
    if (bed) effs.push(s.asleep / bed);
  }
  if (wakes.length < 3) return null;
  const wake = hkMedian(wakes), eff = clamp(effs.length ? hkMedian(effs) : 0.9, 0.75, 0.98);
  return { wake, bed: Math.round((wake - sleepGoal() * 60 / eff + 2880) % 1440), eff };
}
function fmtClock(min) { const d = new Date(2000, 0, 1, Math.floor(min / 60), Math.round(min % 60)); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function fmtHM(h) { if (h == null) return '–'; const m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad2(m % 60) + ' m'; }
function avgSleep(date, n) { const xs = []; for (let i = 0; i < n; i++) { const x = sleepH(addDays(date, -i)); if (x != null) xs.push(x); } return xs.length ? hkMean(xs) : null; }
function avgSteps(date, n) { const xs = []; for (let i = 0; i < n; i++) { const h = hkOf(addDays(date, -i)); if (h && h.steps != null) xs.push(h.steps); } return xs.length >= 4 ? hkMean(xs) : null; }

/* ------------------------------------------------------------------ UI: Today */
const TIER_TONE = { push: 'good', green: 'good', yellow: 'warn', red: 'bad' };
const TIER_COL = { push: 'var(--good)', green: 'var(--good)', yellow: 'var(--warn)', red: 'var(--bad)' };

function hkConnectRow() {
  return '<button class="card row" style="width:100%;text-align:left;gap:12px;margin-bottom:10px" data-a="push" data-v="health"><span style="width:32px;height:32px;border-radius:8px;background:var(--fuel);color:#fff;display:grid;place-items:center;flex:none">' + ic('heart').replace('<svg', '<svg width="19" height="19"') + '</span><span class="grow"><span style="font-weight:600;display:block">Connect Apple Health</span><span class="small muted">Sleep, HRV and workouts decide how hard to push</span></span>' + ic('next').replace('<svg', '<svg width="18" height="18" style="color:var(--muted)"') + '</button>';
}
function hkChip(label, val, sub, tone) {
  return '<div class="hkc"><div class="xs muted">' + label + '</div><div class="tnum" style="font-weight:700;font-size:17px;margin-top:2px' + (tone ? ';color:var(--' + tone + ')' : '') + '">' + val + '</div>' + (sub ? '<div class="xs muted tnum">' + sub + '</div>' : '') + '</div>';
}
function recoveryCard(date) {
  const R = recovery(date), c = peek(date).chk || {}, final = dayTier(date), t = todayISO();
  const tier = final || R.tier;
  let h = '<div class="card">';
  if (tier) {
    // when the check-in (not Health) set the colour, use the plan's own wording for it
    const advice = final && final !== 'push' && final !== R.tier ? READY_TXT[final][1] : PUSH_TXT[tier][1];
    h += '<div class="row" style="gap:14px;align-items:center"><div class="bigring" style="width:72px;height:72px">' + ringSVG((R.score || 0) / 100, 72, 7, TIER_COL[tier]) + '<div class="c"><div class="h-md tnum">' + (R.score != null ? R.score : '–') + '</div></div></div>' +
      '<div class="grow"><div class="eyebrow">' + (final ? 'Today’s push level' : 'Recovery · finish the check-in') + '</div><div class="h-md" style="color:' + TIER_COL[tier] + ';margin-top:2px">' + PUSH_TXT[tier][0] + '</div><div class="small fg2" style="margin-top:3px">' + esc(advice) + (c.arm ? ' Arm symptoms: stop any exercise that brings on tingling.' : '') + '</div></div></div>';
    const sl = sleepFor(date), why = R.why.slice();
    if (sl != null && sl < 7 && c.sleep == null) why.unshift('slept ' + fmtHM(sl));
    if (c.neck >= 3) why.push('neck ' + c.neck + '/10');
    if (c.sore) why.push('heavy soreness');
    if (c.sick) why.push('sick');
    if (why.length && (tier === 'yellow' || tier === 'red')) h += '<p class="small fg2" style="margin:10px 0 0">Why: ' + esc(why.join('; ')) + '.</p>';
  } else {
    h += '<div class="row" style="gap:12px"><span class="grow"><span class="eyebrow">Recovery</span><span class="small fg2" style="display:block;margin-top:4px">' + (date === t ? 'No sleep or HRV for last night yet. Tap Sync to run Fresh Start Health.' : 'No Apple Health data for this day.') + '</span></span></div>';
  }
  const goal = sleepGoal(), sl = R.sleepH;
  const chips = [];
  if (sl != null) chips.push(hkChip('Sleep', fmtHM(sl).replace(' m', 'm').replace(' h ', 'h '), R.debt > 1.5 ? R.debt.toFixed(1) + ' h debt' : 'goal ' + goal + ' h', sl < 5 ? 'bad' : sl < 7 ? 'warn' : ''));
  if (R.hrv != null) chips.push(hkChip('HRV', R.hrv + ' ms', R.hrvBase ? (R.hrv >= R.hrvBase ? '▲ ' : '▼ ') + Math.abs(Math.round((R.hrv / R.hrvBase - 1) * 100)) + '% vs normal' : 'building baseline', R.hrvZ <= -1.5 ? 'warn' : ''));
  if (R.rhr != null) chips.push(hkChip('Resting HR', R.rhr, R.rhrBase ? (R.rhrD >= 0 ? '+' : '−') + Math.abs(R.rhrD).toFixed(0) + ' vs normal' : 'bpm', R.rhrD >= 7 ? 'warn' : ''));
  if (R.acwr != null) chips.push(hkChip('Load', R.acwr.toFixed(2) + '×', '7 d vs 28 d', R.acwr > 1.5 ? 'warn' : ''));
  if (chips.length) h += '<div class="hkchips">' + chips.join('') + '</div>';
  if (c.neck == null) h += '<button class="btn train block sm" style="margin-top:12px" data-a="sheet" data-v="ready">Finish check-in: neck and back</button>';
  // tonight's bedtime once Health has synced today; until then, when it last synced
  const stA = S.settings.hk, syncedToday = stA && stA.at && iso(new Date(stA.src === 'auto' && stA.up ? stA.up : stA.at)) === t;
  const bt = date === t && syncedToday ? bedtime(date) : null;
  h += '<div class="row small muted" style="justify-content:space-between;margin-top:12px;gap:10px"><span>' + (bt ? 'In bed by <b class="fg2">' + fmtClock(bt.bed) + '</b> for ' + goal + ' h asleep' : hkSyncedLabel()) + '</span><span class="row" style="gap:14px">' + (c.neck != null ? '<button style="color:var(--fg-2);font-weight:600" data-a="sheet" data-v="ready">Check-in</button>' : '') + '<button style="color:var(--link);font-weight:600" data-a="hkSync">Sync</button></span></div>';
  return h + '</div>';
}
/* "Synced 7:02 AM · automatic": for automatic syncs, the time the shortcut read Health */
function hkSyncedLabel() {
  const st = S.settings.hk; if (!st || !st.at) return hkAuto() ? 'Waiting for the first sync' : 'Not synced yet';
  const auto = st.src === 'auto', d = new Date(auto && st.up ? st.up : st.at);
  return 'Synced ' + hkWhen(d) + (auto ? ' · automatic' : '');
}
function hkWhen(d) {
  d = new Date(d);
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), k = iso(d);
  return k === todayISO() ? t : k === addDays(todayISO(), -1) ? 'yesterday ' + t : fmtShort(k) + ', ' + t;
}
/* Today: steps from Health on the walk row */
function hkStepsNote(date) { const h = hkOf(date); return h && h.steps != null ? ' · ' + fmtN(h.steps) + ' today' : ''; }
/* Workout layer banner for push days */
function pushBanner(s) {
  const t = s.type === 'lift' ? 'chase the top of every rep range and take the load jumps the app suggests. Same sets, finisher at full effort.' : s.type === 'hiit' ? 'full effort on every round, same rounds as written.' : 'run it at the top of the prescribed effort.';
  return bannerHTML('good', '<b>Push day:</b> ' + t);
}

/* ------------------------------------------------------------------ UI: Progress */
function hkTrends() {
  if (!hkConnected()) return '<section class="pad section"><div class="sec-h"><h2 class="h-md">Recovery</h2></div>' + hkConnectRow() + '</section>';
  const t = todayISO(), goal = sleepGoal();
  const row = (name, unitTxt, get, max, color) => {
    let bars = '', last = null;
    for (let i = 13; i >= 0; i--) {
      const d = addDays(t, -i), v = get(d);
      if (v != null) last = v;
      bars += '<i style="height:' + (v == null ? 2 : Math.max(3, Math.min(1, v / max) * 100)) + '%;background:' + (v == null ? 'var(--card-3)' : color(v)) + ';opacity:' + (v == null ? 1 : 0.85) + '"></i>';
    }
    return '<div class="row" style="gap:12px"><div style="width:84px"><div class="small fg2">' + name + '</div><div class="h-md tnum">' + (last == null ? '–' : unitTxt(last)) + '</div></div><div class="sparkbars grow">' + bars + '</div></div>';
  };
  const hrvMax = Math.max(60, ...Array.from({ length: 14 }, (_, i) => (hkOf(addDays(t, -i)) || {}).hrv || 0)) * 1.1;
  const rhrMax = Math.max(70, ...Array.from({ length: 14 }, (_, i) => (hkOf(addDays(t, -i)) || {}).rhr || 0)) * 1.1;
  const loadMax = Math.max(400, ...Array.from({ length: 14 }, (_, i) => dayLoad(addDays(t, -i)))) * 1.05;
  let h = '<section class="pad section"><div class="sec-h"><h2 class="h-md">Recovery</h2><span class="small muted">Apple Health · 14 days</span></div><div class="card stack">';
  h += row('Sleep', (v) => fmtHM(v).replace(' m', 'm').replace(' h ', 'h '), sleepH, 10, (v) => (v >= goal ? 'var(--good)' : v >= 7 ? 'var(--mind)' : v >= 5 ? 'var(--warn)' : 'var(--bad)'));
  h += row('HRV', (v) => v + ' ms', (d) => (hkOf(d) || {}).hrv, hrvMax, () => 'var(--mind)');
  h += row('Resting HR', (v) => v, (d) => (hkOf(d) || {}).rhr, rhrMax, () => 'var(--fuel)');
  [['whr', 'Walking HR', (v) => v, 'var(--fuel)'], ['vo2', 'VO2 max', (v) => v.toFixed(1), 'var(--good)']].forEach(([key, name, f, col]) => {
    const vals = Array.from({ length: 14 }, (_, i) => (hkOf(addDays(t, -i)) || {})[key]).filter((x) => x != null);
    if (vals.length) h += row(name, f, (d) => (hkOf(d) || {})[key], Math.max(...vals) * 1.1, () => col);
  });
  h += row('Load', (v) => fmtN(v), (d) => { const x = dayLoad(d); return x || null; }, loadMax, () => 'var(--train)');
  h += '</div>';
  const a7 = avgSleep(t, 7), bt = bedtime(t), st = avgSteps(t, 7);
  h += '<div class="kv" style="margin-top:10px"><div><div class="v tnum">' + (a7 != null ? a7.toFixed(1) : '–') + '<span class="muted" style="font-size:16px"> h</span></div><div class="k">Avg sleep, 7 d</div></div><div><div class="v tnum" style="font-size:22px">' + (bt ? fmtClock(bt.bed) : '–') + '</div><div class="k">In bed by, for ' + goal + ' h</div></div><div><div class="v tnum" style="font-size:22px">' + (st != null ? fmtN(st) : '–') + '</div><div class="k">Avg steps, 7 d</div></div></div>';
  if (a7 != null && a7 < goal - 0.5) h += '<p class="small fg2" style="margin:10px 2px 0">You’re averaging ' + fmtHM(goal - a7) + ' under your sleep goal. Short sleep raises hunger and cuts how much of the loss comes from fat, so it costs the cut as well as the lifts.</p>';
  return h + '</section>';
}
/* shared by Health trends and the weekly summary: a mini line (nulls break it) and a coloured ▲▼ change */
function hkSpark(pts, col) {
  const xs = pts.filter((p) => p != null);
  if (xs.length < 2) return '<div class="grow"></div>';
  const lo = Math.min(...xs), hi = Math.max(...xs), W = 100, Hh = 30, rng = hi - lo || 1, step = W / (pts.length - 1);
  let path = '', pen = false, lastX = 0, lastY = 0;
  pts.forEach((v, i) => { if (v == null) { pen = false; return; } lastX = i * step; lastY = 3 + (1 - (v - lo) / rng) * (Hh - 6); path += (pen ? 'L' : 'M') + lastX.toFixed(1) + ' ' + lastY.toFixed(1); pen = true; });
  return '<svg class="grow" viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" style="height:34px;min-width:0;overflow:visible"><path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="2.6" fill="' + col + '" vector-effect="non-scaling-stroke"/></svg>';
}
function hkChange(cur, base, dir, dec, unit) {
  if (cur == null || base == null) return '<span class="xs muted">Not enough history</span>';
  const dlt = cur - base, f = Math.pow(10, dec), shown = Math.round(dlt * f) / f, pct = base ? Math.abs(dlt / base) : 0;
  if (!shown || pct < 0.02 || !dir) return '<span class="xs muted tnum">' + (shown ? (shown > 0 ? '+' : '−') + Math.abs(shown).toFixed(dec) : 'No change') + '</span>';
  const good = dir * dlt > 0;
  return '<span class="xs tnum" style="font-weight:600;color:var(--' + (good ? 'good' : 'bad') + ')">' + (dlt > 0 ? '▲ +' : '▼ −') + Math.abs(shown).toFixed(dec) + '</span>';
}
/* Health trends: longer-range view with change vs earlier period (range toggle 2w / 4w / 12w) */
const HKP_RANGES = [14, 28, 84];
function hkProgress() {
  const t = todayISO();
  if (!hkConnected()) return '';
  const N = HKP_RANGES.includes(ui.hkRange) ? ui.hkRange : 28, B = Math.max(1, Math.round(N / 14));
  const H = (d) => hkOf(d) || {}, mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const wkCount = (d) => (H(d).wk || []).length, wkMin = (d) => (H(d).wk || []).reduce((a, w) => a + (w.min || 0), 0);
  // [name, daily getter, formatter, unit, good direction (+1 higher / -1 lower), colour, decimals]
  const M = [
    ['Sleep', sleepH, (v) => fmtHM(v).replace(' m', 'm').replace(' h ', 'h '), '', 1, 'var(--mind)', 1],
    ['HRV', (d) => H(d).hrv, (v) => Math.round(v), ' ms', 1, 'var(--mind)', 0],
    ['Resting HR', (d) => H(d).rhr, (v) => Math.round(v), ' bpm', -1, 'var(--fuel)', 0],
    ['Walking HR', (d) => H(d).whr, (v) => Math.round(v), ' bpm', -1, 'var(--fuel)', 0],
    ['VO2 max', (d) => H(d).vo2, (v) => v.toFixed(1), '', 1, 'var(--good)', 1],
    ['Breathing rate', (d) => H(d).resp, (v) => v.toFixed(1), ' /min', -1, 'var(--mind)', 1],
    ['Blood oxygen', (d) => H(d).spo2, (v) => Math.round(v), '%', 1, 'var(--mind)', 0],
    ['Steps', (d) => H(d).steps, (v) => fmtN(v), '', 1, 'var(--train)', 0],
    ['Active energy', (d) => H(d).kcal, (v) => fmtN(v), ' kcal', 1, 'var(--fuel)', 0],
    ['Exercise', (d) => H(d).exmin, (v) => Math.round(v), ' min', 1, 'var(--train)', 0],
    ['Weight', (d) => { const x = num(peek(d).weight); return x == null ? null : x; }, (v) => v.toFixed(1), ' ' + S.settings.unit, 0, 'var(--train)', 1]
  ];
  const buckets = (get, agg) => Array.from({ length: 14 }, (_, k) => {
    const xs = []; for (let j = 0; j < B; j++) { const v = get(addDays(t, -((13 - k) * B + (B - 1 - j)))); if (v != null) xs.push(v); }
    return xs.length ? agg(xs) : null;
  });
  const spark = hkSpark, change = hkChange;
  let rows = '', any = false;
  const avgOver = (get, from, to) => { const xs = []; for (let i = from; i < to; i++) { const v = get(addDays(t, -i)); if (v != null) xs.push(v); } return xs.length ? mean(xs) : null; }; // one reading is enough: VO2 max and weight are sparse
  M.forEach(([name, get, fmt, unit, dir, col, dec]) => {
    const pts = buckets(get, mean);
    if (!pts.some((p) => p != null)) return;
    any = true;
    let cur = avgOver(get, 0, 7), base = avgOver(get, 7, N);
    if (name === 'Weight') { const w = weights(); cur = avgOver(get, 0, 7); if (cur == null && w.length) cur = w[w.length - 1].w; }
    const wt = name === 'Weight', sleepv = name === 'Sleep';
    let shownCur = cur, dd = dec;
    if (sleepv) dd = 1;
    rows += '<div class="row" style="gap:12px"><div style="width:104px;flex:none"><div class="small fg2">' + name + '</div><div class="h-md tnum">' + (shownCur == null ? '–' : fmt(shownCur)) + '<span class="muted" style="font-size:12px;font-weight:500">' + (shownCur == null ? '' : unit) + '</span></div></div>' + spark(pts, col) + '<div style="width:92px;flex:none;text-align:right">' + (wt ? change(cur, base, 0, dd, unit) : change(cur, base, dir, dd, unit)) + '</div></div>';
  });
  // workouts per week: count + minutes, last 7 days vs the weekly average before
  const wkSeries = buckets((d) => wkMin(d), (xs) => mean(xs)), wkAny = Array.from({ length: N }, (_, i) => wkCount(addDays(t, -i))).some((x) => x);
  if (wkAny) {
    any = true;
    let n7 = 0, m7 = 0, nb = 0, mb = 0; for (let i = 0; i < 7; i++) { n7 += wkCount(addDays(t, -i)); m7 += wkMin(addDays(t, -i)); }
    for (let i = 7; i < N; i++) { nb += wkCount(addDays(t, -i)); mb += wkMin(addDays(t, -i)); }
    const wks = (N - 7) / 7, base = wks > 0 ? mb / wks : null;
    rows += '<div class="row" style="gap:12px"><div style="width:104px;flex:none"><div class="small fg2">Workouts / wk</div><div class="h-md tnum">' + n7 + '<span class="muted" style="font-size:12px;font-weight:500"> · ' + Math.round(m7) + ' min</span></div></div>' + spark(wkSeries, 'var(--train)') + '<div style="width:92px;flex:none;text-align:right">' + change(m7, base, 1, 0, ' min') + '</div></div>';
  }
  let h = '<section class="pad section"><div class="sec-h"><h2 class="h-md">Health trends</h2><span class="small muted">Last 7 days vs before</span></div>';
  h += '<div class="row" style="gap:6px;margin-bottom:10px">' + HKP_RANGES.map((r) => '<button class="chip' + (r === N ? ' good' : '') + '" style="flex:1;justify-content:center;padding:7px 0" data-a="hkRange" data-v="' + r + '">' + r / 7 + ' weeks</button>').join('') + '</div>';
  if (!any) return h + '<div class="card small fg2">No Health data in this range yet. Run a sync to fill it in.<button class="btn sm" style="margin-top:10px;display:block" data-a="push" data-v="health">Open Health</button></div></section>';
  return h + '<div class="card stack">' + rows + '</div><p class="xs muted" style="margin:8px 2px 0">Green means moving the right way: lower heart rate and breathing, higher HRV, VO2, sleep, steps and activity.</p></section>';
}
A.hkRange = (el) => { ui.hkRange = +el.dataset.v; render(); };
/* calibration: the plan says cut 150 kcal *or* add 2,000 steps; with Health steps we can say which */
function hkCalNote(c) {
  if (!c || c.act >= 0) return '';
  const st = avgSteps(c.sun, 7);
  if (st == null) return '';
  return st < 9000 ? '<p class="small fg2" style="margin:8px 0 0"><b>Apple Health:</b> steps averaged ' + fmtN(st) + ' this week, under the 9,000 floor. Add the 2,000 steps first and keep the food.</p>'
    : '<p class="small fg2" style="margin:8px 0 0"><b>Apple Health:</b> steps averaged ' + fmtN(st) + ', already on target. Take the 150 kcal from carbs or fat.</p>';
}

/* ------------------------------------------------------------------ UI: Settings card + setup layer + paste sheet */
function hkSettingsCard() {
  const st = S.settings.hk;
  let h = '<div class="card stack"><div class="row"><span class="grow"><span style="font-weight:600;display:block">Apple Health</span><span class="small muted">' + (st && st.at ? hkSyncedLabel() + ' · ' + fmtShort(st.from) + ' – ' + fmtShort(st.to) : 'Not connected') + '</span></span><button class="btn ghost sm" data-a="push" data-v="health">' + (st && st.at ? 'Manage' : 'Set up') + '</button></div>';
  h += '<div class="row"><span class="grow"><span style="font-weight:600;display:block">Sleep goal</span><span class="small muted">Sets the sleep score and tonight’s bedtime</span></span><div class="row" style="gap:6px"><button class="icon-btn" style="width:36px;height:36px" data-a="hkGoal" data-v="-0.25" aria-label="Less sleep">' + ic('minus') + '</button><span class="tnum" style="min-width:52px;text-align:center;font-weight:700">' + sleepGoal() + ' h</span><button class="icon-btn" style="width:36px;height:36px" data-a="hkGoal" data-v="0.25" aria-label="More sleep">' + ic('plus') + '</button></div></div>';
  return h + '</div>';
}

/* ------------------------------------------------------------------ automatic sync (a secret GitHub gist)
   The Fresh Start Sync shortcut PATCHes health.txt in a secret gist on the user's own GitHub account;
   the app reads the gist when it opens or comes back to the foreground and imports anything newer than
   what it last imported. The gist id lives in S.settings.hkGist (it syncs, so every device can read the
   gist; a secret gist needs no auth to read). The token stays in this device's localStorage only. */
const HKG_TOKEN_KEY = 'fs2.hkgist.token';
const HKG_NAME = 'Fresh Start Sync';
const HKG_FILE = 'sync/Fresh%20Start%20Sync.shortcut';
const HKG_RUN = 'shortcuts://run-shortcut?name=' + encodeURIComponent(HKG_NAME);
const HKG_NEW_TOKEN = 'https://github.com/settings/tokens/new?scopes=gist&description=Fresh%20Start%20Health';
const HKG_API = 'https://api.github.com/gists';
const HKG_PLACEHOLDER = '#fresh-start-sync v1|waiting for the first run of the Fresh Start Sync shortcut\n';
const hkg = { busy: false, last: 0, state: '', msg: '', waitUntil: 0, timer: null, awaitPaste: 0 };
/* clipboard flow: the Fresh Start Health shortcut copies Health to the clipboard, the app pastes it on return */
const HKS_NAME = 'Fresh Start Health';
const HKS_READY = true; // sync/Fresh Start Health.shortcut is signed (2026-10-19)
const HKS_FILE = 'sync/Fresh%20Start%20Health.shortcut';
const HKS_RUN = 'shortcuts://run-shortcut?name=' + encodeURIComponent(HKS_NAME);
function hkTok() { try { return localStorage.getItem(HKG_TOKEN_KEY) || ''; } catch (e) { return ''; } }
function hkTokSet(v) { try { if (v) localStorage.setItem(HKG_TOKEN_KEY, v); else localStorage.removeItem(HKG_TOKEN_KEY); } catch (e) { /* storage blocked */ } }
function hkAuto() { return !!(S.settings && S.settings.hkGist); }
function hkCode() { const t = hkTok(); return hkAuto() && t ? S.settings.hkGist + '~' + t : ''; }
function hkHeaders(tok, json) {
  const h = { Accept: 'application/vnd.github+json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
const hkTyping = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'file'); };
function hkStatusLine() {
  return ''; // the GitHub sync is switched off
  if (!hkAuto()) return '';
  const st = S.settings.hk, up = st && st.src === 'auto' && st.up;
  let s = 'Automatic sync · ' + (up ? 'last upload from Health ' + hkWhen(up) : 'no upload from the shortcut yet');
  if (hkg.busy) s += ' · checking…';
  else if (hkg.state === 'offline') s += ' · offline, will check again';
  else if (hkg.state === 'error') s += ' · ' + hkg.msg;
  else if (hkg.last) s += ' · checked ' + hkWhen(hkg.last);
  return s;
}

/* read the gist and import it if it changed. force skips the 10-minute throttle. */
async function hkGistCheck(force) {
  return { n: 0 }; // the GitHub sync is switched off
  const id = S.settings.hkGist;
  if (!id || hkg.busy || typeof fetch !== 'function' || document.hidden) return { n: 0 };
  if (!force && Date.now() - hkg.last < 10 * 60000) return { n: 0 };
  if (navigator.onLine === false) { hkg.state = 'offline'; return { n: 0 }; }
  hkg.busy = true; hkg.last = Date.now();
  let out = { n: 0 };
  try {
    const url = HKG_API + '/' + encodeURIComponent(id), tok = hkTok();
    let res = await fetch(url, { headers: hkHeaders(tok), cache: 'no-store' });
    if (res.status === 401 && tok) res = await fetch(url, { headers: hkHeaders(''), cache: 'no-store' }); // revoked token: a secret gist still reads without one
    if (!res.ok) {
      hkg.state = 'error';
      hkg.msg = res.status === 404 ? 'the gist is gone; disconnect and set up again' : res.status === 403 || res.status === 429 ? 'GitHub is busy, will try again' : 'GitHub answered ' + res.status;
      return out;
    }
    const g = await res.json(), f = (g.files || {})['health.txt'], up = Date.parse(g.updated_at) || 0;
    hkg.state = 'ok'; hkg.msg = '';
    if (!f || up <= (Date.parse(S.settings.hkGistAt || '') || 0)) return out;
    let text = f.content || '';
    if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
    const head = text.match(/^#fresh-start-sync[^|\n]*\|([^\n]*)/m), readAt = head ? hkDate(head[1]) : null;
    out = hkImport(text);
    S.settings.hkGistAt = g.updated_at;
    if (out.n) { S.settings.hk.src = 'auto'; S.settings.hk.up = readAt && !isNaN(readAt) ? readAt.getTime() : up; hkg.waitUntil = 0; }
    touch();
    if (out.n) toast('Apple Health updated');
  } catch (e) {
    hkg.state = navigator.onLine === false ? 'offline' : 'error';
    if (hkg.state === 'error') hkg.msg = 'couldn’t reach GitHub, will try again';
  } finally {
    hkg.busy = false;
    // after "Run sync now", keep looking for a couple of minutes: the shortcut may still be uploading
    clearTimeout(hkg.timer);
    if (Date.now() < hkg.waitUntil) hkg.timer = setTimeout(() => hkGistCheck(true), 8000);
    if (out.n || ui.stack.some((l) => l.v === 'health')) { if (!hkTyping()) render(); }
  }
  return out;
}

/* ------------------------------------------------------------------ UI: Health layer */
const HK_STEPS = [
  ['Open <b>Shortcuts</b> on your iPhone, tap <b>+</b>, and name the shortcut <b>Fresh Start Health</b>.', ''],
  ['Add <b>Find Health Samples</b>. Set <b>Type</b> to <b>Steps</b>, add the filter <b>Start Date is in the last 10 days</b>, turn on <b>Group By: Day</b>, and leave the limit off.', 'Grouping by day stops the iPhone and the Watch counting the same steps twice.'],
  ['Add <b>Add to Variable</b> and name the variable <b>Health</b>.', ''],
  ['Repeat steps 2 and 3 for <b>Active Calories</b> and <b>Exercise Minutes</b>, each with <b>Group By: Day</b> turned on.', ''],
  ['Repeat steps 2 and 3 for <b>Sleep</b>, <b>Resting Heart Rate</b> and <b>Heart Rate Variability</b>, with the same 10-day filter.', 'Leave these ungrouped so each reading comes through. Add <b>Weight</b> the same way only if a smart scale writes to Health: a type with no data stops the shortcut.'],
  ['Add <b>Repeat with Each</b> and pick the <b>Health</b> variable.', ''],
  ['Inside the repeat, add a <b>Text</b> action and build this line from the Repeat Item’s details, with a <b>|</b> between each one:<div class="hkcode">Type|Start Date|End Date|Value|Unit</div>', 'Tap each date and set Date Format to ISO 8601. The app can also read the default format.'],
  ['After <b>End Repeat</b>, add <b>Combine Text</b> (Repeat Results, New Lines), then <b>Copy to Clipboard</b>.', ''],
  ['Run it once from <b>Sync now</b> in this app and allow Health access for each type. Then each morning, tap <b>Sync now</b>, switch back and tap <b>Paste Health data</b>.', 'Keep the iPhone unlocked while it runs, because Health data is locked when the phone is.'],
];
function hkNum0(n, done) {
  return '<span aria-hidden="true" style="flex:none;width:26px;height:26px;border-radius:13px;display:grid;place-items:center;font-weight:700;font-size:14px;' +
    (done ? 'background:var(--good);color:#fff">✓' : 'background:var(--fill);color:var(--fg-2)">' + n) + '</span>';
}
function hkStep(n, done, title, body, dim) {
  return '<div class="row" style="gap:12px;align-items:flex-start' + (dim ? ';opacity:.45' : '') + '">' + hkNum0(n, done) + '<div class="grow" style="min-width:0"><div style="font-weight:600">' + title + '</div>' + (body ? '<div style="margin-top:6px">' + body + '</div>' : '') + '</div></div>';
}
function hkSetupCard() {
  const hk = S.settings.hk, synced = !!(hk && hk.at);
  let h = '<div class="card"><h3 class="h-sm">Connect in 3 steps</h3>';
  if (synced) h += '<p class="small fg2" style="margin:6px 0 0">Last synced: <b>' + hkWhen(hk.at) + '</b></p>';
  h += '<div class="stack" style="margin-top:14px">';
  h += hkStep(1, synced, 'Add the shortcut', HKS_READY ? '<a class="btn train sm" href="' + HKS_FILE + '" download="Fresh Start Health.shortcut">Add Fresh Start Health</a>' +
    '<p class="xs muted" style="margin:8px 0 0">If Safari asks, tap Download, then open it from the ↓ downloads button and tap Add Shortcut. Delete any old Fresh Start Sync shortcut first. If your iPhone won’t add it, build it by hand with the steps further down — it takes about 5 minutes.</p>'
    : '<p class="small fg2" style="margin:0">Build <b>Fresh Start Health</b> by hand with the steps under <b>Build it by hand instead</b> below. It takes about 5 minutes, and because your iPhone builds it, nothing can be set up wrong. (A one-tap install link comes back here once Apple’s shortcut signing service is working again.)</p>');
  h += hkStep(2, synced, 'Tap Sync now', '<button class="btn train sm" data-a="hkSync">Sync now</button>' +
    '<p class="xs muted" style="margin:8px 0 0">Once only: open the Settings app → Apps → Shortcuts → Advanced and turn on <b>Allow Sharing Large Amounts of Data</b>, or Shortcuts stops with “trying to share … Health items”. The first run asks for Health access: turn on every type and tap Allow. Keep the iPhone unlocked while it runs.</p>');
  h += hkStep(3, synced, 'Come back and paste', '<p class="xs muted" style="margin:0">Tap ‹ Fresh Start at the top left (or switch back), then Paste Health data. Do this each morning before your check-in; it takes about 10 seconds.</p>');
  h += '</div>';
  if (S.settings.hkGist) h += '<p class="xs muted" style="margin:14px 0 0">The old GitHub sync is switched off. You can delete the \'Fresh Start Health\' gist on GitHub and the old token whenever you like.</p>';
  return h + '</div>';
}
function lHealth() {
  const st = S.settings.hk, R = recovery(todayISO());
  let h = '<div class="layer"><div class="wrap"><div class="lbar pad solid"><button class="icon-btn" data-a="pop" aria-label="Back">' + ic('back') + '</button><div class="h-sm">Apple Health</div><span style="width:44px"></span></div><div class="pad stack" style="margin-top:8px">';
  h += '<div class="card"><div class="row" style="gap:12px"><span style="width:40px;height:40px;border-radius:10px;background:var(--fuel);color:#fff;display:grid;place-items:center;flex:none">' + ic('heart') + '</span><span class="grow"><span style="font-weight:600;display:block">' + (st && st.at ? 'Connected' : 'Not connected yet') + '</span><span class="small muted">' + (st && st.at ? hkSyncedLabel() + ' · ' + st.n + ' days · ' + hkHasLabel(st.has) : 'Set it up below') + '</span></span></div>' +
    '<div class="row" style="gap:10px;margin-top:14px;flex-wrap:wrap">' + '<button class="btn train sm" data-a="hkSync">Sync now</button>' + '<button class="btn ghost sm" data-a="sheet" data-v="hkpaste">Paste or import a file</button></div>' +
    (R.score != null ? '<p class="small fg2" style="margin:12px 0 0">Today: recovery ' + R.score + ' · ' + esc(PUSH_TXT[R.tier][0]) + '.</p>' : '') + '</div>';
  h += hkFitnessCard();
  h += hkSetupCard();
  h += '<div class="card"><h3 class="h-sm">What it does</h3><ul class="small fg2" style="margin:8px 0 0;padding-left:18px">' + [
    'Reads last night’s sleep, HRV and resting heart rate, and weighs them against your own 4-week normal.',
    'Compares this week’s training (sessions you log here plus Watch workouts) with your 4-week average.',
    'Sets today’s level: <b>Push</b>, <b>Train as written</b>, <b>Hold back</b> or <b>Recover</b>. Health can make a day stricter than your check-in, never looser, and your neck and back rules always apply.',
    'Fills in weigh-ins from a smart scale and daily steps, tells you when to get into bed tonight, and tells you whether calibration should come from steps or food.',
  ].map((x) => '<li style="margin:5px 0">' + x + '</li>').join('') + '</ul><p class="xs muted" style="margin:10px 0 0">Apple doesn’t let web apps read Health directly, so the Fresh Start Health shortcut copies it and you paste it into the app. HRV and resting-HR comparisons start after about a week of data.</p></div>';
  h += '<details class="card"><summary style="font-weight:600;cursor:pointer">Build it by hand instead (5 minutes)</summary><p class="small fg2" style="margin:8px 0 0">Build the shortcut yourself, then run it from <b>Sync now</b> each morning and paste.</p><ol class="hksteps">' + HK_STEPS.map(([a, b]) => '<li><div class="small">' + a + '</div>' + (b ? '<div class="xs muted" style="margin-top:3px">' + b + '</div>' : '') + '</li>').join('') + '</ol></details>';
  h += '<div class="card"><h3 class="h-sm">Already use Health Auto Export?</h3><p class="small fg2" style="margin:6px 0 0">Its JSON export works too. Copy it or save it to Files, then use <b>Paste or import a file</b>.</p></div>';
  h += hkSettingsCard();
  if (st && st.at) h += '<div class="card"><div class="row"><span class="grow"><span style="font-weight:600;display:block">Remove Health data</span><span class="small muted">Clears every imported day. Your own logs stay.</span></span><button class="btn ghost sm" style="color:var(--bad)" data-a="hkClear">' + (ui.hkClearArm ? 'Tap again' : 'Remove') + '</button></div></div>';
  return h + '<p class="xs muted" style="text-align:center;margin-top:4px">Health data stays on your iPhone: the shortcut copies it to the clipboard and the app stores it with your other logs.</p></div></div></div>';
}
function hkFitnessCard() {
  const t = todayISO(), H = (i) => hkOf(addDays(t, -i)) || {};
  const defs = [['rhr', 'Resting HR', 'bpm', 0, true], ['hrv', 'HRV', 'ms', 0, false], ['whr', 'Walking HR', 'bpm', 0, true], ['hr', 'Heart rate', 'bpm avg', 0, true], ['resp', 'Respiratory rate', '/min', 1, true], ['spo2', 'Blood oxygen', '%', 0, false], ['vo2', 'VO2 max', 'mL/kg·min', 1, false]];
  const win = (key, a, b) => { const xs = []; for (let i = a; i < b; i++) { const v = H(i)[key]; if (v != null) xs.push(v); } return xs; };
  let rows = '';
  defs.forEach(([key, name, unit, dp, lowGood]) => {
    const all = win(key, 0, 14); if (!all.length) return;
    let latest = null; for (let i = 0; i < 14; i++) { if (H(i)[key] != null) { latest = H(i)[key]; break; } }
    const a = win(key, 0, 7), b = win(key, 7, 14);
    let sub = '<span class="xs muted">building baseline</span>';
    if (a.length && b.length) {
      const m = hkMean(a), dlt = m - hkMean(b), tiny = Math.abs(dlt) < (dp ? 0.05 : 0.5);
      const good = lowGood ? dlt < 0 : dlt > 0;
      sub = '<span class="tnum" style="font-weight:600;' + (tiny ? '' : 'color:var(--' + (good ? 'good' : 'warn') + ')') + '">' + (tiny ? '→' : dlt > 0 ? '↑' : '↓') + ' ' + m.toFixed(dp) + '</span> <span class="xs muted">' + (tiny ? 'steady' : (dlt > 0 ? '+' : '−') + Math.abs(dlt).toFixed(dp)) + ' vs last week</span>';
    }
    rows += '<div class="row" style="gap:12px;padding:6px 0"><span class="grow"><span class="small fg2" style="display:block">' + name + '</span><span class="small">' + sub + '</span></span><span class="tnum" style="font-weight:700;font-size:17px;text-align:right">' + latest.toFixed(dp) + '<span class="xs muted" style="font-weight:400"> ' + unit + '</span></span></div>';
  });
  let wk = [];
  for (let i = 0; i < 10; i++) { const d = addDays(t, -i); ((H(i).wk) || []).forEach((w) => wk.push([d, w])); }
  if (!rows && !wk.length) return '';
  let h = '<div class="card stack">';
  if (rows) h += '<h3 class="h-sm">Heart &amp; fitness</h3><div>' + rows + '</div>';
  if (wk.length) h += '<h3 class="h-sm"' + (rows ? ' style="margin-top:6px"' : '') + '>Recent workouts</h3><div>' + wk.map(([d, w]) => '<div class="row" style="gap:12px;padding:5px 0"><span class="xs muted" style="width:64px">' + fmtShort(d) + '</span><span class="grow small">' + esc(w.n) + '</span><span class="small tnum muted">' + w.min + ' min' + (w.kcal != null ? ' · ' + (w.est ? '~' : '') + w.kcal + ' kcal' : '') + (w.hr ? ' · ' + w.hr + ' bpm' : '') + '</span></div>').join('') + '</div>';
  return h + '</div>';
}
function hkHasLabel(has) {
  const N = { sleep: 'sleep', hrv: 'HRV', rhr: 'resting HR', kcal: 'energy', steps: 'steps', exmin: 'exercise', weight: 'weight', wk: 'workouts', whr: 'walking HR', resp: 'respiratory rate', spo2: 'blood oxygen', vo2: 'VO2 max', hr: 'heart rate' };
  return (has || []).filter((k) => N[k]).map((k) => N[k]).join(', ') || 'no metrics';
}
function hkPasteSheet() {
  return '<h2 class="h-lg">Import Health data</h2><p class="small fg2" style="margin:6px 0 12px">' + (ui.hkMsg ? esc(ui.hkMsg) + ' ' : '') + 'Paste what the Fresh Start Health shortcut copied, or a Health Auto Export JSON.</p>' +
    '<textarea class="field" id="hkText" placeholder="Sleep Analysis|2026-10-17T23:10:00-04:00|…" style="min-height:140px;font-size:13px;font-family:ui-monospace,Menlo,monospace" aria-label="Health data">' + esc(ui.hkText || '') + '</textarea>' +
    '<div class="row" style="gap:10px;margin-top:12px"><button class="btn train grow" data-a="hkImportText">Import</button><label class="btn ghost" style="cursor:pointer">Choose file<input type="file" accept=".txt,.json,.csv,text/plain,application/json" data-in="hkfile" hidden></label></div>';
}

function hkBackSheet() {
  return '<h2 class="h-lg">Bring in your Health data</h2><p class="small fg2" style="margin:6px 0 16px">Fresh Start Health copied your latest numbers.</p>' +
    '<button class="btn train block" data-a="hkPasteNow">Paste Health data</button>' +
    '<button class="btn ghost block" style="margin-top:10px" data-a="hkSync">Run Fresh Start Health again</button>' +
    '<p class="xs muted" style="margin:12px 0 0;text-align:center">iOS will show a Paste button: tap it.</p>';
}

/* ------------------------------------------------------------------ actions */
function hkDone(r) {
  if (!r.n) return false;
  ui.hkMsg = ''; ui.sheet = null; render();
  toast('Apple Health: ' + r.n + (r.n === 1 ? ' day' : ' days') + ' synced');
  return true;
}
/* Sync now: run the Fresh Start Health shortcut; when the app comes back, hkBackSheet asks for the paste */
A.hkSync = () => {
  hkg.awaitPaste = Date.now() + 15 * 60000;
  location.href = HKS_RUN;
};
/* the paste must be read inside this tap (iOS shows its own Paste button) */
A.hkPasteNow = async () => {
  const fail = () => {
    ui.hkMsg = 'The clipboard didn’t hold Health data. If Shortcuts said it was “trying to share … Health items”, turn on Settings → Apps → Shortcuts → Advanced → Allow Sharing Large Amounts of Data, then run Fresh Start Health again.';
    openSheet('hkpaste');
  };
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch (e) { fail(); return; }
  const r = hkImport(text || '');
  if (r.n) { hkg.awaitPaste = 0; ui.hkMsg = ''; ui.sheet = null; render(); toast('Apple Health: ' + r.n + (r.n === 1 ? ' day' : ' days') + ' synced'); return; }
  fail();
};
A.hkCheck = async () => {
  const before = hkg.last;
  const r = await hkGistCheck(true);
  if (!r.n && hkg.last !== before) toast(hkg.state === 'ok' ? 'No new Health data yet' : hkg.state === 'offline' ? 'You’re offline' : 'Couldn’t check: ' + hkg.msg);
};
IN.hkTok = (el) => { ui.hkTok = el.value; };
A.hkConnect = async () => {
  if (ui.hkBusy) return;
  const el = $('#hkTok'), tok = String((el && el.value) || ui.hkTok || '').replace(/\s+/g, '');
  ui.hkTok = tok;
  if (!/^[A-Za-z0-9_]{20,255}$/.test(tok)) { ui.hkErr = 'That doesn’t look like a GitHub token. Copy the whole thing: it starts with ghp_.'; render(); return; }
  ui.hkBusy = true; ui.hkErr = ''; render();
  try {
    let res;
    if (S.settings.hkGist) {
      res = await fetch(HKG_API + '/' + encodeURIComponent(S.settings.hkGist), { headers: hkHeaders(tok), cache: 'no-store' });
      if (!res.ok) throw res.status;
    } else {
      res = await fetch(HKG_API, { method: 'POST', headers: hkHeaders(tok, true), body: JSON.stringify({ description: 'Fresh Start Health', public: false, files: { 'health.txt': { content: HKG_PLACEHOLDER } } }) });
      if (!res.ok) throw res.status;
      const g = await res.json();
      if (!g || !g.id) throw 0;
      S.settings.hkGist = g.id; S.settings.hkGistAt = g.updated_at || new Date().toISOString();
    }
    hkTokSet(tok); ui.hkTok = ''; touch();
    toast(res.status === 201 ? 'Private gist created' : 'Token saved');
  } catch (e) {
    ui.hkErr = e === 401 ? 'GitHub didn’t accept that token. Make a new one and paste it again.'
      : e === 403 || e === 404 || e === 422 ? 'That token can’t write gists. Make a new one with the gist box ticked.'
        : typeof e === 'number' && e ? 'GitHub answered ' + e + '. Try again in a minute.' : 'Couldn’t reach GitHub. Check your connection and try again.';
  } finally { ui.hkBusy = false; render(); }
};
A.hkCopyCode = async () => {
  const code = hkCode(); if (!code) return;
  try { await navigator.clipboard.writeText(code); toast('Setup code copied'); }
  catch (e) { const el = $('#hkCode'); if (el) { el.focus(); el.select(); } toast('Select the code and copy it'); }
};
A.hkGistOff = async (el) => {
  const v = el.dataset.v;
  if (ui.hkOffArm !== v) { ui.hkOffArm = v; render(); setTimeout(() => { if (ui.hkOffArm === v) { ui.hkOffArm = null; render(); } }, 4000); return; }
  ui.hkOffArm = null;
  const id = S.settings.hkGist, tok = hkTok();
  let gone = false;
  if (v === 'delete' && id && tok) {
    try { const r = await fetch(HKG_API + '/' + encodeURIComponent(id), { method: 'DELETE', headers: hkHeaders(tok) }); gone = r.status === 204 || r.status === 404; } catch (e) { gone = false; }
  }
  delete S.settings.hkGist; delete S.settings.hkGistAt;
  if (S.settings.hk) delete S.settings.hk.src;
  hkTokSet(''); hkg.state = ''; hkg.last = 0; hkg.waitUntil = 0;
  touch(); render();
  toast(v === 'delete' ? (gone ? 'Disconnected and gist deleted' : 'Disconnected. Delete the gist on GitHub') : 'Automatic sync turned off');
};
A.hkImportText = () => {
  const el = $('#hkText'), text = el ? el.value : '';
  if (hkDone(hkImport(text))) { ui.hkText = ''; return; }
  ui.hkText = text; ui.hkMsg = 'Nothing in that text looked like Health data.'; render();
};
A.hkGoal = (el) => { S.settings.sleepGoal = clamp(sleepGoal() + +el.dataset.v, 6, 9.5); touch(); render(); };
A.hkClear = () => {
  if (!ui.hkClearArm) { ui.hkClearArm = true; render(); setTimeout(() => { ui.hkClearArm = false; }, 4000); return; }
  ui.hkClearArm = false;
  const now = Date.now();
  Object.keys(S.days).forEach((k) => {
    const d = S.days[k]; if (!d.hk) return;
    delete d.hk;
    if (d.wsrc === 'hk') { delete d.weight; delete d.wsrc; }
    if (d.ssrc === 'hk') { delete d.steps; delete d.ssrc; }
    d.u = now; Cloud.dirty.add('w-' + mondayOf(k));
  });
  delete S.settings.hk; touch(); hkMemo = {}; render(); toast('Health data removed');
};
A.chkClr = (el) => { const dt = chkDate(), d = day(dt); if (d.chk) delete d.chk[el.dataset.k]; touch(dt); render(); };
IN.hkfile = (el) => {
  const f = el.files && el.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { if (!hkDone(hkImport(r.result))) { ui.hkMsg = 'That file didn’t hold Health data.'; render(); } };
  r.readAsText(f);
};

/* ------------------------------------------------------------------ when to check the gist
   On launch (once boot() has loaded the saved state), whenever the app comes back to the foreground
   (forced for a few minutes after "Run sync now"), when the network returns, and every so often while
   it stays open. hkGistCheck throttles itself to one check per 10 minutes otherwise. */
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() < hkg.awaitPaste) openSheet('hkback'); });
window.addEventListener('pageshow', (e) => { if (e.persisted) hkGistCheck(false); });
window.addEventListener('online', () => hkGistCheck(true));
setInterval(() => hkGistCheck(false), 5 * 60000);
if (typeof boot === 'function') {
  const bootBeforeHealth = boot;
  boot = function () { // eslint-disable-line no-global-assign
    const p = bootBeforeHealth.apply(this, arguments);
    Promise.race([p, new Promise((r) => setTimeout(r, 2500))]).then(() => hkGistCheck(true), () => hkGistCheck(true));
    return p;
  };
}
