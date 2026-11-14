/* HUNTER SYSTEM — app logic */
(function () {
  'use strict';
  const H = window.Hunter;
  const E = window.HunterEngine;
  const $ = (id) => document.getElementById(id);
  const KEY = 'hunter-body-system-v1';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DEFAULTS = { logs: {}, weights: [], waists: [], goal: 68, start: 58, calories: 2500, protein: 120, totalXP: 0, sound: true, vibe: true, rest: 90, rem: null, remFired: {}, mode: 'homegym', bench: false, plan: null };
  let data = JSON.parse(JSON.stringify(DEFAULTS));
  let previewKey = null, tab = 'today', deferredPrompt = null, trainSig = '', sheetIdx = -1;

  /* ---------- storage ---------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') data = Object.assign({}, DEFAULTS, s);
    } catch (e) { /* ignore */ }
    if (!data.logs || typeof data.logs !== 'object') data.logs = {};
    if (!Array.isArray(data.weights)) data.weights = [];
    if (!Array.isArray(data.waists)) data.waists = [];
    if (!E.MODES[data.mode]) data.mode = 'homegym';
    if (!data.plan || typeof data.plan !== 'object' || Array.isArray(data.plan)) data.plan = null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked */ } }

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => dateKey(new Date());
  const activeDate = () => (previewKey ? parseKey(previewKey) : new Date());
  const EMPTY = { checks: {}, meals: {}, sets: {}, water: 0, bonus: false };
  const getLog = (key) => data.logs[key] || EMPTY;
  function logFor(key) {
    const l = data.logs[key] || (data.logs[key] = {});
    l.checks = l.checks || {}; l.meals = l.meals || {}; l.sets = l.sets || {}; l.water = l.water || 0;
    return l;
  }
  const fmt = (n, d = 1) => Number(n).toFixed(d).replace(/\.0+$/, '');

  /* ---------- levels / ranks ---------- */
  const lvOf = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 20));
  const xpFor = (l) => 20 * (l - 1) * (l - 1);
  const RANKS = [
    { r: 'E', min: 1, name: 'ROOKIE', c: '#8fb4d9' }, { r: 'D', min: 5, name: 'FIGHTER', c: '#77f2b2' },
    { r: 'C', min: 10, name: 'VETERAN', c: '#65f4ff' }, { r: 'B', min: 17, name: 'ELITE', c: '#4e8cff' },
    { r: 'A', min: 25, name: 'CHAMPION', c: '#b18cff' }, { r: 'S', min: 35, name: 'APEX HUNTER', c: '#ffc878' }
  ];
  const rankOf = (l) => RANKS.reduce((a, x) => (l >= x.min ? x : a), RANKS[0]);

  /* ---------- day model ---------- */
  const modeKey = () => (E.MODES[data.mode] ? data.mode : 'homegym');
  const eopt = () => ({ bench: !!data.bench });
  const planFor = (dow) => (data.plan && Array.isArray(data.plan[dow]) ? data.plan[dow] : E.defaultDay(dow));
  const trainDows = () => [0, 1, 2, 3, 4, 5, 6].filter((dw) => planFor(dw).some((en) => en.kind !== 'rest'));
  let editing = false;
  function editPlan(dow, fn) {
    const cur = JSON.parse(JSON.stringify(planFor(dow)));
    fn(cur);
    if (!data.plan || typeof data.plan !== 'object') data.plan = {};
    data.plan[dow] = cur; save(); trainSig = ''; renderAll();
  }
  const resMemo = new Map();
  function resolved(dow) {
    const en = planFor(dow), key = dow + '|' + modeKey() + '|' + (data.bench ? 1 : 0) + '|' + JSON.stringify(en);
    let r = resMemo.get(key);
    if (!r) { if (resMemo.size > 300) resMemo.clear(); r = E.resolveDay(en, modeKey(), eopt()); resMemo.set(key, r); }
    return r;
  }
  function itemFrom(r) {
    if (r.rest) { const x = H.REST[r.entry.r] || H.REST[0]; return { kind: 'rest', fig: x.fig, emoji: x.emoji, name: x.name, eq: '', sets: 1, reps: '', meta: x.meta, cues: x.cues }; }
    const en = r.entry, ex = r.ex;
    if (!ex) return { kind: 'ex', ex: null, emoji: '⚠️', name: en.l || 'Exercise', eq: '', target: en.t, sets: en.sets, reps: en.reps, meta: `${en.sets} sets × ${en.reps}`, cues: ['No exercise is available for this muscle in the current mode.'] };
    return { kind: 'ex', ex, exId: ex.i, name: E.cap(ex.n), label: en.l, eq: E.eqLabel(ex.e), target: ex.t, sets: en.sets, reps: en.reps, meta: `${en.sets} sets × ${en.reps}`, cues: ex.p };
  }
  function dayInfo(d) {
    const dow = d.getDay(), key = dateKey(d), l = getLog(key);
    const items = resolved(dow).map(itemFrom);
    const w = items.some((it) => it.kind === 'ex') ? (E.DAYMETA[dow] || { title: 'CUSTOM SESSION', focus: 'Your own exercises' }) : null;
    let done = 0;
    items.forEach((_, i) => { if (l.checks['w' + i]) done++; });
    H.MEALS.forEach((m, i) => { if (!m.optional && l.meals['m' + i]) done++; });
    const total = items.length + H.MEALS.filter((m) => !m.optional).length;
    const xpDay = (Object.values(l.checks).filter(Boolean).length + Object.values(l.meals).filter(Boolean).length) * 10 + (l.bonus ? 50 : 0);
    return { d, dow, key, l, w, items, entries: planFor(dow), total, done, pct: total ? Math.round((done / total) * 100) : 0, xpDay };
  }
  function eaten(l) {
    let k = 0, p = 0;
    H.MEALS.forEach((m, i) => { if (l.meals['m' + i]) { k += m.kcal; p += m.protein; } });
    return { k, p };
  }
  function streak() {
    let n = 0; const d = new Date();
    for (let i = 0; i < 400; i++) {
      const l = data.logs[dateKey(d)];
      const any = l && (Object.values(l.checks || {}).some(Boolean) || Object.values(l.meals || {}).some(Boolean));
      if (any) { n++; d.setDate(d.getDate() - 1); } else if (i === 0) d.setDate(d.getDate() - 1); else break;
    }
    return n;
  }
  const curWeight = () => (data.weights.length ? Number(data.weights[data.weights.length - 1].weight) : Number(data.start));

  /* ---------- feedback: sound, vibration, toast ---------- */
  let ac;
  function tone(f, t, d, type, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.12, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.03);
  }
  function sfx(k) {
    if (!data.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const n = ac.currentTime;
      if (k === 'check') { tone(660, n, 0.09); tone(990, n + 0.07, 0.13); }
      else if (k === 'uncheck') tone(330, n, 0.1, 'triangle');
      else if (k === 'set') tone(780, n, 0.09);
      else if (k === 'timer') [880, 880, 1175].forEach((f, i) => tone(f, n + i * 0.2, 0.16, 'square', 0.06));
      else if (k === 'level') [523, 659, 784, 1047].forEach((f, i) => tone(f, n + i * 0.11, 0.24, 'triangle', 0.14));
      else if (k === 'clear') [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, n + i * 0.09, 0.22, 'triangle', 0.12));
    } catch (e) { /* audio unavailable */ }
  }
  const vibe = (p) => { if (data.vibe && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* noop */ } };
  let toastT;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- effects: background motes + confetti ---------- */
  function startFx() {
    const c = $('fx'), x = c.getContext('2d'); let w, h, on = false; const P = [];
    function size() { const dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); addEventListener('resize', size);
    for (let i = 0; i < 42; i++) P.push({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.8, s: 0.12 + Math.random() * 0.4, a: 0.15 + Math.random() * 0.5, p: Math.random() * 6.28, c: Math.random() < 0.25 ? '177,140,255' : '101,244,255' });
    function frame(t) {
      x.clearRect(0, 0, w, h);
      for (const p of P) {
        if (!reduce) { p.y -= p.s; p.x += Math.sin(t / 2200 + p.p) * 0.18; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; } }
        const a = p.a * (0.6 + 0.4 * Math.sin(t / 900 + p.p));
        x.beginPath(); x.fillStyle = `rgba(${p.c},${a})`; x.shadowColor = `rgba(${p.c},.8)`; x.shadowBlur = 8; x.arc(p.x, p.y, p.r, 0, 6.283); x.fill();
      }
      if (!reduce && !document.hidden) requestAnimationFrame(frame); else on = false;
    }
    const go = () => { if (!on) { on = true; requestAnimationFrame(frame); } };
    go(); document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
  }
  function confetti(n) {
    if (reduce) return;
    const c = $('confetti'), x = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ['#65f4ff', '#b18cff', '#ffc878', '#77f2b2', '#4e8cff'];
    const P = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * 5) | 0], life: 0 }));
    (function step() {
      x.clearRect(0, 0, innerWidth, innerHeight); let alive = 0;
      for (const p of P) {
        p.vy += 0.38; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr; p.life++;
        if (p.y < innerHeight + 20 && p.life < 150) { alive++; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - p.life / 150); x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); x.restore(); }
      }
      if (alive) requestAnimationFrame(step); else x.clearRect(0, 0, innerWidth, innerHeight);
    })();
  }
  let ovT;
  function overlay(html, ms) {
    $('ovCard').innerHTML = html; const o = $('overlay'); o.classList.add('show');
    clearTimeout(ovT); ovT = setTimeout(() => o.classList.remove('show'), ms || 3200);
  }
  $('overlay').addEventListener('click', () => { clearTimeout(ovT); $('overlay').classList.remove('show'); });

  function levelUp(from, to) {
    const r0 = rankOf(from), r1 = rankOf(to);
    document.documentElement.style.setProperty('--rank', r1.c);
    if (r1.r !== r0.r) overlay(`<div class="ov-small">RANK UP</div><div class="ov-rank" style="--rank:${r1.c}">${r1.r}</div><div class="ov-big">${r1.name}</div><div class="ov-sub">You reached LEVEL ${to}</div><div class="ov-hint">TAP TO CONTINUE</div>`, 4200);
    else overlay(`<div class="ov-small">SYSTEM NOTICE</div><div class="ov-big">LEVEL UP!</div><div class="ov-sub">LV ${from} → <b style="color:var(--cyan)">LV ${to}</b></div><div class="ov-hint">TAP TO CONTINUE</div>`, 3200);
    sfx('level'); vibe([60, 40, 120]); confetti(130);
  }
  function showCleared() {
    overlay('<div class="ov-small">SYSTEM NOTICE</div><div class="ov-big">DAILY QUEST<br>CLEARED</div><div class="ov-sub">+50 BONUS XP</div><div class="ov-hint">TAP TO CONTINUE</div>', 3400);
    sfx('clear'); vibe([50, 30, 50, 30, 150]); confetti(110);
  }

  /* ---------- state changes ---------- */
  function setCheck(type, id, val) {
    const d = activeDate(), key = dateKey(d), l = logFor(key), bucket = type === 'meal' ? l.meals : l.checks;
    if (!!bucket[id] === val) return;
    const lv0 = lvOf(data.totalXP || 0);
    bucket[id] = val;
    data.totalXP = Math.max(0, (data.totalXP || 0) + (val ? 10 : -10));
    if (type === 'work' && !val) { delete l.sets[id]; if (l.ex) delete l.ex[id]; }
    if (type === 'work' && val) { const it0 = dayInfo(d).items[+id.slice(1)]; if (it0 && it0.ex) { if (!l.ex) l.ex = {}; l.ex[id] = it0.ex.i; } }
    const info = dayInfo(d);
    let cleared = false;
    if (info.pct >= 100 && !l.bonus) { l.bonus = true; data.totalXP += 50; cleared = true; }
    else if (info.pct < 100 && l.bonus) { l.bonus = false; data.totalXP = Math.max(0, data.totalXP - 50); }
    save();
    sfx(val ? 'check' : 'uncheck'); vibe(val ? 18 : 8);
    renderAll();
    const lv1 = lvOf(data.totalXP);
    if (lv1 > lv0) levelUp(lv0, lv1); else if (cleared) showCleared();
  }

  /* ---------- rendering: shared bits ---------- */
  function ringSVG(pct, color) {
    const r = 22, C = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 54 54"><circle class="bg" cx="27" cy="27" r="${r}"/><circle class="fg" cx="27" cy="27" r="${r}" stroke="${color}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - Math.max(0, Math.min(1, pct)))).toFixed(1)}"/></svg>`;
  }
  function demoInto(el, it) {
    if (!el) return;
    const big = el.classList.contains('big');
    if (it.ex && it.ex.m) {
      el.classList.remove('emoji'); el.classList.toggle('gif', big); el.classList.toggle('sq', !big);
      el.innerHTML = `<img class="eximg" src="media/${big ? 'g' : 'i'}/${it.ex.m}.${big ? 'gif' : 'jpg'}" alt="${esc(it.name || '')}" width="180" height="180"${big ? '' : ' loading="lazy"'}>`;
    } else if (it.ex && it.ex.g && H.hasFig(it.ex.g)) { el.classList.remove('emoji', 'sq', 'gif'); H.mountFig(el, it.ex.g, big); }
    else if (it.fig) { el.classList.remove('emoji', 'sq', 'gif'); H.mountFig(el, it.fig, big); }
    else { el.classList.remove('sq', 'gif'); el.classList.add('emoji'); el.innerHTML = `<span class="em">${it.emoji || '🏠'}</span>`; }
  }

  /* ---------- TODAY ---------- */
  function renderToday(info) {
    const isToday = info.key === todayKey(), now = new Date();
    $('todayDate').textContent = info.d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    $('systemTime').textContent = isToday ? '· ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '· PREVIEW';
    const hr = now.getHours();
    $('greeting').innerHTML = !isToday ? `${DAYS[info.dow].toUpperCase()}<br><span>PROTOCOL.</span>`
      : info.pct >= 100 ? 'QUESTS CLEARED.<br><span>RECOVER.</span>'
      : `${hr < 12 ? 'GOOD MORNING,' : hr < 18 ? 'GOOD AFTERNOON,' : 'GOOD EVENING,'}<br><span>HUNTER.</span>`;
    const xp = data.totalXP || 0, lv = lvOf(xp), rk = rankOf(lv);
    document.documentElement.style.setProperty('--rank', rk.c);
    const a = xpFor(lv), b = xpFor(lv + 1), prog = (xp - a) / (b - a);
    $('rankLetter').textContent = rk.r; $('rankLv').textContent = 'LV ' + lv;
    $('rankTitle').textContent = `RANK ${rk.r} · ${rk.name}`;
    $('lvRing').setAttribute('stroke-dashoffset', (295.3 * (1 - prog)).toFixed(1));
    $('questPct').textContent = info.pct + '%'; $('questBar').style.width = info.pct + '%';
    $('questCount').textContent = `${info.done} / ${info.total} quests cleared`;
    $('xpText').textContent = `+${info.xpDay} XP TODAY`;
    $('lvPct').textContent = Math.round(prog * 100) + '%'; $('lvBar').style.width = prog * 100 + '%';
    $('xpNow').textContent = xp + ' XP'; $('xpNext').textContent = `LV ${lv + 1} at ${b} XP`;
    const doy = Math.floor((info.d - new Date(info.d.getFullYear(), 0, 0)) / 864e5);
    $('tip').textContent = H.TIPS[doy % H.TIPS.length];

    const e = eaten(info.l), st = streak();
    $('stats').innerHTML = `
      <div class="stat">${ringSVG(e.k / data.calories, '#65f4ff')}<div><div class="label">CALORIES</div><div class="num">${e.k.toLocaleString()}<small> / ${Number(data.calories).toLocaleString()}</small></div><div class="desc">eaten from ticked meals</div></div></div>
      <div class="stat">${ringSVG(e.p / data.protein, '#b18cff')}<div><div class="label">PROTEIN</div><div class="num">${e.p}<small> / ${data.protein} g</small></div><div class="desc">muscle-building target</div></div></div>
      <div class="stat"><div class="flame">🔥</div><div><div class="label">STREAK</div><div class="num">${st}<small> day${st === 1 ? '' : 's'}</small></div><div class="desc">days with a cleared quest</div></div></div>
      <div class="stat"><div class="flame" style="filter:drop-shadow(0 0 10px #b18cff);animation-duration:2.4s">⚡</div><div><div class="label">TOTAL XP</div><div class="num">${xp.toLocaleString()}</div><div class="desc">earned from completed tasks</div></div></div>`;

    // week strip
    const sun = new Date(info.d); sun.setDate(sun.getDate() - info.dow);
    let wk = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun); d.setDate(sun.getDate() + i);
      const di = dayInfo(d), C = 75.4;
      wk += `<button class="wd ${di.key === info.key ? 'sel' : ''} ${di.key === todayKey() ? 'today' : ''} ${di.pct >= 100 ? 'full' : ''} ${di.w ? '' : 'rest'}" data-day="${di.key}"><span class="dn">${DAYS[i].slice(0, 3).toUpperCase()}</span><svg viewBox="0 0 30 30"><circle class="bg" cx="15" cy="15" r="12"/><circle class="fg" cx="15" cy="15" r="12" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - di.pct / 100)).toFixed(1)}"/></svg><span>${di.pct}%</span></button>`;
    }
    $('week').innerHTML = wk;

    // next quest
    const idx = info.items.findIndex((_, i) => !info.l.checks['w' + i]);
    let html, demo = null;
    if (idx >= 0) {
      const it = info.items[idx]; demo = it;
      html = `<div class="next"><div class="figbox" id="nextFig"></div><div><div class="label">${info.w ? 'TRAINING' : 'RECOVERY'} · ${idx + 1} / ${info.items.length}${info.w ? ' · ' + E.MODES[modeKey()].name : ''}</div><h4>${esc(it.name)}</h4><p>${esc(it.meta)}</p><button class="btn primary" data-open="${idx}">START QUEST</button></div></div>`;
    } else {
      const mi = H.MEALS.findIndex((m, i) => !m.optional && !info.l.meals['m' + i]);
      if (mi >= 0) {
        const m = H.MEALS[mi];
        html = `<div class="next"><div class="figbox emoji" style="width:116px;height:80px;flex:none"><span class="em">${m.icon}</span></div><div><div class="label">NUTRITION · ${m.time}</div><h4>${esc(m.name)}</h4><p>${m.kcal} kcal · ${m.protein} g protein</p><button class="btn primary" data-go="fuel">OPEN MEALS</button></div></div>`;
      } else {
        html = `<div style="text-align:center;padding:10px 0"><div style="font-size:44px">🏆</div><h4 style="margin:6px 0 4px;font-size:18px">ALL QUESTS CLEARED</h4><p class="notice" style="margin:0">Rest, hydrate and come back stronger tomorrow.</p></div>`;
      }
    }
    $('next').innerHTML = html;
    if (demo) demoInto($('nextFig'), demo);
  }

  /* ---------- TRAIN ---------- */
  function taskHTML(it, i, on, ed, n) {
    const chips = `${it.ex ? `<span class="chip">${esc(String(it.target).toUpperCase())}</span>` : ''}${it.eq ? `<span class="chip">${esc(it.eq)}</span>` : ''}${ed ? '' : '<span class="chip xp">+10 XP</span>'}`;
    const ctl = `<div class="edit-ctl"><button data-ed="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button data-ed="down" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>${it.kind === 'ex' ? `<button data-ed="sm" data-i="${i}" aria-label="Fewer sets">−</button><span class="sv">${it.sets}</span><button data-ed="sp" data-i="${i}" aria-label="More sets">+</button><button data-ed="reps" data-i="${i}">REPS</button>` : ''}<button data-ed="del" data-i="${i}" aria-label="Remove">✕</button></div>`;
    return `<div class="task ${on ? 'done' : ''} ${ed ? 'editing' : ''}" data-i="${i}"${ed ? '' : ' role="button" tabindex="0"'}><div class="figbox" data-fig="${i}"></div><div class="info"><div class="task-title">${esc(it.name)}</div><div class="task-meta">${esc(it.meta)}</div><div class="chips">${chips}</div>${ed ? ctl : ''}</div>${ed ? '' : `<button class="chk ${on ? 'on' : ''}" data-chk="${i}" aria-label="Mark done">${CHECK_SVG}</button>`}</div>`;
  }
  function renderTrain(info) {
    const rest = !info.w;
    $('trainTitle').textContent = info.w ? '▣ ' + info.w.title : '▣ RECOVERY DAY';
    $('trainFocus').textContent = info.w ? info.w.focus + '. Tap an exercise for the demo and rest timer.' : 'No heavy lifting. Let your muscles rebuild.';
    $('dayType').textContent = rest ? 'RECOVERY DAY' : 'TRAINING DAY';
    $('dayType').classList.toggle('warn', rest);
    const sun = new Date(info.d); sun.setDate(sun.getDate() - info.dow);
    $('daySwitch').innerHTML = DAYS.map((n, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return `<button class="${i === info.dow ? 'active' : ''}" data-day="${dateKey(d)}">${n.slice(0, 3).toUpperCase()}</button>`; }).join('');
    renderModeBar();
    $('editPlan').textContent = editing ? '✓ DONE EDITING' : '✎ EDIT PLAN';
    $('editTools').classList.toggle('hidden', !editing);
    const total = info.items.length, done = info.items.filter((_, i) => info.l.checks['w' + i]).length;
    $('workoutCount').textContent = `${done} / ${total}`; $('workoutBar').style.width = (total ? (done / total) * 100 : 0) + '%';
    const list = $('workoutList'), sig = info.key + '|' + modeKey() + '|' + (data.bench ? 1 : 0) + '|' + editing + '|' + JSON.stringify(info.entries);
    if (trainSig !== sig) {
      trainSig = sig;
      list.innerHTML = info.items.map((it, i) => taskHTML(it, i, !!info.l.checks['w' + i], editing, total)).join('');
      list.querySelectorAll('[data-fig]').forEach((el) => demoInto(el, info.items[+el.dataset.fig]));
    } else {
      list.querySelectorAll('.task').forEach((el) => {
        const on = !!info.l.checks['w' + el.dataset.i], c = el.querySelector('.chk');
        el.classList.toggle('done', on); if (c) c.classList.toggle('on', on);
      });
    }
    renderWarm(info);
    renderSessionCard(info);
  }

  /* ---------- FUEL ---------- */
  function renderFuel(info) {
    const e = eaten(info.l);
    $('calTag').textContent = Number(data.calories).toLocaleString() + ' KCAL';
    $('macro').innerHTML = `
      <div class="stat">${ringSVG(e.k / data.calories, '#65f4ff')}<div><div class="label">CALORIES</div><div class="num">${e.k.toLocaleString()}<small> / ${Number(data.calories).toLocaleString()}</small></div></div></div>
      <div class="stat">${ringSVG(e.p / data.protein, '#b18cff')}<div><div class="label">PROTEIN</div><div class="num">${e.p}<small> / ${data.protein} g</small></div></div></div>`;
    $('mealList').innerHTML = H.MEALS.map((m, i) => {
      const on = !!info.l.meals['m' + i];
      return `<div class="meal ${on ? 'done' : ''}" data-meal="${i}" role="button" tabindex="0"><div class="ico">${m.icon}</div><div class="mi"><div class="mt"><span>${m.time} · ${esc(m.name)}</span><small>${m.kcal} kcal</small></div><div class="chips">${m.items.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div><div class="mp">${m.protein} g protein${m.optional ? ' · optional' : ''}</div></div><button class="chk ${on ? 'on' : ''}" aria-label="Mark eaten">${CHECK_SVG}</button></div>`;
    }).join('');
    const w = info.l.water || 0;
    $('waterTxt').textContent = `${w} / 8`;
    $('water').innerHTML = Array.from({ length: 8 }, (_, i) => `<button class="drop ${i < w ? 'on' : ''}" data-drop="${i}" aria-label="Glass ${i + 1}"></button>`).join('');
  }

  /* ---------- STATS ---------- */
  function renderStats() {
    const cur = curWeight(), start = Number(data.start), goal = Number(data.goal);
    $('currentWeight').textContent = cur.toFixed(1);
    $('goalLine').textContent = `TARGET: ${goal.toFixed(1)} KG`;
    const diff = goal - start;
    $('missionLbl').textContent = `MISSION: ${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))} KG`;
    const pct = diff === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((cur - start) / diff) * 100)));
    $('weightPct').textContent = pct + '%'; $('weightBar').style.width = pct + '%';
    $('startLbl').textContent = `START ${fmt(start)} KG`; $('goalLbl').textContent = `GOAL ${fmt(goal)} KG`;
    drawChart(goal);
    // insights
    const W = data.weights; let ins = '';
    if (W.length >= 2) {
      const a = W[0], b = W[W.length - 1];
      const days = Math.max(1, (parseKey(b.date) - parseKey(a.date)) / 864e5);
      const rate = ((b.weight - a.weight) / days) * 7, rem = goal - b.weight;
      const eta = rate > 0 && rem > 0 ? Math.ceil(rem / rate) + ' wks' : rem <= 0 && diff > 0 ? 'reached' : '—';
      ins = `<div><span class="label">CHANGE</span><b>${b.weight - a.weight >= 0 ? '+' : ''}${(b.weight - a.weight).toFixed(1)} kg</b></div><div><span class="label">AVG / WEEK</span><b>${rate >= 0 ? '+' : ''}${rate.toFixed(2)} kg</b></div><div><span class="label">TO GOAL</span><b>${rem > 0 ? rem.toFixed(1) : '0'} kg</b></div><div><span class="label">ETA AT THIS RATE</span><b>${eta}</b></div>`;
    }
    if (data.waists.length) ins += `<div><span class="label">LATEST WAIST</span><b>${data.waists[data.waists.length - 1].waist} cm</b></div>`;
    $('insights').innerHTML = ins;
    $('weightHistory').innerHTML = W.slice(-6).reverse().map((x, i, arr) => {
      const prev = W[W.length - 2 - i];
      const dlt = prev ? x.weight - prev.weight : null;
      return `<div class="history-row"><span>${esc(x.date)}</span><span><strong>${Number(x.weight).toFixed(1)} kg</strong>${dlt === null ? '' : ` <small style="color:${dlt >= 0 ? 'var(--green)' : 'var(--orange)'}">${dlt >= 0 ? '+' : ''}${dlt.toFixed(1)}</small>`}</span></div>`;
    }).join('') || '<div class="notice">No weigh-ins yet. Log your first weight above.</div>';
  }
  function drawChart(goal) {
    const svg = $('chart'), W = data.weights.slice(-30), L = 34, R = 12, T = 14, B = 22, w = 320, h = 170;
    if (!W.length) { svg.innerHTML = '<text x="160" y="88" text-anchor="middle">Log your weight to see the trend</text>'; return; }
    const vals = W.map((x) => Number(x.weight)); let lo = Math.min(...vals), hi = Math.max(...vals);
    if (Math.abs(goal - hi) <= 4 || Math.abs(goal - lo) <= 4) { lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
    const p = Math.max(0.5, (hi - lo) * 0.18); lo -= p; hi += p;
    const t0 = parseKey(W[0].date).getTime(), t1 = parseKey(W[W.length - 1].date).getTime(), span = Math.max(1, t1 - t0);
    const X = (d) => (W.length === 1 ? (L + w - R) / 2 : L + ((parseKey(d).getTime() - t0) / span) * (w - L - R));
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
    let s = '';
    for (let i = 0; i <= 3; i++) { const v = lo + ((hi - lo) * i) / 3, y = Y(v); s += `<line class="grid" x1="${L}" x2="${w - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${y + 3}" text-anchor="end">${v.toFixed(1)}</text>`; }
    if (goal >= lo && goal <= hi) s += `<line class="gl" x1="${L}" x2="${w - R}" y1="${Y(goal)}" y2="${Y(goal)}"/><text class="g" x="${w - R}" y="${Y(goal) - 4}" text-anchor="end">GOAL ${fmt(goal)}</text>`;
    const pts = W.map((x) => `${X(x.date).toFixed(1)},${Y(x.weight).toFixed(1)}`);
    if (W.length > 1) s += `<polyline class="ln" points="${pts.join(' ')}"/>`;
    W.forEach((x) => { s += `<circle class="pt" cx="${X(x.date).toFixed(1)}" cy="${Y(x.weight).toFixed(1)}" r="3.4"/>`; });
    s += `<text x="${L}" y="${h - 6}">${W[0].date.slice(5)}</text><text x="${w - R}" y="${h - 6}" text-anchor="end">${W[W.length - 1].date.slice(5)}</text>`;
    svg.innerHTML = s;
  }
  function fillSettings() {
    $('startInput').value = data.start; $('goalInput').value = data.goal; $('calInput').value = data.calories; $('protInput').value = data.protein;
    $('soundSw').classList.toggle('on', !!data.sound); $('vibeSw').classList.toggle('on', !!data.vibe);
    $('soundBtn').textContent = '♪ ' + (data.sound ? 'ON' : 'OFF'); $('soundBtn').classList.toggle('on', !!data.sound);
    fillRem();
  }

  function renderAll() {
    const info = dayInfo(activeDate());
    renderToday(info); renderTrain(info); renderFuel(info); renderStats(); renderBalance();
  }

  /* ---------- exercise sheet + rest timer ---------- */
  const timer = { end: 0, total: 0, iv: 0, fired: true };
  let wake = null;
  function fmtT(s) { return `${Math.floor(s / 60)}:${pad(s % 60)}`; }
  function tickTimer() {
    const t = $('timer'); if (!t) { clearInterval(timer.iv); return; }
    const left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
    const C = 226.2;
    $('tFg').setAttribute('stroke-dashoffset', (C * (1 - (timer.total ? left / timer.total : 0))).toFixed(1));
    $('tTxt').textContent = fmtT(left);
    if (left === 0 && !timer.fired) {
      timer.fired = true; clearInterval(timer.iv);
      t.classList.remove('run'); t.classList.add('done');
      sfx('timer'); vibe([200, 100, 200, 100, 300]); toast('Rest over. Next set!');
    }
  }
  function startTimer() {
    timer.total = data.rest; timer.end = Date.now() + timer.total * 1000; timer.fired = false;
    const t = $('timer'); if (!t) return; t.classList.remove('done'); t.classList.add('run');
    clearInterval(timer.iv); timer.iv = setInterval(tickTimer, 200); tickTimer();
  }
  function resetTimer() {
    clearInterval(timer.iv); timer.fired = true;
    const t = $('timer'); if (!t) return; t.classList.remove('run', 'done');
    $('tFg').setAttribute('stroke-dashoffset', 0); $('tTxt').textContent = fmtT(data.rest);
  }
  function openSheet(i) {
    const info = dayInfo(activeDate()), it = info.items[i]; if (!it) return;
    sheetIdx = i;
    const isEx = it.kind === 'ex';
    $('sheet').innerHTML = `<div class="grab"></div><div class="figbox big" id="sheetFig"></div>
      <h3>${esc(it.name)}</h3>
      <div class="chips">${it.ex ? `<span class="chip">${esc(String(it.target).toUpperCase())}</span>` : ''}${it.eq ? `<span class="chip">${esc(it.eq)}</span>` : ''}<span class="chip">${esc(it.meta)}</span><span class="chip xp">+10 XP</span></div>
      ${it.ex && it.ex.s.length ? `<p class="notice" style="margin:8px 0 0">Also works: ${esc(it.ex.s.join(', '))}</p>` : ''}
      <ul class="cues">${it.cues.map((c, k) => `<li><b>${k + 1}</b><span>${esc(c)}</span></li>`).join('')}</ul>
      ${it.ex && it.ex.m ? '<div class="credit">© Gym visual — https://gymvisual.com/</div>' : ''}
      ${isEx ? `<div class="label">SETS · tap each one when finished</div><div class="sets" id="setChips"></div>
      <div class="timer" id="timer"><div class="tring"><svg viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="36"/><circle class="fg" id="tFg" cx="42" cy="42" r="36" stroke-dasharray="226.2" stroke-dashoffset="0"/></svg><div class="t" id="tTxt">${fmtT(data.rest)}</div></div>
        <div style="flex:1;min-width:0"><div class="label" style="margin-bottom:7px">REST TIMER</div><div class="presets" id="presets">${[45, 60, 90, 120].map((s) => `<button data-rest="${s}" class="${data.rest === s ? 'on' : ''}">${s}s</button>`).join('')}</div><div class="btn-row" style="margin:0"><button class="btn primary" id="tStart">START REST</button><button class="btn" id="tReset">RESET</button></div></div></div>` : ''}
      <div class="btn-row"><button class="btn primary" style="flex:1" id="sheetDone"></button>${isEx ? '<button class="btn" id="sheetSwap">⇄ SWAP</button>' : ''}<button class="btn" id="sheetClose">CLOSE</button></div>`;
    demoInto($('sheetFig'), it);
    refreshSheet();
    $('sheet').classList.add('open'); $('sheetBack').classList.add('open');
    $('sheet').scrollTop = 0;
    try { history.pushState({ sheet: 1 }, ''); } catch (e) { /* noop */ }
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {});
  }
  function refreshSheet() {
    if (sheetIdx < 0) return;
    const info = dayInfo(activeDate()), it = info.items[sheetIdx]; if (!it) return;
    const on = !!info.l.checks['w' + sheetIdx], got = info.l.sets['w' + sheetIdx] || 0;
    const sc = $('setChips');
    if (sc) sc.innerHTML = Array.from({ length: it.sets }, (_, k) => `<button class="setchip ${k < got || on ? 'on' : ''}" data-set="${k}">${k < got || on ? '✓ ' : ''}SET ${k + 1}</button>`).join('');
    $('sheetDone').textContent = on ? 'MARK NOT DONE' : 'COMPLETE QUEST  +10 XP';
  }
  function closeSheet(fromPop) {
    if (sheetIdx < 0 && !$('sheet').classList.contains('open')) return;
    sheetIdx = -1; clearInterval(timer.iv); timer.fired = true;
    $('sheet').classList.remove('open'); $('sheetBack').classList.remove('open');
    if (wake) { try { wake.release(); } catch (e) { /* noop */ } wake = null; }
    if (!fromPop && history.state && history.state.sheet) history.back();
  }
  window.addEventListener('popstate', () => { if ($('sheet').classList.contains('open')) closeSheet(true); });
  $('sheetBack').addEventListener('click', () => closeSheet());
  $('sheet').addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'sheetClose') return closeSheet();
    if (t.id === 'sheetSwap') { const k = sheetIdx; closeSheet(); return openLib({ mode: 'swap', idx: k }); }
    if (t.id === 'tStart') return startTimer();
    if (t.id === 'tReset') return resetTimer();
    if (t.dataset.rest) { data.rest = +t.dataset.rest; save(); document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('on', b === t)); if (!timer.fired) startTimer(); else $('tTxt').textContent = fmtT(data.rest); return; }
    const i = sheetIdx, id = 'w' + i;
    if (t.id === 'sheetDone') {
      const info = dayInfo(activeDate()), it = info.items[i], on = !!info.l.checks[id];
      if (on) { setCheck('work', id, false); refreshSheet(); }
      else { logFor(info.key).sets[id] = it.sets; setCheck('work', id, true); refreshSheet(); toast('Quest complete +10 XP'); setTimeout(() => closeSheet(), 450); }
      return;
    }
    if (t.dataset.set !== undefined) {
      const info = dayInfo(activeDate()), it = info.items[i], l = logFor(info.key), k = +t.dataset.set;
      const wasOn = !!l.checks[id]; const cur = wasOn ? it.sets : l.sets[id] || 0;
      const next = cur === k + 1 ? k : k + 1;
      if (wasOn) setCheck('work', id, false);
      logFor(info.key).sets[id] = next;
      if (next > cur) { sfx('set'); vibe(12); if (next < it.sets) startTimer(); }
      if (next >= it.sets) setCheck('work', id, true); else { save(); renderAll(); }
      refreshSheet();
    }
  });

  /* ---------- global click handling ---------- */
  function selectDay(key) { previewKey = key === todayKey() ? null : key; trainSig = ''; renderAll(); }
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'v-' + t));
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    window.scrollTo(0, 0);
    if (location.hash !== '#' + t) { try { history.replaceState(null, '', '#' + t); } catch (e) { /* noop */ } }
  }
  $('nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setTab(b.dataset.tab); sfx('set'); } });
  $('workoutList').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-ed]'); if (ed) return planEdit(ed.dataset.ed, +ed.dataset.i);
    if (editing) return;
    const chk = e.target.closest('[data-chk]');
    if (chk) { const i = +chk.dataset.chk, on = !!getLog(dateKey(activeDate())).checks['w' + i]; if (!on) { const it = dayInfo(activeDate()).items[i]; logFor(dateKey(activeDate())).sets['w' + i] = it.sets; } setCheck('work', 'w' + i, !on); return; }
    const task = e.target.closest('.task'); if (task) openSheet(+task.dataset.i);
  });
  $('mealList').addEventListener('click', (e) => {
    const m = e.target.closest('[data-meal]'); if (!m) return;
    const i = +m.dataset.meal; setCheck('meal', 'm' + i, !getLog(dateKey(activeDate())).meals['m' + i]);
  });
  $('water').addEventListener('click', (e) => {
    const d = e.target.closest('[data-drop]'); if (!d) return;
    const i = +d.dataset.drop, l = logFor(dateKey(activeDate()));
    l.water = l.water === i + 1 ? i : i + 1; save(); sfx('set'); vibe(10); renderFuel(dayInfo(activeDate()));
    if (l.water === 8) toast('Hydration quest done 💧');
  });
  document.addEventListener('click', (e) => {
    const day = e.target.closest('[data-day]'); if (day) return selectDay(day.dataset.day);
    const open = e.target.closest('[data-open]'); if (open) { setTab('train'); return openSheet(+open.dataset.open); }
    const go = e.target.closest('[data-go]'); if (go) setTab(go.dataset.go);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.task,.meal')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape') closeSheet();
  });

  /* ---------- body stats + settings ---------- */
  $('saveWeight').onclick = () => {
    const v = Number($('weightInput').value);
    if (!v || v < 30 || v > 200) return toast('Enter a valid weight in kg.');
    const k = todayKey(); data.weights = data.weights.filter((x) => x.date !== k); data.weights.push({ date: k, weight: v });
    data.weights.sort((a, b) => a.date.localeCompare(b.date)); save(); $('weightInput').value = ''; renderAll(); toast('Body stats updated.'); sfx('check');
  };
  $('saveWaist').onclick = () => {
    const v = Number($('waistInput').value);
    if (!v || v < 40 || v > 180) return toast('Enter a valid waist in cm.');
    const k = todayKey(); data.waists = data.waists.filter((x) => x.date !== k); data.waists.push({ date: k, waist: v }); data.waists.sort((a, b) => a.date.localeCompare(b.date));
    save(); $('waistInput').value = ''; renderAll(); toast('Waist measurement saved.'); sfx('check');
  };
  $('saveStart').onclick = () => { const v = Number($('startInput').value); if (!v || v < 30 || v > 200) return toast('Enter a valid start weight.'); data.start = v; save(); renderAll(); toast('Start weight updated.'); };
  $('saveGoal').onclick = () => { const v = Number($('goalInput').value); if (!v || v < 30 || v > 200 || v === Number(data.start)) return toast('Goal must differ from your start weight.'); data.goal = v; save(); renderAll(); toast('Goal updated.'); };
  $('saveCal').onclick = () => { const v = Number($('calInput').value); if (!v || v < 1500 || v > 5000) return toast('Enter a target between 1500 and 5000 kcal.'); data.calories = v; save(); renderAll(); toast('Calorie target updated.'); };
  $('saveProt').onclick = () => { const v = Number($('protInput').value); if (!v || v < 40 || v > 300) return toast('Enter a protein target between 40 and 300 g.'); data.protein = v; save(); renderAll(); toast('Protein target updated.'); };
  const toggleSound = () => { data.sound = !data.sound; save(); fillSettings(); if (data.sound) sfx('check'); };
  $('soundBtn').onclick = toggleSound; $('soundSw').onclick = toggleSound;
  $('vibeSw').onclick = () => { data.vibe = !data.vibe; save(); fillSettings(); vibe(30); };
  $('exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'hunter-system-backup.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Backup exported.');
  };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (!j || typeof j !== 'object' || typeof j.logs !== 'object') throw new Error('bad');
        if (!confirm('Replace the data on this device with the backup file?')) return;
        data = Object.assign({}, DEFAULTS, j); load_fix(); save(); previewKey = null; trainSig = ''; fillSettings(); renderAll(); toast('Backup imported.');
      } catch (err) { toast('That file is not a valid backup.'); }
    };
    r.readAsText(f); e.target.value = '';
  };
  function load_fix() { if (!Array.isArray(data.weights)) data.weights = []; if (!Array.isArray(data.waists)) data.waists = []; if (!data.logs) data.logs = {}; }
  $('resetBtn').onclick = () => {
    if (confirm('Clear all daily quest checkmarks and XP? Your weight history will be kept.')) { data.logs = {}; data.totalXP = 0; save(); trainSig = ''; renderAll(); toast('Daily quests reset.'); }
  };

  /* ---------- install (PWA) ---------- */
  const standalone = () => (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (!standalone()) $('installBtn').classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; $('installBtn').classList.add('hidden'); toast('Hunter System installed ✓'); });
  $('installBtn').onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); try { await deferredPrompt.userChoice; } catch (e) { /* noop */ } deferredPrompt = null; $('installBtn').classList.add('hidden'); };
  if (!standalone()) $('installNote').innerHTML += '<br><br><b style="color:var(--cyan)">Install as an app:</b> in Chrome tap the ⋮ menu, then “Install app” (or “Add to Home screen”).';

  /* ---------- exercise system: modes, library, swap, plan editing, balance, warm-up, offline ---------- */
  let exCtx = null, warmSig = '', libT = 0;
  const lib = { mode: 'browse', idx: -1, limit: 40, built: false, target: '' };

  function renderModeBar() {
    const m = modeKey();
    document.querySelectorAll('#modeBar button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    $('modeDesc').textContent = E.MODES[m].desc + ' The target muscles stay the same in every mode.';
    $('benchRow').classList.toggle('hidden', m !== 'homegym');
    $('benchSw').classList.toggle('on', !!data.bench);
  }
  const thumb = (ex, px) => (ex.m ? `<img src="media/i/${ex.m}.jpg" alt="" loading="lazy" width="${px}" height="${px}">` : ex.g ? `<span class="wu-em" data-gfig="${esc(ex.g)}"></span>` : '<span class="wu-em">🏠</span>');
  const mountMini = (root) => root.querySelectorAll('[data-gfig]').forEach((el) => H.mountFig(el, el.dataset.gfig, false));
  const exRow = (ex, meta) => `<button class="wu-item" data-ex="${esc(ex.i)}">${thumb(ex, 48)}<span><b>${esc(E.cap(ex.n))}</b><small>${esc(meta)}</small></span></button>`;
  function renderWarm(info) {
    const box = $('warmBox');
    if (!info.w) { box.innerHTML = ''; warmSig = ''; return; }
    const exs = info.items.filter((i) => i.ex), targets = [...new Set(exs.map((i) => i.target))];
    const sig = info.key + '|' + modeKey() + '|' + (data.bench ? 1 : 0) + '|' + targets.join(',') + '|' + (exs[0] ? exs[0].exId : '');
    if (sig === warmSig) return;
    warmSig = sig;
    const seed = Math.floor(info.d.getTime() / 864e5), m = modeKey(), w = E.warmup(targets, m, eopt(), seed), c = E.cooldown(targets, m, eopt(), seed);
    const first = exs[0];
    box.innerHTML = `<details class="panel wu"><summary>🔥 WARM-UP <small>· 6–8 MIN</small></summary><div class="wu-body">
        <div class="wu-h">1 · RAISE YOUR PULSE</div>${w.general.map((x) => exRow(x, '2–3 minutes, easy pace')).join('') || '<p class="notice">March in place for 2–3 minutes.</p>'}
        <div class="wu-h">2 · LOOSEN UP</div>${w.mobility.map((x) => exRow(x, '30 seconds or 10 slow reps')).join('')}
        ${first ? `<div class="wu-h">3 · RAMP UP</div><p class="notice" style="margin:8px 0 0">Before your first exercise (${esc(first.name)}), do 1–2 light sets of 5–8 easy reps at about half, then 70%, of your working weight.</p>` : ''}
      </div></details>
      <details class="panel wu"><summary>🧘 COOL-DOWN <small>· STRETCH</small></summary><div class="wu-body">
        <p class="notice" style="margin:0">Hold each stretch about 30 seconds and breathe slowly. Never push into pain.</p>
        ${c.map((x) => exRow(x, 'Hold 30 seconds · ' + x.t)).join('') || '<p class="notice">Walk slowly for a few minutes.</p>'}
      </div></details>`;
    mountMini(box);
  }

  /* ----- plan editing ----- */
  function planEdit(op, i) {
    const d = activeDate(), dow = d.getDay(), key = dateKey(d), n = planFor(dow).length;
    const remap = (f) => {
      const l = data.logs[key]; if (!l) return;
      ['checks', 'sets', 'ex'].forEach((b) => {
        if (!l[b]) return; const nb = {};
        Object.keys(l[b]).forEach((k) => { if (k[0] !== 'w') { nb[k] = l[b][k]; return; } const j = f(+k.slice(1)); if (j >= 0) nb['w' + j] = l[b][k]; });
        l[b] = nb;
      });
    };
    if (op === 'up' || op === 'down') {
      const j = op === 'up' ? i - 1 : i + 1; if (j < 0 || j >= n) return;
      remap((k) => (k === i ? j : k === j ? i : k));
      editPlan(dow, (a) => { const t = a[i]; a[i] = a[j]; a[j] = t; });
    } else if (op === 'sm' || op === 'sp') {
      editPlan(dow, (a) => { const en = a[i]; if (en && en.kind !== 'rest') en.sets = Math.max(1, Math.min(10, en.sets + (op === 'sp' ? 1 : -1))); });
    } else if (op === 'reps') {
      const en = planFor(dow)[i]; if (!en || en.kind === 'rest') return;
      const v = prompt('Reps or time (for example 8–12 or 30 seconds):', en.reps); if (v === null) return;
      const t = v.trim().slice(0, 28); if (!t) return;
      editPlan(dow, (a) => { a[i].reps = t; });
    } else if (op === 'del') {
      if (n <= 1) return toast('Keep at least one item in the day.');
      remap((k) => (k === i ? -1 : k > i ? k - 1 : k));
      editPlan(dow, (a) => { a.splice(i, 1); });
    }
  }
  function addToDay(id) {
    const ex = E.byId(id); if (!ex) return;
    const dow = activeDate().getDay(), m = modeKey();
    editPlan(dow, (arr) => { arr.push({ k: null, t: ex.t, l: E.cap(ex.n), sets: 3, reps: '8–12', pk: { [m]: id }, like: id }); });
    closeLib(); setTab('train'); toast('Added to ' + DAYS[dow] + '.'); sfx('check');
  }
  function applySwap(idx, id) {
    const dow = activeDate().getDay(), m = modeKey();
    editPlan(dow, (arr) => { const en = arr[idx]; if (!en || en.kind === 'rest') return; en.pk = en.pk || {}; en.pk[m] = id; if (!en.k) en.like = id; });
    closeLib(); toast('Exercise swapped.'); sfx('check');
  }

  /* ----- library + exercise view ----- */
  function buildLibFilters() {
    const uniq = (f) => [...new Set(E.LIB.map(f))].sort();
    const opts = (arr, all, lab) => `<option value="">${all}</option>` + arr.map((v) => `<option value="${esc(v)}">${esc(lab ? lab(v) : E.cap(v))}</option>`).join('');
    $('libTarget').innerHTML = opts(uniq((x) => x.t), 'All muscles');
    $('libBody').innerHTML = opts(uniq((x) => x.b), 'All body parts');
    $('libEq').innerHTML = opts(uniq((x) => x.e), 'All equipment', (v) => E.eqLabel(v));
  }
  function libResults() {
    const swap = lib.mode === 'swap';
    return E.candidates({ q: $('libQ').value, target: swap ? lib.target : $('libTarget').value, body: $('libBody').value, eq: $('libEq').value, kind: swap ? 'strength' : ($('libKind').value || 'strength'), mode: modeKey(), opt: eopt(), any: lib.mode === 'browse' && $('libAny').checked });
  }
  function renderLib() {
    const all = libResults(), m = modeKey();
    $('libCount').textContent = `${all.length} exercise${all.length === 1 ? '' : 's'}`;
    $('libList').innerHTML = all.slice(0, lib.limit).map((x) => {
      const ok = E.avail(x, m, eopt());
      return `<button class="lib-item" data-ex="${esc(x.i)}">${thumb(x, 56)}<span class="li"><b>${esc(E.cap(x.n))}</b><span class="chips"><span class="chip">${esc(x.t.toUpperCase())}</span><span class="chip">${esc(E.eqLabel(x.e))}</span>${ok ? '' : '<span class="chip warn">OTHER MODE</span>'}</span></span></button>`;
    }).join('') || '<div class="empty">No exercises match. Try fewer filters.</div>';
    mountMini($('libList'));
    $('libMore').classList.toggle('hidden', all.length <= lib.limit);
  }
  function openLib(o) {
    lib.mode = o.mode || 'browse'; lib.idx = o.idx == null ? -1 : o.idx; lib.limit = 40;
    if (!lib.built) { buildLibFilters(); lib.built = true; }
    const swap = lib.mode === 'swap', add = lib.mode === 'add', mn = E.MODES[modeKey()].long;
    if (swap) { const en = dayInfo(activeDate()).entries[lib.idx]; lib.target = en ? en.t : ''; }
    $('libTitle').textContent = swap ? '⇄ SWAP EXERCISE' : add ? '＋ ADD EXERCISE' : '📚 EXERCISE LIBRARY';
    $('libSub').textContent = swap ? `Same muscle (${lib.target}) · ${mn} mode` : `${mn} mode · tap an exercise for the demo`;
    $('libQ').value = ''; $('libKind').value = 'strength'; $('libBody').value = ''; $('libEq').value = ''; $('libAny').checked = false;
    $('libTarget').value = swap ? lib.target : ''; $('libTarget').disabled = swap; $('libKind').disabled = swap || add;
    $('libAnyRow').classList.toggle('hidden', lib.mode !== 'browse');
    renderLib(); $('lib').classList.add('open'); $('lib').scrollTop = 0;
  }
  function closeLib() { $('lib').classList.remove('open'); closeEx(); }
  function openEx(id, mode) {
    const x = E.byId(id); if (!x) return;
    const kind = E.kindOf(x), strength = kind === 'strength', dn = DAYS[activeDate().getDay()];
    exCtx = { id, mode };
    const modes = E.MODE_KEYS.map((k) => `<span class="chip ${E.avail(x, k, eopt()) ? 'xp' : 'off'}">${E.MODES[k].name}</span>`).join('');
    const acts = mode === 'swap' ? '<button class="btn primary" style="flex:1" id="exUse">USE THIS EXERCISE</button>'
      : strength && mode !== 'view' ? `<button class="btn primary" style="flex:1" id="exAdd">＋ ADD TO ${esc(dn.toUpperCase())}</button>` : '';
    $('exvCard').innerHTML = `<div class="grab"></div><div class="figbox big ${x.m ? 'gif' : x.g ? '' : 'emoji'}" id="exFig"></div>
      <h3>${esc(E.cap(x.n))}</h3>
      <div class="chips"><span class="chip">${esc(x.t.toUpperCase())}</span><span class="chip">${esc(E.eqLabel(x.e))}</span><span class="chip">${esc(kind.toUpperCase())}</span></div>
      ${x.s.length ? `<p class="notice" style="margin:8px 0 0">Also works: ${esc(x.s.join(', '))}</p>` : ''}
      <div class="label" style="margin-top:12px">AVAILABLE IN</div><div class="chips" style="margin-top:6px">${modes}</div>
      <ul class="cues">${x.p.map((c, k) => `<li><b>${k + 1}</b><span>${esc(c)}</span></li>`).join('')}</ul>
      ${x.m ? '<div class="credit">© Gym visual — https://gymvisual.com/</div>' : ''}
      <div class="btn-row">${acts}<button class="btn" id="exClose">CLOSE</button></div>`;
    demoInto($('exFig'), { ex: x, name: E.cap(x.n) });
    $('exv').classList.add('open'); $('exvCard').scrollTop = 0;
  }
  function closeEx() { $('exv').classList.remove('open'); exCtx = null; }

  /* ----- muscle balance ----- */
  function weeklyVolume() {
    const acc = {}, now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const l = data.logs[dateKey(d)]; if (!l || !l.checks) continue;
      const info = dayInfo(d);
      Object.keys(l.checks).forEach((id) => {
        if (!l.checks[id] || id[0] !== 'w') return;
        const idx = +id.slice(1), it = info.items[idx], exId = l.ex && l.ex[id], ex = exId ? E.byId(exId) : it && it.ex;
        if (ex) E.addVolume(acc, ex, (l.sets && l.sets[id]) || (it ? it.sets : 3));
      });
    }
    return acc;
  }
  function renderBalance() {
    const v = weeklyVolume(), rows = E.TRACKED.map(([t, lab]) => ({ t, lab, s: v[t] || 0 })), sum = rows.reduce((a, r) => a + r.s, 0);
    $('balance').innerHTML = rows.map((r) => `<div class="bal ${r.s >= 10 ? 'good' : r.s >= 4 ? 'ok' : 'low'}"><span class="bl">${r.lab}</span><div class="bar"><div style="width:${Math.min(100, (r.s / 12) * 100)}%"></div></div><span class="bn">${fmt(r.s, 1)}</span></div>`).join('');
    const low = rows.slice().sort((a, b) => a.s - b.s)[0], tip = $('balanceTip');
    if (!sum) { tip.textContent = 'Finish a few exercises and your weekly balance appears here.'; return; }
    if (low.s >= 10) { tip.textContent = 'Balanced week. Every muscle has solid volume.'; return; }
    const sug = E.candidates({ target: low.t, mode: modeKey(), opt: eopt() })[0];
    tip.innerHTML = `${esc(low.lab)} is your lowest muscle this week (${fmt(low.s, 1)} sets).${sug ? ` <button class="btn" style="margin-top:8px" data-addbal="${esc(sug.i)}">＋ ADD ${esc(E.cap(sug.n).toUpperCase())} TO TODAY</button>` : ''}`;
  }

  /* ----- offline library ----- */
  const MEDIA_CACHE = 'hunter-media-v1';
  const mediaUrls = () => { const u = []; E.LIB.forEach((x) => { if (x.m) u.push('media/i/' + x.m + '.jpg', 'media/g/' + x.m + '.gif'); }); return u; };
  async function refreshOffline() {
    const el = $('dlStatus'); if (!el) return;
    if (!('caches' in window)) { el.textContent = 'Offline storage is not supported in this browser.'; return; }
    try {
      const c = await caches.open(MEDIA_CACHE), n = (await c.keys()).length, t = mediaUrls().length;
      $('dlBar').style.width = Math.min(100, (n / t) * 100) + '%';
      el.textContent = n >= t ? `All ${t.toLocaleString()} demo files are saved on this phone. Works offline.` : `${n.toLocaleString()} of ${t.toLocaleString()} demo files saved for offline use.`;
      $('dlBtn').textContent = n >= t ? '✓ SAVED OFFLINE' : '⇩ SAVE ALL FOR OFFLINE';
    } catch (e) { el.textContent = 'Offline storage is not available here.'; }
  }
  let dlBusy = false;
  async function downloadAll() {
    if (dlBusy) return;
    if (!('caches' in window)) return toast('Offline storage is not supported here.');
    dlBusy = true; $('dlBtn').disabled = true;
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      const c = await caches.open(MEDIA_CACHE), urls = mediaUrls(); let done = 0, fail = 0;
      for (let i = 0; i < urls.length; i += 6) {
        await Promise.all(urls.slice(i, i + 6).map(async (u) => {
          try { if (!(await c.match(u))) { const r = await fetch(u); if (!r.ok) throw new Error('http'); await c.put(u, r); } done++; } catch (e) { fail++; }
        }));
        $('dlBar').style.width = ((done + fail) / urls.length) * 100 + '%';
        $('dlStatus').textContent = `Saving… ${(done + fail).toLocaleString()} / ${urls.length.toLocaleString()}`;
      }
      toast(fail ? fail + ' files failed. Tap again to retry.' : 'Everything is saved for offline use ✓');
    } catch (e) { toast('Storage is full or blocked. Free some space and retry.'); }
    dlBusy = false; $('dlBtn').disabled = false; refreshOffline();
  }

  /* ----- wiring ----- */
  $('modeBar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !E.MODES[b.dataset.mode]) return;
    data.mode = b.dataset.mode; save(); trainSig = ''; warmSig = ''; renderAll(); sfx('set');
    toast(E.MODES[data.mode].name + ' mode: same muscles, matching exercises.');
  });
  $('benchSw').onclick = () => { data.bench = !data.bench; save(); trainSig = ''; warmSig = ''; renderAll(); sfx('set'); };
  $('editPlan').onclick = () => { editing = !editing; trainSig = ''; renderAll(); };
  $('addEx').onclick = () => openLib({ mode: 'add' });
  $('openLib').onclick = () => openLib({ mode: 'browse' });
  $('resetDay').onclick = () => {
    const dow = activeDate().getDay();
    if (!data.plan || !data.plan[dow]) return toast('This day already uses the default plan.');
    if (!confirm('Reset ' + DAYS[dow] + ' to the default plan?')) return;
    delete data.plan[dow]; if (!Object.keys(data.plan).length) data.plan = null;
    save(); trainSig = ''; warmSig = ''; renderAll(); toast('Day reset.');
  };
  $('libClose').onclick = closeLib;
  $('libMore').onclick = () => { lib.limit += 40; renderLib(); };
  ['libKind', 'libTarget', 'libBody', 'libEq', 'libAny'].forEach((id) => $(id).addEventListener('change', () => { lib.limit = 40; renderLib(); }));
  $('libQ').addEventListener('input', () => { clearTimeout(libT); libT = setTimeout(() => { lib.limit = 40; renderLib(); }, 160); });
  $('libList').addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) openEx(b.dataset.ex, lib.mode); });
  $('warmBox').addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) openEx(b.dataset.ex, 'view'); });
  $('exv').addEventListener('click', (e) => {
    if (e.target === $('exv')) return closeEx();
    const b = e.target.closest('button'); if (!b || !exCtx) return;
    if (b.id === 'exClose') closeEx(); else if (b.id === 'exAdd') addToDay(exCtx.id); else if (b.id === 'exUse') applySwap(lib.idx, exCtx.id);
  });
  $('balanceTip').addEventListener('click', (e) => { const b = e.target.closest('[data-addbal]'); if (b) addToDay(b.dataset.addbal); });
  $('dlBtn').onclick = downloadAll;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('exv').classList.contains('open')) closeEx(); else if ($('lib').classList.contains('open')) closeLib();
  });

  /* ---------- guided session (playlist): warm-up, sets and rests in sequence, then cool-down ---------- */
  const play = { steps: [], order: [], i: 0, t0: 0, end: 0, total: 0, iv: 0, fired: false, sets: 0, wake: null, open: false, holding: false };

  function sessionPlan(info) {
    const l = info.l, its = info.items;
    const got = (i) => (l.checks['w' + i] ? its[i].sets : l.sets['w' + i] || 0);
    const started = its.some((_, i) => l.checks['w' + i] || (l.sets['w' + i] || 0) > 0);
    const targets = [...new Set(its.filter((it) => it.ex).map((it) => it.target))];
    const seed = Math.floor(info.d.getTime() / 864e5), m = modeKey();
    return E.buildSession({ items: its, got, done: (i) => !!l.checks['w' + i], warm: E.warmup(targets, m, eopt(), seed), cool: E.cooldown(targets, m, eopt(), seed), fresh: !started });
  }
  function renderSessionCard(info) {
    const card = $('sessionCard'), show = !!info.w && !editing;
    card.classList.toggle('hidden', !show); if (!show) return;
    const S = sessionPlan(info), btn = $('startSession');
    if (!S.length) { $('sessionSub').textContent = 'Every exercise is done for today. Great work.'; btn.textContent = '✓ ALL EXERCISES DONE'; btn.disabled = true; return; }
    const sets = S.filter((s) => s.t === 'set').length, exn = new Set(S.filter((s) => s.t === 'set').map((s) => s.i)).size;
    const started = info.items.some((_, i) => info.l.checks['w' + i] || (info.l.sets['w' + i] || 0) > 0);
    $('sessionSub').textContent = `${exn} exercise${exn === 1 ? '' : 's'} · ${sets} sets · about ${E.estimateMin(S)} min${started ? ' left' : ', warm-up and cool-down included'}`;
    btn.textContent = started ? '▶ RESUME SESSION' : '▶ START SESSION'; btn.disabled = false;
  }

  const ringHTML = '<div class="pring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" id="pFg" cx="50" cy="50" r="44"/></svg><div class="pt" id="pTxt"></div></div>';
  const repsText = (r) => (/\d$/.test(String(r)) ? r + ' reps' : String(r));
  const credit = (ex) => (ex && ex.m ? '<div class="credit">© Gym visual — https://gymvisual.com/</div>' : '');
  const stepList = (ex) => `<details class="how-to"><summary>HOW TO DO IT</summary><ul class="cues">${ex.p.map((c, k) => `<li><b>${k + 1}</b><span>${esc(c)}</span></li>`).join('')}</ul></details>`;

  function openPlay() {
    const S = sessionPlan(dayInfo(activeDate()));
    if (!S.length) return toast('Every exercise is done for today.');
    play.steps = S; play.order = []; S.forEach((s) => { if (s.t === 'set' && !play.order.includes(s.i)) play.order.push(s.i); });
    play.i = 0; play.t0 = Date.now(); play.sets = 0; play.open = true; play.holding = false;
    $('play').classList.add('open');
    try { history.pushState({ play: 1 }, ''); } catch (e) { /* noop */ }
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { play.wake = w; }).catch(() => {});
    clearInterval(play.iv); play.iv = setInterval(playTick, 250);
    renderPlay();
  }
  function closePlay(fromPop) {
    clearInterval(play.iv); play.end = 0; play.open = false;
    $('play').classList.remove('open');
    if (play.wake) { try { play.wake.release(); } catch (e) { /* noop */ } play.wake = null; }
    if (!fromPop && history.state && history.state.play) history.back();
    renderAll();
  }
  function startCountdown(secs) { play.total = secs; play.end = Date.now() + secs * 1000; play.fired = false; playTick(); }
  function playTick() {
    $('playClock').textContent = fmtT(Math.floor((Date.now() - play.t0) / 1000));
    if (!play.end) return;
    const left = Math.max(0, Math.ceil((play.end - Date.now()) / 1000)), fg = $('pFg'), tx = $('pTxt');
    if (tx) tx.textContent = fmtT(left);
    if (fg) fg.style.strokeDashoffset = String(276.46 * (1 - left / play.total));
    if (left === 0 && !play.fired) { play.fired = true; play.end = 0; sfx('timer'); vibe([200, 100, 200]); onTimerEnd(); }
  }
  function onTimerEnd() {
    const st = play.steps[play.i];
    if (st.t === 'set') finishSet(st); else advance();
  }
  function advance() { play.holding = false; if (play.i < play.steps.length - 1) { play.i++; renderPlay(); } }
  function back() { play.holding = false; if (play.i > 0) { play.i--; renderPlay(); } }
  function skipGroup() {
    const st = play.steps[play.i], n = play.steps.length; let j = play.i + 1;
    if (st.t === 'warm') while (j < n && play.steps[j].t === 'warm') j++;
    else if (st.t === 'stretch') j = n - 1;
    else while (j < n && play.steps[j].i === st.i && play.steps[j].t !== 'stretch') j++;
    play.i = Math.min(j, n - 1); play.holding = false; renderPlay();
  }
  function finishSet(st) {
    const info = dayInfo(activeDate()), it = info.items[st.i], l = logFor(info.key), id = 'w' + st.i;
    if (!it) return advance();
    play.sets++;
    l.sets[id] = Math.max(l.sets[id] || 0, st.k);
    if (st.k >= it.sets && !l.checks[id]) { save(); setCheck('work', id, true); } else { save(); renderAll(); sfx('set'); vibe(15); }
    advance();
  }
  function playGo() {
    const st = play.steps[play.i];
    if (st.t === 'set') {
      if (st.hold && !play.holding) { play.holding = true; $('playGo').disabled = true; $('playGo').textContent = 'HOLDING…'; startCountdown(st.hold); return; }
      return finishSet(st);
    }
    if (st.t === 'end') return closePlay();
    advance();
  }

  function renderPlay() {
    const st = play.steps[play.i], n = play.steps.length, info = dayInfo(activeDate()), body = $('playBody');
    const go = $('playGo'), skip = $('playSkip'), plus = $('playPlus'), grp = $('playGroup');
    play.end = 0; play.fired = false; play.holding = false;
    $('playBar').style.width = (n > 1 ? (play.i / (n - 1)) * 100 : 100) + '%';
    $('playPrev').classList.toggle('hidden', play.i === 0 || st.t === 'end');
    [skip, plus, grp].forEach((b) => b.classList.add('hidden')); go.disabled = false;
    const mname = E.MODES[modeKey()].name; let demo = null, after = null;
    if (st.t === 'intro') {
      const rows = play.order.map((i, k) => { const it = info.items[i]; return `<div class="intro-row"><b>${k + 1}</b><span><em>${esc(it.name)}</em><small>${it.sets} × ${esc(it.reps)} · ${esc(String(it.target).toUpperCase())}</small></span></div>`; }).join('');
      body.innerHTML = `<div class="play-phase">TODAY'S SESSION · ${esc(mname)}</div><h2>${esc(info.w ? info.w.title : 'SESSION')}</h2><p class="notice" style="text-align:center;margin:0 0 12px">${esc(info.w ? info.w.focus : '')} · about ${E.estimateMin(play.steps)} min</p>
        <div class="intro-list">${rows}</div>
        <div class="how"><b>HOW THIS SESSION WORKS</b><ul><li>Big compound lifts come first while you are fresh. Isolation work comes last.</li><li>Rest follows the exercise: about 2 minutes after heavy compounds, 1 minute after isolation, 45 seconds for abs and calves.</li><li>Stop every set 1–3 reps before failure. Add a rep or a little weight once a set feels easy.</li><li>Tap DONE SET after each set. Your ticks and XP update as you go.</li></ul></div>`;
      go.textContent = '▶ BEGIN';
    } else if (st.t === 'warm' || st.t === 'stretch') {
      const warm = st.t === 'warm';
      body.innerHTML = `<div class="play-phase">${warm ? '🔥 WARM-UP' : '🧘 COOL-DOWN'}</div><div class="figbox big" id="playFig"></div><h2>${esc(E.cap(st.ex.n))}</h2><p class="notice" style="text-align:center;margin:0">${esc(st.sub)}</p>${ringHTML}${credit(st.ex)}`;
      demo = { ex: st.ex, name: st.ex.n }; go.textContent = 'NEXT ▶'; grp.textContent = warm ? 'SKIP WARM-UP' : 'SKIP COOL-DOWN'; grp.classList.remove('hidden');
      after = () => startCountdown(st.secs);
    } else if (st.t === 'ramp') {
      const it = info.items[st.i];
      body.innerHTML = `<div class="play-phase">RAMP-UP SET</div><div class="figbox big" id="playFig"></div><h2>${esc(it.name)}</h2>
        <div class="play-reps">8 easy reps</div><p class="notice play-cue">One light set at about half of your working weight. It grooves the movement and warms the joints you are about to load.</p>${credit(it.ex)}`;
      demo = it; go.textContent = '✓ DONE';
    } else if (st.t === 'set') {
      const it = info.items[st.i], exNo = play.order.indexOf(st.i) + 1;
      body.innerHTML = `<div class="play-phase">EXERCISE ${exNo} / ${play.order.length} · ${esc(mname)}</div><div class="figbox big" id="playFig"></div><h2>${esc(it.name)}</h2>
        <div class="chips" style="justify-content:center"><span class="chip">${esc(String(it.target).toUpperCase())}</span>${it.eq ? `<span class="chip">${esc(it.eq)}</span>` : ''}</div>
        <div class="play-set">SET ${st.k} <small>OF ${st.of}</small></div><div class="play-reps">${esc(repsText(it.reps))}</div>${st.hold ? ringHTML : ''}
        <p class="notice play-cue">${esc(E.coachLine(it, st.k, st.of))}</p>${stepList(it.ex)}${credit(it.ex)}`;
      demo = it; go.textContent = st.hold ? '▶ START HOLD' : '✓ DONE SET'; skip.classList.remove('hidden'); grp.textContent = 'SKIP EXERCISE'; grp.classList.remove('hidden');
      if (st.hold) { const tx = $('pTxt'); if (tx) tx.textContent = fmtT(st.hold); }
    } else if (st.t === 'rest') {
      const nx = play.steps[play.i + 1] || { t: 'end' }; let nxEx = null, nxText = '', nxSub = '';
      if (nx.t === 'set') { const it = info.items[nx.i]; nxEx = it.ex; nxText = it.name; nxSub = st.kind === 'move' ? 'Next exercise · ' + it.sets + ' × ' + it.reps : `Set ${nx.k} of ${nx.of}`; }
      else if (nx.t === 'ramp') { const it = info.items[nx.i]; nxEx = it.ex; nxText = it.name; nxSub = 'Ramp-up set'; }
      else if (nx.t === 'stretch' || nx.t === 'warm') { nxEx = nx.ex; nxText = E.cap(nx.ex.n); nxSub = 'Cool-down starts next'; }
      const tip = st.kind === 'move' ? 'Set up your equipment for the next exercise.' : st.kind === 'ramp' ? 'Shake out your arms and get ready for the first working set.' : 'Breathe slowly. Shake out the working muscles. Sip some water.';
      body.innerHTML = `<div class="play-phase">${st.kind === 'move' ? 'SET UP' : 'REST'}</div>${ringHTML}<p class="notice" style="text-align:center;margin:8px 0 14px">${tip}</p>
        ${nxText ? `<div class="up-next"><div class="figbox" id="playNextFig"></div><div><small>UP NEXT</small><b>${esc(nxText)}</b><span>${esc(nxSub)}</span></div></div>` : ''}`;
      if (nxEx) demoInto($('playNextFig'), { ex: nxEx, name: nxText });
      go.textContent = 'SKIP REST ▶'; plus.classList.remove('hidden'); after = () => startCountdown(st.secs);
    } else {
      const vol = {}; info.items.forEach((it, i) => { if (info.l.checks['w' + i] && it.ex) E.addVolume(vol, it.ex, info.l.sets['w' + i] || it.sets); });
      const muscles = E.TRACKED.filter(([t]) => vol[t]).map(([t, lab]) => `<span class="chip xp">${lab.toUpperCase()} · ${fmt(vol[t], 1)}</span>`).join('');
      const done = info.items.filter((_, i) => info.l.checks['w' + i]).length;
      body.innerHTML = `<div class="play-phase">SESSION COMPLETE</div><div class="trophy">🏆</div><h2>Well done, Hunter</h2>
        <div class="sum"><div><b>${fmtT(Math.floor((Date.now() - play.t0) / 1000))}</b><small>TIME</small></div><div><b>${play.sets}</b><small>SETS LOGGED</small></div><div><b>${done}/${info.items.length}</b><small>EXERCISES DONE</small></div></div>
        ${muscles ? `<div class="label" style="margin-top:14px">MUSCLES TRAINED TODAY (SETS)</div><div class="chips" style="justify-content:center;margin-top:8px">${muscles}</div>` : ''}
        <p class="notice play-cue">Eat your post-workout meal within a couple of hours and protect your sleep tonight. That is when the muscle is built.</p>`;
      go.textContent = 'FINISH';
    }
    body.scrollTop = 0;
    if (demo) demoInto($('playFig'), demo);
    if (after) after();
    playTick();
  }

  $('startSession').onclick = openPlay;
  $('playClose').onclick = () => { if (confirm('End the session? Everything you finished is already saved.')) closePlay(); };
  $('playGo').onclick = playGo;
  $('playPrev').onclick = back;
  $('playSkip').onclick = advance;
  $('playGroup').onclick = skipGroup;
  $('playPlus').onclick = () => { if (play.end) { play.end += 30000; play.total += 30; playTick(); } };
  window.addEventListener('popstate', () => { if (play.open) closePlay(true); });
  document.addEventListener('visibilitychange', () => { if (play.open) playTick(); });

  /* ---------- progress photos (stored on this device in IndexedDB) ---------- */
  const POSES = ['front', 'side', 'back'];
  let pdb = null, photos = [], photoUrls = {}, ppose = 'front', cmpPose = 'front', cmpMode = 'side', cmpA = null, cmpB = null, viewId = null;
  const DAY_MS = 864e5;
  const photoDow = () => (photos.length ? parseKey(photos[0].date).getDay() : 0); // weekly check-in falls on the weekday of the first photos
  const weekNo = (date) => (photos.length ? Math.max(0, Math.floor((parseKey(date) - parseKey(photos[0].date)) / DAY_MS / 7)) : 0);
  const shortDate = (k) => parseKey(k).toLocaleDateString([], { day: 'numeric', month: 'short' });
  const dayLbl = (k) => (weekNo(k) === 0 ? 'START' : 'WEEK ' + weekNo(k)) + ' · ' + shortDate(k);
  const purl = (p) => { const k = p.id + '|' + p.ts; return photoUrls[k] || (photoUrls[k] = URL.createObjectURL(p.blob)); };

  function openPhotoDB() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no indexedDB'));
      const q = indexedDB.open('hunter-photos', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('photos', { keyPath: 'id' });
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
  function pTx(mode, fn) {
    if (!pdb) return Promise.reject(new Error('no db'));
    return new Promise((res, rej) => {
      const t = pdb.transaction('photos', mode); let r;
      try { r = fn(t.objectStore('photos')); } catch (e) { return rej(e); }
      t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  async function refreshPhotos() {
    Object.values(photoUrls).forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* noop */ } }); photoUrls = {};
    const all = (await pTx('readonly', (s) => s.getAll())) || [];
    photos = all.filter((p) => p && p.blob && POSES.includes(p.pose) && /^\d{4}-\d\d-\d\d$/.test(p.date))
      .sort((a, b) => a.date.localeCompare(b.date) || POSES.indexOf(a.pose) - POSES.indexOf(b.pose));
    renderPhotos();
  }
  async function initPhotos() {
    try { pdb = await openPhotoDB(); await refreshPhotos(); }
    catch (e) { pdb = null; $('photoStatus').textContent = 'Photo storage is not available in this browser (private browsing blocks it).'; }
  }

  // downscale + re-encode so each photo is ~150-300 KB instead of several MB
  function shrink(file, max = 1200, q = 0.82) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc), c = document.createElement('canvas');
        c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('not an image')); };
      img.src = url;
    });
  }
  async function addPhoto(file) {
    if (!file) return;
    if (!pdb) return toast('Photo storage is not available in this browser.');
    try {
      const blob = await shrink(file), date = todayKey(), firstToday = !photos.some((p) => p.date === date);
      await pTx('readwrite', (s) => s.put({ id: date + '|' + ppose, date, pose: ppose, weight: curWeight(), blob, ts: Date.now() }));
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      await refreshPhotos();
      if (firstToday) { data.totalXP = (data.totalXP || 0) + 30; save(); renderAll(); toast(ppose.toUpperCase() + ' photo saved · +30 XP'); } else toast(ppose.toUpperCase() + ' photo saved.');
      sfx('check'); vibe(18);
    } catch (e) { toast('Could not read that photo. Try another one.'); }
  }

  function renderPhotos() {
    const today = todayKey(), has = photos.length > 0, last = has ? photos[photos.length - 1].date : null;
    const since = last ? Math.round((parseKey(today) - parseKey(last)) / DAY_MS) : null, due = !has || since >= 7;
    const missing = POSES.filter((po) => !photos.some((p) => p.date === today && p.pose === po));
    $('photoTag').textContent = !has ? 'NO PHOTOS YET' : weekNo(last) === 0 ? 'START' : 'WEEK ' + weekNo(last);
    $('photoStatus').textContent = !has ? 'Take your START photos today: front, side and back. This is your "before".'
      : since === 0 ? (missing.length ? 'Saved today. Still missing: ' + missing.join(', ') + '.' : 'All 3 poses saved today. See you next week.')
      : since >= 7 ? 'Weekly check-in due. Same spot, same light.' : `Next check-in in ${7 - since} day${7 - since === 1 ? '' : 's'}.`;
    $('photoDue').classList.toggle('hidden', !due);
    $('photoDueTxt').textContent = !has ? 'Take your START photos to track your transformation.' : `It has been ${since} days. Take this week's progress photos.`;
    document.querySelectorAll('#poseRow button').forEach((b) => { b.classList.toggle('active', b.dataset.pose === ppose); b.classList.toggle('done', photos.some((p) => p.date === today && p.pose === b.dataset.pose)); });
    renderCompare(); renderTimeline();
  }

  function renderCompare() {
    document.querySelectorAll('#cmpPoseRow button').forEach((b) => b.classList.toggle('active', b.dataset.pose === cmpPose));
    document.querySelectorAll('#cmpModeRow button').forEach((b) => b.classList.toggle('active', b.dataset.mode === cmpMode));
    const box = $('cmpBody'), list = photos.filter((p) => p.pose === cmpPose);
    if (list.length < 2) { box.innerHTML = `<div class="empty">Take at least two check-ins of the same pose to compare. You have ${list.length} ${cmpPose} photo${list.length === 1 ? '' : 's'}.</div>`; return; }
    if (!list.some((p) => p.id === cmpA)) cmpA = list[0].id;
    if (!list.some((p) => p.id === cmpB)) cmpB = list[list.length - 1].id;
    const A = list.find((p) => p.id === cmpA), B = list.find((p) => p.id === cmpB);
    const opts = (sel) => list.map((p) => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(dayLbl(p.date))}</option>`).join('');
    const days = Math.round((parseKey(B.date) - parseKey(A.date)) / DAY_MS), dw = Number(B.weight) - Number(A.weight);
    const delta = A.id === B.id ? 'Pick two different check-ins.' : `${Math.abs(days)} days apart · weight ${dw > 0 ? '+' : ''}${fmt(dw)} kg`;
    const view = cmpMode === 'slide'
      ? `<div class="cmp-slide"><img src="${purl(B)}" alt="After"><img class="a" id="cmpClip" src="${purl(A)}" alt="Before" style="clip-path:inset(0 50% 0 0)"><div class="cmp-line" id="cmpLine" style="left:50%"></div><span class="cmp-tag l">BEFORE</span><span class="cmp-tag r">AFTER</span></div><input class="cmp-range" id="cmpRange" type="range" min="0" max="100" value="50" aria-label="Before and after slider">`
      : `<div class="cmp-side"><figure><img src="${purl(A)}" alt="Before"><figcaption>BEFORE · ${esc(fmt(A.weight))} kg</figcaption></figure><figure><img src="${purl(B)}" alt="After"><figcaption>AFTER · ${esc(fmt(B.weight))} kg</figcaption></figure></div>`;
    box.innerHTML = `<div class="input-row"><label>Before</label><select class="pselect" id="cmpSelA">${opts(cmpA)}</select></div><div class="input-row"><label>After</label><select class="pselect" id="cmpSelB">${opts(cmpB)}</select></div>${view}<p class="notice" style="text-align:center;margin:10px 0 0">${esc(delta)}</p>`;
    const rg = $('cmpRange');
    if (rg) rg.oninput = (e) => { const v = e.target.value; $('cmpClip').style.clipPath = `inset(0 ${100 - v}% 0 0)`; $('cmpLine').style.left = v + '%'; };
  }

  function renderTimeline() {
    const box = $('photoTimeline');
    if (!photos.length) { box.innerHTML = '<div class="empty">Your check-ins will appear here.</div>'; return; }
    const dates = [...new Set(photos.map((p) => p.date))].reverse();
    box.innerHTML = dates.map((d) => {
      const ps = photos.filter((p) => p.date === d);
      const thumbs = POSES.map((po) => { const p = ps.find((x) => x.pose === po); return p ? `<button data-photo="${esc(p.id)}" aria-label="${po} photo"><img alt="${po}" src="${purl(p)}"><span>${po.toUpperCase()}</span></button>` : '<div></div>'; }).join('');
      return `<div class="tl-day"><div class="tl-head"><strong>${esc(dayLbl(d))}</strong><span>${esc(fmt(ps[0].weight))} kg</span></div><div class="tl-thumbs">${thumbs}</div></div>`;
    }).join('');
  }

  function openPhoto(id) {
    const p = photos.find((x) => x.id === id); if (!p) return;
    viewId = id; $('pvImg').src = purl(p);
    $('pvCap').textContent = `${p.pose.toUpperCase()} · ${dayLbl(p.date)} · ${fmt(p.weight)} kg`; $('pview').classList.add('open');
  }
  function closePhoto() { $('pview').classList.remove('open'); $('pvImg').removeAttribute('src'); viewId = null; }

  $('poseRow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ppose = b.dataset.pose; renderPhotos(); sfx('set'); } });
  $('cmpPoseRow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { cmpPose = b.dataset.pose; cmpA = cmpB = null; renderCompare(); sfx('set'); } });
  $('cmpModeRow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { cmpMode = b.dataset.mode; renderCompare(); sfx('set'); } });
  $('cmpBody').addEventListener('change', (e) => { if (e.target.id === 'cmpSelA') cmpA = e.target.value; else if (e.target.id === 'cmpSelB') cmpB = e.target.value; else return; renderCompare(); });
  $('photoTimeline').addEventListener('click', (e) => { const b = e.target.closest('[data-photo]'); if (b) openPhoto(b.dataset.photo); });
  $('photoTake').onclick = () => $('photoCam').click();
  $('photoUpload').onclick = () => $('photoFile').click();
  $('photoCam').onchange = (e) => { addPhoto(e.target.files[0]); e.target.value = ''; };
  $('photoFile').onchange = (e) => { addPhoto(e.target.files[0]); e.target.value = ''; };
  $('pvClose').onclick = closePhoto;
  $('pview').addEventListener('click', (e) => { if (e.target === $('pview')) closePhoto(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePhoto(); });
  $('pvDel').onclick = async () => {
    if (!viewId || !confirm('Delete this photo? This cannot be undone.')) return;
    try { await pTx('readwrite', (s) => s.delete(viewId)); closePhoto(); await refreshPhotos(); toast('Photo deleted.'); } catch (e) { toast('Could not delete the photo.'); }
  };

  const blobToData = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  $('photoExport').onclick = async () => {
    if (!photos.length) return toast('No photos to back up yet.');
    try {
      const items = [];
      for (const p of photos) items.push({ id: p.id, date: p.date, pose: p.pose, weight: p.weight, ts: p.ts, data: await blobToData(p.blob) });
      const blob = new Blob([JSON.stringify({ type: 'hunter-photos', v: 1, photos: items })], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'hunter-photos-backup.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Photo backup exported.');
    } catch (e) { toast('Backup failed.'); }
  };
  $('photoImport').onclick = () => $('photoImportFile').click();
  $('photoImportFile').onchange = (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!pdb) return toast('Photo storage is not available in this browser.');
    const r = new FileReader();
    r.onload = async () => {
      try {
        const j = JSON.parse(r.result);
        if (!j || j.type !== 'hunter-photos' || !Array.isArray(j.photos)) throw new Error('bad');
        if (!confirm('Add the photos from this backup to this device? Same date and pose will be replaced.')) return;
        let n = 0;
        for (const it of j.photos) {
          if (!it || !POSES.includes(it.pose) || !/^\d{4}-\d\d-\d\d$/.test(it.date) || typeof it.data !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(it.data)) continue;
          const blob = await (await fetch(it.data)).blob();
          await pTx('readwrite', (s) => s.put({ id: it.date + '|' + it.pose, date: it.date, pose: it.pose, weight: Number(it.weight) || curWeight(), blob, ts: Number(it.ts) || Date.now() })); n++;
        }
        await refreshPhotos(); toast(n + ' photo' + (n === 1 ? '' : 's') + ' restored.');
      } catch (err) { toast('That file is not a valid photo backup.'); }
    };
    r.readAsText(f);
  };

  /* ---------- reminders ---------- */
  const REM_DEFAULT = { on: false, meals: true, workout: true, water: true, weigh: true, sleep: true, photo: true, photoTime: '08:00', workoutTime: '18:15', sleepTime: '22:30', weighTime: '07:00', waterTimes: ['11:00', '15:00', '18:30', '21:00'] };
  const CATCHUP = 20; // minutes: still fire if the app wakes up shortly after the time
  const rem = () => Object.assign({}, REM_DEFAULT, data.rem || {});
  const setRem = (k, v) => { data.rem = Object.assign(rem(), { [k]: v }); save(); fillRem(); };
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s/])\w/g, (c) => c.toUpperCase());
  const hasNotif = () => 'Notification' in window;
  const permOk = () => hasNotif() && Notification.permission === 'granted';

  // everything that should ping on a given date; done() lets us skip things already completed
  function schedule(d) {
    const r = rem(), dow = d.getDay(), di = dayInfo(d), w = di.w, out = [];
    if (r.meals) H.MEALS.forEach((m, i) => {
      if (m.optional) return;
      out.push({ id: 'm' + i, time: m.time, tab: 'fuel', title: `${m.icon} ${titleCase(m.name)}`, body: `${m.kcal} kcal · ${m.protein} g protein. ${m.items.slice(0, 3).join(', ')}`, done: (l) => !!l.meals['m' + i] });
    });
    if (r.workout && w) out.push({ id: 'wk', time: r.workoutTime, tab: 'train', title: '🏋️ Training time', body: `${titleCase(w.title)}: ${w.focus}`, done: (l) => di.items.every((_, i) => l.checks['w' + i]) });
    if (r.water) r.waterTimes.forEach((t, i) => out.push({ id: 'w' + i, time: t, tab: 'fuel', title: '💧 Drink water', body: `Aim for ${2 * (i + 1)}+ glasses by now.`, done: (l) => (l.water || 0) >= 2 * (i + 1) }));
    if (r.weigh) out.push({ id: 'wt', time: r.weighTime, tab: 'stats', title: '⚖️ Morning weigh-in', body: 'After the toilet, before breakfast.', done: () => data.weights.some((x) => x.date === dateKey(d)) });
    if (r.photo && dow === photoDow()) out.push({ id: 'ph', time: r.photoTime, tab: 'photos', title: '📸 Progress photos', body: 'Weekly check-in: front, side and back. Same spot, same light.', done: () => photos.some((p) => p.date === dateKey(d)) });
    if (r.sleep) out.push({ id: 'sl', time: r.sleepTime, tab: 'today', title: '😴 Wind down', body: 'Screens away, lights low. Muscle is built while you sleep.', done: () => false });
    return out;
  }

  async function notify(s) {
    if (!document.hidden) { toast(s.title); vibe([80, 40, 80]); sfx('timer'); }
    const opts = { body: s.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'hunter-' + s.id, renotify: true, vibrate: [120, 60, 120], data: { tab: s.tab } };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification(s.title, opts); else new Notification(s.title, opts);
    } catch (e) { /* notification blocked or unsupported */ }
  }

  function tickReminders() {
    const r = rem(); if (!r.on || !permOk()) return;
    const now = new Date(), key = dateKey(now), mins = now.getHours() * 60 + now.getMinutes();
    if (!data.remFired || typeof data.remFired !== 'object') data.remFired = {};
    const fired = data.remFired; let changed = false;
    Object.keys(fired).forEach((k) => { if (!k.startsWith(key + '|')) { delete fired[k]; changed = true; } });
    const l = getLog(key);
    schedule(now).forEach((s) => {
      const [h, m] = s.time.split(':').map(Number), t = h * 60 + m, fk = key + '|' + s.id;
      if (fired[fk] || mins < t || mins - t > CATCHUP) return;
      fired[fk] = 1; changed = true;
      if (!s.done(l)) notify(s);
    });
    if (changed) save();
  }

  /* calendar alarms: repeating events with alarms that the phone fires even when the app is closed */
  function buildICS() {
    const r = rem(), now = new Date(), P = (n) => pad(n);
    const stamp = `${now.getUTCFullYear()}${P(now.getUTCMonth() + 1)}${P(now.getUTCDate())}T${P(now.getUTCHours())}${P(now.getUTCMinutes())}${P(now.getUTCSeconds())}Z`;
    const ics = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const fold = (line) => { const o = []; let s = line; while (s.length > 73) { o.push(s.slice(0, 73)); s = ' ' + s.slice(73); } o.push(s); return o.join('\r\n'); };
    const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hunter System//Reminders//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Hunter System'];
    const add = (uid, time, summary, desc, days) => {
      const [h, m] = time.split(':').map(Number), d = new Date();
      if (days) { for (let i = 0; i < 7 && !days.includes(d.getDay()); i++) d.setDate(d.getDate() + 1); }
      const ds = `${d.getFullYear()}${P(d.getMonth() + 1)}${P(d.getDate())}`, e = h * 60 + m + 15;
      L.push('BEGIN:VEVENT', `UID:hunter-${uid}@hunter-system`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${P(h)}${P(m)}00`, `DTEND:${ds}T${P(Math.floor(e / 60) % 24)}${P(e % 60)}00`,
        days ? `RRULE:FREQ=WEEKLY;BYDAY=${days.map((x) => BYDAY[x]).join(',')}` : 'RRULE:FREQ=DAILY',
        fold('SUMMARY:' + ics(summary)), fold('DESCRIPTION:' + ics(desc)), 'BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + ics(summary)), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    };
    if (r.meals) H.MEALS.forEach((m, i) => { if (!m.optional) add('meal' + i, m.time, `${m.icon} ${titleCase(m.name)}`, `${m.kcal} kcal, ${m.protein} g protein. ${m.items.join(', ')}`); });
    if (r.workout && trainDows().length) add('train', r.workoutTime, '🏋️ Training time', 'Open Hunter System and clear today\'s quests.', trainDows());
    if (r.water) r.waterTimes.forEach((t, i) => add('water' + i, t, '💧 Drink water', 'Aim for 8 glasses across the day.'));
    if (r.weigh) add('weigh', r.weighTime, '⚖️ Morning weigh-in', 'After the toilet, before breakfast.');
    if (r.photo) add('photo', r.photoTime, '📸 Progress photos', 'Weekly check-in: front, side and back. Same spot, same light.', [photoDow()]);
    if (r.sleep) add('sleep', r.sleepTime, '😴 Wind down', 'Screens away, lights low.');
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  const remSwitches = { remMeals: 'meals', remWorkout: 'workout', remWater: 'water', remWeigh: 'weigh', remSleep: 'sleep', remPhoto: 'photo' };
  function fillRem() {
    const r = rem(), live = r.on && permOk();
    $('remSw').classList.toggle('on', live);
    Object.keys(remSwitches).forEach((id) => $(id).classList.toggle('on', !!r[remSwitches[id]]));
    $('remWorkoutTime').value = r.workoutTime; $('remSleepTime').value = r.sleepTime;
    $('remStatus').textContent = !hasNotif() ? 'This browser has no notification support. Use calendar alarms below.'
      : Notification.permission === 'denied' ? 'Notifications are blocked for this app. Allow them in your phone or browser site settings.'
      : live ? 'Active. Reminders fire at the set times while the app is open or recently used.' : 'Off. Turn on to get notifications.';
  }
  async function ensurePerm() {
    if (!hasNotif()) { toast('Notifications are not supported here. Use calendar alarms.'); return false; }
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    fillRem();
    if (p !== 'granted') { toast('Notifications are blocked. Allow them in site settings.'); return false; }
    return true;
  }
  $('remSw').onclick = async () => {
    if (rem().on && permOk()) { setRem('on', false); return toast('Reminders off.'); }
    if (!(await ensurePerm())) return;
    setRem('on', true); toast('Reminders on ✓'); sfx('check'); tickReminders();
  };
  Object.keys(remSwitches).forEach((id) => { $(id).onclick = () => { setRem(remSwitches[id], !rem()[remSwitches[id]]); sfx('set'); }; });
  const timeOk = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  $('remWorkoutTime').onchange = (e) => { if (timeOk(e.target.value)) { setRem('workoutTime', e.target.value); toast('Training time saved.'); } else fillRem(); };
  $('remSleepTime').onchange = (e) => { if (timeOk(e.target.value)) { setRem('sleepTime', e.target.value); toast('Bedtime saved.'); } else fillRem(); };
  $('remTest').onclick = async () => { if (await ensurePerm()) { await notify({ id: 'test', tab: 'today', title: '⚔ Hunter System', body: 'Reminders are working.' }); } };
  $('remIcs').onclick = () => {
    const blob = new Blob([buildICS()], { type: 'text/calendar' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'hunter-reminders.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Open the file to add the alarms to your calendar.');
  };
  setInterval(tickReminders, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickReminders(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { const t = e.data && e.data.tab; if (['today', 'train', 'fuel', 'photos', 'stats'].includes(t)) setTab(t); });

  /* ---------- boot ---------- */
  load();
  fillSettings();
  startFx();
  const hash = location.hash.replace('#', '');
  renderAll();
  tickReminders();
  initPhotos();
  refreshOffline();
  if (['today', 'train', 'fuel', 'photos', 'stats'].includes(hash)) setTab(hash);
  setInterval(() => { if (tab === 'today' && !previewKey) $('systemTime').textContent = '· ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }, 20000);
  // roll over at midnight if the app stays open
  let lastDay = todayKey();
  setInterval(() => { if (todayKey() !== lastDay) { lastDay = todayKey(); trainSig = ''; renderAll(); } }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && todayKey() !== lastDay) { lastDay = todayKey(); trainSig = ''; renderAll(); } });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
