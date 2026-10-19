/* AI food logging, Cal AI style: scan a plate, a nutrition label or a barcode, or describe a meal.
   Analysis runs in the background (progress card on Fuel), then one meal is logged and its Result screen opens for edits.
   Calls the Google Gemini API straight from the browser with the user's own key (JSON-schema output).
   The key lives in localStorage only (never in S, never synced, never in backups); so do the ~160px thumbnails. */
'use strict';

const AI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']; // free-tier flash models, fastest and steadiest first (Oct 2026 testing); Pro needs a paid plan // tried in order when one is overloaded or retired
const AI_API = 'https://generativelanguage.googleapis.com/v1beta/models/';
const AI_KEY_LS = 'fs_ai_key';
const AI_TH_LS = 'fs_ai_thumbs';
const AI_SYSTEM = 'You are a nutrition estimator inside a personal training app. The user is on a fat-loss plan and logs every meal, so be realistic, not optimistic: ' +
  'estimate typical serving sizes (cafe and restaurant portions run large), include cooking oil, butter, sauces, milk in coffee and dressings, and never round calories down to flatter the day. ' +
  'Foods are mostly Australian or American. Split the meal into separate items (one per food or drink), each with a sensible gram or ml weight and its own calories and macros in grams. ' +
  'If a photo is supplied, identify each item and judge portion size from the plate, cutlery and context. Follow any hint from the user (for example half portion). ' +
  'Also estimate fiber (g), total sugars (g) and sodium (mg) for each item. Give the whole meal a short meal_name (2 to 5 words), a health_score from 1 (very poor) to 10 (excellent) judged on whole foods, protein, fibre, added sugar and processing, and a one-line health_reason. ' +
  'Always answer with the JSON object. Use the note field for one short sentence on your biggest uncertainty.';
const AI_X_LABEL = 'The photo shows a packaged-food nutrition facts panel. Read the printed numbers exactly, do not estimate them. Return ONE item named after the product (or "Packaged food" if unreadable). ' +
  'Use the per-serving column and put the printed serving size in grams or ml in grams. Assume the user eats exactly one serving unless they say otherwise, and say that in the note together with the serving size. Score health from the label.';
const AI_X_BARCODE = 'The photo shows a packaged product whose barcode could not be matched in a database. Identify the product from the packaging, brand and size if you can, and estimate one serving realistically. Say in the note that this is an estimate, not a label reading.';
const AI_X_FIX = 'You previously estimated a meal (JSON below). The user is correcting it. Apply the correction faithfully, re-estimate whatever it changes, keep what it does not, and return the complete corrected meal.';
const AI_X_ING = 'Estimate ONLY the single ingredient or food the user names, with its realistic weight and macros. Return exactly one item. meal_name is that food, and health_score rates that food alone.';
const AI_BAR_SYSTEM = 'You read barcodes from photos. Find the barcode (EAN-13, EAN-8 or UPC-A) and return its digits exactly as printed under the bars. If you cannot read every digit with confidence, return an empty string for digits. Never guess digits.';
const AI_ITEM = { type: 'object', properties: { name: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }, fiber: { type: 'number', description: 'grams' }, sugar: { type: 'number', description: 'total sugars, grams' }, sodium: { type: 'number', description: 'milligrams' } }, required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'] };
const AI_TOOL = {
  name: 'log_meal',
  description: 'Record the itemised nutrition estimate for the meal.',
  input_schema: { type: 'object', properties: {
    meal_name: { type: 'string' }, health_score: { type: 'integer', minimum: 1, maximum: 10 }, health_reason: { type: 'string' },
    items: { type: 'array', items: AI_ITEM }, note: { type: 'string' } },
    required: ['meal_name', 'health_score', 'health_reason', 'items', 'note'] },
};
const AI_EX_TOOL = { name: 'log_exercise', description: 'Record the estimated energy burned by the exercise.', input_schema: { type: 'object', properties: { name: { type: 'string' }, kcal: { type: 'number' }, note: { type: 'string' } }, required: ['name', 'kcal', 'note'] } };
const AI_EX_SYSTEM = 'You estimate calories burned by exercise for a personal training app. Be realistic, not generous: use the person\'s body weight if given, the activity, intensity and duration, and report ACTIVE energy only (above resting). Answer with the JSON object: a short name, kcal as a whole number and a one-line note.';
const AI_EX_TYPES = ['Run', 'Weight lifting', 'Walk', 'Cycling', 'Describe…'];
const AI_NUT_TG = { fiber: 30, sugar: 50, sodium: 2300 }; // fiber is a minimum, sugar (g) and sodium (mg) are limits
const AI_SAVED_LS = 'fs_ai_saved';
const AI_SHEETS = ['ai', 'aikey', 'aiadd', 'aibar', 'aires', 'aifix', 'aiing', 'aiex', 'aisaved'];
const AI_ROLL_CAP = 200;
const AI_BAR_TOOL = { name: 'read_barcode', description: 'Return the barcode digits read from the photo.', input_schema: { type: 'object', properties: { digits: { type: 'string' }, product_hint: { type: 'string' } }, required: ['digits'] } };
const AI_STAGES = {
  photo: ['Analyzing food…', 'Separating ingredients…', 'Ingredients identified', 'Breaking down macros…'], label: ['Reading label…', 'Checking serving size…', 'Ingredients identified', 'Breaking down macros…'],
  barcode: ['Reading barcode…', 'Looking up product…', 'Ingredients identified', 'Breaking down macros…'], text: ['Analyzing food…', 'Separating ingredients…', 'Ingredients identified', 'Breaking down macros…'],
};
const aiStage = (src, p) => (AI_STAGES[src] || AI_STAGES.photo)[p < 25 ? 0 : p < 50 ? 1 : p < 75 ? 2 : 3];
const AI_SRC_N = { photo: 'Photo scan', label: 'Food label', barcode: 'Barcode', text: 'Described' };

const AI = { jobs: [], res: null, edit: -1, full: {}, th: null, src: 'photo', slotHint: null, text: '', fix: '', ing: '', bar: '', barImg: null, busy: false, err: '', timer: null, tok: 0, ex: null, rec: null };
const aiKey = () => { try { return localStorage.getItem(AI_KEY_LS) || ''; } catch (e) { return ''; } };
const aiNum = (v) => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0; };
const aiR2 = (n) => Math.round(n * 100) / 100;
const aiId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

(function () { // styles, injected so the main stylesheet stays untouched
  const st = document.createElement('style');
  st.textContent = '@keyframes aispin{to{transform:rotate(360deg)}}.aispin{width:18px;height:18px;border-radius:50%;border:2.5px solid var(--fill);border-top-color:var(--fuel);animation:aispin .8s linear infinite;flex:none}' +
    '.aifab{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(var(--tabh) + 24px + env(safe-area-inset-bottom,0px));width:58px;height:58px;border-radius:50%;background:var(--fuel);color:var(--fuel-ink);display:grid;place-items:center;box-shadow:0 8px 22px rgba(255,45,85,.38),0 2px 6px rgba(0,0,0,.25);z-index:19;transition:transform .12s}.aifab:active{transform:scale(.92)}.aifab svg{width:28px;height:28px}' +
    '.aistreak{display:inline-flex;align-items:center;gap:4px;height:34px;padding:0 11px;border-radius:17px;background:var(--fill);font-family:var(--rounded);font-weight:700;font-size:16px}.aistreak svg{width:17px;height:17px;color:#FF9F0A}' +
    '.aihero-main{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left}.aihero-main .aib{font-family:var(--rounded);font-weight:700;font-size:56px;line-height:.95;letter-spacing:-.03em}.aiR{display:block;position:relative;width:112px;height:112px;flex:none}.aiR svg.rg{position:absolute;inset:0;transform:rotate(-90deg)}.aiR .c{position:absolute;inset:0;display:grid;place-items:center;color:var(--fuel)}.aiR .c svg{width:30px;height:30px}' +
    '.aimacs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.aimacs .card{padding:12px 10px 12px 12px;margin:0}.aimac-n{font-family:var(--rounded);font-weight:700;font-size:22px;letter-spacing:-.02em;line-height:1.1}.aiR.s{width:44px;height:44px}.aiR.s .c{font-size:13px;font-weight:700;font-family:var(--rounded)}' +
    '.aijob .thumbs{width:56px;height:56px;border-radius:13px;object-fit:cover;flex:none;background:var(--card-3)}.aijob .bar{margin-top:7px}.aijob .bar>i{background:var(--fuel);transition:width .3s linear}' +
    '.aitiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.aitile{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:16px 14px;border-radius:20px;background:var(--sheet-card);text-align:left;font-weight:600;font-size:16px;transition:transform .12s}.aitile:active{transform:scale(.97)}.aitile .ti{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--fuel) 16%,transparent);color:var(--fuel)}.aitile .ti svg{width:24px;height:24px}.aitile .xs{font-weight:400;margin-top:-6px}' +
    '.aires-img{width:100%;height:210px;object-fit:cover;border-radius:22px;display:block;margin:2px 0 12px}.aires-name{font-size:24px;font-weight:700;letter-spacing:-.01em;height:44px;background:transparent!important;padding:0 2px!important}' +
    '.aigrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.aigrid .card{padding:12px;margin:0}.aibigk{font-family:var(--rounded);font-weight:700;font-size:44px;line-height:1;letter-spacing:-.03em}.aigrid .v{font-family:var(--rounded);font-weight:700;font-size:24px;line-height:1.1}' +
    '.aiscore .bar{height:10px;margin-top:8px}.aiing{display:block;width:100%;text-align:left;padding:10px 0}.aiing+.aiing,.aiing+.aiedit+.aiing{border-top:.5px solid var(--line)}.aiedit{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 0 10px}.aiedit .field{height:40px;padding:0 6px;text-align:center}.aiedit .full{grid-column:1/-1}' +
    '.aiseg{margin-top:12px}.aichips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.aichips button{height:36px;padding:0 14px;border-radius:18px;background:var(--fill);font-weight:600;font-size:14px;color:var(--fg-2)}.aichips button.on{background:color-mix(in srgb,var(--fuel) 20%,transparent);color:var(--fuel)}.aimic{width:46px;height:46px;border-radius:50%;background:var(--fill);color:var(--fuel);display:grid;place-items:center;flex:none}.aimic.on{background:var(--fuel);color:var(--fuel-ink);animation:aipulse 1.2s ease-in-out infinite}@keyframes aipulse{50%{opacity:.6}}.aiband{display:flex;gap:4px;margin-top:10px}.aiband i{flex:1;height:8px;border-radius:4px;background:var(--fill-2)}.aimini{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.aimini .card{padding:10px;margin:0}.aibm{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--fill);color:var(--fg-2)}.aibm.on{color:var(--fuel);background:color-mix(in srgb,var(--fuel) 18%,transparent)}.aistep{display:flex;align-items:center;gap:6px}.aistep b{min-width:40px;text-align:center;font-family:var(--rounded);font-size:20px}';
  document.head.appendChild(st);
})();

