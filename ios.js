/* iOS feel: springs, haptics, push/pop and sheet transitions, edge-swipe back,
   drag-to-dismiss sheets and scroll-linked navigation bars. */
'use strict';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const noAnim = () => RM.matches || document.hidden || window.NO_ANIM;

/* Critically damped by default. response = seconds to (nearly) settle, damping 1 = no overshoot.
   Starts from wherever the element is now and carries the velocity it is given (px/s). */
function spring({ from, to, velocity = 0, response = 0.4, damping = 1, onUpdate, onDone }) {
  const k = Math.pow(2 * Math.PI / response, 2), c = 4 * Math.PI * damping / response;
  let x = from - to, v = velocity, last = performance.now(), id = 0, alive = true;
  const finish = () => { if (!alive) return; alive = false; clearTimeout(guard); cancelAnimationFrame(id); onUpdate(to); if (onDone) onDone(); };
  const step = (now) => {
    if (!alive) return;
    const dt = Math.min(0.064, (now - last) / 1000); last = now;
    for (let i = 0; i < 8; i++) { const h = dt / 8; v += (-k * x - c * v) * h; x += v * h; }
    if (Math.abs(x) < 0.3 && Math.abs(v) < 10) { finish(); return; }
    onUpdate(to + x); id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  /* Frames can stop arriving (Low Power Mode, a backgrounded or throttled page). The state change a spring
     finishes (closing a screen or a sheet) must still happen, so it lands on its end value regardless. */
  const guard = setTimeout(finish, Math.max(700, response * 2500));
  return { stop() { alive = false; clearTimeout(guard); cancelAnimationFrame(id); } };
}
/* Apple's momentum projection: where a flick would come to rest */
const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
const rubber = (o, dim, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));
function setX(el, x) { el.__x = x; el.style.transform = x ? 'translate3d(' + x.toFixed(2) + 'px,0,0)' : ''; }
function setY(el, y) { el.__y = y; el.style.transform = y ? 'translate3d(0,' + y.toFixed(2) + 'px,0)' : ''; }
function shade(el, f) { el.style.filter = f > 0.001 ? 'brightness(' + (1 - 0.18 * f).toFixed(3) + ')' : ''; }
/* Touch pointers are already captured by the element they started on. Capturing them again would retarget
   the click that ends a tap to the captor (the sheet or layer), so the button under the finger never got it. */
function capture(el, e) { if (e.pointerType === 'mouse') { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } } }
function stackEls() { return $$('#layers > *'); }
function velocityOf(hist) {
  if (hist.length < 2) return 0;
  const a = hist[0], b = hist[hist.length - 1];
  return (b[1] - a[1]) / Math.max(1, b[0] - a[0]) * 1000;
}

/* ------------------------------------------------------------------ haptics
   Vibration API where it exists; on iOS 18+ Safari, toggling a hidden switch
   control gives a light system haptic when it happens inside a tap. */
const Haptic = {
  el: null,
  tap() {
    try {
      if (navigator.vibrate) { navigator.vibrate(8); return; }
      if (!this.el) {
        const l = document.createElement('label'); l.className = 'haptic'; l.setAttribute('aria-hidden', 'true');
        const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
        l.appendChild(i); document.body.appendChild(l); this.el = l;
      }
      this.el.click();
    } catch (e) { /* no haptics here */ }
  },
};
['done', 'go'].forEach((k) => { const f = Sound[k].bind(Sound); Sound[k] = function () { Haptic.tap(); f(); }; });
document.addEventListener('click', (e) => {
  if (e.target.closest('.check, .toggle, .seg button, .scale button, .stp button, .tab, .water button, .setc, .phase-bar button, .dpill')) Haptic.tap();
}, true);
// lets :active styles fire on iOS Safari
document.addEventListener('touchstart', () => {}, { passive: true });

