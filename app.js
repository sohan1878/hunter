/* HUNTER SYSTEM — app logic */
(function () {
  'use strict';
  const H = window.Hunter;
  const $ = (id) => document.getElementById(id);
  const KEY = 'hunter-body-system-v1';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DEFAULTS = { logs: {}, weights: [], waists: [], goal: 68, start: 58, calories: 2500, protein: 120, totalXP: 0, sound: true, vibe: true, rest: 90 };
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
  function dayInfo(d) {
    const dow = d.getDay(), key = dateKey(d), l = getLog(key), w = H.WORKOUTS[dow];
    const items = w
      ? w.items.map(([id, sets, reps]) => ({ kind: 'ex', fig: id, name: H.EX[id].name, eq: H.EX[id].eq, sets, reps, meta: `${sets} sets × ${reps}`, cues: H.EX[id].cues }))
      : H.REST.map((r) => ({ kind: 'rest', fig: r.fig, emoji: r.emoji, name: r.name, eq: '', sets: 1, reps: '', meta: r.meta, cues: r.cues }));
    let done = 0;
    items.forEach((_, i) => { if (l.checks['w' + i]) done++; });
    H.MEALS.forEach((m, i) => { if (!m.optional && l.meals['m' + i]) done++; });
    const total = items.length + H.MEALS.filter((m) => !m.optional).length;
    const xpDay = (Object.values(l.checks).filter(Boolean).length + Object.values(l.meals).filter(Boolean).length) * 10 + (l.bonus ? 50 : 0);
    return { d, dow, key, l, w, items, total, done, pct: Math.round((done / total) * 100), xpDay };
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
    if (type === 'work' && !val) delete l.sets[id];
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
    if (it.fig) { el.classList.remove('emoji'); H.mountFig(el, it.fig, el.classList.contains('big')); }
    else { el.classList.add('emoji'); el.innerHTML = `<span class="em">${it.emoji || '✦'}</span>`; }
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
      html = `<div class="next"><div class="figbox" id="nextFig"></div><div><div class="label">${info.w ? 'TRAINING' : 'RECOVERY'} · ${idx + 1} / ${info.items.length}</div><h4>${esc(it.name)}</h4><p>${esc(it.meta)}</p><button class="btn primary" data-open="${idx}">START QUEST</button></div></div>`;
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
  function taskHTML(it, i, on) {
    return `<div class="task ${on ? 'done' : ''}" data-i="${i}" role="button" tabindex="0"><div class="figbox" data-fig="${i}"></div><div class="info"><div class="task-title">${esc(it.name)}</div><div class="task-meta">${esc(it.meta)}</div><div class="chips">${it.eq ? `<span class="chip">${it.eq}</span>` : ''}<span class="chip xp">+10 XP</span></div></div><button class="chk ${on ? 'on' : ''}" data-chk="${i}" aria-label="Mark done">${CHECK_SVG}</button></div>`;
  }
  function renderTrain(info) {
    const rest = !info.w;
    $('trainTitle').textContent = info.w ? '▣ ' + info.w.title : '▣ RECOVERY DAY';
    $('trainFocus').textContent = info.w ? info.w.focus + '. Tap an exercise for the demo and rest timer.' : 'No heavy lifting. Let your muscles rebuild.';
    $('dayType').textContent = rest ? 'RECOVERY DAY' : 'TRAINING DAY';
    $('dayType').classList.toggle('warn', rest);
    const sun = new Date(info.d); sun.setDate(sun.getDate() - info.dow);
    $('daySwitch').innerHTML = DAYS.map((n, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return `<button class="${i === info.dow ? 'active' : ''}" data-day="${dateKey(d)}">${n.slice(0, 3).toUpperCase()}</button>`; }).join('');
    const total = info.items.length, done = info.items.filter((_, i) => info.l.checks['w' + i]).length;
    $('workoutCount').textContent = `${done} / ${total}`; $('workoutBar').style.width = (done / total) * 100 + '%';
    const list = $('workoutList');
    if (trainSig !== info.key) {
      trainSig = info.key;
      list.innerHTML = info.items.map((it, i) => taskHTML(it, i, !!info.l.checks['w' + i])).join('');
      list.querySelectorAll('[data-fig]').forEach((el) => demoInto(el, info.items[+el.dataset.fig]));
    } else {
      list.querySelectorAll('.task').forEach((el) => {
        const on = !!info.l.checks['w' + el.dataset.i];
        el.classList.toggle('done', on); el.querySelector('.chk').classList.toggle('on', on);
      });
    }
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
  }

  function renderAll() {
    const info = dayInfo(activeDate());
    renderToday(info); renderTrain(info); renderFuel(info); renderStats();
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
      <div class="chips">${it.eq ? `<span class="chip">${it.eq}</span>` : ''}<span class="chip">${esc(it.meta)}</span><span class="chip xp">+10 XP</span></div>
      <ul class="cues">${it.cues.map((c, k) => `<li><b>${k + 1}</b><span>${esc(c)}</span></li>`).join('')}</ul>
      ${isEx ? `<div class="label">SETS · tap each one when finished</div><div class="sets" id="setChips"></div>
      <div class="timer" id="timer"><div class="tring"><svg viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="36"/><circle class="fg" id="tFg" cx="42" cy="42" r="36" stroke-dasharray="226.2" stroke-dashoffset="0"/></svg><div class="t" id="tTxt">${fmtT(data.rest)}</div></div>
        <div style="flex:1;min-width:0"><div class="label" style="margin-bottom:7px">REST TIMER</div><div class="presets" id="presets">${[45, 60, 90, 120].map((s) => `<button data-rest="${s}" class="${data.rest === s ? 'on' : ''}">${s}s</button>`).join('')}</div><div class="btn-row" style="margin:0"><button class="btn primary" id="tStart">START REST</button><button class="btn" id="tReset">RESET</button></div></div></div>` : ''}
      <div class="btn-row"><button class="btn primary" style="flex:1" id="sheetDone"></button><button class="btn" id="sheetClose">CLOSE</button></div>`;
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

  /* ---------- boot ---------- */
  load();
  fillSettings();
  startFx();
  const hash = location.hash.replace('#', '');
  renderAll();
  if (['today', 'train', 'fuel', 'stats'].includes(hash)) setTab(hash);
  setInterval(() => { if (tab === 'today' && !previewKey) $('systemTime').textContent = '· ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }, 20000);
  // roll over at midnight if the app stays open
  let lastDay = todayKey();
  setInterval(() => { if (todayKey() !== lastDay) { lastDay = todayKey(); trainSig = ''; renderAll(); } }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && todayKey() !== lastDay) { lastDay = todayKey(); trainSig = ''; renderAll(); } });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
