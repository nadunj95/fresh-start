/* Views: tabs, layers (workout overview, info), sheets, and the click/input wiring. */
'use strict';

let TRACKS = {};
const A = {}; // actions

/* ------------------------------------------------------------------ render loop */
let renderedLayers = 0;
function render() {
  const app = $('#app');
  const winY = window.scrollY;
  const scrolls = $$('.layer').map((l) => layerScroller(l).scrollTop);
  app.innerHTML = '<main class="screen">' + ({ today: vToday, train: vTrain, fuel: vFuel, mind: vMind, progress: vProgress }[ui.tab])() + '</main>' + tabbar();
  let layers = $('#layers');
  if (!layers) { layers = document.createElement('div'); layers.id = 'layers'; document.body.appendChild(layers); }
  layers.innerHTML = ui.stack.map((l, i) => renderLayer(l, i)).join('');
  $$('.layer', layers).forEach((l, i) => { if (i < renderedLayers) l.classList.add('noanim'); if (scrolls[i] != null && i < renderedLayers) layerScroller(l).scrollTop = scrolls[i]; });
  $$('.player, .mplayer', layers).forEach((l, i) => { if (i < renderedLayers - 1 || l.dataset.keep) l.style.animation = 'none'; });
  renderedLayers = ui.stack.length;
  let sh = $('#sheet');
  if (!sh) { sh = document.createElement('div'); sh.id = 'sheet'; document.body.appendChild(sh); }
  const prevSheet = sh.dataset.k, k = ui.sheet ? ui.sheet.v + JSON.stringify(ui.sheet.p || {}) : '';
  const sheetScroll = $('.sheet', sh) ? $('.sheet', sh).scrollTop : 0;
  sh.innerHTML = ui.sheet ? '<div class="scrim" data-a="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="in pad"><div class="grab"></div>' + renderSheet(ui.sheet) + '</div></div>' : '';
  if (ui.sheet && prevSheet === k) { const s = $('.sheet', sh); s.style.animation = 'none'; $('.scrim', sh).style.animation = 'none'; s.scrollTop = sheetScroll; }
  sh.dataset.k = k;
  document.body.style.overflow = ui.stack.length || ui.sheet ? 'hidden' : '';
  if (!ui.stack.length) window.scrollTo(0, winY);
  afterRender();
}
/* pushed screens scroll inside their .wrap; the .layer shell stays still so pinned bars stay pinned */
function layerScroller(l) { return (l && l.querySelector(':scope > .wrap')) || l; }
function afterRender() { if (typeof playerAfterRender === 'function') playerAfterRender(); }
function tabbar() {
  const T = [['today', 'Today'], ['train', 'Train'], ['fuel', 'Fuel'], ['mind', 'Mind'], ['progress', 'Progress']];
  return '<nav class="tabbar" aria-label="Sections"><div class="in">' + T.map(([id, n]) =>
    '<button class="tab t-' + id + (ui.tab === id ? ' on' : '') + '" data-a="tab" data-v="' + id + '" aria-current="' + (ui.tab === id) + '">' + ic(id) + n + '</button>').join('') + '</div></nav>';
}
function push(v, p) { ui.stack.push({ v, p: p || {} }); render(); }
function pop() { const l = ui.stack.pop(); if (l && l.onClose) l.onClose(); renderedLayers = ui.stack.length; render(); }
function openSheet(v, p) { ui.sheet = { v, p: p || {} }; render(); }
function closeSheet() { ui.sheet = null; render(); }

function renderLayer(l, i) {
  const V = { workout: lWorkout, routineInfo: null, player: lPlayer, routine: lRoutine, timer: lTimer, mplayer: lMind, done: lDone, quiz: lQuiz, settings: lSettings, rules: lRules, health: lHealth };
  return (V[l.v] || (() => ''))(l.p, i, l);
}

/* ------------------------------------------------------------------ shared bits */
function topHeader(eyebrow, title, right) {
  return '<div class="navbar" aria-hidden="true"><span>' + title + '</span></div><header class="top pad"><div class="grow"><div class="eyebrow">' + eyebrow + '</div><h1 class="h-xl" style="margin-top:2px">' + title + '</h1></div>' + (right || '') + '</header>';
}
function avatarBtn() { return '<button class="avatar" data-a="push" data-v="settings" aria-label="Settings">' + esc((S.settings.name || 'N')[0]) + '</button>'; }
function ringSVG(frac, size, stroke, color, track) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = clamp(frac || 0, 0, 1);
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (track || 'var(--card-3)') + '" stroke-width="' + stroke + '"/>' +
    (f > 0 ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '"/>' : '') + '</svg>';
}
function strip(date, tone) {
  const mon = mondayOf(date), t = todayISO();
  let s = '<div class="wk-nav"><button data-a="wk" data-v="-7">' + ic('prev').replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"') + ' Prev week</button><div class="eyebrow">' + fmtShort(mon) + ' – ' + fmtShort(addDays(mon, 6)) + '</div><button data-a="wk" data-v="7">Next week ' + ic('next').replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"') + '</button></div><div class="strip">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), prog = dayProgress(d);
    s += '<button class="dpill' + (d === date ? ' sel' : '') + (d === t ? ' today' : '') + '" data-a="date" data-v="' + d + '" aria-label="' + fmtD(d) + '"><span class="dl">' + DOW[i][0] + '</span><span class="ring">' + ringSVG(prog, 34, 3, prog >= 1 ? 'var(--good)' : (tone || 'var(--train)')) + '<span class="num tnum">' + pISO(d).getDate() + '</span></span></button>';
  }
  return s + '</div>';
}
function bannerHTML(tone, html, action) {
  return '<div class="banner ' + (tone || '') + '"' + (action ? ' role="button" tabindex="0" data-a="' + action.a + '" data-v="' + (action.v || '') + '"' : '') + '><span class="bi"></span><div class="grow small fg2">' + html + '</div></div>';
}
function checkBtn(on, a, v, label) {
  return '<button class="check' + (on ? ' on' : '') + '" data-a="' + a + '" data-v="' + esc(v) + '" aria-pressed="' + !!on + '" aria-label="' + esc(label || 'Mark done') + '">' + (on ? ic('check') : '') + '</button>';
}
function mindArt(id) { const m = D.MIND[id] || {}; return 'art-' + (m.art || 'tide'); }

/* ------------------------------------------------------------------ TODAY */
function checklist(date) {
  const P = plan(date), d = peek(date), rows = [];
  const dn = (k) => isDone(date, k);
  rows.push({ key: 'morning', t: 'Morning light + cyclic sighing', s: '5 min · outside within an hour of waking', ic: 'sun', a: 'mind', v: 'sigh5', tone: 'mind' });
  rows.push({ key: 'armor', t: P.armorWed ? 'Full Armor + hip add-on' : 'Armor', s: (P.armorWed ? '17' : '12') + ' min · neck, back and groin insurance', ic: 'shield', a: 'routine', v: 'armor' });
  rows.push({ key: 'deepcore', t: 'Deep Core', s: '4 min · inner abs, before food if you can', ic: 'core', a: 'routine', v: 'deepcore' });
  P.sessions.forEach((s) => {
    if (s.type === 'rest' && s.sid !== 'kickoff') return;
    rows.push({ key: 's:' + s.sid, t: s.title + (s.optional ? ' (optional)' : ''), s: [s.dur, s.sub].filter(Boolean).join(' · '), thumb: s.hero, a: 'workout', v: s.sid, session: true, optional: s.optional });
  });
  if (P.core) { const f = D.CORE_FMT[Math.max(1, Math.min(13, P.week))] || D.CORE_FMT[1]; rows.push({ key: 'core', t: 'Core finisher · Core ' + P.core, s: Math.round((f[0] + f[1]) * 5 * f[2] / 60) + ' min · after the session', ic: 'core', a: 'core', v: P.core }); }
  rows.push({ key: 'sit', t: (D.MIND[P.sit] || {}).n + ' meditation', s: (D.MIND[P.sit] || {}).min + ' min · after the shake, before the laptop', ic: 'mind', a: 'mind', v: P.sit, tone: 'mind' });
  if (P.walk) rows.push({ key: 'walk', t: P.walk, s: 'Nose breathing. Daily steps 9,000–11,000' + hkStepsNote(date), ic: 'walk', a: 'toggle', v: 'walk' });
  const tt = totals(date);
  rows.push({ key: 'protein', t: 'Protein ' + targets(date).p[0] + ' g+', s: Math.round(tt.p) + ' g logged', ic: 'egg', a: 'tab', v: 'fuel', auto: tt.p >= targets(date).p[0], tone: 'fuel' });
  rows.push({ key: 'snack', t: 'Evening protein snack', s: '30–45 g, 1–2 h before bed', ic: 'egg', a: 'logSnack', v: '', auto: mealsFor(date).some((m) => m.slot === 'snack'), tone: 'fuel' });
  if (P.sunday && P.week >= 0) rows.push({ key: 'reset', t: 'Sunday Reset', s: '15 min · the weekly check', ic: 'list', a: 'sheet', v: 'sunday' });
  const g = (d.grat || []).filter((x) => x && x.trim()).length;
  rows.push({ key: 'grat', t: '3 good things', s: g ? g + ' of 3 written' : 'Before bed, 2 min', ic: 'pen', a: 'sheet', v: 'journal', auto: g >= 3, tone: 'mind' });
  return rows.map((r) => Object.assign(r, { done: r.auto != null ? r.auto : dn(r.key) }));
}
function dayProgress(date) {
  if (date > todayISO() && !Object.keys(peek(date)).length) return 0;
  const rows = checklist(date).filter((r) => !r.optional);
  return rows.length ? rows.filter((r) => r.done).length / rows.length : 0;
}

function vToday() {
  const date = ui.date, P = plan(date), d = peek(date), t = todayISO();
  const eyebrow = P.week === 0 ? 'Kickoff · Week 1 starts ' + fmtShort(D.START) : P.week > 13 ? (date === FLY_DATE ? 'Travel day' : 'Sri Lanka · Never Zero') : 'Week ' + P.week + ' · ' + P.phase.name;
  let h = topHeader(esc(eyebrow), date === t ? 'Today' : esc(fmtD(date)), avatarBtn());
  h += '<div class="pad">' + strip(date) + '</div>';

  // banners
  const bn = [];
  P.notes.forEach((n) => bn.push(bannerHTML(n.tone, esc(n.t))));
  if (date === t && missedTwice(date)) bn.push(bannerHTML('bad', '<b>Never miss twice.</b> Two sessions missed in a row. Shrink the plan instead of stopping: do the 30-minute Minimum session today.', { a: 'workoutMin', v: 'minA' }));
  if (saveError) bn.push(bannerHTML('bad', '<b>This phone refused to save.</b> Storage may be full. Save a backup now from Settings.', { a: 'push', v: 'settings' }));
  const gap = lastTrainedGap(date);
  if (date === t && gap != null && gap > 7) bn.push(bannerHTML('warn', 'Back after ' + gap + ' days off: restart at last week’s loads minus 10%. Suggested weights already include it.'));
  if (date === t && [1, 6, 12].includes(P.week) && !quizDone(P.week)) bn.push(bannerHTML('mind', 'Week ' + P.week + ' check-in: take the PSS-10 and GAD-7 (under 5 minutes each).', { a: 'tab', v: 'mind' }));
  if (P.sunday && date <= t && P.week >= 2) { const c = calibration(date); if (c.rate != null) bn.push(bannerHTML(c.tone, '<b>Calibration:</b> ' + (c.rate >= 0 ? '−' : '+') + Math.abs(c.rate).toFixed(1) + ' lb this week. ' + esc(c.rec))); }
  if (bn.length) h += '<div class="pad stack section" style="margin-top:18px">' + bn.join('') + '</div>';

  // hero session, then readiness
  const ms = mainSession(P);
  if (ms) h += '<div class="pad section" style="margin-top:18px">' + sessionHero(ms, date) + '</div>';
  h += '<div class="pad" style="margin-top:10px">' + (hkConnected() ? recoveryCard(date) : (date === t ? hkConnectRow() : '') + (readiness(date) || ui.editReady ? readinessCard(date) :
    '<button class="card row" style="width:100%;text-align:left;gap:12px" data-a="sheet" data-v="ready"><span style="width:32px;height:32px;border-radius:8px;background:var(--bad);color:#fff;display:grid;place-items:center;flex:none">' + ic('shield').replace('<svg', '<svg width="19" height="19"') + '</span><span class="grow"><span style="font-weight:600;display:block">30-second readiness check</span><span class="small muted">Sleep, neck, back. Sets today’s volume</span></span><span class="btn sm ghost">Check in</span></button>')) + '</div>';
  P.sessions.filter((s) => s !== ms).forEach((s) => { h += '<div class="pad" style="margin-top:10px">' + sessionHero(s, date, true) + '</div>'; });

  h += '<div class="pad" style="margin-top:12px">' + ringsCard(date) + '</div>';

  // your day
  const rows = checklist(date);
  const doneN = rows.filter((r) => r.done && !r.optional).length, totN = rows.filter((r) => !r.optional).length;
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Your day</h2><span class="small muted tnum">' + doneN + ' of ' + totN + ' done</span></div><div class="list">';
  rows.forEach((r) => {
    const lead = r.thumb ? exThumb(r.thumb, 40) : '<span class="ico" style="color:' + (r.tone ? 'var(--' + r.tone + ')' : 'var(--train)') + '">' + ic(r.ic) + '</span>';
    h += '<div class="li' + (r.done ? ' done' : '') + '"><button class="row grow" style="gap:14px;text-align:left" data-a="' + r.a + '" data-v="' + esc(r.v) + '">' + lead + '<span class="grow"><span class="t" style="display:block">' + esc(r.t) + '</span><span class="s" style="display:block">' + esc(r.s) + '</span></span></button>' +
      (r.auto != null ? '<span class="check' + (r.done ? ' on' : '') + '" aria-label="' + (r.done ? 'Done' : 'Not yet') + '">' + (r.done ? ic('check') : '') + '</span>' : checkBtn(r.done, 'tick', r.key, r.t)) + '</div>';
  });
  h += '</div>';
  if (dowOf(date) < 5 && P.week >= 0) {
    const n = d.desk || 0;
    h += '<div class="card row" style="margin-top:10px"><span style="width:32px;height:32px;border-radius:8px;background:var(--train);color:#fff;display:grid;place-items:center;flex:none">' + ic('desk').replace('<svg', '<svg width="19" height="19"') + '</span><button class="grow" style="text-align:left" data-a="routine" data-v="desk"><div style="font-weight:600">Desk resets</div><div class="small muted">Every 60 min: chin tucks, blades down, doorway stretch, stand</div></button><div class="row" style="gap:6px"><button class="icon-btn" style="width:36px;height:36px" data-a="desk" data-v="-1" aria-label="One fewer">' + ic('minus') + '</button><span class="h-md tnum" style="min-width:22px;text-align:center">' + n + '</span><button class="icon-btn" style="width:36px;height:36px" data-a="desk" data-v="1" aria-label="One more">' + ic('plus') + '</button></div></div>';
  }
  h += '</section>';

  // fuel snapshot
  const tg = targets(date), tt = totals(date);
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Fuel</h2><button class="link" data-a="tab" data-v="fuel">Open</button></div><div class="card row" style="gap:16px">' +
    '<div class="bigring" style="width:96px;height:96px">' + ringSVG(tt.kcal / tg.kcal, 96, 9, 'var(--fuel)') + '<div class="c"><div class="h-md tnum">' + fmtN(tt.kcal) + '</div><div class="xs muted">of ' + fmtN(tg.kcal) + '</div></div></div>' +
    '<div class="grow"><div class="row" style="justify-content:space-between"><span class="small fg2">Protein</span><span class="small tnum"><b>' + Math.round(tt.p) + '</b> / ' + tg.p[0] + ' g</span></div><div class="bar" style="margin-top:6px"><i style="width:' + clamp(tt.p / tg.p[0] * 100, 0, 100) + '%;background:var(--fuel)"></i></div>' +
    '<div class="row" style="justify-content:space-between;margin-top:10px"><span class="small fg2">Water</span><span class="small tnum"><b>' + ((d.water || 0) * 0.5).toFixed(1) + '</b> / 4 L</span></div><div class="bar" style="margin-top:6px"><i style="width:' + clamp((d.water || 0) / 8 * 100, 0, 100) + '%;background:var(--mind)"></i></div>' +
    '<button class="btn fuel sm" style="margin-top:12px" data-a="tab" data-v="fuel">Log meals</button></div></div></section>';

  // mind card
  const m = D.MIND[P.sit];
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Mind</h2><button class="link" data-a="tab" data-v="mind">Open</button></div>' + mindTile(P.sit, 'Today’s practice', isDone(date, 'sit')) + '</section>';
  return h;
}

