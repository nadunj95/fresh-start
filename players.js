/* Players: the in-gym workout player, guided routines, interval timers, meditation audio, completion and quizzes. */
'use strict';

const PA = window.PA = {};   // player actions
const PIN = window.PIN = {}; // player inputs
const TICKS = {};

const Ticker = {
  id: null,
  start() { if (!this.id) this.id = setInterval(tickAll, 200); },
  stop() { clearInterval(this.id); this.id = null; },
};
function tickAll() {
  const l = ui.stack[ui.stack.length - 1];
  if (!l || !TICKS[l.v]) { if (!MP.audio || MP.audio.paused) Ticker.stop(); return; }
  TICKS[l.v](l.p, l);
}
function playerAfterRender() {
  const l = ui.stack[ui.stack.length - 1];
  if (l && TICKS[l.v]) { Ticker.start(); if (l.v !== 'mplayer') Wake.on(); TICKS[l.v](l.p, l); }
  else if (!ui.stack.some((x) => ['player', 'routine', 'timer', 'mplayer'].includes(x.v))) Wake.off();
}
function topL() { return ui.stack[ui.stack.length - 1]; }
function setText(id, t) { const el = document.getElementById(id); if (el && el.textContent !== t) el.textContent = t; }

/* ================================================================== LIFT PLAYER */
function liftSteps(date, sid) {
  const s = findSession(date, sid);
  const items = sessionItems(s, date).filter((it) => !it.neckSkip && !it.skipped);
  const groups = groupItems(items), steps = [];
  groups.forEach((g, gi) => {
    if (g.items.length === 1 && g.items[0].kind) { steps.push({ it: g.items[0], gi, set: 0, special: true, rest: 0 }); return; }
    const rounds = Math.max.apply(null, g.items.map((i) => i.sets)), lastIt = g.items[g.items.length - 1];
    for (let r = 0; r < rounds; r++) g.items.forEach((it, j) => { if (r < it.sets) steps.push({ it, gi, set: r, group: g, rest: j === g.items.length - 1 ? (lastIt.rest || 0) : 0 }); });
  });
  return { s, items, groups, steps };
}
function stepLogged(date, sid, st) {
  if (st.special) return isDone(date, 'x:' + sid + ':' + st.it.k);
  const z = setsFor(date, sid, st.it)[st.set]; return !!(z && z.done);
}
function openLift(date, sid) {
  const L = liftSteps(date, sid);
  let idx = L.steps.findIndex((st) => !stepLogged(date, sid, st)); if (idx < 0) idx = 0;
  push('player', { date, sid, idx, start: Date.now(), rest: null, timed: null, draft: null });
}
A.startLift = (el) => {
  const date = topDate();
  // the readiness check sets today's volume; its sheet then starts the workout itself
  if (!readiness(date)) { openSheet('ready', { date, go: el.dataset.v }); return; }
  openLift(date, el.dataset.v);
};
A.readyGo = () => {
  const p = (ui.sheet && ui.sheet.p) || {}, date = p.date || topDate();
  if (!readiness(date)) { toast('Sleep and neck first'); return; }
  ui.sheet = null;
  if (p.go) openLift(date, p.go); else render();
};