/* ------------------------------------------------------------------ push / pop */
let popping = null, pushing = null;
const _push = push, _pop = pop;
push = function (v, p) {
  _push(v, p);
  if (noAnim()) return;
  const els = stackEls(), top = els[els.length - 1]; if (!top) return;
  const under = els.length > 1 ? els[els.length - 2] : $('#app');
  if (top.matches('.layer')) {
    const W = innerWidth;
    setX(top, W);
    pushing = spring({ from: W, to: 0, response: 0.42, onUpdate: (x) => { setX(top, x); setX(under, -0.3 * (W - x)); shade(under, 1 - x / W); }, onDone: () => { pushing = null; setX(under, 0); shade(under, 0); } });
  } else {
    const H = innerHeight;
    setY(top, H);
    pushing = spring({ from: H, to: 0, response: 0.45, onUpdate: (y) => setY(top, y), onDone: () => { pushing = null; } });
  }
};
pop = function (velocity = 0) {
  if (popping) return;
  if (pushing) { pushing.stop(); pushing = null; }
  const els = stackEls(), top = els[els.length - 1];
  if (!top || noAnim()) return _pop();
  const under = els.length > 1 ? els[els.length - 2] : $('#app');
  top.style.pointerEvents = 'none'; // taps during the slide-out land on the screen underneath
  const commit = () => { popping = null; setX(under, 0); shade(under, 0); _pop(); };
  if (top.matches('.layer')) {
    const W = innerWidth;
    popping = spring({ from: top.__x || 0, to: W, velocity, response: 0.36, onUpdate: (x) => { setX(top, x); setX(under, -0.3 * (W - x)); shade(under, 1 - x / W); }, onDone: commit });
  } else {
    popping = spring({ from: top.__y || 0, to: innerHeight, velocity, response: 0.38, onUpdate: (y) => setY(top, y), onDone: commit });
  }
};

/* ------------------------------------------------------------------ edge swipe back (1:1, velocity-projected) */
/* A drag that really moved something must not also count as a tap on whatever is under the finger.
   Only real drags (more than a few px of travel) swallow the click that follows, and only that one click:
   small finger drift during a tap never cancels it. */
