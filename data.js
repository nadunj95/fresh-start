/* Fresh Start 2.0 — The Sri Lanka Cut. Program data transcribed from the plan document. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ exercises
     img: photo pair in ex/<img>-0.jpg / -1.jpg   fig: animated figure fallback
     lower: progress in 10 lb steps instead of 5 lb   side: dosed per side      */
  const EX = {
    /* Pull */
    cs_db_row: { n: 'Chest-supported DB row', img: 'Dumbbell_Incline_Row', eq: 'Dumbbells · incline bench', m: 'Mid back, lats, rear delts',
      cues: ['Chest on a 30–45° bench, chin slightly tucked, neck long.', 'Drive the elbows back toward your hips and squeeze the shoulder blades down and back.', 'Pause 1 s at the top, lower for 2–3 s.'] },
    ng_pulldown: { n: 'Neutral-grip lat pulldown', img: 'V-Bar_Pulldown', eq: 'Cable · V-handle', m: 'Lats',
      cues: ['Lean back slightly, chest up.', 'Pull the handle to your upper chest, elbows down to your ribs.', 'Shoulders stay away from your ears. No shrug.'] },
    prone_y: { n: 'Prone Y raise (light)', img: 'Straight_Raises_on_Incline_Bench', eq: 'Light plates or DBs · incline bench', m: 'Lower traps',
      cues: ['Chest on the bench, thumbs up.', 'Raise the arms into a Y, shoulder blades sliding down and back.', 'Light weight. Eyes down, neck relaxed.'] },
    prone_yw: { n: 'Prone Y-W raise', img: 'Straight_Raises_on_Incline_Bench', eq: 'Light plates or DBs · incline bench', m: 'Lower traps, rotator cuff',
      cues: ['Y: raise the arms overhead in a Y, thumbs up.', 'W: pull the elbows down and back into a W and squeeze.', '8 of each, slow and light.'] },
    hk_cable_row: { n: 'Half-kneeling 1-arm cable row', img: 'Kneeling_Single-Arm_High_Pulley_Row', eq: 'Cable · single handle', m: 'Lats, mid back', side: true,
      cues: ['Half-kneel, ribs down, squeeze the glute of the down knee.', 'Row to the lower ribs and let the shoulder blade move fully.', 'Reach forward at the bottom without twisting.'] },
    cable_row_1arm: { n: '1-arm cable row', img: 'Seated_One-arm_Cable_Pulley_Rows', eq: 'Cable · single handle', m: 'Lats, mid back', side: true,
      cues: ['Tall posture, ribs down.', 'Row to the hip pocket, elbow close to the body.', 'Let the shoulder blade reach forward at the bottom.'] },
    face_pull: { n: 'Face pull', img: 'Face_Pull', eq: 'Cable · rope', m: 'Rear delts, rotator cuff, mid traps',
      cues: ['Rope at upper-chest height or a little higher.', 'Pull to your ears, then rotate the hands out and back (thumbs back).', 'Pause. Ribs down, neck long.'] },
    band_face_pull: { n: 'Band face pull', img: 'Face_Pull', eq: 'Resistance band', m: 'Rear delts, rotator cuff',
      cues: ['Band anchored at face height.', 'Pull to your ears and rotate out.', 'Smooth reps; this is activation, not a grind.'] },
    incline_db_curl: { n: 'Incline DB curl', img: 'Incline_Dumbbell_Curl', eq: 'Dumbbells · incline bench', m: 'Biceps (long head)',
      cues: ['Bench at 45–60°, arms hanging straight down.', 'Curl without letting the elbows drift forward.', 'Lower all the way to a full stretch.'] },
    hammer_curl: { n: 'Hammer curl', img: 'Hammer_Curls', eq: 'Dumbbells', m: 'Brachialis, forearms',
      cues: ['Neutral grip, palms facing each other.', 'Elbows pinned to your sides.', 'No swinging; 2 s down.'] },
    ng_pullup: { n: 'Neutral-grip pull-up', img: 'V-Bar_Pullup', eq: 'Pull-up bar (neutral handles)', m: 'Lats, biceps', neckAlt: 'ng_pulldown',
      cues: ['Start from a dead hang, shoulders pulled down first.', 'Drive the elbows to your ribs, chest to the bar.', 'Add weight once 3 × 8 at bodyweight is easy.'] },
    tbar_row: { n: 'Chest-supported T-bar / seal row', img: 'Lying_T-Bar_Row', eq: 'T-bar row machine or seal bench', m: 'Mid back, lats',
      cues: ['Chest stays glued to the pad.', 'Row the elbows back and squeeze for 1 s.', 'Last set: rest-pause.'] },
    straight_arm_pd: { n: 'Straight-arm pulldown', img: 'Straight-Arm_Pulldown', eq: 'Cable · bar or rope', m: 'Lats',
      cues: ['Hinge slightly, arms long with soft elbows.', 'Sweep the bar down to your thighs using the lats.', 'Shoulders stay down, not rolled forward.'] },
    ez_curl: { n: 'EZ-bar curl', img: 'EZ-Bar_Curl', eq: 'EZ bar', m: 'Biceps',
      cues: ['Elbows at your sides, wrists neutral.', 'Curl up, squeeze, lower for 2 s.', 'Last set: myo-reps.'] },
    ez_21s: { n: 'EZ-bar curl 21s', img: 'EZ-Bar_Curl', eq: 'EZ bar', m: 'Biceps',
      cues: ['7 reps bottom half, 7 reps top half, 7 full reps.', 'No rest between the parts.', 'Use about 70% of your normal curl weight.'] },
    farmer: { n: "Farmer's carry", img: 'Farmers_Walk', eq: 'Dumbbells, kettlebells or handles', m: 'Grip, traps, core',
      cues: ['Moderate load. Shoulders packed down, not shrugged.', 'Walk tall with short, quick steps.', 'Skip it today if the neck is above 2/10.'] },
    w_pullup: { n: 'Weighted pull-up clusters', img: 'Weighted_Pull_Ups', eq: 'Pull-up bar · dip belt', m: 'Lats, biceps', neckAlt: 'ng_pulldown',
      cues: ['Load at about your 5-rep max.', 'Do 3 reps, rest 15 s on the bar or off it, then 2 more.', 'Full dead hang between reps.'] },
    pendlay: { n: 'Pendlay row', img: 'Bent_Over_Barbell_Row', eq: 'Barbell', m: 'Upper back, lats', gate: 'pendlay', alt: 'tbar_row',
      cues: ['Torso near parallel, back flat.', 'Pull the bar from the floor to the lower chest explosively.', 'Reset on the floor each rep.'] },
    rear_delt_fly: { n: 'Rear-delt fly', img: 'Reverse_Flyes', eq: 'Dumbbells or cable', m: 'Rear delts',
      cues: ['Hinge with a flat back.', 'Sweep the arms out wide, pinkies leading.', 'No shrugging; keep the neck long.'] },
    row_erg: { n: 'Row erg (calories)', img: 'Rowing_Stationary', eq: 'Rowing machine', m: 'Full body',
      cues: ['Legs, then hips, then arms.', 'Fast drive, relaxed recovery.', 'Hit the calorie target each odd minute.'] },
    inverted_row: { n: 'Inverted row', img: 'Inverted_Row', eq: 'Smith bar, rings or TRX', m: 'Upper back',
      cues: ['Body in a straight plank line.', 'Pull the chest to the bar.', 'Lower under control.'] },
    scap_pullup: { n: 'Scap pull-up', img: 'Scapular_Pull-Up', eq: 'Pull-up bar', m: 'Lower traps, lats',
      cues: ['Hang with straight arms.', 'Pull the shoulder blades down without bending the elbows.', 'Pause 1 s, release slowly.'] },

    leanaway_lateral: { n: 'Lean-away cable lateral raise', img: 'Standing_Low-Pulley_Deltoid_Raise', eq: 'Cable · single handle', m: 'Side delts', side: true,
      cues: ['Hold the stand and lean away from the cable.', 'Stop below shoulder height, shoulders down.', 'Lead with the elbow, 2 s down.'] },
    xbody_hammer: { n: 'Cross-body hammer curl', img: 'Cross_Body_Hammer_Curl', eq: 'Dumbbells', m: 'Brachialis, forearms',
      cues: ['Curl the dumbbell across toward the opposite shoulder.', 'Elbow pinned to your side.', 'No swinging; 2 s down.'] },

    /* Legs */
    goblet_box: { n: 'Goblet squat to box, heels elevated', img: 'Goblet_Squat', eq: 'Dumbbell or kettlebell · box · wedge', m: 'Quads, glutes', lower: true,
      cues: ['Heels on a wedge or plates, box behind you.', '3 s down to touch the box, no plopping.', 'Elbows inside the knees, chest tall.'] },
    db_rdl: { n: 'DB Romanian deadlift', img: 'Stiff-Legged_Dumbbell_Deadlift', eq: 'Dumbbells', m: 'Hamstrings, glutes', lower: true, swapTo: 'pull_through',
      cues: ['Soft knees, push the hips back.', 'Dumbbells close to the legs, back flat.', 'Pain-free range only. If the low back goes above 2/10, swap to cable pull-through.'] },
    pull_through: { n: 'Cable pull-through', img: 'Band_Good_Morning_Pull_Through', eq: 'Cable · rope', m: 'Glutes, hamstrings', lower: true,
      cues: ['Face away from the cable, rope between the legs.', 'Hinge back, then drive the hips through.', 'Squeeze the glutes at the top; no lower-back extension.'] },
    leg_press: { n: 'Leg press', img: 'Leg_Press', eq: 'Leg press machine', m: 'Quads, glutes', lower: true,
      cues: ['Controlled depth: stop before the low back peels off the pad.', 'Push through the whole foot.', "Don't lock the knees hard."] },
    seated_leg_curl: { n: 'Seated leg curl', img: 'Seated_Leg_Curl', eq: 'Leg curl machine', m: 'Hamstrings', lower: true,
      cues: ['Pad just above the ankles, hips pinned.', 'Curl all the way, pause.', '2–3 s on the way up.'] },
    hip_thrust: { n: 'Hip thrust', img: 'Barbell_Hip_Thrust', eq: 'Barbell or machine · bench', m: 'Glutes', lower: true,
      cues: ['Upper back on the bench, chin tucked.', 'Drive through the heels until hips are level.', 'Ribs down at the top, 1 s squeeze.'] },
    copenhagen_short: { n: 'Copenhagen plank, short lever', fig: 'copenhagen', eq: 'Bench', m: 'Adductors, obliques', side: true,
      cues: ['Side plank with the top KNEE on the bench.', 'Lift the hips into a straight line.', 'Groin should feel worked, never painful.'] },
    copenhagen_long: { n: 'Copenhagen plank, long lever', fig: 'copenhagen', eq: 'Bench', m: 'Adductors, obliques', side: true,
      cues: ['Side plank with the top FOOT/ankle on the bench.', 'Hips up in a straight line.', 'Drop back to short lever if the groin complains.'] },
    calf_raise: { n: 'Standing calf raise', img: 'Standing_Calf_Raises', eq: 'Calf machine or step', m: 'Calves', lower: true,
      cues: ['Full stretch at the bottom with a 2 s pause.', 'Rise as high as you can.', 'No bouncing.'] },
    pallof: { n: 'Pallof press', img: 'Pallof_Press', eq: 'Cable or band', m: 'Anti-rotation core', side: true,
      cues: ['Stand side-on to the cable, handle at the sternum.', 'Press straight out and resist the twist.', 'Hold 2 s, return.'] },
    trapbar: { n: 'Trap-bar deadlift', img: 'Trap_Bar_Deadlift', eq: 'Trap bar', m: 'Glutes, hamstrings, back', lower: true, gate: 'trapbar', alt: 'db_rdl',
      cues: ['Stand in the centre, high handles to start.', 'Brace, push the floor away.', 'Lock out with glutes, not by leaning back.'] },
    hack_squat: { n: 'Hack squat or belt squat', img: 'Hack_Squat', eq: 'Hack squat or belt squat machine', m: 'Quads, glutes', lower: true,
      cues: ['Back flat on the pad (no bar on the traps).', 'Sit deep with knees tracking over toes.', 'Last set: rest-pause.'] },
    bulgarian: { n: 'Bulgarian split squat', img: 'Split_Squat_with_Dumbbells', eq: 'Dumbbells · bench', m: 'Quads, glutes', side: true, lower: true,
      cues: ['Rear foot on the bench, front foot far enough forward.', 'Drop straight down, slight forward lean.', 'Drive through the front heel.'] },
    leg_ext: { n: 'Leg extension', img: 'Leg_Extensions', eq: 'Leg extension machine', m: 'Quads', lower: true,
      cues: ['Knee lined up with the machine pivot.', 'Squeeze 1 s at the top.', 'Lower for 2–3 s.'] },
    reverse_hyper: { n: 'Reverse hyper (or 45° back extension)', img: 'Reverse_Hyperextension', eq: 'Reverse hyper, or a 45° back-extension bench', m: 'Glutes, low back', backAlt: 'bridge_squeeze', backMax: 2,
      cues: ['Squeeze the glutes to lift the legs (on a 45° bench, round slightly and drive with the glutes).', 'Stop at a straight line; no overarching.', 'Controlled 2-s lower.'] },
    nordic: { n: 'Nordic hamstring negative', img: 'Natural_Glute_Ham_Raise', eq: 'Pad · anchored ankles (partner or bar)', m: 'Hamstrings (eccentric)',
      cues: ['Hips straight, body in one line.', 'Lower as slowly as you can, about 5 s.', 'Catch with your hands and push back up.'] },
    deadbug_pullover: { n: 'Dead bug with band pullover', img: 'Dead_Bug', eq: 'Band or light DB', m: 'Deep core', side: true,
      cues: ['Low back pressed down, knees over hips.', 'Pull the band overhead tension while one leg extends.', 'Exhale fully on every rep.'] },
    walking_lunge: { n: 'DB walking lunge', img: 'Dumbbell_Lunges', eq: 'Dumbbells', m: 'Quads, glutes', side: true, lower: true,
      cues: ['Long stride, back knee kisses the floor.', 'Torso tall.', 'Drive through the front heel into the next step.'] },
    air_bike: { n: 'Air bike', img: 'Bicycling_Stationary', eq: 'Air / assault bike', m: 'Conditioning',
      cues: ['Push and pull with arms and legs.', 'Hard means RPE 8 — you can hold it for the full interval.', 'Easy means really easy.'] },

    /* Push */
    db_bench: { capped: true, n: 'Flat DB bench press', img: 'Dumbbell_Bench_Press', eq: 'Dumbbells · flat bench', m: 'Chest, triceps',
      cues: ['Shoulder blades down and back, minimal arch.', 'Lower to the chest with elbows ~45°.', 'Press up and slightly in.'] },
    landmine_press: { capped: true, n: 'Half-kneeling landmine press', img: 'Landmine_Linear_Jammer', eq: 'Landmine · barbell', m: 'Shoulders, upper chest, serratus', side: true,
      cues: ['Half-kneel, same-side knee down as the pressing arm.', 'Press up and forward along the bar path, reach at the top.', 'Ribs down, glute squeezed. Neck-friendly overhead pattern.'] },
    cable_fly: { n: 'Cable fly, mid-height', img: 'Cable_Crossover', eq: 'Cable · D-handles', m: 'Chest',
      cues: ['Pulleys at chest height, slight forward stance.', 'Soft elbows, hug a big tree.', 'Stretch wide, squeeze in front.'] },
    cable_lateral: { n: 'Cable lateral raise', img: 'Standing_Low-Pulley_Deltoid_Raise', eq: 'Cable · single handle', m: 'Side delts', side: true,
      cues: ['Stop just below shoulder height.', 'Shoulders down, no shrug.', 'Lead with the elbow.'] },
    rope_pushdown: { n: 'Rope pushdown', img: 'Triceps_Pushdown_-_Rope_Attachment', eq: 'Cable · rope', m: 'Triceps',
      cues: ['Elbows pinned at your sides.', 'Push down and spread the rope at the bottom.', 'Control on the way up.'] },
    xbody_tri: { n: 'Cross-body cable triceps extension', img: 'Cable_One_Arm_Tricep_Extension', eq: 'Cable · single handle', m: 'Triceps', side: true,
      cues: ['Cable set at shoulder height on the opposite side.', 'Extend the arm across the body, elbow fixed.', 'Full stretch, full lockout.'] },
    pushup_plus: { n: 'Push-up plus', img: 'Pushups', eq: 'Bodyweight (hands elevated if needed)', m: 'Chest, serratus',
      cues: ['Normal push-up, then at the top push the floor away further.', 'Let the shoulder blades wrap around the ribs.', 'Hands on a bench if needed to keep RIR 2.'] },
    bench: { n: 'Bench press (barbell or DB)', img: 'Barbell_Bench_Press_-_Medium_Grip', eq: 'Barbell or dumbbells', m: 'Chest, triceps', neckAlt: 'db_bench', neckMax: 1,
      cues: ['Barbell only when the neck is 0–1; otherwise the app gives you DBs.', "Shoulder blades back and down; minimal arch; don't drive the head into the bench.", 'Bar to the lower chest, elbows ~45°.'] },
    incline_db: { n: '30° incline DB press', img: 'Incline_Dumbbell_Press', eq: 'Dumbbells · incline bench', m: 'Upper chest',
      cues: ['Bench at 30°, shoulder blades set.', 'Lower to the upper chest.', 'Press up without banging the DBs.'] },
    hl_cable_fly: { n: 'High-to-low cable fly', img: 'Cable_Crossover', eq: 'Cable · D-handles', m: 'Lower chest',
      cues: ['Pulleys high, sweep down toward the hips.', 'Soft elbows.', 'Last set: mechanical drop (step forward and keep going).'] },
    seated_db_press: { capped: true, n: 'Seated neutral-grip DB shoulder press', img: 'Seated_Dumbbell_Press', eq: 'Dumbbells · upright bench', m: 'Shoulders', gate: 'ohp_seated', alt: 'landmine_press',
      cues: ['Only if the neck has been quiet for 3+ weeks.', 'Palms facing each other, ribs down.', 'Press up without jutting the head forward.'] },
    hk_db_press: { capped: true, n: 'Half-kneeling 1-arm DB press', img: 'Standing_Palm-In_One-Arm_Dumbbell_Press', eq: 'Dumbbell', m: 'Shoulders, core', side: true, gate: 'ohp', alt: 'landmine_press',
      cues: ['Half-kneel, glute squeezed, ribs down.', 'Neutral grip, press up and slightly forward.', 'Stop the set at any neck or arm symptom.'] },
    incline_cable_press: { n: 'Low-incline cable press', img: 'Incline_Cable_Chest_Press', eq: 'Cables · incline bench', m: 'Upper chest',
      cues: ['Bench at 15–30°, shoulder blades set.', 'Press up and slightly in, elbows ~45°.', 'Stretch fully at the bottom, 2 s down.'] },
    pushup: { n: 'Push-up', img: 'Pushups', eq: 'Bodyweight', m: 'Chest, triceps',
      cues: ['Straight line from head to heels.', 'Chest to the floor.', 'Elbows about 45°.'] },
    pushup_ladder: { n: 'Push-up ladder', img: 'Pushups', eq: 'Bodyweight', m: 'Chest, triceps',
      cues: ['1 rep, rest, 2 reps, rest… up to 10, then back down.', 'Rest as briefly as you can.', '5-minute cap: stop wherever you are.'] },

    /* Rugby Day / conditioning */
    sled_push: { n: 'Sled push', img: 'Sled_Push', eq: 'Sled', m: 'Legs, conditioning',
      cues: ['Arms locked, body at 45°.', 'Drive with short powerful steps.', 'Head neutral; look at the floor ahead.'] },
    goblet_carry: { n: 'Goblet carry', fig: 'goblet_carry', eq: 'Dumbbell or kettlebell', m: 'Core, upper back',
      cues: ['Hold the weight at your chest, elbows tucked.', 'Walk tall, ribs down.', 'Breathe behind the brace.'] },
    band_pull_apart: { n: 'Band pull-apart', img: 'Back_Flyes_-_With_Bands', eq: 'Band', m: 'Rear delts, mid back',
      cues: ['Arms straight in front at shoulder height.', 'Pull the band to your chest by spreading the arms.', 'Shoulders down.'] },
    dead_bug: { n: 'Dead bug', img: 'Dead_Bug', eq: 'Floor', m: 'Deep core', side: true,
      cues: ['Low back pressed into the floor.', 'Extend opposite arm and leg slowly.', 'Long exhale as you reach.'] },
    sprint: { n: 'Sprint', img: 'Wind_Sprints', eq: 'Track or field', m: 'Speed',
      cues: ['Full warm-up first.', 'Hit the target intensity, not more.', 'Walk back; full recovery between reps.'] },
    strides: { n: 'Strides', img: 'Wind_Sprints', eq: 'Track or field', m: 'Speed',
      cues: ['Smooth build to the target pace.', 'Relaxed shoulders, tall posture.', 'Walk back.'] },
    mb_chest_pass: { n: 'Med-ball chest pass', img: 'Medicine_Ball_Chest_Pass', eq: 'Medicine ball · wall', m: 'Upper-body power',
      cues: ['Athletic stance.', 'Explode the ball into the wall from the chest.', 'Catch, reset, repeat.'] },
    box_jump: { n: 'Box jump', img: 'Front_Box_Jump', eq: 'Plyo box', m: 'Lower-body power',
      cues: ['Swing the arms and jump.', 'Land softly in a quarter squat.', 'Step down; never jump down.'] },
    kb_swing: { n: 'Kettlebell swing', img: 'One-Arm_Kettlebell_Swings', eq: 'Kettlebell', m: 'Glutes, hamstrings',
      cues: ['Hike the bell back, then snap the hips through.', 'Arms are ropes; the hips do the work.', 'Bell floats to chest height.'] },
    burpee: { n: 'Burpee', fig: 'burpee', eq: 'Bodyweight', m: 'Conditioning',
      cues: ['Hands down, jump the feet back.', 'Chest to the floor, push up.', 'Feet in, stand, small jump.'] },
    bear_crawl: { n: 'Bear crawl', img: 'Bear_Crawl_Sled_Drags', eq: 'Floor', m: 'Core, shoulders',
      cues: ['Knees hovering an inch off the floor.', 'Opposite hand and foot move together.', 'Back flat, hips low.'] },
    suitcase_carry: { n: 'Suitcase carry', fig: 'suitcase', eq: 'Dumbbell or kettlebell', m: 'Obliques, grip', side: true, neckAlt: 'pallof',
      cues: ['Heavy weight in one hand only.', "Stay perfectly upright; don't lean.", 'Switch hands each length.'] },
    trapbar_jump: { n: 'Trap-bar jump or box jump', img: 'Freehand_Jump_Squat', eq: 'Light trap bar or box', m: 'Power',
      cues: ['Light load, maximum intent.', 'Quarter dip, explode up.', 'Land soft, reset each rep.'] },
    landmine_rot: { n: 'Landmine rotational press', img: 'Landmine_180s', eq: 'Landmine · barbell', m: 'Rotational power', side: true, gate: 'rotation', alt: 'pallof',
      cues: ['Load the back hip, then rotate and press.', 'Pivot the back foot.', 'Only once morning back pain is 0.'] },
    hanging_leg_raise: { n: 'Hanging leg raise', img: 'Hanging_Leg_Raise', eq: 'Pull-up bar', m: 'Lower abs', neckAlt: 'rc_hip_lift',
      cues: ['Dead hang, shoulders active.', 'Curl the pelvis up, not just the legs.', 'No swinging.'] },
    goblet_squat: { n: 'Goblet squat', img: 'Goblet_Squat', eq: 'Dumbbell or kettlebell', m: 'Quads, glutes', lower: true,
      cues: ['Weight at the chest.', 'Sit between the heels, chest tall.', 'Drive up.'] },
    run: { n: 'Run', img: 'Running_Treadmill', eq: 'Road, track or treadmill', m: 'Aerobic base',
      cues: ['Zone 2: full sentences, nose breathing, roughly 120–140 bpm.', 'The talk test wins over the watch.', 'Relaxed shoulders, quick light steps.'] },
    swim: { n: 'Swim (backstroke or snorkel)', fig: 'swim', eq: 'Pool · pull buoy · centre snorkel', m: 'Aerobic base',
      cues: ['Backstroke, pull buoy, or freestyle with a centre-mount snorkel.', 'No freestyle with head turns until the MRI.', 'Easy and continuous.'] },
    walk: { n: 'Walk', img: 'Walking_Treadmill', eq: 'Outside if you can', m: 'Recovery, steps',
      cues: ['Nose breathing.', 'Daily target 9,000–11,000 steps.', 'Once a week: phone-free.'] },

    /* Core */
    reverse_crunch: { n: 'Reverse crunch, 3 s down', img: 'Reverse_Crunch', eq: 'Floor', m: 'Lower abs',
      cues: ['Curl the pelvis toward the ribs.', 'Lower for 3 s.', 'Low back stays down.'] },
    heel_taps: { n: 'Heel taps, knees bent', fig: 'heel_taps', eq: 'Floor', m: 'Lower abs',
      cues: ['On your back, hips and knees at 90°.', 'Tap one heel to the floor, return, switch.', 'Low back pressed down.'] },
    plank_ppt: { n: 'Forearm plank, posterior tilt', img: 'Plank', eq: 'Floor', m: 'Anti-extension core',
      cues: ['Tuck the pelvis under, squeeze glutes.', 'Pull elbows toward toes.', 'Head neutral.'] },
    hollow_tuck: { n: 'Hollow hold, tucked', fig: 'hollow', eq: 'Floor', m: 'Abs',
      cues: ['Low back pressed into the floor.', 'Knees bent, shoulders lifted slightly.', 'Breathe behind the brace.'] },
    hollow_ext: { n: 'Hollow hold, arms extended', fig: 'hollow', eq: 'Floor', m: 'Abs',
      cues: ['Arms by the ears, legs long and low.', 'Low back stays pressed down.', 'Bend the knees to regress.'] },
    side_plank_l: { n: 'Side plank, left', img: 'Side_Bridge', eq: 'Floor', m: 'Obliques',
      cues: ['Elbow under the shoulder.', 'Straight line head to heels.', 'Your weaker side; own it.'] },
    side_plank_r: { n: 'Side plank, right', img: 'Side_Bridge', eq: 'Floor', m: 'Obliques',
      cues: ['Elbow under the shoulder.', 'Straight line head to heels.', 'Match the left side, not more.'] },
    side_plank: { n: 'Side plank', img: 'Side_Bridge', eq: 'Floor', m: 'Obliques', side: true,
      cues: ['Elbow under the shoulder.', 'Straight line head to heels.', 'Hold per side.'] },
    hk_pallof_l: { n: 'Half-kneeling Pallof press, left', img: 'Pallof_Press', eq: 'Cable or band', m: 'Anti-rotation',
      cues: ['Half-kneel side-on to the cable.', 'Press out and hold, resist the twist.', 'Ribs down.'] },
    hk_pallof_r: { n: 'Half-kneeling Pallof press, right', img: 'Pallof_Press', eq: 'Cable or band', m: 'Anti-rotation',
      cues: ['Half-kneel side-on to the cable.', 'Press out and hold, resist the twist.', 'Ribs down.'] },
    bird_dog: { n: 'Bird dog', fig: 'bird_dog', eq: 'Floor', m: 'Back extensors, glutes', side: true,
      cues: ['Hands under shoulders, knees under hips.', 'Reach opposite arm and leg long, hold.', "Don't let the hips rotate."] },
    mcgill_curlup: { n: 'McGill curl-up', fig: 'curl_up', eq: 'Floor', m: 'Abs (spine-sparing)',
      cues: ['One knee bent, one leg straight, hands under the low back.', 'Lift head and shoulders slightly as one unit.', 'Never pull on the head.'] },
    ball_rollout: { n: 'Stability-ball rollout, short range', img: 'Barbell_Ab_Rollout_-_On_Knees', eq: 'Stability ball', m: 'Anti-extension',
      cues: ['Kneel with forearms on the ball.', 'Roll out a short distance, ribs down.', 'Pull back with the abs.'] },
    glute_bridge_march: { n: 'Glute bridge march', img: 'Butt_Lift_Bridge', eq: 'Floor', m: 'Glutes, core',
      cues: ['Bridge up, hips level.', 'Lift one knee, then the other.', "Don't let the hips drop or twist."] },
    bear_taps: { n: 'Bear plank shoulder taps', fig: 'bear_taps', eq: 'Floor', m: 'Core, shoulders',
      cues: ['Knees hovering an inch off the floor.', 'Tap the opposite shoulder slowly.', 'Hips stay still.'] },
    vacuum: { n: 'Stomach vacuum', img: 'Stomach_Vacuum', eq: 'None', m: 'Transverse abdominis',
      cues: ['Exhale everything.', 'Draw the belly up and in.', 'Hold with small sips of air.'] },
    hanging_knee_raise: { n: 'Hanging knee raise', img: 'Knee_Hip_Raise_On_Parallel_Bars', eq: "Bar or captain's chair", m: 'Lower abs', neckAlt: 'rc_hip_lift',
      cues: ['Curl the pelvis up first; the knees follow.', 'Knees to the chest, no swing.', 'Lower slowly. On a high-neck day the app swaps to the floor version.'] },
    rc_hip_lift: { n: 'Reverse crunch to hip lift', img: 'Reverse_Crunch', eq: 'Floor', m: 'Lower abs',
      cues: ['Curl the knees in, then lift the hips off the floor.', 'Lower slowly.', 'Arms pressing into the floor.'] },
    ab_wheel: { n: 'Ab wheel from knees', img: 'Ab_Roller', eq: 'Ab wheel', m: 'Anti-extension', gate: 'abwheel', alt: 'ball_rollout',
      cues: ['Hips forward, ribs down.', 'Roll as far as you can hold a flat back.', 'Pull back with the abs.'] },
    cable_chop_l: { n: 'Half-kneeling cable chop, left', img: 'Standing_Cable_Wood_Chop', eq: 'Cable · rope', m: 'Obliques',
      cues: ['High to low across the body.', 'Hips stay square.', 'Control the return.'] },
    cable_chop_r: { n: 'Half-kneeling cable chop, right', img: 'Standing_Cable_Wood_Chop', eq: 'Cable · rope', m: 'Obliques',
      cues: ['High to low across the body.', 'Hips stay square.', 'Control the return.'] },
    cable_chop: { n: 'Cable chop', img: 'Standing_Cable_Wood_Chop', eq: 'Cable · rope', m: 'Obliques',
      cues: ['High to low across the body.', 'Hips stay square.', 'Switch sides halfway.'] },
    suitcase_march: { n: 'Suitcase march, heavy KB', fig: 'suitcase', eq: 'Kettlebell', m: 'Obliques', neckAlt: 'side_plank_sw',
      cues: ['Heavy bell in one hand, march in place.', 'Stay perfectly tall.', 'Switch sides at 20 s.'] },
    thread_needle: { n: 'Side plank thread-the-needle', img: 'Side_Bridge', eq: 'Floor', m: 'Obliques',
      cues: ['Side plank, reach the top arm under the body and rotate.', 'Open back up and reach to the ceiling.', 'Switch sides halfway.'] },
    side_plank_sw: { n: 'Side plank, switch halfway', img: 'Side_Bridge', eq: 'Floor', m: 'Obliques',
      cues: ['Elbow under the shoulder.', 'Straight line head to heels.', 'Switch sides halfway.'] },
    pallof_sw: { n: 'Pallof press, switch halfway', img: 'Pallof_Press', eq: 'Cable or band', m: 'Anti-rotation core',
      cues: ['Stand side-on to the cable, handle at the sternum.', 'Press straight out and resist the twist.', 'Switch sides halfway.'] },
    side_plank_dips: { n: 'Side plank hip dips', img: 'Side_Bridge', eq: 'Floor', m: 'Obliques',
      cues: ['Side plank, lower the hip toward the floor.', 'Lift back up past neutral.', 'Switch sides at 20 s.'] },
    bicycle: { n: 'Slow bicycle crunch, hands on chest', img: 'Air_Bike', eq: 'Floor', m: 'Obliques',
      cues: ['Hands on the chest, not behind the head.', 'Rotate the ribcage toward the knee.', 'Slow and controlled.'] },
    rope_crunch: { n: 'Kneeling rope cable crunch', img: 'Cable_Crunch', eq: 'Cable · rope', m: 'Upper abs',
      cues: ['Neck neutral; rope by the forehead.', 'Curl the ribs toward the pelvis.', "Hips don't move."] },
    plate_crunch: { n: 'Plate-loaded crunch', img: 'Weighted_Crunches', eq: 'Plate', m: 'Upper abs',
      cues: ['Plate on the chest, not behind the head.', 'Curl up, exhale hard.', 'Lower slowly.'] },
    long_plank: { n: 'Long-lever plank, posterior tilt', img: 'Plank', eq: 'Floor', m: 'Anti-extension',
      cues: ['Elbows further forward than normal.', 'Pelvis tucked, glutes on.', 'Hold the line.'] },
    tuck_vsit: { n: 'Tuck V-sit hold', img: 'Seated_Leg_Tucks', eq: 'Floor', m: 'Abs',
      cues: ['Balance on the sit bones.', 'Knees tucked, chest tall.', 'Hold.'] },
    hlr_straight: { n: 'Straight-leg hanging leg raise', img: 'Hanging_Leg_Raise', eq: 'Pull-up bar', m: 'Lower abs', gate: 'backgate', alt: 'hanging_knee_raise', neckAlt: 'rc_hip_lift',
      cues: ['Strict and fresh only: no swing, no kip.', 'Pelvis first, then the legs.', 'Toes-to-bar only once it is strict.'] },
    hang_oblique: { n: 'Alternating hanging oblique knee raise', img: 'Knee_Hip_Raise_On_Parallel_Bars', eq: "Bar or captain's chair", m: 'Obliques', neckAlt: 'side_plank_dips',
      cues: ['Raise the knees toward one elbow.', 'Alternate sides.', 'Control the descent.'] },
    landmine_rainbow: { n: 'Landmine rainbow', img: 'Landmine_180s', eq: 'Landmine · barbell', m: 'Obliques', gate: 'backgate', alt: 'cable_chop',
      cues: ['Arms long, sweep the bar side to side.', 'Hips and ribs stay square.', 'Back gate: back pain 0 for 3 weeks.'] },
    cable_lift: { n: 'Half-kneeling cable lift', img: 'Standing_Cable_Lift', eq: 'Cable · rope', m: 'Obliques',
      cues: ['Low to high across the body.', 'Switch sides at 20 s.', 'Ribs down.'] },
    weighted_rope_crunch: { n: 'Weighted rope cable crunch', img: 'Cable_Crunch', eq: 'Cable · rope', m: 'Upper abs',
      cues: ['Heavier than Phase 2.', 'Curl ribs to pelvis.', 'Neck neutral.'] },
    vup: { n: 'V-up', img: 'Jackknife_Sit-Up', eq: 'Floor', m: 'Abs', gate: 'backgate', alt: 'tuck_up',
      cues: ['Arms and legs meet over the hips.', 'Lower with control.', 'Back gate: back pain 0 for 3 weeks.'] },
    tuck_up: { n: 'Tuck-up', img: 'Tuck_Crunch', eq: 'Floor', m: 'Abs',
      cues: ['Knees and chest come together.', 'Exhale hard.', 'Lower slowly.'] },
    side_plank_leg: { n: 'Side plank with top-leg raise', img: 'Side_Bridge', eq: 'Floor', m: 'Obliques, glute med',
      cues: ['Side plank, raise the top leg.', 'Hips stay stacked.', 'Switch sides at 20 s.'] },
    stir_pot: { n: 'Stir-the-pot', fig: 'stir_pot', eq: 'Stability ball', m: 'Anti-extension, anti-rotation',
      cues: ['Forearm plank on a ball.', 'Draw small circles with the forearms.', 'Switch direction halfway.'] },
    dragon_flag: { n: 'Dragon flag negative', img: 'Flat_Bench_Lying_Leg_Raise', eq: 'Bench', m: 'Abs', gate: 'backgate', alt: 'lying_leg_raise',
      cues: ['Hold the bench behind your head.', 'Body straight from shoulders, lower slowly.', 'Back gate: back pain 0 for 3 weeks.'] },
    lying_leg_raise: { n: 'Lying leg raise with hip lift', img: 'Flat_Bench_Lying_Leg_Raise', eq: 'Bench or floor', m: 'Lower abs',
      cues: ['Raise the legs to vertical.', 'Lift the hips off the bench.', 'Lower slowly, back flat.'] },
    russian_twist: { n: 'Plate Russian twist, feet down', img: 'Russian_Twist', eq: 'Plate', m: 'Obliques', gate: 'backgate', alt: 'pallof_sw',
      cues: ['Feet on the floor.', 'Rotate the ribcage, not just the arms.', 'Slow.'] },
    hollow_rock: { n: 'Hollow rock', fig: 'hollow_rock', eq: 'Floor', m: 'Abs',
      cues: ['Hold the hollow position.', 'Rock gently from shoulders to hips.', 'Low back stays pressed down.'] },
    weighted_suitcase: { n: 'Heavy suitcase carry', fig: 'suitcase', eq: 'Dumbbell or kettlebell', m: 'Obliques, grip', neckAlt: 'side_plank_sw',
      cues: ['Walk tall with one heavy weight.', 'Switch sides at 20 s.', "Don't lean."] },

    /* Armor, Rehab Ramp, Deep Core */
    breath_9090: { n: '90/90 breathing', fig: 'breath9090', eq: 'Wall', m: 'Diaphragm, rib position', audio: 'ninety',
      cues: ['Feet on a wall, hips and knees at 90°.', '5 s in through the nose, 7 s out.', 'Ribs down.'] },
    chin_tuck: { n: 'Chin tuck holds', fig: 'chin_tuck', eq: 'None', m: 'Deep neck flexors',
      cues: ['Glide the head straight back, making a double chin.', "Don't tilt the head down.", 'Hold 5 s.'] },
    chin_tuck_dnf: { n: 'Chin tuck + deep neck flexor hold', fig: 'chin_tuck', eq: 'None', m: 'Deep neck flexors',
      cues: ['Lying on your back, tuck the chin.', 'Lift the head a few millimetres off the floor.', 'Hold 5 s.'] },
    doorway_pec: { n: 'Doorway pec minor stretch', img: 'One_Arm_Against_Wall', eq: 'Doorframe', m: 'Pec minor', side: true,
      cues: ['Forearm on the frame at about 120°.', 'Lean forward and slightly down.', 'Gentle stretch under the collarbone.'] },
    wall_slide: { n: 'Foam-roller serratus wall slide', fig: 'wall_slide', eq: 'Foam roller · wall', m: 'Serratus, lower traps',
      cues: ['Forearms on a roller against the wall.', 'Slide up, reaching the shoulder blades around the ribs.', 'Lift slightly off the wall at the top.'] },
    open_book: { n: 'Thoracic open book', fig: 'open_book', eq: 'Floor', m: 'Thoracic rotation', side: true,
      cues: ['Side-lying, knees bent and stacked.', 'Open the top arm across, following it with your eyes.', 'Exhale into the stretch.'] },
    nerve_slider: { n: 'Median nerve slider', fig: 'nerve_slider', eq: 'None', m: 'Nerve mobility', side: true,
      cues: ['Only if symptom-free today.', 'Arm out, extend the wrist as you tilt the head toward it; reverse.', 'Easy motion. Never more tingling.'] },
    mcgill_big3: { n: 'McGill Big 3', fig: 'curl_up', eq: 'Floor', m: 'Spine-sparing core' },
    band_er: { n: 'Band external rotation, towel under the arm', img: 'External_Rotation_with_Band', eq: 'Band · rolled towel', m: 'Rotator cuff', side: true,
      cues: ['Rolled towel between the elbow and the ribs.', 'Rotate the hand out, forearm moving like a door.', 'Slow back in; shoulders down.'] },
    monster_walk: { n: 'Band monster walk', img: 'Monster_Walk', eq: 'Mini band', m: 'Glute medius', side: true,
      cues: ['Mini band above the knees, quarter squat.', 'Step wide diagonally, keep tension on the band.', 'Toes forward, hips level.'] },
    hip_switch: { n: '90/90 hip switches', fig: 'hip_switch', eq: 'Floor', m: 'Hip rotation',
      cues: ['Sit with both knees at 90°.', 'Rotate the knees to the other side.', 'Tall spine; use hands if needed.'] },
    rockback: { n: 'Adductor rockback', fig: 'rockback', eq: 'Floor', m: 'Adductors',
      cues: ['On all fours, one leg straight out to the side.', 'Rock the hips back.', 'Gentle stretch in the inner thigh.'] },
    hip_flexor: { n: 'Half-kneeling hip flexor stretch', img: 'Kneeling_Hip_Flexor', eq: 'Floor', m: 'Hip flexors', side: true,
      cues: ['Squeeze the glute of the down knee.', 'Tuck the pelvis, shift forward slightly.', 'Ribs down.'] },
    cat_cow: { n: 'Cat-cow + open book', img: 'Cat_Stretch', eq: 'Floor', m: 'Spine mobility',
      cues: ['Round and arch slowly.', 'Then thoracic open books.', 'Move with the breath.'] },
    bridge_squeeze: { n: 'Glute bridge + ball squeeze', img: 'Butt_Lift_Bridge', eq: 'Ball or pillow', m: 'Glutes, adductors',
      cues: ['Squeeze a ball between the knees.', 'Bridge up, hold 1 s.', 'Lower slowly.'] },
    hip_airplane: { n: 'Hip airplanes', img: 'Kettlebell_One-Legged_Deadlift', eq: 'Support if needed', m: 'Hip control', side: true,
      cues: ['Hinge on one leg.', 'Rotate the pelvis open, then closed.', 'Slow; hold something for balance.'] },
    croc_breath: { n: 'Crocodile breathing', fig: 'breath', eq: 'Floor', m: 'Diaphragm',
      cues: ['Face down, forehead on your hands.', 'Breathe into the belly, sides and low back.', '5 slow breaths.'] },
    draw_in: { n: 'Hands-and-knees draw-in', fig: 'draw_in', eq: 'Floor', m: 'Transverse abdominis',
      cues: ['On all fours.', 'Draw the navel gently toward the spine; back stays still.', 'Keep breathing.'] },
    pelvic_lift: { n: 'Pelvic floor + deep ab lift', fig: 'breath', eq: 'None', m: 'Pelvic floor, TVA',
      cues: ['On the exhale, lift the pelvic floor and draw in lightly.', 'Hold 5 s.', 'Release fully.'] },
    hollow_body: { n: 'Hollow body hold, tucked then extended', fig: 'hollow', eq: 'Floor', m: 'Abs',
      cues: ['Low back pressed into the floor.', 'Start tucked; extend when it is easy.', 'Breathe.'] },
    shoulder_down: { n: 'Shoulder blades down and back', fig: 'chin_tuck', eq: 'None', m: 'Lower traps',
      cues: ['Sit or stand tall.', 'Slide the shoulder blades down and back.', 'Release.'] },
    stand_up: { n: 'Stand up and move', img: 'Walking_Treadmill', eq: 'None', m: 'Circulation', cues: ['Stand up and walk for a minute.'] },
    full_body_pump: { n: 'Pump circuit', img: 'Pushups', eq: 'Gym', m: 'Full body' },
  };

  /* -------------------------------------------------------------- prescriptions */
  const I = (k, ex, sets, reps, rest, more) => Object.assign({ k, ex, sets, reps, rest }, more || {});

  const P1 = {
    pull: { title: 'Pull', dur: '60–70 min', ramp: 'pull', core: 'A', hero: 'cs_db_row', items: [
      I('A', 'cs_db_row', 4, '8–10', 90),
      I('B1', 'ng_pulldown', 3, '10–12', 0), I('B2', 'prone_y', 3, '10', 60),
      I('C1', 'hk_cable_row', 3, '12', 0, { side: true }), I('C2', 'face_pull', 3, '15', 60, { note: 'To the ears, rotate out' }),
      I('D1', 'incline_db_curl', 3, '10–12', 0), I('D2', 'hammer_curl', 3, '10–12', 45),
    ] },
    legs: { title: 'Legs', dur: '60–70 min', ramp: 'legs', core: 'B', hero: 'goblet_box', items: [
      I('A', 'goblet_box', 4, '8–10', 90, { note: 'Heels elevated, 3 s down' }),
      I('B', 'db_rdl', 3, '10–12', 90, { note: 'Pain-free range. Swap to cable pull-through if the low back goes above 2/10' }),
      I('C1', 'leg_press', 3, '12–15', 0, { note: 'Controlled depth' }), I('C2', 'seated_leg_curl', 3, '12–15', 60),
      I('D1', 'hip_thrust', 3, '10–12', 0), I('D2', 'copenhagen_short', 3, '', 60, { time: 15, side: true }),
      I('E1', 'calf_raise', 3, '12–15', 0, { note: '2 s pause at the bottom' }), I('E2', 'pallof', 2, '10', 45, { side: true }),
    ] },
    push: { title: 'Push', dur: '60–70 min', ramp: 'push', core: 'C', hero: 'db_bench', items: [
      I('A', 'db_bench', 4, '8–10', 90),
      I('B', 'landmine_press', 3, '10', 75, { side: true }),
      I('C1', 'cable_fly', 3, '12–15', 0), I('C2', 'cable_lateral', 3, '12–15', 60, { note: 'Stop below shoulder height, shoulders down' }),
      I('D1', 'rope_pushdown', 3, '12–15', 0), I('D2', 'xbody_tri', 3, '12–15', 45),
      I('E', 'pushup_plus', 2, 'max @ RIR 2', 60, { note: 'Hands elevated if needed', amrap: true }),
    ] },
  };

  const P2 = {
    pull: { title: 'Pull', dur: '60–70 min', ramp: 'pull', core: 'A', hero: 'ng_pullup', items: [
      I('A', 'ng_pullup', 4, '8', 120, { scheme: 'top', topReps: '5–6', topRIR: '1', backPct: 10, note: 'Top set 1 × 5–6 @ RIR 1, then 3 × 8 at −10%. Add weight once 3 × 8 at bodyweight is easy', bw: true }),
      I('B', 'tbar_row', 3, '8–10', 90, { tech: 'Rest-pause last set' }),
      I('C1', 'cable_row_1arm', 2, '10–12', 0, { side: true }), I('C2', 'face_pull', 2, '15', 60),
      I('D1', 'straight_arm_pd', 2, '12–15', 0), I('D2', 'prone_yw', 2, '8 each', 45),
      I('E1', 'ez_curl', 2, '8–12', 0, { tech: 'Myo-reps last set' }), I('E2', 'hammer_curl', 2, '10–12', 45),
      I('F', 'farmer', 2, '', 60, { dist: '40 m', note: 'Moderate, shoulders packed. Skip if the neck is above 2', neckSkip: 2 }),
    ] },
    legs: { title: 'Legs', dur: '60–70 min', ramp: 'legs', core: 'B', hero: 'trapbar', items: [
      I('A', 'trapbar', 3, '8', 150, { scheme: 'top', topReps: '5', topRIR: '1–2', backPct: 15, note: 'Gated. Top set 1 × 5 @ RIR 1–2, then 2 × 8 at −15%' }),
      I('B', 'hack_squat', 3, '6–10', 120, { tech: 'Rest-pause last set' }),
      I('C', 'bulgarian', 3, '8–10', 90, { side: true, tech: 'Last set to failure' }),
      I('D1', 'seated_leg_curl', 2, '10–12', 0, { tech: 'Drop set last set' }), I('D2', 'leg_ext', 2, '12–15', 45),
      I('E1', 'calf_raise', 3, '8–12', 0), I('E2', 'copenhagen_long', 2, '', 45, { time: 20, timeLabel: '15–25 s', side: true }),
      I('F', 'reverse_hyper', 3, '12–15', 60, { note: 'Only if morning back pain is 0–2; otherwise the app swaps to a glute bridge' }),
      I('G', 'nordic', 2, '4–6', 90, { note: '5-s lowering, catch with your hands' }),
    ] },
    push: { title: 'Push', dur: '60–70 min', ramp: 'push', core: 'C', hero: 'bench', items: [
      I('A', 'bench', 4, '10', 120, { scheme: 'top', topReps: '6–8', topRIR: '1', backPct: 10, note: 'Top set 1 × 6–8 @ RIR 1, then 3 × 10 at −10%. Minimal arch. Barbell only when the neck is 0–1.' }),
      I('B', 'landmine_press', 3, '8–10', 90, { side: true, fromWeek: { 5: 'hk_db_press' }, note: 'Week 5+: half-kneeling 1-arm DB press if the overhead gate is open' }),
      I('C1', 'incline_db', 3, '10–12', 0), I('C2', 'cable_lateral', 2, '12–15', 60),
      I('D1', 'hl_cable_fly', 2, '12–15', 0, { tech: 'Mechanical drop last set' }), I('D2', 'pushup_plus', 2, '12', 45),
      I('E1', 'rope_pushdown', 2, '12–15', 0, { tech: 'Drop set last set' }), I('E2', 'xbody_tri', 2, '12–15', 45, { tech: 'Drop set last set' }),
    ] },
  };

  const P3 = {
    pull: { title: 'Pull', dur: '60–70 min', ramp: 'pull', core: 'A', hero: 'w_pullup', items: [
      I('A', 'w_pullup', 5, '3+2', 120, { tech: 'Cluster: 15 s between mini-sets', note: 'At ~5RM' }),
      I('B', 'pendlay', 4, '6–8', 90),
      I('C1', 'cable_row_1arm', 2, '12', 0, { side: true }), I('C2', 'face_pull', 2, '15', 0), I('C3', 'rear_delt_fly', 2, '15', 60),
      I('D1', 'ez_21s', 2, '21', 0, { note: '7 bottom half, 7 top half, 7 full' }), I('D2', 'hammer_curl', 1, '12–15 + 4×3–5', 60, { tech: 'Myo-reps', fromWeek: { 11: 'xbody_hammer' } }),
      I('E', 'row_erg', 1, '', 0, { kind: 'emom', minutes: 6, odd: { ex: 'row_erg', label: '12 cal row' }, even: { ex: 'inverted_row', label: '8 inverted rows' } }),
    ] },
    legs: { title: 'Legs', dur: '60–70 min', ramp: 'legs', core: 'B', hero: 'trapbar', items: [
      I('A', 'trapbar', 3, '6', 150, { scheme: 'top', topReps: '3–5', topRIR: '1', backPct: 12, note: 'Top set 1 × 3–5 @ RIR 1, then 2 × 6 at −12%' }),
      I('B', 'hack_squat', 3, '8–10', 90, { tech: 'Rest-pause last set' }),
      I('C', 'walking_lunge', 3, '10', 90, { side: true }),
      I('D1', 'leg_ext', 2, '15', 0), I('D2', 'seated_leg_curl', 2, '12', 0), I('D3', 'hip_thrust', 2, '12', 45),
      I('E1', 'calf_raise', 3, '10–12', 0, { tech: 'Double drop last set' }), I('E2', 'copenhagen_long', 2, '', 45, { time: 25, timeLabel: '20–30 s', side: true }),
      I('F', 'reverse_hyper', 3, '12–15', 60, { note: 'Only if morning back pain is 0–2; otherwise the app swaps to a glute bridge' }),
      I('G', 'nordic', 2, '4–6', 90, { note: '5-s lowering, catch with your hands' }),
      I('H', 'air_bike', 1, '', 0, { kind: 'interval', rounds: 6, work: 15, restI: 45, optional: true, label: '6 × (15 s all-out / 45 s easy)' }),
    ] },
    push: { title: 'Push', dur: '60–70 min', ramp: 'push', core: 'C', hero: 'bench', items: [
      I('A', 'bench', 3, '8', 120, { scheme: 'top', topReps: '4–6', topRIR: '1', backPct: 10, note: 'Top set 1 × 4–6 @ RIR 1, then 2 × 8 at −10%' }),
      I('B', 'seated_db_press', 3, '8–10', 90, { note: 'If the neck has been quiet 3+ weeks; otherwise landmine press' }),
      I('C', 'incline_db', 3, '10', 90, { tech: '2 straight sets, then 1 myo-rep set', fromWeek: { 11: 'incline_cable_press' } }),
      I('D1', 'cable_fly', 2, '15', 0), I('D2', 'cable_lateral', 2, '12–15', 0, { fromWeek: { 11: 'leanaway_lateral' } }), I('D3', 'pushup_plus', 2, '12', 45),
      I('E1', 'rope_pushdown', 2, '12–15', 0, { tech: 'Drop set last set' }), I('E2', 'xbody_tri', 2, '12–15', 45),
      I('F', 'pushup_ladder', 1, '', 0, { kind: 'ladder', minutes: 5, label: '1 → 10 → 1, 5-min cap' }),
    ] },
  };

  /* Minimum Viable Week, taper and pump sessions */
  const MIN = {
    minA: { title: 'Minimum session A', dur: '30 min', ramp: null, core: null, hero: 'goblet_squat', type: 'lift', items: [
      I('A', 'goblet_squat', 3, '10', 60), I('B', 'cs_db_row', 3, '10', 60), I('C', 'db_bench', 3, '10', 60),
      I('D', 'db_rdl', 3, '10', 60), I('E', 'face_pull', 2, '15', 45), I('F', 'copenhagen_short', 2, '', 45, { time: 20, side: true }),
    ] },
    minB: { title: 'Minimum session B', dur: '30 min', ramp: null, core: null, hero: 'trapbar', type: 'lift', items: [
      I('A', 'trapbar', 3, '8', 75, { note: 'Or split squat' }), I('B', 'ng_pulldown', 3, '8', 60, { note: 'Pull-up or pulldown' }),
      I('C', 'landmine_press', 3, '8', 60, { side: true }), I('D', 'hip_thrust', 3, '12', 60),
      I('E', 'farmer', 3, '', 60, { dist: '30 m' }), I('F', 'dead_bug', 2, '8', 45, { side: true }),
    ] },
    taperFull: { title: 'Full-body pump', dur: '45 min', ramp: 'pull', core: 'A', hero: 'ng_pullup', type: 'lift', items: [
      I('A', 'ng_pullup', 2, '12–15', 45), I('B', 'bench', 2, '12–15', 45), I('C', 'cs_db_row', 2, '12–15', 45),
      I('D', 'landmine_press', 2, '12–15', 45, { side: true }), I('E', 'goblet_squat', 2, '12–15', 45), I('F', 'db_rdl', 2, '12–15', 45),
      I('G', 'ez_curl', 2, '12–15', 45), I('H', 'rope_pushdown', 2, '12–15', 45),
    ] },
    taperUpper: { title: 'Upper-body pump', dur: '35 min', ramp: 'push', core: null, hero: 'incline_db', type: 'lift', items: [
      I('A1', 'incline_db', 3, '12–15', 0), I('A2', 'cable_row_1arm', 3, '12–15', 45, { side: true }),
      I('B1', 'cable_fly', 3, '15', 0), I('B2', 'face_pull', 3, '15', 45),
      I('C1', 'cable_lateral', 3, '15', 0), I('C2', 'rear_delt_fly', 3, '15', 30),
      I('D1', 'ez_curl', 3, '15', 0), I('D2', 'rope_pushdown', 3, '15', 30),
    ] },
  };

  MIN.regen = { title: 'Regeneration + Pump', dur: '20 min', ramp: null, core: null, hero: 'face_pull', type: 'lift', regen: true, items: [
    I('A1', 'face_pull', 2, '15–20', 0, { note: 'RIR 1–2, cables only, no neck loading' }), I('A2', 'cable_lateral', 2, '15–20', 45),
    I('B1', 'rear_delt_fly', 2, '15–20', 0), I('B2', 'ez_curl', 2, '15–20', 0), I('B3', 'rope_pushdown', 2, '15–20', 45),
    I('C1', 'monster_walk', 2, '12', 0, { side: true }), I('C2', 'side_plank_leg', 2, '', 45, { time: 20, side: true }),
  ] };

  /* Peak pump finisher (Weeks 11–12, after Pull and Push) */
  const PUMP = {
    pull: [I('P1', 'ez_curl', 4, '15', 0), I('P2', 'rear_delt_fly', 4, '15', 30)],
    push: [I('P1', 'rope_pushdown', 4, '15', 0), I('P2', 'cable_lateral', 4, '15', 30)],
  };

  /* ---------------------------------------------------------- Rugby Day + cardio */
  const RUGBY = {
    1: { title: 'Rugby Day', sub: 'Engine rebuild', dur: '45–50 min', hero: 'sled_push',
      warmup: 'Easy bike 4 min, leg swings, A-march, skips, lateral shuffles, band pull-aparts 2 × 15 (8 min).',
      blocks: [
        { name: 'Intervals', kind: 'interval', ex: 'air_bike', rounds: 10, work: 20, restI: 40, label: 'Air bike 10 × (20 s hard at RPE 8 / 40 s easy)' },
        { name: 'Circuit × 3', kind: 'circuit', rounds: 3, rest: 90, items: [
          { ex: 'sled_push', label: '20 m, moderate' }, { ex: 'goblet_carry', label: '30 m' }, { ex: 'pushup', label: '× 10' },
          { ex: 'band_pull_apart', label: '× 15' }, { ex: 'dead_bug', label: '× 8 per side' }] },
        { name: 'Strides', kind: 'sprints', ex: 'strides', reps: 4, dist: '60 m', pct: '70%', rest: 60, weeks: [2], label: '4 × 60 m at 70%, walk back' },
      ], cooldown: '5 min walk.' },
    2: { title: 'Rugby Day', sub: 'Speed, power, engine', dur: '45–50 min', hero: 'sled_push',
      warmup: 'Jog, A-skips, B-skips, leg swings, lateral shuffles, 2 build-up runs, band pull-aparts 2 × 15 (10 min).',
      blocks: [
        { name: 'Speed', kind: 'sprints', ex: 'sprint', byWeek: { 3: [6, '60 m', '85%', 90], 4: [6, '60 m', '90%', 90], 5: [6, '40 m', '95%', 120], 6: [4, '40 m', '90%', 90] }, label: 'Walk back (2 min at 95%)' },
        { name: 'Power (contrast)', kind: 'circuit', rounds: 3, rest: 60, items: [{ ex: 'mb_chest_pass', label: '× 5' }, { ex: 'box_jump', label: '× 3' }] },
        { name: 'Rugby circuit × 4', kind: 'circuit', rounds: 4, rest: 75, items: [
          { ex: 'sled_push', label: '20 m, heavy' }, { ex: 'kb_swing', label: '× 12' }, { ex: 'burpee', label: '× 6' },
          { ex: 'bear_crawl', label: '15 m' }, { ex: 'suitcase_carry', label: '20 m per side' }] },
        { name: 'Core', kind: 'sets', items: [{ ex: 'pallof', label: '2 × 10 per side', sets: 2 }] },
      ], cooldown: '5 min walk.' },
    3: { title: 'Rugby Day', sub: 'Full send', dur: '50 min', hero: 'sled_push',
      warmup: 'Jog, A-skips, B-skips, leg swings, lateral shuffles, 2 build-up runs, band pull-aparts 2 × 15 (10 min).',
      blocks: [
        { name: 'Speed', kind: 'sprints', ex: 'sprint', reps: 7, dist: '40 m', pct: '95–100%', rest: 150, label: '6–8 × 40 m, 2–3 min rest' },
        { name: 'Power', kind: 'circuit', rounds: 4, rest: 90, items: [{ ex: 'trapbar_jump', label: '× 3' }, { ex: 'landmine_rot', label: '× 6 per side (3 rounds, gated)' }] },
        { name: 'The Gauntlet', kind: 'amrap', minutes: 15, items: [
          { ex: 'sled_push', label: '20 m' }, { ex: 'kb_swing', label: '× 15' }, { ex: 'burpee', label: '× 8' },
          { ex: 'suitcase_carry', label: '20 m per side' }, { ex: 'hanging_knee_raise', label: '× 8, pelvis first, no swing' }], label: '15-min AMRAP. Log your rounds.', benchmark: 'gauntlet' },
      ], cooldown: '5 min walk.' },
  };

  const TURKEY = { title: 'Turkey Burner', sub: 'Thanksgiving morning', dur: '35 min', hero: 'kb_swing',
    warmup: 'Warm-up 5 min.',
    blocks: [{ name: '20-min AMRAP at RPE 7', kind: 'amrap', minutes: 20, items: [
      { ex: 'kb_swing', label: '× 10' }, { ex: 'pushup', label: '× 10' }, { ex: 'goblet_squat', label: '× 10' }, { ex: 'run', label: '200 m (or 12 cal bike)' }] }],
    cooldown: 'Walk 10–15 min after the big meal.' };

  /* Saturday run or swim by week */
  const SAT = {
    1: { title: 'Zone 2 run or swim', min: 28, text: '25–30 min Zone 2: full sentences, nose breathing, ~120–140 bpm. Or swim 25–30 min easy (backstroke, pull buoy or centre snorkel).' },
    2: { title: 'Zone 2 run + strides', min: 30, text: '25–30 min Zone 2, then 4 × 80 m strides at 70%. Or swim 25–30 min easy.', strides: [4, '80 m', '70%'] },
    3: { title: 'Zone 2 run + strides', min: 35, text: 'Zone 2 run 35 min + 4 strides.', strides: [4, '80 m', '75%'] },
    4: { title: 'Tempo run', min: 33, text: '10 min easy, 3 × 6 min at RPE 7 with 2 min jog, 5 min easy.', intervals: { warm: 600, rounds: 3, work: 360, rest: 120, cool: 300, workLabel: 'Tempo, RPE 7', restLabel: 'Jog' } },
    5: { title: 'Zone 2 run', min: 40, text: 'Zone 2 run 40 min.' },
    6: { title: 'Easy run or swim + retest', min: 30, text: 'Easy 30 min run or swim, then the benchmark retest.', retest: true },
    7: { title: 'Zone 2 run', min: 43, text: 'Zone 2 run 40–45 min.' },
    8: { title: 'Intervals', min: 30, text: '5 × 3 min at RPE 8 with 2 min jog (warm up and cool down 5 min each).', intervals: { warm: 300, rounds: 5, work: 180, rest: 120, cool: 300, workLabel: 'Hard, RPE 8', restLabel: 'Jog' } },
    9: { title: 'Zone 2 run or swim', min: 45, text: 'Zone 2 run 45 min, or swim 40 min with 8 × 100 m moderate.' },
    10: { title: 'Optional easy run', min: 30, text: 'Optional easy 30 min (Holiday Express week).', optional: true },
    11: { title: 'Zone 2 run', min: 40, text: 'Zone 2 run 40 min. Steps 11,000–12,000 a day this week.' },
    12: { title: '1-mile test + easy', min: 25, text: 'Final retest: 1-mile run, flat, all-out. Then 10 min easy.', test: 'mile' },
  };

  /* ------------------------------------------------------------- core finishers */
  const CORE = {
    1: { A: ['reverse_crunch', 'side_plank_sw', 'plank_ppt', 'mcgill_curlup', 'hollow_tuck'],
         B: ['heel_taps', 'pallof_sw', 'bear_taps', 'mcgill_curlup', 'vacuum'],
         C: ['dead_bug', 'side_plank_sw', 'ball_rollout', 'mcgill_curlup', 'hollow_tuck'] },
    2: { A: ['hanging_knee_raise', 'cable_chop', 'ab_wheel', 'rope_crunch', 'hollow_ext'],
         B: ['rc_hip_lift', 'suitcase_march', 'long_plank', 'plate_crunch', 'vacuum'],
         C: ['deadbug_pullover', 'thread_needle', 'bear_taps', 'rope_crunch', 'tuck_vsit'] },
    3: { A: ['hlr_straight', 'landmine_rainbow', 'ab_wheel', 'weighted_rope_crunch', 'hollow_rock'],
         B: ['dragon_flag', 'cable_lift', 'stir_pot', 'vup', 'weighted_suitcase'],
         C: ['hang_oblique', 'russian_twist', 'long_plank', 'plate_crunch', 'vacuum'] },
  };
  const CORE_NAMES = { A: 'Core A · Six Pack Progression', B: 'Core B · Six Pack Progression', C: 'Core C · Six Pack Progression' };
  /* week → [work, rest, rounds, toFailure] */
  const CORE_FMT = { 1: [30, 15, 1], 2: [30, 15, 2], 3: [40, 20, 2], 4: [40, 20, 2], 5: [40, 20, 2], 6: [40, 20, 1], 7: [45, 15, 2], 8: [45, 15, 2], 9: [45, 15, 2], 10: [45, 15, 1], 11: [50, 10, 2, true], 12: [50, 10, 2, true], 13: [40, 20, 1] };

  /* ------------------------------------------------------------------ routines */
  const R = (ex, dose, more) => Object.assign({ ex, dose }, more || {});
  const ROUTINES = {
    armor: { title: 'Daily Armor', sub: 'Neck, back and groin insurance', min: 12, hero: 'doorway_pec', steps: [
      R('breath_9090', '5 breaths · 5 s in, 7 s out', { breaths: 5, inS: 5, outS: 7 }),
      R('chin_tuck', '10 × 5 s', { holds: 10, hold: 5 }),
      R('doorway_pec', '2 × 30 s per side', { time: 30, sets: 2, side: true }),
      R('wall_slide', '10 reps', { reps: 10 }),
      R('band_face_pull', '2 × 15', { reps: 15, sets: 2 }),
      R('open_book', '6 per side', { reps: 6, side: true }),
      R('nerve_slider', '10 slow reps per side, only if symptom-free', { reps: 10, side: true, optional: true }),
      R('mcgill_curlup', 'Curl-up 5 × 8 s', { holds: 5, hold: 8, big3: true }),
      R('side_plank', 'Side plank 3 × 15 s per side', { time: 15, sets: 3, side: true, big3: true }),
      R('bird_dog', 'Bird dog 5 per side, 8 s holds', { holds: 5, hold: 8, side: true, big3: true }),
    ] },
    armorWed: { title: 'Wednesday add-on', sub: 'Hips and groin, 5 min', min: 5, hero: 'hip_flexor', steps: [
      R('hip_switch', '8 per side', { reps: 8 }), R('rockback', '10 reps per side', { reps: 10, side: true }), R('hip_flexor', '2 × 30 s per side', { time: 30, sets: 2, side: true }),
    ] },
    deepcore: { title: 'Deep Core', sub: 'Inner abs, every morning', min: 4, hero: 'vacuum', steps: [
      R('croc_breath', '5 breaths', { breaths: 5, inS: 4, outS: 6 }),
      R('draw_in', '5 × 10 s', { holds: 5, hold: 10 }),
      R('vacuum', 'vacuum', { holds: 3, hold: 20, vacuum: true }),
      R('pelvic_lift', '10 × 5 s', { holds: 10, hold: 5 }),
      R('hollow_body', '3 × 15–30 s', { time: 20, sets: 3 }),
    ] },
    ramp_pull: { title: 'Rehab Ramp', sub: 'Before every lift · Pull add-on', min: 8, hero: 'band_face_pull', steps: [] },
    ramp_push: { title: 'Rehab Ramp', sub: 'Before every lift · Push add-on', min: 8, hero: 'band_face_pull', steps: [] },
    ramp_legs: { title: 'Rehab Ramp', sub: 'Before every lift · Leg add-on', min: 8, hero: 'band_face_pull', steps: [] },
    desk: { title: 'Desk reset', sub: 'Every 60 min · 2 min', min: 2, hero: 'doorway_pec', steps: [
      R('chin_tuck', '5 chin tucks', { reps: 5 }), R('shoulder_down', '10 × down and back', { reps: 10 }),
      R('doorway_pec', '30 s doorway stretch', { time: 30 }), R('stand_up', 'Stand up and move', { reps: 1 }),
    ] },
  };
  const RAMP_BASE = [
    R('breath_9090', '5 breaths', { breaths: 5, inS: 5, outS: 7 }),
    R('chin_tuck_dnf', '2 × 8 × 5 s', { holds: 16, hold: 5 }),
    R('band_face_pull', '2 × 15', { reps: 15, sets: 2 }),
    R('wall_slide', '1 × 10', { reps: 10 }),
    R('cat_cow', '6 per side', { reps: 6 }),
    R('bridge_squeeze', '1 × 12', { reps: 12 }),
  ];
  ROUTINES.ramp_pull.steps = RAMP_BASE.concat([R('scap_pullup', 'Scap pull-ups × 8', { reps: 8 })]);
  ROUTINES.ramp_push.steps = RAMP_BASE.concat([R('band_er', '2 × 15 per side', { reps: 15, sets: 2, side: true }), R('pushup_plus', 'Push-up plus × 10', { reps: 10 })]);
  ROUTINES.ramp_legs.steps = RAMP_BASE.concat([R('hip_airplane', 'Hip airplanes 5 per side', { reps: 5, side: true }), R('copenhagen_short', 'Copenhagen short lever 2 × 10 s', { time: 10, sets: 2, side: true }), R('monster_walk', '2 × 12 steps per side', { reps: 12, sets: 2, side: true })]);

  /* ---------------------------------------------------------------- calendar */
  const PHASES = [
    { n: 1, name: 'Reload', weeks: [1, 2], color: 'var(--train)', focus: 'RIR 3 → 2, ~65% volume, baseline tests' },
    { n: 2, name: 'Build & Burn', weeks: [3, 4, 5, 6], color: 'var(--train)', focus: 'Top sets, rest-pause, real sprints' },
    { n: 3, name: 'Shred', weeks: [7, 8, 9, 10], color: 'var(--train)', focus: 'Clusters, myo-reps, tri-sets, density' },
    { n: 4, name: 'Peak', weeks: [11, 12], color: 'var(--train)', focus: 'Peak modifiers, final retest' },
    { n: 5, name: 'Taper', weeks: [13], color: 'var(--train)', focus: 'Pump sessions, walks, travel prep' },
  ];
  const WEEKS = {
    1: { focus: 'RIR 3, ~65% volume, baseline tests', rir: '3' },
    2: { focus: 'RIR 2, strides return', rir: '2', event: 'Halloween Sat' },
    3: { focus: 'Top sets, sprints @ 85%, isolation to failure', rir: '1–2' },
    4: { focus: 'Sprints @ 90%', rir: '1–2' },
    5: { focus: 'Overhead-press gate check, sprints @ 95%', rir: '1–2' },
    6: { focus: 'Pivot deload: ~60% of sets, same loads, retest Sat', rir: '3', event: 'Thanksgiving Thu Nov 26', label: 'Pivot' },
    7: { focus: 'New exercises, clusters, myo-reps, 3-s lowering', rir: '1' },
    8: { focus: 'Density up', rir: '1', event: 'Holiday parties start' },
    9: { focus: 'Hardest week of the block', rir: '1' },
    10: { focus: 'Holiday Express: ⅔ of sets, same intensity, ~40 min', rir: '1', event: 'Christmas Fri Dec 25', label: 'Holiday Express' },
    11: { focus: 'Peak modifiers, accessory swaps', rir: '1', event: "New Year's Eve Thu Dec 31" },
    12: { focus: 'Final retest Jan 4–9', rir: '1' },
    13: { focus: 'Pump sessions, walks, travel prep', rir: '2', event: 'Fly Fri Jan 15', label: 'Taper' },
  };

  /* ---------------------------------------------------------------- nutrition
     Macro values are estimates for typical portions.                           */
  const F = (id, n, kcal, p, c, f, more) => Object.assign({ id, n, kcal, p, c, f }, more || {});
  const FOODS = [
    F('bfast', 'Plan breakfast', 445, 63, 11, 13, { slot: 'breakfast', d: '2 eggs + 1 cup egg whites + 1 cup low-fat cottage cheese', tone: 'eggs' }),
    F('bfast_fruit', 'Plan breakfast + fruit', 550, 64, 38, 13, { slot: 'breakfast', d: 'Lifting days: add a banana or berries', tone: 'eggs' }),
    F('bfast_sour', 'Plan breakfast + sourdough', 565, 67, 34, 14, { slot: 'breakfast', d: 'Lifting days: add a slice of sourdough', tone: 'eggs' }),
    F('pre_banana', 'Coffee + banana', 110, 1, 27, 0, { slot: 'pre', d: '30–45 min before training', tone: 'banana' }),
    F('pre_ricecake', 'Coffee + 2 rice cakes with honey', 140, 2, 31, 1, { slot: 'pre', d: '30–45 min before training', tone: 'banana' }),
    F('shake', 'Whey shake, 1.5 scoops', 180, 36, 4, 2, { slot: 'post', d: 'Post-workout. Creatine 5 g in it every day', tone: 'shake' }),
    F('lunch_sl', 'Sri Lankan lunch plate', 790, 60, 92, 19, { slot: 'lunch', d: '6–8 oz chicken curry (light coconut milk, 1 tsp oil), 1–1.5 cups rice, dhal, vegetable curry or mallung', tone: 'curry' }),
    F('lunch_chicken_sand', 'Chicken sandwich', 425, 59, 32, 10, { slot: 'lunch', d: 'High-protein bread, 5–6 oz chicken, mustard or light mayo', tone: 'sandwich' }),
    F('lunch_tuna_sand', 'Tuna sandwich', 415, 58, 32, 8, { slot: 'lunch', d: 'High-protein bread, 5–6 oz tuna, mustard or light mayo', tone: 'sandwich' }),
    F('dinner_chicken', 'Chicken, rice + vegetables', 535, 53, 57, 10, { slot: 'dinner', d: '6 oz chicken, 1 cup rice, vegetables with 1 tsp oil', tone: 'plate' }),
    F('dinner_beef', '93/7 beef, rice + vegetables', 585, 47, 57, 18, { slot: 'dinner', d: '6 oz 93/7 ground beef (saves ~170 kcal vs 80/20), rice, vegetables', tone: 'plate' }),
    F('dinner_rest', 'Rest-day dinner (½ rice, 2× veg)', 470, 53, 38, 11, { slot: 'dinner', d: 'Rest days: halve the rice, double the vegetables', tone: 'plate' }),
    F('snack_corepower', 'Fairlife Core Power 42 g', 230, 42, 8, 4, { slot: 'snack', d: 'Lactose-free, zero prep', tone: 'shake' }),
    F('snack_cottage', 'Cottage cheese bowl', 250, 28, 25, 3, { slot: 'snack', d: '1 cup low-fat cottage cheese + berries + cinnamon + 1 tsp honey', tone: 'bowl' }),
    F('snack_icecream', 'Protein ice cream (Ninja Creami)', 200, 34, 9, 4, { slot: 'snack', d: 'A Fairlife shake frozen 24 h, spun', tone: 'bowl' }),
    F('snack_casein', 'Casein pudding + PB2', 200, 30, 10, 3, { slot: 'snack', d: '1 scoop casein + a splash of milk, PB2 on top. Test tolerance first', tone: 'bowl' }),
    F('snack_omelette', 'Egg-white omelette + salsa', 150, 26, 6, 1, { slot: 'snack', d: '1 cup whites + vegetables + salsa', tone: 'eggs' }),
    F('snack_jerky', 'Beef jerky 2 oz + an apple', 270, 20, 37, 2, { slot: 'snack', d: 'On the go', tone: 'banana' }),
    F('free_meal', 'Free meal', 1350, 45, 140, 60, { slot: 'lunch', d: 'Anchor with 40+ g protein, one sitting, no grazing after', tone: 'free', free: true }),
    F('holiday_plate', 'Holiday plate', 1100, 55, 110, 45, { slot: 'dinner', d: 'Protein first: a third of the plate is turkey or meat', tone: 'free' }),
  ];
  const DRINKS = [
    { id: 'scotch', n: 'Scotch, 1.5 oz', kcal: 100 }, { id: 'lager', n: 'Light lager, 12 oz', kcal: 100 },
    { id: 'red', n: 'Dry red, 5 oz', kcal: 125 }, { id: 'ipa', n: 'Lager or IPA, 12 oz', kcal: 215 },
  ];
  const DRINK_BUDGET = { normal: 6, holiday: 10, holidayWeeks: [6, 8, 9, 10, 11], night: 4 };
  const FREE_MEALS = { normal: 2, peak: 1, peakWeeks: [11, 12] };
  const PROTEIN = { early: [200, 220], late: [220, 230], lateFrom: 7 };
  const SUPPS = [
    { id: 'creatine', n: 'Creatine 5 g', d: 'Every day, rest days included' },
    { id: 'vitd', n: 'Vitamin D3 1,000–2,000 IU', d: 'November to January', months: [11, 12, 1] },
    { id: 'fishoil', n: 'Fish oil 1–2 g EPA+DHA', d: 'Optional', optional: true },
    { id: 'mag', n: 'Magnesium glycinate 200–400 mg', d: 'Evening, if sleep is poor', optional: true },
  ];
  const SLOTS = [
    { id: 'pre', n: 'Pre-workout' }, { id: 'breakfast', n: 'Breakfast' }, { id: 'post', n: 'Post-workout' },
    { id: 'lunch', n: 'Lunch' }, { id: 'dinner', n: 'Dinner' }, { id: 'snack', n: 'Evening snack' },
  ];
  const GUIDES = [
    { id: 'jeff', t: "Jeff's rules", tone: 'plate', body: [
      'Nutrition is the base of the Six Pack Pyramid: you cannot out-train a bad diet.',
      'Moderate deficit: lose 0.5–1% of body weight a week, no more.',
      'Track liquid calories, sauces and oils. They add up fast.',
      'Machine calorie counts run 13–40% high, so never eat back cardio calories.',
      'No fat burners, no detox teas.',
      'Protein: 200–220 g a day through Week 6, 220–230 g from Week 7 (about 1.1 g per lb).',
      'Plate: 40% protein, 40% fibrous carbs, 20% starchy carbs.'] },
    { id: 'plate', t: 'The Sri Lankan plate', tone: 'curry', body: [
      "Jeff's 40/40/20 (protein / fibrous carbs / starchy carbs) on this plate: chicken is the 40, mallung and vegetables the other 40, rice and dhal the 20.",
      'Half the plate vegetables or mallung, a quarter or more chicken (6–8 oz), a quarter rice and dhal.',
      'The hidden calories are coconut milk and tempering oil. Use light coconut milk or half milk, and measure the oil: 1 tsp per serving.',
      '1–1.5 cups of cooked rice. Dhal counts as carbs more than protein.'] },
    { id: 'holiday', t: 'Holiday playbook', tone: 'free', body: [
      'Train the morning of every big day (Thanksgiving, Christmas Eve, New Year’s Eve).',
      'Protein first: a third of the first plate is turkey or meat.',
      'One plate of everything you love, then seconds of protein and vegetables only.',
      'Dessert: yes, one, eaten slowly.',
      'Walk 10–15 min after the big meal.',
      'Big days run at about maintenance (~3,100), not unlimited. The next day is normal: no fasting, no punishment cardio.',
      'Parties: eat a protein snack before you go; hold a soda water between drinks.'] },
    { id: 'drinks', t: 'Drinks on weekends', tone: 'drink', body: [
      'Best picks are ~100 kcal: 1.5 oz scotch, 12 oz light lager. Dry red ~125. Fuller lagers and IPAs 180–250.',
      'Weekly budget: 6 drinks in a normal week, up to 10 in holiday weeks (Weeks 6 and 8–11). Jeff\'s lean-down number is 3–4 a week.',
      'Cap 3–4 drinks a night and alternate each one with water.',
      'Protein-forward meals on drinking days, lighter on carbs and fat.',
      'Last drink about 3 h before bed.',
      "No drinks on Thursday night (Friday is Rugby Day), except New Year's Eve."] },
    { id: 'free', t: 'Free meals', tone: 'free', body: [
      'Two a week at lunch through Week 10; one a week in Weeks 11–12 (Peak). Big holiday days don\'t count.', 'Anchor with 40+ g of protein, then eat what you want.',
      'Budget about 1,200–1,500 kcal, one sitting, no grazing after.', 'The next meal is normal. No skipping meals to make up for it.'] },
    { id: 'calib', t: 'Calibration rule', tone: 'plate', body: [
      'Every Sunday, compare 7-day average weight with last week.',
      'Losing 0.8–1.4 lb a week: change nothing.',
      'Under 0.7 lb a week for 2 weeks: cut 150 kcal a day (from carbs or fat, never protein) or add 2,000 steps a day.',
      'Over 1.8 lb a week for 2 weeks: add 150 kcal a day of carbs.',
      'Ignore Week 1 and the weeks after Thanksgiving and Christmas: that is water.'] },
    { id: 'supps', t: 'Supplements', tone: 'shake', body: [
      'Creatine 5 g daily. Whey as you have it.', 'Vitamin D3 1,000–2,000 IU November–January.',
      'Optional: fish oil 1–2 g EPA+DHA; magnesium glycinate 200–400 mg in the evening if sleep is poor.',
      'Caffeine 150–200 mg before training (Jeff: 100–200), none after 2 pm.'] },
    { id: 'taper', t: 'Taper food, Jan 12–14', tone: 'curry', body: [
      'Add about 150 g of carbs a day (rice, fruit), bringing you near maintenance.',
      'Keep salt and water normal. No water cutting before a ~20-hour journey.'] },
  ];

  /* ---------------------------------------------------------------- mind */
  const MIND = {
    sigh5: { cat: 'breath', n: 'Cyclic sighing', sub: 'Morning breath', min: 5, art: 'dawn', breath: true, why: '5 min a day for 28 days lifted mood more than mindfulness meditation in a 108-adult trial (Balban et al., 2023).' },
    physio: { cat: 'breath', n: 'Physiological sigh', sub: 'Before a big call', min: 1, art: 'spark', breath: true, why: 'Double inhale, long exhale. 2–3 breaths drop arousal fast and unload the neck muscles.' },
    box4: { cat: 'breath', n: 'Box breathing', sub: 'Wired and can’t focus', min: 4, art: 'grid', breath: true, why: '4 s in, 4 hold, 4 out, 4 hold.' },
    ninety: { cat: 'breath', n: '90/90 breathing', sub: 'Ribs down, neck off', min: 2, art: 'tide', breath: true, why: 'Five breaths that start your Armor routine.' },
    breath10: { cat: 'med', n: 'Breath focus', sub: 'Guided · Weeks 1–2', min: 10, art: 'tide' },
    scan12: { cat: 'med', n: 'Body scan', sub: 'Neck and back, without fixing · Weeks 3–4', min: 12, art: 'dusk' },
    scan15: { cat: 'med', n: 'Body scan', sub: 'Longer · Weeks 5–8', min: 15, art: 'dusk' },
    open15: { cat: 'med', n: 'Open awareness', sub: 'Sky and weather · Weeks 5–8', min: 15, art: 'sky' },
    open20: { cat: 'med', n: 'Open awareness', sub: 'Lightly guided · Weeks 9–13', min: 20, art: 'sky' },
    metta15: { cat: 'med', n: 'Loving-kindness', sub: 'Sundays · Weeks 5–8', min: 15, art: 'warm' },
    sit30: { cat: 'med', n: 'Sunday long sit', sub: 'Bells at 10 and 20 min', min: 30, art: 'night' },
    nsdr10: { cat: 'sleep', n: 'NSDR', sub: 'Non-sleep deep rest', min: 10, art: 'ocean' },
    nsdr20: { cat: 'sleep', n: 'NSDR, extended', sub: 'Stress 6+ or sleep is off', min: 20, art: 'ocean' },
    ground: { cat: 'tool', n: '5-4-3-2-1 grounding', sub: 'Anxiety spike or racing thoughts', min: 2, art: 'spark' },
    stop: { cat: 'tool', n: 'STOP check', sub: 'Hourly desk reset', min: 1, art: 'grid' },
  };
  const MIND_CATS = [
    { id: 'breath', n: 'Breathwork' }, { id: 'med', n: 'Meditations' }, { id: 'sleep', n: 'Sleep & recovery' }, { id: 'tool', n: 'Quick tools' },
  ];
  const MIND_TIPS = [
    'Eat the first three bites of each meal slowly, with full attention.',
    'Keep one walk a week phone-free and practise open awareness on it.',
    'On the first working set of each lift, put all your attention in the target muscle.',
    'Before bed, write down 3 good things from the day (2 min).',
    'In the Sunday Reset, journal for 10 minutes: what is weighing on you, and what is in your control.',
  ];
  const RESEARCH = [
    { f: '5 min a day of cyclic sighing for 28 days lifted mood more than mindfulness meditation and lowered breathing rate more.', s: 'Balban et al., 2023, Cell Reports Medicine', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947', m: 'Five minutes is enough to move your mood.' },
    { f: '13 min a day of guided meditation cut anxiety and improved attention and memory at 8 weeks, not yet at 4.', s: 'Basso et al., 2019, Behavioural Brain Research', u: 'https://www.psypost.org/daily-meditation-decreases-anxiety-and-improves-cognitive-functioning-in-new-meditators-after-8-weeks/', m: "Don't judge it before week 8." },
    { f: 'Across 47 trials (3,515 people): meditation reduces anxiety (0.38), depression (0.30) and pain (0.33).', s: 'Goyal et al., 2014, JAMA Internal Medicine', u: 'https://www.healthday.com/healthpro-news/mental-health/review-suggests-psychological-benefits-of-meditation-683649.html', m: 'Real but moderate. Consistency drives it.' },
    { f: 'An 8-week MBSR course matched escitalopram for anxiety disorders in 276 adults.', s: 'Hoge et al., 2023, JAMA Psychiatry', u: 'https://www.aafp.org/afp/2023/0600/poems-mindfulness-stress-reduction', m: 'More practice works for heavier anxiety.' },
  ];

  /* Questionnaires (Weeks 1, 6, 12) */
  const PSS10 = { n: 'PSS-10', full: 'Perceived Stress Scale', lead: 'In the last month, how often have you…', scale: ['Never', 'Almost never', 'Sometimes', 'Fairly often', 'Very often'],
    q: ['been upset because of something that happened unexpectedly?', 'felt that you were unable to control the important things in your life?', 'felt nervous and stressed?',
      'felt confident about your ability to handle your personal problems?', 'felt that things were going your way?', 'found that you could not cope with all the things that you had to do?',
      'been able to control irritations in your life?', 'felt that you were on top of things?', 'been angered because of things that happened that were outside of your control?',
      'felt difficulties were piling up so high that you could not overcome them?'], reverse: [3, 4, 6, 7],
    band: (s) => s <= 13 ? 'Low stress' : s <= 26 ? 'Moderate stress' : 'High stress' };
  const GAD7 = { n: 'GAD-7', full: 'Generalized Anxiety Disorder 7', lead: 'Over the last 2 weeks, how often have you been bothered by…', scale: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
    q: ['Feeling nervous, anxious, or on edge', 'Not being able to stop or control worrying', 'Worrying too much about different things', 'Trouble relaxing',
      'Being so restless that it is hard to sit still', 'Becoming easily annoyed or irritable', 'Feeling afraid, as if something awful might happen'], reverse: [],
    band: (s) => s <= 4 ? 'Minimal' : s <= 9 ? 'Mild' : s <= 14 ? 'Moderate' : 'Severe' };

  /* ------------------------------------------------------------- tracking */
  const TARGET_PATH = [
    ['2026-10-18', 207.5, 207.5, 207.5], ['2026-11-01', 206, 205, 207.5], ['2026-11-15', 203.5, 202.5, 205], ['2026-11-29', 201.5, 200, 203],
    ['2026-12-13', 199, 197.5, 200.5], ['2026-12-27', 196.5, 195, 198.5], ['2027-01-10', 194, 192, 196], ['2027-01-14', 193, 192, 195],
  ];
  const BENCHMARKS = [
    { id: 'weight', n: 'Body weight', how: '7-day average', unit: 'lb', auto: 'weight' },
    { id: 'waist', n: 'Waist', how: 'At the navel, relaxed, morning', unit: 'in' },
    { id: 'pullups', n: 'Strict pull-ups', how: 'Dead hang to chin over bar', unit: 'reps', goal: '+3 reps' },
    { id: 'pushups', n: 'Push-ups', how: 'Max, strict', unit: 'reps' },
    { id: 'trapbar5', n: 'Trap-bar 5RM', how: 'From Week 3', unit: 'lb' },
    { id: 'mile', n: '1-mile run', how: 'Flat, all-out', unit: 'm:ss', goal: '−45 s' },
    { id: 'gauntlet', n: 'The Gauntlet', how: 'Rounds (from Week 7)', unit: 'rounds' },
    { id: 'neckback', n: 'Neck / back', how: 'Morning, 0–10', unit: '' },
    { id: 'sideL', n: 'Side bridge, left', how: 'Held to form failure', unit: 's', core: true, goal: 'L/R within 5%' },
    { id: 'sideR', n: 'Side bridge, right', how: 'Held to form failure', unit: 's', core: true },
    { id: 'extensor', n: 'Back extensor (Biering-Sørensen)', how: 'Torso level off the bench', unit: 's', core: true, goal: 'Longer than flexor hold' },
    { id: 'flexor', n: 'Trunk flexor', how: '60° wedge, pulled back 10 cm', unit: 's', core: true, goal: 'Flexor/extensor < 1.0' },
    { id: 'hlr', n: 'Hanging leg raise', how: 'Strict, legs to 90°+', unit: 'reps', core: true, goal: '+5 reps' },
    { id: 'abwheel', n: 'Ab wheel from knees', how: 'Full range, strict', unit: 'reps', core: true, goal: '+5 reps' },
    { id: 'vacuumMax', n: 'Stomach vacuum', how: 'Max hold, standing', unit: 's', core: true, goal: '60 s' },
  ];
  const SUNDAY_RESET = [
    '7-day average weight and waist', 'Sessions done (out of 6) and average steps', 'Protein days hit (out of 7) and average sleep',
    'Neck, back and squeeze-test scores', 'Apply the calibration rule', "Book the week's training times; cook protein for Mon–Wed",
    'Photos (every second Sunday)', 'Write down one win from the week',
  ];
  const GATES = [
    { id: 'ohp', n: 'Overhead pressing', from: 5, rule: 'Neck ≤1/10 for 7 straight days, no arm symptoms', then: 'Half-kneeling 1-arm DB press; seated DB press from Week 7 if still quiet' },
    { id: 'trapbar', n: 'Trap-bar deadlift', from: 3, rule: 'Morning back pain 0 for 7 days and DB RDL pain-free', then: 'Trap-bar top sets' },
    { id: 'pendlay', n: 'Pendlay row', from: 7, rule: 'Back pain 0 for 3 weeks', then: 'Replaces chest-supported row' },
    { id: 'rotation', n: 'Rotation work', from: 7, rule: 'Back pain 0', then: 'Landmine rotational press on Rugby Day' },
    { id: 'backgate', n: 'Core back gate', from: 7, rule: 'Morning back pain 0 for 3 weeks', then: 'V-ups, dragon flag negatives, loaded rotation' },
    { id: 'abwheel', n: 'Ab wheel', from: 3, rule: 'Back pain 0 for 7 days', then: 'Ab wheel from knees' },
  ];
  const RED_FLAGS = [
    'Arm or hand weakness, dropping things, clumsy hands', 'Numbness that spreads, persists, or shows up in both arms', 'Changes in balance or walking',
    'Back pain with leg pain below the knee, numbness in the groin or saddle area, or bladder or bowel changes', 'Night pain that never eases, or fever',
  ];
  const SWAPPED = [
    ['Barbell back squat', 'Hack squat, belt squat or safety-squat bar'], ['Heavy shrugs, upright rows, behind-the-neck', 'Removed'],
    ['Dips', 'Incline press'], ['Freestyle with head turns', 'Backstroke, pull buoy, or centre snorkel'], ['Crunches pulling on the head', 'Dead bugs, curl-ups, Pallof presses'],
  ];
  const TECHNIQUES = [
    ['Antagonist superset', 'Alternate two exercises, rest only after the pair'], ['Rest-pause', 'After the last set, rest 15 s, do 2 more mini-sets near failure'],
    ['Myo-reps', 'One set of 12–15 to RIR 1, then 4 mini-sets of 3–5 with 5 deep breaths between'], ['Cluster sets', 'Split a heavy set into mini-sets with 15 s breaks (e.g. 3+2) at ~5RM'],
    ['Mechanical drop set', 'Same weight, switch to an easier version and keep going'], ['Weight drop set', 'Strip 25–30%, rep out once'], ['EMOM / AMRAP', 'Fixed work every minute / most rounds in a time cap'],
  ];

  window.FS = { EX, P1, P2, P3, MIN, PUMP, RUGBY, TURKEY, SAT, CORE, CORE_NAMES, CORE_FMT, ROUTINES, PHASES, WEEKS,
    FOODS, DRINKS, DRINK_BUDGET, FREE_MEALS, PROTEIN, SUPPS, SLOTS, GUIDES, MIND, MIND_CATS, MIND_TIPS, RESEARCH, PSS10, GAD7,
    TARGET_PATH, BENCHMARKS, SUNDAY_RESET, GATES, RED_FLAGS, SWAPPED, TECHNIQUES,
    START: '2026-10-19', GOAL: { from: 207.5, to: [192, 195], date: '2027-01-14' } };
})();