function ringsCard(date) {
  const P = plan(date), rows = checklist(date).filter((r) => !r.optional);
  const tr = rows.filter((r) => r.session || ['armor', 'deepcore', 'core'].includes(r.key)), trD = tr.filter((r) => r.done).length;
  const prot = totals(date).p, mm = (peek(date).mind || []).reduce((a, x) => a + (x.min || 0), 0), mT = ((D.MIND[P.sit] || {}).min || 10) + 5;
  const R = [[trD / Math.max(1, tr.length), 'var(--train)'], [prot / targets(date).p[0], 'var(--fuel)'], [mm / mT, 'var(--mind)']];
  let svg = '<svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true">';
  R.forEach(([f, c], i) => {
    const r = 47 - i * 13, C = 2 * Math.PI * r, len = C * clamp(f, 0, 1);
    svg += '<circle cx="54" cy="54" r="' + r + '" fill="none" stroke="' + c + '" stroke-opacity=".22" stroke-width="11"/>';
    if (len > 0.5) svg += '<circle cx="54" cy="54" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + len.toFixed(1) + ' ' + C.toFixed(1) + '"/>';
  });
  svg += '</svg>';
  const L = (n, c, v, t, u) => '<div><span style="color:' + c + '">' + n + '</span><div><b class="tnum">' + v + '</b><span class="muted" style="font-weight:500"> / ' + t + (u ? ' ' + u : '') + '</span></div></div>';
  return '<div class="card rings" role="img" aria-label="Train ' + trD + ' of ' + tr.length + ', protein ' + Math.round(prot) + ' of ' + targets(date).p[0] + ' grams, mind ' + Math.round(mm) + ' of ' + mT + ' minutes">' + svg + '<div class="lg grow">' +
    L('Train', 'var(--train)', trD, tr.length, '') + L('Protein', 'var(--fuel)', Math.round(prot), 200, 'g') + L('Mind', 'var(--mind)', Math.round(mm), mT, 'min') + '</div></div>';
}
function readinessCard(date) {
  const r = readiness(date), c = peek(date).chk || {};
  if (r && !ui.editReady) {
    const tx = dayTier(date) === 'push' ? PUSH_TXT.push : READY_TXT[r], tone = r === 'green' ? 'good' : r === 'yellow' ? 'warn' : 'bad';
    return '<div class="card row" style="gap:12px"><span class="chip ' + tone + '" style="height:30px;font-size:13px">' + tx[0] + '</span><div class="grow small fg2">' + tx[1] + (c.arm ? ' Arm symptoms: stop any exercise that brings on tingling.' : '') + '</div><button class="small" style="color:var(--fg-2);font-weight:600" data-a="editReady">Edit</button></div>';
  }
  return '<div class="card"><div class="row" style="justify-content:space-between"><h3 class="h-sm">30-second readiness check</h3>' + (r ? '<button class="small" style="color:var(--fg-2);font-weight:600" data-a="editReady">Done</button>' : '') + '</div>' + readinessForm(date) + '</div>';
}
function tierBanner(date) {
  const r = readiness(date), t = dayTier(date);
  if (t === 'push') return bannerHTML('good', '<b>Push:</b> ' + PUSH_TXT.push[1]);
  return bannerHTML(({ green: 'good', yellow: 'warn', red: 'bad' })[r], '<b>' + READY_TXT[r][0] + ':</b> ' + READY_TXT[r][1]);
}
function readinessForm(date) {
  const c = peek(date).chk || {}, hs = sleepH(date);
  const sleepRow = hs != null && c.sleep == null && !ui.sleepManual
    ? '<div><span class="lbl">Sleep last night</span><div class="row" style="justify-content:space-between;gap:10px;min-height:34px"><span class="small fg2"><b class="tnum" style="color:var(--fg)">' + fmtHM(hs) + '</b> asleep · Apple Health</span><button class="small" style="color:var(--fg-2);font-weight:600" data-a="sleepManual">Enter by hand</button></div></div>'
    : '<div><span class="lbl">Sleep last night</span><div class="seg">' + [[4, 'Under 5 h'], [6, '5–7 h'], [8, '7 h +']].map(([v, l]) => '<button class="' + (c.sleep === v ? 'on' : '') + '" data-a="chk" data-k="sleep" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
      (hs != null ? '<button class="xs" style="color:var(--link);font-weight:600;margin-top:6px" data-a="chkClr" data-k="sleep">Use Apple Health instead (' + fmtHM(hs) + ')</button>' : '') + '</div>';
  return '<div class="stack" style="margin-top:12px">' + sleepRow +
    scaleRow('Neck (0–10)', 'neck', c.neck) + scaleRow('Low back, morning (0–10)', 'back', c.back) +
    '<div class="row" style="gap:8px;flex-wrap:wrap">' + [['arm', 'Arm tingling'], ['sore', 'Heavy soreness'], ['sick', 'Sick']].map(([k, l]) => '<button class="chip' + (c[k] ? ' bad' : '') + '" style="height:34px" data-a="chkT" data-k="' + k + '">' + l + '</button>').join('') + '</div></div>';
}
function scaleRow(label, key, val, max = 10) {
  let s = '<div><span class="lbl">' + label + '</span><div class="scale" style="grid-template-columns:repeat(' + (max + 1) + ',1fr)">';
  for (let i = 0; i <= max; i++) { const tone = i <= 2 ? 'g' : i <= 4 ? 'y' : 'r'; s += '<button class="' + (val === i ? 'on ' + tone : '') + '" data-a="chk" data-k="' + key + '" data-v="' + i + '">' + i + '</button>'; }
  return s + '</div></div>';
}
function sessionHero(s, date, compact) {
  const done = sessionDone(date, s.sid), img = heroImg(s.hero) || heroImg('walk');
  const meta = [s.dur, s.type === 'lift' && s.src ? s.src.items.length + ' exercises' : ''].filter(Boolean);
  const cta = done ? '<span class="chip good" style="height:32px;font-size:13px">' + ic('check').replace('<svg', '<svg width="14" height="14"') + ' Completed</span>' : '<span class="btn train sm">' + (s.type === 'rest' || s.type === 'recovery' || s.type === 'travel' ? 'Open' : Object.keys(peek(date).sets || {}).some((k) => k.startsWith(s.sid + '|')) ? 'Resume' : 'Start') + '</span>';
  return '<button class="hero' + (done ? ' done' : '') + '" style="min-height:' + (compact ? 190 : 300) + 'px" data-a="workout" data-v="' + s.sid + '">' + (img ? '<img class="bg" src="' + img + '" alt="">' : '') +
    '<span class="badge chip ' + (s.type === 'rest' ? '' : 'train') + '" style="background:rgba(11,12,14,.6)">' + esc(({ lift: 'Strength', hiit: 'HIIT', cardio: 'Cardio', recovery: 'Recovery', rest: 'Rest day', travel: 'Travel' })[s.type] || '') + '</span>' +
    '<span class="in"><span class="eyebrow" style="color:var(--fg-2)">' + esc(s.sub || '') + '</span><span class="' + (compact ? 'h-lg' : 'h-xl') + '">' + esc(s.title) + '</span><span class="row" style="justify-content:space-between;margin-top:4px"><span class="meta">' + meta.map(esc).join('<span>·</span>') + '</span>' + cta + '</span></span></button>';
}
function mindTile(id, eyebrow, done) {
  const m = D.MIND[id] || {};
  return '<button class="mtile ' + mindArt(id) + '" data-a="mind" data-v="' + id + '"><span class="shine"></span><span class="eyebrow" style="color:rgba(255,255,255,.75)">' + esc(eyebrow) + '</span><span class="h-lg" style="margin-top:4px">' + esc(m.n) + '</span><span class="row" style="justify-content:space-between;margin-top:8px"><span class="small" style="color:rgba(255,255,255,.85);font-weight:600">' + m.min + ' min · ' + esc(m.sub) + '</span>' +
    (done ? '<span class="chip good" style="background:rgba(0,0,0,.35)">Done</span>' : '<span class="icon-btn" style="background:#fff;color:#111">' + ic('play') + '</span>') + '</span></button>';
}

/* ------------------------------------------------------------------ TRAIN */
function vTrain() {
  const t = todayISO(), cw = clamp(weekOf(t), 1, 13), w = ui.trainWeek || cw;
  const ph = phaseOf(w), info = D.WEEKS[w] || {};
  let h = topHeader('Fresh Start 2.0 · The Sri Lanka Cut', 'Train', avatarBtn());
  h += '<div class="pad"><div class="phase-bar" role="tablist" aria-label="Weeks">';
  for (let i = 1; i <= 13; i++) h += '<button class="' + (i < cw ? 'past' : '') + (i === cw && weekOf(t) >= 1 ? ' cur' : '') + (i === w ? ' sel' : '') + '" data-a="trainWeek" data-v="' + i + '" aria-label="Week ' + i + '">' + i + '</button>';
  h += '</div><div class="row" style="justify-content:space-between;margin-top:14px;align-items:flex-start"><div><div class="eyebrow">Phase ' + Math.min(ph.n, 4) + ' · ' + fmtShort(weekStart(w)) + ' – ' + fmtShort(addDays(weekStart(w), 6)) + '</div><h2 class="h-lg" style="margin-top:4px">Week ' + w + ' · ' + esc(ph.name) + '</h2><p class="small fg2" style="margin:6px 0 0">' + esc(info.focus || '') + (info.event ? ' · <span style="color:var(--warn)">' + esc(info.event) + '</span>' : '') + '</p></div><span class="chip train">RIR ' + esc(info.rir || '') + '</span></div></div>';

  h += '<section class="pad section"><div class="list">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart(w), i), P = plan(d), s = mainSession(P);
    const done = s && sessionDone(d, s.sid);
    h += '<button class="li" data-a="openDay" data-v="' + d + '">' + (s ? exThumb(s.hero, 52) : '<span class="thumb"></span>') +
      '<span class="grow"><span class="eyebrow" style="display:block;font-size:12px">' + DOW[i] + ' ' + pISO(d).getDate() + (d === t ? ' · Today' : '') + '</span><span class="t" style="display:block">' + esc(s ? s.title : 'Rest') + '</span><span class="s" style="display:block">' + esc(s ? [s.dur, s.sub].filter(Boolean).join(' · ') : '') + '</span></span>' +
      '<span class="check' + (done ? ' on' : '') + '">' + (done ? ic('check') : '') + '</span></button>';
  }
  h += '</div></section>';

  h += '<section class="section"><div class="sec-h pad"><h2 class="h-md">Daily routines</h2></div><div class="rail pad">' +
    [['armor', 'Armor', '10 min · every morning'], ['deepcore', 'Deep Core', '4 min · every morning'], ['ramp_pull', 'Rehab Ramp · Pull', '8 min · before lifting'], ['ramp_push', 'Rehab Ramp · Push', '8 min · before lifting'], ['ramp_legs', 'Rehab Ramp · Legs', '8 min · before lifting'], ['armorWed', 'Hip add-on', '5 min · Wednesdays'], ['desk', 'Desk reset', '2 min · every 60 min']]
      .map(([id, n, sub]) => routineTile(id, n, sub)).join('') + '</div></section>';

  const cp = w <= 2 ? 1 : w <= 6 ? 2 : 3, f = D.CORE_FMT[w];
  h += '<section class="section"><div class="sec-h pad"><h2 class="h-md">Core finishers</h2><span class="small muted">' + f[0] + ' s on / ' + f[1] + ' s off · ' + f[2] + (f[2] > 1 ? ' rounds' : ' round') + '</span></div><div class="rail pad">' +
    ['A', 'B', 'C'].map((k) => '<button class="tile wide" data-a="core" data-v="' + k + '" data-w="' + w + '"><div class="art">' + (EX[D.CORE[cp][k][0]].img ? '<img src="' + heroImg(D.CORE[cp][k][0]) + '" alt="">' : '') + '</div><div class="tx"><div class="tt">' + esc(D.CORE_NAMES[k]) + '</div><div class="ts">' + ['Mon', 'Tue', 'Thu'][['A', 'B', 'C'].indexOf(k)] + ' · ' + D.CORE[cp][k].map((e) => EX[e].n.split(',')[0]).slice(0, 3).map(esc).join(', ') + '…</div></div></button>').join('') + '</div></section>';

  h += '<section class="section"><div class="sec-h pad"><h2 class="h-md">Minimum Viable Week</h2><span class="small muted">Busy, travelling, run-down</span></div><div class="pad stack">' +
    ['minA', 'minB'].map((k) => '<button class="li card" style="padding:12px" data-a="workoutMin" data-v="' + k + '">' + exThumb(D.MIN[k].hero, 52) + '<span class="grow"><span class="t" style="display:block">' + D.MIN[k].title + '</span><span class="s" style="display:block">30 min full body · plus daily Armor, 3 walks and the protein target</span></span>' + ic('next').replace('<svg', '<svg width="18" height="18"') + '</button>').join('') + '</div></section>';

  h += '<section class="section pad"><div class="sec-h"><h2 class="h-md">The rules</h2></div><button class="li card" style="padding:14px" data-a="push" data-v="rules"><span class="ico" style="color:var(--train)">' + ic('shield') + '</span><span class="grow"><span class="t" style="display:block">Progression, pain, readiness and gates</span><span class="s" style="display:block">Read once, apply every session</span></span>' + ic('next').replace('<svg', '<svg width="18" height="18"') + '</button></section>';
  return h;
}
function routineTile(id, n, sub) {
  const r = D.ROUTINES[id];
  return '<button class="tile" data-a="routine" data-v="' + id + '"><div class="art">' + (EX[r.hero].img ? '<img src="' + heroImg(r.hero) + '" alt="">' : '<div class="figbox" style="height:100%">' + figSVG(EX[r.hero].fig, false) + '</div>') + '</div><div class="tx"><div class="tt">' + esc(n) + '</div><div class="ts">' + esc(sub) + '</div></div></button>';
}