function lPlayer(p) {
  const L = liftSteps(p.date, p.sid);
  if (!L.steps.length) return '<div class="player"><div class="pw pad"><div class="pbar"><button class="icon-btn" data-a="pop">' + ic('close') + '</button></div><div class="empty">Nothing to log today.</div></div></div>';
  p.idx = clamp(p.idx, 0, L.steps.length - 1);
  const st = L.steps[p.idx], it = st.it, e = EX[it.ex] || {};
  const logged = setsFor(p.date, p.sid, it), cur = logged[st.set];
  if (!p.draft || p.draft.idx !== p.idx) {
    const prevToday = logged.slice(0, st.set).filter((x) => x && x.done).slice(-1)[0], sg = suggest(it, p.date);
    let w = cur && cur.w != null ? cur.w : prevToday ? prevToday.w : sg && sg.w != null ? sg.w : '';
    if (it.scheme === 'top' && st.set > 0 && !cur && logged[0] && logged[0].w) w = rnd5(num(logged[0].w) * (1 - it.backPct / 100));
    const rr = it.scheme === 'top' && st.set === 0 ? topOf(it.topReps) : topOf(it.reps);
    p.draft = { idx: p.idx, w: w === '' ? '' : String(w), r: cur && cur.r != null ? String(cur.r) : (it.amrap ? '' : rr != null ? String(rr) : '') };
  }
  const sg = suggest(it, p.date);
  // segments: one per group
  const segs = L.groups.map((g, gi) => {
    const gsteps = L.steps.filter((x) => x.gi === gi), done = gsteps.every((x) => stepLogged(p.date, p.sid, x));
    return '<i class="' + (gi === st.gi ? 'c' : done ? 'd' : '') + '"></i>';
  }).join('');
  const g = L.groups[st.gi], ss = g.items.length > 1;
  const setLabel = st.special ? 'Finisher' : (it.scheme === 'top' ? (st.set === 0 ? 'Top set' : 'Back-off ' + st.set + ' of ' + (it.sets - 1)) : 'Set ' + (st.set + 1) + ' of ' + it.sets);
  const reps = it.scheme === 'top' ? (st.set === 0 ? it.topReps + ' reps @ RIR ' + it.topRIR : it.reps + ' reps at −' + it.backPct + '%') : it.time ? (it.timeLabel || it.time + ' s') + (it.side ? ' per side' : '') : it.dist ? it.dist : (it.reps || '') + (it.reps && !/rep|max|each|\+/.test(it.reps) ? ' reps' : '') + (it.side ? ' per side' : '');
  const restTxt = st.rest ? 'Rest ' + st.rest + ' s' + (ss ? ' after the ' + (g.items.length === 2 ? 'pair' : 'round') : '') : ss ? 'Straight into ' + EX[g.items[(g.items.indexOf(it) + 1) % g.items.length].ex].n : '';
  const unit = S.settings.unit, bw = !!it.bw || /pushup|push-up|inverted|scap|hanging|plank|dead_bug|copenhagen|pullup/.test(it.ex);

  let h = '<div class="player" data-keep="1"><div class="pw"><div class="pbar pad"><button class="icon-btn" data-a="closePlayer" aria-label="Close workout">' + ic('close') + '</button><div class="segs">' + segs + '</div><span class="small tnum fg2" id="pElapsed" style="min-width:44px;text-align:right">0:00</span></div>';
  h += '<div class="pmedia">' + exMedia(it.ex, '', true) +
    '<span class="lab chip train" style="background:rgba(11,12,14,.7)">' + esc(it.k) + (ss ? ' · ' + (g.items.length === 2 ? 'Superset' : 'Tri-set') : '') + '</span><button class="info icon-btn glass" data-a="exInfo" data-v="' + it.ex + '" data-k="' + it.k + '" data-s="' + p.sid + '" aria-label="How to">' + ic('info') + '</button></div>';
  h += '<div class="pbody pad">';
  h += '<div class="eyebrow" style="color:var(--train)">' + esc(setLabel) + (restTxt ? ' · <span class="muted">' + esc(restTxt) + '</span>' : '') + '</div><h1 class="ptitle" style="margin-top:6px">' + esc(e.n) + '</h1>';
  h += '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><span class="chip">' + esc(reps) + '</span>' + (it.tech ? '<span class="chip train">' + esc(it.tech) + '</span>' : '') + (it.gated ? '<span class="chip warn">' + ic('lock').replace('<svg', '<svg width="11" height="11"') + ' ' + esc(gateTxt(it.gated)) + '</span>' : '') + '</div>';
  if (it.note) h += '<p class="small fg2" style="margin:8px 0 0">' + esc(it.note) + '</p>';
  if (st.special) {
    h += '<div class="card" style="margin-top:14px"><div class="small fg2">' + esc(rxText(it)) + '</div><button class="btn train block" style="margin-top:12px" data-a="specialTimer">' + ic('timer').replace('<svg', '<svg width="20" height="20"') + ' Start timer</button>' + (it.optional ? '<p class="xs muted" style="margin:8px 0 0">Optional today.</p>' : '') + '</div>';
  } else {
    if (sg && sg.last) h += '<div class="small" style="margin-top:12px;color:var(--fg-2)"><span class="muted">Last time (' + fmtShort(sg.last.date) + '):</span> ' + esc(sg.last.sets.map((x) => (x.w ? x.w + '×' : '') + (x.r || x.t || '')).join(', ')) + (sg.w != null && sg.msg ? '<br><span style="color:var(--train);font-weight:600">' + esc(sg.msg) + ' → ' + sg.w + ' ' + unit + '</span>' : '') + '</div>';
    else if (!bw) h += '<div class="small muted" style="margin-top:12px">First time logging this. Pick a weight that leaves ' + esc(plan(p.date).rir || '2') + ' reps in reserve.</div>';
    h += '<div class="stepper" style="margin-top:14px">' +
      '<div class="stp"><div class="sl">' + (bw ? 'Added ' + unit : unit) + '</div><div class="sv"><button data-a="adj" data-k="w" data-v="-1" aria-label="Less weight">−</button><input id="dW" inputmode="decimal" data-in="draft" data-k="w" value="' + esc(p.draft.w) + '" placeholder="' + (bw ? 'BW' : '0') + '" aria-label="Weight"><button data-a="adj" data-k="w" data-v="1" aria-label="More weight">+</button></div></div>' +
      (it.time ? '<div class="stp"><div class="sl">Seconds' + (it.side ? ' / side' : '') + '</div><div class="sv" style="justify-content:center"><span class="h-lg tnum" id="tShow" style="font-size:40px">' + (p.timed && p.timed.idx === p.idx ? '' : it.time) + '</span></div></div>'
        : '<div class="stp"><div class="sl">Reps' + (it.side ? ' / side' : '') + '</div><div class="sv"><button data-a="adj" data-k="r" data-v="-1" aria-label="Fewer reps">−</button><input id="dR" inputmode="numeric" data-in="draft" data-k="r" value="' + esc(p.draft.r) + '" placeholder="' + (it.amrap ? 'max' : '0') + '" aria-label="Reps"><button data-a="adj" data-k="r" data-v="1" aria-label="More reps">+</button></div></div>') + '</div>';
    // set chips
    h += '<div class="sets" style="margin-top:12px">';
    for (let i = 0; i < it.sets; i++) {
      const z = logged[i], on = i === st.set;
      const si = L.steps.findIndex((x) => x.it === it && x.set === i);
      h += '<button class="setc' + (on ? ' on' : '') + (z && z.done ? ' dn' : '') + '" data-a="goStep" data-v="' + si + '"><span>' + (it.scheme === 'top' && i === 0 ? 'Top' : 'Set ' + (i + 1)) + '</span><b class="tnum">' + (z && z.done ? (z.w ? z.w + '×' : '') + (z.r || z.t || '✓') : '–') + '</b></button>';
    }
    h += '</div>';
  }
  h += '</div>';
  // footer
  h += '<div class="pfoot pad">';
  if (!st.special) {
    if (it.time) {
      const running = p.timed && p.timed.idx === p.idx;
      h += running ? '<button class="btn ghost block" data-a="stopTimed">Stop</button>' : '<button class="btn train block" data-a="startTimed">' + ic('play').replace('<svg', '<svg width="18" height="18"') + ' Start ' + (it.timeLabel || it.time + ' s') + (it.side ? ' per side' : '') + '</button>';
    } else h += '<button class="btn train block" data-a="logSet">' + (cur && cur.done ? 'Update set' : 'Log set') + '</button>';
  } else h += '<button class="btn ghost block" data-a="skipSpecial">' + (isDone(p.date, 'x:' + p.sid + ':' + it.k) ? 'Next' : 'Skip finisher') + '</button>';
  h += '<div class="pnav"><button data-a="goStep" data-v="' + (p.idx - 1) + '"' + (p.idx === 0 ? ' disabled style="opacity:.35"' : '') + '>' + ic('prev') + ' Prev</button><button data-a="playerSwap">' + ic('swap') + ' Swap</button><button data-a="playerPain">' + ic('pain') + ' Pain</button><button data-a="playerJump">' + ic('list') + ' All</button><button data-a="goStep" data-v="' + (p.idx + 1) + '">' + (p.idx === L.steps.length - 1 ? 'Finish' : 'Next ' + ic('next')) + '</button></div></div>';
  // rest overlay
  if (p.rest) {
    const nx = L.steps[p.idx];
    h += '<div class="rest"><div class="in pad"><div class="eyebrow">Rest</div><div class="bigring" style="width:170px;height:170px"><svg id="restRing" width="170" height="170" viewBox="0 0 170 170"><circle cx="85" cy="85" r="78" fill="none" stroke="var(--card-3)" stroke-width="8"/><circle id="restArc" cx="85" cy="85" r="78" fill="none" stroke="var(--train)" stroke-width="8" stroke-linecap="round" stroke-dasharray="490 490"/></svg><div class="c"><div class="big tnum" id="restT">' + fmtTime((p.rest.end - Date.now()) / 1000) + '</div></div></div>' +
      '<div class="small fg2" style="text-align:center">Up next: <b style="color:var(--fg)">' + esc(EX[nx.it.ex].n) + '</b> · ' + (nx.special ? 'finisher' : 'set ' + (nx.set + 1) + ' of ' + nx.it.sets) + '</div>' +
      '<div class="row" style="gap:10px;width:100%"><button class="btn ghost grow" data-a="restAdj" data-v="-15">−15 s</button><button class="btn ghost grow" data-a="restAdj" data-v="15">+15 s</button><button class="btn train grow" data-a="restSkip">Skip</button></div></div></div>';
  }
  return h + '</div></div>';
}
TICKS.player = (p) => {
  setText('pElapsed', fmtTime((Date.now() - p.start) / 1000));
  if (p.rest) {
    const left = (p.rest.end - Date.now()) / 1000;
    setText('restT', fmtTime(Math.ceil(left)));
    const arc = document.getElementById('restArc'); if (arc) arc.setAttribute('stroke-dasharray', (490 * clamp(left / p.rest.total, 0, 1)).toFixed(1) + ' 490');
    const sec = Math.ceil(left);
    if (sec <= 3 && sec >= 1 && p.rest.beeped !== sec) { p.rest.beeped = sec; Sound.tick(); }
    if (left <= 0) { p.rest = null; Sound.go(); render(); }
  }
  if (p.timed) {
    const left = (p.timed.end - Date.now()) / 1000, sec = Math.ceil(left);
    setText('tShow', String(Math.max(0, sec)));
    if (sec <= 3 && sec >= 1 && p.timed.beeped !== sec) { p.timed.beeped = sec; Sound.tick(); }
    if (left <= 0) {
      const L = liftSteps(p.date, p.sid), it = L.steps[p.idx].it;
      if (it.side && p.timed.side === 1) { p.timed = { idx: p.idx, end: Date.now() + it.time * 1000 + 3000, side: 2 }; Sound.go(); Sound.say('Switch sides'); return; }
      p.timed = null; Sound.done(); logCurrent(p, { t: it.time + 's' });
    }
  }
};
function logCurrent(p, extra) {
  const L = liftSteps(p.date, p.sid), st = L.steps[p.idx], it = st.it, d = day(p.date);
  d.sets = d.sets || {}; const k = setKey(p.sid, it); d.sets[k] = d.sets[k] || [];
  d.sets[k][st.set] = Object.assign({ w: (p.draft.w || '').trim(), r: (p.draft.r || '').trim(), done: true, at: Date.now() }, extra || {});
  touch(p.date);
  advance(p, L, st);
}
function advance(p, L, st) {
  const nextIdx = L.steps.findIndex((x, i) => i > p.idx && !stepLogged(p.date, p.sid, x));
  if (nextIdx < 0) {
    const firstOpen = L.steps.findIndex((x) => !stepLogged(p.date, p.sid, x));
    if (firstOpen < 0 || firstOpen === p.idx) { finishLift(p); return; }
    p.idx = firstOpen;
  } else p.idx = nextIdx;
  p.draft = null;
  if (st.rest) { p.rest = { end: Date.now() + st.rest * 1000, total: st.rest }; }
  else { Sound.tick(); }
  render();
}
PA.logSet = () => { const p = topL().p; Sound.done(); logCurrent(p); };
PA.adj = (el) => {
  const p = topL().p, k = el.dataset.k, dir = +el.dataset.v;
  const step = k === 'w' ? (S.settings.unit === 'kg' ? 2.5 : 5) : 1;
  const v = num(p.draft[k]) || 0; p.draft[k] = String(Math.max(0, +(v + dir * step).toFixed(1)));
  const inp = document.getElementById(k === 'w' ? 'dW' : 'dR'); if (inp) inp.value = p.draft[k];
};
PIN.draft = (el) => { const p = topL().p; if (p.draft) p.draft[el.dataset.k] = el.value; };
PA.goStep = (el) => {
  const p = topL().p, L = liftSteps(p.date, p.sid), i = +el.dataset.v;
  if (i >= L.steps.length) { finishLift(p); return; }
  if (i < 0) return;
  p.idx = i; p.draft = null; p.rest = null; p.timed = null; closeSheetQuiet(); render();
};
PA.restAdj = (el) => { const p = topL().p; if (p.rest) { p.rest.end += +el.dataset.v * 1000; p.rest.total = Math.max(p.rest.total, (p.rest.end - Date.now()) / 1000); } };
PA.restSkip = () => { const p = topL().p; p.rest = null; render(); };
PA.startTimed = () => { const p = topL().p, it = liftSteps(p.date, p.sid).steps[p.idx].it; p.timed = { idx: p.idx, end: Date.now() + it.time * 1000 + 3000, side: 1 }; Sound.say(it.side ? 'Side one. Three, two, one' : 'Three, two, one'); render(); };
PA.stopTimed = () => { const p = topL().p; p.timed = null; render(); };
PA.closePlayer = () => { pop(); };
PA.specialTimer = () => {
  const p = topL().p, it = liftSteps(p.date, p.sid).steps[p.idx].it;
  const key = 'x:' + p.sid + ':' + it.k;
  let cfg;
  if (it.kind === 'emom') { const segs = []; for (let m = 0; m < it.minutes; m++) { const o = m % 2 === 0 ? it.odd : it.even; segs.push({ kind: 'work', dur: 60, ex: o.ex, label: 'Minute ' + (m + 1) + ': ' + o.label }); } cfg = { title: it.minutes + '-min EMOM', segs, doneKey: key }; }
  else if (it.kind === 'interval') { const segs = []; for (let r = 0; r < it.rounds; r++) { segs.push({ kind: 'work', dur: it.work, ex: it.ex, label: 'All-out' }); if (r < it.rounds - 1) segs.push({ kind: 'rest', dur: it.restI, ex: it.ex, label: 'Easy' }); } cfg = { title: it.label, segs, doneKey: key }; }
  else if (it.kind === 'ladder') cfg = { title: 'Push-up ladder', mode: 'ladder', total: it.minutes * 60, ex: 'pushup_ladder', doneKey: key };
  openTimer(p.date, cfg);
};
PA.skipSpecial = () => { const p = topL().p, L = liftSteps(p.date, p.sid), st = L.steps[p.idx]; if (!isDone(p.date, 'x:' + p.sid + ':' + st.it.k)) setDone(p.date, 'x:' + p.sid + ':' + st.it.k, true); advance(p, L, Object.assign({}, st, { rest: 0 })); };
PA.playerSwap = () => { const p = topL().p, it = liftSteps(p.date, p.sid).steps[p.idx].it; openSheet('swap', { ex: it.ex, k: it.k, base: it.baseEx }); };
PA.playerPain = () => { const p = topL().p, it = liftSteps(p.date, p.sid).steps[p.idx].it; openSheet('pain', { ex: it.ex, k: it.k }); };
PA.playerJump = () => openSheet('jump', {});
function closeSheetQuiet() { ui.sheet = null; }

