/* HUNTER SYSTEM — data + animated exercise figures (all offline, no external images) */
(function () {
  'use strict';

  /* ---------- pose helpers (viewBox 0 0 120 80, floor at y=72) ---------- */
  const BASE = { H: [60, 17], S: [60, 26], P: [60, 46], E: [60, 37], W: [60, 48], K: [60, 59], F: [61, 72] };
  const pose = (o) => Object.assign({}, BASE, o);
  const FBASE = {
    H: [60, 17], S: [60, 26], P: [60, 46],
    E: [67, 37], W: [67, 48], K: [64.5, 59], F: [65, 72],
    E2: [53, 37], W2: [53, 48], K2: [55.5, 59], F2: [55, 72]
  };
  const fpose = (o) => Object.assign({}, FBASE, o);

  // lying on back, head left
  const LY = { H: [23, 68], S: [33, 69], P: [66, 69], K: [77, 58], F: [85, 71] };
  // bent-over (hinge) stance
  const BO = { P: [48, 44], S: [64.4, 32.5], H: [72.4, 28.5], K: [54, 58], F: [50, 72] };

  const EX = {
    floorPress: {
      name: 'Dumbbell floor press', eq: 'DUMBBELL', hot: 'S', w: 'db', noToe: true,
      A: pose({ ...LY, E: [28, 70], W: [33, 58] }),
      B: pose({ ...LY, E: [34, 58], W: [34, 46] }),
      cues: ['Lie flat, knees bent, feet planted.', 'Lower until your upper arms lightly touch the floor.', 'Press up and slightly inward. No bouncing.']
    },
    pushUp: {
      name: 'Push-ups', eq: 'BODYWEIGHT', hot: 'S', noToe: true,
      A: pose({ H: [96, 45], S: [88, 48], P: [67, 57.5], E: [88, 59.5], W: [88, 71], K: [53, 63.8], F: [40, 71] }),
      B: pose({ H: [98, 60], S: [90, 62], P: [68.5, 65.4], E: [79, 68], W: [90, 71], K: [54, 67.8], F: [40, 71] }),
      cues: ['Straight line from head to heels.', 'Elbows about 45° from your body.', 'Lower your chest to a fist above the floor, then push away. Too hard? Drop to your knees.']
    },
    ohp: {
      name: 'Standing barbell overhead press', eq: 'BARBELL', hot: 'S', w: 'bb',
      A: pose({ E: [64, 36], W: [63, 25] }),
      B: pose({ E: [64, 14], W: [62, 3] }),
      cues: ['Squeeze glutes, ribs down.', 'Press straight up; your head moves through at the top.', 'Do not lean back.']
    },
    lateral: {
      name: 'Dumbbell lateral raises', eq: 'DUMBBELL', hot: 'S', w: 'db', both: true, view: 'front',
      A: fpose({}),
      B: fpose({ E: [77, 27], W: [88, 26], E2: [43, 27], W2: [32, 26] }),
      cues: ['Slight bend in the elbows.', 'Lead with your elbows up to shoulder height.', 'Lower slowly for 2–3 seconds.']
    },
    triExt: {
      name: 'Overhead dumbbell triceps extension', eq: 'DUMBBELL', hot: 'E', w: 'db',
      A: pose({ E: [61, 13], W: [57, 24] }),
      B: pose({ E: [61, 13], W: [61, 2] }),
      cues: ['Keep elbows pointing up, close to your head.', 'Lower the weight behind your head under control.', 'Extend fully without flaring your elbows.']
    },
    pullUp: {
      name: 'Pull-ups / band-assisted pull-ups', eq: 'BODYWEIGHT', hot: 'S', bar: [44, 82, 8], noToe: true,
      A: pose({ H: [60, 21], S: [60, 30], P: [60, 50], E: [65, 19], W: [66, 8], K: [58, 62], F: [53, 70] }),
      B: pose({ H: [58, 5], S: [60, 15], P: [60, 35], E: [64, 21], W: [66, 8], K: [59, 47], F: [53, 52] }),
      cues: ['Start from a full hang.', 'Pull your elbows down toward your ribs.', 'Chin over the bar, then lower for 2–3 seconds. Use a band if needed.']
    },
    row: {
      name: 'Barbell bent-over row', eq: 'BARBELL', hot: 'S', w: 'bb', noToe: true,
      A: pose({ ...BO, E: [64.4, 43.5], W: [64.4, 54.5] }),
      B: pose({ ...BO, E: [55, 39], W: [62, 48] }),
      cues: ['Hinge until your torso is about 45°, back flat.', 'Pull the bar to your lower ribs.', 'Pause for 1 second, lower slowly.']
    },
    dbRow: {
      name: 'One-arm dumbbell row', eq: 'DUMBBELL', hot: 'S', w: 'db', noToe: true, bench: [76, 54, 24, 18],
      A: pose({ P: [44, 46], S: [63.3, 40.8], H: [71.5, 38.5], K: [50, 59], F: [46, 72], E: [63, 52], W: [63, 63], E2: [72, 47], W2: [80, 53] }),
      B: pose({ P: [44, 46], S: [63.3, 40.8], H: [71.5, 38.5], K: [50, 59], F: [46, 72], E: [54, 45], W: [60, 54], E2: [72, 47], W2: [80, 53] }),
      cues: ['One hand and knee on the bench, back flat.', 'Pull your elbow toward your hip, not up.', 'Do not twist your torso.']
    },
    facePull: {
      name: 'Resistance-band face pulls', eq: 'BAND', hot: 'S', anchor: [112, 22],
      A: pose({ E: [71, 25], W: [82, 24] }),
      B: pose({ E: [67, 28], W: [64, 19] }),
      cues: ['Anchor the band at face height.', 'Pull toward your forehead with elbows high.', 'Squeeze your shoulder blades, return slowly.']
    },
    curl: {
      name: 'Dumbbell curls', eq: 'DUMBBELL', hot: 'E', w: 'db',
      A: pose({ E: [60, 37], W: [61, 48] }),
      B: pose({ E: [61, 37], W: [68, 28] }),
      cues: ['Pin your elbows at your sides.', 'Curl up without swinging.', 'Lower for 2–3 seconds to a full stretch.']
    },
    hammer: {
      name: 'Hammer curls', eq: 'DUMBBELL', hot: 'E', w: 'db',
      A: pose({ E: [60, 37], W: [61, 48] }),
      B: pose({ E: [61, 37], W: [68, 28] }),
      cues: ['Palms face each other the whole time.', 'Elbows stay by your sides.', 'Squeeze at the top, lower slowly.']
    },
    rdl: {
      name: 'Barbell Romanian deadlift', eq: 'BARBELL', hot: 'P', w: 'bb',
      A: pose({ E: [61, 37], W: [63, 48] }),
      B: pose({ H: [69.6, 33], S: [61.6, 36.5], P: [44, 46], E: [63, 47], W: [63, 58], K: [47, 59], F: [46, 72] }),
      cues: ['Soft knees, push your hips back.', 'The bar slides close to your legs.', 'Stop at a hamstring stretch, squeeze glutes to stand.']
    },
    goblet: {
      name: 'Goblet squat', eq: 'DUMBBELL', hot: 'K', w: 'db',
      A: pose({ E: [63, 37], W: [66, 29] }),
      B: pose({ H: [56, 29], S: [54, 38], P: [50, 57], E: [60, 45], W: [64, 38], K: [64, 58], F: [60, 72] }),
      cues: ['Hold the weight at your chest.', 'Sit down between your hips, chest tall.', 'Knees track over toes, drive through mid-foot.']
    },
    bulgarian: {
      name: 'Bulgarian split squat', eq: 'BODYWEIGHT', hot: 'K', bench: [24, 57, 14, 15], noToe: true,
      A: pose({ H: [52, 13], S: [52, 22], P: [52, 42], E: [52, 33], W: [52, 44], K: [60, 56], F: [62, 72], K2: [44, 54], F2: [32, 56] }),
      B: pose({ H: [52, 23], S: [52, 32], P: [52, 52], E: [53, 43], W: [53, 54], K: [66, 56], F: [62, 72], K2: [44, 62], F2: [32, 57] }),
      cues: ['Rear foot on the bench, front foot far enough forward.', 'Drop straight down.', 'Front heel stays down, push back up.']
    },
    calf: {
      name: 'Standing calf raises', eq: 'DUMBBELL', hot: 'F', w: 'db',
      A: pose({}),
      B: pose({ H: [60, 13], S: [60, 22], P: [60, 42], E: [60, 33], W: [60, 44], K: [60, 55], F: [61, 68] }),
      cues: ['Rise as high as you can.', 'Pause for 1 second at the top.', 'Lower slowly for a full stretch.']
    },
    legRaise: {
      name: 'Lying leg raises', eq: 'BODYWEIGHT', hot: 'P', noToe: true,
      A: pose({ ...LY, E: [46, 70], W: [58, 70], K: [80, 67], F: [94, 66] }),
      B: pose({ ...LY, E: [46, 70], W: [58, 70], K: [66, 55], F: [66, 42] }),
      cues: ['Press your lower back into the floor.', 'Raise your legs to vertical.', 'Lower slowly and stop before your back arches.']
    },
    plank: {
      name: 'Plank', eq: 'BODYWEIGHT', hot: 'P', noToe: true, period: 4200, smooth: true,
      A: pose({ H: [92, 53], S: [84, 56], P: [64.7, 61.3], E: [84, 67], W: [95, 70], K: [51.2, 65], F: [40, 71] }),
      B: pose({ H: [92, 52], S: [84, 55], P: [65, 59.5], E: [84, 67], W: [95, 70], K: [51.2, 64], F: [40, 71] }),
      cues: ['Elbows directly under shoulders.', 'Squeeze glutes and abs.', 'Breathe steadily; do not let your hips sag.']
    },
    dbPress: {
      name: 'Standing dumbbell shoulder press', eq: 'DUMBBELL', hot: 'S', w: 'db',
      A: pose({ E: [63, 37], W: [62, 27] }),
      B: pose({ E: [62, 15], W: [61, 4] }),
      cues: ['Ribs down, glutes tight.', 'Press up in a slight arc.', 'Control the way down.']
    },
    rear: {
      name: 'Bent-over rear-delt raises', eq: 'DUMBBELL', hot: 'S', w: 'db', both: true, view: 'front',
      A: fpose({ H: [60, 26], S: [60, 32], P: [60, 46], E: [67, 41], W: [67, 51], E2: [53, 41], W2: [53, 51] }),
      B: fpose({ H: [60, 26], S: [60, 32], P: [60, 46], E: [77, 33], W: [88, 32], E2: [43, 33], W2: [32, 32] }),
      cues: ['Hinge forward with a neutral neck.', 'Lift your elbows out to the sides.', 'Think "wings", not shrugging.']
    },
    altCurl: {
      name: 'Alternating dumbbell curls', eq: 'DUMBBELL', hot: 'E', w: 'db', both: true,
      A: pose({ E: [60, 37], W: [61, 48], E2: [59, 37], W2: [67, 28] }),
      B: pose({ E: [61, 37], W: [68, 28], E2: [59, 37], W2: [59, 48] }),
      cues: ['Alternate arms each rep.', 'Keep your torso still.', 'Full range, slow lowering.']
    },
    bandPush: {
      name: 'Resistance-band triceps pushdowns', eq: 'BAND', hot: 'E', anchor: [64, 2],
      A: pose({ E: [60, 37], W: [67, 29] }),
      B: pose({ E: [60, 37], W: [62, 48] }),
      cues: ['Elbows tight to your ribs.', 'Press down until your arms are straight.', 'Return slowly; do not let your elbows drift.']
    },
    closeGrip: {
      name: 'Close-grip push-ups', eq: 'BODYWEIGHT', hot: 'E', noToe: true,
      A: pose({ H: [96, 45], S: [88, 48], P: [67, 57.5], E: [88, 59.5], W: [88, 71], K: [53, 63.8], F: [40, 71] }),
      B: pose({ H: [98, 60], S: [90, 62], P: [68.5, 65.4], E: [79, 68], W: [90, 71], K: [54, 67.8], F: [40, 71] }),
      cues: ['Hands under your shoulders, close together.', 'Elbows brush your ribs.', 'Use the full range of motion.']
    },
    chinUp: {
      name: 'Pull-ups / chin-ups', eq: 'BODYWEIGHT', hot: 'E', bar: [44, 82, 8], noToe: true,
      A: pose({ H: [60, 21], S: [60, 30], P: [60, 50], E: [65, 19], W: [66, 8], K: [58, 62], F: [53, 70] }),
      B: pose({ H: [58, 5], S: [60, 15], P: [60, 35], E: [64, 21], W: [66, 8], K: [59, 47], F: [53, 52] }),
      cues: ['Palms facing you, shoulder-width grip.', 'Pull your chest toward the bar.', 'Lower under control.']
    },
    bandCurl: {
      name: 'Resistance-band curls', eq: 'BAND', hot: 'E', anchor: [62, 72],
      A: pose({ E: [60, 37], W: [61, 48] }),
      B: pose({ E: [61, 37], W: [68, 28] }),
      cues: ['Stand on the band, feet hip-width.', 'Elbows stay at your sides.', 'Squeeze at the top, lower slowly.']
    },
    bandTriExt: {
      name: 'Resistance-band triceps extensions', eq: 'BAND', hot: 'E', anchor: [58, 72],
      A: pose({ E: [61, 13], W: [56, 25] }),
      B: pose({ E: [61, 13], W: [61, 2] }),
      cues: ['Elbows point up, close to your head.', 'Lower behind your head slowly.', 'Extend fully against the band.']
    },
    /* recovery-day figures */
    walk: {
      name: 'Easy walk', hot: null, smooth: true, period: 1500,
      A: pose({ E: [56, 37], W: [53, 47], E2: [64, 36], W2: [68, 46], K: [66, 58], F: [70, 72], K2: [55, 57], F2: [49, 68] }),
      B: pose({ E: [64, 36], W: [68, 46], E2: [56, 37], W2: [53, 47], K: [54, 58], F: [47, 70], K2: [66, 57], F2: [71, 72] })
    },
    reach: {
      name: 'Mobility', hot: null, smooth: true, period: 3600,
      A: pose({ E: [60, 37], W: [60, 48], E2: [59, 37], W2: [59, 48] }),
      B: pose({ H: [59, 16], S: [60, 26], E: [64, 14], W: [62, 3], E2: [60, 14], W2: [58, 3] })
    }
  };

  /* ---------- weekly plan ---------- */
  const WORKOUTS = {
    1: { title: 'PUSH PROTOCOL', focus: 'Chest · shoulders · triceps', items: [['floorPress', 3, '8–15'], ['pushUp', 2, '8–15'], ['ohp', 3, '8–12'], ['lateral', 3, '12–20'], ['triExt', 2, '10–15']] },
    2: { title: 'PULL PROTOCOL', focus: 'Back · biceps · rear delts', items: [['pullUp', 3, '5–10'], ['row', 3, '8–15'], ['dbRow', 2, '10–15 each side'], ['facePull', 2, '15–20'], ['curl', 3, '8–15'], ['hammer', 2, '10–15']] },
    3: { title: 'LOWER BODY PROTOCOL', focus: 'Legs · glutes · core', items: [['rdl', 3, '8–12'], ['goblet', 3, '10–15'], ['bulgarian', 2, '8–12 each leg'], ['calf', 3, '12–20'], ['legRaise', 2, '10–15'], ['plank', 2, '30–60 seconds']] },
    4: { title: 'SHOULDER & ARM PROTOCOL', focus: 'Side delts · biceps · triceps', items: [['dbPress', 2, '8–12'], ['lateral', 4, '12–20'], ['rear', 3, '12–20'], ['altCurl', 3, '8–15'], ['bandPush', 3, '12–20'], ['hammer', 2, '10–15'], ['closeGrip', 2, '8–15']] },
    5: { title: 'UPPER BODY GROWTH', focus: 'Chest · back · extra arms', items: [['floorPress', 3, '8–15'], ['chinUp', 3, '5–10'], ['row', 3, '8–15'], ['pushUp', 2, '8–15'], ['lateral', 2, '15–20'], ['bandCurl', 2, '12–20'], ['bandTriExt', 2, '12–20']] }
  };

  const REST = [
    { name: 'Easy walk', meta: '10–20 minutes at a comfortable pace', fig: 'walk', cues: ['Relaxed pace — you should be able to chat.', 'Walk outside if you can; sunlight helps sleep.', 'Do not turn it into a workout.'] },
    { name: 'Mobility', meta: '5–10 minutes gentle mobility', fig: 'reach', cues: ['Move slowly through a comfortable range.', 'Breathe deeply; never force a stretch.', 'Focus on shoulders, hips and back.'] },
    { name: 'Nutrition quest', meta: 'Reach calories and protein without forcing huge meals', emoji: '🍽️', cues: ['Spread food across the day.', 'Hit protein first, then fill calories.', 'Liquid calories (milk, smoothie) are easy wins.'] },
    { name: 'Recovery', meta: 'Aim for 7–9 hours of sleep', emoji: '😴', cues: ['Same bedtime and wake time every day.', 'Screens away 30 minutes before bed.', 'Muscle is built while you sleep.'] }
  ];

  const MEALS = [
    { time: '07:30', name: 'BREAKFAST', icon: '🍳', kcal: 500, protein: 24, items: ['2 atta rotis (about 60 g flour)', '2 eggs', '1 banana', '200 ml whole milk'] },
    { time: '10:30', name: 'CALORIE SMOOTHIE', icon: '🥤', kcal: 400, protein: 15, items: ['Blend 250 ml whole milk', '1 banana', '20 g peanuts/peanut butter', '20 g oats'] },
    { time: '13:30', name: 'LUNCH', icon: '🍛', kcal: 700, protein: 40, items: ['250 g cooked rice', '100 g cooked chicken', '150 g cooked dal', '150 g vegetables', '~1 tsp oil'] },
    { time: '16:45', name: 'PRE-WORKOUT', icon: '🍞', kcal: 250, protein: 9, items: ['2 slices whole-wheat bread', '1 boiled egg', 'water', 'Train 60–90 minutes later'] },
    { time: '19:45', name: 'DINNER / POST-WORKOUT', icon: '🐟', kcal: 600, protein: 30, items: ['250 g cooked rice', '120 g cooked fish (edible portion)', '100 g dal', '100 g vegetables', '~1 tsp oil'] },
    { time: '22:00', name: 'OPTIONAL BEDTIME', icon: '🥛', kcal: 125, protein: 6, optional: true, items: ['200 ml milk if hungry or if you need help reaching your daily target'] }
  ];

  const TIPS = [
    'Consistency beats intensity. Show up, clear the quest.',
    'Weigh yourself after the toilet and before breakfast. Compare weekly averages.',
    'Progressive overload: add a rep or a little weight when a set feels easy.',
    'Sleep is when the muscle is built. Protect your 7–9 hours.',
    'Hit your protein first, then fill the calories.',
    'Slow lowering (2–3 s) builds more muscle than dropping the weight.',
    'Hydrate. Aim for 8 glasses across the day.',
    'Rest days are part of the program, not a break from it.'
  ];

  /* ---------- animated stick-figure engine ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const KEYS = ['H', 'S', 'P', 'E', 'W', 'K', 'F', 'E2', 'W2', 'K2', 'F2'];
  const FAR = { E2: 'E', W2: 'W', K2: 'K', F2: 'F' };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const pts = (...p) => p.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function jointOf(p, key) {
    if (p[key]) return p[key];
    const n = FAR[key];
    if (n) return [p[n][0] - 2.2, p[n][1] - 0.4];
    return p[key];
  }

  function svgEl(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  class Fig {
    constructor(el, id, big) {
      this.ex = EX[id];
      this.el = el;
      this.t0 = performance.now() + Math.random() * 400;
      this.visible = true;
      this.big = !!big;
      this.build();
    }
    build() {
      const ex = this.ex, front = ex.view === 'front';
      const svg = svgEl('svg', { viewBox: '0 0 120 80', class: 'fig' + (this.big ? ' big' : ''), 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
      const n = (this.n = {});
      svg.appendChild(svgEl('line', { class: 'floor', x1: 4, y1: 72.8, x2: 116, y2: 72.8 }));
      if (ex.bar) {
        const [x1, x2, y] = ex.bar;
        svg.appendChild(svgEl('line', { class: 'prop', x1, y1: y, x2, y2: y, 'stroke-width': 2.4 }));
        svg.appendChild(svgEl('line', { class: 'prop', x1, y1: y, x2: x1, y2: y - 6 }));
        svg.appendChild(svgEl('line', { class: 'prop', x1: x2, y1: y, x2, y2: y - 6 }));
      }
      if (ex.bench) {
        const [x, y, w, h] = ex.bench;
        svg.appendChild(svgEl('rect', { class: 'bench', x, y, width: w, height: h, rx: 1.5 }));
      }
      if (ex.anchor) {
        n.band = svgEl('line', { class: 'band' });
        svg.appendChild(n.band);
        svg.appendChild(svgEl('circle', { class: 'anchor', cx: ex.anchor[0], cy: ex.anchor[1], r: 2.2 }));
      }
      n.hot = svgEl('circle', { class: 'hot', r: 6 });
      n.fl = svgEl('polyline', { class: 'limb far' });
      n.fa = svgEl('polyline', { class: 'limb far' });
      n.tor = svgEl('line', { class: 'limb torso' });
      n.nl = svgEl('polyline', { class: 'limb' });
      n.na = svgEl('polyline', { class: 'limb' });
      n.neck = svgEl('line', { class: 'limb' });
      n.head = svgEl('circle', { class: 'head', r: 5 });
      svg.append(n.hot, n.fl, n.fa, n.tor, n.nl, n.na, n.neck, n.head);
      if (front) {
        n.sh = svgEl('line', { class: 'limb torso' });
        n.hp = svgEl('line', { class: 'limb torso' });
        svg.append(n.sh, n.hp);
      }
      if (ex.w) {
        const mk = () => (front ? svgEl('rect', { class: 'wt', width: 8, height: 3.4, rx: 1 }) : svgEl('circle', { class: 'wt', r: ex.w === 'bb' ? 4.6 : 3.3 }));
        n.w1 = mk();
        svg.appendChild(n.w1);
        if (ex.both) { n.w2 = mk(); svg.appendChild(n.w2); }
      }
      this.el.textContent = '';
      this.el.appendChild(svg);
      this.draw(performance.now());
    }
    draw(now) {
      const ex = this.ex, n = this.n, front = ex.view === 'front';
      const period = ex.period || 3200;
      const ph = ((now - this.t0) % period) / period;
      let k;
      if (reduceMotion) k = 0.5;
      else if (ex.smooth) k = 0.5 - 0.5 * Math.cos(ph * 2 * Math.PI);
      else k = ph < 0.12 ? 0 : ph < 0.5 ? ease((ph - 0.12) / 0.38) : ph < 0.62 ? 1 : 1 - ease((ph - 0.62) / 0.38);
      const J = {};
      for (const key of KEYS) {
        const a = jointOf(ex.A, key), b = jointOf(ex.B, key);
        J[key] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      }
      const { H, S, P, E, W, K, F, E2, W2, K2, F2 } = J;
      // head + neck
      const dx = H[0] - S[0], dy = H[1] - S[1], dl = Math.hypot(dx, dy) || 1;
      n.head.setAttribute('cx', H[0].toFixed(1)); n.head.setAttribute('cy', H[1].toFixed(1));
      const nk = [H[0] - (dx / dl) * 5, H[1] - (dy / dl) * 5];
      n.neck.setAttribute('x1', S[0].toFixed(1)); n.neck.setAttribute('y1', S[1].toFixed(1));
      n.neck.setAttribute('x2', nk[0].toFixed(1)); n.neck.setAttribute('y2', nk[1].toFixed(1));
      n.tor.setAttribute('x1', S[0].toFixed(1)); n.tor.setAttribute('y1', S[1].toFixed(1));
      n.tor.setAttribute('x2', P[0].toFixed(1)); n.tor.setAttribute('y2', P[1].toFixed(1));
      if (front) {
        const s1 = [S[0] + 6, S[1]], s2 = [S[0] - 6, S[1]], p1 = [P[0] + 3.5, P[1]], p2 = [P[0] - 3.5, P[1]];
        n.sh.setAttribute('x1', s2[0]); n.sh.setAttribute('y1', s2[1]); n.sh.setAttribute('x2', s1[0]); n.sh.setAttribute('y2', s1[1]);
        n.hp.setAttribute('x1', p2[0]); n.hp.setAttribute('y1', p2[1]); n.hp.setAttribute('x2', p1[0]); n.hp.setAttribute('y2', p1[1]);
        n.na.setAttribute('points', pts(s1, E, W));
        n.fa.setAttribute('points', pts(s2, E2, W2));
        n.nl.setAttribute('points', pts(p1, K, F));
        n.fl.setAttribute('points', pts(p2, K2, F2));
      } else {
        const toe = (f) => (ex.noToe ? f : [f[0] + 6, Math.max(f[1], Math.min(72, f[1] + 4))]);
        n.na.setAttribute('points', pts(S, E, W));
        n.fa.setAttribute('points', pts(S, E2, W2));
        n.nl.setAttribute('points', pts(P, K, F, toe(F)));
        n.fl.setAttribute('points', pts(P, K2, F2, toe(F2)));
      }
      if (ex.hot) {
        const hp = J[ex.hot];
        n.hot.setAttribute('cx', hp[0].toFixed(1)); n.hot.setAttribute('cy', hp[1].toFixed(1));
        n.hot.setAttribute('r', (6 + 1.6 * Math.sin(now / 260)).toFixed(1));
        n.hot.style.display = '';
      } else n.hot.style.display = 'none';
      if (n.w1) this.place(n.w1, W, front);
      if (n.w2) this.place(n.w2, W2, front);
      if (n.band) {
        n.band.setAttribute('x1', W[0].toFixed(1)); n.band.setAttribute('y1', W[1].toFixed(1));
        n.band.setAttribute('x2', ex.anchor[0]); n.band.setAttribute('y2', ex.anchor[1]);
      }
    }
    place(node, p, front) {
      if (front) { node.setAttribute('x', (p[0] - 4).toFixed(1)); node.setAttribute('y', (p[1] - 1.7).toFixed(1)); }
      else { node.setAttribute('cx', p[0].toFixed(1)); node.setAttribute('cy', p[1].toFixed(1)); }
    }
  }

  const figs = new Set();
  let raf = 0;
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { const f = e.target._fig; if (f) f.visible = e.isIntersecting; }), { rootMargin: '80px' })
    : null;

  function tick(now) {
    for (const f of figs) {
      if (!f.el.isConnected) { figs.delete(f); continue; }
      if (f.visible) f.draw(now);
    }
    raf = figs.size && !document.hidden ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!raf && figs.size) raf = requestAnimationFrame(tick); }
  document.addEventListener('visibilitychange', kick);

  function mountFig(el, id, big) {
    if (!EX[id]) return null;
    const f = new Fig(el, id, big);
    el._fig = f;
    figs.add(f);
    if (io) io.observe(el);
    kick();
    return f;
  }

  window.Hunter = { EX, WORKOUTS, REST, MEALS, TIPS, mountFig };
})();