/* rules layer */
function lRules() {
  let h = '<div class="layer"><div class="wrap"><div class="lbar pad solid"><button class="icon-btn" data-a="pop" aria-label="Back">' + ic('back') + '</button><div class="h-sm">The rules</div><span style="width:44px"></span></div><div class="pad stack" style="margin-top:8px">';
  const fold = (t, items, open) => '<details class="fold"' + (open ? ' open' : '') + '><summary>' + t + '</summary><div class="fb"><ul>' + items.map((x) => '<li>' + x + '</li>').join('') + '</ul></div></details>';
  h += fold('Progression and effort', ['<b>Main lifts: top set + back-offs.</b> Hit the top of the range at the target RIR → add 5 lb (upper) or 10 lb (lower) next week. Back-offs 10–15% lighter.', '<b>Accessories: double progression.</b> Top of the rep range on all sets → add weight.', '<b>Effort:</b> Phase 1 RIR 3 (Wk 1), RIR 2 (Wk 2). Phase 2 compounds RIR 1–2, last isolation set RIR 0–1. Phases 3–4 compounds RIR 1, last isolation set to failure.', '<b>Rest:</b> compounds 2 min (90 s in Phase 3), supersets 45–60 s, tri-sets and finishers 30–45 s. Use the timer, every set.', 'Strength rises in Weeks 1–6 and holds in Weeks 7–12. Holding strength in a deficit means you are keeping muscle.'], true);
  h += fold('Pain traffic light', ['0–2/10: train.', '3–5/10: reduce load or range, or swap the exercise.', 'Above 5, or worse the next morning: drop that movement for the week, keep the rest.', '<b>Any tingling down the arm during a set: stop that exercise for the day, whatever the score.</b>']);
  h += fold('Readiness check', ['<b style="color:var(--good)">Green</b> (slept 7+ h, neck ≤2, feeling good): full session.', '<b style="color:var(--warn)">Yellow</b> (5–7 h sleep, neck 3–4, or heavy soreness): one set fewer per exercise, skip the finisher.', '<b style="color:var(--bad)">Red</b> (under 5 h, neck 5+, arm symptoms, or sick): Armor + walk, or the 30-minute Minimum session.']);
  h += fold('Gates', D.GATES.map((g) => '<b>' + g.n + '</b> (from Week ' + g.from + '): opens when ' + g.rule.toLowerCase() + '. Then: ' + g.then + '.'));
  h += fold('Intensity techniques', D.TECHNIQUES.map(([a, b]) => '<b>' + a + ':</b> ' + b));
  h += fold('Swapped until the MRI', D.SWAPPED.map(([a, b]) => a + ' → ' + b));
  h += fold('Never Zero', ['Never miss twice. One missed session is noise; two in a row is a trend.', 'Missed sessions are dropped, not crammed into the next day.', 'Back after more than 7 days off: restart at last week’s loads minus 10%.', 'Armor happens daily, even in the worst week.']);
  h += fold('Red flags: see a doctor now', D.RED_FLAGS.map(esc));
  return h + '</div></div></div>';
}