function swapSheet(p) {
  const alts = [EX[p.ex].alt, EX[p.ex].swapTo, p.base && p.base !== p.ex ? p.base : null].filter((x, i, a) => x && a.indexOf(x) === i && x !== p.ex);
  let s = '<h2 class="h-lg">Swap ' + esc(EX[p.ex].n) + '</h2><p class="small fg2" style="margin:6px 0 12px">For today only. Your logged sets stay with each exercise.</p><div class="stack">';
  s += alts.map((x) => '<button class="li card" style="padding:10px" data-a="doSwap" data-v="' + x + '" data-k="' + p.k + '">' + exThumb(x, 52) + '<span class="grow"><span class="t" style="display:block">' + esc(EX[x].n) + '</span><span class="s" style="display:block">' + esc(EX[x].eq || '') + '</span></span></button>').join('');
  if (!alts.length) s += '<div class="card small fg2">No plan swap for this one. If it hurts, use Pain to reduce, drop it today, or drop it for the week.</div>';
  return s + '</div><button class="btn ghost block" style="margin-top:14px" data-a="closeSheet">Cancel</button>';
}
function painSheet(p) {
  const L = [['g', '0–2 / 10', 'Train as planned.', 'ok'], ['y', '3–5 / 10', 'Reduce load or range, or swap the exercise.', 'swap'], ['r', 'Above 5', 'Drop this movement for the rest of the week.', 'week'], ['r', 'Arm tingling', 'Stop this exercise for today, whatever the score.', 'today']];
  return '<h2 class="h-lg">Pain check</h2><p class="small fg2" style="margin:6px 0 12px">' + esc(EX[p.ex].n) + '. The traffic light decides.</p><div class="stack">' + L.map(([t, a, b, act]) =>
    '<button class="li card" style="padding:12px" data-a="painAct" data-v="' + act + '" data-ex="' + p.ex + '" data-k="' + p.k + '"><span class="chip ' + ({ g: 'good', y: 'warn', r: 'bad' })[t] + '" style="min-width:86px;justify-content:center">' + a + '</span><span class="grow small fg2">' + b + '</span></button>').join('') + '</div>';
}
PA.painAct = (el) => {
  const l = topL(), p = l.p, date = p.date || ui.date, ex = el.dataset.ex, act = el.dataset.v, d = day(date);
  d.pain = d.pain || {}; d.pain[ex] = act;
  if (act === 'swap') { touch(date); openSheet('swap', { ex, k: el.dataset.k, base: (liftSteps(date, p.sid).items.find((i) => i.ex === ex) || {}).baseEx }); return; }
  if (act === 'today' || act === 'week') {
    const end = act === 'week' ? addDays(mondayOf(date), 6) : date;
    for (let dd = date; dd <= end; dd = addDays(dd, 1)) { const x = day(dd); x.skip = x.skip || {}; x.skip[ex] = act; touch(dd); }
    toast(act === 'week' ? 'Dropped for the week' : 'Stopped for today');
    if (act === 'today') Sound.say('Stop this exercise for today');
  } else touch(date);
  ui.sheet = null; p.draft = null; p.rest = null; render();
};
function jumpSheet() {
  const p = topL().p, L = liftSteps(p.date, p.sid);
  return '<h2 class="h-lg">Exercises</h2><div class="list" style="margin-top:12px">' + L.groups.map((g, gi) => g.items.map((it) => {
    const first = L.steps.findIndex((x) => x.it === it), done = L.steps.filter((x) => x.it === it).every((x) => stepLogged(p.date, p.sid, x));
    return '<button class="li" data-a="goStep" data-v="' + first + '">' + exThumb(it.ex, 44) + '<span class="grow"><span class="t" style="display:block">' + esc(it.k + ' · ' + EX[it.ex].n) + '</span><span class="s" style="display:block">' + esc(rxText(it)) + '</span></span>' + (done ? '<span class="check on">' + ic('check') + '</span>' : '') + '</button>';
  }).join('')).join('') + '</div><button class="btn train block" style="margin-top:14px" data-a="finishNow">Finish workout</button>';
}
PA.finishNow = () => { ui.sheet = null; finishLift(topL().p); };