const AI_IC = {
  roll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>',
  run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="14.5" cy="5" r="1.8"/><path d="M9 20l2.5-5-2.5-2 1.5-4 3.5 1 2.5 3M7 11l3-3M12 15l3.5 1.5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z"/></svg>',
  bar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17M8 8.5v7M11 8.5v7M14 8.5v7M16.5 8.5v7"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.4 2.6c.3 3-1.4 4.4-2.8 6C8.2 10.2 7 11.6 7 14a5 5 0 0 0 10 0c0-2-1-3.4-1.9-4.6-.3 1-.9 1.7-1.7 2 .5-3-.1-6-1-8.8Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};

/* ---------------------------------------------------------------- thumbnails (localStorage, never S) */
function aiThumbs() {
  if (AI.th) return AI.th;
  try { AI.th = JSON.parse(localStorage.getItem(AI_TH_LS) || '{}') || {}; } catch (e) { AI.th = {}; }
  return AI.th;
}
const aiThumb = (id) => aiThumbs()[id] || null;
function aiThumbSet(id, url) {
  const t = aiThumbs(); delete t[id]; t[id] = url;
  let ks = Object.keys(t); while (ks.length > 40) delete t[ks.shift()];
  for (let i = 0; i < 6; i++) { // out of space: shed the oldest and retry
    try { localStorage.setItem(AI_TH_LS, JSON.stringify(t)); return; } catch (e) { ks = Object.keys(t); if (ks.length <= 1) return; delete t[ks[0]]; }
  }
}
function aiMakeThumb(src) {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      const s = 160, cv = document.createElement('canvas'); cv.width = s; cv.height = s;
      const m = Math.min(im.naturalWidth, im.naturalHeight), sx = (im.naturalWidth - m) / 2, sy = (im.naturalHeight - m) / 2;
      cv.getContext('2d').drawImage(im, sx, sy, m, m, 0, 0, s, s); ok(cv.toDataURL('image/jpeg', 0.7));
    };
    im.onerror = () => ok(null); im.src = src;
  });
}

/* ---------------------------------------------------------------- budget maths */
function aiGuessSlot(hr) {
  const h = hr == null ? new Date().getHours() : hr, ids = D.SLOTS.map((s) => s.id), pick = (id) => (ids.includes(id) ? id : 'snack');
  return h < 10 ? pick('breakfast') : h < 15 ? pick('lunch') : h < 17 ? 'snack' : pick('dinner');
}
function aiHk(date) { // Apple Health active energy, when the toggle is on
  if (!(S.settings && S.settings.aiBurn) || typeof hkOf !== 'function') return 0;
  const h = hkOf(date); return h && h.kcal > 0 ? Math.round(h.kcal) : 0;
}
const aiExSum = (date) => (peek(date).ex || []).reduce((a, x) => a + (+x.kcal || 0), 0);
function aiRoll(date) { // unused calories from yesterday, only when yesterday had a meal logged
  if (!(S.settings && S.settings.aiRollover)) return 0;
  const y = addDays(date, -1); if (!mealsFor(y).length) return 0;
  return Math.round(Math.min(AI_ROLL_CAP, Math.max(0, targets(y).kcal - totals(y).kcal)));
}
/* THE budget helper: hero, result screen, toasts and the score all read it. burn = Apple Health and/or logged exercise (max when both on) */
function aiBudget(date) {
  date = date || ui.date;
  const tg = targets(date), tt = totals(date), hk = aiHk(date), ex = S.settings && S.settings.aiExBack ? Math.round(aiExSum(date)) : 0;
  const burn = Math.max(hk, ex), roll = aiRoll(date), budget = tg.kcal + burn + roll;
  return { kcal: budget - tt.kcal, p: tg.p[0] - tt.p, tg, tt, burn, hk, ex, both: hk > 0 && ex > 0, roll, budget };
}
const aiRemaining = aiBudget;
const aiLeft = (k) => (k >= 0 ? fmtN(k) + ' left today' : fmtN(-k) + ' over today');
function aiStreak() {
  let n = 0, d = todayISO(); if (!mealsFor(d).length) d = addDays(d, -1);
  while (mealsFor(d).length && n < 400) { n++; d = addDays(d, -1); }
  return n;
}
const aiSum = (items) => items.reduce((a, x) => ({ k: a.k + x.kcal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f, fi: a.fi + (x.fi || 0), su: a.su + (x.su || 0), na: a.na + (x.na || 0), hasN: a.hasN || x.fi != null || x.su != null || x.na != null }), { k: 0, p: 0, c: 0, f: 0, fi: 0, su: 0, na: 0, hasN: false });
function aiNutTotals(date) { // fiber g, sugar g, sodium mg from AI-logged meals only; the rest count as unknown
  const t = { fi: 0, su: 0, na: 0, n: 0, all: 0 };
  mealsFor(date).forEach((m) => { t.all++; if (m.nut) { t.n++; t.fi += m.nut.fi || 0; t.su += m.nut.su || 0; t.na += m.nut.na || 0; } });
  return t;
}

/* ---------------------------------------------------------------- meal record */
function aiMealFrom(r) {
  const T = aiSum(r.items), sv = r.servings, r1 = (n) => Math.round(n * 10) / 10, nut = T.hasN ? { fi: r1(T.fi * sv), su: r1(T.su * sv), na: Math.round(T.na * sv) } : undefined;
  return { custom: true, ai: { id: r.id, items: r.items.map((x) => Object.assign({}, x)), score: r.score, why: r.why, servings: sv, src: r.src, t: r.time, note: r.note || '' },
    slot: r.slot, n: r.name, kcal: Math.round(T.k * sv), p: r1(T.p * sv), c: r1(T.c * sv), f: r1(T.f * sv), q: 1, tone: 'plate', nut };
}
function aiFindMeal(date, id) { return mealsFor(date).find((m) => m.ai && m.ai.id === id) || null; }
function aiCommit() {
  const r = AI.res; if (!r) return;
  const m = aiFindMeal(r.date, r.id); if (!m) return;
  Object.assign(m, aiMealFrom(r)); touch(r.date);
}
function aiCloneMeal(m) { // a recent AI meal logged again gets its own id so edits stay separate
  const c = JSON.parse(JSON.stringify(m)); if (!c.ai) return c;
  const old = c.ai.id; c.ai.id = aiId(); const t = aiThumb(old); if (t) aiThumbSet(c.ai.id, t); return c;
}

