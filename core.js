/* Core: dates, state, storage + cloud sync, program schedule, gates, progression, sound. */
'use strict';
const D = window.FS, EX = D.EX;

/* ------------------------------------------------------------------ utils */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const pISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (s, n) => { const d = pISO(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((pISO(b) - pISO(a)) / 86400000);
const todayISO = () => iso(new Date());
const dowOf = (s) => (pISO(s).getDay() + 6) % 7; // 0 = Mon
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = (s) => { const d = pISO(s); return DOW[dowOf(s)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };
const fmtShort = (s) => { const d = pISO(s); return MON[d.getMonth()] + ' ' + d.getDate(); };
const mondayOf = (s) => addDays(s, -dowOf(s));
const fmtTime = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + pad2(s); };
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const rnd5 = (v) => Math.round(v / 5) * 5;
const topOf = (reps) => { const m = String(reps || '').match(/(\d+)(?!.*\d)/); return m ? +m[1] : null; };
const lowOf = (reps) => { const m = String(reps || '').match(/(\d+)/); return m ? +m[1] : null; };
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtN = (n) => Math.round(n).toLocaleString('en-US');

/* ------------------------------------------------------------------ state */
const LS_KEY = 'fs2.state.v1';
const blank = () => ({ v: 1, u: 0, settings: { name: 'Nadun', unit: 'lb', kcalAdj: 0, gate: {}, ambient: true, voice: true, sleepGoal: 7.5 }, days: {}, bench: {}, sunday: {}, quiz: [], waist: {}, weeks: {} });
let S = blank();
const ui = { tab: 'today', date: todayISO(), stack: [], sheet: null, trainWeek: null };

/* Two on-device copies: localStorage (written instantly on every change) and an IndexedDB mirror
   (written a moment later and again whenever the app goes to the background). On launch the newer
   copy wins, day by day, so one store being cleared never loses your history. */
let saveError = null;
function lsGet() { try { const t = localStorage.getItem(LS_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
function lsSet() {
  S.savedAt = Date.now();
  let json; try { json = JSON.stringify(S); } catch (e) { return; }
  try { localStorage.setItem(LS_KEY, json); saveError = null; } catch (e) { saveError = (e && e.name) || 'error'; }
  IDBStore.queue(json);
}
const IDBStore = {
  p: null, pending: null, t: null, ok: null,
  open() {
    if (this.p) return this.p;
    this.p = new Promise((res) => {
      try {
        const r = indexedDB.open('fresh-start', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.ok = true; const db = r.result; db.onclose = () => { this.p = null; }; db.onversionchange = () => { try { db.close(); } catch (e) { /* ignore */ } this.p = null; }; res(db); };
        r.onerror = r.onblocked = () => { this.ok = false; res(null); };
      } catch (e) { this.ok = false; res(null); }
    });
    return this.p;
  },
  queue(json) { this.pending = json; clearTimeout(this.t); this.t = setTimeout(() => this.flush(), 300); },
  async flush(retry = true) {
    clearTimeout(this.t);
    const json = this.pending; if (!json) return; this.pending = null;
    const db = await this.open(); if (!db) return;
    try {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(json, 'state');
      tx.onabort = tx.onerror = () => { this.p = null; if (!this.pending) { this.pending = json; clearTimeout(this.t); this.t = setTimeout(() => this.flush(false), 500); } };
    } catch (e) {
      // iOS closes IndexedDB connections while the app is in the background: reopen once and retry
      this.pending = this.pending || json; this.p = null;
      if (retry) return this.flush(false);
    }
  },
  async read() {
    const db = await this.open(); if (!db) return null;
    return new Promise((res) => {
      try {
        const r = db.transaction('kv').objectStore('kv').get('state');
        r.onsuccess = () => { try { res(r.result ? JSON.parse(r.result) : null); } catch (e) { res(null); } };
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  },
};
/* iOS can kill a backgrounded web app without warning, so everything pending is written the moment it goes away */
function flushAll() { IDBStore.flush(); Cloud.flush(); }
window.addEventListener('pagehide', flushAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });
/* merge another copy of the state into S: newer day wins, newer settings win */
function mergeState(o) {
  if (!o || typeof o !== 'object') return false;
  let changed = false;
  Object.keys(o.days || {}).forEach((date) => {
    const r = o.days[date], l = S.days[date];
    if (r && (!l || (r.u || 0) > (l.u || 0))) { S.days[date] = r; changed = true; }
  });
  if (o.weeks && mergeWeeks(o.weeks)) changed = true;
  if ((o.u || 0) > (S.u || 0)) { ['settings', 'bench', 'sunday', 'quiz', 'waist'].forEach((k) => { if (o[k] !== undefined) S[k] = o[k]; }); S.u = o.u; changed = true; }
  return changed;
}

function day(date, create = true) {
  let d = S.days[date];
  if (!d && create) d = S.days[date] = { u: 0 };
  return d || {};
}
function peek(date) { return S.days[date] || {}; }

/* fill in what only the other copy has, keeping every local value (two levels deep: done, sets, swaps, bench…) */
function fillMissing(l, r) {
  let ch = false;
  Object.keys(r || {}).forEach((k) => {
    if (k === 'u') return;
    const a = l[k], b = r[k];
    if (a === undefined) { l[k] = JSON.parse(JSON.stringify(b)); ch = true; }
    else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      Object.keys(b).forEach((kk) => { if (a[kk] === undefined) { a[kk] = JSON.parse(JSON.stringify(b[kk])); ch = true; } });
    }
  });
  return ch;
}

/* mark a day (or meta) changed: saves locally now, syncs to cloud shortly */
function touch(date) {
  const now = Date.now();
  if (date) { day(date).u = now; Cloud.dirty.add('w-' + mondayOf(date)); }
  else { S.u = now; Cloud.dirty.add('meta'); }
  lsSet();
  Cloud.schedule();
}

/* ------------------------------------------------------------------ cloud sync (artifact db, private per viewer) */
const Cloud = {
  db: null, uid: null, ready: false, dirty: new Set(), timer: null, busy: false, again: false, status: 'local', lastPull: 0,
  pulled: false, bootDays: null, bootU: 0, // what this device had before the first pull (see pull)
  async init() {
    try {
      if (!window.claude || !window.claude.use) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      this.db = db; this.uid = id; this.ready = true; this.status = 'syncing';
      await this.pull();
      // push anything only stored locally (first run on this device)
      Object.keys(S.days).forEach((d) => this.dirty.add('w-' + mondayOf(d)));
      this.dirty.add('meta');
      this.schedule(500);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - this.lastPull > 60000) this.pull().then(() => render()); });
    } catch (e) { this.status = 'local'; }
  },
  col() { return this.db.collection('data/users/' + this.uid); },
  async pull() {
    if (!this.ready) return;
    try {
      const snap = await this.col().get();
      let changed = false;
      /* Taps made before the first pull finished (the cloud copy can take a moment on launch, and on some
         hosts it is the only copy that survives a relaunch) must not replace the cloud's day with a partial
         one: for those, the cloud fills in everything the tap didn't touch. */
      const first = !this.pulled;
      snap.docs.forEach((doc) => {
        const body = doc.data() || {};
        if (doc.id === 'meta') {
          if (body.weeks && mergeWeeks(body.weeks)) changed = true;
          if (Object.keys(S.weeks || {}).some((k) => !body.weeks || !body.weeks[k] || (body.weeks[k].at || 0) < S.weeks[k].at)) this.dirty.add('meta'); // snapshots only this device has
          if ((body.u || 0) > (S.u || 0)) { ['settings', 'bench', 'sunday', 'quiz', 'waist'].forEach((k) => { if (body[k] !== undefined) S[k] = body[k]; }); S.u = body.u; changed = true; }
          else if (first && (body.u || 0) > (this.bootU || 0)) {
            ['bench', 'sunday', 'waist'].forEach((k) => { if (body[k]) { const o = {}; o[k] = body[k]; if (fillMissing(S, o)) changed = true; } });
            (body.quiz || []).forEach((q) => { if (!S.quiz.some((x) => x.k === q.k && x.date === q.date && x.score === q.score)) { S.quiz.push(q); changed = true; } });
            if (changed) this.dirty.add('meta');
          }
        } else if (body.days) {
          Object.keys(body.days).forEach((date) => {
            const r = body.days[date], l = S.days[date];
            if (!l || (r.u || 0) > (l.u || 0)) { S.days[date] = JSON.parse(JSON.stringify(r)); changed = true; }
            else if (first && this.bootDays && !this.bootDays.has(date) && fillMissing(l, r)) { changed = true; this.dirty.add('w-' + mondayOf(date)); }
          });
        }
      });
      this.pulled = true;
      this.lastPull = Date.now();
      this.status = 'synced';
      if (changed) lsSet();
    } catch (e) { this.status = 'offline'; }
  },
  schedule(ms = 1200) {
    if (!this.ready) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), ms);
  },
  async flush() {
    if (!this.ready) return;
    if (this.busy) { this.again = true; return; }
    clearTimeout(this.timer);
    this.busy = true; this.again = false;
    let failed = false;
    const keys = Array.from(this.dirty); this.dirty.clear();
    for (const k of keys) {
      try {
        let body;
        if (k === 'meta') body = { u: S.u || Date.now(), settings: S.settings, bench: S.bench, sunday: S.sunday, quiz: S.quiz, waist: S.waist, weeks: S.weeks || {} };
        else {
          const mon = k.slice(2), days = {};
          for (let i = 0; i < 7; i++) { const d = addDays(mon, i); if (S.days[d]) days[d] = S.days[d]; }
          body = { days };
        }
        await this.col().doc(k).set(JSON.parse(JSON.stringify(body)));
        this.status = 'synced';
      } catch (e) {
        this.dirty.add(k); failed = true;
        this.status = (e && e.code === 'quota_exceeded') ? 'full' : 'offline';
      }
    }
    this.busy = false;
    // changes made while this flush was running go out right away; failures retry later
    if (this.dirty.size) this.schedule(failed ? 8000 : this.again || document.hidden ? 0 : 1200);
  },
};

/* ------------------------------------------------------------------ schedule */
function weekOf(date) {
  const n = daysBetween(D.START, date);
  if (n < 0) return 0;
  return Math.floor(n / 7) + 1;
}
function weekStart(w) { return addDays(D.START, (w - 1) * 7); }
function phaseOf(w) {
  if (w <= 0) return { n: 0, name: 'Kickoff' };
  if (w <= 2) return { n: 1, name: 'Reload' };
  if (w <= 6) return { n: 2, name: w === 6 ? 'Pivot' : 'Build & Burn' };
  if (w <= 10) return { n: 3, name: w === 10 ? 'Holiday Express' : 'Shred' };
  if (w <= 12) return { n: 4, name: 'Peak' };
  if (w === 13) return { n: 5, name: 'Taper' };
  return { n: 6, name: 'Sri Lanka' };
}
const FLY_DATE = '2027-01-15';
const BIG_DAYS = { '2026-11-26': 'Thanksgiving', '2026-12-24': 'Christmas Eve', '2026-12-25': 'Christmas', '2026-12-31': "New Year's Eve" };

function liftSrc(w, kind) {
  const P = w <= 2 ? D.P1 : w <= 6 ? D.P2 : D.P3;
  return P[kind];
}
function sess(sid, type, src, more) { return Object.assign({ sid, type, src, title: src.title, dur: src.dur, hero: src.hero }, more || {}); }

/* Everything planned for one date */
function plan(date) {
  const w = weekOf(date), dw = dowOf(date), ph = phaseOf(w);
  const P = { date, week: w, dow: dw, phase: ph, sessions: [], walk: null, sit: null, core: null, ramp: null, notes: [], tests: [], armorWed: false, sunday: dw === 6, travel: false };
  const wkInfo = D.WEEKS[w] || {};
  P.rir = wkInfo.rir || '';
  if (wkInfo.event) P.event = wkInfo.event;
  if (BIG_DAYS[date]) P.notes.push({ tone: 'warn', t: BIG_DAYS[date] + ': train in the morning, protein first, walk 10–15 min after the big meal. Eat at about maintenance (~3,100).' });

  // walks
  const WALK = ['Evening walk 30–45 min', 'Steps only (9–11k)', 'Walk 40–45 min', 'Optional walk 30 min', null, null, 'Long walk 45–60 min, phone-free'];
  P.walk = WALK[dw];

  // main sit
  P.sit = sitFor(w, dw);

  if (w === 0) {
    P.sessions.push({ sid: 'kickoff', type: 'rest', title: 'Kickoff Sunday', sub: 'Rest, long walk and set up the week', dur: '15 min', hero: 'walk' });
    P.notes.push({ tone: 'mind', t: 'Week 1 starts tomorrow. Measure your waist at the navel Monday morning and weigh in daily from now on. The scale may rise 1–3 lb in Week 1; that is glycogen and water.' });
    P.walk = 'Long walk 45–60 min';
    return P;
  }
  if (date >= FLY_DATE) {
    if (date === FLY_DATE) {
      P.travel = true;
      P.sessions.push({ sid: 'fly', type: 'travel', title: 'Fly to Colombo', sub: 'Travel day', dur: '~20 h', hero: 'walk' });
      P.walk = 'Walk the aisle every 1–2 h';
      return P;
    }
    P.phase = { n: 6, name: 'Sri Lanka' };
    P.notes.push({ tone: 'mind', t: 'Never Zero: 2–3 hotel-gym or bodyweight sessions a week, daily Armor, walks, ocean swims on your back or with a snorkel. Keep the MRI swaps until a specialist clears you.' });
    if (dw === 0) P.sessions.push(sess('minA', 'lift', D.MIN.minA));
    if (dw === 3) P.sessions.push(sess('minB', 'lift', D.MIN.minB));
    if (dw === 5) P.sessions.push({ sid: 'oceanswim', type: 'cardio', title: 'Ocean swim', sub: 'On your back or with a snorkel', dur: '20–30 min', hero: 'swim', cardio: { min: 25, text: 'Easy ocean swim: backstroke or a centre snorkel so your head stays still.' } });
    P.walk = 'Walk 30–45 min';
    return P;
  }

  // Week 13 taper
  if (w === 13) {
    if (dw === 0) { P.sessions.push(sess('taperFull', 'lift', D.MIN.taperFull)); P.core = 'A'; P.ramp = 'pull'; }
    if (dw === 1) P.sessions.push({ sid: 'z2taper', type: 'cardio', title: 'Zone 2 + full Armor', sub: 'Taper', dur: '30 min', hero: 'run', cardio: { min: 30, text: 'Zone 2 run 30 min, then full Armor.' } });
    if (dw === 2) { P.sessions.push(sess('taperUpper', 'lift', D.MIN.taperUpper)); P.ramp = 'push'; P.notes.push({ tone: 'train', t: 'Photos today: front, side, back, same light, morning.' }); }
    if (dw === 3) { P.sessions.push({ sid: 'pack', type: 'recovery', title: 'Walk, Armor, pack', sub: 'Taper', dur: '45 min', hero: 'walk' }); P.walk = 'Walk 45 min'; }
    if (dw >= 1 && dw <= 3) P.notes.push({ tone: 'fuel', t: 'Taper food: add about 150 g of carbs today (rice, fruit). Salt and water normal; no water cutting.' });
    return P;
  }

  const holiday = w === 10, pivot = w === 6, peak = w === 11 || w === 12;
  const factor = pivot ? 0.6 : holiday ? 2 / 3 : 1;
  const mods = { factor, pivot, holiday, peak, rir: P.rir };
  const lift = (kind, core) => { const src = liftSrc(w, kind); P.sessions.push(sess('w' + w + '-' + kind, 'lift', src, { kind, mods })); P.core = core; P.ramp = src.ramp; };
  const rugby = () => {
    const r = D.RUGBY[w <= 2 ? 1 : w <= 6 ? 2 : 3];
    P.sessions.push({ sid: 'w' + w + '-rugby', type: 'hiit', title: r.title, sub: r.sub, dur: holiday ? '~40 min' : r.dur, hero: r.hero, src: r, mods });
  };
  const saturday = (optional) => {
    const s = D.SAT[w]; if (!s) return;
    P.sessions.push({ sid: 'w' + w + '-sat', type: 'cardio', title: s.title, sub: optional ? 'Optional' : 'Run or swim', dur: s.min + ' min', hero: 'run', cardio: s, optional: optional || s.optional });
  };

  switch (dw) {
    case 0: lift('pull', 'A'); break;
    case 1: lift('legs', 'B'); break;
    case 2:
      if (pivot) { lift('push', 'C'); P.notes.push({ tone: 'train', t: 'Pivot week: Push moves to Wednesday so Thursday morning is the Turkey Burner.' }); }
      else {
        P.sessions.push({ sid: 'w' + w + '-rec', type: 'recovery', title: 'Recovery', sub: 'Full Armor + walk', dur: '15 min', hero: 'hip_flexor' }); P.armorWed = true;
        if (w >= 3 && w <= 12 && D.MIN && D.MIN.regen) P.sessions.push(sess('w' + w + '-regen', 'lift', D.MIN.regen, { kind: 'regen', mods, optional: holiday }));
      }
      break;
    case 3:
      if (pivot) P.sessions.push({ sid: 'turkey', type: 'hiit', title: D.TURKEY.title, sub: D.TURKEY.sub, dur: D.TURKEY.dur, hero: D.TURKEY.hero, src: D.TURKEY, mods });
      else lift('push', 'C');
      if (date === '2026-12-31') P.notes.push({ tone: 'warn', t: "New Year's Eve: Push this morning, walk this afternoon, then enjoy the night with the drink rules." });
      break;
    case 4:
      if (holiday) { P.sessions.push({ sid: 'xmas', type: 'rest', title: 'Christmas', sub: 'Rugby Day moves to Saturday', dur: '', hero: 'walk' }); P.walk = 'Walk 10–15 min after the big meal'; }
      else rugby();
      break;
    case 5:
      if (holiday) { rugby(); P.notes.push({ tone: 'train', t: 'Holiday Express: Rugby Day moved here from Christmas Day.' }); }
      else saturday();
      break;
    case 6:
      P.sessions.push({ sid: 'sunday', type: 'rest', title: 'Rest + Sunday Reset', sub: 'Long walk and the weekly check', dur: '15 min', hero: 'walk' });
      if (holiday) saturday(true);
      break;
  }
  if (holiday && P.sessions.some((s) => s.type === 'lift')) P.notes.push({ tone: 'train', t: 'Holiday Express: ⅔ of the sets, same loads and effort, finishers optional, about 40 min.' });
  if (pivot && P.sessions.some((s) => s.type === 'lift')) P.notes.push({ tone: 'train', t: 'Pivot deload: same loads, about 60% of the sets, stop at RIR 3.' });
  if (peak && P.sessions.some((s) => s.type === 'lift' && (s.kind === 'pull' || s.kind === 'push'))) P.notes.push({ tone: 'train', t: 'Peak: last set of every isolation exercise is a drop set or myo-reps, plus the 8-min pump finisher.' });
  const hasLift = P.sessions.some((s) => s.type === 'lift' || s.type === 'hiit'), chk0 = peek(date).chk;
  if (hasLift && chk0 && (chk0.neck >= 3 || chk0.arm)) P.notes.push({ tone: 'warn', t: 'High-neck day: carries, hanging ab work and pull-ups are swapped for neck-friendly versions; barbell bench becomes DBs. Arm tingling during a set stops that exercise.' });
  if (hasLift && chk0 && chk0.back >= 4) P.notes.push({ tone: 'warn', t: 'High-back day: one set fewer, reverse hyper becomes a glute bridge, finisher optional.' });
  if (w === 2 && dw === 5) P.notes.push({ tone: 'warn', t: 'Halloween tonight. Weekend drink rules apply.' });

  // tests and benchmarks
  if (w === 1 && dw === 0) P.tests.push('pullups', 'waist');
  if (w === 1 && dw === 3) P.tests.push('pushups');
  if (w === 1 && dw === 6) P.tests.push('sideL', 'sideR', 'extensor', 'flexor', 'hlr', 'abwheel', 'vacuumMax', 'neckback');
  if (w === 2 && dw === 5) P.tests.push('mile');
  if (w === 3 && dw === 1) P.tests.push('trapbar5');
  if (w === 6 && dw === 5) P.tests.push('pullups', 'pushups', 'mile', 'trapbar5', 'sideL', 'sideR', 'extensor', 'flexor', 'hlr', 'abwheel', 'vacuumMax', 'neckback');
  if (w === 7 && dw === 4) P.tests.push('gauntlet');
  if (w === 12) { const T = [['pullups'], ['trapbar5'], [], ['pushups'], ['gauntlet'], ['mile'], ['waist', 'neckback', 'sideL', 'sideR', 'extensor', 'flexor', 'hlr', 'abwheel', 'vacuumMax']]; P.tests.push(...T[dw]); }
  if (dw === 6 && w >= 1) P.tests.push('waist');
  P.tests = Array.from(new Set(P.tests));
  return P;
}

function sitFor(w, dw) {
  if (w <= 0 || w > 13) return 'breath10';
  if (w <= 2) return 'breath10';
  if (w <= 4) return 'scan12';
  if (w <= 8) return dw === 6 ? 'metta15' : [0, 2, 4].includes(dw) ? 'open15' : 'scan15';
  return dw === 6 ? 'sit30' : 'open20';
}
function benchCol(w) { return w <= 2 ? 'base' : w <= 8 ? 'w6' : 'w12'; }
function mainSession(P) { return P.sessions.find((s) => s.type === 'lift') || P.sessions.find((s) => s.type !== 'rest') || P.sessions[0] || null; }
function isTraining(s) { return s && ['lift', 'hiit', 'cardio'].includes(s.type) && !s.optional; }

/* ------------------------------------------------------------------ readiness + gates */
/* The plan's check-in rules decide the colour. Sleep comes from Apple Health when it's there (a hand
   entry overrides it), and Health's recovery tier can only make the day stricter (health.js). */
function sleepFor(date) {
  const c = peek(date).chk || {};
  if (c.sleep != null) return c.sleep;
  return typeof sleepH === 'function' ? sleepH(date) : null;
}
function readiness(date) {
  const c = peek(date).chk, sl = sleepFor(date);
  if (!c || sl == null || c.neck == null) return null;
  let r = 'green';
  if (sl < 5 || c.neck >= 5 || c.arm || c.sick) r = 'red';
  else if (sl < 7 || c.neck >= 3 || c.sore) r = 'yellow';
  if (c.back != null) { if (c.back >= 6) r = 'red'; else if (c.back >= 4 && r === 'green') r = 'yellow'; }
  const t = typeof recovery === 'function' ? recovery(date).tier : null;
  if (t === 'red') r = 'red';
  else if (t === 'yellow' && r === 'green') r = 'yellow';
  return r;
}
const READY_TXT = {
  green: ['Green', 'Full session.'],
  yellow: ['Yellow', 'One set fewer per exercise, skip the finisher.'],
  red: ['Red', 'Armor + walk, or the 30-minute Minimum session.'],
};
function streak(date, test) {
  let n = 0, d = date;
  if (!peek(d).chk || peek(d).chk.neck == null) d = addDays(d, -1);
  for (let i = 0; i < 120; i++) {
    const c = peek(d).chk;
    if (!c || !test(c)) break;
    n++; d = addDays(d, -1);
  }
  return n;
}
function gateOpen(id, date) {
  const ov = S.settings.gate && S.settings.gate[id];
  if (ov === 'open') return true;
  if (ov === 'closed') return false;
  const w = weekOf(date);
  const neckQ = () => streak(date, (c) => c.neck <= 1 && !c.arm);
  const back0 = () => streak(date, (c) => c.back === 0);
  switch (id) {
    case 'ohp': return w >= 5 && neckQ() >= 7;
    case 'ohp_seated': return w >= 7 && neckQ() >= 21;
    case 'trapbar': return w >= 3 && back0() >= 7;
    case 'pendlay': return w >= 7 && back0() >= 21;
    case 'rotation': return w >= 7 && back0() >= 1;
    case 'backgate': return back0() >= 21;
    case 'abwheel': return back0() >= 7;
  }
  return true;
}
function gateStatus(g, date) {
  const w = weekOf(date), ov = S.settings.gate[g.id];
  if (ov) return ov === 'open' ? 'open' : 'closed';
  if (w < g.from) return 'later';
  return gateOpen(g.id, date) ? 'open' : 'closed';
}

/* resolve an exercise through gates, week swaps and manual swaps */
function dayEx(ex, date) {
  let gated = null; const chk = peek(date).chk;
  for (let i = 0; i < 4; i++) {
    const d = EX[ex]; if (!d) break;
    if (d.gate && !gateOpen(d.gate, date)) { gated = gated || { from: ex, gate: d.gate }; ex = d.alt; }
    else if (d.neckAlt && chk && (chk.neck > (d.neckMax ?? 2) || chk.arm)) { gated = gated || { from: ex, day: 'neck' }; ex = d.neckAlt; }
    else if (d.backAlt && chk && chk.back != null && chk.back > (d.backMax ?? 2)) { gated = gated || { from: ex, day: 'back' }; ex = d.backAlt; }
    else break;
  }
  return { ex, gated };
}
function resolveEx(item, date, week) {
  let ex = item.ex;
  if (item.fromWeek) { Object.keys(item.fromWeek).forEach((wk) => { if (week >= +wk) ex = item.fromWeek[wk]; }); }
  return dayEx(ex, date);
}

/* items for a lift session after week modifiers, readiness and swaps */
function sessionItems(s, date) {
  const P = plan(date), w = P.week, r = readiness(date), dd = peek(date);
  const mods = s.mods || {};
  let items = s.src.items.map((it) => Object.assign({}, it));
  if (mods.peak && (s.kind === 'pull' || s.kind === 'push')) items = items.concat(D.PUMP[s.kind].map((it) => Object.assign({ pump: true }, it)));
  if (typeof dayTier === 'function' && dayTier(date) === 'push' && !mods.peak && (s.kind === 'pull' || s.kind === 'push') && D.PUMP && D.PUMP[s.kind]) items = items.concat(D.PUMP[s.kind].map((it) => Object.assign({ pump: true, beast: true, optional: true }, it)));
  const lifty = s.kind === 'pull' || s.kind === 'legs' || s.kind === 'push';
  return items.map((it) => {
    const res = resolveEx(it, date, w);
    const swap = dd.swaps && dd.swaps[it.k];
    const ex = swap || res.ex;
    let sets = it.sets;
    if (mods.factor && mods.factor < 1 && !it.kind) sets = Math.max(1, Math.round(sets * mods.factor));
    if (r === 'yellow' && !it.kind && sets > 1) sets -= 1;
    const optional = it.optional || (it.kind && (r === 'yellow' || mods.holiday)) || (it.pump && r === 'yellow');
    const neckSkip = it.neckSkip != null && dd.chk && dd.chk.neck > it.neckSkip;
    const isoTech = mods.peak && !it.scheme && !it.kind && /curl|fly|raise|pushdown|extension|lateral|calf|leg_ext|leg_curl/.test(ex);
    const iso = /curl|fly|raise|pushdown|extension|lateral|calf|leg_ext|leg_curl|xbody|leanaway|pulldown|face_pull/.test(ex);
    let tech = it.tech || (isoTech ? 'Peak: drop set or myo-reps on the last set' : '');
    if (!tech && lifty && w >= 3 && w <= 12 && !mods.pivot && !mods.holiday && !it.scheme && !it.kind && iso) tech = 'Last set to failure';
    if (lifty && w >= 7 && w <= 12 && !it.kind && !it.pump && !it.time && !it.dist && !/nordic|ez_21s/.test(ex)) { const lw = it.scheme === 'top' ? '3-s lowering on back-offs' : '3-s lowering'; tech = tech ? tech + ' · ' + lw : lw; }
    const skipped = !!(dd.skip && dd.skip[ex]);
    return Object.assign({}, it, { ex, baseEx: it.ex, gated: swap ? null : res.gated, swapped: !!swap, sets, optional, neckSkip, skipped,
      tech });
  });
}
function groupItems(items) {
  const groups = [];
  items.forEach((it) => {
    const letter = it.k.replace(/\d+$/, '');
    const g = groups[groups.length - 1];
    if (g && g.letter === letter && /\d$/.test(it.k)) g.items.push(it);
    else groups.push({ letter, items: [it] });
  });
  return groups;
}

/* ------------------------------------------------------------------ logging helpers */
const setKey = (sid, it) => sid + '|' + it.k + '|' + it.ex;
function setsFor(date, sid, it) { const d = peek(date); return (d.sets && d.sets[setKey(sid, it)]) || []; }
function lastN(ex, beforeDate, n) {
  const dates = Object.keys(S.days).filter((d) => d < beforeDate).sort().reverse(), out = [];
  for (const d of dates) {
    const sets = S.days[d].sets; if (!sets) continue;
    for (const k of Object.keys(sets)) {
      if (k.split('|')[2] === ex && sets[k].some((x) => x && x.done)) { out.push({ date: d, sets: sets[k].filter((x) => x && x.done) }); break; }
    }
    if (out.length >= n) break;
  }
  return out;
}
function lastSets(ex, beforeDate) { return lastN(ex, beforeDate, 1)[0] || null; }
function suggest(it, date) {
  const prev = lastN(it.ex, date, 2), last = prev[0];
  if (!last) return null;
  const def = EX[it.ex] || {};
  const inc = def.lower ? 10 : 5;
  const ws = last.sets.map((x) => num(x.w)).filter((x) => x != null);
  if (!ws.length) return { last, w: null, msg: '' };
  const top = Math.max.apply(null, ws);
  let w = top, msg = 'Same weight as last time', add = false;
  if (it.scheme === 'top') {
    const ts = last.sets[0], tr = topOf(it.topReps);
    if (ts && tr && +ts.r >= tr) { w = top + inc; add = true; msg = 'Hit ' + ts.r + ' on the top set: add ' + inc + ' lb'; }
    else if (tr && prev.length > 1 && prev.every((p) => p.sets[0] && +p.sets[0].r < tr)) { const tw = num(last.sets[0].w); w = tw != null ? tw : top; msg = 'Missed the range twice: same load, add 1 s to the lowering (or 1 rep)'; }
  } else {
    const tr = topOf(it.reps);
    if (tr && last.sets.length >= Math.min(2, it.sets) && last.sets.every((x) => +x.r >= tr)) { w = top + inc; add = true; msg = 'Top of the range on every set: add ' + inc + ' lb'; }
  }
  const ck = peek(date).chk;
  if (add && def.capped && ck && ck.neck > 1) { w = top; msg = 'Range hit, but the neck isn’t at 0–1 today: add a 2-s pause or 1½ reps before adding load'; }
  const gap = daysBetween(last.date, date);
  if (gap > 7) { w = rnd5(w * 0.9); msg = 'Back after ' + gap + ' days off: last loads minus 10%'; }
  return { last, w, msg };
}
function sessionDone(date, sid) { const d = peek(date); return !!(d.done && d.done['s:' + sid]); }
function setDone(date, key, val = true) { const d = day(date); d.done = d.done || {}; if (val) d.done[key] = Date.now(); else delete d.done[key]; touch(date); }
function isDone(date, key) { const d = peek(date); return !!(d.done && d.done[key]); }

/* Never Zero: two scheduled sessions missed in a row before this date */
function missedTwice(date) {
  let misses = 0, d = addDays(date, -1);
  for (let i = 0; i < 10 && d >= D.START; i++) {
    const s = plan(d).sessions.filter(isTraining);
    if (s.length) {
      const done = s.some((x) => sessionDone(d, x.sid)) || isDone(d, 's:min');
      if (done) return false;
      misses++;
      if (misses >= 2) return true;
    }
    d = addDays(d, -1);
  }
  return false;
}
function lastTrainedGap(date) {
  const dates = Object.keys(S.days).filter((d) => d < date && S.days[d].done && Object.keys(S.days[d].done).some((k) => k.startsWith('s:'))).sort();
  if (!dates.length) return null;
  return daysBetween(dates[dates.length - 1], date);
}

/* ------------------------------------------------------------------ nutrition */
function targets(date) {
  const dw = dowOf(date);
  let kcal = dw <= 3 ? 2350 : 2700, label = dw <= 3 ? 'Mon–Thu target' : 'Fri–Sun target';
  if (BIG_DAYS[date]) { kcal = 3100; label = BIG_DAYS[date] + ' · maintenance'; }
  if (date >= '2027-01-12' && date <= '2027-01-14') { kcal += 600; label = 'Taper · +150 g carbs'; }
  kcal += S.settings.kcalAdj || 0;
  const weekend = dw >= 4;
  return { kcal, label, p: D.PROTEIN ? (weekOf(date) >= D.PROTEIN.lateFrom ? D.PROTEIN.late : D.PROTEIN.early) : [200, 220], fat: weekend ? [70, 90] : [60, 70], carbs: weekend ? null : [220, 250], water: 4 };
}
function foodById(id) { return D.FOODS.find((f) => f.id === id); }
function mealsFor(date) { return peek(date).meals || []; }
function totals(date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  mealsFor(date).forEach((m) => { const q = m.q || 1; t.kcal += m.kcal * q; t.p += m.p * q; t.c += (m.c || 0) * q; t.f += (m.f || 0) * q; });
  const dr = peek(date).drinks || {};
  D.DRINKS.forEach((x) => { t.kcal += (dr[x.id] || 0) * x.kcal; });
  return t;
}
function plannedFood(date, slot) {
  const d = peek(date);
  if (d.plan && d.plan[slot]) return foodById(d.plan[slot]);
  const P = plan(date), s = mainSession(P);
  const train = s && ['lift', 'hiit', 'cardio'].includes(s.type);
  const liftDay = s && s.type === 'lift';
  switch (slot) {
    case 'pre': return train ? foodById('pre_banana') : null;
    case 'breakfast': return foodById(liftDay ? 'bfast_fruit' : 'bfast');
    case 'post': return foodById('shake');
    case 'lunch': return foodById('lunch_sl');
    case 'dinner': return BIG_DAYS[date] ? foodById('holiday_plate') : foodById(train ? 'dinner_chicken' : 'dinner_rest');
    case 'snack': return foodById(train ? 'snack_corepower' : 'snack_cottage');
  }
  return null;
}
function freeMealsThisWeek(date) {
  const mon = mondayOf(date); let n = 0;
  for (let i = 0; i < 7; i++) n += mealsFor(addDays(mon, i)).filter((m) => m.free).length;
  return n;
}

function drinksThisWeek(date) {
  const mon = mondayOf(date); let n = 0;
  for (let i = 0; i < 7; i++) { const dr = peek(addDays(mon, i)).drinks || {}; D.DRINKS.forEach((x) => { n += dr[x.id] || 0; }); }
  return n;
}
function drinkBudget(date) { const b = D.DRINK_BUDGET; return b ? (b.holidayWeeks.includes(weekOf(date)) ? b.holiday : b.normal) : 6; }
function freeMealCap(date) { const f = D.FREE_MEALS; return f ? (f.peakWeeks.includes(weekOf(date)) ? f.peak : f.normal) : 2; }

/* ------------------------------------------------------------------ weight */
function weights() { return Object.keys(S.days).filter((d) => num(S.days[d].weight) != null).sort().map((d) => ({ d, w: num(S.days[d].weight) })); }
function avg7(date) {
  const xs = []; for (let i = 0; i < 7; i++) { const w = num(peek(addDays(date, -i)).weight); if (w != null) xs.push(w); }
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
/* ------------------------------------------------------------------ weekly summary
   One summary per plan week (Mon–Sun). Computed from S.days, so the live week is always fresh; once a week
   has ended it is also frozen into S.weeks[w] (saved and synced with the meta doc, newest snapshot wins)
   and used as the fallback if that week's day data is ever missing. */
const WEEK_N = 13;
/* [key, name, unit ('wt' = weight unit), good direction (+1 higher / -1 lower / 0 neutral), decimals, colour] */
const WK_MET = [
  ['weight', 'Weight', 'wt', -1, 1, 'var(--train)'], ['sess', 'Sessions', '', 1, 0, 'var(--train)'],
  ['wkN', 'Health workouts', '', 1, 0, 'var(--train)'], ['wkMin', 'Workout time (elapsed)', ' min', 1, 0, 'var(--train)'],
  ['exmin', 'Exercise / day', ' min', 1, 0, 'var(--train)'], ['kcalAct', 'Active energy / day', ' kcal', 1, 0, 'var(--fuel)'],
  ['steps', 'Steps / day', '', 1, 0, 'var(--train)'], ['sleep', 'Sleep / night', ' h', 1, 1, 'var(--mind)'],
  ['hrv', 'HRV', ' ms', 1, 0, 'var(--mind)'], ['rhr', 'Resting HR', ' bpm', -1, 0, 'var(--fuel)'],
  ['whr', 'Walking HR', ' bpm', -1, 0, 'var(--fuel)'], ['vo2', 'VO2 max', '', 1, 1, 'var(--good)'],
  ['resp', 'Breathing rate', ' /min', -1, 1, 'var(--mind)'], ['spo2', 'Blood oxygen', '%', 1, 0, 'var(--mind)'],
  ['rec', 'Recovery score', '', 1, 0, 'var(--good)'], ['kcal', 'Calories / day', ' kcal', 0, 0, 'var(--fuel)'],
  ['adh', 'Calories on target', '%', 1, 0, 'var(--fuel)'], ['prot', 'Protein / day', ' g', 1, 0, 'var(--fuel)'],
  ['protDays', 'Protein days hit', '', 1, 0, 'var(--fuel)'], ['aiScore', 'Food score', '/10', 1, 1, 'var(--fuel)'],
  ['neck', 'Neck pain', '/10', -1, 1, 'var(--bad)'], ['back', 'Low back pain', '/10', -1, 1, 'var(--warn)'],
  ['stress', 'Stress', '/10', -1, 1, 'var(--mind)'], ['mind', 'Mind minutes', ' min', 1, 0, 'var(--mind)'],
];
function weekCompute(w) {
  const ws = weekStart(w), we = addDays(ws, 6), t = todayISO(), last = we < t ? we : t;
  const acc = {}, put = (k, v) => { if (v != null && isFinite(v)) (acc[k] = acc[k] || []).push(v); };
  const mean = (k) => (acc[k] && acc[k].length ? acc[k].reduce((a, b) => a + b, 0) / acc[k].length : null);
  let sess = 0, sessT = 0, days = 0, wkN = 0, wkMin = 0, mind = 0, protDays = 0, adhOk = 0, kd = 0, vo2 = null, hasMind = false;
  for (let i = 0; i < 7; i++) {
    const dd = addDays(ws, i), d = peek(dd), h = hkOf(dd) || {};
    plan(dd).sessions.filter(isTraining).forEach((s) => { sessT++; if (dd <= t && sessionDone(dd, s.sid)) sess++; });
    if (dd > last) continue;
    if (Object.keys(d).length > 1) days++;
    const tot = totals(dd), tg = targets(dd);
    if (tot.kcal > 0) { kd++; put('kcal', tot.kcal); if (Math.abs(tot.kcal - tg.kcal) <= tg.kcal * 0.1) adhOk++; if (tot.p > 0) put('prot', tot.p); if (tot.p >= tg.p[0]) protDays++; }
    const sc = (d.meals || []).map((m) => m.ai && m.ai.score).filter((x) => x != null); if (sc.length) put('aiScore', sc.reduce((a, b) => a + b, 0) / sc.length);
    ['steps', 'exmin', 'hrv', 'rhr', 'whr', 'resp', 'spo2'].forEach((k) => put(k, h[k]));
    put('kcalAct', h.kcal); put('sleep', sleepH(dd)); if (h.vo2 != null) vo2 = h.vo2;
    (h.wk || []).forEach((x) => { wkN++; wkMin += hkWk(x).span || 0; }); // elapsed minutes (start to end), the one basis every workout has
    if (hkOf(dd) && (sleepH(dd) != null || h.hrv != null)) put('rec', recovery(dd).score);
    const ch = d.chk || {}; ['neck', 'back', 'stress'].forEach((k) => put(k, ch[k]));
    (d.mind || []).forEach((x) => { mind += x.min || 0; hasMind = true; });
  }
  const m = { weight: avg7(last), sess: sessT ? sess : null, wkN: wkN || null, wkMin: wkMin || null, vo2, mind: hasMind ? Math.round(mind) : null, adh: kd ? Math.round(adhOk / kd * 100) : null, protDays: kd ? protDays : null };
  ['exmin', 'kcalAct', 'steps', 'sleep', 'hrv', 'rhr', 'whr', 'resp', 'spo2', 'rec', 'kcal', 'prot', 'aiScore', 'neck', 'back', 'stress'].forEach((k) => { m[k] = mean(k); });
  if (m.sess === 0 && days === 0) m.sess = null;
  return { w, from: ws, to: we, days, kd, sessT, m };
}
const wkCache = { key: '', v: {} };
function weekSummary(w) {
  const key = (S.savedAt || 0) + '|' + todayISO();
  if (wkCache.key !== key) { wkCache.key = key; wkCache.v = {}; }
  if (wkCache.v[w]) return wkCache.v[w];
  let r = weekCompute(w);
  const snap = (S.weeks || {})[w];
  if (snap && r.days === 0 && r.m.weight == null) r = Object.assign({}, snap, { snap: true });
  return (wkCache.v[w] = r);
}
function mergeWeeks(o) {
  S.weeks = S.weeks || {}; let ch = false;
  Object.keys(o || {}).forEach((k) => { if (o[k] && (!S.weeks[k] || (o[k].at || 0) > (S.weeks[k].at || 0))) { S.weeks[k] = o[k]; ch = true; } });
  return ch;
}
/* freeze every finished week; refresh a snapshot when a late edit changed it */
let freezeKey = '';
function freezeWeeks() {
  const key = (S.savedAt || 0) + '|' + todayISO(); if (key === freezeKey) return;
  S.weeks = S.weeks || {}; const t = todayISO(); let ch = false;
  for (let w = 1; w <= WEEK_N; w++) {
    if (addDays(weekStart(w), 6) >= t) break;
    const r = weekCompute(w); if (r.days === 0 && r.m.weight == null) continue;
    const old = S.weeks[w];
    if (!old || JSON.stringify(old.m) !== JSON.stringify(r.m)) { S.weeks[w] = { w, from: r.from, to: r.to, days: r.days, kd: r.kd, sessT: r.sessT, m: r.m, at: Date.now() }; ch = true; }
  }
  if (ch) { Cloud.dirty.add('meta'); lsSet(); Cloud.schedule(); }
  freezeKey = (S.savedAt || 0) + '|' + t;
}
function targetAt(date) {
  const T = D.TARGET_PATH;
  if (date <= T[0][0]) return { t: T[0][1], lo: T[0][2], hi: T[0][3] };
  for (let i = 1; i < T.length; i++) {
    if (date <= T[i][0]) {
      const a = T[i - 1], b = T[i], f = daysBetween(a[0], date) / daysBetween(a[0], b[0]);
      return { t: a[1] + (b[1] - a[1]) * f, lo: a[2] + (b[2] - a[2]) * f, hi: a[3] + (b[3] - a[3]) * f };
    }
  }
  const L = T[T.length - 1]; return { t: L[1], lo: L[2], hi: L[3] };
}
function calibration(date) {
  const sun = addDays(mondayOf(date), 6 > dowOf(date) ? -1 : 6);
  const a1 = avg7(sun), a0 = avg7(addDays(sun, -7)), am1 = avg7(addDays(sun, -14));
  if (a1 == null || a0 == null) return { sun, rate: null };
  const rate = a0 - a1, prev = am1 != null ? am1 - a0 : null;
  const w = weekOf(sun);
  const ignore = w <= 1 || ['2026-11-29', '2026-12-27', '2027-01-03'].includes(sun);
  let rec = 'Losing 0.8–1.4 lb a week: change nothing.', act = 0, tone = 'good';
  if (ignore) { rec = 'Ignore this week: Week 1 and the weeks after Thanksgiving and Christmas are water.'; tone = 'mind'; }
  else if (rate < 0.7 && prev != null && prev < 0.7) { rec = 'Under 0.7 lb a week for 2 weeks: cut 150 kcal a day (from carbs or fat, never protein) or add 2,000 steps a day.'; act = -150; tone = 'warn'; }
  else if (rate > 1.8 && prev != null && prev > 1.8) { rec = 'Over 1.8 lb a week for 2 weeks: add 150 kcal a day of carbs. Losing faster costs muscle.'; act = 150; tone = 'warn'; }
  else if (rate < 0.7 || rate > 1.8) { rec = 'Outside 0.8–1.4 lb this week. One week is noise; act if it repeats next Sunday.'; tone = 'mind'; }
  return { sun, rate, prev, a1, a0, rec, act, tone };
}

/* ------------------------------------------------------------------ sound + voice */
const Sound = {
  ctx: null,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  beep(freq = 880, dur = 0.12, vol = 0.25) {
    const c = this.ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
  },
  go() { this.beep(1320, 0.28, 0.3); },
  tick() { this.beep(880, 0.1, 0.22); },
  done() { this.beep(660, 0.12, 0.25); setTimeout(() => this.beep(990, 0.22, 0.25), 140); },
  bell() {
    const c = this.ensure(); if (!c) return;
    [432, 868, 1192, 2333].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(0.18 / (i + 1), c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 4 - i * 0.6);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 4.2);
    });
  },
  say(text) {
    if (!S.settings.voice || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; u.pitch = 1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* no voice */ }
  },
  /* soft ocean bed for meditations: filtered noise with slow swells */
  ocean: null,
  oceanOn() {
    const c = this.ensure(); if (!c || this.ocean) return;
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.5; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = c.createGain(); g.gain.value = 0.0;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.05; lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(c.destination); src.start(); lfo.start();
    g.gain.linearRampToValueAtTime(0.08, c.currentTime + 3);
    this.ocean = { src, lfo, g };
  },
  oceanOff() {
    if (!this.ocean) return; const c = this.ctx, o = this.ocean; this.ocean = null;
    try { o.g.gain.cancelScheduledValues(c.currentTime); o.g.gain.setValueAtTime(o.g.gain.value, c.currentTime); o.g.gain.linearRampToValueAtTime(0, c.currentTime + 1); setTimeout(() => { o.src.stop(); o.lfo.stop(); }, 1100); } catch (e) { /* already stopped */ }
  },
};
const Wake = {
  lock: null,
  async on() { try { if ('wakeLock' in navigator && !this.lock) { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); } } catch (e) { /* refused */ } },
  off() { try { this.lock && this.lock.release(); } catch (e) { /* ignore */ } this.lock = null; },
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && (ui.stack.some((l) => l.v === 'player' || l.v === 'timer' || l.v === 'routine'))) Wake.on(); });