function finishLift(p) {
  const L = liftSteps(p.date, p.sid), d = peek(p.date);
  let sets = 0, vol = 0; const prs = [];
  L.items.forEach((it) => {
    const z = setsFor(p.date, p.sid, it).filter((x) => x && x.done);
    sets += z.length;
    z.forEach((x) => { vol += (num(x.w) || 0) * (num(x.r) || 0); });
    const best = z.reduce((b, x) => { const w = num(x.w), r = num(x.r); if (!w || !r || r > 15) return b; const e = w * (1 + r / 30); return e > b.e ? { e, w, r } : b; }, { e: 0 });
    if (best.e) {
      let prev = 0;
      Object.keys(S.days).filter((dd) => dd < p.date).forEach((dd) => Object.keys(S.days[dd].sets || {}).forEach((k) => { if (k.split('|')[2] === it.ex) S.days[dd].sets[k].forEach((x) => { const w = num(x && x.w), r = num(x && x.r); if (x && x.done && w && r && r <= 15) prev = Math.max(prev, w * (1 + r / 30)); }); }));
      if (prev && best.e > prev + 0.5) prs.push(EX[it.ex].n + ': ' + best.w + ' × ' + best.r);
    }
  });
  setDone(p.date, 's:' + p.sid, true);
  ui.stack.pop();
  push('done', { date: p.date, sid: p.sid, mins: Math.round((Date.now() - p.start) / 60000), sets, vol, prs, exN: L.items.length });
}
function lDone(p) {
  const s = findSession(p.date, p.sid) || { title: 'Workout' }, P = plan(p.date), feel = (peek(p.date).feel || {})[p.sid];
  let h = '<div class="layer"><div class="wrap"><div class="pad" style="padding-top:calc(40px + env(safe-area-inset-top,0px));text-align:center">';
  h += '<div style="width:96px;height:96px;border-radius:50%;background:var(--good);color:#062014;display:grid;place-items:center;margin:0 auto">' + ic('check').replace('<svg', '<svg width="52" height="52"') + '</div>';
  h += '<div class="eyebrow" style="margin-top:20px">' + esc(fmtD(p.date)) + '</div><h1 class="h-xl" style="margin-top:6px">Workout complete</h1><p class="fg2" style="margin:8px 0 0">' + esc(s.title) + (P.week >= 1 && P.week <= 13 ? ' · Week ' + P.week : '') + '</p>';
  h += '<div class="kv" style="margin-top:22px;text-align:left"><div><div class="v tnum">' + p.mins + '</div><div class="k">Minutes</div></div><div><div class="v tnum">' + p.sets + '</div><div class="k">Sets logged</div></div><div><div class="v tnum">' + fmtN(p.vol) + '</div><div class="k">Volume (' + S.settings.unit + ')</div></div></div>';
  if (p.prs.length) h += '<div class="card" style="margin-top:12px;text-align:left"><div class="h-sm" style="color:var(--train)">New bests</div><ul class="small fg2" style="margin:8px 0 0;padding-left:18px">' + p.prs.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  h += '<div style="margin-top:22px"><div class="h-sm">How did that feel?</div><div class="seg train" style="margin-top:10px">' + ['Easy', 'Good', 'Tough', 'Brutal'].map((f) => '<button class="' + (feel === f ? 'on' : '') + '" data-a="feel" data-v="' + f + '">' + f + '</button>').join('') + '</div></div>';
  if (P.core && !isDone(p.date, 'core') && readiness(p.date) !== 'yellow') h += '<button class="li card" style="margin-top:16px;padding:12px;text-align:left" data-a="core" data-v="' + P.core + '">' + exThumb((D.CORE[P.week <= 2 ? 1 : P.week <= 6 ? 2 : 3][P.core] || [])[0] || 'plank_ppt', 52) + '<span class="grow"><span class="t" style="display:block">Core finisher next</span><span class="s" style="display:block">' + esc(D.CORE_NAMES[P.core]) + '</span></span>' + ic('play').replace('<svg', '<svg width="20" height="20"') + '</button>';
  h += '<p class="small muted" style="margin-top:18px">Next: the shake (1.5 scoops whey + 5 g creatine), then your ' + esc((D.MIND[P.sit] || {}).n || 'meditation') + ' before the laptop.</p>';
  h += '</div></div><div class="sticky-cta pad"><div class="in"><button class="btn train block" data-a="doneFinish">Done</button></div></div></div>';
  return h;
}
PA.feel = (el) => { const p = topL().p, d = day(p.date); d.feel = d.feel || {}; d.feel[p.sid] = el.dataset.v; touch(p.date); render(); };
PA.doneFinish = () => {
  const p = topL().p; setDone(p.date, 's:' + p.sid, true);
  ui.stack.pop(); renderedLayers = ui.stack.length; render(); toast('Saved. Nice work.');
};

/* ================================================================== ROUTINES */
function routineSteps(id, date) {
  const R = D.ROUTINES[id], w = weekOf(date), dw = dowOf(date);
  let steps = R.steps.filter((s) => !(s.big3 && w > 4 && ![0, 2, 4].includes(dw)));
  if (id === 'armor' && plan(date).armorWed) steps = steps.concat(D.ROUTINES.armorWed.steps);
  return steps.map((s) => {
    if (s.vacuum) { const h = w <= 4 ? 20 : w <= 8 ? 30 : 45; return Object.assign({}, s, { hold: h, dose: '3 × ' + h + ' s' }); }
    return s;
  });
}
function openRoutine(id) { push('routine', { id, date: topDate(), idx: 0, run: null }); }
function lRoutine(p) {
  const R = D.ROUTINES[p.id], steps = routineSteps(p.id, p.date), st = steps[p.idx], e = EX[st.ex];
  const segs = steps.map((_, i) => '<i class="' + (i === p.idx ? 'c' : i < p.idx ? 'd' : '') + '"></i>').join('');
  let h = '<div class="player" data-keep="1"><div class="pw"><div class="pbar pad"><button class="icon-btn" data-a="routineClose" aria-label="Close">' + ic('close') + '</button><div class="segs">' + segs + '</div><span class="small fg2 tnum">' + (p.idx + 1) + '/' + steps.length + '</span></div>';
  h += '<div class="pmedia">' + exMedia(st.ex, '', true) + '<span class="lab chip mind" style="background:rgba(11,12,14,.7)">' + esc(R.title) + '</span><button class="info icon-btn glass" data-a="exInfo" data-v="' + st.ex + '" aria-label="How to">' + ic('info') + '</button></div>';
  h += '<div class="pbody pad"><div class="eyebrow" style="color:var(--mind)">' + esc(st.dose) + (st.optional ? ' · only if symptom-free' : '') + '</div><h1 class="ptitle" style="margin-top:6px">' + esc(e.n) + '</h1>';
  if (e.cues) h += '<ul class="small fg2" style="margin:10px 0 0;padding-left:18px">' + e.cues.map((c) => '<li style="margin:3px 0">' + esc(c) + '</li>').join('') + '</ul>';
  h += '<div class="card" style="margin-top:14px;text-align:center"><div class="eyebrow" id="rPhase">' + esc(routineIdleLabel(st)) + '</div><div class="timer-big tnum" id="rBig" style="margin-top:6px;font-size:72px">' + esc(routineIdleBig(st)) + '</div><div class="small muted" id="rSub">' + esc(st.side ? 'Each side' : '') + '</div></div>';
  h += '</div><div class="pfoot pad">';
  const auto = st.holds || st.time || st.breaths;
  if (auto) h += p.run ? '<button class="btn ghost block" data-a="routineStop">Pause</button>' : '<button class="btn train block" data-a="routineGo">' + ic('play').replace('<svg', '<svg width="18" height="18"') + ' Start</button>';
  else h += '<button class="btn train block" data-a="routineNext">Done · next</button>';
  h += '<div class="pnav"><button data-a="routinePrev"' + (p.idx === 0 ? ' disabled style="opacity:.35"' : '') + '>' + ic('prev') + ' Prev</button><button data-a="routineNext">' + (p.idx === steps.length - 1 ? 'Finish' : 'Skip ' + ic('next')) + '</button></div></div></div></div>';
  return h;
}
function routineIdleLabel(st) { return st.breaths ? st.breaths + ' breaths' : st.holds ? st.holds + ' holds × ' + st.hold + ' s' : st.time ? (st.sets || 1) + ' × ' + st.time + ' s' : (st.sets ? st.sets + ' × ' : '') + 'Reps'; }
function routineIdleBig(st) { return st.breaths ? st.breaths + '×' : st.holds ? st.hold + 's' : st.time ? st.time + 's' : String(st.reps || ''); }
/* build a timeline of phases for auto steps */
function routinePlan(st) {
  const ph = []; const sides = st.side ? 2 : 1;
  if (st.breaths) { for (let i = 0; i < st.breaths; i++) { ph.push({ k: 'in', d: st.inS, l: 'Breathe in', n: i + 1 }); ph.push({ k: 'out', d: st.outS, l: 'Breathe out', n: i + 1 }); } return ph; }
  for (let s = 0; s < sides; s++) {
    if (s === 1) ph.push({ k: 'switch', d: 5, l: 'Switch sides', say: 'Switch sides' });
    if (st.holds) for (let i = 0; i < st.holds; i++) { ph.push({ k: 'hold', d: st.hold, l: 'Hold', n: i + 1, of: st.holds }); if (i < st.holds - 1) ph.push({ k: 'rest', d: 3, l: 'Relax' }); }
    if (st.time) for (let i = 0; i < (st.sets || 1); i++) { ph.push({ k: 'hold', d: st.time, l: 'Hold', n: i + 1, of: st.sets || 1 }); if (i < (st.sets || 1) - 1) ph.push({ k: 'rest', d: 10, l: 'Rest' }); }
  }
  return ph;
}
PA.routineGo = () => {
  const p = topL().p, st = routineSteps(p.id, p.date)[p.idx];
  p.run = { phases: routinePlan(st), i: 0, start: Date.now() + 3000, pre: true };
  Sound.say(EX[st.ex].n + '. Three, two, one.');
  render();
};
PA.routineStop = () => { topL().p.run = null; render(); };
PA.routinePrev = () => { const p = topL().p; p.idx = Math.max(0, p.idx - 1); p.run = null; render(); };
PA.routineNext = () => {
  const p = topL().p, steps = routineSteps(p.id, p.date);
  p.run = null;
  if (p.idx >= steps.length - 1) { finishRoutine(p); return; }
  p.idx++; Sound.tick(); render();
};
PA.routineClose = () => { pop(); };
function finishRoutine(p) {
  const key = p.id.startsWith('ramp_') ? 'ramp' : p.id;
  if (p.id === 'desk') { const d = day(p.date); d.desk = (d.desk || 0) + 1; touch(p.date); }
  else setDone(p.date, key, true);
  Sound.done(); pop(); toast(D.ROUTINES[p.id].title + ' done');
}
TICKS.routine = (p) => {
  if (!p.run) return;
  const r = p.run, now = Date.now();
  if (now < r.start) { setText('rPhase', 'Get ready'); setText('rBig', String(Math.ceil((r.start - now) / 1000))); return; }
  let t = (now - r.start) / 1000, i = 0;
  while (i < r.phases.length && t >= r.phases[i].d) { t -= r.phases[i].d; i++; }
  if (i >= r.phases.length) { p.run = null; Sound.done(); PA.routineNext(); return; }
  const ph = r.phases[i];
  if (r.i !== i || r.pre) {
    r.i = i; r.pre = false;
    if (ph.k === 'hold' || ph.k === 'in') Sound.go(); else Sound.tick();
    if (ph.say) Sound.say(ph.say);
  }
  setText('rPhase', ph.l + (ph.n ? ' · ' + ph.n + (ph.of ? ' of ' + ph.of : '') : ''));
  setText('rBig', String(Math.ceil(ph.d - t)));
  const svg = document.querySelector('.player svg[data-orb]');
  if (svg && (ph.k === 'in' || ph.k === 'out')) { svg.dataset.driven = '1'; const f = ph.k === 'in' ? ease(t / ph.d) : 1 - ease(t / ph.d); svg.querySelector('[data-orbc]').setAttribute('r', (30 + f * 26).toFixed(1)); svg.querySelector('[data-orbt]').textContent = ph.k === 'in' ? 'In' : 'Out'; }
};