/* ---------------------------------------------------------------- entry points */
A.aiAdd = (el) => {
  AI.slotHint = el && el.dataset && el.dataset.s || null; AI.err = '';
  openSheet('aiadd');
};
let aiFileEl = null;
function aiFileInput() {
  if (aiFileEl) return aiFileEl;
  aiFileEl = document.createElement('input'); aiFileEl.type = 'file'; aiFileEl.accept = 'image/*'; aiFileEl.setAttribute('aria-hidden', 'true'); aiFileEl.tabIndex = -1;
  aiFileEl.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
  aiFileEl.addEventListener('change', async () => {
    const f = aiFileEl.files && aiFileEl.files[0]; aiFileEl.value = '';
    if (!f) return;
    try { const img = await aiReadFile(f); aiStart({ src: AI.src, img }); } catch (e) { toast('That photo could not be read. Try another one.'); }
  });
  document.body.appendChild(aiFileEl); return aiFileEl;
}
A.aiPick = (el) => {
  const v = el.dataset.v;
  if (!aiKey()) { openSheet('aikey'); return; }
  if (v === 'text') { AI.err = ''; openSheet('ai'); return; }
  AI.src = v === 'lib' ? 'photo' : v;
  const inp = aiFileInput();
  if (v === 'lib') inp.removeAttribute('capture'); else inp.setAttribute('capture', 'environment');
  inp.click();
};
A.aiKeySave = () => {
  const el = $('#aiKeyIn'), v = el ? el.value.trim() : '';
  if (!/^(AIza|AQ\.)[\w.-]{20,}$/.test(v)) { toast('That does not look like a Gemini API key'); return; }
  try { localStorage.setItem(AI_KEY_LS, v); } catch (e) { toast('Could not save the key on this device'); return; }
  toast('Key saved on this device');
  if (ui.sheet && ui.sheet.v === 'aikey') openSheet('aiadd'); else render();
};
A.aiKeyClear = () => { try { localStorage.removeItem(AI_KEY_LS); } catch (e) { /* ignore */ } toast('Key removed'); render(); };
A.aiHeroTog = () => { ui.aiHero = ui.aiHero === 'eaten' ? 'left' : 'eaten'; render(); };
A.aiTextGo = () => {
  if (!AI.text.trim()) { toast('Describe what you ate first'); return; }
  if (AI.rec) { try { AI.rec.stop(); } catch (e) { /* ignore */ } }
  const t = AI.text.trim(); AI.text = ''; aiStart({ src: 'text', text: t });
};
A.aiBarGo = () => {
  const c = (AI.bar || '').replace(/\D/g, '');
  if (c.length < 8) { toast('Enter the 8 to 13 digits under the barcode'); return; }
  const img = AI.barImg; AI.bar = ''; AI.barImg = null; aiStart({ src: 'barcode', img, code: c });
};
A.aiJobRetry = (el) => { const j = AI.jobs.find((x) => x.id === el.dataset.v); if (j) { j.pct = 3; render(); aiTick(); aiRun(j); } };
A.aiJobDrop = (el) => { AI.jobs = AI.jobs.filter((x) => x.id !== el.dataset.v); render(); };
A.aiMeal = (el) => {
  const m = aiFindMeal(ui.date, el.dataset.v); if (!m) return;
  const a = m.ai;
  AI.res = { id: a.id, date: ui.date, name: m.n, items: a.items.map((x) => Object.assign({}, x)), score: a.score, why: a.why, servings: a.servings || 1, src: a.src, time: a.t || '', note: a.note || '', slot: m.slot };
  AI.edit = -1; AI.err = ''; openSheet('aires', { id: a.id });
};
A.aiServ = (el) => {
  const r = AI.res; if (!r) return;
  r.servings = clamp(Math.round((r.servings + +el.dataset.v) * 2) / 2, 0.5, 20);
  aiCommit(); render();
};
A.aiEdit = (el) => { const i = +el.dataset.v; AI.edit = AI.edit === i ? -1 : i; render(); };
A.aiRemove = (el) => {
  const r = AI.res; if (!r) return;
  r.items.splice(+el.dataset.v, 1); AI.edit = -1;
  if (!r.items.length) { toast('Add at least one ingredient'); r.items.push({ name: 'Food', grams: 0, kcal: 0, p: 0, c: 0, f: 0 }); }
  aiCommit(); render();
};
A.aiDel = () => {
  const r = AI.res; if (!r) return; const d = day(r.date), i = d.meals.findIndex((m) => m.ai && m.ai.id === r.id);
  if (i >= 0) { d.meals.splice(i, 1); touch(r.date); }
  AI.res = null; ui.sheet = null; render(); toast('Meal removed');
};
A.aiFixOpen = () => { AI.fix = ''; AI.err = ''; AI.busy = false; openSheet('aifix', { id: AI.res && AI.res.id }); };
A.aiIngOpen = () => { AI.ing = ''; AI.err = ''; AI.busy = false; openSheet('aiing', { id: AI.res && AI.res.id }); };
A.aiBack = () => { AI.tok++; AI.busy = false; AI.err = ''; openSheet('aires', { id: AI.res && AI.res.id }); };
A.aiFixGo = async () => {
  const r = AI.res, txt = AI.fix.trim(); if (!r || AI.busy) return;
  if (!txt) { toast('Say what is wrong first'); return; }
  const my = ++AI.tok; AI.busy = true; AI.err = ''; render();
  try {
    const prev = JSON.stringify({ meal_name: r.name, health_score: r.score, health_reason: r.why, items: r.items.map((x) => ({ name: x.name, grams: x.grams, kcal: x.kcal, protein: x.p, carbs: x.c, fat: x.f, fiber: x.fi, sugar: x.su, sodium: x.na })), note: r.note });
    const content = [], im = AI.full[r.id] || aiThumb(r.id);
    if (im) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: im.split(',')[1] } });
    content.push({ type: 'text', text: 'Previous estimate: ' + prev + '\nCorrection from the user: ' + txt });
    const n = aiNorm(await aiCall(AI_SYSTEM + ' ' + AI_X_FIX, AI_TOOL, content));
    if (my !== AI.tok) return;
    Object.assign(r, { name: n.name, items: n.items, score: n.score, why: n.why, note: n.note }); AI.edit = -1;
    aiCommit(); AI.busy = false; toast('Results updated'); openSheet('aires', { id: r.id });
  } catch (e) { if (my !== AI.tok) return; AI.busy = false; AI.err = e.msg || 'Something went wrong.'; render(); }
};
A.aiIngGo = async () => {
  const r = AI.res, txt = AI.ing.trim(); if (!r || AI.busy) return;
  if (!txt) { toast('Say what to add first'); return; }
  const my = ++AI.tok; AI.busy = true; AI.err = ''; render();
  try {
    const n = aiNorm(await aiCall(AI_SYSTEM + ' ' + AI_X_ING, AI_TOOL, [{ type: 'text', text: 'Ingredient to add: ' + txt }]));
    if (my !== AI.tok) return;
    const sv = r.servings || 1;
    n.items.slice(0, 1).forEach((x) => r.items.push({ name: x.name, grams: aiR2(x.grams / sv), kcal: aiR2(x.kcal / sv), p: aiR2(x.p / sv), c: aiR2(x.c / sv), f: aiR2(x.f / sv), fi: x.fi == null ? undefined : aiR2(x.fi / sv), su: x.su == null ? undefined : aiR2(x.su / sv), na: x.na == null ? undefined : aiR2(x.na / sv) }));
    aiCommit(); AI.busy = false; openSheet('aires', { id: r.id });
  } catch (e) { if (my !== AI.tok) return; AI.busy = false; AI.err = e.msg || 'Something went wrong.'; render(); }
};

A.aiMac = (el) => { ui.aiMac = el.dataset.v === 'micro' ? 'micro' : 'macros'; render(); };
A.aiSlot = (el) => { const r = AI.res; if (!r) return; r.slot = el.dataset.v; aiCommit(); render(); toast('Moved to ' + ((D.SLOTS.find((x) => x.id === r.slot) || {}).n || 'meal')); };
A.aiAgain = () => { // log again today (same day) or copy to today (another day)
  const r = AI.res; if (!r) return; const today = todayISO(), now = new Date(), time = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
  const n = Object.assign({}, r, { id: aiId(), date: today, time, slot: r.date === today ? r.slot : aiGuessSlot() });
  const d = day(today); d.meals = d.meals || []; d.meals.push(aiMealFrom(n)); touch(today);
  const t = AI.full[r.id] || aiThumb(r.id); if (t) aiThumbSet(n.id, aiThumb(r.id) || t);
  ui.sheet = null; render(); toast((r.date === today ? 'Logged again · ' : 'Copied to today · ') + aiLeft(aiBudget(today).kcal));
};
/* ---- saved foods (localStorage only) */
function aiSaved() { try { const a = JSON.parse(localStorage.getItem(AI_SAVED_LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function aiSavedSet(a) { try { localStorage.setItem(AI_SAVED_LS, JSON.stringify(a.slice(0, 100))); return true; } catch (e) { toast('Could not save on this device'); return false; } }
const aiIsSaved = (r) => aiSaved().some((x) => x.from === r.id);
A.aiSave = () => {
  const r = AI.res; if (!r) return; const a = aiSaved();
  if (a.some((x) => x.from === r.id)) { aiSavedSet(a.filter((x) => x.from !== r.id)); toast('Removed from saved foods'); render(); return; }
  const m = aiMealFrom(r), id = aiId(), t = aiThumb(r.id);
  if (t) aiThumbSet('sv-' + id, t);
  a.unshift({ id, from: r.id, name: r.name, items: r.items.map((x) => Object.assign({}, x)), servings: r.servings, tot: { kcal: m.kcal, p: m.p, c: m.c, f: m.f }, nut: m.nut, thumb: t ? 'sv-' + id : null, score: r.score, why: r.why, src: r.src, note: r.note || '' });
  if (aiSavedSet(a)) { toast('Saved. Find it under Saved foods'); render(); }
};
A.aiSavedDel = (el) => { aiSavedSet(aiSaved().filter((x) => x.id !== el.dataset.v)); render(); };
A.aiSavedLog = (el) => {
  const x = aiSaved().find((y) => y.id === el.dataset.v); if (!x) return;
  const now = new Date(), time = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2), id = aiId();
  const r = { id, date: ui.date, name: x.name, items: x.items.map((i) => Object.assign({}, i)), score: x.score, why: x.why, servings: x.servings || 1, src: x.src || 'text', time, note: x.note || '', slot: AI.slotHint || aiGuessSlot() };
  const d = day(ui.date); d.meals = d.meals || []; d.meals.push(aiMealFrom(r)); touch(ui.date);
  const t = x.thumb && aiThumb(x.thumb); if (t) aiThumbSet(id, t);
  AI.slotHint = null; ui.sheet = null; render(); toast('Logged ' + x.name + ' · ' + fmtN(aiMealFrom(r).kcal) + ' kcal · ' + aiLeft(aiBudget(ui.date).kcal));
};
A.aiSavedOpen = () => openSheet('aisaved');
/* ---- exercise */
const aiExLatestW = () => { const w = typeof weights === 'function' ? weights() : []; return w.length ? w[w.length - 1].w : null; };
A.aiExOpen = () => { AI.ex = { type: 'Run', desc: '', int: 'Medium', min: '30', kcal: '', busy: false, err: '', date: ui.date }; openSheet('aiex'); };
A.aiExType = (el) => { if (AI.ex) { AI.ex.type = el.dataset.v; render(); } };
A.aiExInt = (el) => { if (AI.ex) { AI.ex.int = el.dataset.v; render(); } };
function aiExAdd(e, n, kcal, src) {
  const d = day(e.date); d.ex = d.ex || []; d.ex.push({ id: aiId(), n: String(n).slice(0, 60), min: Math.round(aiNum(e.min)), kcal: Math.round(kcal), src });
  touch(e.date); AI.ex = null; ui.sheet = null; render();
  toast(n + ' · ' + fmtN(kcal) + ' kcal burned' + (S.settings.aiExBack ? ' · ' + aiLeft(aiBudget(e.date).kcal) : ''));
}
const aiExName = (e) => (e.type.startsWith('Describe') ? (e.desc.trim() || 'Exercise') : e.type);
A.aiExAdd = () => {
  const e = AI.ex; if (!e) return; const k = aiNum(e.kcal);
  if (!(k > 0)) { toast('Enter the calories burned'); return; }
  if (e.type.startsWith('Describe') && !e.desc.trim()) { toast('Describe the exercise first'); return; }
  aiExAdd(e, aiExName(e), k, 'manual');
};
A.aiExGo = async () => {
  const e = AI.ex; if (!e || e.busy) return;
  if (e.type.startsWith('Describe') && !e.desc.trim()) { toast('Describe the exercise first'); return; }
  if (!(aiNum(e.min) > 0)) { toast('Enter the duration in minutes'); return; }
  if (!aiKey()) { e.err = 'Add your Gemini API key in Settings to estimate, or type the calories yourself.'; render(); return; }
  e.busy = true; e.err = ''; render();
  try {
    const w = aiExLatestW();
    const inp = await aiCall(AI_EX_SYSTEM, AI_EX_TOOL, [{ type: 'text', text: 'Exercise: ' + (e.type.startsWith('Describe') ? e.desc.trim() : e.type) + '. Intensity: ' + e.int + '. Duration: ' + Math.round(aiNum(e.min)) + ' minutes.' + (w ? ' Body weight: ' + w + ' kg.' : '') }]);
    if (AI.ex !== e) return;
    const k = Math.round(aiNum(inp.kcal)); if (!(k > 0)) throw { msg: 'No estimate came back. Type the calories yourself.' };
    aiExAdd(e, aiExName(e), k, 'ai');
  } catch (x) { if (AI.ex !== e) return; e.busy = false; e.err = x && x.msg ? x.msg : 'Something went wrong.'; render(); }
};
A.aiExDel = (el) => { const d = day(ui.date); d.ex = (d.ex || []).filter((x) => x.id !== el.dataset.v); touch(ui.date); render(); toast('Exercise removed'); };
/* ---- voice */
const aiSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
A.aiMic = () => {
  if (AI.rec) { try { AI.rec.stop(); } catch (e) { /* ignore */ } return; }
  const SR = aiSR(); if (!SR) return;
  let rec; try { rec = new SR(); } catch (e) { toast('Voice input is not available'); return; }
  rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || 'en-AU';
  const base = AI.text.trim();
  rec.onresult = (ev) => {
    let t = '';
    for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
    AI.text = (base ? base + ' ' : '') + t.trim();
    const ta = document.querySelector('[data-ai="text"]'); if (ta) ta.value = AI.text;
  };
  rec.onerror = (ev) => { const e = ev && ev.error; if (e === 'aborted') return; toast(e === 'not-allowed' || e === 'service-not-allowed' ? 'Microphone access was denied. Allow it in Settings.' : e === 'no-speech' ? 'Did not hear anything. Try again.' : e === 'network' ? 'Voice needs a connection. Try again.' : 'Voice input failed (' + (e || 'error') + ')'); };
  rec.onend = () => { AI.rec = null; const b = document.querySelector('.aimic'); if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); } };
  AI.rec = rec;
  try { rec.start(); const b = document.querySelector('.aimic'); if (b) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); } } catch (e) { AI.rec = null; toast('Could not start the microphone'); }
};