/* ------------------------------------------------------------------ WORKOUT overview layer */
function findSession(date, sid) {
  if (sid === 'minA' || sid === 'minB') return sess(sid, 'lift', D.MIN[sid], { min: true });
  return plan(date).sessions.find((s) => s.sid === sid) || null;
}
function lWorkout(p) {
  const date = p.date, s = findSession(date, p.sid);
  if (!s) return '';
  const P = plan(date), done = sessionDone(date, s.sid), img = heroImg(s.hero) || heroImg('walk');
  let h = '<div class="layer"><div class="wrap">';
  const bar = '<div class="lbar float pad"><button class="icon-btn glass" data-a="pop" aria-label="Back">' + ic('back') + '</button><span class="ttl">' + esc(s.title) + '</span>' + (s.type === 'lift' ? '<button class="icon-btn glass" data-a="push" data-v="rules" aria-label="Rules">' + ic('info') + '</button>' : '<span style="width:44px"></span>') + '</div>';
  h += '<div class="hero" style="border-radius:0;min-height:330px">' + (img ? '<img class="bg" src="' + img + '" alt="">' : '') +
    '<div class="in pad" style="padding-bottom:20px"><span class="eyebrow" style="color:var(--fg-2)">' + esc(fmtD(date)) + (P.week >= 1 && P.week <= 13 ? ' · Week ' + P.week + ' · ' + esc(P.phase.name) : '') + '</span><h1 class="h-xl" style="font-size:56px">' + esc(s.title) + '</h1><div class="chips">' +
    [s.dur, s.sub, s.type === 'lift' ? 'RIR ' + (P.rir || '2') : ''].filter(Boolean).map((x) => '<span class="chip" style="background:rgba(11,12,14,.6)">' + esc(x) + '</span>').join('') + '</div></div></div>';
  h += '<div class="pad stack" style="margin-top:14px">';
  if (s.type === 'lift' || s.type === 'hiit') {
    const r = readiness(date);
    if (!r) h += bannerHTML('warn', '<b>Readiness check first.</b> 30 seconds: sleep, neck, back. It sets today’s volume.', { a: 'sheet', v: 'ready' });
    else if (r !== 'green') { const why = recovery(date).why; h += bannerHTML(r === 'yellow' ? 'warn' : 'bad', '<b>' + READY_TXT[r][0] + ':</b> ' + READY_TXT[r][1] + (r === 'red' ? ' <u>Switch to the Minimum session</u>.' : ' Sets already adjusted.') + (why.length ? ' Apple Health: ' + esc(why.join('; ')) + '.' : ''), r === 'red' ? { a: 'workoutMin', v: 'minA' } : null); }
    else h += pushDay(date) ? pushBanner(s) : bannerHTML('good', '<b>Green:</b> full session.');
  } else if (s.type === 'cardio' && pushDay(date)) h += pushBanner(s);
  P.notes.filter((n) => n.tone === 'train').forEach((n) => { h += bannerHTML('', esc(n.t)); });
  h += '</div>';

  if (P.tests.length && !s.min) h += testsCard(date, P);

  if (s.type === 'lift') h += liftOverview(s, date, P);
  else if (s.type === 'hiit') h += hiitOverview(s, date, P);
  else if (s.type === 'cardio') h += cardioOverview(s, date, P);
  else h += restOverview(s, date, P);

  // the bar and the CTA are children of the non-scrolling shell, outside the scroller, so they stay pinned
  h += '</div>' + bar + '<div class="sticky-cta pad"><div class="in">';
  if (s.type === 'lift') {
    const anyLogged = s.src.items.some((it) => setsFor(date, s.sid, Object.assign({}, it, { ex: resolveEx(it, date, P.week).ex })).length);
    h += done ? '<button class="btn ghost block" data-a="undoSession" data-v="' + s.sid + '">Completed · undo</button>' :
      '<button class="btn train block" data-a="startLift" data-v="' + s.sid + '">' + (anyLogged ? 'Resume workout' : 'Start workout') + '</button>';
  } else {
    h += done ? '<button class="btn ghost block" data-a="undoSession" data-v="' + s.sid + '">Completed · undo</button>' : '<button class="btn train block" data-a="completeSession" data-v="' + s.sid + '">Mark complete</button>';
  }
  h += '</div></div></div>';
  return h;
}
function testsCard(date, P) {
  const col = benchCol(P.week), colN = { base: 'Baseline', w6: 'Week 6', w12: 'Week 12' }[col];
  let h = '<section class="pad section" style="margin-top:20px"><div class="sec-h"><h2 class="h-md">Benchmarks today</h2><span class="chip">' + colN + '</span></div><div class="card"><table class="tbl"><tbody>';
  P.tests.forEach((id) => {
    const b = D.BENCHMARKS.find((x) => x.id === id); if (!b) return;
    const v = (S.bench[id] || {})[col] || '';
    h += '<tr><td><div style="font-weight:600">' + esc(b.n) + '</div><div class="xs muted">' + esc(b.how) + '</div></td><td style="text-align:right"><input inputmode="decimal" data-in="bench" data-k="' + id + '" data-c="' + col + '" value="' + esc(v) + '" placeholder="' + esc(b.unit) + '" aria-label="' + esc(b.n) + '"></td></tr>';
  });
  return h + '</tbody></table></div></section>';
}
function liftOverview(s, date, P) {
  const items = sessionItems(s, date), groups = groupItems(items);
  let h = '';
  if (s.src.ramp) h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Warm-up</h2><span class="small muted">8 min</span></div><div class="list"><div class="li"><button class="row grow" style="gap:14px;text-align:left" data-a="routine" data-v="ramp_' + s.src.ramp + '">' + exThumb('band_face_pull', 52) + '<span class="grow"><span class="t" style="display:block">Rehab Ramp · ' + cap(s.src.ramp) + ' add-on</span><span class="s" style="display:block">Breathing, chin tucks, face pulls, wall slides, bridges</span></span></button>' + checkBtn(isDone(date, 'ramp'), 'tick', 'ramp', 'Rehab Ramp done') + '</div></div></section>';
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Workout</h2><span class="small muted">' + items.length + ' exercises</span></div>';
  groups.forEach((g) => {
    const ss = g.items.length > 1, last = g.items[g.items.length - 1];
    h += '<div class="group' + (ss ? ' ss' : '') + '">';
    if (ss) h += '<div class="gh"><span class="eyebrow" style="color:var(--train)">' + (g.items.length === 2 ? 'Superset' : 'Tri-set') + ' · ' + last.sets + ' rounds</span><span class="xs muted">Rest ' + (last.rest || 0) + ' s after the ' + (g.items.length === 2 ? 'pair' : 'round') + '</span></div>';
    g.items.forEach((it) => { h += exRow(it, s, date); });
    h += '</div>';
  });
  h += '</section>';
  if (P.core && !s.min) {
    const cp = P.week <= 2 ? 1 : P.week <= 6 ? 2 : 3, f = D.CORE_FMT[clamp(P.week, 1, 13)];
    h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Core finisher</h2><span class="small muted">' + f[0] + '/' + f[1] + ' s · ' + f[2] + (f[2] > 1 ? ' rounds' : ' round') + '</span></div><div class="list"><div class="li"><button class="row grow" style="gap:14px;text-align:left" data-a="core" data-v="' + P.core + '">' + exThumb(D.CORE[cp][P.core][0], 52) + '<span class="grow"><span class="t" style="display:block">' + esc(D.CORE_NAMES[P.core]) + '</span><span class="s" style="display:block">' + D.CORE[cp][P.core].map((e) => EX[e].n.split(',')[0]).map(esc).join(' → ') + '</span></span></button>' + checkBtn(isDone(date, 'core'), 'tick', 'core', 'Core finisher done') + '</div></div>' + (readiness(date) === 'yellow' ? '<p class="small muted" style="margin:8px 2px 0">Yellow day: skip the finisher.</p>' : '') + '</section>';
  }
  return h;
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function rxText(it) {
  if (it.kind === 'emom') return it.minutes + '-min EMOM · ' + it.odd.label + ' / ' + it.even.label;
  if (it.kind === 'interval') return it.label;
  if (it.kind === 'ladder') return it.label;
  if (it.scheme === 'top') return 'Top set 1 × ' + it.topReps + ' @ RIR ' + it.topRIR + ', then ' + (it.sets - 1) + ' × ' + it.reps + ' at −' + it.backPct + '%';
  const r = it.time ? (it.timeLabel || it.time + ' s') : it.dist ? it.dist : it.reps;
  return it.sets + ' × ' + r + (it.side ? ' per side' : '') + (it.rest ? ' · rest ' + it.rest + ' s' : '');
}
function gateTxt(g) { return g.day ? (g.day === 'neck' ? 'Neck day: ' : 'Back day: ') + EX[g.from].n + ' swapped' : EX[g.from].n + ' gated'; }
function exRow(it, s, date) {
  const def = EX[it.ex] || {}, logged = setsFor(date, s.sid, it).filter((x) => x && x.done), sg = suggest(it, date);
  const doneAll = it.kind ? isDone(date, 'x:' + s.sid + ':' + it.k) : logged.length >= it.sets;
  const tags = [];
  if (it.tech) tags.push('<span class="chip train" style="height:22px;font-size:11px">' + esc(it.tech) + '</span>');
  if (it.gated) tags.push('<span class="chip warn" style="height:22px;font-size:11px">' + ic('lock').replace('<svg', '<svg width="11" height="11"') + ' ' + esc(gateTxt(it.gated)) + '</span>');
  if (it.swapped) tags.push('<span class="chip" style="height:22px;font-size:11px">Swapped</span>');
  if (it.optional) tags.push('<span class="chip" style="height:22px;font-size:11px">Optional</span>');
  if (it.neckSkip) tags.push('<span class="chip bad" style="height:22px;font-size:11px">Skip: neck above ' + it.neckSkip + '</span>');
  if (it.pump) tags.push('<span class="chip train" style="height:22px;font-size:11px">' + (it.beast ? 'Beast Mode add-on' : 'Peak pump finisher') + '</span>');
  const lastTxt = logged.length ? logged.map((x) => (x.w ? x.w + '×' : '') + (x.r || x.t || '✓')).join(', ') : sg && sg.last ? 'Last: ' + sg.last.sets.map((x) => (x.w ? x.w + '×' : '') + (x.r || '')).join(', ') : '';
  return '<button class="exrow' + (doneAll ? ' done' : '') + '" data-a="exInfo" data-v="' + it.ex + '" data-k="' + it.k + '" data-s="' + s.sid + '">' + exThumb(it.ex, 60) +
    '<span class="grow" style="min-width:0"><span class="k">' + esc(it.k) + '</span> <span class="t">' + esc(def.n) + '</span><span class="s" style="display:block">' + esc(rxText(it)) + '</span>' +
    (it.note ? '<span class="xs muted" style="display:block;margin-top:2px">' + esc(it.note) + '</span>' : '') +
    (tags.length ? '<span class="chips" style="margin-top:5px">' + tags.join('') + '</span>' : '') +
    (lastTxt ? '<span class="last" style="display:block">' + (logged.length ? '<span class="tick">Today: </span>' : '') + esc(lastTxt) + '</span>' : '') + '</span>' +
    (doneAll ? '<span class="check on">' + ic('check') + '</span>' : '') + '</button>';
}
function hiitOverview(s, date, P) {
  const src = s.src;
  let h = '<section class="pad section"><div class="sec-h"><h2 class="h-md">Warm-up</h2></div><div class="card small fg2">' + esc(src.warmup) + '</div></section>';
  src.blocks.forEach((b, i) => {
    if (b.weeks && !b.weeks.includes(P.week)) return;
    const done = isDone(date, 'b:' + s.sid + ':' + i);
    let sub = b.label || '';
    if (b.kind === 'sprints') { const c = sprintCfg(b, P.week); sub = c.reps + ' × ' + c.dist + ' at ' + c.pct + (b.label ? ' · ' + b.label : ''); }
    if (b.kind === 'circuit') sub = b.rounds + ' rounds · rest ' + b.rest + ' s between rounds';
    if (b.kind === 'amrap') sub = b.minutes + '-min AMRAP' + (b.label ? ' · ' + b.label : '');
    if (b.kind === 'interval') sub = b.label;
    h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">' + (i + 1) + ' · ' + esc(b.name) + '</h2>' + checkBtn(done, 'tick', 'b:' + s.sid + ':' + i, b.name + ' done') + '</div><div class="group">';
    const items = b.items || [{ ex: b.ex, label: '' }];
    items.forEach((x) => { const xe = dayEx(x.ex, date).ex; h += '<button class="exrow" data-a="exInfo" data-v="' + xe + '">' + exThumb(xe, 56) + '<span class="grow"><span class="t">' + esc(EX[xe].n) + '</span><span class="s" style="display:block">' + esc(x.label || '') + '</span></span></button>'; });
    h += '<div style="padding:8px 14px 10px"><div class="small fg2" style="margin-bottom:10px">' + esc(sub) + (b.ex === 'landmine_rot' ? '' : '') + '</div><button class="btn train sm" data-a="startBlock" data-v="' + i + '" data-s="' + s.sid + '">' + ic('timer').replace('<svg', '<svg width="18" height="18"') + ' Start ' + ({ interval: 'intervals', circuit: 'circuit', sprints: 'sprints', amrap: 'AMRAP', sets: 'sets' })[b.kind] + '</button>' +
      (b.kind === 'amrap' ? '<span class="small muted" style="margin-left:10px">' + (peek(date).rounds && peek(date).rounds[s.sid + ':' + i] != null ? 'Logged: ' + peek(date).rounds[s.sid + ':' + i] + ' rounds' : '') + '</span>' : '') + '</div></div></section>';
  });
  h += '<section class="pad section"><div class="card small fg2"><b>Cool-down:</b> ' + esc(src.cooldown || '') + '</div></section>';
  return h;
}
function sprintCfg(b, w) {
  if (b.byWeek) { const k = b.byWeek[w] || b.byWeek[3]; return { reps: k[0], dist: k[1], pct: k[2], rest: k[3] }; }
  if (w >= 11) return { reps: 6, dist: '40 m', pct: '95%', rest: 150 };
  return { reps: b.reps, dist: b.dist, pct: b.pct, rest: b.rest };
}
function cardioOverview(s, date, P) {
  const c = s.cardio || {}, d = peek(date), log = (d.cardio || {})[s.sid] || {};
  const ex = /swim/i.test(s.title) ? 'swim' : 'run';
  let h = '<section class="pad section"><div class="sec-h"><h2 class="h-md">Session</h2></div><div class="group"><button class="exrow" data-a="exInfo" data-v="' + ex + '">' + exThumb(ex, 56) + '<span class="grow"><span class="t">' + esc(s.title) + '</span><span class="s" style="display:block">' + esc(c.text || '') + '</span></span></button></div>';
  h += '<div class="row" style="gap:10px;margin-top:12px;flex-wrap:wrap">' + (c.intervals ? '<button class="btn train sm" data-a="startCardio" data-v="' + s.sid + '">' + ic('timer').replace('<svg', '<svg width="18" height="18"') + ' Start interval timer</button>' : '<button class="btn train sm" data-a="startCardio" data-v="' + s.sid + '">' + ic('timer').replace('<svg', '<svg width="18" height="18"') + ' Start ' + (c.min || 30) + '-min timer</button>') +
    (c.strides ? '<button class="btn ghost sm" data-a="startStrides" data-v="' + s.sid + '">Strides ' + c.strides[0] + ' × ' + c.strides[1] + '</button>' : '') + '</div></section>';
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Log it</h2></div><div class="card stack"><div class="row" style="gap:10px">' +
    '<label class="grow"><span class="lbl">Minutes</span><input class="field" inputmode="decimal" data-in="cardio" data-s="' + s.sid + '" data-k="min" value="' + esc(log.min || '') + '" placeholder="' + (c.min || 30) + '"></label>' +
    '<label class="grow"><span class="lbl">Distance (mi)</span><input class="field" inputmode="decimal" data-in="cardio" data-s="' + s.sid + '" data-k="dist" value="' + esc(log.dist || '') + '" placeholder="—"></label>' +
    '<label class="grow"><span class="lbl">Avg HR</span><input class="field" inputmode="numeric" data-in="cardio" data-s="' + s.sid + '" data-k="hr" value="' + esc(log.hr || '') + '" placeholder="120–140"></label></div>' +
    '<p class="small muted" style="margin:0">Zone 2 is the talk test: full sentences, nose breathing. Electrolytes today.</p></div></section>';
  return h;
}
function restOverview(s, date, P) {
  const rows = [];
  if (s.sid === 'kickoff') rows.push(['k:waist', 'Get a tape measure ready for Monday', 'Waist at the navel, relaxed, morning'], ['k:weigh', 'Weigh in tomorrow morning', 'Daily weigh-ins feed the 7-day average'], ['k:book', "Book the week's training times", 'Mon Pull · Tue Legs · Thu Push · Fri Rugby · Sat run'], ['k:cook', 'Cook protein for Mon–Wed', 'Chicken, 93/7 beef, eggs, cottage cheese'], ['k:reminder', 'Set a recurring desk-reset reminder', 'Every 60 min on workdays']);
  if (s.type === 'recovery' && s.sid !== 'pack') rows.push(['armor', 'Full Armor', '12 min'], ['armorWed', 'Hip add-on: 90/90 switches, adductor rockback, hip flexor stretch', '5 min'], ['walk', P.walk || 'Walk 40–45 min', 'Nose breathing']);
  if (s.sid === 'pack') rows.push(['walk', 'Walk 45 min', ''], ['armor', 'Armor', '12 min'], ['k:pack', 'Pack: neck pillow, compression socks, protein snacks', '']);
  if (s.sid === 'sunday' || s.sid === 'xmas') rows.push(['walk', P.walk || 'Long walk 45–60 min', s.sid === 'sunday' ? 'Make it phone-free: no podcast, no calls' : 'After the big meal'], ['reset', 'Sunday Reset', 'Open the weekly check'], ['armor', 'Armor', '12 min']);
  if (s.type === 'travel') rows.push(['t:walk', 'Walk the aisle every 1–2 h', ''], ['t:socks', 'Compression socks', ''], ['t:pillow', 'Supportive neck pillow', ''], ['t:water', '3 L of water', ''], ['t:protein', 'Protein snacks', ''], ['armor', 'Armor before you leave', '']);
  let h = '<section class="pad section"><div class="sec-h"><h2 class="h-md">' + (s.type === 'travel' ? 'Travel checklist' : 'Today') + '</h2></div><div class="list">';
  rows.forEach(([k, t, sub]) => {
    const act = k === 'reset' ? 'data-a="sheet" data-v="sunday"' : k === 'armorWed' ? 'data-a="routine" data-v="armorWed"' : k === 'armor' ? 'data-a="routine" data-v="armor"' : '';
    h += '<div class="li"><' + (act ? 'button ' + act : 'div') + ' class="grow" style="text-align:left"><span class="t" style="display:block">' + esc(t) + '</span>' + (sub ? '<span class="s" style="display:block">' + esc(sub) + '</span>' : '') + '</' + (act ? 'button' : 'div') + '>' + checkBtn(isDone(date, k), 'tick', k, t) + '</div>';
  });
  return h + '</div></section>';
}

/* ------------------------------------------------------------------ FUEL */
function vFuel() {
  const date = ui.date, tg = targets(date), tt = totals(date), d = peek(date), dw = dowOf(date), P = plan(date);
  let h = topHeader(esc(date === todayISO() ? 'Today · ' + fmtD(date) : fmtD(date)), 'Fuel', avatarBtn());
  h += '<div class="pad">' + strip(date, 'var(--fuel)') + '</div>';
  const left = tg.kcal - tt.kcal;
  h += '<section class="pad section" style="margin-top:18px"><div class="card"><div class="row" style="gap:18px"><div class="bigring">' + ringSVG(tt.kcal / tg.kcal, 132, 12, 'var(--fuel)') + '<div class="c"><div class="big-num tnum" style="font-size:38px">' + fmtN(Math.abs(left)) + '</div><div class="xs muted">' + (left >= 0 ? 'kcal left' : 'kcal over') + '</div></div></div>' +
    '<div class="grow stack" style="gap:9px">' + macroBar('Protein', tt.p, tg.p[0], 'g', 'var(--fuel)', tg.p[0] + '–' + tg.p[1]) + macroBar('Carbs', tt.c, tg.carbs ? tg.carbs[1] : 300, 'g', 'var(--train)', tg.carbs ? tg.carbs[0] + '–' + tg.carbs[1] : 'the rest') + macroBar('Fat', tt.f, tg.fat[1], 'g', 'var(--mind)', tg.fat[0] + '–' + tg.fat[1]) + '</div></div>' +
    '<div class="row" style="justify-content:space-between;margin-top:14px;border-top:1px solid var(--line);padding-top:12px"><span class="small fg2">' + esc(tg.label) + (S.settings.kcalAdj ? ' (' + (S.settings.kcalAdj > 0 ? '+' : '') + S.settings.kcalAdj + ' calibration)' : '') + '</span><span class="small tnum"><b>' + fmtN(tt.kcal) + '</b> / ' + fmtN(tg.kcal) + ' kcal</span></div></div></section>';

  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Meals</h2><button class="link" data-a="logPlan">Log the whole plan</button></div>';
  D.SLOTS.forEach((sl) => {
    const pf = plannedFood(date, sl.id), logged = mealsFor(date).map((m, i) => Object.assign({ i }, m)).filter((m) => m.slot === sl.id);
    if (!pf && !logged.length && sl.id === 'pre') return;
    h += '<div class="slot"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 class="h-sm" style="color:var(--fg-2)">' + sl.n + '</h3><button class="small" style="color:var(--fuel);font-weight:700" data-a="sheet" data-v="food" data-s="' + sl.id + '">+ Add</button></div><div class="stack" style="gap:8px">';
    if (pf && !logged.some((m) => m.fid === pf.id)) h += foodCard(pf, '<button class="check" data-a="eat" data-v="' + pf.id + '" data-s="' + sl.id + '" aria-label="Log ' + esc(pf.n) + '"></button>', 'Planned · tap the circle when eaten', sl.id);
    logged.forEach((m) => { h += foodCard(m, '<button class="check on" data-a="uneat" data-v="' + m.i + '" aria-label="Remove ' + esc(m.n) + '">' + ic('check') + '</button>', (m.q && m.q !== 1 ? m.q + ' × · ' : '') + 'Logged', sl.id); });
    h += '</div></div>';
  });
  h += '</section>';

  // water + supplements
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Water</h2><span class="small muted tnum">' + ((d.water || 0) * 0.5).toFixed(1) + ' / 4 L' + (P.sessions.some((s) => s.type === 'hiit' || s.type === 'cardio') ? ' · electrolytes today' : '') + '</span></div><div class="water">';
  for (let i = 1; i <= 8; i++) h += '<button class="' + ((d.water || 0) >= i ? 'on' : '') + '" data-a="water" data-v="' + i + '" aria-label="' + (i * 0.5) + ' litres">' + ic('water').replace('<svg', '<svg width="18" height="18" style="opacity:.8"') + '</button>';
  h += '</div><p class="xs muted" style="margin:6px 2px 0">Each drop is a 500 ml bottle.</p></section>';
  const m = pISO(date).getMonth() + 1;
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Supplements</h2></div><div class="list">' + D.SUPPS.filter((x) => !x.months || x.months.includes(m)).map((x) => {
    const on = !!(d.supps && d.supps[x.id]);
    return '<div class="li"><span class="grow"><span class="t" style="display:block">' + esc(x.n) + '</span><span class="s" style="display:block">' + esc(x.d) + '</span></span>' + checkBtn(on, 'supp', x.id, x.n) + '</div>';
  }).join('') + '</div><p class="xs muted" style="margin:6px 2px 0">Caffeine 150–200 mg before training (Jeff: 100–200), none after 2 pm.</p></section>';

  // drinks + free meals
  if (dw >= 3) {
    const dr = d.drinks || {}, tot = D.DRINKS.reduce((a, x) => a + (dr[x.id] || 0), 0), wk = drinksThisWeek(date), bud = drinkBudget(date), bad = tot > ((D.DRINK_BUDGET && D.DRINK_BUDGET.night) || 4) || wk > bud;
    h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Drinks</h2><span class="small ' + (bad ? '' : 'muted') + ' tnum" style="' + (bad ? 'color:var(--bad)' : '') + '">' + tot + ' tonight · ' + wk + '/' + bud + ' this week</span></div><p class="xs muted" style="margin:-4px 2px 8px">Cap 3–4 a night. Jeff’s lean-down number is 3–4 a week; holiday weeks get room for 10.</p>';
    if (dw === 3 && !BIG_DAYS[date]) h += '<div style="margin-bottom:10px">' + bannerHTML('warn', '<b>No drinks tonight.</b> Friday is Rugby Day.') + '</div>';
    h += '<div class="list">' + D.DRINKS.map((x) => '<div class="li"><span class="grow"><span class="t" style="display:block">' + esc(x.n) + '</span><span class="s" style="display:block">~' + x.kcal + ' kcal</span></span><div class="row" style="gap:6px"><button class="icon-btn" style="width:36px;height:36px" data-a="drink" data-v="' + x.id + '" data-d="-1" aria-label="One fewer">' + ic('minus') + '</button><span class="h-md tnum" style="min-width:20px;text-align:center">' + (dr[x.id] || 0) + '</span><button class="icon-btn" style="width:36px;height:36px" data-a="drink" data-v="' + x.id + '" data-d="1" aria-label="One more">' + ic('plus') + '</button></div></div>').join('') + '</div><p class="xs muted" style="margin:6px 2px 0">Alternate each drink with water. Last drink about 3 h before bed.</p></section>';
  }
  const fm = freeMealsThisWeek(date), fcap = freeMealCap(date);
  h += '<section class="pad section"><div class="card row"><div class="grow"><div class="h-sm">Free meals this week</div><div class="small muted" style="margin-top:3px">' + (fcap === 1 ? 'One a week in Peak (Weeks 11–12). Holiday days don’t count.' : 'Two a week at lunch. Anchor with 40+ g protein, one sitting.') + '</div></div><div class="big-num tnum" style="font-size:40px;color:' + (fm > fcap ? 'var(--bad)' : 'var(--fuel)') + '">' + fm + '<span class="muted" style="font-size:22px">/' + fcap + '</span></div></div></section>';

  h += '<section class="section"><div class="sec-h pad"><h2 class="h-md">Guides</h2></div><div class="rail pad">' + D.GUIDES.map((g) => '<button class="tile" data-a="sheet" data-v="guide" data-s="' + g.id + '"><div class="art art-' + g.tone + '" style="display:grid;place-items:center">' + foodGlyph(g.tone, 54) + '</div><div class="tx"><div class="tt">' + esc(g.t) + '</div></div></button>').join('') + '</div></section>';
  return h;
}
const FOOD_GLYPH = {
  eggs: '<ellipse cx="12" cy="13" rx="6.5" ry="8"/><path d="M9 12.5c.5-2 1.5-3 3-3.5"/>',
  banana: '<path d="M5 6c0 8 5 13 14 12-1-1.5-2-2-3.5-2C10 15.5 7 12 7 6Z"/><path d="M5 6l1-2"/>',
  shake: '<path d="M7 7h10l-1.3 13H8.3Z"/><path d="M6 7h12M12 7l2-4"/>',
  curry: '<path d="M3.5 12h17a8.5 8.5 0 0 1-17 0Z"/><path d="M8 4.5c0 1.5 1.5 1.5 1.5 3M12 3.5c0 1.5 1.5 1.5 1.5 3M16 4.5c0 1.5 1.5 1.5 1.5 3"/>',
  sandwich: '<path d="M3 14l9-8 9 8Z"/><path d="M3 14v2.5h18V14M5.5 11.5h13"/>',
  plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  bowl: '<path d="M4 11h16a8 8 0 0 1-16 0Z"/><circle cx="9" cy="8.5" r="1.4"/><circle cx="13" cy="7.5" r="1.4"/><circle cx="15.5" cy="9.5" r="1.2"/>',
  free: '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z"/>',
  drink: '<path d="M6 4h12l-2 8a4 4 0 0 1-8 0Z"/><path d="M12 16v4M8.5 20h7"/>',
};
function foodGlyph(tone, size) { return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;inset:0;margin:auto">' + (FOOD_GLYPH[tone] || FOOD_GLYPH.plate) + '</svg>'; }
function macroBar(n, v, max, u, color, range) {
  return '<div><div class="row" style="justify-content:space-between"><span class="small fg2">' + n + '</span><span class="xs tnum"><b>' + Math.round(v) + '</b> <span class="muted">/ ' + range + ' ' + u + '</span></span></div><div class="bar" style="margin-top:5px;height:7px"><i style="width:' + clamp(v / max * 100, 0, 100) + '%;background:' + color + '"></i></div></div>';
}
function foodCard(f, right, note, slot) {
  const tone = f.tone || (foodById(f.fid) || {}).tone || 'plate';
  return '<div class="food"><button class="row grow" style="gap:12px;text-align:left;min-width:0" data-a="sheet" data-v="foodInfo" data-s="' + (f.fid || f.id) + '"><span class="fa art-' + tone + '">' + foodGlyph(tone, 30) + '</span><span class="grow" style="min-width:0"><span class="ft" style="display:block">' + esc(f.n) + '</span><span class="fs" style="display:block">' + fmtN(f.kcal * (f.q || 1)) + ' kcal · ' + Math.round(f.p * (f.q || 1)) + ' g protein</span>' + (note ? '<span class="xs" style="display:block;color:var(--fg-2);margin-top:2px">' + esc(note) + '</span>' : '') + '</span></button>' + right + '</div>';
}

/* ------------------------------------------------------------------ MIND */
function vMind() {
  const date = ui.date, P = plan(date), d = peek(date);
  const mins = (dd) => (peek(dd).mind || []).reduce((a, x) => a + (x.min || 0), 0);
  let wk = 0; for (let i = 0; i < 7; i++) wk += mins(addDays(mondayOf(date), i));
  let st = 0, dd = todayISO(); if (!mins(dd)) dd = addDays(dd, -1); while (mins(dd) > 0 && st < 400) { st++; dd = addDays(dd, -1); }
  let h = topHeader('Calm, focus and sleep', 'Mind', avatarBtn());
  h += '<div class="pad"><div class="kv" style="margin-top:14px"><div><div class="v tnum">' + st + '</div><div class="k">Day streak</div></div><div><div class="v tnum">' + Math.round(wk) + '</div><div class="k">Min this week</div></div><div><div class="v tnum">' + (P.week >= 1 && P.week <= 13 ? P.week : '–') + '</div><div class="k">Week · benefits show ~8</div></div></div></div>';
  h += '<section class="pad section">' + mindTile(P.sit, 'Today’s practice · ' + fmtD(date), isDone(date, 'sit')) + '</section>';
  h += '<section class="pad section" style="margin-top:12px"><div class="list"><div class="li"><button class="row grow" style="gap:14px;text-align:left" data-a="mind" data-v="sigh5"><span class="ico ' + mindArt('sigh5') + '" style="color:#fff">' + ic('sun') + '</span><span class="grow"><span class="t" style="display:block">Morning breath · cyclic sighing</span><span class="s" style="display:block">5 min every morning, with morning light</span></span></button>' + checkBtn(isDone(date, 'morning'), 'tick', 'morning', 'Morning breath done') + '</div></div></section>';
  D.MIND_CATS.forEach((c) => {
    const ids = Object.keys(D.MIND).filter((k) => D.MIND[k].cat === c.id);
    h += '<section class="section"><div class="sec-h pad"><h2 class="h-md">' + c.n + '</h2></div><div class="rail pad">' + ids.map((k) => { const m = D.MIND[k]; return '<button class="tile" data-a="mind" data-v="' + k + '"><div class="art ' + mindArt(k) + '"><span class="artglyph">' + m.min + '</span></div><div class="tx"><div class="tt">' + esc(m.n) + '</div><div class="ts">' + m.min + ' min · ' + esc(m.sub) + '</div></div></button>'; }).join('') +
      (c.id === 'tool' ? '<button class="tile" data-a="sheet" data-v="silent"><div class="art art-night"><span class="artglyph">' + ic('timer').replace('<svg', '<svg width="60" height="60" style="position:absolute;right:12px;bottom:10px;opacity:.4"') + '</span></div><div class="tx"><div class="tt">Silent timer</div><div class="ts">Bells only · any length</div></div></button>' : '') + '</div></section>';
  });
  const c = d.chk || {};
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Daily check-in</h2></div><div class="card stack">' + scaleRow('Morning stress (0–10)', 'stress', c.stress) +
    '<div><span class="lbl">Sleep quality (1–5)</span><div class="seg mind">' + [1, 2, 3, 4, 5].map((v) => '<button class="' + (c.sleepQ === v ? 'on' : '') + '" data-a="chk" data-k="sleepQ" data-v="' + v + '">' + v + '</button>').join('') + '</div></div></div></section>';
  const g = d.grat || ['', '', ''];
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">3 good things</h2><span class="small muted">' + esc(fmtD(date)) + '</span></div><div class="card stack">' + [0, 1, 2].map((i) => '<input class="field" id="grat' + i + '" data-in="grat" data-k="' + i + '" value="' + esc(g[i] || '') + '" placeholder="' + ['A PR, a pain-free set, a good call…', 'Something that went well', 'Someone you are grateful for'][i] + '" aria-label="Good thing ' + (i + 1) + '">').join('') +
    (dowOf(date) === 6 ? '<label><span class="lbl" style="margin-top:6px">Sunday journal (10 min): what is weighing on you, and what is in your control?</span><textarea class="field" id="journal" data-in="journal">' + esc(d.journal || '') + '</textarea></label>' : '') + '</div></section>';
  const due = [1, 6, 12].includes(P.week);
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Questionnaires</h2><span class="small muted">Weeks 1, 6 and 12</span></div><div class="list">' + ['PSS10', 'GAD7'].map((k) => {
    const Q = D[k], last = S.quiz.filter((x) => x.k === k).slice(-1)[0];
    return '<button class="li" data-a="quiz" data-v="' + k + '"><span class="ico" style="color:var(--mind)">' + ic('list') + '</span><span class="grow"><span class="t" style="display:block">' + Q.n + ' · ' + Q.full + '</span><span class="s" style="display:block">' + (last ? 'Last: ' + last.score + ' (' + esc(Q.band(last.score)) + ') on ' + fmtShort(last.date) : 'Not taken yet') + (due ? ' · due this week' : '') + '</span></span>' + ic('next').replace('<svg', '<svg width="18" height="18"') + '</button>';
  }).join('') + '</div></section>';
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Mindfulness with no extra time</h2></div><div class="card"><ul class="small fg2" style="margin:0;padding-left:18px">' + D.MIND_TIPS.map((x) => '<li style="margin:4px 0">' + esc(x) + '</li>').join('') + '</ul></div></section>';
  h += '<section class="section"><div class="sec-h pad"><h2 class="h-md">Why this dose</h2></div><div class="rail pad">' + D.RESEARCH.map((r) => '<div class="tile wide card" style="padding:14px;width:270px"><div class="small" style="font-weight:600">' + esc(r.f) + '</div><div class="small" style="color:var(--mind);margin-top:8px">' + esc(r.m) + '</div><a class="xs" style="display:block;margin-top:8px" href="' + r.u + '" target="_blank" rel="noopener">' + esc(r.s) + '</a></div>').join('') + '</div></section>';
  return h;
}
function quizDone(week) {
  const ws = weekStart(week), we = addDays(ws, 6);
  return ['PSS10', 'GAD7'].every((k) => S.quiz.some((x) => x.k === k && x.date >= ws && x.date <= we));
}