/* ================================================================== TIMERS (core finishers, rugby blocks, cardio) */
function openTimer(date, cfg) { push('timer', { date, cfg, state: 'ready', t0: 0, paused: 0, pauseAt: 0, rounds: 0, rep: 0, rung: 0, ri: 0 }); }
function openCore(letter, wOverride) {
  const date = topDate(), w = wOverride || clamp(weekOf(date), 1, 13), cp = w <= 2 ? 1 : w <= 6 ? 2 : 3;
  const f = D.CORE_FMT[w], list = D.CORE[cp][letter].map((ex) => dayEx(ex, date).ex);
  const segs = [];
  for (let r = 0; r < f[2]; r++) list.forEach((ex, i) => {
    const lastAll = r === f[2] - 1 && i === list.length - 1;
    segs.push({ kind: 'work', dur: f[0], ex, label: (f[3] && lastAll ? 'To failure · ' : '') + 'Round ' + (r + 1) + ' of ' + f[2] });
    if (!lastAll) segs.push({ kind: 'rest', dur: f[1], ex: list[(i + 1) % list.length], label: 'Rest' });
  });
  openTimer(date, { title: D.CORE_NAMES[letter], segs, doneKey: 'core', note: 'Ribs down, exhale hard. If form breaks, switch to the easier version and finish the interval.' });
}
const dxi = (items, date) => items.map((x) => Object.assign({}, x, { ex: dayEx(x.ex, date).ex }));
function openBlock(date, sid, i) {
  const s = findSession(date, sid), b = s.src.blocks[i], w = weekOf(date), key = 'b:' + sid + ':' + i;
  if (b.kind === 'interval') {
    const segs = [];
    for (let r = 0; r < b.rounds; r++) { segs.push({ kind: 'work', dur: b.work, ex: b.ex, label: 'Hard · RPE 8' }); if (r < b.rounds - 1) segs.push({ kind: 'rest', dur: b.restI, ex: b.ex, label: 'Easy' }); }
    openTimer(date, { title: b.label, segs, doneKey: key });
  } else if (b.kind === 'circuit') openTimer(date, { title: b.name, mode: 'circuit', items: dxi(b.items, date), rounds: b.rounds, rest: b.rest, doneKey: key });
  else if (b.kind === 'sprints') { const c = sprintCfg(b, w); openTimer(date, { title: b.name + ' · ' + c.reps + ' × ' + c.dist + ' at ' + c.pct, mode: 'sprints', ex: b.ex, reps: c.reps, rest: c.rest, doneKey: key }); }
  else if (b.kind === 'amrap') openTimer(date, { title: b.name, mode: 'amrap', items: dxi(b.items, date), total: b.minutes * 60, doneKey: key, roundsKey: sid + ':' + i, bench: b.benchmark });
  else if (b.kind === 'sets') openTimer(date, { title: b.name, mode: 'circuit', items: dxi(b.items, date), rounds: 2, rest: 45, doneKey: key });
}
function openCardio(date, sid) {
  const s = findSession(date, sid), c = s.cardio || {};
  if (c.intervals) {
    const I = c.intervals, segs = [{ kind: 'warm', dur: I.warm, ex: 'run', label: 'Easy warm-up' }];
    for (let r = 0; r < I.rounds; r++) { segs.push({ kind: 'work', dur: I.work, ex: 'run', label: I.workLabel + ' · ' + (r + 1) + ' of ' + I.rounds }); if (r < I.rounds - 1) segs.push({ kind: 'rest', dur: I.rest, ex: 'run', label: I.restLabel }); }
    segs.push({ kind: 'cool', dur: I.cool, ex: 'run', label: 'Easy cool-down' });
    openTimer(date, { title: s.title, segs, doneKey: 's:' + sid, logMin: sid });
  } else openTimer(date, { title: s.title, mode: 'stopwatch', ex: /swim/i.test(s.title) ? 'swim' : 'run', total: (c.min || 30) * 60, doneKey: 's:' + sid, logMin: sid });
}
function openStrides(date, sid) { const c = findSession(date, sid).cardio.strides; openTimer(date, { title: 'Strides · ' + c[0] + ' × ' + c[1] + ' at ' + c[2], mode: 'sprints', ex: 'strides', reps: c[0], rest: 60 }); }

