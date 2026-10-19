/* Fresh Start service worker.
 * Network-first (no-cache revalidation, cache fallback) for pages, *.js, *.json and other shell files.
 * Cache-first for ex/ images and audio (persistent MEDIA cache; audio served as 206 byte ranges for Safari).
 * Never touches cross-origin requests (e.g. api.github.com Gists). */
const VERSION = "fresh-start-20261019155518";
const SHELL = VERSION, MEDIA = "fresh-start-media-v1";
const SHELL_ASSETS = ["ai-food.js", "core.js", "data.js", "figs.js", "health.js", "icon-180.png", "icon-192.png", "icon-512.png", "index.html", "ios.js", "manifest.webmanifest", "players.js", "views.js", "audio/tracks.json"];
const MEDIA_ASSETS = ["ex/Ab_Roller-0.jpg", "ex/Ab_Roller-1.jpg", "ex/Air_Bike-0.jpg", "ex/Air_Bike-1.jpg", "ex/Back_Flyes_-_With_Bands-0.jpg", "ex/Back_Flyes_-_With_Bands-1.jpg", "ex/Band_Good_Morning_Pull_Through-0.jpg", "ex/Band_Good_Morning_Pull_Through-1.jpg", "ex/Barbell_Ab_Rollout_-_On_Knees-0.jpg", "ex/Barbell_Ab_Rollout_-_On_Knees-1.jpg", "ex/Barbell_Bench_Press_-_Medium_Grip-0.jpg", "ex/Barbell_Bench_Press_-_Medium_Grip-1.jpg", "ex/Barbell_Hip_Thrust-0.jpg", "ex/Barbell_Hip_Thrust-1.jpg", "ex/Bear_Crawl_Sled_Drags-0.jpg", "ex/Bear_Crawl_Sled_Drags-1.jpg", "ex/Bent_Over_Barbell_Row-0.jpg", "ex/Bent_Over_Barbell_Row-1.jpg", "ex/Bicycling_Stationary-0.jpg", "ex/Bicycling_Stationary-1.jpg", "ex/Butt_Lift_Bridge-0.jpg", "ex/Butt_Lift_Bridge-1.jpg", "ex/Cable_Crossover-0.jpg", "ex/Cable_Crossover-1.jpg", "ex/Cable_Crunch-0.jpg", "ex/Cable_Crunch-1.jpg", "ex/Cable_One_Arm_Tricep_Extension-0.jpg", "ex/Cable_One_Arm_Tricep_Extension-1.jpg", "ex/Cat_Stretch-0.jpg", "ex/Cat_Stretch-1.jpg", "ex/Cross_Body_Hammer_Curl-0.jpg", "ex/Cross_Body_Hammer_Curl-1.jpg", "ex/Dead_Bug-0.jpg", "ex/Dead_Bug-1.jpg", "ex/Dumbbell_Bench_Press-0.jpg", "ex/Dumbbell_Bench_Press-1.jpg", "ex/Dumbbell_Incline_Row-0.jpg", "ex/Dumbbell_Incline_Row-1.jpg", "ex/Dumbbell_Lunges-0.jpg", "ex/Dumbbell_Lunges-1.jpg", "ex/EZ-Bar_Curl-0.jpg", "ex/EZ-Bar_Curl-1.jpg", "ex/External_Rotation_with_Band-0.jpg", "ex/External_Rotation_with_Band-1.jpg", "ex/Face_Pull-0.jpg", "ex/Face_Pull-1.jpg", "ex/Farmers_Walk-0.jpg", "ex/Farmers_Walk-1.jpg", "ex/Flat_Bench_Lying_Leg_Raise-0.jpg", "ex/Flat_Bench_Lying_Leg_Raise-1.jpg", "ex/Freehand_Jump_Squat-0.jpg", "ex/Freehand_Jump_Squat-1.jpg", "ex/Front_Box_Jump-0.jpg", "ex/Front_Box_Jump-1.jpg", "ex/Goblet_Squat-0.jpg", "ex/Goblet_Squat-1.jpg", "ex/Hack_Squat-0.jpg", "ex/Hack_Squat-1.jpg", "ex/Hammer_Curls-0.jpg", "ex/Hammer_Curls-1.jpg", "ex/Hanging_Leg_Raise-0.jpg", "ex/Hanging_Leg_Raise-1.jpg", "ex/Hyperextensions_Back_Extensions-0.jpg", "ex/Hyperextensions_Back_Extensions-1.jpg", "ex/Incline_Cable_Chest_Press-0.jpg", "ex/Incline_Cable_Chest_Press-1.jpg", "ex/Incline_Dumbbell_Curl-0.jpg", "ex/Incline_Dumbbell_Curl-1.jpg", "ex/Incline_Dumbbell_Press-0.jpg", "ex/Incline_Dumbbell_Press-1.jpg", "ex/Inverted_Row-0.jpg", "ex/Inverted_Row-1.jpg", "ex/Jackknife_Sit-Up-0.jpg", "ex/Jackknife_Sit-Up-1.jpg", "ex/Kettlebell_One-Legged_Deadlift-0.jpg", "ex/Kettlebell_One-Legged_Deadlift-1.jpg", "ex/Knee_Hip_Raise_On_Parallel_Bars-0.jpg", "ex/Knee_Hip_Raise_On_Parallel_Bars-1.jpg", "ex/Kneeling_Hip_Flexor-0.jpg", "ex/Kneeling_Hip_Flexor-1.jpg", "ex/Kneeling_Single-Arm_High_Pulley_Row-0.jpg", "ex/Kneeling_Single-Arm_High_Pulley_Row-1.jpg", "ex/Landmine_180s-0.jpg", "ex/Landmine_180s-1.jpg", "ex/Landmine_Linear_Jammer-0.jpg", "ex/Landmine_Linear_Jammer-1.jpg", "ex/Leg_Extensions-0.jpg", "ex/Leg_Extensions-1.jpg", "ex/Leg_Press-0.jpg", "ex/Leg_Press-1.jpg", "ex/Lying_T-Bar_Row-0.jpg", "ex/Lying_T-Bar_Row-1.jpg", "ex/Medicine_Ball_Chest_Pass-0.jpg", "ex/Medicine_Ball_Chest_Pass-1.jpg", "ex/Monster_Walk-0.jpg", "ex/Monster_Walk-1.jpg", "ex/Natural_Glute_Ham_Raise-0.jpg", "ex/Natural_Glute_Ham_Raise-1.jpg", "ex/One-Arm_Kettlebell_Swings-0.jpg", "ex/One-Arm_Kettlebell_Swings-1.jpg", "ex/One_Arm_Against_Wall-0.jpg", "ex/One_Arm_Against_Wall-1.jpg", "ex/Pallof_Press-0.jpg", "ex/Pallof_Press-1.jpg", "ex/Plank-0.jpg", "ex/Plank-1.jpg", "ex/Pushups-0.jpg", "ex/Pushups-1.jpg", "ex/Reverse_Crunch-0.jpg", "ex/Reverse_Crunch-1.jpg", "ex/Reverse_Flyes-0.jpg", "ex/Reverse_Flyes-1.jpg", "ex/Reverse_Hyperextension-0.jpg", "ex/Reverse_Hyperextension-1.jpg", "ex/Rowing_Stationary-0.jpg", "ex/Rowing_Stationary-1.jpg", "ex/Running_Treadmill-0.jpg", "ex/Running_Treadmill-1.jpg", "ex/Russian_Twist-0.jpg", "ex/Russian_Twist-1.jpg", "ex/Scapular_Pull-Up-0.jpg", "ex/Scapular_Pull-Up-1.jpg", "ex/Seated_Dumbbell_Press-0.jpg", "ex/Seated_Dumbbell_Press-1.jpg", "ex/Seated_Leg_Curl-0.jpg", "ex/Seated_Leg_Curl-1.jpg", "ex/Seated_Leg_Tucks-0.jpg", "ex/Seated_Leg_Tucks-1.jpg", "ex/Seated_One-arm_Cable_Pulley_Rows-0.jpg", "ex/Seated_One-arm_Cable_Pulley_Rows-1.jpg", "ex/Side_Bridge-0.jpg", "ex/Side_Bridge-1.jpg", "ex/Sled_Push-0.jpg", "ex/Sled_Push-1.jpg", "ex/Split_Squat_with_Dumbbells-0.jpg", "ex/Split_Squat_with_Dumbbells-1.jpg", "ex/Standing_Cable_Lift-0.jpg", "ex/Standing_Cable_Lift-1.jpg", "ex/Standing_Cable_Wood_Chop-0.jpg", "ex/Standing_Cable_Wood_Chop-1.jpg", "ex/Standing_Calf_Raises-0.jpg", "ex/Standing_Calf_Raises-1.jpg", "ex/Standing_Low-Pulley_Deltoid_Raise-0.jpg", "ex/Standing_Low-Pulley_Deltoid_Raise-1.jpg", "ex/Standing_Palm-In_One-Arm_Dumbbell_Press-0.jpg", "ex/Standing_Palm-In_One-Arm_Dumbbell_Press-1.jpg", "ex/Stiff-Legged_Dumbbell_Deadlift-0.jpg", "ex/Stiff-Legged_Dumbbell_Deadlift-1.jpg", "ex/Stomach_Vacuum-0.jpg", "ex/Stomach_Vacuum-1.jpg", "ex/Straight-Arm_Pulldown-0.jpg", "ex/Straight-Arm_Pulldown-1.jpg", "ex/Straight_Raises_on_Incline_Bench-0.jpg", "ex/Straight_Raises_on_Incline_Bench-1.jpg", "ex/Trap_Bar_Deadlift-0.jpg", "ex/Trap_Bar_Deadlift-1.jpg", "ex/Triceps_Pushdown_-_Rope_Attachment-0.jpg", "ex/Triceps_Pushdown_-_Rope_Attachment-1.jpg", "ex/Tuck_Crunch-0.jpg", "ex/Tuck_Crunch-1.jpg", "ex/V-Bar_Pulldown-0.jpg", "ex/V-Bar_Pulldown-1.jpg", "ex/V-Bar_Pullup-0.jpg", "ex/V-Bar_Pullup-1.jpg", "ex/Walking_Treadmill-0.jpg", "ex/Walking_Treadmill-1.jpg", "ex/Weighted_Crunches-0.jpg", "ex/Weighted_Crunches-1.jpg", "ex/Weighted_Pull_Ups-0.jpg", "ex/Weighted_Pull_Ups-1.jpg", "ex/Wind_Sprints-0.jpg", "ex/Wind_Sprints-1.jpg", "audio/box4.mp4", "audio/breath10.mp4", "audio/ground.mp4", "audio/metta15.mp4", "audio/ninety.mp4", "audio/nsdr10.mp4", "audio/nsdr20.mp4", "audio/open15.mp4", "audio/open20.mp4", "audio/physio.mp4", "audio/scan12.mp4", "audio/scan15.mp4", "audio/sigh5.mp4", "audio/sit30.mp4", "audio/stop.mp4"];
const NET_TIMEOUT = 5000;
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const sc = await caches.open(SHELL);
    await Promise.all(SHELL_ASSETS.map((a) => fetch(a, { cache: 'reload' }).then((r) => r.ok && sc.put(a, r)).catch(() => {})));
    try {
      const mc = await caches.open(MEDIA);
      for (const a of MEDIA_ASSETS) { if (!(await mc.match(a))) { try { const r = await fetch(a); if (r.ok) await mc.put(a, r); } catch (_) {} } }
    } catch (_) {}
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => (k.startsWith("fresh-start-") || /^fs-/.test(k)) && k !== SHELL && k !== MEDIA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const isMedia = (p) => /\/(ex|audio)\//.test(p) && !/\.json$/.test(p);
async function networkFirst(req, key) {
  const cache = await caches.open(SHELL);
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), NET_TIMEOUT);
    const res = await fetch(key, { cache: 'no-cache', signal: ctl.signal });
    clearTimeout(t);
    if (res.ok) { cache.put(key, res.clone()); return res; }
    const hit = await cache.match(key, { ignoreSearch: true });
    return hit || res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreSearch: true }) || (req.mode === 'navigate' && await cache.match('index.html'));
    return hit || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
async function mediaFirst(req, url) {
  const cache = await caches.open(MEDIA), key = url.pathname;
  let res = await cache.match(key);
  if (!res) {
    try {
      const full = await fetch(url.href);
      if (!full.ok) return full;
      cache.put(key, full.clone());
      res = full;
    } catch (err) { return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
  }
  const range = req.headers.get('range');
  if (!range) return res;
  const buf = await res.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const size = buf.byteLength;
  let start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (!m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
  if (start >= size) return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'video/mp4', 'Accept-Ranges': 'bytes',
    'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': String(end - start + 1) } });
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* api.github.com etc: straight to network */
  if (isMedia(url.pathname)) { e.respondWith(mediaFirst(req, url)); return; }
  const scope = new URL(self.registration.scope).pathname;
  let key = url.pathname.slice(scope.length);
  /* a tapped file link (the .shortcut download) is a navigation too: let the browser fetch the real file */
  if (req.mode === 'navigate' && /\.[a-z0-9]+$/i.test(key) && !/\.html?$/i.test(key)) return;
  if (req.mode === 'navigate' || key === '' || key === 'index.html') key = 'index.html';
  e.respondWith(networkFirst(req, key));
});