let edge = null, suppressUntil = 0;
function swallowNextClick() { suppressUntil = performance.now() + 400; }
document.addEventListener('pointerdown', (e) => {
  const els = stackEls(), top = els[els.length - 1];
  if (!top || !top.matches('.layer') || popping || ui.sheet || e.clientX > 28) return;
  edge = { top, under: els.length > 1 ? els[els.length - 2] : $('#app'), x0: e.clientX, y0: e.clientY, hist: [[e.timeStamp, 0]], on: false, id: e.pointerId };
}, true);
document.addEventListener('pointermove', (e) => {
  if (!edge || e.pointerId !== edge.id) return;
  const dx = e.clientX - edge.x0, dy = e.clientY - edge.y0;
  if (!edge.on) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { edge = null; return; }
    if (dx < 10) return;
    edge.on = true;
    if (pushing) { pushing.stop(); pushing = null; } // the finger takes over a slide that is still running
    capture(edge.top, e);
  }
  const W = innerWidth, x = Math.max(0, dx - 10);
  setX(edge.top, x); setX(edge.under, -0.3 * (W - x)); shade(edge.under, 1 - x / W);
  edge.hist.push([e.timeStamp, x]); if (edge.hist.length > 6) edge.hist.shift();
}, true);
function endEdge(e) {
  if (!edge || e.pointerId !== edge.id) return;
  const g = edge; edge = null;
  if (!g.on) return;
  const W = innerWidth, x = g.top.__x || 0, v = velocityOf(g.hist);
  if (x > 6) swallowNextClick();
  if (x + project(v, 0.99) > W / 2 && v > -200) { pop(v); return; }
  spring({ from: x, to: 0, velocity: v, response: 0.35, onUpdate: (xx) => { setX(g.top, xx); setX(g.under, -0.3 * (W - xx)); shade(g.under, 1 - xx / W); }, onDone: () => { setX(g.under, 0); shade(g.under, 0); } });
}
document.addEventListener('pointerup', endEdge, true);
document.addEventListener('pointercancel', endEdge, true);
document.addEventListener('pointerdown', () => { suppressUntil = 0; }, true);
document.addEventListener('click', (e) => { if (suppressUntil && performance.now() < suppressUntil) { suppressUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);

/* ------------------------------------------------------------------ sheets: spring in, drag down to dismiss */
const _openSheet = openSheet;
openSheet = function (v, p) {
  const was = !!ui.sheet;
  _openSheet(v, p);
  if (was || noAnim()) return;
  const sh = $('#sheet .sheet'), sc = $('#sheet .scrim'); if (!sh) return;
  const H = sh.offsetHeight + 40;
  setY(sh, H); sc.style.opacity = '0';
  spring({ from: H, to: 0, response: 0.42, onUpdate: (y) => { setY(sh, y); sc.style.opacity = String(Math.max(0, 1 - y / H)); } });
};
let dismissing = false;
function dismissSheet(v) {
  const sh = $('#sheet .sheet'), sc = $('#sheet .scrim');
  if (!sh || noAnim()) { closeSheet(); return; }
  if (dismissing) return; dismissing = true;
  sh.style.pointerEvents = 'none'; if (sc) sc.style.pointerEvents = 'none'; // taps go through while it slides away
  const H = sh.offsetHeight + 40;
  spring({ from: sh.__y || 0, to: H, velocity: v || 0, response: 0.34, onUpdate: (y) => { setY(sh, y); if (sc) sc.style.opacity = String(Math.max(0, 1 - y / H)); }, onDone: () => { dismissing = false; closeSheet(); } });
}
A.closeSheet = () => dismissSheet(0);

let sd = null;
document.addEventListener('pointerdown', (e) => {
  const sh = e.target.closest && e.target.closest('#sheet .sheet');
  if (!sh || dismissing) return;
  sd = { sh, sc: $('#sheet .scrim'), x0: e.clientX, y0: e.clientY, hist: [[e.timeStamp, 0]], on: false, id: e.pointerId, grab: e.clientY - sh.getBoundingClientRect().top < 44 };
}, true);
document.addEventListener('pointermove', (e) => {
  if (!sd || e.pointerId !== sd.id) return;
  const dx = e.clientX - sd.x0, dy = e.clientY - sd.y0;
  if (!sd.on) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { sd = null; return; }
    if (dy < -8 && !sd.grab) { sd = null; return; }
    if (Math.abs(dy) < 10 || (sd.sh.scrollTop > 0 && !sd.grab)) return;
    sd.on = true; sd.base = dy;
    capture(sd.sh, e);
  }
  const H = sd.sh.offsetHeight, raw = dy - sd.base, y = raw >= 0 ? raw : rubber(raw, H);
  setY(sd.sh, y); if (sd.sc) sd.sc.style.opacity = String(Math.max(0, 1 - y / H));
  sd.hist.push([e.timeStamp, y]); if (sd.hist.length > 6) sd.hist.shift();
}, true);
function endSheet(e) {
  if (!sd || e.pointerId !== sd.id) return;
  const g = sd; sd = null;
  if (!g.on) return;
  const H = g.sh.offsetHeight, y = g.sh.__y || 0, v = velocityOf(g.hist);
  if (Math.abs(y) > 6) swallowNextClick();
  if (y + project(v, 0.99) > H * 0.35 && v > -100) { dismissSheet(v); return; }
  spring({ from: y, to: 0, velocity: v, response: 0.35, damping: 0.85, onUpdate: (yy) => { setY(g.sh, yy); if (g.sc) g.sc.style.opacity = String(Math.max(0, 1 - Math.max(0, yy) / H)); } });
}
document.addEventListener('pointerup', endSheet, true);
document.addEventListener('pointercancel', endSheet, true);

/* ------------------------------------------------------------------ scroll-linked bars */
function syncNav() {
  document.body.classList.toggle('scrolled', !ui.stack.length && window.scrollY > 48);
  $$('.layer').forEach((l) => l.classList.toggle('scrolled', layerScroller(l).scrollTop > (l.querySelector('.lbar.float') ? 250 : 8)));
}
window.addEventListener('scroll', syncNav, { passive: true });
document.addEventListener('scroll', (e) => { const t = e.target; if (t && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('layer')) syncNav(); }, { passive: true, capture: true });
const _afterRender = afterRender;
afterRender = function () { _afterRender(); syncNav(); };