/* ------------------------------------------------------------------ icons */
const IC = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>',
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16a8 8 0 0 1-16 0Z"/><path d="M9 4c0 2 2 2 2 4M13 4c0 2 2 2 2 4"/></svg>',
  mind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M7.5 13.5c1.5 1.8 7.5 1.8 9 0"/><path d="M12 3.5v3"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6l6 6-6 6"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4L4 7l3 3M4 7h12M17 20l3-3-3-3M20 17H8"/></svg>',
  pain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19Z"/><path d="M12 10v4M12 17v.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6Z"/></svg>',
  core: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="4" width="10" height="16" rx="4"/><path d="M7 9.5h10M7 14.5h10M12 4v16"/></svg>',
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2.5-6 2.5 2.5V21M8 12l2.5-4.5 3 1.5 2 3 2.5 1"/><path d="M12.5 15l-1-6"/></svg>',
  egg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c3.5 0 6.5 6 6.5 10a6.5 6.5 0 0 1-13 0C5.5 9 8.5 3 12 3Z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/></svg>',
  desk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="4" width="17" height="11" rx="2"/><path d="M8 20h8M12 15v5"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.4-9.2-9.3C1.7 7.9 3.9 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.7 1.2-1.6 2.7-2.7 4.7-2.7 3.4 0 5.6 3.4 4.5 6.7-1.7 4.9-9.2 9.3-9.2 9.3Z"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
};
const ic = (n) => IC[n] || '';

/* ------------------------------------------------------------------ toast */
let toastT = null;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2200);
}