/* ---------------------------------------------------------------- input wiring (no re-render while typing) */
document.addEventListener('input', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-ai]'); if (!el) return;
  const k = el.dataset.ai, r = AI.res;
  if (k === 'text') AI.text = el.value;
  else if (k === 'fix') AI.fix = el.value;
  else if (k === 'ing') AI.ing = el.value;
  else if (k === 'bar') AI.bar = el.value;
  else if (k === 'exdesc' && AI.ex) AI.ex.desc = el.value;
  else if (k === 'exmin' && AI.ex) AI.ex.min = el.value;
  else if (k === 'exkcal' && AI.ex) AI.ex.kcal = el.value;
  else if (k === 'rname' && r) { r.name = el.value; aiCommit(); }
  else if (k === 'iname' && r && r.items[+el.dataset.i]) { r.items[+el.dataset.i].name = el.value; aiCommit(); }
  else if (k === 'item' && r && r.items[+el.dataset.i]) {
    r.items[+el.dataset.i][el.dataset.f] = aiR2(aiNum(el.value) / (r.servings || 1)); aiCommit(); aiRefreshRes();
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-ai="rtime"]'); if (!el || !AI.res || !el.value) return;
  AI.res.time = el.value; AI.res.slot = aiGuessSlot(+el.value.split(':')[0]); aiCommit(); render();
});

/* ---------------------------------------------------------------- photo: downscale */
function aiReadFile(file) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('read')); };
    img.src = url;
  });
}

/* ---------------------------------------------------------------- the API */
/* JSON Schema (as written for the tools above) → Gemini's OpenAPI-style responseSchema */
function aiSchema(x) {
  if (!x || typeof x !== 'object') return x;
  const o = {};
  if (x.type) o.type = String(x.type).toUpperCase();
  ['description', 'required', 'minimum', 'maximum'].forEach((k) => { if (x[k] != null) o[k] = x[k]; });
  if (x.properties) { o.properties = {}; Object.keys(x.properties).forEach((k) => { o.properties[k] = aiSchema(x.properties[k]); }); o.propertyOrdering = Object.keys(x.properties); }
  if (x.items) o.items = aiSchema(x.items);
  return o;
}
async function aiCall(system, tool, content) {
  const key = aiKey(); if (!key) throw { msg: 'Add your Gemini API key in Settings, under AI food logging.' };
  const parts = content.map((b) => (b.type === 'image' ? { inline_data: { mime_type: b.source.media_type || 'image/jpeg', data: b.source.data } } : { text: b.text }));
  const mk = (think) => JSON.stringify({
    system_instruction: { parts: [{ text: system + ' ' + tool.description }] },
    contents: [{ role: 'user', parts }],
    // low thinking: ~3 s instead of ~1 min, with the same estimates in testing
    generationConfig: Object.assign({ responseMimeType: 'application/json', responseSchema: aiSchema(tool.input_schema), temperature: 0.2 }, think ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
  });
  let body = mk(true);
  let res = null, last = 0;
  const order = AI_MODELS.concat(AI_MODELS.slice(0, 2)); // second pass over the steadier models: 503 "high demand" spikes are brief
  for (let i = 0; i < order.length; i++) { // an overloaded (503), rate-limited (429) or retired (404) model falls through to the next
    const model = order[i];
    if (i === AI_MODELS.length) await new Promise((ok) => setTimeout(ok, 1500));
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 25000); // a stalled model gives way to the next
    try {
      res = await fetch(AI_API + model + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body, signal: ac.signal });
    } catch (e) {
      clearTimeout(tm);
      if (e && e.name === 'AbortError') { res = { ok: false, status: 503, json: async () => ({}) }; last = 503; continue; }
      throw { msg: navigator.onLine === false ? 'You appear to be offline. Try again when you have signal.' : 'Could not reach the AI service. Check your connection and try again.' };
    }
    clearTimeout(tm);
    last = res.status;
    if (res.status === 400 && body.includes('thinkingConfig')) { // a model without thinking levels: same model, plain request
      const t = await res.clone().text().catch(() => '');
      if (/thinking/i.test(t)) { body = mk(false); i--; continue; }
    }
    if (res.ok || ![404, 429, 500, 503].includes(res.status)) break;
  }
  if (!res.ok) {
    let why = ''; try { why = ((await res.json()).error || {}).message || ''; } catch (e) { /* no body */ }
    throw { msg: last === 401 || last === 403 || /api key/i.test(why) ? 'Google rejected the API key. Check it in Settings, under AI food logging.'
      : last === 429 ? 'Gemini’s rate limit or free quota was hit. Wait a minute and try again.'
      : last >= 500 ? 'Gemini is busy right now. Try again shortly.'
      : last === 400 ? 'The request was refused (400). If this is a photo, try a smaller or different one.'
      : 'Something went wrong (' + last + ').' };
  }
  let j; try { j = await res.json(); } catch (e) { throw { msg: 'The AI answer could not be read. Try again.' }; }
  const c = (j.candidates || [])[0];
  if (!c) throw { msg: j.promptFeedback && j.promptFeedback.blockReason ? 'Gemini declined this one. Try another photo or describe it instead.' : 'The AI did not return a result. Try again.' };
  const txt = ((c.content && c.content.parts) || []).filter((x) => x.text && !x.thought).map((x) => x.text).join('').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try { return JSON.parse(txt); } catch (e) { throw { msg: c.finishReason === 'MAX_TOKENS' ? 'The answer was cut short. Try a simpler description.' : 'The AI answer could not be read. Try again.' }; }
}
function aiNorm(inp) {
  const opt = (v) => (v == null || v === '' || !isFinite(parseFloat(v)) ? undefined : aiNum(v));
  const items = (Array.isArray(inp.items) ? inp.items : []).map((x) => {
    const o = { name: String(x.name || 'Food').slice(0, 80), grams: aiNum(x.grams), kcal: Math.round(aiNum(x.kcal)), p: aiNum(x.protein), c: aiNum(x.carbs), f: aiNum(x.fat), fi: opt(x.fiber), su: opt(x.sugar), na: opt(x.sodium) };
    if (o.na != null) o.na = Math.round(o.na); ['fi', 'su', 'na'].forEach((k) => { if (o[k] === undefined) delete o[k]; }); return o;
  });
  if (!items.length) throw { msg: 'No food was recognised. Try describing it with more detail.' };
  const sc = Math.round(parseFloat(inp.health_score));
  return { name: String(inp.meal_name || items[0].name).slice(0, 80), score: sc >= 1 && sc <= 10 ? sc : null, why: String(inp.health_reason || ''), items, note: String(inp.note || '') };
}
const aiImg = (d) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d.split(',')[1] } });
async function aiEstimate(job, note) {
  const content = []; let extra = '', txt;
  if (job.img) content.push(aiImg(job.img));
  if (job.src === 'text') txt = 'What I ate: ' + job.text;
  else if (job.src === 'label') { extra = AI_X_LABEL; txt = 'Read this nutrition label.'; }
  else if (job.src === 'barcode') { extra = AI_X_BARCODE; txt = 'Estimate this packaged product.' + (note ? ' ' + note : ''); }
  else txt = 'Estimate this meal.';
  content.push({ type: 'text', text: txt });
  return aiNorm(await aiCall(AI_SYSTEM + (extra ? ' ' + extra : ''), AI_TOOL, content));
}
async function aiBarcode(job) {
  let code = job.code;
  if (!code) {
    const inp = await aiCall(AI_BAR_SYSTEM, AI_BAR_TOOL, [aiImg(job.img), { type: 'text', text: 'Read the barcode digits.' }]);
    code = String(inp.digits || '').replace(/\D/g, '');
    if (code.length < 8 || code.length > 14) return 'manual';
  }
  job.pct = Math.max(job.pct, 45);
  let p = null;
  try {
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=product_name,brands,serving_size,serving_quantity,nutriments,nutriscore_grade');
    if (r.ok) { const j = await r.json(); if (j && j.status === 1 && j.product) p = aiFromOFF(j.product); }
  } catch (e) { /* network or CORS: fall through to the AI estimate */ }
  if (p) return p;
  if (!job.img) throw { msg: 'Barcode ' + code + ' is not in the Open Food Facts database. Try Scan food or Describe meal instead.' };
  return aiEstimate(job, 'Barcode ' + code + ' was not found in the food database.');
}
function aiFromOFF(pr) {
  const n = pr.nutriments || {}, sq = parseFloat(pr.serving_quantity);
  const has = (k) => n[k] != null && n[k] !== '' && isFinite(+n[k]);
  const kcalOf = (suf) => (has('energy-kcal' + suf) ? +n['energy-kcal' + suf] : has('energy' + suf) ? +n['energy' + suf] / 4.184 : null);
  let g, k, pp, c, f, per;
  if (kcalOf('_serving') != null) { per = 'serving'; g = isFinite(sq) ? sq : 0; k = kcalOf('_serving'); pp = +n.proteins_serving || 0; c = +n.carbohydrates_serving || 0; f = +n.fat_serving || 0; }
  else if (kcalOf('_100g') != null) {
    const m = isFinite(sq) && sq > 0 ? sq / 100 : 1; per = isFinite(sq) && sq > 0 ? 'serving' : '100 g'; g = isFinite(sq) && sq > 0 ? sq : 100;
    k = kcalOf('_100g') * m; pp = (+n.proteins_100g || 0) * m; c = (+n.carbohydrates_100g || 0) * m; f = (+n.fat_100g || 0) * m;
  } else return null;
  const brand = String(pr.brands || '').split(',')[0].trim(), nm = String(pr.product_name || '').trim() || 'Packaged food';
  const name = (brand && !nm.toLowerCase().includes(brand.toLowerCase()) ? brand + ' ' : '') + nm;
  const grade = String(pr.nutriscore_grade || '').toLowerCase(), sc = { a: 9, b: 7, c: 5, d: 3, e: 1 }[grade] || null;
  return { name: name.slice(0, 80), score: sc, why: sc ? 'Nutri-Score ' + grade.toUpperCase() + ' from Open Food Facts.' : '', note: 'From Open Food Facts, per ' + per + (pr.serving_size ? ' (' + pr.serving_size + ')' : '') + '. Check it against the pack.',
    items: [{ name: name.slice(0, 80), grams: Math.round(g), kcal: Math.round(k), p: aiNum(pp), c: aiNum(c), f: aiNum(f) }] };
}