function lTimer(p) {
  const c = p.cfg, mode = c.mode || 'segments';
  let ex = c.ex, label = '', nextTxt = '';
  if (mode === 'segments') { const cur = timerSeg(p); ex = (cur.seg || c.segs[0]).ex; }
  if (mode === 'circuit') ex = c.items[p.ri % c.items.length].ex;
  if (mode === 'amrap') ex = c.items[p.ri % c.items.length].ex;
  let h = '<div class="player" data-keep="1"><div class="pw"><div class="pbar pad"><button class="icon-btn" data-a="timerClose" aria-label="Close">' + ic('close') + '</button><div class="grow h-sm" style="text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(c.title) + '</div><span style="width:44px"></span></div>';
  h += '<div class="pmedia" id="tMedia">' + exMedia(ex, '', true) + '</div>';
  h += '<div class="pbody pad" style="text-align:center"><div class="eyebrow" id="tLabel" style="color:var(--train)">' + (p.state === 'ready' ? 'Ready' : '') + '</div><h1 class="ptitle" id="tName" style="margin-top:6px">' + esc(EX[ex] ? EX[ex].n : '') + '</h1><div class="timer-big tnum" id="tBig" style="margin-top:8px">' + (mode === 'stopwatch' || mode === 'amrap' || mode === 'ladder' ? fmtTime(c.total) : mode === 'segments' ? fmtTime(c.segs[0].dur) : '') + '</div><div class="small fg2" id="tNext"></div>';
  if (c.note) h += '<p class="xs muted" style="margin:10px 0 0">' + esc(c.note) + '</p>';
  if (mode === 'circuit') {
    h += '<div class="eyebrow" style="margin-top:12px">Round ' + Math.min(p.rounds + 1, c.rounds) + ' of ' + c.rounds + '</div><div class="list" style="margin-top:8px;text-align:left">' + c.items.map((x, i) => '<button class="li" data-a="circItem" data-v="' + i + '">' + exThumb(x.ex, 40) + '<span class="grow"><span class="t" style="display:block">' + esc(EX[x.ex].n) + '</span><span class="s" style="display:block">' + esc(x.label) + '</span></span>' + '<span class="check' + (i < p.ri ? ' on' : '') + '">' + (i < p.ri ? ic('check') : '') + '</span></button>').join('') + '</div>';
  }
  if (mode === 'amrap') {
    h += '<div class="row" style="justify-content:center;gap:14px;margin-top:10px"><button class="icon-btn" data-a="amrapRound" data-v="-1" aria-label="Minus a round">' + ic('minus') + '</button><div><div class="big-num tnum" id="tRounds">' + p.rounds + '</div><div class="xs muted">rounds</div></div><button class="icon-btn" style="background:var(--train);color:var(--train-ink)" data-a="amrapRound" data-v="1" aria-label="Add a round">' + ic('plus') + '</button></div><div class="list" style="margin-top:12px;text-align:left">' + c.items.map((x) => '<div class="li" style="min-height:52px">' + exThumb(x.ex, 36) + '<span class="grow"><span class="t">' + esc(EX[x.ex].n) + '</span> <span class="s">' + esc(x.label) + '</span></span></div>').join('') + '</div>';
  }
  if (mode === 'sprints') h += '<div class="eyebrow" style="margin-top:10px">Rep ' + Math.min(p.rep + 1, c.reps) + ' of ' + c.reps + '</div>';
  if (mode === 'ladder') h += '<div class="eyebrow" style="margin-top:10px">Rung</div><div class="big-num tnum">' + ladderRung(p.rung) + ' reps</div><div class="xs muted">1 → 10 → 1 · rung ' + (p.rung + 1) + ' of 19</div>';
  h += '</div><div class="pfoot pad">';
  if (p.state === 'ready') h += '<button class="btn train block" data-a="timerGo">' + ic('play').replace('<svg', '<svg width="18" height="18"') + ' Start</button>';
  else if (p.state === 'done') h += '<button class="btn train block" data-a="timerFinish">Save and close</button>';
  else {
    if (mode === 'circuit') h += p.resting ? '<button class="btn ghost block" data-a="circSkipRest">Skip rest</button>' : '<button class="btn train block" data-a="circItem" data-v="' + p.ri + '">Done: ' + esc(EX[c.items[p.ri].ex].n) + '</button>';
    else if (mode === 'sprints') h += p.resting ? '<button class="btn ghost block" data-a="sprintSkip">Skip rest</button>' : '<button class="btn train block" data-a="sprintDone">Rep done</button>';
    else if (mode === 'ladder') h += '<button class="btn train block" data-a="ladderRung">Rung done</button>';
    else h += '<div class="row" style="gap:10px"><button class="btn ghost grow" data-a="timerPause">' + (p.paused ? 'Resume' : 'Pause') + '</button>' + (mode === 'segments' ? '<button class="btn ghost grow" data-a="timerSkip">Skip</button>' : '<button class="btn ghost grow" data-a="timerEnd">End</button>') + '</div>';
  }
  return h + '</div></div></div>';
}
function ladderRung(i) { return i < 10 ? i + 1 : 19 - i; }
function timerElapsed(p) { if (!p.t0) return 0; return ((p.paused ? p.pauseAt : Date.now()) - p.t0) / 1000; }
function timerSeg(p) {
  const segs = p.cfg.segs || []; let t = timerElapsed(p), i = 0;
  while (i < segs.length && t >= segs[i].dur) { t -= segs[i].dur; i++; }
  return { i, seg: segs[i], left: segs[i] ? segs[i].dur - t : 0 };
}
PA.timerGo = () => { const p = topL().p; p.state = 'run'; p.t0 = Date.now() + 5000; p.lastSeg = -1; Sound.say('Get ready'); render(); };
PA.timerPause = () => { const p = topL().p; if (p.paused) { p.t0 += Date.now() - p.pauseAt; p.paused = 0; } else { p.paused = 1; p.pauseAt = Date.now(); } render(); };
PA.timerSkip = () => { const p = topL().p, cur = timerSeg(p); if (cur.seg) p.t0 -= cur.left * 1000; };
PA.timerEnd = () => { const p = topL().p; timerDone(p); Sound.done(); render(); };
function timerDone(p) { p.state = 'done'; timerSave(p); }
/* idempotent: writes rounds / minutes / completion; runs again if rounds are corrected afterwards */
function timerSave(p) {
  const c = p.cfg;
  if (c.roundsKey) { const d = day(p.date); d.rounds = d.rounds || {}; d.rounds[c.roundsKey] = p.rounds; touch(p.date); if (c.bench) { const col = benchCol(weekOf(p.date)); S.bench[c.bench] = S.bench[c.bench] || {}; S.bench[c.bench][col] = String(p.rounds); touch(); } }
  if (c.logMin && !p.minSaved) { const d = day(p.date); d.cardio = d.cardio || {}; d.cardio[c.logMin] = d.cardio[c.logMin] || {}; d.cardio[c.logMin].min = String(Math.max(1, Math.round(timerElapsed(p) / 60))); p.minSaved = true; touch(p.date); }
  if (c.doneKey && !isDone(p.date, c.doneKey)) setDone(p.date, c.doneKey, true);
  p.saved = true;
}
PA.timerClose = () => { pop(); };
PA.timerFinish = () => {
  const p = topL().p;
  timerSave(p);
  pop(); toast('Saved');
};
PA.amrapRound = (el) => { const p = topL().p; p.rounds = Math.max(0, p.rounds + +el.dataset.v); setText('tRounds', String(p.rounds)); if (+el.dataset.v > 0) Sound.tick(); if (p.saved) timerSave(p); };
PA.circItem = (el) => {
  const p = topL().p, c = p.cfg; if (p.state !== 'run' || p.resting) return;
  const i = +el.dataset.v; if (i !== p.ri) return;
  p.ri++; Sound.tick();
  if (p.ri >= c.items.length) {
    p.rounds++; p.ri = 0;
    if (p.rounds >= c.rounds) { timerDone(p); Sound.done(); render(); return; }
    p.resting = Date.now() + c.rest * 1000; Sound.say('Rest ' + c.rest + ' seconds');
  } else Sound.say(EX[c.items[p.ri].ex].n);
  render();
};
PA.circSkipRest = () => { const p = topL().p; p.resting = 0; Sound.go(); render(); };
PA.sprintDone = () => { const p = topL().p, c = p.cfg; p.rep++; if (p.rep >= c.reps) { timerDone(p); Sound.done(); render(); return; } p.resting = Date.now() + c.rest * 1000; Sound.say('Walk back. Rest'); render(); };
PA.sprintSkip = () => { const p = topL().p; p.resting = 0; Sound.go(); Sound.say('Go when ready'); render(); };
PA.ladderRung = () => { const p = topL().p; p.rung++; Sound.tick(); if (p.rung >= 19) { timerDone(p); Sound.done(); } render(); };
TICKS.timer = (p) => {
  const c = p.cfg, mode = c.mode || 'segments';
  if (p.state !== 'run') return;
  const pre = p.t0 - Date.now();
  if (pre > 0) { setText('tLabel', 'Get ready'); setText('tBig', String(Math.ceil(pre / 1000))); const s = Math.ceil(pre / 1000); if (s <= 3 && p.preBeep !== s) { p.preBeep = s; Sound.tick(); } return; }
  if (p.preBeep !== 0 && mode !== 'segments') { p.preBeep = 0; Sound.go(); }
  if (mode === 'segments') {
    const cur = timerSeg(p);
    if (!cur.seg) { timerDone(p); Sound.done(); Sound.say('Done'); render(); return; }
    if (cur.i !== p.lastSeg) {
      p.lastSeg = cur.i; const nx = c.segs[cur.i + 1];
      if (cur.seg.kind === 'rest') { Sound.done(); if (nx) Sound.say('Rest. Next: ' + EX[nx.ex].n); }
      else { Sound.go(); if (cur.i === 0 || c.segs[cur.i - 1].ex !== cur.seg.ex) Sound.say(EX[cur.seg.ex].n); }
      const m = document.getElementById('tMedia'); if (m) m.innerHTML = exMedia(cur.seg.ex, '', true);
      setText('tName', EX[cur.seg.ex].n);
      setText('tNext', nx ? 'Next: ' + EX[nx.ex].n + (nx.kind === 'rest' ? ' (rest)' : '') : 'Last one');
    }
    const lab = ({ work: 'Work', rest: 'Rest', warm: 'Warm-up', cool: 'Cool-down' })[cur.seg.kind] + ' · ' + cur.seg.label;
    setText('tLabel', lab);
    const tl = document.getElementById('tLabel'); if (tl) tl.style.color = cur.seg.kind === 'rest' ? 'var(--mind)' : 'var(--train)';
    const s = Math.ceil(cur.left); setText('tBig', fmtTime(s));
    if (s <= 3 && s >= 1 && p.beep !== cur.i + ':' + s) { p.beep = cur.i + ':' + s; Sound.tick(); }
    return;
  }
  const el = timerElapsed(p);
  if (mode === 'stopwatch') {
    setText('tBig', fmtTime(el)); setText('tLabel', el < c.total ? 'Target ' + fmtTime(c.total) : 'Target reached');
    if (el >= c.total && !p.hit) { p.hit = 1; Sound.done(); Sound.say('Time. Nice work.'); }
    return;
  }
  if (mode === 'amrap' || mode === 'ladder') {
    const left = c.total - el; setText('tBig', fmtTime(Math.ceil(left))); setText('tLabel', mode === 'amrap' ? 'As many rounds as possible' : '5-minute cap');
    const s = Math.ceil(left); if (s === 60 && !p.m1) { p.m1 = 1; Sound.say('One minute left'); }
    if (s <= 3 && s >= 1 && p.beep !== s) { p.beep = s; Sound.tick(); }
    if (left <= 0) { timerDone(p); Sound.done(); Sound.say('Time'); render(); }
    return;
  }
  if (mode === 'circuit' || mode === 'sprints') {
    if (p.resting) {
      const left = (p.resting - Date.now()) / 1000; setText('tLabel', 'Rest'); setText('tBig', fmtTime(Math.ceil(left)));
      const s = Math.ceil(left); if (s <= 3 && s >= 1 && p.beep !== s) { p.beep = s; Sound.tick(); }
      if (left <= 0) { p.resting = 0; Sound.go(); if (mode === 'sprints') Sound.say('Go'); else Sound.say(EX[c.items[0].ex].n); render(); }
    } else { setText('tLabel', mode === 'sprints' ? 'Sprint, then walk back' : 'Work'); setText('tBig', fmtTime(el)); }
  }
};