/* ------------------------------------------------------------------ PROGRESS */
function vProgress() {
  const t = todayISO(), date = ui.date, d = peek(date), u = S.settings.unit;
  let h = topHeader('Target ' + D.GOAL.to[0] + '–' + D.GOAL.to[1] + ' lb by Jan 14', 'Progress', avatarBtn());
  const a = avg7(t), tg = targetAt(t), ws = weights(), first = ws.length ? ws[0].w : D.GOAL.from;
  const status = a == null ? null : t < '2026-10-26' ? 'early' : a <= tg.hi ? (a < tg.lo ? 'ahead' : 'on') : 'above';
  h += '<section class="pad section" style="margin-top:16px"><div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><div class="eyebrow">7-day average</div><div class="big-num tnum" style="margin-top:6px">' + (a != null ? a.toFixed(1) : '—') + '<span class="muted" style="font-size:22px"> ' + u + '</span></div><div class="small fg2" style="margin-top:4px">Target today ' + tg.t.toFixed(1) + ' (' + tg.lo.toFixed(1) + '–' + tg.hi.toFixed(1) + ')' + (a != null ? ' · ' + (first - a >= 0 ? '−' : '+') + Math.abs(first - a).toFixed(1) + ' since start' : '') + '</div></div>' +
    (status ? '<span class="chip ' + (status === 'above' ? 'warn' : status === 'early' ? '' : 'good') + '">' + ({ on: 'On track', ahead: 'Ahead', above: 'Above range', early: 'Week 1: judge from Week 2' })[status] + '</span>' : '') + '</div>' + weightChart() +
    '<div class="row" style="gap:10px;margin-top:14px"><label class="grow"><span class="lbl">Weigh-in, ' + esc(fmtD(date)) + '</span><input class="field" inputmode="decimal" id="wIn" data-in="weight" value="' + esc(d.weight || '') + '" placeholder="e.g. 206.4"></label><label style="width:120px"><span class="lbl">Steps</span><input class="field" inputmode="numeric" id="stepsIn" data-in="steps" value="' + esc(d.steps || '') + '" placeholder="10,000"></label></div></div></section>';
  const c = calibration(t);
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Calibration</h2><span class="small muted">Sunday ' + fmtShort(c.sun) + '</span></div>' + (c.rate == null ? '<div class="card small fg2">Needs two weeks of weigh-ins to compare 7-day averages. Weigh in every morning.</div>' :
    '<div class="card"><div class="row" style="justify-content:space-between"><div><div class="big-num tnum" style="font-size:40px">' + (c.rate >= 0 ? '−' : '+') + Math.abs(c.rate).toFixed(1) + '<span class="muted" style="font-size:20px"> lb/wk</span></div></div><span class="chip ' + c.tone + '">Goal 0.8–1.4</span></div><p class="small fg2" style="margin:10px 0 0">' + esc(c.rec) + '</p>' +
    hkCalNote(c) + (c.act ? '<button class="btn fuel sm" style="margin-top:12px" data-a="kcalAdj" data-v="' + c.act + '">' + (c.act > 0 ? 'Add' : 'Cut') + ' 150 kcal a day</button>' : '') + '</div>') +
    (S.settings.kcalAdj ? '<p class="small muted" style="margin:8px 2px 0">Current adjustment: ' + (S.settings.kcalAdj > 0 ? '+' : '') + S.settings.kcalAdj + ' kcal a day. <button style="color:var(--fuel);font-weight:600" data-a="kcalAdj" data-v="reset">Reset</button></p>' : '') + '</section>';

  // this week
  const mon = mondayOf(t); let sess = 0, sessT = 0, prot = 0, sleep = [], mm = 0;
  for (let i = 0; i < 7; i++) {
    const dd = addDays(mon, i), P = plan(dd);
    P.sessions.filter(isTraining).forEach((s) => { sessT++; if (sessionDone(dd, s.sid)) sess++; });
    if (totals(dd).p >= 200) prot++;
    const ch = peek(dd).chk; if (ch && ch.sleep) sleep.push(ch.sleep);
    mm += (peek(dd).mind || []).reduce((x, y) => x + (y.min || 0), 0);
  }
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">This week</h2></div><div class="kv"><div><div class="v tnum">' + sess + '<span class="muted" style="font-size:16px">/' + sessT + '</span></div><div class="k">Sessions</div></div><div><div class="v tnum">' + prot + '<span class="muted" style="font-size:16px">/7</span></div><div class="k">Protein days</div></div><div><div class="v tnum">' + Math.round(mm) + '</div><div class="k">Mind minutes</div></div></div></section>';

  h += hkTrends();

  // trends
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Check-ins, last 14 days</h2></div><div class="card stack">' + [['neck', 'Neck', 10, 'var(--bad)'], ['back', 'Low back', 10, 'var(--warn)'], ['stress', 'Stress', 10, 'var(--mind)']].map(([k, n, max, col]) => {
    let bars = '', last = null;
    for (let i = 13; i >= 0; i--) { const v = (peek(addDays(t, -i)).chk || {})[k]; if (v != null) last = v; bars += '<i style="height:' + (v == null ? 2 : Math.max(3, v / max * 100)) + '%;background:' + (v == null ? 'var(--card-3)' : col) + ';opacity:' + (v == null ? 1 : 0.85) + '"></i>'; }
    return '<div class="row" style="gap:12px"><div style="width:74px"><div class="small fg2">' + n + '</div><div class="h-md tnum">' + (last == null ? '–' : last) + '</div></div><div class="sparkbars grow">' + bars + '</div></div>';
  }).join('') + '</div></section>';

  // gates
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Gates</h2><span class="small muted">From your daily check-ins</span></div><div class="list">' + D.GATES.map((g) => {
    const st = gateStatus(g, t), ov = S.settings.gate[g.id];
    const chip = st === 'open' ? '<span class="chip good">Open</span>' : st === 'later' ? '<span class="chip">Week ' + g.from + '+</span>' : '<span class="chip warn">' + ic('lock').replace('<svg', '<svg width="11" height="11"') + ' Locked</span>';
    return '<div class="li" style="align-items:flex-start"><span class="grow"><span class="t" style="display:block">' + esc(g.n) + '</span><span class="s" style="display:block">' + esc(g.rule) + '</span><button class="xs" style="color:var(--fg-2);font-weight:600;margin-top:6px" data-a="gateOv" data-v="' + g.id + '">' + (ov ? 'Manual: ' + ov + ' · clear' : 'Set manually') + '</button></span>' + chip + '</div>';
  }).join('') + '</div></section>';

  // benchmarks
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Benchmarks</h2></div><div class="card scrollx"><table class="tbl"><thead><tr><th>Test</th><th>Base</th><th>Wk 6</th><th>Wk 12</th></tr></thead><tbody>' + D.BENCHMARKS.map((b) => {
    const r = S.bench[b.id] || {};
    return '<tr><td><div style="font-weight:600;font-size:13.5px">' + esc(b.n) + '</div><div class="xs muted">' + esc(b.goal || b.how) + '</div></td>' + ['base', 'w6', 'w12'].map((c) => '<td><input inputmode="decimal" data-in="bench" data-k="' + b.id + '" data-c="' + c + '" value="' + esc(r[c] || '') + '" aria-label="' + esc(b.n) + ' ' + c + '"></td>').join('') + '</tr>';
  }).join('') + '</tbody></table></div></section>';

  // sunday reset
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Sunday Reset</h2><button class="link" data-a="sheet" data-v="sunday">Open</button></div>';
  const sr = S.sunday[mondayOf(t)] || {}; const nDone = D.SUNDAY_RESET.filter((_, i) => sr[i]).length;
  h += '<div class="card row"><div class="grow small fg2">Week of ' + fmtShort(mondayOf(t)) + (sr.win ? ' · Win: ' + esc(sr.win) : '') + '</div><span class="chip ' + (nDone === D.SUNDAY_RESET.length ? 'good' : '') + '">' + nDone + '/' + D.SUNDAY_RESET.length + '</span></div></section>';

  // history + bests
  const hist = Object.keys(S.days).sort().reverse().flatMap((dd) => Object.keys((S.days[dd].done || {})).filter((k) => k.startsWith('s:')).map((k) => ({ dd, sid: k.slice(2) }))).slice(0, 12);
  h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">History</h2></div>' + (hist.length ? '<div class="list">' + hist.map((x) => {
    const s = findSession(x.dd, x.sid) || { title: x.sid, hero: 'walk' }, sets = Object.keys(S.days[x.dd].sets || {}).filter((k) => k.startsWith(x.sid + '|')).reduce((a, k) => a.concat(S.days[x.dd].sets[k].filter((z) => z && z.done)), []);
    const vol = sets.reduce((a, z) => a + (num(z.w) || 0) * (num(z.r) || 0), 0);
    return '<button class="li" data-a="openDay" data-v="' + x.dd + '">' + exThumb(s.hero, 44) + '<span class="grow"><span class="t" style="display:block">' + esc(s.title) + '</span><span class="s" style="display:block">' + fmtD(x.dd) + (sets.length ? ' · ' + sets.length + ' sets · ' + fmtN(vol) + ' ' + u : '') + '</span></span></button>';
  }).join('') + '</div>' : '<div class="card empty">Completed sessions show up here.</div>') + '</section>';
  const bests = bestLifts();
  if (bests.length) h += '<section class="pad section"><div class="sec-h"><h2 class="h-md">Best sets</h2><span class="small muted">Estimated 1RM</span></div><div class="list">' + bests.map((b) => '<div class="li">' + exThumb(b.ex, 44) + '<span class="grow"><span class="t" style="display:block">' + esc(EX[b.ex].n) + '</span><span class="s" style="display:block">' + b.w + ' × ' + b.r + ' on ' + fmtShort(b.d) + '</span></span><span class="h-md tnum">' + Math.round(b.e) + '</span></div>').join('') + '</div></section>';
  h += '<section class="pad section"><button class="li card" style="padding:14px" data-a="push" data-v="settings"><span class="ico">' + ic('gear') + '</span><span class="grow"><span class="t" style="display:block">Settings and backup</span><span class="s" style="display:block">' + syncLabel() + '</span></span>' + ic('next').replace('<svg', '<svg width="18" height="18"') + '</button></section>';
  return h;
}
function storageDetail() {
  const n = Object.keys(S.days).filter((d) => Object.keys(S.days[d]).length > 1).length;
  const t = S.savedAt ? new Date(S.savedAt) : null;
  return n + ' days logged' + (t ? ' · last saved ' + t.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '') +
    (IDBStore.ok ? ' · 2 copies on device' : '') + (ui.persisted ? ' · protected from clean-up' : '') + (saveError ? ' · last save failed' : '');
}
function syncLabel() { return ({ synced: 'Synced to your Claude account', syncing: 'Syncing…', offline: 'Offline · will sync when back', full: 'Cloud storage full · saved on this device', local: 'Saved on this iPhone · back up weekly' })[Cloud.status] || 'Saved on this device'; }
function bestLifts() {
  const main = ['bench', 'db_bench', 'trapbar', 'hack_squat', 'goblet_box', 'cs_db_row', 'tbar_row', 'pendlay', 'w_pullup', 'incline_db', 'db_rdl', 'hip_thrust'];
  const best = {};
  Object.keys(S.days).forEach((d) => Object.keys(S.days[d].sets || {}).forEach((k) => {
    const ex = k.split('|')[2]; if (!main.includes(ex)) return;
    S.days[d].sets[k].forEach((z) => { const w = num(z && z.w), r = num(z && z.r); if (!z || !z.done || !w || !r || r > 15) return; const e = w * (1 + r / 30); if (!best[ex] || e > best[ex].e) best[ex] = { ex, w, r, e, d }; });
  }));
  return Object.values(best).sort((a, b) => b.e - a.e).slice(0, 8);
}
function weightChart() {
  const W = 340, H = 170, L = 30, R = 8, T = 10, B = 22;
  const start = '2026-10-18', end = '2027-01-14', span = daysBetween(start, end);
  const ws = weights().filter((x) => x.d >= addDays(start, -3));
  let lo = 190, hi = 209; ws.forEach((x) => { lo = Math.min(lo, x.w - 1); hi = Math.max(hi, x.w + 1); });
  const X = (d) => L + (daysBetween(start, d) / span) * (W - L - R), Y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;margin-top:12px" role="img" aria-label="Weight trend against the target path">';
  for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + v + '</text>';
  ['2026-11-01', '2026-12-01', '2027-01-01'].forEach((m) => { s += '<text x="' + X(m).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" fill="var(--muted)" text-anchor="middle">' + MON[pISO(m).getMonth()] + '</text>'; });
  const TP = D.TARGET_PATH;
  s += '<path d="M' + TP.map((p) => X(p[0]).toFixed(1) + ' ' + Y(p[3]).toFixed(1)).join(' L') + ' L' + TP.slice().reverse().map((p) => X(p[0]).toFixed(1) + ' ' + Y(p[2]).toFixed(1)).join(' L') + ' Z" fill="var(--good)" opacity=".13"/>';
  s += '<path d="M' + TP.map((p) => X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' L') + '" fill="none" stroke="var(--good)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".8"/>';
  const td = todayISO(); if (td >= start && td <= end) s += '<line x1="' + X(td).toFixed(1) + '" x2="' + X(td).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--fg-2)" stroke-width="1" opacity=".35"/>';
  ws.forEach((x) => { s += '<circle cx="' + X(x.d).toFixed(1) + '" cy="' + Y(x.w).toFixed(1) + '" r="2.4" fill="var(--fg-2)" opacity=".55"/>'; });
  const av = ws.map((x) => ({ d: x.d, a: avg7(x.d) })).filter((x) => x.a != null);
  if (av.length > 1) s += '<path d="M' + av.map((x) => X(x.d).toFixed(1) + ' ' + Y(x.a).toFixed(1)).join(' L') + '" fill="none" stroke="var(--train)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  if (av.length) { const z = av[av.length - 1]; s += '<circle cx="' + X(z.d).toFixed(1) + '" cy="' + Y(z.a).toFixed(1) + '" r="4.5" fill="var(--train)" stroke="var(--card)" stroke-width="2"/>'; }
  if (!ws.length) s += '<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" font-size="12" fill="var(--muted)">Your weigh-ins and 7-day average appear here</text>';
  s += '</svg><div class="row xs muted" style="gap:14px;margin-top:4px"><span><span style="display:inline-block;width:14px;height:3px;background:var(--train);vertical-align:middle;border-radius:2px"></span> 7-day avg</span><span><span style="display:inline-block;width:14px;height:8px;background:var(--good);opacity:.3;vertical-align:middle;border-radius:2px"></span> On-track range</span></div>';
  return s;
}

/* ------------------------------------------------------------------ SETTINGS layer */
function lSettings() {
  const st = S.settings;
  let h = '<div class="layer"><div class="wrap"><div class="lbar pad solid"><button class="icon-btn" data-a="pop" aria-label="Back">' + ic('back') + '</button><div class="h-sm">Settings</div><span style="width:44px"></span></div><div class="pad stack" style="margin-top:8px">';
  h += '<div class="card stack"><label><span class="lbl">Name</span><input class="field" id="setName" data-in="setting" data-k="name" value="' + esc(st.name || '') + '"></label>' +
    '<div><span class="lbl">Weight unit</span><div class="seg">' + ['lb', 'kg'].map((u) => '<button class="' + (st.unit === u ? 'on' : '') + '" data-a="setting" data-k="unit" data-v="' + u + '">' + u + '</button>').join('') + '</div><p class="xs muted" style="margin:6px 0 0">The plan is written in lb. Switching only changes labels.</p></div>' +
    '<div class="row"><span class="grow"><span style="font-weight:600;display:block">Voice cues during timers</span><span class="small muted">"Next: dead bug", side switches</span></span><button class="toggle' + (st.voice ? ' on' : '') + '" data-a="setting" data-k="voice" data-v="' + (!st.voice) + '" aria-pressed="' + !!st.voice + '" aria-label="Voice cues"></button></div>' +
    '<div class="row"><span class="grow"><span style="font-weight:600;display:block">Ocean sound under meditations</span><span class="small muted">Soft background swell</span></span><button class="toggle' + (st.ambient ? ' on' : '') + '" data-a="setting" data-k="ambient" data-v="' + (!st.ambient) + '" aria-pressed="' + !!st.ambient + '" aria-label="Ocean sound"></button></div>' +
    '<div class="row"><span class="grow"><span style="font-weight:600;display:block">Calorie adjustment</span><span class="small muted">From the calibration rule</span></span><div class="row" style="gap:6px"><button class="icon-btn" style="width:36px;height:36px" data-a="kcalAdj" data-v="-150" aria-label="Minus 150">' + ic('minus') + '</button><span class="tnum" style="min-width:52px;text-align:center;font-weight:700">' + (st.kcalAdj > 0 ? '+' : '') + (st.kcalAdj || 0) + '</span><button class="icon-btn" style="width:36px;height:36px" data-a="kcalAdj" data-v="150" aria-label="Plus 150">' + ic('plus') + '</button></div></div></div>';
  h += hkSettingsCard();
  h += '<div class="card stack"><div class="row"><span class="grow"><span style="font-weight:600;display:block">Storage</span><span class="small muted">' + syncLabel() + '</span><span class="small muted" style="display:block">' + storageDetail() + '</span></span></div><div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn ghost sm" data-a="exportData">Save a backup file</button><label class="btn ghost sm" style="cursor:pointer">Restore backup<input type="file" accept="application/json,.json" data-in="import" hidden></label></div><p class="xs muted" style="margin:0">Your logs are private to you. Backups are a JSON file you keep.</p></div>';
  h += '<div class="card"><h3 class="h-sm">Red flags: see a doctor now</h3><ul class="small fg2" style="margin:8px 0 0;padding-left:18px">' + D.RED_FLAGS.map((x) => '<li style="margin:4px 0">' + esc(x) + '</li>').join('') + '</ul><p class="small muted" style="margin:8px 0 0">For the MRI in Sri Lanka: bring your PT notes and dates, and have a spine specialist go through the scan with you.</p></div>';
  h += '<div class="card"><div class="row"><span class="grow"><span style="font-weight:600;display:block">Reset everything</span><span class="small muted">Deletes all logs on this device and in sync</span></span><button class="btn ghost sm" style="color:var(--bad)" data-a="resetAsk">' + (ui.resetArm ? 'Tap again to confirm' : 'Reset') + '</button></div></div>';
  return h + '<p class="xs muted" style="text-align:center;margin-top:8px">Exercise photos: Free Exercise DB (public domain). Guided audio and plan: Fresh Start 2.0.</p></div></div></div>';
}

/* ------------------------------------------------------------------ SHEETS */
function renderSheet(sh) {
  const p = sh.p || {}, date = ui.date;
  if (sh.v === 'ready') {
    // the check belongs to the day of the screen it was opened from (a workout can be for another day)
    const rd = p.date || topDate(), ok = !!readiness(rd);
    const cta = p.go ? '<button class="btn train block" style="margin-top:16px" data-a="readyGo"' + (ok ? '' : ' disabled') + '>' + (ok ? 'Start workout' : 'Sleep and neck, then start') + '</button>'
      : '<button class="btn train block" style="margin-top:16px" data-a="closeSheet">Done</button>';
    return '<h2 class="h-lg">Readiness</h2><p class="small fg2" style="margin:6px 0 12px">' + esc(fmtD(rd)) + '. Thirty seconds, then train.</p>' + readinessForm(rd) + (ok ? '<div style="margin-top:14px">' + tierBanner(rd) + '</div>' : '') + cta;
  }
  if (sh.v === 'hkpaste') return hkPasteSheet();
  if (sh.v === 'exinfo') return exInfoSheet(p);
  if (sh.v === 'food') return foodSheet(p);
  if (sh.v === 'foodInfo') {
    const f = foodById(p.s) || {}; const g = D.GUIDES.find((x) => x.id === (f.slot === 'lunch' ? 'plate' : ''));
    return '<div class="food" style="background:none;padding:0"><span class="fa art-' + (f.tone || 'plate') + '" style="width:72px;height:72px">' + foodGlyph(f.tone || 'plate', 38) + '</span><div><h2 class="h-lg">' + esc(f.n || 'Food') + '</h2><div class="small muted">' + esc(f.d || '') + '</div></div></div>' +
      '<div class="kv" style="margin-top:16px;grid-template-columns:repeat(4,1fr)"><div><div class="v tnum" style="font-size:22px">' + (f.kcal || 0) + '</div><div class="k">kcal</div></div><div><div class="v tnum" style="font-size:22px">' + (f.p || 0) + '</div><div class="k">Protein g</div></div><div><div class="v tnum" style="font-size:22px">' + (f.c || 0) + '</div><div class="k">Carbs g</div></div><div><div class="v tnum" style="font-size:22px">' + (f.f || 0) + '</div><div class="k">Fat g</div></div></div>' +
      (g ? '<div class="card" style="margin-top:12px"><div class="h-sm">' + esc(g.t) + '</div><ul class="small fg2" style="margin:8px 0 0;padding-left:18px">' + g.body.map((x) => '<li style="margin:4px 0">' + esc(x) + '</li>').join('') + '</ul></div>' : '') +
      '<p class="xs muted" style="margin:10px 2px 0">Macros are estimates for typical portions.</p><div class="row" style="gap:10px;margin-top:14px"><button class="btn fuel grow" data-a="eat" data-v="' + f.id + '" data-s="' + f.slot + '">Log it</button><button class="btn ghost" data-a="sheet" data-v="food" data-s="' + f.slot + '">Swap</button></div>';
  }
  if (sh.v === 'guide') {
    const g = D.GUIDES.find((x) => x.id === p.s) || D.GUIDES[0];
    return '<h2 class="h-lg">' + esc(g.t) + '</h2><ul class="fg2" style="margin:12px 0 0;padding-left:18px">' + g.body.map((x) => '<li style="margin:8px 0">' + esc(x) + '</li>').join('') + '</ul><button class="btn ghost block" style="margin-top:18px" data-a="closeSheet">Close</button>';
  }
  if (sh.v === 'journal') {
    const g = peek(date).grat || [];
    return '<h2 class="h-lg">3 good things</h2><p class="small fg2" style="margin:6px 0 12px">' + esc(fmtD(date)) + '. Before bed, two minutes.</p><div class="stack">' + [0, 1, 2].map((i) => '<input class="field" id="sgrat' + i + '" data-in="grat" data-k="' + i + '" value="' + esc(g[i] || '') + '" placeholder="Good thing ' + (i + 1) + '">').join('') + '</div><button class="btn mind block" style="margin-top:16px" data-a="closeSheet">Done</button>';
  }
  if (sh.v === 'sunday') {
    const mon = mondayOf(date), sr = S.sunday[mon] || {}, c = calibration(date);
    let s = '<h2 class="h-lg">Sunday Reset</h2><p class="small fg2" style="margin:6px 0 12px">Week of ' + fmtShort(mon) + ' · 15 min</p>';
    if (c.rate != null) s += bannerHTML(c.tone, '<b>' + (c.rate >= 0 ? '−' : '+') + Math.abs(c.rate).toFixed(1) + ' lb this week.</b> ' + esc(c.rec));
    s += '<div class="list" style="margin-top:10px">' + D.SUNDAY_RESET.map((t, i) => '<div class="li"><span class="grow t">' + esc(t) + '</span>' + checkBtn(!!sr[i], 'sunday', i, t) + '</div>').join('') + '</div>';
    s += '<label><span class="lbl" style="margin-top:14px">One win from the week</span><input class="field" id="sunWin" data-in="sundayWin" value="' + esc(sr.win || '') + '" placeholder="A PR, a pain-free week, a good call at a party"></label>';
    return s + '<button class="btn train block" style="margin-top:16px" data-a="closeSheet">Done</button>';
  }
  if (sh.v === 'silent') return '<h2 class="h-lg">Silent timer</h2><p class="small fg2" style="margin:6px 0 14px">A bell to start, a bell to finish.</p><div class="row" style="gap:8px;flex-wrap:wrap">' + [5, 10, 15, 20, 30].map((m) => '<button class="btn ghost sm" data-a="silent" data-v="' + m + '">' + m + ' min</button>').join('') + '</div>';
  if (sh.v === 'gate') {
    const g = D.GATES.find((x) => x.id === p.s);
    return '<h2 class="h-lg">' + esc(g.n) + '</h2><p class="small fg2" style="margin:6px 0 14px">Opens when: ' + esc(g.rule) + '. The app reads your daily neck and back scores. Set it by hand if you haven’t been logging them.</p><div class="stack"><button class="btn good block" style="background:var(--good);color:#062014" data-a="gateSet" data-v="open" data-s="' + g.id + '">I’ve met it: open</button><button class="btn ghost block" data-a="gateSet" data-v="closed" data-s="' + g.id + '">Keep it locked</button><button class="btn ghost block" data-a="gateSet" data-v="" data-s="' + g.id + '">Use my check-ins</button></div>';
  }
  if (sh.v === 'pain') return painSheet(p);
  if (sh.v === 'swap') return swapSheet(p);
  if (sh.v === 'jump') return jumpSheet(p);
  return '';
}
function exInfoSheet(p) {
  const e = EX[p.ex] || {}, hist = [];
  Object.keys(S.days).sort().reverse().forEach((d) => Object.keys(S.days[d].sets || {}).forEach((k) => { if (k.split('|')[2] === p.ex) { const z = S.days[d].sets[k].filter((x) => x && x.done); if (z.length && hist.length < 5) hist.push({ d, z }); } }));
  let s = '<div style="border-radius:16px;overflow:hidden">' + exMedia(p.ex, 'pmedia') + '</div>';
  s += '<h2 class="h-lg" style="margin-top:14px">' + esc(e.n) + '</h2><div class="chips" style="margin-top:8px">' + (e.m ? '<span class="chip">' + esc(e.m) + '</span>' : '') + (e.eq ? '<span class="chip">' + esc(e.eq) + '</span>' : '') + '</div>';
  if (e.cues) s += '<ol class="fg2" style="margin:14px 0 0;padding-left:20px">' + e.cues.map((c) => '<li style="margin:6px 0">' + esc(c) + '</li>').join('') + '</ol>';
  if (p.k && p.s) {
    const alts = [EX[p.ex].alt, EX[p.ex].swapTo, p.base && p.base !== p.ex ? p.base : null].filter((x, i, a) => x && a.indexOf(x) === i && x !== p.ex);
    if (alts.length) s += '<div style="margin-top:16px"><span class="lbl">Swap for today</span><div class="stack">' + alts.map((x) => '<button class="li card" style="padding:10px" data-a="doSwap" data-v="' + x + '" data-k="' + p.k + '">' + exThumb(x, 44) + '<span class="grow t">' + esc(EX[x].n) + '</span>' + ic('swap').replace('<svg', '<svg width="18" height="18"') + '</button>').join('') + '</div></div>';
  }
  if (hist.length) s += '<div style="margin-top:16px"><span class="lbl">History</span><div class="list">' + hist.map((x) => '<div class="li" style="min-height:48px"><span class="small muted" style="width:86px">' + fmtD(x.d) + '</span><span class="small tnum grow">' + x.z.map((z) => (z.w ? z.w + '×' : '') + (z.r || z.t || '✓')).join('  ·  ') + '</span></div>').join('') + '</div></div>';
  return s + '<button class="btn ghost block" style="margin-top:18px" data-a="closeSheet">Close</button>';
}
function foodSheet(p) {
  const slot = p.s || 'snack', sl = D.SLOTS.find((x) => x.id === slot) || {};
  const recents = []; Object.keys(S.days).sort().reverse().forEach((d) => (S.days[d].meals || []).forEach((m) => { if (m.custom && !recents.some((r) => r.n === m.n)) recents.push(m); }));
  let s = '<h2 class="h-lg">Add to ' + esc(sl.n || 'meals') + '</h2><p class="small fg2" style="margin:6px 0 12px">Tap to log. Your plan’s meals come first.</p>';
  const mine = D.FOODS.filter((f) => f.slot === slot), others = D.FOODS.filter((f) => f.slot !== slot);
  s += '<div class="stack" style="gap:8px">' + mine.map((f) => foodPick(f, slot)).join('') + '</div>';
  if (recents.length) s += '<div class="lbl" style="margin-top:16px">Your recent</div><div class="stack" style="gap:8px">' + recents.slice(0, 6).map((f) => foodPick(f, slot, true)).join('') + '</div>';
  s += '<div class="lbl" style="margin-top:16px">Quick add</div><div class="card stack"><input class="field" id="cfName" placeholder="What did you eat?" aria-label="Food name"><div class="row" style="gap:8px"><input class="field" id="cfKcal" inputmode="numeric" placeholder="kcal" aria-label="Calories"><input class="field" id="cfP" inputmode="numeric" placeholder="Protein g" aria-label="Protein"></div><div class="row" style="gap:8px"><input class="field" id="cfC" inputmode="numeric" placeholder="Carbs g" aria-label="Carbs"><input class="field" id="cfF" inputmode="numeric" placeholder="Fat g" aria-label="Fat"></div><button class="btn fuel block" data-a="customFood" data-s="' + slot + '">Add</button></div>';
  s += '<details class="fold" style="margin-top:14px"><summary>Everything else</summary><div class="fb stack" style="gap:8px">' + others.map((f) => foodPick(f, slot)).join('') + '</div></details>';
  return s;
}
function foodPick(f, slot, custom) {
  return '<button class="food" data-a="' + (custom ? 'eatCustom' : 'eat') + '" data-v="' + esc(custom ? f.n : f.id) + '" data-s="' + slot + '"><span class="fa art-' + (f.tone || 'plate') + '" style="width:46px;height:46px">' + foodGlyph(f.tone || 'plate', 24) + '</span><span class="grow" style="min-width:0"><span class="ft" style="display:block">' + esc(f.n) + '</span><span class="fs" style="display:block">' + f.kcal + ' kcal · ' + f.p + ' g protein' + (f.d ? ' · ' + esc(f.d) : '') + '</span></span><span style="color:var(--fuel)">' + ic('plus').replace('<svg', '<svg width="20" height="20"') + '</span></button>';
}

/* ------------------------------------------------------------------ actions */
A.tab = (el) => { ui.tab = el.dataset.v; ui.stack = []; renderedLayers = 0; window.scrollTo(0, 0); render(); };
A.date = (el) => { ui.date = el.dataset.v; ui.editReady = false; ui.sleepManual = false; render(); };
A.sleepManual = () => { ui.sleepManual = true; render(); };
A.wk = (el) => { ui.date = addDays(ui.date, +el.dataset.v); render(); };
A.push = (el) => push(el.dataset.v, {});
A.pop = () => pop();
A.closeSheet = () => closeSheet();
A.sheet = (el) => openSheet(el.dataset.v, { s: el.dataset.s });
A.workout = (el) => push('workout', { date: ui.date, sid: el.dataset.v });
A.workoutMin = (el) => { closeSheet(); ui.sheet = null; push('workout', { date: ui.date, sid: el.dataset.v }); };
A.openDay = (el) => { const d = el.dataset.v, s = mainSession(plan(d)); ui.date = d; if (s) push('workout', { date: d, sid: s.sid }); else { ui.tab = 'today'; render(); } };
A.trainWeek = (el) => { ui.trainWeek = +el.dataset.v; render(); };
A.editReady = () => { ui.editReady = !ui.editReady; render(); };
/* readiness answers go to the day being checked: the sheet's day, else the open workout's, else the selected day */
function chkDate() { return (ui.sheet && ui.sheet.p && ui.sheet.p.date) || topDate(); }
A.chk = (el) => { const date = chkDate(), d = day(date); d.chk = d.chk || {}; d.chk[el.dataset.k] = +el.dataset.v; touch(date); render(); };
A.chkT = (el) => { const date = chkDate(), d = day(date); d.chk = d.chk || {}; d.chk[el.dataset.k] = !d.chk[el.dataset.k]; touch(date); render(); };
A.tick = (el) => {
  const k = el.dataset.v, date = topDate(), on = !isDone(date, k);
  setDone(date, k, on);
  if (on) Sound.done();
  render();
};
A.toggle = (el) => A.tick(el);
A.desk = (el) => { const d = day(ui.date); d.desk = Math.max(0, (d.desk || 0) + +el.dataset.v); touch(ui.date); render(); };
A.routine = (el) => openRoutine(el.dataset.v);
A.core = (el) => openCore(el.dataset.v, el.dataset.w ? +el.dataset.w : null);
A.mind = (el) => openMind(el.dataset.v);
A.logSnack = () => { ui.tab = 'fuel'; ui.stack = []; render(); openSheet('food', { s: 'snack' }); };
A.exInfo = (el) => { const l = ui.stack[ui.stack.length - 1]; openSheet('exinfo', { ex: el.dataset.v, k: el.dataset.k, s: el.dataset.s, base: el.dataset.k && l && l.p.sid ? (findSession(l.p.date, l.p.sid).src.items.find((i) => i.k === el.dataset.k) || {}).ex : null }); };
A.doSwap = (el) => { const date = topDate(), d = day(date); d.swaps = d.swaps || {}; const it = el.dataset.k; if (d.swaps[it] === el.dataset.v) delete d.swaps[it]; else d.swaps[it] = el.dataset.v; touch(date); closeSheet(); toast('Swapped to ' + EX[el.dataset.v].n); };
A.completeSession = (el) => { const date = topDate(); setDone(date, 's:' + el.dataset.v, true); Sound.done(); pop(); toast('Session complete'); };
A.undoSession = (el) => { setDone(topDate(), 's:' + el.dataset.v, false); render(); };
A.startBlock = (el) => openBlock(topDate(), el.dataset.s, +el.dataset.v);
A.startCardio = (el) => openCardio(topDate(), el.dataset.v);
A.startStrides = (el) => openStrides(topDate(), el.dataset.v);
A.eat = (el) => {
  const f = foodById(el.dataset.v); if (!f) return;
  const d = day(ui.date); d.meals = d.meals || [];
  d.meals.push({ fid: f.id, slot: el.dataset.s || f.slot, n: f.n, kcal: f.kcal, p: f.p, c: f.c, f: f.f, q: 1, free: !!f.free, tone: f.tone });
  touch(ui.date); ui.sheet = null; render(); toast(f.n + ' logged');
};
A.eatCustom = (el) => {
  let src = null; Object.keys(S.days).forEach((d) => (S.days[d].meals || []).forEach((m) => { if (m.custom && m.n === el.dataset.v) src = m; }));
  if (!src) return; const d = day(ui.date); d.meals = d.meals || [];
  d.meals.push(Object.assign({}, src, { slot: el.dataset.s })); touch(ui.date); ui.sheet = null; render(); toast(src.n + ' logged');
};
A.customFood = (el) => {
  const n = ($('#cfName').value || '').trim(), kcal = num($('#cfKcal').value), p = num($('#cfP').value) || 0;
  if (!n || kcal == null) { toast('Add a name and calories'); return; }
  const d = day(ui.date); d.meals = d.meals || [];
  d.meals.push({ custom: true, slot: el.dataset.s, n, kcal, p, c: num($('#cfC').value) || 0, f: num($('#cfF').value) || 0, q: 1, tone: 'plate' });
  touch(ui.date); ui.sheet = null; render(); toast(n + ' logged');
};
A.uneat = (el) => { const d = day(ui.date); d.meals.splice(+el.dataset.v, 1); touch(ui.date); render(); };
A.logPlan = () => {
  const d = day(ui.date); d.meals = d.meals || []; let n = 0;
  D.SLOTS.forEach((sl) => { const f = plannedFood(ui.date, sl.id); if (f && sl.id !== 'pre' && !d.meals.some((m) => m.slot === sl.id)) { d.meals.push({ fid: f.id, slot: sl.id, n: f.n, kcal: f.kcal, p: f.p, c: f.c, f: f.f, q: 1, tone: f.tone }); n++; } });
  touch(ui.date); render(); toast(n ? n + ' planned meals logged' : 'Every meal slot already has food');
};
A.water = (el) => { const d = day(ui.date), v = +el.dataset.v; d.water = d.water === v ? v - 1 : v; touch(ui.date); render(); };
A.supp = (el) => { const d = day(ui.date); d.supps = d.supps || {}; d.supps[el.dataset.v] = !d.supps[el.dataset.v]; touch(ui.date); render(); };
A.drink = (el) => { const d = day(ui.date); d.drinks = d.drinks || {}; d.drinks[el.dataset.v] = Math.max(0, (d.drinks[el.dataset.v] || 0) + +el.dataset.d); touch(ui.date); render(); };
A.kcalAdj = (el) => { S.settings.kcalAdj = el.dataset.v === 'reset' ? 0 : (S.settings.kcalAdj || 0) + +el.dataset.v; touch(); render(); toast('Daily target ' + (S.settings.kcalAdj > 0 ? '+' : '') + S.settings.kcalAdj + ' kcal'); };
A.gateOv = (el) => openSheet('gate', { s: el.dataset.v });
A.gateSet = (el) => { if (el.dataset.v) S.settings.gate[el.dataset.s] = el.dataset.v; else delete S.settings.gate[el.dataset.s]; touch(); closeSheet(); };
A.sunday = (el) => { const mon = mondayOf(ui.date); S.sunday[mon] = S.sunday[mon] || {}; S.sunday[mon][el.dataset.v] = !S.sunday[mon][el.dataset.v]; touch(); if (D.SUNDAY_RESET.every((_, i) => S.sunday[mon][i])) setDone(ui.date, 'reset', true); render(); };
A.setting = (el) => { const k = el.dataset.k, v = el.dataset.v; S.settings[k] = v === 'true' ? true : v === 'false' ? false : v; touch(); render(); };
A.quiz = (el) => push('quiz', { k: el.dataset.v, a: [] });
A.silent = (el) => { closeSheet(); openSilent(+el.dataset.v); };
A.exportData = async () => {
  const data = JSON.stringify(S, null, 1), name = 'fresh-start-backup-' + todayISO() + '.json';
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: name, data }); toast('Backup saved'); return; } } catch (e) { /* fall through */ }
  if (!window.claude) {
    // installed iPhone app: share sheet ("Save to Files"), else a normal download
    try {
      const file = new File([data], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Fresh Start backup' }); return; }
      const u = URL.createObjectURL(file), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); toast('Backup saved'); return;
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(data); toast('Backup copied to clipboard'); } catch (e) { toast('Saving files is not available here'); }
};
A.resetAsk = () => {
  if (!ui.resetArm) { ui.resetArm = true; render(); setTimeout(() => { ui.resetArm = false; }, 4000); return; }
  ui.resetArm = false; const keep = S.settings.name; S = blank(); S.settings.name = keep; S.u = Date.now();
  Object.keys(Cloud.ready ? {} : {}).forEach(() => {}); lsSet();
  if (Cloud.ready) { Cloud.col().get().then((snap) => snap.docs.forEach((d) => { if (d.id !== 'meta') Cloud.col().doc(d.id).delete(); })).catch(() => {}); Cloud.dirty.add('meta'); Cloud.schedule(300); }
  ui.stack = []; render(); toast('Everything reset');
};
function topDate() { const l = ui.stack.slice().reverse().find((x) => x.p && x.p.date); return l ? l.p.date : ui.date; }