/* ---------------------------------------------------------------- background jobs */
function aiStart(o) {
  const job = Object.assign({ id: aiId(), date: ui.date, slot: AI.slotHint || aiGuessSlot(), pct: 3, err: '' }, o);
  AI.slotHint = null; AI.jobs.push(job);
  AI.err = ''; ui.sheet = null; render(); aiTick(); aiRun(job);
}
async function aiRun(job) {
  job.err = ''; job.busy = true; aiPaint(job);
  try {
    const out = job.src === 'barcode' ? await aiBarcode(job) : await aiEstimate(job);
    if (!AI.jobs.includes(job)) return;
    if (out === 'manual') {
      AI.jobs = AI.jobs.filter((x) => x !== job); AI.barImg = job.img; AI.bar = '';
      render(); if (!ui.sheet) openSheet('aibar'); else toast('Could not read the barcode. Type the digits.'); return;
    }
    job.pct = 100; job.busy = false; aiPaint(job);
    setTimeout(() => aiFinish(job, out), 350);
  } catch (e) {
    if (!AI.jobs.includes(job)) return;
    job.err = e && e.msg ? e.msg : 'Something went wrong. Try again.'; job.busy = false; render();
  }
}
function aiTick() {
  if (AI.timer) return;
  AI.timer = setInterval(() => {
    const live = AI.jobs.filter((j) => j.busy && j.pct < 100);
    if (!live.length) { clearInterval(AI.timer); AI.timer = null; return; }
    live.forEach((j) => { j.pct = Math.min(92, j.pct + Math.max(0.25, (92 - j.pct) * 0.045)); aiPaint(j); });
  }, 300);
}
function aiPaint(j) {
  const el = document.getElementById('aijob-' + j.id); if (!el) return;
  const p = Math.round(j.pct), s = $('.aistage', el), b = $('.bar', el), i = $('.bar > i', el), n = $('.pct', el);
  if (s) s.textContent = aiStage(j.src, p); if (n) n.textContent = p + '%'; if (i) i.style.width = p + '%'; if (b) b.setAttribute('aria-valuenow', p);
}
async function aiFinish(job, out) {
  if (!AI.jobs.includes(job)) return;
  AI.jobs = AI.jobs.filter((x) => x !== job);
  const now = new Date(), time = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
  const r = { id: job.id, date: job.date, name: out.name, items: out.items, score: out.score, why: out.why, servings: 1, src: job.src, time, note: out.note, slot: job.slot };
  const d = day(job.date); d.meals = d.meals || []; d.meals.push(aiMealFrom(r)); touch(job.date);
  if (job.img) { AI.full[job.id] = job.img; const t = await aiMakeThumb(job.img); if (t) aiThumbSet(job.id, t); }
  const here = ui.tab === 'fuel' && ui.date === job.date && !ui.stack.length && !ui.sheet;
  if (here) { AI.res = r; AI.edit = -1; AI.err = ''; openSheet('aires', { id: r.id }); }
  else { render(); toast('Logged ' + r.name + ' · ' + fmtN(aiMealFrom(r).kcal) + ' kcal · ' + aiLeft(aiBudget(job.date).kcal)); }
}