/* ================================================================== MEDITATION PLAYER */
const MP = { audio: null, id: null, listened: 0, lastT: 0 };
function openMind(id) {
  const date = topDate();
  if (MP.audio && MP.id !== id) { MP.audio.pause(); }
  push('mplayer', { id, date });
}
function openSilent(min) { push('mplayer', { id: 'silent', date: topDate(), silent: min }); }
function lMind(p) {
  const silent = p.id === 'silent', m = silent ? { n: 'Silent sit', sub: p.silent + ' min with bells', min: p.silent, art: 'night' } : D.MIND[p.id], tr = TRACKS[p.id];
  const dur = silent ? p.silent * 60 : tr ? tr.duration : m.min * 60;
  const playing = silent ? !!(p.run && !p.paused) : !!(MP.audio && MP.id === p.id && !MP.audio.paused);
  let h = '<div class="mplayer" data-keep="1"><div class="art art-' + (m.art || 'tide') + '"></div><div class="art" style="background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.05) 40%,rgba(0,0,0,.55))"></div><div class="pw pad">';
  h += '<div class="pbar" style="justify-content:space-between"><button class="icon-btn glass" data-a="mindClose" aria-label="Close">' + ic('close') + '</button><span class="eyebrow" style="color:rgba(255,255,255,.8)">' + esc(({ breath: 'Breathwork', med: 'Meditation', sleep: 'Sleep & recovery', tool: 'Quick tool' })[m.cat] || 'Mind') + '</span><button class="icon-btn glass" data-a="ambient" aria-label="Ocean sound" aria-pressed="' + !!S.settings.ambient + '" style="' + (S.settings.ambient ? '' : 'opacity:.5') + '">' + ic('wave') + '</button></div>';
  h += '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:18px">';
  h += '<div class="orb" id="orb"><div class="o1" id="orbIn"></div><div class="ol" id="orbL">' + (m.breath ? 'Ready' : '') + '</div></div>';
  h += '<div><h1 class="h-xl" style="font-size:46px">' + esc(m.n) + '</h1><div class="small" style="color:rgba(255,255,255,.8);margin-top:6px;font-weight:600">' + Math.round(dur / 60) + ' min · ' + esc(m.sub) + '</div></div>';
  if (m.why) h += '<p class="small" style="color:rgba(255,255,255,.75);max-width:34ch;margin:0">' + esc(m.why) + '</p>';
  h += '</div>';
  h += '<div style="padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))"><input type="range" class="scrub" id="mScrub" min="0" max="' + Math.round(dur) + '" value="0" step="1" data-in="scrub" aria-label="Position"' + (silent ? ' disabled' : '') + '><div class="row small tnum" style="justify-content:space-between;color:rgba(255,255,255,.8)"><span id="mCur">0:00</span><span id="mLeft">-' + fmtTime(dur) + '</span></div>';
  h += '<div class="row" style="justify-content:center;gap:28px;margin-top:14px">' + (silent ? '<span style="width:52px"></span>' : '<button class="icon-btn glass" style="width:52px;height:52px" data-a="mSeek" data-v="-15" aria-label="Back 15 seconds"><span class="small" style="font-weight:700">−15</span></button>') +
    '<button class="playbtn" data-a="mToggle" id="mPlay" aria-label="' + (playing ? 'Pause' : 'Play') + '">' + ic(playing ? 'pause' : 'play') + '</button>' + (silent ? '<span style="width:52px"></span>' : '<button class="icon-btn glass" style="width:52px;height:52px" data-a="mSeek" data-v="15" aria-label="Forward 15 seconds"><span class="small" style="font-weight:700">+15</span></button>') + '</div>';
  if (!silent && !tr) h += '<p class="xs" style="text-align:center;color:rgba(255,255,255,.7);margin-top:10px">Loading audio…</p>';
  h += '</div></div></div>';
  return h;
}
function mindAudio(p) {
  const tr = TRACKS[p.id]; if (!tr) return null;
  if (!MP.audio || MP.id !== p.id) {
    if (MP.audio) { MP.audio.pause(); }
    const a = new Audio(tr.src); a.preload = 'auto';
    a.addEventListener('ended', () => mindFinished(p, true));
    MP.audio = a; MP.id = p.id; MP.listened = 0; MP.lastT = 0;
    try { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: tr.title, artist: 'Fresh Start · Mind' }); navigator.mediaSession.setActionHandler('play', () => { a.play(); render(); }); navigator.mediaSession.setActionHandler('pause', () => { a.pause(); render(); }); } } catch (e) { /* unsupported */ }
  }
  return MP.audio;
}
PA.mToggle = () => {
  const p = topL().p;
  if (p.id === 'silent') {
    if (!p.run) { p.run = { t0: Date.now() }; Sound.bell(); if (S.settings.ambient) Sound.oceanOn(); }
    else if (p.paused) { p.run.t0 += Date.now() - p.paused; p.paused = 0; if (S.settings.ambient) Sound.oceanOn(); }
    else { p.paused = Date.now(); Sound.oceanOff(); }
    render(); return;
  }
  const a = mindAudio(p); if (!a) { toast('Audio is still loading'); return; }
  if (a.paused) { a.play().catch(() => toast('Tap play again to start audio')); if (S.settings.ambient) Sound.oceanOn(); }
  else { a.pause(); Sound.oceanOff(); }
  setTimeout(render, 60);
};
PA.mSeek = (el) => { const a = MP.audio; if (a) a.currentTime = clamp(a.currentTime + +el.dataset.v, 0, a.duration || 1e9); };
PIN.scrub = (el) => { const a = MP.audio; if (a) a.currentTime = +el.value; };
PA.ambient = () => { S.settings.ambient = !S.settings.ambient; touch(); const playing = MP.audio && !MP.audio.paused; if (S.settings.ambient && playing) Sound.oceanOn(); else Sound.oceanOff(); render(); };
PA.mindClose = () => { const p = topL().p; mindFinished(p, false); if (MP.audio) { MP.audio.pause(); } MP.audio = null; MP.id = null; Sound.oceanOff(); pop(); };
function mindMinutes(p) { return p.id === 'silent' ? (p.run ? ((p.paused || Date.now()) - p.run.t0) / 60000 : 0) : (MP.id === p.id ? MP.listened / 60 : 0); }
/* one log entry per sitting, updated as you go, so a practice counts even if iOS closes the app mid-session */
function logMind(p, mins, ended) {
  if (mins < 0.5) return;
  const d = day(p.date); d.mind = d.mind || [];
  let e = p.entryAt ? d.mind.find((x) => x.at === p.entryAt) : null;
  if (!e) { p.entryAt = Date.now(); e = { id: p.id, min: 0, at: p.entryAt }; d.mind.push(e); }
  e.min = Math.round(mins * 10) / 10;
  const P = plan(p.date), m = D.MIND[p.id] || { min: p.silent || 0, cat: 'med' };
  if (ended || mins >= m.min * 0.85) {
    if (p.id === 'sigh5' && !isDone(p.date, 'morning')) setDone(p.date, 'morning', true);
    if ((p.id === P.sit || (m.cat === 'med' && mins >= 10) || (p.id === 'silent' && mins >= 10)) && !isDone(p.date, 'sit')) setDone(p.date, 'sit', true);
  }
  touch(p.date);
}
function mindFinished(p, ended) {
  const mins = mindMinutes(p);
  logMind(p, mins, ended);
  if (ended) { Sound.oceanOff(); toast('Practice logged · ' + Math.round(mins) + ' min'); setTimeout(render, 50); }
}
TICKS.mplayer = (p) => {
  let cur = 0, dur = 1, playing = false;
  if (p.id === 'silent') {
    dur = p.silent * 60;
    if (p.run) { cur = ((p.paused || Date.now()) - p.run.t0) / 1000; playing = !p.paused; }
    if (p.run && cur >= dur && !p.ended) { p.ended = true; Sound.bell(); setTimeout(() => Sound.bell(), 2500); mindFinished(p, true); }
  } else {
    const a = MP.audio && MP.id === p.id ? MP.audio : null, tr = TRACKS[p.id];
    if (!tr) { if (Object.keys(TRACKS).length) return; return; }
    dur = tr.duration;
    if (a) { cur = a.currentTime; playing = !a.paused; if (playing) { const dt = cur - MP.lastT; if (dt > 0 && dt < 1.5) MP.listened += dt; } MP.lastT = cur; }
    // breath pacer
    const orb = document.getElementById('orbIn'), lab = document.getElementById('orbL');
    if (orb && tr.phases && tr.phases.length) {
      const ph = tr.phases.slice().reverse().find((x) => x[0] <= cur);
      if (ph && cur < ph[0] + ph[2] + 0.5) {
        const f = clamp((cur - ph[0]) / ph[2], 0, 1);
        const sc = ph[1] === 'in' ? 0.55 + 0.35 * ease(f) : ph[1] === 'top' ? 0.9 + 0.1 * ease(f) : ph[1] === 'out' ? 1 - 0.45 * ease(f) : ph[1] === 'hold' ? 0.9 : 0.55;
        orb.style.transform = 'scale(' + sc.toFixed(3) + ')';
        if (lab) lab.textContent = ({ in: 'In', top: 'Top up', out: 'Out', hold: 'Hold', hold2: 'Hold' })[ph[1]];
      } else if (lab) { lab.textContent = playing ? '' : 'Ready'; orb.style.transform = 'scale(.6)'; }
    } else if (orb) {
      const t = performance.now() / 1000, f = playing ? (Math.sin(t * 2 * Math.PI / 11) + 1) / 2 : 0.2;
      orb.style.transform = 'scale(' + (0.6 + 0.3 * f).toFixed(3) + ')';
    }
  }
  setText('mCur', fmtTime(cur)); setText('mLeft', '-' + fmtTime(dur - cur));
  if (playing) { const mins = mindMinutes(p); if (mins - (p.lastLogged || 0) >= 0.25) { p.lastLogged = mins; logMind(p, mins, false); } }
  const sc = document.getElementById('mScrub'); if (sc && document.activeElement !== sc) sc.value = String(Math.round(cur));
};