/* inputs */
const IN = {
  bench: (el) => { const k = el.dataset.k; S.bench[k] = S.bench[k] || {}; S.bench[k][el.dataset.c] = el.value.trim(); touch(); },
  weight: (el) => { const d = day(ui.date); d.weight = el.value.trim(); delete d.wsrc; touch(ui.date); },
  steps: (el) => { const d = day(ui.date); d.steps = el.value.trim(); delete d.ssrc; touch(ui.date); },
  grat: (el) => { const d = day(ui.date); d.grat = d.grat || ['', '', '']; d.grat[+el.dataset.k] = el.value; touch(ui.date); },
  journal: (el) => { const d = day(ui.date); d.journal = el.value; touch(ui.date); },
  sundayWin: (el) => { const mon = mondayOf(ui.date); S.sunday[mon] = S.sunday[mon] || {}; S.sunday[mon].win = el.value; touch(); },
  setting: (el) => { S.settings[el.dataset.k] = el.value; touch(); },
  cardio: (el) => { const date = topDate(), d = day(date); d.cardio = d.cardio || {}; d.cardio[el.dataset.s] = d.cardio[el.dataset.s] || {}; d.cardio[el.dataset.s][el.dataset.k] = el.value.trim(); touch(date); },
  import: (el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const o = JSON.parse(r.result); if (!o || !o.days) throw new Error('bad'); S = Object.assign(blank(), o); S.u = Date.now(); Object.keys(S.days).forEach((dd) => { S.days[dd].u = Date.now(); Cloud.dirty.add('w-' + mondayOf(dd)); }); Cloud.dirty.add('meta'); lsSet(); Cloud.schedule(300); render(); toast('Backup restored'); } catch (e) { toast('That file is not a Fresh Start backup'); } };
    r.readAsText(f);
  },
};
const RERENDER_ON_CHANGE = { weight: 1, steps: 1, bench: 0 };

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const fn = A[el.dataset.a] || (window.PA && window.PA[el.dataset.a]);
  if (!fn) return;
  ev.preventDefault();
  Sound.ensure();
  fn(el, ev);
});
document.addEventListener('keydown', (ev) => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role="button"][data-a]')) { ev.preventDefault(); ev.target.click(); }
  if (ev.key === 'Escape') { if (ui.sheet) closeSheet(); else if (ui.stack.length) pop(); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-in]'); if (!el) return;
  const fn = IN[el.dataset.in] || (window.PIN && window.PIN[el.dataset.in]);
  if (fn && el.type !== 'file') fn(el, ev);
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-in]'); if (!el) return;
  if (el.type === 'file') { (el.dataset.in === 'hkfile' ? IN.hkfile : IN.import)(el); return; }
  if (RERENDER_ON_CHANGE[el.dataset.in]) render();
});