/* ---------------------------------------------------------------- Fuel dashboard pieces */
function aiHeaderRight() {
  const n = aiStreak();
  return '<div class="row" style="gap:10px"><span class="aistreak" role="img" aria-label="' + n + ' day logging streak">' + AI_IC.flame + '<span class="tnum">' + n + '</span></span>' + avatarBtn() + '</div>';
}
function aiHeroHTML(date) {
  const r = aiRemaining(date), eaten = ui.aiHero === 'eaten', big = eaten ? r.tt.kcal : Math.abs(r.kcal);
  const lab = eaten ? 'Calories eaten' : r.kcal >= 0 ? 'Calories left' : 'Calories over';
  const cfg = S.settings.kcalAdj ? ' (' + (S.settings.kcalAdj > 0 ? '+' : '') + S.settings.kcalAdj + ' calibration)' : '';
  let h = '<div class="card"><button class="aihero-main" data-a="aiHeroTog" aria-label="' + lab + ' ' + fmtN(big) + '. Tap to show ' + (eaten ? 'calories left' : 'calories eaten') + '"><span><span class="aib tnum" style="display:block;' + (!eaten && r.kcal < 0 ? 'color:var(--bad)' : '') + '">' + fmtN(big) + '</span><span class="small fg2" style="display:block;margin-top:6px">' + lab + '</span>' +
    (r.burn ? '<span class="xs" style="display:block;color:var(--good);margin-top:3px;font-weight:600">+' + fmtN(r.burn) + ' burned' + (r.both ? ' · higher of Health and logged exercise' : r.ex ? ' · logged exercise' : '') + '</span>' : '') + (r.roll ? '<span class="xs" style="display:block;color:var(--good);margin-top:3px;font-weight:600">+' + fmtN(r.roll) + ' rollover</span>' : '') + '</span>' +
    '<span class="aiR">' + ringSVG(r.tt.kcal / r.budget, 112, 11, r.kcal < 0 ? 'var(--bad)' : 'var(--fuel)').replace('<svg', '<svg class="rg"') + '<span class="c">' + AI_IC.flame + '</span></span></button>' +
    '<div class="row" style="justify-content:space-between;margin-top:12px;border-top:1px solid var(--line);padding-top:12px"><span class="small fg2">' + esc(r.tg.label) + esc(cfg) + '</span><span class="small tnum"><b>' + fmtN(r.tt.kcal) + '</b> / ' + fmtN(r.budget) + '</span></div></div>';
  const mic = ui.aiMac === 'micro';
  h += '<div class="seg aiseg" role="group" aria-label="Nutrient page"><button class="' + (mic ? '' : 'on') + '" data-a="aiMac" data-v="macros" aria-pressed="' + !mic + '">Macros</button><button class="' + (mic ? 'on' : '') + '" data-a="aiMac" data-v="micro" aria-pressed="' + mic + '">Fiber · Sugar · Sodium</button></div>';
  if (mic) {
    const n = aiNutTotals(date), G = AI_NUT_TG;
    const M2 = [['Fiber', 'Fi', n.fi, G.fiber, 'g', 'var(--good)', true], ['Sugar', 'Su', n.su, G.sugar, 'g', 'var(--warn)', false], ['Sodium', 'Na', n.na, G.sodium, 'mg', 'var(--train)', false]];
    h += '<div class="aimacs">' + M2.map((m) => {
      const bad = !m[6] && m[2] > m[3], v = Math.round(m[2]);
      return '<div class="card" role="group" aria-label="' + m[0] + ': ' + fmtN(v) + ' ' + m[4] + ' of ' + (m[6] ? 'a ' + fmtN(m[3]) + ' minimum' : 'a ' + fmtN(m[3]) + ' limit') + '"><div class="aimac-n tnum" style="' + (bad ? 'color:var(--bad)' : '') + '">' + fmtN(v) + '<span class="xs muted" style="font-weight:600"> ' + m[4] + '</span></div><div class="xs muted" style="margin:2px 0 8px">' + m[0] + (m[6] ? ' of ' + m[3] + ' g' : ' of ≤' + fmtN(m[3]) + ' ' + m[4]) + '</div>' +
        '<span class="aiR s">' + ringSVG(m[2] / m[3], 44, 5, bad ? 'var(--bad)' : m[5]).replace('<svg', '<svg class="rg"') + '<span class="c" style="color:' + (bad ? 'var(--bad)' : m[5]) + ';font-size:12px">' + m[1] + '</span></span></div>';
    }).join('') + '</div><p class="xs muted" style="margin:8px 2px 0">' + (n.n ? 'From AI-logged meals (' + n.n + ' of ' + n.all + ' meals). Other meals count as unknown.' : 'From AI-logged meals. Nothing logged with AI yet, so these read 0.') + '</p>';
  } else {
  const tg = r.tg, tt = r.tt;
  const M = [['Protein', 'P', tt.p, tg.p[0], 'var(--fuel)', tg.p[0] + '–' + tg.p[1] + ' g'], ['Carbs', 'C', tt.c, tg.carbs ? tg.carbs[1] : 300, 'var(--train)', tg.carbs ? tg.carbs[0] + '–' + tg.carbs[1] + ' g' : 'the rest'], ['Fat', 'F', tt.f, tg.fat[1], 'var(--mind)', tg.fat[0] + '–' + tg.fat[1] + ' g']];
  h += '<div class="aimacs">' + M.map((m) => {
    const left = m[3] - m[2];
    return '<div class="card" role="group" aria-label="' + m[0] + ': ' + fmtN(Math.abs(left)) + ' grams ' + (left >= 0 ? 'left' : 'over') + '"><div class="aimac-n tnum" style="' + (left < 0 ? 'color:var(--bad)' : '') + '">' + fmtN(Math.abs(left)) + '<span class="xs muted" style="font-weight:600"> g</span></div><div class="xs muted" style="margin:2px 0 8px">' + m[0] + (left >= 0 ? ' left' : ' over') + '</div>' +
      '<span class="aiR s">' + ringSVG(m[2] / m[3], 44, 5, m[4]).replace('<svg', '<svg class="rg"') + '<span class="c" style="color:' + m[4] + '">' + m[1] + '</span></span></div>';
  }).join('') + '</div>';
  }
  return h + aiScoreHTML(date);
}
function aiScoreHTML(date) {
  const ms = mealsFor(date), n = ms.length;
  let h = '<div class="card" style="margin-top:12px"><div class="row" style="justify-content:space-between"><b>Daily score</b>';
  if (n < 3) return h + '<span class="small muted">Not yet</span></div><p class="small fg2" style="margin:8px 0 0">Log ' + (3 - n) + ' more item' + (3 - n === 1 ? '' : 's') + ' for your daily score.</p></div>';
  const b = aiBudget(date), ratio = b.tt.kcal / b.budget, pr = b.tt.p / b.tg.p[0];
  const sc = ms.map((m) => m.ai && m.ai.score).filter((x) => x != null), avg = sc.length ? sc.reduce((a, c) => a + c, 0) / sc.length : null;
  let pts = Math.abs(ratio - 1) <= 0.1 ? 2 : Math.abs(ratio - 1) <= 0.25 ? 1 : 0, max = 2;
  pts += pr >= 0.9 ? 2 : pr >= 0.7 ? 1 : 0; max += 2;
  if (avg != null) { pts += avg >= 7 ? 2 : avg >= 5 ? 1 : 0; max += 2; }
  const f = pts / max, band = f >= 0.75 ? 0 : f >= 0.45 ? 1 : 2, L = ['Good', 'Needs balance', 'Needs improvement'], C = ['var(--good)', 'var(--warn)', 'var(--bad)'];
  h += '<span class="chip" style="background:color-mix(in srgb,' + C[band] + ' 20%,transparent);color:' + C[band] + '">' + L[band] + '</span></div><div class="aiband" role="img" aria-label="Daily score: ' + L[band] + '">' + [0, 1, 2].map((i) => '<i style="' + (i === band ? 'background:' + C[band] : '') + '"></i>').join('') + '</div>';
  return h + '<p class="xs muted" style="margin:8px 0 0">Calories vs budget (' + Math.round(ratio * 100) + '%), protein vs target (' + Math.round(pr * 100) + '%)' + (avg != null ? ' and average health score (' + (Math.round(avg * 10) / 10) + '/10)' : '') + '.</p></div>';
}
function aiExHTML(date) {
  const ex = peek(date).ex || []; if (!ex.length) return '';
  const tot = ex.reduce((a, x) => a + (+x.kcal || 0), 0), on = !!S.settings.aiExBack;
  return '<section class="pad section"><div class="sec-h"><h2 class="h-md">Exercise</h2><span class="small muted tnum">' + fmtN(tot) + ' kcal' + (on ? ' · in budget' : '') + '</span></div><div class="list">' + ex.map((x) =>
    '<div class="li"><span class="grow"><span class="t" style="display:block">' + esc(x.n) + '</span><span class="s tnum" style="display:block">' + (x.min ? x.min + ' min · ' : '') + fmtN(x.kcal) + ' kcal' + (x.src === 'ai' ? ' · AI estimate' : '') + '</span></span><button class="small" style="color:var(--bad);font-weight:600;padding:8px" data-a="aiExDel" data-v="' + esc(x.id) + '" aria-label="Delete ' + esc(x.n) + '">Delete</button></div>').join('') + '</div>' +
    (on ? '' : '<p class="xs muted" style="margin:6px 2px 0">Not counted in your budget. Turn on “Add logged exercise back” in Settings.</p>') + '</section>';
}
function aiJobsHTML(date) {
  const js = AI.jobs.filter((j) => j.date === date); if (!js.length) return '';
  return '<div class="slot" style="margin-bottom:18px"><h3 class="h-sm" style="color:var(--fg-2);margin-bottom:8px">Recently uploaded</h3><div class="stack" style="gap:8px">' + js.map((j) => {
    const p = Math.round(j.pct);
    const th = j.img ? '<img class="thumbs" src="' + j.img + '" alt="Uploaded photo">' : '<span class="thumbs" style="display:grid;place-items:center;color:var(--fuel)">' + (AI_IC[j.src === 'text' ? 'text' : 'bar'].replace('<svg', '<svg width="26" height="26"')) + '</span>';
    if (j.err) return '<div class="card aijob" id="aijob-' + j.id + '"><div class="row">' + th + '<div class="grow"><div class="small" style="color:var(--bad);font-weight:600">Could not analyse this</div><div class="xs fg2" style="margin-top:2px">' + esc(j.err) + '</div></div></div><div class="row" style="gap:10px;margin-top:10px"><button class="btn ghost sm grow" data-a="aiJobDrop" data-v="' + j.id + '">Dismiss</button><button class="btn fuel sm grow" data-a="aiJobRetry" data-v="' + j.id + '">Try again</button></div></div>';
    return '<div class="card aijob" id="aijob-' + j.id + '" role="status"><div class="row">' + th + '<div class="grow"><div class="row" style="justify-content:space-between"><span class="small aistage" style="font-weight:600">' + aiStage(j.src, p) + '</span><span class="small muted tnum pct">' + p + '%</span></div><div class="bar" role="progressbar" aria-label="Analysing" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><i style="width:' + p + '%"></i></div></div></div></div>';
  }).join('') + '</div></div>';
}
const aiFab = () => '<button class="aifab" data-a="aiAdd" aria-label="Log food with AI">' + AI_IC.plus + '</button>';
function aiButtons(slot, cls) {
  return '<div class="row" style="' + (cls || '') + '"><button class="btn ghost sm block" data-a="aiAdd" data-s="' + slot + '">' + AI_IC.cam.replace('<svg', '<svg width="18" height="18"') + ' Scan, label, barcode or describe</button></div>';
}