/* ================================================================== QUIZ */
function lQuiz(p) {
  const Q = D[p.k];
  let h = '<div class="layer"><div class="wrap"><div class="lbar pad solid"><button class="icon-btn" data-a="pop" aria-label="Back">' + ic('back') + '</button><div class="h-sm">' + Q.n + '</div><span style="width:44px"></span></div><div class="pad">';
  if (p.result != null) {
    const band = Q.band(p.result);
    h += '<div class="card" style="text-align:center;margin-top:10px"><div class="eyebrow">' + esc(Q.full) + '</div><div class="big-num tnum" style="margin-top:10px">' + p.result + '</div><div class="h-md" style="margin-top:6px;color:var(--mind)">' + esc(band) + '</div></div>';
    if (p.k === 'GAD7' && p.result >= 10) h += '<div style="margin-top:12px">' + bannerHTML('warn', 'A score of 10 or more, or anxiety that disrupts work or sleep for 2+ weeks, is worth raising with your doctor or a therapist. Meditation works alongside care, not instead of it.') + '</div>';
    h += '<p class="small fg2" style="margin-top:12px">Retake in Weeks 1, 6 and 12 to see the trend. Results stay private to you.</p><button class="btn mind block" style="margin-top:12px" data-a="pop">Done</button>';
    return h + '</div></div></div>';
  }
  h += '<h1 class="h-lg" style="margin-top:8px">' + esc(Q.full) + '</h1><p class="small fg2" style="margin:6px 0 14px">' + esc(Q.lead) + '</p><div class="stack">';
  Q.q.forEach((q, i) => {
    h += '<div class="card"><div style="font-weight:600">' + (i + 1) + '. ' + esc(q.charAt(0).toUpperCase() + q.slice(1)) + '</div><div class="stack" style="gap:6px;margin-top:10px">' + Q.scale.map((s, v) => '<button class="chip' + (p.a[i] === v ? ' mind' : '') + '" style="height:38px;justify-content:flex-start;font-size:14px;width:100%" data-a="quizAns" data-q="' + i + '" data-v="' + v + '">' + esc(s) + '</button>').join('') + '</div></div>';
  });
  const n = p.a.filter((x) => x != null).length;
  return h + '</div><button class="btn mind block" style="margin-top:14px" data-a="quizSubmit"' + (n < Q.q.length ? ' disabled' : '') + '>' + (n < Q.q.length ? (Q.q.length - n) + ' to go' : 'See my score') + '</button></div></div></div>';
}
PA.quizAns = (el) => { const p = topL().p; p.a[+el.dataset.q] = +el.dataset.v; render(); };
PA.quizSubmit = () => {
  const p = topL().p, Q = D[p.k], max = Q.scale.length - 1;
  const score = p.a.reduce((s, v, i) => s + (Q.reverse.includes(i) ? max - v : v), 0);
  S.quiz.push({ k: p.k, date: todayISO(), score, a: p.a.slice() }); touch();
  p.result = score; render();
};