/* ------------------------------------------------------------------ boot */
async function boot() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* not supported */ }
  const saved = lsGet();
  if (saved && saved.days) S = Object.assign(blank(), saved, { settings: Object.assign(blank().settings, saved.settings || {}) });
  // restore anything the IndexedDB mirror has that localStorage lost
  try {
    const mirror = await Promise.race([IDBStore.read(), new Promise((r) => setTimeout(() => r(null), 1500))]);
    if (mergeState(mirror)) { S.settings = Object.assign(blank().settings, S.settings || {}); lsSet(); }
    else if (saved) IDBStore.queue(JSON.stringify(S));
  } catch (e) { /* mirror unavailable */ }
  Cloud.bootDays = new Set(Object.keys(S.days)); Cloud.bootU = S.u || 0;
  try { if (navigator.storage && navigator.storage.persisted) ui.persisted = await navigator.storage.persisted(); } catch (e) { /* unknown */ }
  if (location.hash && ['today', 'train', 'fuel', 'mind', 'progress'].includes(location.hash.slice(1))) ui.tab = location.hash.slice(1);
  render();
  fetch('audio/tracks.json').then((r) => r.json()).then((j) => { TRACKS = j; }).catch(() => {});
  await Cloud.init();
  render();
  // keep "today" fresh if the app stays open past midnight. iOS keeps a home-screen app in memory for days,
  // so check the moment it comes back too: otherwise the first minute of taps would be logged to yesterday.
  let lastDay = todayISO();
  const rollover = () => { const t = todayISO(); if (t !== lastDay) { if (ui.date === lastDay) ui.date = t; lastDay = t; render(); } };
  setInterval(rollover, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rollover(); });
  window.addEventListener('pageshow', rollover);
  window.addEventListener('focus', rollover);
}