/* ---------------------------------------------------------------- sheets */
function aiSheet() { // describe a meal
  let s = '<h2 class="h-lg">Describe meal</h2><p class="small fg2" style="margin:6px 0 12px">Say what you ate and roughly how much. Gemini estimates it in the background.</p>';
  if (AI.err) s += '<div style="margin-bottom:12px">' + bannerHTML('warn', esc(AI.err)) + '</div>';
  return s + '<div class="row" style="align-items:flex-start;gap:10px"><textarea class="field" data-ai="text" placeholder="2 eggs, toast with butter, flat white" aria-label="Describe what you ate">' + esc(AI.text) + '</textarea>' + (aiSR() ? '<button class="aimic' + (AI.rec ? ' on' : '') + '" data-a="aiMic" aria-pressed="' + !!AI.rec + '" aria-label="Dictate with your voice">' + AI_IC.mic.replace('<svg', '<svg width="22" height="22"') + '</button>' : '') + '</div>' +
    '<button class="btn fuel block" style="margin-top:14px" data-a="aiTextGo">Estimate calories</button><button class="btn ghost block" style="margin-top:8px" data-a="aiAdd">Back</button>';
}
function aiAddSheet() {
  const T = [['photo', 'cam', 'Scan food', 'Photo of your plate'], ['lib', 'roll', 'Camera roll', 'Add from camera roll'], ['label', 'label', 'Food label', 'Reads the panel'], ['barcode', 'bar', 'Barcode', 'Packaged foods'], ['text', 'text', 'Describe meal', 'Type what you ate'], ['ex', 'run', 'Log exercise', 'Adds calories burned', 'aiExOpen'], ['saved', 'mark', 'Saved foods', aiSaved().length + ' saved', 'aiSavedOpen']];
  return '<h2 class="h-lg">Log food</h2><p class="small fg2" style="margin:6px 0 0">Snap it and keep using the app. The result shows up in your meals.</p><div class="aitiles">' +
    T.map((t) => '<button class="aitile" data-a="' + (t[4] || 'aiPick') + '" data-v="' + t[0] + '"><span class="ti">' + AI_IC[t[1]] + '</span><span>' + t[2] + '</span><span class="xs muted">' + t[3] + '</span></button>').join('') + '</div>' +
    '<div class="row" style="justify-content:center;gap:22px;margin-top:16px;flex-wrap:wrap"><button class="link" data-a="sheet" data-v="food" data-s="' + esc(AI.slotHint || aiGuessSlot()) + '">Browse foods</button></div>';
}
function aiSavedSheet() {
  const a = aiSaved();
  let s = '<h2 class="h-lg">Saved foods</h2><p class="small fg2" style="margin:6px 0 12px">Tap a food to log it now. Save foods with the bookmark on a result.</p>';
  if (!a.length) return s + '<div class="card small fg2">Nothing saved yet.</div><button class="btn ghost block" style="margin-top:12px" data-a="aiAdd">Back</button>';
  s += '<div class="stack" style="gap:8px">' + a.map((x) => {
    const th = x.thumb && aiThumb(x.thumb), fa = th ? '<span class="fa"><img src="' + th + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></span>' : '<span class="fa art-plate" style="width:46px;height:46px;display:grid;place-items:center;color:var(--fuel)">' + AI_IC.mark.replace('<svg', '<svg width="22" height="22"') + '</span>';
    return '<div class="food"><button class="row grow" style="gap:12px;text-align:left;min-width:0" data-a="aiSavedLog" data-v="' + esc(x.id) + '" aria-label="Log ' + esc(x.name) + '">' + fa + '<span class="grow" style="min-width:0"><span class="ft" style="display:block">' + esc(x.name) + '</span><span class="fs" style="display:block">' + fmtN(x.tot.kcal) + ' kcal · ' + Math.round(x.tot.p) + ' g protein</span></span></button><button class="small" style="color:var(--bad);font-weight:600;padding:8px" data-a="aiSavedDel" data-v="' + esc(x.id) + '" aria-label="Remove ' + esc(x.name) + ' from saved">Remove</button></div>';
  }).join('') + '</div>';
  return s + '<button class="btn ghost block" style="margin-top:14px" data-a="aiAdd">Back</button>';
}
function aiExSheet() {
  const e = AI.ex || (AI.ex = { type: 'Run', desc: '', int: 'Medium', min: '30', kcal: '', busy: false, err: '', date: ui.date }), w = aiExLatestW();
  let s = '<h2 class="h-lg">Log exercise</h2><p class="small fg2" style="margin:6px 0 0">Pick what you did. Gemini estimates calories burned' + (w ? ' for ' + w + ' kg' : '') + ', or type them yourself.</p>';
  if (e.busy) return s + '<div class="card row" style="gap:12px;justify-content:center;padding:22px;margin-top:14px"><span class="aispin"></span><span class="fg2" role="status">Estimating…</span></div>';
  s += '<div class="aichips" role="group" aria-label="Exercise type">' + AI_EX_TYPES.map((t) => '<button class="' + (e.type === t ? 'on' : '') + '" data-a="aiExType" data-v="' + esc(t) + '" aria-pressed="' + (e.type === t) + '">' + esc(t) + '</button>').join('') + '</div>';
  if (e.type.startsWith('Describe')) s += '<input class="field" style="margin-top:10px" data-ai="exdesc" value="' + esc(e.desc) + '" placeholder="Rowing machine, hard" aria-label="Describe the exercise">';
  s += '<div class="lbl" style="margin-top:14px">Intensity</div><div class="seg" role="group" aria-label="Intensity">' + ['Low', 'Medium', 'High'].map((i) => '<button class="' + (e.int === i ? 'on' : '') + '" data-a="aiExInt" data-v="' + i + '" aria-pressed="' + (e.int === i) + '">' + i + '</button>').join('') + '</div>';
  s += '<div class="lbl" style="margin-top:14px">Duration</div><div class="row" style="gap:8px"><input class="field tnum" inputmode="numeric" data-ai="exmin" value="' + esc(e.min) + '" aria-label="Duration in minutes"><span class="small fg2">min</span></div>';
  if (e.err) s += '<div style="margin-top:12px">' + bannerHTML('warn', esc(e.err)) + '</div>';
  s += '<button class="btn fuel block" style="margin-top:14px" data-a="aiExGo">Estimate with AI</button>';
  s += '<div class="lbl" style="margin-top:16px">Or enter calories burned</div><div class="row" style="gap:8px"><input class="field tnum" inputmode="numeric" data-ai="exkcal" value="' + esc(e.kcal) + '" placeholder="kcal" aria-label="Calories burned"><button class="btn ghost" data-a="aiExAdd">Add</button></div>';
  return s + '<button class="btn ghost block" style="margin-top:12px" data-a="aiAdd">Back</button>';
}
function aiBarSheet() {
  return '<h2 class="h-lg">Type the barcode</h2><p class="small fg2" style="margin:6px 0 12px">The digits could not be read from the photo. Type the number printed under the bars.</p>' +
    '<input class="field tnum" inputmode="numeric" data-ai="bar" value="' + esc(AI.bar) + '" placeholder="9300633603627" aria-label="Barcode digits" maxlength="14"><button class="btn fuel block" style="margin-top:14px" data-a="aiBarGo">Look up</button><button class="btn ghost block" style="margin-top:8px" data-a="aiAdd">Cancel</button>';
}
function aiBusyOrErr(body) { // shared by the fix and add-ingredient sheets
  if (AI.busy) return '<div class="card row" style="gap:12px;justify-content:center;padding:22px;margin-top:14px"><span class="aispin"></span><span class="fg2" role="status">Working on it…</span></div>';
  return (AI.err ? '<div style="margin:12px 0">' + bannerHTML('warn', esc(AI.err)) + '</div>' : '') + body;
}
function aiFixSheet() {
  return '<h2 class="h-lg">Fix results</h2><p class="small fg2" style="margin:6px 0 12px">What is wrong? Gemini redoes the estimate with your correction.</p>' + aiBusyOrErr(
    '<textarea class="field" data-ai="fix" placeholder="It was brown rice, and half the portion" aria-label="What is wrong">' + esc(AI.fix) + '</textarea><button class="btn fuel block" style="margin-top:14px" data-a="aiFixGo">Re-estimate</button><button class="btn ghost block" style="margin-top:8px" data-a="aiBack">Cancel</button>');
}
function aiIngSheet() {
  return '<h2 class="h-lg">Add ingredient</h2><p class="small fg2" style="margin:6px 0 12px">Name it with an amount. Gemini estimates just that and adds it.</p>' + aiBusyOrErr(
    '<input class="field" data-ai="ing" value="' + esc(AI.ing) + '" placeholder="1 tbsp olive oil" aria-label="Ingredient to add"><button class="btn fuel block" style="margin-top:14px" data-a="aiIngGo">Estimate and add</button><button class="btn ghost block" style="margin-top:8px" data-a="aiBack">Cancel</button>');
}
function aiResSheet() {
  const r = AI.res; if (!r) return '<p class="small fg2">Nothing to show.</p><button class="btn ghost block" data-a="closeSheet">Close</button>';
  const sv = r.servings, T = aiSum(r.items), left = aiRemaining(r.date).kcal, im = AI.full[r.id] || aiThumb(r.id);
  const sc = r.score, scol = sc == null ? 'var(--fill)' : sc <= 4 ? 'var(--bad)' : sc <= 7 ? 'var(--warn)' : 'var(--good)';
  let s = (im ? '<img class="aires-img" src="' + im + '" alt="Photo of ' + esc(r.name) + '">' : '');
  s += '<div class="row" style="justify-content:space-between;gap:8px"><span class="chip fuel">' + esc(AI_SRC_N[r.src] || 'AI') + '</span><span class="row" style="gap:10px"><button class="aibm' + (aiIsSaved(r) ? ' on' : '') + '" data-a="aiSave" aria-pressed="' + aiIsSaved(r) + '" aria-label="' + (aiIsSaved(r) ? 'Remove from saved foods' : 'Save this food') + '">' + AI_IC.mark.replace('<svg', '<svg width="20" height="20"' + (aiIsSaved(r) ? ' fill="currentColor"' : '')) + '</button><button class="small" style="color:var(--bad);font-weight:600;padding:6px" data-a="aiDel" aria-label="Delete this meal">Delete</button></span></div>';
  s += '<input class="field aires-name" data-ai="rname" value="' + esc(r.name) + '" aria-label="Meal name">';
  s += '<div class="row" style="justify-content:space-between;gap:10px;margin-top:6px"><label class="row" style="gap:8px"><span class="small fg2">Time</span><input class="field" type="time" data-ai="rtime" value="' + esc(r.time || '') + '" aria-label="Meal time" style="width:136px;height:38px;padding:0 10px"></label>' +
    '<div class="aistep"><button class="icon-btn" style="width:38px;height:38px" data-a="aiServ" data-v="-0.5" aria-label="Fewer servings"' + (sv <= 0.5 ? ' disabled' : '') + '>' + ic('minus') + '</button><b class="tnum" aria-live="polite" aria-label="' + sv + ' servings">' + sv + '</b><button class="icon-btn" style="width:38px;height:38px" data-a="aiServ" data-v="0.5" aria-label="More servings">' + ic('plus') + '</button></div></div><div class="xs muted" style="text-align:right;margin-top:2px">servings</div>';
  s += '<div class="card" style="margin-top:10px"><div class="row" style="justify-content:space-between"><span class="small fg2">Calories</span><span style="color:var(--fuel)">' + AI_IC.flame.replace('<svg', '<svg width="20" height="20"') + '</span></div><div class="aibigk tnum" id="aiR-kcal" style="margin-top:4px">' + fmtN(T.k * sv) + '</div></div>';
  s += '<div class="aigrid">' + [['Protein', 'p', T.p, 'var(--fuel)'], ['Carbs', 'c', T.c, 'var(--train)'], ['Fat', 'f', T.f, 'var(--mind)']].map((m) => '<div class="card"><div class="xs" style="color:' + m[3] + ';font-weight:700">' + m[0] + '</div><div class="v tnum"><span id="aiR-' + m[1] + '">' + fmtN(m[2] * sv) + '</span><span class="xs muted"> g</span></div></div>').join('') + '</div>';
  if (T.hasN) s += '<div class="aimini">' + [['Fiber', 'fi', T.fi, 'g'], ['Sugar', 'su', T.su, 'g'], ['Sodium', 'na', T.na, 'mg']].map((m) => '<div class="card"><div class="xs muted" style="font-weight:600">' + m[0] + '</div><div class="tnum" style="font-weight:700;font-family:var(--rounded);font-size:18px"><span id="aiR-' + m[1] + '">' + fmtN(m[2] * sv) + '</span><span class="xs muted"> ' + m[3] + '</span></div></div>').join('') + '</div>';
  s += '<div class="lbl" style="margin-top:12px">Meal type</div><div class="aichips" role="group" aria-label="Meal type">' + D.SLOTS.map((x) => '<button class="' + (r.slot === x.id ? 'on' : '') + '" data-a="aiSlot" data-v="' + x.id + '" aria-pressed="' + (r.slot === x.id) + '">' + esc(x.n) + '</button>').join('') + '</div>';
  s += '<p class="small" id="aiR-left" style="margin:10px 2px 0;font-weight:600;color:' + (left >= 0 ? 'var(--fuel)' : 'var(--bad)') + '">' + esc(aiLeft(left)) + ' after this meal</p>';
  if (sc != null) s += '<div class="card aiscore" style="margin-top:10px"><div class="row" style="justify-content:space-between"><span class="small fg2">Health score</span><b class="tnum">' + sc + '/10</b></div><div class="bar" role="progressbar" aria-label="Health score" aria-valuemin="1" aria-valuemax="10" aria-valuenow="' + sc + '"><i style="width:' + sc * 10 + '%;background:' + scol + '"></i></div>' + (r.why ? '<p class="small fg2" style="margin:8px 0 0">' + esc(r.why) + '</p>' : '') + '</div>';
  s += '<div class="row" style="justify-content:space-between;margin:18px 2px 4px"><h3 class="h-sm">Ingredients</h3><button class="small" style="color:var(--fuel);font-weight:700;padding:6px" data-a="aiIngOpen">+ Add ingredient</button></div><div class="card" style="padding:4px 14px">';
  r.items.forEach((x, i) => {
    s += '<button class="aiing" data-a="aiEdit" data-v="' + i + '" aria-expanded="' + (AI.edit === i) + '" aria-label="Edit ' + esc(x.name) + '"><span class="row" style="justify-content:space-between;gap:10px"><span class="grow" style="min-width:0"><span style="display:block;font-weight:600">' + esc(x.name) + '</span><span class="xs muted tnum" id="aiI-' + i + '" style="display:block">' + fmtN(x.grams * sv) + ' g · ' + fmtN(x.kcal * sv) + ' kcal</span></span><span class="muted">' + ic('pen').replace('<svg', '<svg width="16" height="16"') + '</span></span></button>';
    if (AI.edit === i) s += '<div class="aiedit"><input class="field full" data-ai="iname" data-i="' + i + '" value="' + esc(x.name) + '" aria-label="Ingredient name">' +
      [['kcal', 'kcal', x.kcal], ['p', 'Protein g', x.p], ['c', 'Carbs g', x.c], ['f', 'Fat g', x.f]].map((f) => '<label><span class="xs muted" style="display:block;text-align:center">' + f[1] + '</span><input class="field tnum" inputmode="decimal" data-ai="item" data-i="' + i + '" data-f="' + f[0] + '" value="' + aiR2(f[2] * sv) + '" aria-label="' + f[1] + '"></label>').join('') +
      '<button class="btn ghost sm full" style="color:var(--bad)" data-a="aiRemove" data-v="' + i + '" aria-label="Remove ' + esc(x.name) + '">Remove ingredient</button></div>';
  });
  s += '</div>';
  if (r.note) s += '<p class="xs muted" style="margin:8px 2px 0">' + esc(r.note) + '</p>';
  s += '<div class="row" style="gap:10px;margin-top:16px"><button class="btn ghost" data-a="aiFixOpen">Fix results</button><button class="btn fuel grow" data-a="closeSheet">Done</button></div>';
  s += '<button class="btn ghost block" style="margin-top:8px" data-a="aiAgain">' + (r.date === todayISO() ? 'Log again' : 'Copy to today') + '</button>';
  return s;
}
function aiRefreshRes() {
  const r = AI.res; if (!r) return;
  const sv = r.servings, T = aiSum(r.items), set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('aiR-kcal', fmtN(T.k * sv)); set('aiR-p', fmtN(T.p * sv)); set('aiR-c', fmtN(T.c * sv)); set('aiR-f', fmtN(T.f * sv)); set('aiR-fi', fmtN(T.fi * sv)); set('aiR-su', fmtN(T.su * sv)); set('aiR-na', fmtN(T.na * sv));
  const left = aiRemaining(r.date).kcal, e = document.getElementById('aiR-left');
  if (e) { e.textContent = aiLeft(left) + ' after this meal'; e.style.color = left >= 0 ? 'var(--fuel)' : 'var(--bad)'; }
  r.items.forEach((x, i) => set('aiI-' + i, fmtN(x.grams * sv) + ' g · ' + fmtN(x.kcal * sv) + ' kcal'));
}
function aiKeySheet() {
  return '<h2 class="h-lg">Add your AI key</h2><p class="small fg2" style="margin:6px 0 12px">Scan a plate, a label or a barcode, or describe a meal, and Gemini estimates calories and macros. It needs your own Gemini API key. Create one at <b>aistudio.google.com</b> (Get API key), then paste it here or in Settings. It stays on this device only.</p>' +
    '<input class="field" id="aiKeyIn" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste your Gemini API key" aria-label="Gemini API key">' +
    '<button class="btn fuel block" style="margin-top:12px" data-a="aiKeySave">Save key</button><button class="btn ghost block" style="margin-top:8px" data-a="closeSheet">Not now</button>';
}
function aiSettingsCard() {
  const has = !!aiKey(), burn = !!S.settings.aiBurn, exb = !!S.settings.aiExBack, rol = !!S.settings.aiRollover;
  const tg = (k, on, t, sub) => '<div class="row"><span class="grow"><span style="font-weight:600;display:block">' + t + '</span><span class="small muted">' + sub + '</span></span><button class="toggle' + (on ? ' on' : '') + '" data-a="setting" data-k="' + k + '" data-v="' + (!on) + '" aria-pressed="' + on + '" aria-label="' + t + '"></button></div>';
  return '<div class="card stack"><div><div style="font-weight:600">AI food logging</div><div class="small muted">Scan a plate, a label or a barcode, or describe a meal, and Gemini estimates the macros. Uses your own Gemini API key from aistudio.google.com. Stored on this device only, never synced or backed up.</div></div>' +
    (has ? '<div class="row" style="justify-content:space-between"><span class="small" style="color:var(--good)">Key saved on this device</span><button class="btn ghost sm" style="color:var(--bad)" data-a="aiKeyClear">Remove key</button></div>'
      : '<input class="field" id="aiKeyIn" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste your Gemini API key" aria-label="Gemini API key"><button class="btn fuel sm" data-a="aiKeySave">Save key</button>') +
    '<div class="row"><span class="grow"><span style="font-weight:600;display:block">Add Apple Health active energy to my budget</span><span class="small muted">Calories burned raise what you have left today</span></span><button class="toggle' + (burn ? ' on' : '') + '" data-a="setting" data-k="aiBurn" data-v="' + (!burn) + '" aria-pressed="' + burn + '" aria-label="Add active energy to budget"></button></div>' +
    tg('aiExBack', exb, 'Add logged exercise back to my budget', 'Exercise you log counts as calories burned. With both this and Apple Health on, the higher of the two is used so nothing is counted twice') +
    tg('aiRollover', rol, 'Roll over unused calories (up to ' + AI_ROLL_CAP + ')', 'Yesterday’s unused calories are added to today, if you logged a meal yesterday') + '</div>';
}
function aiRenderSheet(v) {
  return ({ ai: aiSheet, aikey: aiKeySheet, aiadd: aiAddSheet, aibar: aiBarSheet, aires: aiResSheet, aifix: aiFixSheet, aiing: aiIngSheet, aiex: aiExSheet, aisaved: aiSavedSheet })[v]();
}
