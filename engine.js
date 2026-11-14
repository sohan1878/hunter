/* HUNTER SYSTEM — exercise engine (pure logic: equipment modes, candidates, plan defaults, balance, warm-up) */
(function () {
  'use strict';
  const LIB = window.HunterLib || [];
  const F = { BAR: 1, STA: 2, BEN: 4, STR: 8, CAR: 16, MOB: 32, HH: 64 };
  const BYID = {}; LIB.forEach((x) => { BYID[x.i] = x; });

  const MODES = {
    gym: { key: 'gym', name: 'GYM', long: 'Gym', desc: 'Everything is available: barbells, cables, machines, dumbbells and bands.' },
    homegym: { key: 'homegym', name: 'HOME GYM', long: 'Home gym', desc: 'Barbell, dumbbells, resistance bands, pull-up bar and body weight.' },
    home: { key: 'home', name: 'HOME', long: 'Home', desc: 'Body weight only. A backpack or towel stands in where weight is needed.' }
  };
  const MODE_KEYS = ['gym', 'homegym', 'home'];
  const HG_EQ = new Set(['body weight', 'dumbbell', 'barbell', 'ez barbell', 'olympic barbell', 'band', 'resistance band']);

  const byId = (id) => BYID[id] || null;
  const isStrength = (x) => !(x.f & (F.STR | F.CAR | F.MOB));
  const kindOf = (x) => (x.f & F.STR ? 'stretch' : x.f & F.MOB ? 'mobility' : x.f & F.CAR ? 'cardio' : 'strength');

  // is this exercise doable in the given equipment mode?
  function avail(x, mode, opt) {
    const f = x.f;
    if (mode === 'gym') return !(x.e === 'household');
    if (f & F.HH) return true;
    if ((f & F.STA) && x.e === 'body weight') return false; // dip stations, rings, straps...
    if (mode === 'homegym') return HG_EQ.has(x.e) && (!(f & F.BEN) || !!(opt && opt.bench));
    return x.e === 'body weight' && !(f & (F.BAR | F.BEN)); // home: no bar, no bench
  }

  /* ---------- ranking: common, simple movements first ---------- */
  const COMMON = /(^|\s)(bench press|floor press|squat|deadlift|romanian deadlift|overhead press|shoulder press|military press|bent over row|row|pulldown|pull-up|chin-up|push-up|curl|lateral raise|rear lateral raise|rear delt raise|calf raise|lunge|hip thrust|glute bridge|plank|crunch|leg raise|triceps extension|pushdown|fly|face pull|split squat)(\s|$)/;
  const ODD = /one arm|one leg|single|isometric|assisted|weighted|\((male|female)\)|v\. ?\d|kneeling|lying|reverse|behind|jump|plyo|twist|alternate|on knees|guillotine|zercher|jefferson|rocking|speed|paused|bosu|ball|tennis|suspended|with support|spider|clock|archer|impossible|korean|pendlay|cambered|hammer grip|palm|decline|incline|wide|narrow|sumo|snatch|clean|jerk|hack|sissy|bear|side/;
  function score(x, mode) {
    let s = 0; const n = x.n;
    if (COMMON.test(n)) s += 5;
    if (ODD.test(n)) s -= 3;
    s -= n.length / 25;
    const e = x.e;
    if (mode === 'gym') s += ({ barbell: 3, dumbbell: 2, cable: 1.5, 'leverage machine': 1, 'smith machine': 0.5 })[e] || 0;
    else if (mode === 'homegym') s += ({ dumbbell: 3, barbell: 2, band: 1, 'resistance band': 1, 'body weight': 1 })[e] || 0;
    if (x.f & F.HH) s -= 1;
    return s;
  }
  const rank = (arr, mode) => arr.map((x) => [x, score(x, mode)]).sort((a, b) => b[1] - a[1] || a[0].n.localeCompare(b[0].n)).map((p) => p[0]);

  // o: { target, body, eq, q, kind: strength|stretch|mobility|cardio|all, mode, opt, any }
  function candidates(o) {
    const q = (o.q || '').trim().toLowerCase().split(/\s+/).filter(Boolean), kind = o.kind || 'strength';
    return rank(LIB.filter((x) =>
      (kind === 'all' || kindOf(x) === kind) && (!o.target || x.t === o.target) && (!o.body || x.b === o.body) && (!o.eq || x.e === o.eq) &&
      (o.any || avail(x, o.mode, o.opt)) && (!q.length || q.every((w) => x.n.toLowerCase().includes(w)))), o.mode);
  }

  /* ---------- the weekly plan ---------- */
  // pref: ordered name patterns per mode. The target muscle is fixed by the slot, so every mode trains the same muscle.
  const SLOTS = {
    hPress: { t: 'pectorals', l: 'Chest press' },
    pushV: { t: 'pectorals', l: 'Chest push / fly' },
    ohPress: { t: 'delts', l: 'Overhead press' },
    lateral: { t: 'delts', l: 'Lateral raise' },
    rear: { t: 'delts', l: 'Rear delts' },
    triExt: { t: 'triceps', l: 'Triceps extension' },
    triPush: { t: 'triceps', l: 'Triceps press' },
    closeGrip: { t: 'triceps', l: 'Close-grip press' },
    vPull: { t: 'lats', l: 'Vertical pull' },
    row: { t: 'upper back', l: 'Row' },
    oneRow: { t: 'lats', l: 'One-arm row' },
    curl: { t: 'biceps', l: 'Curl' },
    hammer: { t: 'biceps', l: 'Hammer curl' },
    hinge: { t: 'glutes', l: 'Hip hinge' },
    squat: { t: 'quads', l: 'Squat' },
    split: { t: 'glutes', l: 'Split squat' },
    calf: { t: 'calves', l: 'Calf raise' },
    legRaise: { t: 'abs', l: 'Leg raise' },
    plank: { t: 'abs', l: 'Plank' }
  };
  const PREF = {
    hPress: { gym: ['^barbell bench press$', '^dumbbell bench press$'], homegym: ['floor press', '^push-up$'], home: ['^push-up$'] },
    pushV: { gym: ['^dumbbell incline bench press$', '^cable standing fly$', '^dumbbell fly$'], homegym: ['^dumbbell fly$', '^push-up plus$'], home: ['^push-up plus$', '^shoulder tap push-up$', '^clock push-up$'] },
    ohPress: { gym: ['^barbell seated overhead press$', '^dumbbell standing overhead press$', '^cable shoulder press$'], homegym: ['^dumbbell standing overhead press$', '^dumbbell seated shoulder press$'], home: ['^pike push-up$', '^backpack overhead press$'] },
    lateral: { gym: ['^cable lateral raise$', '^dumbbell lateral raise$'], homegym: ['^dumbbell lateral raise$'], home: ['^backpack lateral raise$'] },
    rear: { gym: ['^dumbbell rear lateral raise$', '^dumbbell rear delt raise$', '^dumbbell rear fly$'], homegym: ['^dumbbell rear lateral raise$', '^dumbbell rear delt raise$', '^dumbbell rear fly$'], home: ['^bent-over backpack rear raise$'] },
    triExt: { gym: ['^cable pushdown$', '^cable triceps pushdown \\(v-bar\\)$'], homegym: ['^dumbbell standing triceps extension$', '^dumbbell seated triceps extension$'], home: ['^backpack triceps extension$'] },
    triPush: { gym: ['^cable pushdown \\(with rope attachment\\)$', '^cable triceps pushdown \\(v-bar\\)$'], homegym: ['^band .*triceps', '^diamond push-up$'], home: ['^diamond push-up$'] },
    closeGrip: { gym: ['^barbell close-grip bench press$', '^close-grip push-up$'], homegym: ['^close-grip push-up$', '^diamond push-up$'], home: ['^close-grip push-up$', '^diamond push-up$'] },
    vPull: { gym: ['^cable pulldown$', '^cable bar lateral pulldown$'], homegym: ['^pull-up$', '^chin-up$'], home: ['^towel doorway row$', '^superman lat pulldown$'] },
    row: { gym: ['^barbell bent over row$', '^cable seated row$'], homegym: ['^barbell bent over row$', '^dumbbell bent over row$'], home: ['^bodyweight standing row \\(with towel\\)$', '^backpack bent-over row$'] },
    oneRow: { gym: ['^cable one arm pulldown$', '^lever one arm lateral wide pulldown$'], homegym: ['^band underhand pulldown$', '^chin-up$'], home: ['^superman lat pulldown$', '^towel doorway row$'] },
    curl: { gym: ['^barbell curl$'], homegym: ['^dumbbell biceps curl$'], home: ['^backpack biceps curl$'] },
    hammer: { gym: ['^dumbbell hammer curl$'], homegym: ['^dumbbell hammer curl$'], home: ['^backpack hammer curl$'] },
    hinge: { gym: ['^barbell romanian deadlift$'], homegym: ['^barbell romanian deadlift$', '^dumbbell romanian deadlift$'], home: ['^low glute bridge on floor$', '^glute bridge march$'] },
    squat: { gym: ['^dumbbell goblet squat$', '^lever leg extension$'], homegym: ['^dumbbell goblet squat$'], home: ['^squat to overhead reach$', '^sissy squat$'] },
    split: { gym: ['^barbell lunge$', '^dumbbell lunge$'], homegym: ['^dumbbell lunge$', '^dumbbell rear lunge$'], home: ['^walking lunge$', '^curtsey squat$'] },
    calf: { gym: ['^lever standing calf raise$', '^barbell standing calf raise$'], homegym: ['^dumbbell standing calf raise$'], home: ['^bodyweight standing calf raise$'] },
    legRaise: { gym: ['^hanging leg raise$', '^lever seated leg raise crunch$'], homegym: ['^hanging leg raise$'], home: ['^seated leg raise$', '^twisted leg raise$', '^reverse crunch$'] },
    plank: { gym: ['^front plank$', 'plank'], homegym: ['^front plank$', 'plank'], home: ['^front plank$', 'plank'] }
  };
  Object.keys(PREF).forEach((k) => { SLOTS[k].pref = PREF[k]; });
  const DAYMETA = {
    1: { title: 'PUSH PROTOCOL', focus: 'Chest · shoulders · triceps' },
    2: { title: 'PULL PROTOCOL', focus: 'Back · biceps · rear delts' },
    3: { title: 'LOWER BODY PROTOCOL', focus: 'Legs · glutes · core' },
    4: { title: 'SHOULDER & ARM PROTOCOL', focus: 'Side delts · biceps · triceps' },
    5: { title: 'UPPER BODY GROWTH', focus: 'Chest · back · extra arms' }
  };
  const E = (k, sets, reps, extra) => Object.assign({ k, t: SLOTS[k].t, l: SLOTS[k].l, sets, reps }, extra || {});
  const DEFAULT_DAYS = {
    1: [['hPress', 3, '8–15'], ['pushV', 2, '8–15'], ['ohPress', 3, '8–12'], ['lateral', 3, '12–20'], ['triExt', 2, '10–15']],
    2: [['vPull', 3, '5–10'], ['row', 3, '8–15'], ['oneRow', 2, '10–15 each side'], ['rear', 2, '15–20'], ['curl', 3, '8–15'], ['hammer', 2, '10–15']],
    3: [['hinge', 3, '8–12'], ['squat', 3, '10–15'], ['split', 2, '8–12 each leg'], ['calf', 3, '12–20'], ['legRaise', 2, '10–15'], ['plank', 2, '30–60 seconds']],
    4: [['ohPress', 2, '8–12'], ['lateral', 4, '12–20'], ['rear', 3, '12–20'], ['curl', 3, '8–15'], ['triPush', 3, '12–20'], ['hammer', 2, '10–15'], ['closeGrip', 2, '8–15']],
    5: [['hPress', 3, '8–15'], ['vPull', 3, '5–10'], ['row', 3, '8–15'], ['pushV', 2, '8–15'], ['lateral', 2, '15–20'], ['curl', 2, '12–20'], ['triExt', 2, '12–20']]
  };
  function defaultDay(dow) {
    const d = DEFAULT_DAYS[dow];
    if (d) return d.map((r) => E(r[0], r[1], r[2]));
    return [0, 1, 2, 3].map((r) => ({ kind: 'rest', r }));
  }

  const tokens = (n) => new Set(n.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter((w) => w.length > 2 && !['the', 'with', 'and', 'barbell', 'dumbbell', 'band', 'cable', 'bodyweight', 'lever', 'smith', 'resistance'].includes(w)));
  function similar(ref, pool, mode, used) {
    const a = tokens(ref.n); let best = null, bs = -1;
    pool.forEach((x) => {
      if (used && used.has(x.i)) return;
      const b = tokens(x.n); let hit = 0; a.forEach((w) => { if (b.has(w)) hit++; });
      const s = hit / (a.size + b.size - hit || 1) * 10 + score(x, mode) / 10;
      if (s > bs) { bs = s; best = x; }
    });
    return best;
  }

  const poolMemo = new Map();
  function poolFor(target, mode, opt) {
    const key = target + '|' + mode + '|' + (opt && opt.bench ? 1 : 0); let p = poolMemo.get(key);
    if (!p) { p = candidates({ target, mode, opt }); poolMemo.set(key, p); }
    return p;
  }
  function autoPick(entry, mode, opt, used) {
    const pool = poolFor(entry.t, mode, opt); if (!pool.length) return null;
    const free = pool.filter((x) => !used.has(x.i));
    const src = free.length ? free : pool;
    const slot = entry.k && SLOTS[entry.k];
    if (slot && slot.pref && slot.pref[mode]) {
      for (const rx of slot.pref[mode]) { const re = new RegExp(rx, 'i'), m = src.find((x) => re.test(x.n)); if (m) return m; }
    }
    if (entry.like && BYID[entry.like]) return similar(BYID[entry.like], src, mode, null) || src[0];
    return src[0];
  }

  // turns plan entries into concrete exercises for a mode
  function resolveDay(entries, mode, opt) {
    const used = new Set();
    return entries.map((en) => {
      if (en.kind === 'rest') return { entry: en, rest: true };
      let ex = null; const id = en.pk && en.pk[mode];
      if (id && BYID[id] && avail(BYID[id], mode, opt)) ex = BYID[id];
      if (!ex) ex = autoPick(en, mode, opt, used);
      if (ex) used.add(ex.i);
      return { entry: en, ex };
    });
  }

  /* ---------- muscle balance ---------- */
  const TRACKED = [['pectorals', 'Chest'], ['lats', 'Lats'], ['upper back', 'Upper back'], ['traps', 'Traps'], ['delts', 'Shoulders'], ['biceps', 'Biceps'], ['triceps', 'Triceps'], ['forearms', 'Forearms'], ['abs', 'Abs'], ['glutes', 'Glutes'], ['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['calves', 'Calves']];
  function addVolume(acc, ex, sets) {
    if (!ex) return;
    acc[ex.t] = (acc[ex.t] || 0) + sets;
    (ex.s || []).forEach((m) => { if (m !== ex.t) acc[m] = (acc[m] || 0) + sets * 0.5; });
  }

  /* ---------- warm-up and cool-down ---------- */
  const WARM_OK = /^(jack jump|star jump|high knee|skater|astride jumps|half knee bends|scissor jumps|short stride run)/;
  function warmup(targets, mode, opt, seed) {
    const cardio = LIB.filter((x) => (x.f & F.CAR) && x.e === 'body weight' && WARM_OK.test(x.n) && avail(x, mode, opt)).sort((a, b) => a.n.localeCompare(b.n));
    const mobAll = LIB.filter((x) => (x.f & F.MOB) && avail(x, mode, opt)).sort((a, b) => a.n.localeCompare(b.n));
    const tset = new Set(targets), mob = mobAll.filter((x) => tset.has(x.t) || (x.s || []).some((m) => tset.has(m)));
    const rest = mobAll.filter((x) => !mob.includes(x));
    return { general: cardio.length ? [cardio[seed % cardio.length]] : [], mobility: mob.concat(rest).slice(0, 4) };
  }
  function cooldown(targets, mode, opt, seed) {
    const out = [];
    targets.forEach((t) => {
      const pool = LIB.filter((x) => (x.f & F.STR) && x.e === 'body weight' && x.t === t && avail(x, mode, opt) && !/rope|assisted/.test(x.n)).sort((a, b) => a.n.localeCompare(b.n));
      if (pool.length) out.push(pool[seed % pool.length]);
    });
    return out.slice(0, 6);
  }


  /* ---------- guided session (playlist) ---------- */
  const ISO = /(curl|raise|extension|fly|flye|kickback|shrug|crunch|calf|plank|twist|pushdown|wrist|pullover|wring|circle|swing|squeeze)/i;
  const isLoaded = (e) => !['body weight', 'household', 'band', 'resistance band', 'assisted'].includes(e);
  function parseReps(reps) {
    const r = String(reps || ''), nums = (r.match(/\d+/g) || []).map(Number);
    const last = nums.length ? nums[nums.length - 1] : 0;
    const hold = /min/i.test(r) ? Math.max(1, last) * 60 : /sec/i.test(r) ? last || 30 : 0;
    return { lo: nums[0] || 8, hi: last || 12, hold, each: /each/i.test(r) };
  }
  // rest between sets of the same exercise (seconds): heavy compounds recover slowest
  function restFor(it) {
    const ex = it.ex; if (!ex) return 60;
    const p = parseReps(it.reps);
    if (p.hold) return 45;
    if (['abs', 'calves', 'forearms', 'traps'].includes(ex.t)) return 45;
    const comp = !ISO.test(ex.n), loaded = isLoaded(ex.e);
    if (comp && loaded) return p.hi <= 8 ? 150 : 120;
    if (comp) return 90;
    return loaded ? 60 : 45;
  }
  // pause while you move to the next exercise and set up
  const moveRest = (next) => (next.ex && !ISO.test(next.ex.n) && isLoaded(next.ex.e) ? 90 : 60);
  function coachLine(it, k, of) {
    const p = parseReps(it.reps), ex = it.ex;
    if (p.hold) return 'Breathe steadily and keep your body in one straight line. Stop the set if your form breaks.';
    const iso = ISO.test(ex.n);
    if (k === of) return 'Last set: push closer to failure, but keep every rep clean. Stop 0–1 reps before form breaks.';
    return iso ? 'Lower for 2–3 seconds and squeeze at the top. Finish each set with 1–2 reps left in the tank.'
      : 'Move with control: about 2 seconds up, 3 seconds down. Finish each set with 1–3 reps left in the tank.';
  }
  // o: { items:[{ex,sets,reps,...}], got:(i)=>sets done, done:(i)=>bool, warm:{general,mobility}, cool:[ex], fresh:bool }
  function buildSession(o) {
    const todo = o.items.map((it, i) => ({ it, i })).filter((x) => x.it.ex && !o.done(x.i));
    if (!todo.length) return [];
    const S = [{ t: 'intro' }];
    if (o.fresh) {
      o.warm.general.forEach((ex) => S.push({ t: 'warm', ex, secs: 120, title: 'Raise your pulse', sub: '2 minutes at an easy pace' }));
      o.warm.mobility.slice(0, 3).forEach((ex) => S.push({ t: 'warm', ex, secs: 30, title: 'Loosen up', sub: '30 seconds, slow and smooth' }));
      const f = todo[0];
      if (isLoaded(f.it.ex.e) && !ISO.test(f.it.ex.n)) {
        S.push({ t: 'ramp', i: f.i });
        S.push({ t: 'rest', secs: 30, kind: 'ramp' });
      }
    }
    todo.forEach((x, n) => {
      const p = parseReps(x.it.reps), start = Math.min(x.it.sets, o.got(x.i) || 0);
      for (let k = start + 1; k <= x.it.sets; k++) {
        S.push({ t: 'set', i: x.i, k, of: x.it.sets, hold: p.hold });
        if (k < x.it.sets) S.push({ t: 'rest', secs: restFor(x.it), kind: 'set', i: x.i });
        else if (todo[n + 1]) S.push({ t: 'rest', secs: moveRest(todo[n + 1].it), kind: 'move', i: x.i });
      }
    });
    o.cool.slice(0, 5).forEach((ex) => S.push({ t: 'stretch', ex, secs: 30, title: 'Cool-down stretch', sub: 'Hold 30 seconds and breathe slowly. Repeat on the other side if it is one-sided.' }));
    S.push({ t: 'end' });
    return S;
  }
  function estimateMin(S) {
    const secs = S.reduce((a, s) => a + (s.t === 'set' ? s.hold || 40 : s.t === 'ramp' ? 40 : s.secs || 0), 0);
    return Math.max(5, Math.round(secs / 300) * 5);
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const eqLabel = (e) => (e === 'household' ? 'HOME HACK' : e === 'body weight' ? 'BODYWEIGHT' : e.toUpperCase());

  window.HunterEngine = { F, LIB, MODES, MODE_KEYS, SLOTS, DAYMETA, TRACKED, byId, avail, candidates, defaultDay, resolveDay, autoPick, similar, score, kindOf, addVolume, warmup, cooldown, cap, eqLabel, parseReps, restFor, moveRest, coachLine, isLoaded, buildSession, estimateMin };
})();
