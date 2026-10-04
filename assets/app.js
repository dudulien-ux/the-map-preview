/* ─────────────────────────────────────────────────────────────
   app.js: the website. Pages, accounts, the SEE → ACT cycle.

   Everything is saved in this browser only (localStorage), through
   the small Store below. To make it real (shared between people),
   swap the Store for a server one with the same functions; see
   README.md "Shared posts".
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const D = window.MAPDATA, W = D.WORDS;
  const PL = (window.PLACES || []).map(r => ({ name: r[0], country: r[1], lat: r[2], lon: r[3], pop: r[4] * 1000 }));
  const MapView = window.MapView;

  /* ───────── helpers ───────── */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const RAD = Math.PI / 180;
  const now = () => Date.now();
  const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function ago(t) {
    const s = Math.max(0, (now() - t) / 1000);
    if (s < 60) return 'just now';
    const m = s / 60; if (m < 60) return Math.round(m) + ' min ago';
    const h = Math.round(m / 60); if (m < 60 * 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const d = Math.round(m / 1440); if (d < 14) return d + (d === 1 ? ' day ago' : ' days ago');
    if (d < 60) return Math.round(d / 7) + ' weeks ago';
    if (d < 365) return Math.round(d / 30) + ' months ago';
    const y = Math.round(d / 365); return y + (y === 1 ? ' year ago' : ' years ago');
  }
  const fmtDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  function hav(la1, lo1, la2, lo2) {
    const a = Math.sin((la2 - la1) * RAD / 2) ** 2 + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * Math.sin((lo2 - lo1) * RAD / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  const SCALES = [['street', 'Street'], ['city', 'City'], ['country', 'Country'], ['continent', 'Continent'], ['world', 'World']];
  const SCALE_LABEL = Object.fromEntries(SCALES);
  const LEVEL_NAMES = ['World', 'Continent', 'Country', 'City', 'Street'];
  const LEVEL_TO_SCALE = ['world', 'continent', 'country', 'city', 'street'];
  const LEVEL_KM = [null, 5200, 1300, 36, 1.4];
  const ITEM_KM = { street: 1.6, city: 30, country: 1800, continent: 6000 };
  const CYCLE = W.cycle;
  const stageLabel = st => st >= 6 ? 'RESOLVED' : CYCLE[st][0];
  const STAGE_GROUPS = [['new', 'SHARE · DISCOVER', s => s <= 2], ['forming', 'CONNECT', s => s === 3], ['action', 'CREATE · ACT', s => s === 4 || s === 5], ['resolved', 'RESOLVED', s => s >= 6]];

  /* ───────── store (this browser only) ───────── */
  const KEY = 'map-mockup-v1';
  function seed() {
    const t0 = now();
    const T = o => o.t ? Date.parse(o.t) : t0 - (o.ago || 0) * 60000;
    const profiles = {};
    D.PEOPLE.forEach(p => { profiles[p.id] = Object.assign({}, p, { joined: t0 - 70 * 86400000 }); });
    const problems = {};
    D.PROBLEMS.forEach(src => {
      const p = JSON.parse(JSON.stringify(src));
      p.t = T(src); delete p.ago;
      p.seen = (src.seen || []).map(s => ({ by: s.by, t: T(s) }));
      p.questions = (src.questions || []).map(q => ({ id: uid('q'), by: q.by, text: q.text, t: T(q), answer: q.answer ? { by: q.answer.by, text: q.answer.text, t: T(q.answer) } : null }));
      p.team = (src.team || []).map(m => ({ by: m.by, skill: m.skill, t: T(m) }));
      p.needs = p.needs || [];
      if (src.project) {
        p.project = { name: src.project.name, by: src.project.by, t: T(src.project),
          updates: src.project.updates.map(u => ({ id: uid('up'), by: u.by, text: u.text, t: T(u) })),
          resolved: src.project.resolved ? { by: src.project.resolved.by, note: src.project.resolved.note, t: T(src.project.resolved) } : null };
      }
      problems[p.id] = p;
    });
    const reports = D.REPORTS.map(r => ({ id: r.id, target: r.target, by: r.by, reason: r.reason, note: r.note, t: T(r), status: 'open' }));
    return { v: 1, seededAt: t0, profiles, problems, reports, messages: [], me: null, actAs: null, follows: {}, lastRead: {},
      teamMode: false, theme: 'night', bannerSeen: false, draft: null, returnTo: null };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1 && s.problems) { s.theme = (s.theme === 'day' || s.theme === 'light') ? 'day' : 'night'; return s; } } } catch (e) { /* blocked */ }
    return seed();
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { toast("Couldn't save in this browser (storage full or blocked). Your changes last until you close the page."); return false; }
  }

  /* ───────── who is using it ───────── */
  const who = () => S.actAs || S.me;
  const meP = () => (who() && S.profiles[who()]) || null;
  const nameOf = id => (S.profiles[id] && S.profiles[id].name) || 'Someone';

  /* ───────── derived ───────── */
  function stageOf(p) {
    if (p.project && p.project.resolved) return 6;
    if (p.project && p.project.updates.length) return 5;
    if (p.project) return 4;
    if (p.team.length) return 3;
    if (p.seen.length + (p.seenExtra || 0) > 0 || p.questions.length) return 2;
    return 1;
  }
  const seenN = p => p.seen.length + (p.seenExtra || 0);
  const hasSeen = (p, u) => !!u && p.seen.some(s => s.by === u);
  const visibleP = p => !p.hidden || S.teamMode || (who() && p.by === who());
  const allProblems = () => Object.values(S.problems).filter(visibleP);
  const openSkills = p => { const f = new Set(p.team.map(m => m.skill)); return (p.needs || []).filter(s => !f.has(s)); };
  const inTeam = (p, u) => !!u && p.team.some(m => m.by === u);
  const following = (p, u) => !!u && (S.follows[u] || []).includes(p.id);
  const placeOf = p => p.place + (p.country && p.country !== p.place ? ', ' + p.country : '');
  const coord = (lat, lon) => Math.abs(lat).toFixed(1) + '°' + (lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(lon).toFixed(1) + '°' + (lon >= 0 ? 'E' : 'W');
  const shortText = (s, n = 70) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  const titleOf = p => p.project ? p.project.name : shortText(p.text);
  function events(p) {
    const e = [{ type: 'post', by: p.by, t: p.t, p }];
    p.seen.forEach(s => e.push({ type: 'seen', by: s.by, t: s.t, p }));
    p.questions.forEach(q => { e.push({ type: 'question', by: q.by, t: q.t, p, text: q.text }); if (q.answer) e.push({ type: 'answer', by: q.answer.by, t: q.answer.t, p, text: q.answer.text }); });
    p.team.forEach(m => e.push({ type: 'join', by: m.by, t: m.t, p, skill: m.skill }));
    if (p.project) {
      e.push({ type: 'project', by: p.project.by, t: p.project.t, p, name: p.project.name });
      p.project.updates.forEach(u => e.push({ type: 'update', by: u.by, t: u.t, p, text: u.text }));
      if (p.project.resolved) e.push({ type: 'resolved', by: p.project.resolved.by, t: p.project.resolved.t, p });
    }
    return e;
  }
  const allEvents = () => allProblems().flatMap(events).sort((a, b) => b.t - a.t);
  function notesFor(u) {
    if (!u) return [];
    return allEvents().filter(e => e.by !== u && e.type !== 'post' && (e.p.by === u || following(e.p, u) || inTeam(e.p, u))).slice(0, 40);
  }
  const unread = u => { const lr = S.lastRead[u] || 0; return notesFor(u).filter(e => e.t > lr).length; };
  function eventText(e) {
    const n = esc(nameOf(e.by)), t = '<b>' + esc(titleOf(e.p)) + '</b>';
    switch (e.type) {
      case 'post': return n + ' posted ' + t;
      case 'seen': return n + ' sees it too: ' + t;
      case 'question': return n + ' asked on ' + t + ': “' + esc(shortText(e.text, 90)) + '”';
      case 'answer': return n + ' answered a question on ' + t;
      case 'join': return n + ' joined ' + t + ' for ' + esc(e.skill);
      case 'project': return n + ' formed the project <b>' + esc(e.name) + '</b>';
      case 'update': return n + ' posted an update on ' + t;
      case 'resolved': return n + ' marked ' + t + ' resolved';
    }
    return '';
  }
  function similar(p, n = 3) {
    const t = new Set(p.tags || []);
    return allProblems().filter(q => q.id !== p.id)
      .map(q => ({ q, o: (q.tags || []).filter(x => t.has(x)).length, d: hav(p.lat, p.lon, q.lat, q.lon) }))
      .filter(x => x.o > 0 && x.d > 300)
      .sort((a, b) => b.o - a.o || b.d - a.d).slice(0, n).map(x => x.q);
  }

  /* ───────── little pictures ───────── */
  const AV_COLORS = ['#FFD166', '#A78BFA', '#34E0A1', '#F4F0FF', '#7FB2FF', '#FF9E80'];
  function avatar(id, size, link) {
    const pr = S.profiles[id];
    const letter = pr ? (pr.sample ? pr.city : pr.name).trim().charAt(0).toUpperCase() : '?';
    let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const cls = 'avatar' + (size ? ' ' + size : '');
    const style = 'background:' + AV_COLORS[h % AV_COLORS.length];
    const label = esc(pr ? pr.name : 'Someone');
    return link ? `<a class="${cls}" style="${style}" href="#u.${esc(id)}" aria-label="${label}">${esc(letter)}</a>` : `<span class="${cls}" style="${style}" aria-hidden="true">${esc(letter)}</span>`;
  }
  // locator globe: a tiny globe with the pin in the middle (land mask from Natural Earth)
  const LM = (() => { try { const b = atob(window.LANDMASK.b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } catch (e) { return null; } })();
  function landAt(lon, lat) {
    if (!LM) return 0;
    let x = Math.floor((lon + 180) * 2); const y = clamp(Math.floor((90 - lat) * 2), 0, 359);
    x = ((x % 720) + 720) % 720; const i = y * 720 + x;
    return (LM[i >> 3] >> (i & 7)) & 1;
  }
  const LOC = {};
  function locator(lat, lon, size) {
    size = size || 64;
    const theme = effTheme(), key = lat.toFixed(2) + ':' + lon.toFixed(2) + ':' + size + ':' + theme;
    if (LOC[key]) return LOC[key];
    const r = 2, N = size * r, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
    const pal = theme === 'dark' ? { o: [10, 8, 32], l: [52, 42, 110], e: '#5A4BC0', y: '#FFD166' } : { o: [196, 216, 240], l: [255, 255, 255], e: '#6F8DB6', y: '#F39A0D' };
    const R0 = N / 2 - 3 * r, cx = N / 2, cy = N / 2, f0 = lat * RAD, l0 = lon * RAD, sf = Math.sin(f0), cf = Math.cos(f0);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const X = (i + 0.5 - cx) / R0, Y = (cy - (j + 0.5)) / R0, rho2 = X * X + Y * Y;
      if (rho2 > 1) continue;
      const rho = Math.sqrt(rho2), cc = Math.asin(Math.min(1, rho)), sc = Math.sin(cc), co = Math.cos(cc);
      const f = Math.asin(co * sf + (rho ? Y * sc * cf / rho : 0));
      const l = l0 + Math.atan2(X * sc, rho * cf * co - Y * sf * sc);
      const col = landAt(l / RAD, f / RAD) ? pal.l : pal.o, k = (j * N + i) * 4;
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    x.lineWidth = 1.5 * r; x.strokeStyle = pal.e; x.beginPath(); x.arc(cx, cy, R0, 0, Math.PI * 2); x.stroke();
    // the light: a soft glow with a bright core
    const s = Math.max(3.2, size / 18) * r, gl = x.createRadialGradient(cx, cy, 0, cx, cy, s * 4);
    const glow = [1, 3, 5].map(i => parseInt(pal.y.slice(i, i + 2), 16)).join(',');
    gl.addColorStop(0, 'rgba(' + glow + ',0.75)'); gl.addColorStop(1, 'rgba(' + glow + ',0)');
    x.fillStyle = gl; x.beginPath(); x.arc(cx, cy, s * 4, 0, Math.PI * 2); x.fill();
    x.fillStyle = pal.y; x.beginPath(); x.arc(cx, cy, s, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(cx - s * 0.3, cy - s * 0.3, s * 0.35, 0, Math.PI * 2); x.fill();
    return (LOC[key] = c.toDataURL('image/png'));
  }
  function glyph(it) {
    if (it.kind === 'person') return 'person';
    if (it.kind === 'team') return 'team';
    return 's' + (it.stage != null ? it.stage : stageOf(it));
  }

  /* ───────── toast + modal ───────── */
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800); }
  let modalReturn = null;
  function openModal(html, cls) {
    modalReturn = document.activeElement;
    const m = $('#modal'), c = $('#modalCard');
    c.className = 'modal-card' + (cls ? ' ' + cls : ''); c.innerHTML = html; m.hidden = false;
    const f = c.querySelector('input,button,select,textarea'); if (f) f.focus();
  }
  function closeModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; if (modalReturn && modalReturn.focus) modalReturn.focus(); }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  /* ───────── theme ───────── */
  // Night is the site's own look; Day is the same site in daylight. It's the person's choice, not the device's.
  const effTheme = () => S.theme === 'day' ? 'light' : 'dark';
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', S.theme === 'day' ? 'day' : 'night');
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--space').trim() || '#0A0820';
    MapView.setTheme(effTheme());
  }
  function setTheme(v) { S.theme = v === 'day' ? 'day' : 'night'; save(); applyTheme(); for (const k in LOC) delete LOC[k]; rerender(); }
  $('#themeBtn').addEventListener('click', () => setTheme(S.theme === 'day' ? 'night' : 'day'));

  /* ───────── router ───────── */
  const VIEWS = ['home', 'map', 'problems', 'projects', 'people', 'problem', 'profile', 'me', 'join', 'about', 'trust', 'mod', '404'];
  let R = { name: 'home' }, pendingAction = null;
  function parse() {
    let h = location.hash.replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch (e) { /* keep */ }
    if (!h || h === 'home' || h === 'main') return { name: 'home' };
    const m = h.match(/^([a-z0-9]+)(?:\.(.+))?$/i);
    if (!m) return { name: '404' };
    const a = m[1].toLowerCase(), b = m[2];
    if (a === 'p' && b) return { name: 'problem', id: b };
    if (a === 'u' && b) return { name: 'profile', id: b };
    if (['map', 'problems', 'projects', 'people', 'me', 'join', 'about', 'trust', 'mod'].includes(a)) return { name: a, sub: b };
    return { name: '404' };
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function route() {
    R = parse();
    closeDrops(); hideTip();
    if (R.name !== 'map' && placing) stopPlacing();
    document.body.className = 'route-' + R.name;
    VIEWS.forEach(v => { const el = $('#view-' + v); if (el) el.hidden = v !== R.name; });
    $$('[data-nav]').forEach(a => {
      const on = a.dataset.nav === R.name || (R.name === 'problem' && a.dataset.nav === 'problems') || (R.name === 'profile' && a.dataset.nav === 'people');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    setMapTop();
    placeMap();
    (RENDER[R.name] || RENDER['404'])(R);
    document.title = titleFor(R);
    if (R.name !== 'map') {
      const anchor = R.sub && document.getElementById(R.sub);
      if (anchor) anchor.scrollIntoView(); else window.scrollTo(0, 0);
    }
    if (pendingAction) { const a = pendingAction; pendingAction = null; a(); }
  }
  function titleFor(r) {
    const n = W.name;
    const t = { home: n + ': A global map of local problems', map: 'Map · ' + n, problems: 'Problems · ' + n, projects: 'Projects · ' + n, people: 'People · ' + n,
      me: 'Your page · ' + n, join: 'Join · ' + n, about: 'About · ' + n, trust: 'Trust & safety · ' + n, mod: 'Moderation · ' + n, '404': 'Not found · ' + n }[r.name];
    if (t) return t;
    if (r.name === 'problem' && S.problems[r.id]) return shortText(titleOf(S.problems[r.id]), 60) + ' · ' + n;
    if (r.name === 'profile' && S.profiles[r.id]) return S.profiles[r.id].name + ' · ' + n;
    return n;
  }
  window.addEventListener('hashchange', route);

  /* ───────── the map, moved between the home page and the map page ───────── */
  let mapStarted = false, layer = 'see', skillF = null, selId = null, panelMode = null, placing = false, pending = null;
  const filt = { tags: [], scales: [], stages: [] };
  function placeMap() {
    const shell = $('#mapShell');
    const slot = R.name === 'home' ? $('#heroMapSlot') : R.name === 'map' ? $('#appMapSlot') : $('#mapPark');
    if (shell.parentNode !== slot) slot.appendChild(shell);
    if (!mapStarted && (R.name === 'home' || R.name === 'map')) startMap();
    const wasHero = MapView.mode() === 'hero';
    MapView.setMode(R.name === 'home' ? 'hero' : R.name === 'map' ? 'app' : 'hidden');
    // the home page's rising earth is a slowly turning close-up; arriving on the map,
    // show the whole earth again, turned back to where the problems are
    requestAnimationFrame(() => {
      MapView.resize();
      if (!MapView.ready()) return;
      if (R.name === 'map' && wasHero && !R.sub && !pendingAction) MapView.fitWorld(true, WORLD_CENTER);
      else if (MapView.level() === 0) MapView.fitWorld(true);
      if (R.name === 'home') MapView.fitWorld(true);
    });
  }
  const WORLD_CENTER = [100, -4];
  let mapReadyQueue = [];
  const whenMapReady = fn => { if (MapView.ready()) fn(); else if (!MapView.failed()) mapReadyQueue.push(fn); };
  function startMap() {
    mapStarted = true;
    const el = $('#mapEl'), md = Math.max(200, Math.min(el.clientWidth || 500, el.clientHeight || 500));
    MapView.on('ready', () => { refreshMap(); updateWhere(); const q = mapReadyQueue; mapReadyQueue = []; q.forEach(f => f()); });
    MapView.on('failed', () => {
      const fb = $('#mapFallback'); fb.hidden = false;
      fb.innerHTML = '<div>The live map needs WebGL, which is switched off in this browser. Everything else still works: try <a href="#problems">Problems</a> or <a href="#projects">Projects</a>.</div>';
    });
    MapView.on('select', id => { if (R.name === 'home') { pendingAction = () => whenMapReady(() => select(id)); go('#map'); } else select(id); });
    MapView.on('hover', showTip);
    MapView.on('mapclick', ll => {
      if (R.name === 'home') { go('#map'); return; }
      if (placing) { MapView.flyTo(ll.lng, ll.lat, null, { zoom: MapView.zoom(), ease: true, duration: 350 }); return; }
      if (panelMode === 'item') closePanel();
    });
    MapView.on('move', () => { if (R.name === 'map') { hideTip(); updateLevel(); } });
    MapView.on('moveend', () => { if (R.name === 'map') updateWhere(); });
    MapView.init(el, { theme: effTheme(), center: WORLD_CENTER, zoom: Math.log(0.8 * Math.PI * md / 512) / Math.LN2 });
  }
  function passFilters(p) {
    if (filt.tags.length && !(p.tags || []).some(t => filt.tags.includes(t))) return false;
    if (filt.scales.length && !filt.scales.includes(p.scale)) return false;
    if (filt.stages.length) { const st = stageOf(p); if (!STAGE_GROUPS.some(g => filt.stages.includes(g[0]) && g[2](st))) return false; }
    return true;
  }
  function mapItems() {
    const u = who(), P = allProblems().filter(passFilters);
    if (layer === 'see') return P.map(p => ({ id: p.id, kind: 'problem', lat: p.lat, lon: p.lon, stage: stageOf(p), scale: p.scale, mine: !!u && p.by === u, showHalo: true }));
    if (layer === 'connect') {
      const ppl = Object.values(S.profiles).filter(pr => pr.lat != null && (!skillF || pr.skills.includes(skillF)))
        .map(pr => ({ id: pr.id, kind: 'person', lat: pr.lat, lon: pr.lon, mine: pr.id === u }));
      const teams = P.filter(p => stageOf(p) <= 3 && openSkills(p).length && (!skillF || openSkills(p).includes(skillF)))
        .map(p => ({ id: p.id, kind: 'team', lat: p.lat, lon: p.lon, stage: stageOf(p), scale: p.scale, mine: !!u && p.by === u }));
      return ppl.concat(teams);
    }
    return P.filter(p => stageOf(p) >= 4).map(p => ({ id: p.id, kind: 'project', lat: p.lat, lon: p.lon, stage: stageOf(p), scale: p.scale, mine: inTeam(p, u) || (!!u && p.by === u) }));
  }
  // lines of light: each problem joined to its most similar problem far away (Local to Global Impact);
  // constellations: in CONNECT, each team member's city joined to the problem they work on
  function mapExt() {
    const P = allProblems().filter(passFilters), ext = { arcs: [], selArcs: [], teamLines: [] };
    if (layer !== 'connect') {
      const done = new Set(), pairs = [];
      for (const p of P) {
        const q = similar(p, 1)[0];
        if (!q || !P.includes(q)) continue;
        const key = [p.id, q.id].sort().join('|');
        if (done.has(key)) continue;
        done.add(key); pairs.push({ a: p, b: q, d: hav(p.lat, p.lon, q.lat, q.lon) });
      }
      ext.arcs = pairs.filter(x => x.d > 1500).sort((a, b) => b.d - a.d).slice(0, 16).map(x => [[x.a.lon, x.a.lat], [x.b.lon, x.b.lat]]);
    }
    const sp = selId && S.problems[selId];
    if (sp) ext.selArcs = similar(sp, 3).map(q => [[sp.lon, sp.lat], [q.lon, q.lat]]);
    if (layer === 'connect') {
      P.filter(p => stageOf(p) >= 3).forEach(p => p.team.forEach(m => {
        const pr = S.profiles[m.by];
        if (pr && pr.lat != null && hav(pr.lat, pr.lon, p.lat, p.lon) > 50) ext.teamLines.push([[pr.lon, pr.lat], [p.lon, p.lat]]);
      }));
    }
    return ext;
  }
  function refreshMap() { if (mapStarted) MapView.setData(mapItems(), selId, mapExt()); }

  /* ───────── rendering everything again after a change ───────── */
  function commit(msg) { save(); if (msg) toast(msg); rerender(); }
  function rerender() {
    refreshMap(); updateChrome();
    if (R.name === 'map') { if (!$('#mpanel').hidden) renderPanel(); updateWhere(); }
    else (RENDER[R.name] || RENDER['404'])(R, true);
  }
  function needMe(returnTo) {
    if (who()) return true;
    S.returnTo = returnTo || location.hash || '#home'; save();
    toast('Join first. It takes twenty seconds, and it stays on this device.');
    go('#join');
    return false;
  }

  /* ───────── nav, banners, bell ───────── */
  function updateChrome() {
    const u = who(), pr = meP(), me = $('#meBtn');
    if (pr) { me.outerHTML = avatar(u, '', true).replace('<a ', '<a id="meBtn" ').replace(/href="[^"]*"/, 'href="#me"'); }
    else { me.outerHTML = '<a class="avatar" id="meBtn" href="#join" aria-label="Join" style="background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line-2);font-family:var(--body);font-weight:400;font-size:22px">+</a>'; }
    const n = u ? unread(u) : 0, b = $('#bellCount');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
    const ab = $('#actAsBanner');
    if (S.actAs) { ab.hidden = false; ab.innerHTML = `<span>Demo: you're acting as <b>${esc(nameOf(S.actAs))}</b>. What you do now counts as them.</span><button type="button" data-act="actAs" data-id="">Switch back</button>`; }
    else ab.hidden = true;
    const db = $('#demoBanner');
    if (!S.bannerSeen) { db.hidden = false; db.innerHTML = '<span>This is a mock-up. Every person and problem here is a made-up sample, and anything you add is saved only in this browser.</span><button type="button" data-act="bannerOk">Got it</button>'; }
    else db.hidden = true;
    $('#footJoin').textContent = pr ? 'You: ' + pr.name : 'Join';
    setMapTop();
  }
  function setMapTop() {
    const bottoms = ['#nav', '#actAsBanner', '#demoBanner'].map(s => $(s)).filter(el => el && !el.hidden).map(el => el.getBoundingClientRect().bottom + window.scrollY);
    document.documentElement.style.setProperty('--map-top', Math.round(Math.max.apply(null, bottoms)) + 'px');
  }
  window.addEventListener('resize', debounce(setMapTop, 100));
  function closeDrops() {
    $('#bellDrop').hidden = true; $('#bellBtn').setAttribute('aria-expanded', 'false');
    $('#filtersPop').hidden = true; $('#filtersBtn').setAttribute('aria-expanded', 'false');
  }
  $('#bellBtn').addEventListener('click', e => {
    e.stopPropagation();
    const d = $('#bellDrop'), open = d.hidden;
    closeDrops();
    if (!open) return;
    const u = who();
    if (!u) d.innerHTML = '<div class="drop-head"><span class="label">Notifications</span></div><p class="small mono muted" style="padding:14px;margin:0">Join to hear when someone answers, joins your team, or posts an update. <a href="#join">Join</a></p>';
    else {
      const list = notesFor(u), lr = S.lastRead[u] || 0;
      d.innerHTML = `<div class="drop-head"><span class="label">Notifications</span><button class="linkish" type="button" data-act="markRead">Mark all read</button></div>` +
        (list.length ? '<ul class="notes">' + list.slice(0, 25).map(e => `<li class="${e.t > lr ? 'unread' : ''}"><a href="#p.${esc(e.p.id)}">${avatar(e.by, 'sm')}<span><span class="t">${eventText(e)}</span><span class="w">${ago(e.t)}</span></span></a></li>`).join('') + '</ul>'
          : '<p class="small mono muted" style="padding:14px;margin:0">Nothing yet. Follow a problem or join a team, and news about it shows up here.</p>');
    }
    d.hidden = false; $('#bellBtn').setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#bellDrop') && !e.target.closest('#bellBtn')) { $('#bellDrop').hidden = true; $('#bellBtn').setAttribute('aria-expanded', 'false'); }
    if (!e.target.closest('#filtersPop') && !e.target.closest('#filtersBtn')) { $('#filtersPop').hidden = true; $('#filtersBtn').setAttribute('aria-expanded', 'false'); }
  });

  /* ───────── shared pieces ───────── */
  function chipsFor(p) {
    const st = stageOf(p), u = who();
    return `<span class="chip st-${st}">${stageLabel(st)}</span><span class="chip soft">${esc(SCALE_LABEL[p.scale] || p.scale)}</span>` +
      (p.sample ? '<span class="chip sample">sample</span>' : '') + (u && p.by === u ? '<span class="chip mine">yours</span>' : '') +
      (p.hidden ? '<span class="chip hidden-post">hidden by the team</span>' : '');
  }
  function stepper(st) {
    const lis = CYCLE.map((c, i) => `<li class="c${i} ${i < st || st >= 6 ? 'done' : ''} ${i === st && st < 6 ? 'now' : ''}">${c[0]}</li>`).join('');
    return `<ol class="stepper" aria-label="Where this is in the cycle">${lis}</ol>` +
      (st >= 6 ? '' : `<p class="stepnow">Now: <b>${CYCLE[st][0]}</b> (${esc(CYCLE[st][1])})</p>`);
  }
  function pcard(p) {
    const st = stageOf(p);
    return `<article class="pcard">
      <img class="loc" src="${locator(p.lat, p.lon, 64)}" alt="" width="64" height="64" loading="lazy">
      <div>
        <div class="chips">${chipsFor(p)}</div>
        <h3><a href="#p.${esc(p.id)}">${p.project && st >= 4 ? '<b>' + esc(p.project.name) + '.</b> ' : ''}${esc(p.text)}</a></h3>
        <p class="meta">${esc(placeOf(p))} · ${p.id === 'origin' ? fmtDate(p.t) : ago(p.t)} <span class="coord">${coord(p.lat, p.lon)}</span></p>
        <div class="foot"><span><b>${seenN(p)}</b> see it too</span><span><b>${p.questions.length}</b> ${p.questions.length === 1 ? 'question' : 'questions'}</span><span>team <b>${p.team.length}${p.needs.length ? '/' + p.needs.length : ''}</b></span></div>
      </div>
      ${p.photo ? `<img class="thumb" src="${p.photo}" alt="${esc(p.photoAlt || '')}">` : ''}
    </article>`;
  }
  function projcard(p) {
    const st = stageOf(p), last = p.project.updates[p.project.updates.length - 1];
    return `<article class="projcard">
      <div class="chips"><span class="chip st-${st}">${stageLabel(st)}</span>${p.sample ? '<span class="chip sample">sample</span>' : ''}</div>
      <h3><a href="#p.${esc(p.id)}">${esc(p.project.name)}</a></h3>
      <p class="from">From: “${esc(p.text)}”</p>
      ${p.project.resolved ? `<p class="last">✓ ${esc(p.project.resolved.note || 'Resolved')} <span class="label">${ago(p.project.resolved.t)}</span></p>`
        : last ? `<p class="last">${esc(last.text)} <span class="label">${ago(last.t)}</span></p>` : '<p class="label">No updates yet</p>'}
      <div class="row"><div class="av-stack">${p.team.map(m => avatar(m.by, 'sm')).join('')}</div><span class="label">${esc(placeOf(p))}</span></div>
    </article>`;
  }
  function personcard(pr) {
    const posts = Object.values(S.problems).filter(p => p.by === pr.id && visibleP(p)).length;
    const teams = Object.values(S.problems).filter(p => inTeam(p, pr.id)).length;
    return `<article class="personcard">${avatar(pr.id)}<div>
      <h3><a href="#u.${esc(pr.id)}">${esc(pr.name)}</a></h3>
      <p class="meta">${esc([pr.city, pr.country].filter(Boolean).join(', '))} · ${posts} posted · ${teams} ${teams === 1 ? 'team' : 'teams'}</p>
      <div class="chips">${pr.skills.map(s => `<span class="chip soft">${esc(s)}</span>`).join('')}${pr.sample ? '<span class="chip sample">sample</span>' : ''}${pr.id === who() ? '<span class="chip mine">you</span>' : ''}</div>
    </div></article>`;
  }
  function goItem(q) {
    return `<li><a href="#p.${esc(q.id)}"><i class="g s${stageOf(q)}"></i><span><span class="m">${esc(placeOf(q))} · ${esc(SCALE_LABEL[q.scale])}</span><span class="t">${esc(q.text)}</span></span></a></li>`;
  }
  const profileLink = id => `<a href="#u.${esc(id)}">${esc(nameOf(id))}</a>`;

  /* ───────── the problem: shared by the full page and the map panel ───────── */
  const ui = { ask: null, join: null, answer: null, form: null, update: null, edit: null, del: null };
  function problemMain(p, full) {
    const st = stageOf(p), u = who(), mine = !!u && p.by === u, member = inTeam(p, u), id = esc(p.id);
    const H = full ? 'h1' : 'p';
    let h = `<div class="chips">${chipsFor(p)}</div>`;
    if (p.project) h += `<p class="label" style="margin:16px 0 0">Project: <b style="color:var(--ink)">${esc(p.project.name)}</b></p>`;
    if (ui.edit === p.id) {
      h += `<form class="inline-form" data-form="edit" data-id="${id}">
        <div class="field"><label for="edText">What do you see?</label><textarea class="textarea" id="edText" name="text" maxlength="200" required>${esc(p.text)}</textarea></div>
        <div class="field"><label for="edDetails">More detail <span class="muted">(optional)</span></label><textarea class="textarea" id="edDetails" name="details" maxlength="600">${esc(p.details || '')}</textarea></div>
        <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-act="edit" data-id="${id}">Cancel</button></div></form>`;
    } else {
      h += `<${H} class="said q">${esc(p.text)}</${H}>`;
    }
    h += `<p class="byline">Posted by ${profileLink(p.by)} · ${esc(placeOf(p))}${p.approx ? ' (approximate spot)' : ''} · ${p.id === 'origin' ? fmtDate(p.t) : ago(p.t)}${p.edited ? ' · edited' : ''}</p>`;
    if (p.bullets) h += `<ul class="bullets">${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
    if (p.details && ui.edit !== p.id) h += `<p class="details">${esc(p.details)}</p>`;
    if (p.photo) h += `<img class="photo" src="${p.photo}" alt="${esc(p.photoAlt || 'Photo posted with this problem (no description yet)')}">`;
    h += stepper(st);
    if (st >= 6) h += `<p class="resolved">✓ Resolved ${ago(p.project.resolved.t)}${p.project.resolved.note ? ': ' + esc(p.project.resolved.note) : ''}</p>`;
    const seen = hasSeen(p, u), fol = following(p, u);
    h += `<div class="actions">
      <button class="btn ${seen ? 'on' : ''}" type="button" data-act="seen" data-id="${id}" aria-pressed="${seen}">I see it too · <span class="n">${seenN(p)}</span></button>
      <button class="btn" type="button" data-act="ask" data-id="${id}" aria-expanded="${ui.ask === p.id}">Ask a question</button>
      ${st < 6 ? `<button class="btn primary" type="button" data-act="join" data-id="${id}" aria-expanded="${ui.join === p.id}">${member ? 'On the team ✓' : 'Join the team'}</button>` : ''}
      <button class="btn ${fol ? 'on' : ''}" type="button" data-act="follow" data-id="${id}" aria-pressed="${fol}">${fol ? 'Following ✓' : 'Follow'}</button>
      ${full ? `<button class="btn ghost" type="button" data-act="share" data-id="${id}">Copy link</button><button class="btn ghost" type="button" data-act="report" data-id="${id}">Report</button>` : ''}
    </div>`;
    if (ui.ask === p.id) h += `<form class="inline-form" data-form="ask" data-id="${id}"><div class="row">
      <input class="input" name="q" maxlength="200" required placeholder="A question, not a solution" aria-label="Your question">
      <button class="btn primary" type="submit">Ask</button></div></form>`;
    if (ui.join === p.id && st < 6) {
      const open = p.needs.length ? openSkills(p) : W.skills, mineM = p.team.find(m => m.by === u);
      h += `<div class="inline-form"><p class="label" style="margin:0 0 10px">${mineM ? 'You joined for ' + esc(mineM.skill) + '. Change it, or leave:' : open.length ? 'What would you bring?' : 'Every skill is covered. You can still join as an extra hand:'}</p>
        <div class="opts">${(open.length ? open : W.skills).map(s => `<button type="button" class="chipb blue" data-act="joinSkill" data-id="${id}" data-skill="${esc(s)}" aria-pressed="${!!mineM && mineM.skill === s}">${esc(s)}</button>`).join('')}
        ${mineM ? `<button type="button" class="chipb" data-act="leave" data-id="${id}">Leave the team</button>` : ''}</div></div>`;
    }
    const qs = full ? p.questions : p.questions.slice(-2);
    h += `<section class="sec"><h2>Questions · ${p.questions.length}</h2>${qs.length ? `<ul class="qs">${qs.map(q => qHTML(p, q)).join('')}</ul>` : '<p class="small mono muted">No questions yet.</p>'}
      ${!full && p.questions.length > 2 ? `<p style="margin:12px 0 0"><a class="more" href="#p.${id}">All ${p.questions.length} questions</a></p>` : ''}</section>`;
    h += `<section class="sec"><h2>Team · ${p.team.length}${p.needs.length ? ' of ' + p.needs.length : ''}</h2>${roster(p)}${formBlock(p)}</section>`;
    if (p.project) h += projectSec(p);
    if (!full) {
      const sim = similar(p);
      if (sim.length) h += `<section class="sec"><h2>Similar elsewhere</h2><p class="small muted" style="font-style:italic;margin:0 0 12px">${esc(W.localGlobal)}</p><ul class="golist">${sim.map(goItem).join('')}</ul></section>`;
      h += `<p style="margin:22px 0 0"><a class="more" href="#p.${id}">Open the full page</a></p>`;
    }
    if (mine || S.teamMode) h += ownerTools(p, mine);
    if (p.sample) h += `<p class="small mono muted" style="margin-top:18px">Sample: made up to show how the site works.</p>`;
    return h;
  }
  function qHTML(p, q) {
    const u = who(), canAnswer = !!u && (p.by === u || inTeam(p, u)) && !q.answer;
    const who1 = `<div class="who">${avatar(q.by, 'sm')}${profileLink(q.by)}<span>· ${ago(q.t)}</span></div>`;
    let h = `<li>${who1}<div class="q">${esc(q.text)}</div>`;
    if (q.answer) h += `<div class="ans"><div class="who">${avatar(q.answer.by, 'sm')}${profileLink(q.answer.by)}<span>· ${ago(q.answer.t)}</span></div>${esc(q.answer.text)}</div>`;
    if (canAnswer) h += ui.answer === q.id
      ? `<form class="inline-form" data-form="answer" data-id="${esc(p.id)}" data-q="${esc(q.id)}"><div class="row"><input class="input" name="a" maxlength="300" required placeholder="Your answer" aria-label="Your answer"><button class="btn primary" type="submit">Answer</button></div></form>`
      : `<button class="linkish" type="button" data-act="answer" data-id="${esc(p.id)}" data-q="${esc(q.id)}" style="margin-top:6px">Answer</button>`;
    return h + '</li>';
  }
  function roster(p) {
    const rows = p.team.map(m => `<li>${avatar(m.by, 'sm')}${profileLink(m.by)}<span class="skill">${esc(m.skill)}</span></li>`);
    openSkills(p).forEach(s => rows.push(`<li class="open"><span class="avatar sm" style="border-style:dashed;background:transparent">?</span>Open<span class="skill">${esc(s)}</span></li>`));
    return rows.length ? `<ul class="roster">${rows.join('')}</ul>` : '<p class="small mono muted">Nobody yet. Be the first.</p>';
  }
  function formBlock(p) {
    const u = who();
    if (p.project || !inTeam(p, u)) return '';
    const ready = p.team.length >= 2 || (p.needs.length && !openSkills(p).length);
    if (ui.form === p.id) return `<form class="inline-form" data-form="project" data-id="${esc(p.id)}"><div class="field" style="margin:0 0 10px"><label for="pjName">Name the project</label>
      <input class="input" id="pjName" name="name" maxlength="60" required placeholder="A short name people will remember"></div>
      <div class="row"><button class="btn primary" type="submit">Form the project</button><button class="btn" type="button" data-act="form" data-id="${esc(p.id)}">Cancel</button></div></form>`;
    return ready ? `<p style="margin:14px 0 0"><button class="btn primary" type="button" data-act="form" data-id="${esc(p.id)}">Form the project</button></p>`
      : '<p class="small mono muted" style="margin:12px 0 0">A project needs at least two people, or every skill covered.</p>';
  }
  function projectSec(p) {
    const pr = p.project, member = inTeam(p, who());
    let h = `<section class="sec"><h2>Project · ${esc(pr.name)}</h2><p class="byline">Formed ${ago(pr.t)} by ${profileLink(pr.by)}</p>`;
    h += pr.updates.length ? `<ul class="updates">${pr.updates.map(u => `<li>${esc(u.text)}<span class="w">${esc(nameOf(u.by))} · ${ago(u.t)}</span></li>`).join('')}</ul>` : '<p class="small mono muted">No updates yet.</p>';
    if (member && !pr.resolved) {
      h += `<form class="inline-form" data-form="update" data-id="${esc(p.id)}"><div class="field" style="margin:0 0 10px"><label for="upText">Post an update</label>
        <textarea class="textarea" id="upText" name="u" maxlength="400" required placeholder="What did the team do? What happened?"></textarea></div>
        <div class="row"><button class="btn primary" type="submit">Post update</button><button class="btn" type="button" data-act="resolve" data-id="${esc(p.id)}">Mark resolved</button></div></form>`;
    } else if (member && pr.resolved) {
      h += `<p style="margin:14px 0 0"><button class="btn" type="button" data-act="reopen" data-id="${esc(p.id)}">Reopen</button></p>`;
    }
    return h + '</section>';
  }
  function ownerTools(p, mine) {
    let h = '<section class="sec"><h2>' + (mine ? 'Your post' : 'Team tools') + '</h2><div class="actions">';
    if (mine) h += `<button class="btn" type="button" data-act="edit" data-id="${esc(p.id)}">${ui.edit === p.id ? 'Cancel edit' : 'Edit'}</button>
      <button class="btn danger" type="button" data-act="del" data-id="${esc(p.id)}">${ui.del === p.id ? 'Tap again to delete' : 'Delete'}</button>`;
    if (S.teamMode) h += p.hidden ? `<button class="btn" type="button" data-act="restore" data-id="${esc(p.id)}">Show it again</button>` : `<button class="btn" type="button" data-act="hide" data-id="${esc(p.id)}">Hide from the map</button>`;
    return h + '</div></section>';
  }

  /* ───────── pages ───────── */
  const RENDER = {};
  function stat(n, label) { return `<div><dt>${esc(label)}</dt><dd>${n}</dd></div>`; }

  RENDER.home = () => {
    $('#heroName').textContent = W.name; $('#heroPrompt').textContent = W.prompt;
    const tl = W.tagline.split(' — ');
    $('#heroTitle').innerHTML = tl.length === 2 ? esc(tl[0]) + ' <span class="h-sub">— ' + esc(tl[1]) + '</span>' : esc(W.tagline);
    const P = allProblems(), projects = P.filter(p => stageOf(p) >= 4);
    $('#heroStats').innerHTML = stat(P.length, 'problems') + stat(projects.length, 'projects') + stat(new Set(P.map(p => p.country)).size, 'countries') + stat(Object.keys(S.profiles).length, 'people');
    const recent = P.slice().sort((a, b) => b.t - a.t).slice(0, 4);
    const acting = projects.filter(p => stageOf(p) === 5).sort((a, b) => lastAct(b) - lastAct(a)).slice(0, 3);
    const pairs = [['yangon-shade', 'edmonton-bus'], ['kathmandu-dust', 'jakarta-smoke'], ['hoian-river', 'accra-drain']]
      .map(pr => pr.map(id => S.problems[id]).filter(p => p && visibleP(p))).filter(pr => pr.length === 2);
    // the two questions inside the "Limitation of Existing Solutions" sentence, shown side by side
    const q2 = Array.from(W.limitation.matchAll(/\("([^"]+)"\)/g)).map(m => m[1]);
    const stepHref = ['#map', '#map', '#problems', '#people', '#projects', '#projects'];
    $('#homeRest').innerHTML = `
    <section class="band" id="the-problem"><div class="wrap">
      <h2 class="eyebrow">${esc(W.headings.problem)}</h2>
      <p class="label" style="margin-bottom:12px">${esc(W.coreIssueLabel)}</p>
      <p class="statement">${esc(W.coreIssue)}</p>
      <div class="grid-3" style="margin-top:36px">${W.barriers.map(b => `<article class="panelcard"><i class="g off"></i><h3>${esc(b[0])}</h3><p>${esc(b[1])}</p></article>`).join('')}</div>
      ${q2.length === 2 ? `<div class="versus">
        <div class="side-a"><span class="label">top-down</span><q>${esc(q2[0])}</q></div>
        <div class="arrow" aria-hidden="true">→</div>
        <div class="side-b"><span class="label" style="color:var(--lamp-text)">from the ground up</span><q>${esc(q2[1])}</q></div>
      </div>` : ''}
      <p class="quote"><span class="label">${esc(W.limitationLabel)}</span>${esc(W.limitation)}</p>
    </div></section>
    <section class="band tint" id="the-solution"><div class="wrap">
      <h2 class="eyebrow">${esc(W.headings.solution)}</h2>
      <p class="label" style="margin-bottom:12px">${esc(W.conceptLabel)}</p>
      <p class="statement">${esc(W.concept)}</p>
      <p class="label" style="margin:44px 0 14px">${esc(W.breakthroughsLabel)}</p>
      <div class="grid-3">${W.breakthroughs.map((b, i) => `<article class="panelcard${i === 0 ? ' lit' : ''}"><i class="g ${['s1', 's3', 's5'][i]}"></i><p style="color:var(--ink)">${esc(b)}</p></article>`).join('')}</div>
      <p class="label" style="margin:44px 0 14px">${esc(W.ecosystemLabel)} · ${esc(W.coreInterfaceLabel)}: ${esc(W.coreInterface)}</p>
      <div class="layers3">
        <div><p class="ttl"><i class="g s1"></i>SEE</p><p>${esc(W.layers.see)}</p></div>
        <div><p class="ttl"><i class="g person"></i>CONNECT</p><p>${esc(W.layers.connect)}</p></div>
        <div><p class="ttl"><i class="g s5"></i>ACT</p><p>${esc(W.layers.act)}</p></div>
      </div>
    </div></section>
    <section class="band" id="the-cycle"><div class="wrap">
      <h2 class="eyebrow">${esc(W.headings.cycle)}</h2>
      <ol class="lights" style="margin-top:34px">${CYCLE.map((c, i) => `<li><a href="${stepHref[i]}"${i === 1 ? ' data-action="post"' : ''}><span class="bulb">${i + 1}</span><b>${esc(c[0])}</b><span>${esc(c[1])}</span></a></li>`).join('')}</ol>
      <p class="label" style="margin-top:50px">${esc(W.mindsetLabel)}</p>
      <ol class="mindset">${W.mindset.map(m => `<li>${esc(m)}</li>`).join('')}</ol>
    </div></section>
    <section class="band tint" id="live"><div class="wrap">
      <div class="band-head"><h2 class="h2" style="margin:0">Recently posted</h2><a class="more" href="#problems">All problems</a></div>
      <div class="cards">${recent.map(pcard).join('')}</div>
      <div class="grid-2" style="margin-top:56px;align-items:start">
        <div><div class="band-head"><h2 class="h2" style="margin:0">Projects in action</h2><a class="more" href="#projects">All projects</a></div>
          <div style="display:grid;gap:16px">${acting.map(projcard).join('')}</div></div>
        <div><div class="band-head"><h2 class="h2" style="margin:0">What people are doing</h2></div>
          <ul class="feed">${allEvents().filter(e => e.type !== 'seen').slice(0, 8).map(e => `<li><a href="#p.${esc(e.p.id)}">${avatar(e.by, 'sm')}<span class="t">${eventText(e)}</span><span class="w">${ago(e.t)}</span></a></li>`).join('')}</ul></div>
      </div>
    </div></section>
    <section class="band" id="local-global"><div class="wrap">
      <h2 class="eyebrow">${esc(W.headings.localGlobal)}</h2>
      <h2 class="h2">${esc(W.localGlobalLabel)}</h2>
      <p class="body">${esc(W.localGlobal)}</p>
      <p class="body muted">${esc(W.globalUsers)}</p>
      ${pairs.length ? `<p class="label" style="margin-top:36px">Similar problems in different countries</p><div class="pairs">${pairs.map(pr => `<div class="pair">${pr.map(p => `<a href="#p.${esc(p.id)}"><span class="pin"><i class="g s${stageOf(p)}"></i></span><span><span class="m">${esc(placeOf(p))}</span><span class="t">${esc(p.text)}</span></span></a>`).join('')}</div>`).join('')}</div>` : ''}
    </div></section>
    <section class="band tint" id="trust-preview"><div class="wrap">
      <h2 class="eyebrow">${esc(W.headings.trust)}</h2>
      <div class="grid-3">${W.moderation.map((m, i) => `<article class="panelcard"><i class="g ${['s1', 's3', 's5'][i]}"></i><h3>${esc(m[0])}</h3><p>${esc(m[1])}</p></article>`).join('')}</div>
      <p style="margin-top:28px"><a class="more" href="#trust">How safety works in this mock-up</a></p>
    </div></section>
    <section class="band cta-band" id="join-us"><div class="stars" aria-hidden="true"></div><div class="wrap" style="position:relative">
      <h2 class="eyebrow">${esc(W.ctaLabel)}</h2>
      <p class="h-display" style="max-width:20ch">“${esc(W.cta)}”</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:36px">
        <a class="btn primary big" href="${who() ? '#map' : '#join'}"${who() ? ' data-action="post"' : ''}>${who() ? esc(W.prompt) : 'Join'}</a>
        <a class="btn big" href="#about">About the project</a>
      </div>
    </div></section>`;
  };
  const lastAct = p => Math.max(p.t, ...events(p).map(e => e.t));

  // Problems
  const PF = { q: '', scale: '', stage: '', tag: '', sort: 'new' };
  RENDER.problems = () => {
    const v = $('#view-problems');
    if (!v.dataset.built) {
      v.innerHTML = `<div class="wrap"><header class="page-head"><div><h1>Problems</h1><p class="sub" id="pSub"></p></div>
        <a class="btn primary" href="#map" data-action="post">${esc(W.prompt)}</a></header>
        <div class="toolbar" role="search">
          <input class="input" id="pQ" type="search" placeholder="Search problems and places" aria-label="Search problems">
          <select class="select" id="pScale" aria-label="Scale"><option value="">Any scale</option>${SCALES.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select>
          <select class="select" id="pStage" aria-label="Stage"><option value="">Any stage</option>${STAGE_GROUPS.map(g => `<option value="${g[0]}">${g[1]}</option>`).join('')}</select>
          <select class="select" id="pTag" aria-label="Topic"><option value="">Any topic</option>${D.TAGS.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
          <select class="select" id="pSort" aria-label="Sort"><option value="new">Newest</option><option value="seen">Most seen</option><option value="help">Needs people</option><option value="active">Recently active</option></select>
        </div><h2 class="sr-only">Problems in this list</h2><div id="pList"></div></div>`;
      v.dataset.built = '1';
      const upd = () => { PF.q = $('#pQ').value; PF.scale = $('#pScale').value; PF.stage = $('#pStage').value; PF.tag = $('#pTag').value; PF.sort = $('#pSort').value; renderPList(); };
      $('#pQ').addEventListener('input', debounce(upd, 150));
      ['#pScale', '#pStage', '#pTag', '#pSort'].forEach(s => $(s).addEventListener('change', upd));
    }
    renderPList();
  };
  function renderPList() {
    const f = fold(PF.q.trim());
    let P = allProblems().filter(p => (!f || fold(p.text + ' ' + placeOf(p) + ' ' + (p.tags || []).join(' ') + ' ' + (p.project ? p.project.name : '')).includes(f))
      && (!PF.scale || p.scale === PF.scale) && (!PF.tag || (p.tags || []).includes(PF.tag))
      && (!PF.stage || STAGE_GROUPS.find(g => g[0] === PF.stage)[2](stageOf(p))));
    const sorts = { new: (a, b) => b.t - a.t, seen: (a, b) => seenN(b) - seenN(a), help: (a, b) => openSkills(b).length - openSkills(a).length || b.t - a.t, active: (a, b) => lastAct(b) - lastAct(a) };
    P.sort(sorts[PF.sort]);
    $('#pSub').textContent = `${P.length} of ${allProblems().length} problems · ${new Set(P.map(p => p.country)).size} countries`;
    $('#pList').innerHTML = P.length ? `<div class="cards">${P.map(pcard).join('')}</div>` : '<div class="empty">Nothing matches. Clear a filter, or post the first one.</div>';
  }

  // Projects
  let projF = '';
  RENDER.projects = () => {
    const P = allProblems().filter(p => stageOf(p) >= 4 && (!projF || (projF === 'create' ? stageOf(p) === 4 : projF === 'act' ? stageOf(p) === 5 : stageOf(p) === 6)))
      .sort((a, b) => lastAct(b) - lastAct(a));
    const opts = [['', 'All'], ['create', 'CREATE'], ['act', 'ACT'], ['resolved', 'RESOLVED']];
    $('#view-projects').innerHTML = `<div class="wrap"><header class="page-head"><div><h1>Projects</h1><p class="sub">${esc(W.layers.act)}</p></div></header>
      <div class="toolbar"><span class="label">Show</span>${opts.map(o => `<button class="chipb" type="button" data-act="projF" data-id="${o[0]}" aria-pressed="${projF === o[0]}">${o[1]}</button>`).join('')}</div>
      <h2 class="sr-only">Projects in this list</h2>${P.length ? `<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${P.map(projcard).join('')}</div>` : '<div class="empty">No projects here yet. A project forms when a team comes together around a problem.</div>'}
      <div style="height:64px"></div></div>`;
  };

  // People
  let peopleF = '';
  RENDER.people = () => {
    const ppl = Object.values(S.profiles).filter(pr => !peopleF || pr.skills.includes(peopleF))
      .sort((a, b) => (b.id === who()) - (a.id === who()) || (!!a.sample - !!b.sample) || a.name.localeCompare(b.name));
    $('#view-people').innerHTML = `<div class="wrap"><header class="page-head"><div><h1>People</h1><p class="sub">${esc(W.layers.connect)}</p></div>
      ${who() ? '' : '<a class="btn primary" href="#join">Join</a>'}</header>
      <div class="toolbar"><span class="label">Skill</span><button class="chipb blue" type="button" data-act="peopleF" data-id="" aria-pressed="${!peopleF}">Everyone</button>${W.skills.map(s => `<button class="chipb blue" type="button" data-act="peopleF" data-id="${esc(s)}" aria-pressed="${peopleF === s}">${esc(s)}</button>`).join('')}</div>
      <h2 class="sr-only">People in this list</h2><div class="cards">${ppl.map(personcard).join('')}</div><div style="height:64px"></div></div>`;
  };

  // One problem
  RENDER.problem = r => {
    const p = S.problems[r.id];
    if (!p || !visibleP(p)) return RENDER['404'](r);
    const sim = similar(p, 4);
    const tagsHTML = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join(' ');
    $('#view-problem').innerHTML = `<div class="wrap">
      <p class="crumbs"><a href="#problems">Problems</a> / ${esc(placeOf(p))}</p>
      <div class="detail"><article>${problemMain(p, true)}</article>
      <div class="side">
        <div class="sidebox"><img class="locbig" src="${locator(p.lat, p.lon, 150)}" alt="${esc('Where it is on the globe: ' + placeOf(p))}" width="150" height="150">
          <dl class="facts"><dt>Where</dt><dd>${esc(placeOf(p))}${p.approx ? '<br><span class="small muted">approximate spot, to keep homes private</span>' : ''}</dd>
          <dt>Scale</dt><dd>${esc(SCALE_LABEL[p.scale])}</dd><dt>Posted</dt><dd>${fmtDate(p.t)}</dd>${tagsHTML ? `<dt>Topics</dt><dd>${tagsHTML}</dd>` : ''}
          <dt>Stage</dt><dd>${stageLabel(stageOf(p))}</dd><dt>On the globe</dt><dd class="coord" style="font-size:13px">${coord(p.lat, p.lon)}</dd></dl>
          <p style="margin:14px 0 0"><button class="btn" type="button" data-act="showOnMap" data-id="${esc(p.id)}" style="width:100%">Show on the map</button></p></div>
        ${sim.length ? `<div class="sidebox"><h3>Similar elsewhere</h3><p class="small muted" style="font-style:italic;margin:0 0 12px">${esc(W.localGlobal)}</p><ul class="golist">${sim.map(goItem).join('')}</ul></div>` : ''}
      </div></div></div>`;
  };

  // A person
  RENDER.profile = r => {
    const pr = S.profiles[r.id];
    if (!pr) return RENDER['404'](r);
    const posts = allProblems().filter(p => p.by === pr.id).sort((a, b) => b.t - a.t);
    const teams = allProblems().filter(p => inTeam(p, pr.id) && p.by !== pr.id);
    const isMe = pr.id === who();
    $('#view-profile').innerHTML = `<div class="wrap">
      <p class="crumbs"><a href="#people">People</a> / ${esc(pr.name)}</p>
      <header class="profile-head">${avatar(pr.id, 'lg')}<div><h1>${esc(pr.name)}</h1>
        <p class="byline" style="margin:8px 0 10px">${esc([pr.city, pr.country].filter(Boolean).join(', '))} · joined ${fmtDate(pr.joined)}</p>
        <div class="chips">${pr.skills.map(s => `<span class="chip">${esc(s)}</span>`).join('')}${pr.sample ? '<span class="chip sample">sample person</span>' : ''}${isMe ? '<span class="chip mine">you</span>' : ''}</div></div>
        ${isMe ? '<a class="btn" href="#me" style="margin-left:auto">Edit your page</a>' : ''}</header>
      ${pr.bio ? `<p class="body" style="margin:10px 0 0">${esc(pr.bio)}</p>` : ''}
      ${pr.cares && pr.cares.length ? `<p class="label" style="margin:22px 0 8px">Cares about</p><p style="margin:0">${pr.cares.map(t => `<span class="tag">${esc(t)}</span>`).join(' ')}</p>` : ''}
      <div class="band-head" style="margin:40px 0 16px"><h2 class="h2" style="margin:0">Posted</h2></div>
      ${posts.length ? `<div class="cards">${posts.map(pcard).join('')}</div>` : '<div class="empty">Nothing posted yet.</div>'}
      <div class="band-head" style="margin:40px 0 16px"><h2 class="h2" style="margin:0">On teams</h2></div>
      ${teams.length ? `<div class="cards">${teams.map(pcard).join('')}</div>` : '<div class="empty">Not on any team yet.</div>'}
      <div style="height:64px"></div></div>`;
  };

  // Your page
  let meTab = 'notes';
  RENDER.me = () => {
    const v = $('#view-me'), u = who(), pr = meP();
    if (!pr) {
      v.innerHTML = `<div class="wrap formwrap"><div class="formcard"><h1 class="h2">Your page</h1>
        <p class="body">Join to post problems, join teams, and hear back when someone answers.</p>
        <p style="margin-top:20px"><a class="btn primary big" href="#join">Join</a> <a class="btn big" href="#map" style="margin-left:8px">Look around first</a></p></div>
        ${demoTools()}</div>`;
      return;
    }
    const tabs = [['notes', 'Notifications' + (unread(u) ? ' · ' + unread(u) : '')], ['posts', 'Your posts'], ['teams', 'Your teams'], ['following', 'Following'], ['settings', 'Settings']];
    let body = '';
    if (meTab === 'notes') {
      const list = notesFor(u), lr = S.lastRead[u] || 0;
      body = list.length ? `<p style="margin:0 0 12px"><button class="linkish" type="button" data-act="markRead">Mark all read</button></p><ul class="feed">${list.map(e => `<li${e.t > lr ? ' style="background:var(--yellow-soft)"' : ''}><a href="#p.${esc(e.p.id)}">${avatar(e.by, 'sm')}<span class="t">${eventText(e)}</span><span class="w">${ago(e.t)}</span></a></li>`).join('')}</ul>`
        : '<div class="empty">No news yet. Follow a problem or join a team, and updates about it land here.</div>';
    } else if (meTab === 'posts') {
      const P = Object.values(S.problems).filter(p => p.by === u).sort((a, b) => b.t - a.t);
      body = P.length ? `<div class="cards">${P.map(pcard).join('')}</div>` : `<div class="empty">You haven't posted yet. <a href="#map" data-action="post">${esc(W.prompt)}</a></div>`;
    } else if (meTab === 'teams') {
      const P = allProblems().filter(p => inTeam(p, u));
      body = P.length ? `<div class="cards">${P.map(pcard).join('')}</div>` : '<div class="empty">Not on a team yet. <a href="#people">Find people</a> or <a href="#problems">find a problem</a>.</div>';
    } else if (meTab === 'following') {
      const P = allProblems().filter(p => following(p, u));
      body = P.length ? `<div class="cards">${P.map(pcard).join('')}</div>` : '<div class="empty">You\'re not following anything yet.</div>';
    } else {
      body = `<div class="settings">
        <form class="setting" data-form="profile"><h3>Your profile</h3><p>First name and city only. That's all anyone sees.</p>
          ${profileFields(pr)}<button class="btn primary" type="submit">Save profile</button></form>
        <div class="setting"><h3>Night or day</h3><p>The whole site switches. The moon button at the top does the same.</p><div class="opts">${[['night', 'Night'], ['day', 'Day']].map(t => `<button type="button" class="chipb" data-act="theme" data-id="${t[0]}" aria-pressed="${S.theme === t[0]}">${t[1]}</button>`).join('')}</div></div>
        ${demoTools()}
        <div class="setting"><h3>Sign out</h3><p>Your profile stays in this browser. Sign back in by joining with the same device.</p><button class="btn" type="button" data-act="signOut">Sign out</button></div></div>`;
    }
    v.innerHTML = `<div class="wrap"><header class="profile-head">${avatar(u, 'lg')}<div><h1>${esc(pr.name)}</h1>
      <p class="byline" style="margin:8px 0 0">${esc([pr.city, pr.country].filter(Boolean).join(', '))} · <a href="#u.${esc(u)}">see your public page</a></p></div></header>
      <div class="tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" data-act="meTab" data-id="${t[0]}" aria-selected="${meTab === t[0]}">${esc(t[1])}</button>`).join('')}</div>
      ${body}<div style="height:64px"></div></div>`;
  };
  function demoTools() {
    const ppl = Object.values(S.profiles).filter(p => p.id !== S.me);
    return `<div class="setting" style="margin-top:18px"><h3>Demo tools</h3>
      <p>Try it from someone else's side: act as a sample person, then switch back to see what reached you.</p>
      <div class="field"><label for="actAsSel">Act as</label><select class="select" id="actAsSel" data-act-change="actAs"><option value="">${S.me ? 'Me (' + esc(nameOf(S.me)) + ')' : 'Nobody'}</option>${ppl.map(p => `<option value="${esc(p.id)}"${S.actAs === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <label class="check" style="margin:0 0 14px"><input type="checkbox" data-act-change="teamMode"${S.teamMode ? ' checked' : ''}> Team mode: see reports and hidden posts (the <a href="#mod">moderation page</a>)</label>
      <button class="btn danger" type="button" data-act="reset">${ui.reset ? 'Tap again: erase everything I added' : 'Reset the demo'}</button></div>`;
  }
  function profileFields(pr) {
    pr = pr || {};
    return `<div class="field"><label for="jfName">First name or nickname</label><input class="input" id="jfName" name="name" maxlength="30" required autocomplete="given-name" value="${esc(pr.name || '')}"></div>
      <div class="field"><label for="jfCity">Your city</label><input class="input" id="jfCity" name="city" list="cityList" maxlength="60" required autocomplete="off" value="${esc(pr.city ? pr.city + (pr.country ? ', ' + pr.country : '') : '')}" placeholder="Start typing, e.g. Hội An">
        <span class="hint">Only the city shows. Never your street.</span></div>
      <fieldset class="field" style="border:0;padding:0;margin:0 0 18px"><legend class="flabel" style="font:700 11px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">What you can bring</legend>
        <div class="opts">${W.skills.map(s => `<label class="opt"><input type="checkbox" name="skill" value="${esc(s)}"${(pr.skills || []).includes(s) ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></fieldset>
      <fieldset class="field" style="border:0;padding:0;margin:0 0 18px"><legend class="flabel" style="font:700 11px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">What you care about</legend>
        <div class="opts">${D.TAGS.map(s => `<label class="opt"><input type="checkbox" name="care" value="${esc(s)}"${(pr.cares || []).includes(s) ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></fieldset>
      <div class="field"><label for="jfBio">One line about you <span class="muted">(optional)</span></label><input class="input" id="jfBio" name="bio" maxlength="120" value="${esc(pr.bio || '')}"></div>`;
  }
  function cityDatalist() {
    if ($('#cityList')) return;
    const dl = document.createElement('datalist'); dl.id = 'cityList';
    dl.innerHTML = PL.slice(0, 700).map(p => `<option value="${esc(p.name + ', ' + p.country)}">`).join('');
    document.body.appendChild(dl);
  }
  function matchCity(v) {
    const f = fold(v.split(',')[0].trim()), c = fold((v.split(',')[1] || '').trim());
    return PL.find(p => fold(p.name) === f && (!c || fold(p.country).startsWith(c))) || PL.find(p => fold(p.name) === f) || null;
  }

  // Join
  RENDER.join = () => {
    cityDatalist();
    const v = $('#view-join'), pr = S.me && S.profiles[S.me];
    if (pr) { v.innerHTML = `<div class="wrap formwrap"><div class="formcard"><h1 class="h2">You're in, ${esc(pr.name)}.</h1><p class="body">Everything you do is saved in this browser.</p><p style="margin-top:18px"><a class="btn primary" href="#me">Your page</a> <a class="btn" href="#map" style="margin-left:8px">Go to the map</a></p></div></div>`; return; }
    v.innerHTML = `<div class="wrap formwrap"><header class="page-head" style="padding-top:0"><div><h1>Join</h1><p class="sub">${esc(W.cta)}</p></div></header>
      <form class="formcard" data-form="join" novalidate>
        <p class="okbox">Demo: your profile is saved only in this browser. In the real version you'd get an invite code from your group.</p>
        ${profileFields(null)}
        <div class="field"><label for="jfCode">Invite code</label><input class="input" id="jfCode" name="code" maxlength="20" autocomplete="off" placeholder="From your group"><span class="hint">Beta is invite-only, so strangers can't join. Any code works in the demo.</span></div>
        <label class="check" style="margin:6px 0 20px"><input type="checkbox" name="agree" required> I've read the <a href="#trust">community guidelines</a>.</label>
        <div id="joinErr"></div>
        <button class="btn primary big" type="submit">Join</button>
      </form></div>`;
  };

  // About
  RENDER.about = () => {
    $('#view-about').innerHTML = `<div class="wrap">
      <header class="page-head"><div><h1>About</h1><p class="sub">${esc(W.tagline)}</p></div></header>
      <section class="band" style="border-top:0;padding-top:10px"><h2 class="eyebrow">${esc(W.headings.solution)}</h2><p class="label">${esc(W.conceptLabel)}</p><p class="statement">${esc(W.concept)}</p>
        <p class="label" style="margin:30px 0 12px">${esc(W.breakthroughsLabel)}</p><div class="grid-3">${W.breakthroughs.map(b => `<article class="panelcard"><p>${esc(b)}</p></article>`).join('')}</div></section>
      <section class="band"><h2 class="eyebrow">${esc(W.headings.product)}</h2><p class="label">${esc(W.coreInterfaceLabel)}</p><p class="statement">${esc(W.coreInterface)}</p>
        <p class="label" style="margin:30px 0 12px">${esc(W.ecosystemLabel)}</p><div class="layers3">
        <div><p class="ttl"><i class="g s1"></i>SEE</p><p>${esc(W.layers.see)}</p></div><div><p class="ttl"><i class="g person"></i>CONNECT</p><p>${esc(W.layers.connect)}</p></div><div><p class="ttl"><i class="g s5"></i>ACT</p><p>${esc(W.layers.act)}</p></div></div></section>
      <section class="band"><h2 class="eyebrow">${esc(W.headings.localGlobal)}</h2><h2 class="h2">${esc(W.localGlobalLabel)}</h2><p class="body">${esc(W.localGlobal)}</p><p class="body">${esc(W.globalUsers)}</p></section>
      <section class="band"><h2 class="eyebrow">${esc(W.headings.business)}</h2><div class="grid-3">${W.business.map(b => `<article class="panelcard"><h3>${esc(b[0])}</h3><p>${esc(b[1])}</p></article>`).join('')}</div></section>
      <section class="band"><h2 class="eyebrow">${esc(W.headings.roadmap)}</h2><ol class="roadmap">${W.roadmap.map(r => `<li><b>${esc(r[0])}</b><span>${esc(r[1])}</span></li>`).join('')}</ol></section>
      <section class="band"><h2 class="eyebrow">${esc(W.headings.team)}</h2><div class="grid-4">${W.team.map(t => `<article class="panelcard"><h3>${esc(t[0])}</h3><p>${esc(t[1])}</p></article>`).join('')}</div></section>
      <section class="band" id="contact"><h2 class="eyebrow">${esc(W.headings.cta)}</h2><p class="statement">"${esc(W.cta)}"</p>
        <div class="grid-2" style="margin-top:28px;align-items:start">
          <div><p class="label">${esc(W.needsLabel)}</p><p class="body" style="margin-top:6px">${esc(W.needs)}</p><p class="label" style="margin-top:22px">${esc(W.contactLabel)}</p><p class="body" style="margin-top:6px">${esc(W.contact)}</p></div>
          <form class="formcard" data-form="contact"><div class="field"><label for="cfName">Your name</label><input class="input" id="cfName" name="name" maxlength="60" required></div>
            <div class="field"><label for="cfMsg">Message</label><textarea class="textarea" id="cfMsg" name="msg" maxlength="1200" required></textarea></div>
            <button class="btn primary" type="submit">Send</button><p class="small mono muted" style="margin:12px 0 0">Demo: messages are saved in this browser, not sent.</p></form>
        </div></section><div style="height:40px"></div></div>`;
  };

  // Trust & safety
  RENDER.trust = () => {
    $('#view-trust').innerHTML = `<div class="wrap">
      <header class="page-head"><div><h1>Trust &amp; safety</h1><p class="sub">${esc(W.headings.trust)}</p></div></header>
      <h2 class="sr-only">From the pitch</h2><div class="grid-3">${W.moderation.map(m => `<article class="panelcard"><h3>${esc(m[0])}</h3><p>${esc(m[1])}</p></article>`).join('')}</div>
      <section class="band" style="margin-top:48px"><h2 class="h2">How this mock-up does it</h2><div class="grid-2">
        <article class="panelcard"><h3>Verification</h3><p>"I see it too" is one tap per person, and the count is on every problem.</p></article>
        <article class="panelcard"><h3>Status on every pin</h3><p>Each problem shows where it is in the cycle, from SHARE to RESOLVED. Resolved ones turn into white rings.</p></article>
        <article class="panelcard"><h3>Automatic check</h3><p>Before a post goes up, it's checked for phone numbers, emails, links, shouting, and a pin that's far from the city the text mentions. This is a simple stand-in for the AI moderation.</p></article>
        <article class="panelcard"><h3>Homes stay private</h3><p>Street-level pins are moved to an approximate spot about 200 m away, and profiles show a first name and a city only.</p></article>
        <article class="panelcard"><h3>Report, then review</h3><p>Anyone can report a post. The team sees reports on the moderation page and can hide a post from the map.</p></article>
        <article class="panelcard"><h3>Invite-only beta</h3><p>Joining needs a code from your group, so strangers can't sign up while it's small.</p></article>
      </div></section>
      <section class="band"><h2 class="h2">Community guidelines</h2><p class="small mono muted" style="margin:0 0 16px">Draft, for the team to rewrite.</p>
        <ol class="bullets" style="max-width:62ch"><li>Post what you see. No names, faces, phone numbers or house numbers.</li><li>Ask before you fix. A question helps more than an answer at first.</li><li>Be kind about places and the people in them.</li><li>If a post looks wrong or unsafe, report it instead of arguing.</li></ol></section>
      <section class="band"><h2 class="h2">Other services this site uses</h2><p class="body">Map tiles come from OpenFreeMap (OpenStreetMap data). Street search goes to Photon by komoot, which sees what you type in the search box. Nothing else leaves your browser in this mock-up.</p></section>
      <div style="height:40px"></div></div>`;
  };

  // Moderation
  RENDER.mod = () => {
    const v = $('#view-mod');
    if (!S.teamMode) { v.innerHTML = `<div class="wrap formwrap"><div class="formcard"><h1 class="h2">Moderation</h1><p class="body">Only the team sees this page. For the demo, turn on Team mode in <a href="#me">your page → Settings</a>.</p></div></div>`; return; }
    const open = S.reports.filter(r => r.status === 'open' && S.problems[r.target]);
    const hidden = Object.values(S.problems).filter(p => p.hidden);
    v.innerHTML = `<div class="wrap"><header class="page-head"><div><h1>Moderation</h1><p class="sub">${open.length} open ${open.length === 1 ? 'report' : 'reports'} · ${hidden.length} hidden</p></div></header>
      ${open.length ? open.map(r => { const p = S.problems[r.target]; return `<div class="formcard" style="margin-bottom:16px"><p class="label">${esc(r.reason)} · reported by ${esc(nameOf(r.by))} · ${ago(r.t)}</p>${r.note ? `<p class="body" style="margin:6px 0 14px">“${esc(r.note)}”</p>` : ''}
        <div class="cards" style="grid-template-columns:1fr">${pcard(p)}</div>
        <div class="actions" style="margin-top:14px"><button class="btn" type="button" data-act="modHide" data-id="${esc(r.id)}">Hide the post</button><button class="btn" type="button" data-act="modDismiss" data-id="${esc(r.id)}">Nothing wrong</button></div></div>`; }).join('') : '<div class="empty">No open reports.</div>'}
      ${hidden.length ? `<div class="band-head" style="margin:40px 0 16px"><h2 class="h2" style="margin:0">Hidden posts</h2></div><div class="cards">${hidden.map(pcard).join('')}</div>` : ''}
      <div style="height:64px"></div></div>`;
  };

  RENDER['404'] = () => {
    const v = $('#view-404'); v.hidden = false;
    VIEWS.forEach(n => { if (n !== '404') { const el = $('#view-' + n); if (el) el.hidden = true; } });
    v.innerHTML = `<div class="wrap formwrap"><div class="formcard"><h1 class="h2">Not found</h1><p class="body">That page or post isn't here. It may have been deleted.</p><p style="margin-top:16px"><a class="btn primary" href="#home">Home</a> <a class="btn" href="#problems" style="margin-left:8px">Problems</a></p></div></div>`;
  };

  /* ───────── the map page ───────── */
  RENDER.map = () => {
    $('#ctaText').textContent = W.prompt;
    setLayerUI();
    if (!$('#mpanel').hidden) renderPanel();
    whenMapReady(() => { refreshMap(); updateWhere(); if (R.sub && S.problems[R.sub]) select(R.sub, { fly: true }); });
    if (S.draft && who()) { const d = S.draft; S.draft = null; save(); whenMapReady(() => { pending = d; openPanel('post'); }); }
  };
  const LEGEND = {
    see: '<span><i class="g s1"></i>SHARE · DISCOVER</span><span><i class="g s3"></i>CONNECT</span><span><i class="g s5"></i>CREATE · ACT</span><span><i class="g s6"></i>RESOLVED</span>',
    connect: '<span><i class="g person"></i>PERSON</span><span><i class="g team"></i>TEAM FORMING</span>',
    act: '<span><i class="g s5"></i>PROJECT</span><span><i class="g s6"></i>RESOLVED</span>'
  };
  function setLayerUI() {
    $$('.seg button').forEach(b => b.setAttribute('aria-selected', b.dataset.layer === layer ? 'true' : 'false'));
    $('#layerNote').textContent = W.layers[layer];
    $('#legend').innerHTML = LEGEND[layer];
    const n = filt.tags.length + filt.scales.length + filt.stages.length + (skillF ? 1 : 0);
    $('#filterCount').textContent = n ? ' · ' + n : '';
  }
  function setLayer(l) {
    layer = l; setLayerUI(); refreshMap();
    if (panelMode === 'item' && selId && selId.startsWith('u-') && l !== 'connect') closePanel();
    if (panelMode === 'list') renderPanel();
    updateWhere();
  }
  $$('.seg button').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.layer)));
  $$('.ladder button').forEach(b => b.addEventListener('click', () => goLevel(+b.dataset.level)));
  function goLevel(i) {
    const c = MapView.center();
    const sel = selId && (S.problems[selId] || S.profiles[selId]);
    if (sel && panelMode === 'item' && MapView.isOnScreen(sel.lon, sel.lat)) { MapView.flyTo(sel.lon, sel.lat, i === 0 ? 'world' : LEVEL_KM[i], { offset: panelOffset() }); return; }
    MapView.flyTo(c.lng, c.lat, i === 0 ? 'world' : LEVEL_KM[i]);
  }
  function panelOffset() {
    const el = $('#appMap'), w = el.clientWidth, h = el.clientHeight;
    return w <= 760 ? [0, -Math.round(h * 0.22)] : [-Math.min(215, Math.round(w / 2 - 170)), 0];
  }
  let lastLevel = -1;
  function updateLevel() {
    const li = MapView.level();
    if (li === lastLevel) return;
    lastLevel = li;
    $$('.ladder button').forEach((b, i) => b.setAttribute('aria-current', i === li ? 'true' : 'false'));
    $('#whereLvl').textContent = LEVEL_NAMES[li]; $('#whereLvl').hidden = li === 0;
    $('#placeScale').textContent = LEVEL_NAMES[li];
  }
  function nearest(lat, lon) { let best = null, bd = Infinity; for (const p of PL) { const d = hav(lat, lon, p.lat, p.lon); if (d < bd) { bd = d; best = p; } } return { p: best, km: bd }; }
  function inViewItems() {
    const c = MapView.center();
    return mapItems().filter(it => MapView.isOnScreen(it.lon, it.lat)).map(it => ({ it, d: hav(c.lat, c.lng, it.lat, it.lon) })).sort((a, b) => a.d - b.d).map(x => x.it);
  }
  function updateWhere() {
    if (!MapView.ready()) return;
    lastLevel = -1; updateLevel();
    const li = MapView.level(), c = MapView.center(), n = nearest(c.lat, c.lng);
    let txt = 'The whole world';
    if (li === 1) txt = n.p ? 'Around ' + n.p.country : 'Open water';
    else if (li === 2) txt = n.p && n.km < 900 ? n.p.country : 'Open water';
    else if (li >= 3) txt = n.p && n.km < 60 ? 'Near ' + n.p.name + ', ' + n.p.country : n.p && n.km < 400 ? n.p.country : 'Open water';
    $('#whereTxt').textContent = txt;
    $('#listBtn').textContent = inViewItems().length + ' in view · list';
    if (panelMode === 'list') renderPanel();
  }

  // hover label
  function showTip(h) {
    const tip = $('#tip');
    if (!h || R.name !== 'map') { tip.hidden = true; return; }
    const pr = S.profiles[h.id], p = S.problems[h.id];
    if (pr) tip.innerHTML = `<span class="m">${esc(pr.city)}</span>${esc(pr.name)}: ${esc(pr.skills.join(', '))}`;
    else if (p) tip.innerHTML = `<span class="m">${esc(placeOf(p))} · ${esc(SCALE_LABEL[p.scale])}</span>${esc(layer === 'act' && p.project ? p.project.name : p.text)}`;
    else { tip.hidden = true; return; }
    tip.hidden = false;
    const box = $('#appMap'), tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(h.x + 14, 8, box.clientWidth - tw - 8) + 'px';
    tip.style.top = clamp(h.y - th - 12, 8, box.clientHeight - th - 8) + 'px';
  }
  function hideTip() { $('#tip').hidden = true; }

  // panel
  function openPanel(mode) {
    panelMode = mode; $('#mpanel').hidden = false; $('#appMap').classList.add('panel-open');
    $('#cta').hidden = mode === 'post' || placing;
    renderPanel(); $('#mpanelBody').scrollTop = 0;
  }
  function closePanel() {
    $('#mpanel').hidden = true; $('#appMap').classList.remove('panel-open');
    panelMode = null; selId = null; pending = null; refreshMap();
    if (!placing) $('#cta').hidden = false;
  }
  function select(id, opt) {
    opt = opt || {};
    if (id !== selId) { ui.ask = ui.join = ui.answer = ui.form = ui.edit = ui.del = null; }
    const isPerson = id.startsWith('u-');
    if (isPerson && layer !== 'connect') setLayer('connect');
    if (!isPerson && !mapItems().some(it => it.id === id)) { layer = 'see'; filt.tags = []; filt.scales = []; filt.stages = []; skillF = null; setLayerUI(); }
    selId = id; openPanel('item'); refreshMap();
    const it = isPerson ? S.profiles[id] : S.problems[id];
    if (!it) return;
    const el = $('#appMap');
    if (opt.fly) {
      const km = isPerson ? 60 : it.scale === 'world' ? 'world' : ITEM_KM[it.scale] || 30;
      MapView.flyTo(it.lon, it.lat, km, { offset: km === 'world' ? [0, 0] : panelOffset() });
      return;
    }
    const pt = MapView.project(it.lon, it.lat), w = el.clientWidth, h = el.clientHeight;
    const covered = !pt || !MapView.isOnScreen(it.lon, it.lat) || (w <= 760 ? pt.y > h * 0.36 : pt.x > w - 440);
    if (covered) {
      const z = w <= 760 && MapView.level() === 0 ? MapView.zoomForKm(5200, it.lat) : MapView.zoom();
      MapView.flyTo(it.lon, it.lat, null, { zoom: z, offset: panelOffset(), ease: true, duration: 650 });
    }
  }
  function renderPanel() {
    const b = $('#mpanelBody');
    const head = t => `<div class="p-head"><span class="label">${t}</span><button class="x" type="button" data-act="closePanel" aria-label="Close">×</button></div>`;
    if (panelMode === 'post') { b.innerHTML = postForm(); bindPostForm(); return; }
    if (panelMode === 'list') {
      const items = inViewItems();
      const noun = { see: 'problems', connect: 'people and teams', act: 'projects' }[layer];
      b.innerHTML = head('In view') + `<p class="byline" style="margin:12px 0">${items.length} ${noun} · ${esc($('#whereTxt').textContent)}</p>` +
        (items.length ? `<ul class="golist">${items.map(it => {
          if (it.kind === 'person') { const pr = S.profiles[it.id]; return `<li><a href="#" data-act="pick" data-id="${esc(it.id)}"><i class="g person"></i><span><span class="m">${esc(pr.city)}</span><span class="t">${esc(pr.name)}</span></span></a></li>`; }
          const p = S.problems[it.id]; return `<li><a href="#" data-act="pick" data-id="${esc(p.id)}"><i class="g ${glyph(it)}"></i><span><span class="m">${esc(placeOf(p))} · ${esc(SCALE_LABEL[p.scale])}</span><span class="t">${esc(layer === 'act' && p.project ? p.project.name : p.text)}</span></span></a></li>`;
        }).join('')}</ul>` : '<p class="small mono muted">Nothing here yet. Zoom out, or post the first one.</p>');
      return;
    }
    if (!selId) return;
    const pr = S.profiles[selId];
    if (pr) {
      const teams = allProblems().filter(p => stageOf(p) <= 3 && openSkills(p).some(s => pr.skills.includes(s)))
        .map(p => ({ p, o: (p.tags || []).filter(t => pr.cares.includes(t)).length, d: hav(pr.lat, pr.lon, p.lat, p.lon) }))
        .sort((a, b) => b.o - a.o || a.d - b.d).slice(0, 4).map(x => x.p);
      b.innerHTML = head('Person') + `<div style="display:flex;gap:14px;align-items:center;margin:14px 0">${avatar(pr.id, 'lg')}<div><p class="h3">${esc(pr.name)}</p><p class="byline" style="margin:4px 0 0">${esc(pr.city)}, ${esc(pr.country)}</p></div></div>
        <div class="chips">${pr.skills.map(s => `<span class="chip">${esc(s)}</span>`).join('')}${pr.sample ? '<span class="chip sample">sample</span>' : ''}</div>
        ${pr.cares && pr.cares.length ? `<p class="label" style="margin:18px 0 6px">Cares about</p><p style="margin:0">${pr.cares.map(t => `<span class="tag">${esc(t)}</span>`).join(' ')}</p>` : ''}
        <section class="sec"><h2>Teams that need their skills</h2>${teams.length ? `<ul class="golist">${teams.map(p => {
          const inv = !!(S.invites && S.invites[pr.id + ':' + p.id]);
          return `<li><a href="#" data-act="pick" data-id="${esc(p.id)}"><i class="g s${stageOf(p)}"></i><span><span class="m">${esc(placeOf(p))} · needs ${esc(openSkills(p).filter(s => pr.skills.includes(s)).join(', '))}</span><span class="t">${esc(p.text)}</span></span></a>
            <button class="btn ${inv ? 'on' : ''}" type="button" data-act="invite" data-id="${esc(p.id)}" data-person="${esc(pr.id)}" style="margin-top:6px">${inv ? 'Invite saved ✓' : 'Invite to this team'}</button></li>`;
        }).join('')}</ul>` : '<p class="small mono muted">No open teams need these skills right now.</p>'}</section>
        <p style="margin:20px 0 0"><a class="more" href="#u.${esc(pr.id)}">Open their page</a></p>`;
      return;
    }
    const p = S.problems[selId];
    if (!p || !visibleP(p)) { closePanel(); return; }
    b.innerHTML = head(layer === 'act' && p.project ? 'Project' : 'Problem') + problemMain(p, false);
  }
  $('#listBtn').addEventListener('click', () => { if (panelMode === 'list') closePanel(); else { selId = null; openPanel('list'); refreshMap(); } });

  // filters
  $('#filtersBtn').addEventListener('click', e => {
    e.stopPropagation();
    const pop = $('#filtersPop'), open = pop.hidden;
    closeDrops(); if (!open) return;
    renderFilters(); pop.hidden = false; $('#filtersBtn').setAttribute('aria-expanded', 'true');
  });
  function renderFilters() {
    const on = (arr, v) => arr.includes(v);
    $('#filtersPop').innerHTML = `
      <h4>Topic</h4><div class="opts">${D.TAGS.map(t => `<button type="button" class="chipb" data-f="tags" data-v="${esc(t)}" aria-pressed="${on(filt.tags, t)}">${esc(t)}</button>`).join('')}</div>
      <h4>Scale</h4><div class="opts">${SCALES.map(s => `<button type="button" class="chipb" data-f="scales" data-v="${s[0]}" aria-pressed="${on(filt.scales, s[0])}">${s[1]}</button>`).join('')}</div>
      <h4>Stage</h4><div class="opts">${STAGE_GROUPS.map(g => `<button type="button" class="chipb" data-f="stages" data-v="${g[0]}" aria-pressed="${on(filt.stages, g[0])}">${g[1]}</button>`).join('')}</div>
      <h4>Skill (people and teams)</h4><div class="opts">${W.skills.map(s => `<button type="button" class="chipb blue" data-f="skill" data-v="${esc(s)}" aria-pressed="${skillF === s}">${esc(s)}</button>`).join('')}</div>
      <p style="margin:14px 0 0"><button class="linkish" type="button" data-f="clear">Clear all</button></p>`;
  }
  $('#filtersPop').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    const f = b.dataset.f, v = b.dataset.v;
    if (f === 'clear') { filt.tags = []; filt.scales = []; filt.stages = []; skillF = null; }
    else if (f === 'skill') skillF = skillF === v ? null : v;
    else { const a = filt[f], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); }
    renderFilters(); setLayerUI(); refreshMap(); updateWhere();
  });

  // near me
  $('#nearMe').addEventListener('click', () => {
    if (!navigator.geolocation) { toast("This browser can't share your location."); return; }
    toast('Asking your browser where you are…');
    navigator.geolocation.getCurrentPosition(pos => { MapView.flyTo(pos.coords.longitude, pos.coords.latitude, 1.4); toast("Here's your area. Nothing about your location is saved."); },
      () => toast("Location is off for this site. Use search instead."), { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });
  });

  /* ───────── posting: "I see this problem" ───────── */
  function startPost() {
    if (R.name !== 'map') { pendingAction = () => whenMapReady(startPlacing); go('#map'); return; }
    whenMapReady(startPlacing);
  }
  function startPlacing() {
    if (panelMode) { $('#mpanel').hidden = true; $('#appMap').classList.remove('panel-open'); panelMode = null; selId = null; refreshMap(); }
    placing = true;
    $('#cross').hidden = false; $('#placebar').hidden = false; $('#cta').hidden = true; $('#appMap').classList.add('placing');
    lastLevel = -1; updateLevel();
    if (MapView.level() === 0) toast('Zoom in to your city or street, or use search at the top.');
  }
  function stopPlacing() { placing = false; $('#cross').hidden = true; $('#placebar').hidden = true; $('#cta').hidden = false; $('#appMap').classList.remove('placing'); }
  $('#cta').addEventListener('click', startPost);
  $('#placeCancel').addEventListener('click', () => { stopPlacing(); pending = null; });
  $('#placeType').addEventListener('click', () => openSearch());
  $('#placeHere').addEventListener('click', () => {
    const c = MapView.center(), li = MapView.level();
    const n = nearest(c.lat, c.lng);
    pending = Object.assign({ text: '', details: '', tags: [], needs: [] }, pending && pending.text ? { text: pending.text, details: pending.details, tags: pending.tags, needs: pending.needs } : {},
      { lat: c.lat, lon: c.lng, scale: LEVEL_TO_SCALE[li], approx: li >= 3, place: li === 0 ? 'The whole world' : (n.p && n.km < 80 ? n.p.name : n.p ? n.p.country : 'Somewhere'), country: n.p ? n.p.country : '', placeEdited: false });
    stopPlacing(); openPanel('post');
    if (li >= 3) reverseGeocode(c.lat, c.lng).then(r => { if (r && pending && !pending.placeEdited) { pending.place = r.place; pending.country = r.country || pending.country; const f = $('#poWhere'); if (f) f.value = r.place + (r.country ? ', ' + r.country : ''); } });
  });
  function postForm() {
    const P = pending || {};
    return `<form class="post" data-form="post" novalidate>
      <div class="p-head"><h2 class="h2" style="margin:0;font-size:26px">${esc(W.prompt)}</h2><button class="x" type="button" data-act="closePanel" aria-label="Close">×</button></div>
      <p class="muted" style="font-style:italic;margin:6px 0 16px">${esc(W.promptHint)}</p>
      <div id="poCheck"></div>
      <div class="field"><label for="poText">What do you see?</label><textarea class="textarea" id="poText" name="text" maxlength="200" required placeholder="One sentence is enough.">${esc(P.text || '')}</textarea></div>
      <div class="field"><label for="poDetails">More detail <span class="muted">(optional)</span></label><textarea class="textarea" id="poDetails" name="details" maxlength="600" style="min-height:64px">${esc(P.details || '')}</textarea></div>
      <div class="field"><label for="poWhere">Where</label><input class="input" id="poWhere" name="where" maxlength="80" value="${esc(P.place + (P.country && P.country !== P.place ? ', ' + P.country : ''))}"></div>
      <fieldset class="field" style="border:0;padding:0"><legend class="flabel" style="font:700 11px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">How big is it?</legend>
        <div class="opts">${SCALES.map(s => `<label class="opt"><input type="radio" name="scale" value="${s[0]}"${s[0] === P.scale ? ' checked' : ''}><span>${s[1]}</span></label>`).join('')}</div></fieldset>
      <label class="check" style="margin:-4px 0 18px"><input type="checkbox" name="approx"${P.approx ? ' checked' : ''}> Show an approximate spot (about 200 m off), so nobody can find a home from it</label>
      <fieldset class="field" style="border:0;padding:0"><legend class="flabel" style="font:700 11px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Skills it might need <span class="muted" style="text-transform:none;font-weight:400">(optional)</span></legend>
        <div class="opts">${W.skills.map(s => `<label class="opt"><input type="checkbox" name="need" value="${esc(s)}"${(P.needs || []).includes(s) ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></fieldset>
      <fieldset class="field" style="border:0;padding:0"><legend class="flabel" style="font:700 11px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Topics <span class="muted" style="text-transform:none;font-weight:400">(they link it to similar problems elsewhere)</span></legend>
        <div class="opts">${D.TAGS.map(s => `<label class="opt"><input type="checkbox" name="tag" value="${esc(s)}"${(P.tags || []).includes(s) ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></fieldset>
      <div class="field"><label for="poPhoto">Photo <span class="muted">(optional, no faces, names or house numbers)</span></label><input id="poPhoto" type="file" accept="image/*" style="font:13px var(--mono)"></div>
      <div class="field" id="poAltField" hidden><label for="poAlt">Describe the photo <span class="muted">(for people who can't see it)</span></label><input class="input" id="poAlt" name="photoAlt" maxlength="160" placeholder="For example: a bus stop with a broken roof"></div>
      <div class="actions" style="justify-content:space-between;margin-top:8px"><button class="btn" type="button" data-act="movePin">Move the pin</button><button class="btn primary" type="submit" id="poSubmit">Post on the map</button></div>
      <p class="small mono muted" style="margin:12px 0 0">${who() ? 'Posting as ' + esc(nameOf(who())) + '. Saved in this browser.' : "You'll join first. What you wrote is kept."}</p>
    </form>`;
  }
  let draftPhoto = null, forcePost = false;
  function bindPostForm() {
    const w = $('#poWhere'); if (w) w.addEventListener('input', () => { if (pending) pending.placeEdited = true; });
    const ph = $('#poPhoto');
    if (ph) ph.addEventListener('change', async () => {
      const f = ph.files && ph.files[0]; draftPhoto = null; $('#poAltField').hidden = !f; if (!f) return;
      try { draftPhoto = await shrinkPhoto(f); } catch (e) { toast("That photo couldn't be read. Try another one."); }
    });
    forcePost = false;
  }
  function readPost(f) {
    const where = f.where.value.trim(), parts = where.split(',');
    return {
      text: f.text.value.trim(), details: f.details.value.trim(), placeRaw: where,
      place: (parts[0] || '').trim() || (pending && pending.place) || 'Somewhere', country: parts.length > 1 ? parts.slice(1).join(',').trim() : (pending && pending.country) || '',
      scale: (f.querySelector('input[name="scale"]:checked') || {}).value || 'city', approx: f.approx.checked,
      needs: $$('input[name="need"]:checked', f).map(i => i.value), tags: $$('input[name="tag"]:checked', f).map(i => i.value)
    };
  }
  function autoCheck(v, lat, lon) {
    const t = v.text + ' ' + v.details, block = [], warn = [];
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) block.push('It has an email address in it. Posts are public, so take it out.');
    if (/\+?\d[\d\s().-]{7,}\d/.test(t)) block.push('It looks like it has a phone number in it. Take it out.');
    if (/https?:\/\/|www\./i.test(t)) warn.push('Links in new posts get hidden to stop spam.');
    const letters = t.replace(/[^A-Za-z]/g, '');
    if (letters.length > 14 && letters === letters.toUpperCase()) warn.push('Try it without all capitals.');
    if (/(.)\1{5,}/.test(t)) warn.push('Some letters repeat a lot. Typo?');
    if (v.text.length < 12) warn.push('Say a little more about what you see.');
    const lower = ' ' + fold(t) + ' ';
    const hit = PL.find(p => p.pop >= 500000 && p.name.length > 3 && new RegExp('[^a-z]' + escRe(fold(p.name)) + '[^a-z]').test(lower));
    if (hit && lat != null) { const d = hav(hit.lat, hit.lon, lat, lon); if (d > 300) warn.push(`The text mentions ${hit.name}, but the pin is ${Math.round(d).toLocaleString()} km from it. Is the pin in the right place?`); }
    return { block, warn };
  }
  function approxSpot(lat, lon) {
    // snap to a ~220 m grid, then nudge inside the cell: the exact spot is never saved
    const g = 0.002, j = () => (Math.random() - 0.5) * g * 0.6;
    return [Math.round(lat / g) * g + j(), Math.round(lon / g) * g + j()];
  }
  function submitPost(f) {
    const v = readPost(f);
    if (!v.text) { $('#poCheck').innerHTML = '<div class="warnbox block">Write what you see first.</div>'; $('#poText').focus(); return; }
    const chk = autoCheck(v, pending.lat, pending.lon);
    if (chk.block.length || (chk.warn.length && !forcePost)) {
      $('#poCheck').innerHTML = `<div class="warnbox${chk.block.length ? ' block' : ''}"><b>Automatic check</b><ul>${chk.block.concat(chk.warn).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${chk.block.length ? '' : '<p style="margin:10px 0 0"><button class="btn" type="button" data-act="postAnyway">Post anyway</button></p>'}</div>`;
      $('#mpanelBody').scrollTop = 0; return;
    }
    if (!who()) {
      S.draft = Object.assign({}, pending, { text: v.text, details: v.details, tags: v.tags, needs: v.needs, place: v.place, country: v.country, scale: v.scale, approx: v.approx, placeEdited: true });
      needMe('#map'); return;
    }
    const [lat, lon] = v.approx ? approxSpot(pending.lat, pending.lon) : [pending.lat, pending.lon];
    const p = { id: uid('p'), by: who(), t: now(), text: v.text, details: v.details || undefined, place: v.place, country: v.country, lat, lon, approx: v.approx, scale: v.scale,
      tags: v.tags, needs: v.needs, seen: [], seenExtra: 0, questions: [], team: [], project: null };
    if (draftPhoto) { p.photo = draftPhoto; const alt = (f.photoAlt && f.photoAlt.value || '').trim(); if (alt) p.photoAlt = alt; }
    S.problems[p.id] = p;
    if (!save() && p.photo) { delete p.photo; save(); }
    draftPhoto = null; pending = null; forcePost = false;
    if (layer !== 'see') setLayer('see');
    refreshMap(); select(p.id); updateChrome(); updateWhere();
    toast('Pinned. Now others can find it. That was SHARE.');
  }
  function shrinkPhoto(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = rej; img.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  async function reverseGeocode(lat, lon) {
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`https://photon.komoot.io/reverse?lon=${lon.toFixed(5)}&lat=${lat.toFixed(5)}&lang=en`, { signal: ctrl.signal });
      clearTimeout(t); if (!r.ok) return null;
      const j = await r.json(), pr = j.features && j.features[0] && j.features[0].properties; if (!pr) return null;
      const place = pr.city || pr.locality || pr.district || pr.county || pr.name;
      return place ? { place, country: pr.country } : null;
    } catch (e) { return null; }
  }

  /* ───────── search (places, streets, problems, people) ───────── */
  let sHits = [], sIdx = 0, sSeq = 0;
  function openSearch() {
    openModal(`<div class="head"><input id="sQ" type="text" placeholder="A city, a street, a problem, a person" aria-label="Search" autocomplete="off"><button class="x" type="button" data-act="closeModal" aria-label="Close">×</button></div><div class="sres" id="sRes"><p class="hint">Try "Hội An", your street, "water", or "designer".</p></div>`, 'search-card');
    const q = $('#sQ');
    q.addEventListener('input', debounce(runSearch, 160));
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!sHits.length) return; sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + sHits.length) % sHits.length; paintHits(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (sHits[sIdx]) chooseHit(sHits[sIdx]); }
      else if (e.key === 'Escape') closeModal();
    });
  }
  $('#searchOpen').addEventListener('click', openSearch);
  function runSearch() {
    const raw = ($('#sQ') || {}).value || '', f = fold(raw.trim()), seq = ++sSeq;
    if (!f) { sHits = []; $('#sRes').innerHTML = '<p class="hint">Try "Hội An", your street, "water", or "designer".</p>'; return; }
    const places = PL.filter(p => fold(p.name).startsWith(f)).sort((a, b) => b.pop - a.pop).slice(0, 5).map(p => ({ type: 'place', label: p.name, sub: p.country, lat: p.lat, lon: p.lon, km: 36 }));
    const probs = allProblems().filter(p => fold(p.text + ' ' + placeOf(p) + ' ' + (p.project ? p.project.name : '') + ' ' + (p.tags || []).join(' ')).includes(f)).slice(0, 5)
      .map(p => ({ type: 'problem', id: p.id, label: p.project ? p.project.name : p.text, sub: placeOf(p), g: 's' + stageOf(p) }));
    const ppl = Object.values(S.profiles).filter(p => fold(p.name + ' ' + p.city + ' ' + p.skills.join(' ')).includes(f)).slice(0, 4).map(p => ({ type: 'person', id: p.id, label: p.name, sub: p.city, g: 'person' }));
    sHits = places.concat(probs, ppl); sIdx = 0; paintHits();
    if (raw.trim().length >= 3) {
      fetch('https://photon.komoot.io/api/?limit=5&lang=en&q=' + encodeURIComponent(raw.trim())).then(r => r.ok ? r.json() : null).then(j => {
        if (!j || seq !== sSeq) return;
        const streets = (j.features || []).map(ft => {
          const pr = ft.properties, [lon, lat] = ft.geometry.coordinates;
          const kind = pr.osm_key === 'place' && /city|town|country|state/.test(pr.osm_value) ? (pr.osm_value === 'country' ? 1800 : pr.osm_value === 'state' ? 600 : 36) : 1.4;
          const label = pr.name || pr.street || pr.city;
          return label ? { type: 'street', label, sub: [pr.city || pr.district, pr.country].filter(Boolean).join(', '), lat, lon, km: kind } : null;
        }).filter(Boolean).filter(h => !places.some(p => fold(p.label) === fold(h.label) && Math.abs(p.lat - h.lat) < 0.3))
          .filter((h, i, arr) => arr.findIndex(o => o.label === h.label && o.sub === h.sub) === i);
        sHits = places.concat(streets, probs, ppl); paintHits();
      }).catch(() => { /* offline: local results only */ });
    }
  }
  function paintHits() {
    const box = $('#sRes'); if (!box) return;
    if (!sHits.length) { box.innerHTML = '<p class="hint">No match. Try a bigger place nearby, then zoom in.</p>'; return; }
    const groups = [['place', 'Places'], ['street', 'Streets and places (Photon)'], ['problem', 'Problems and projects'], ['person', 'People']];
    let i = 0, h = '';
    groups.forEach(([k, label]) => {
      const list = sHits.filter(x => x.type === k); if (!list.length) return;
      h += `<h4>${label}</h4>` + list.map(x => { const n = sHits.indexOf(x); i++; return `<button type="button" class="${n === sIdx ? 'on' : ''}" data-hit="${n}"><i class="g ${x.g || 's1'}" style="${x.g ? '' : 'visibility:hidden'}"></i><span>${esc(x.label)}</span><span class="s">${esc(x.sub || '')}</span></button>`; }).join('');
    });
    box.innerHTML = h;
  }
  $('#modal').addEventListener('click', e => { const b = e.target.closest('[data-hit]'); if (b) chooseHit(sHits[+b.dataset.hit]); });
  function chooseHit(x) {
    closeModal();
    if (x.type === 'problem') { go('#p.' + x.id); return; }
    if (x.type === 'person') { go('#u.' + x.id); return; }
    const fly = () => whenMapReady(() => {
      if (panelMode && panelMode !== 'post') closePanel(); MapView.flyTo(x.lon, x.lat, x.km);
      if (placing) { toast(`Moved to ${x.label}. Press "Put it here" if that's the place.`); $('#placeHere').focus(); }
    });
    if (R.name !== 'map') { pendingAction = fly; go('#map'); } else fly();
  }

  /* ───────── actions (buttons with data-act) ───────── */
  const ACT = {
    bannerOk() { S.bannerSeen = true; save(); updateChrome(); },
    closePanel() { closePanel(); },
    closeModal() { closeModal(); },
    markRead() { const u = who(); if (u) { S.lastRead[u] = now(); save(); updateChrome(); $('#bellDrop').hidden = true; if (R.name === 'me') RENDER.me(R); } },
    seen(id) {
      if (!needMe()) return; const p = S.problems[id], u = who();
      if (p.by === u) { toast("It's your post, so it already counts you."); return; }
      if (hasSeen(p, u)) p.seen = p.seen.filter(s => s.by !== u); else p.seen.push({ by: u, t: now() });
      commit(hasSeen(p, u) ? 'Counted. That helps others trust the post.' : null);
    },
    ask(id) { if (!needMe()) return; ui.ask = ui.ask === id ? null : id; ui.join = null; rerender(); focusIn('input[name="q"]'); },
    join(id) { if (!needMe()) return; ui.join = ui.join === id ? null : id; ui.ask = null; rerender(); },
    joinSkill(id, b) {
      const p = S.problems[id], u = who(), skill = b.dataset.skill, before = stageOf(p);
      p.team = p.team.filter(m => m.by !== u); p.team.push({ by: u, skill, t: now() });
      const fol = S.follows[u] = S.follows[u] || []; if (!fol.includes(id)) fol.push(id);
      ui.join = null;
      commit(before < 3 ? `You're on the team for ${skill}. That's CONNECT.` : `You're on the team for ${skill}.`);
    },
    leave(id) { const p = S.problems[id]; p.team = p.team.filter(m => m.by !== who()); ui.join = null; commit('You left the team.'); },
    follow(id) {
      if (!needMe()) return; const u = who(), a = S.follows[u] = S.follows[u] || [], i = a.indexOf(id);
      if (i >= 0) a.splice(i, 1); else a.push(id);
      commit(i >= 0 ? 'Unfollowed.' : "Following. News about it shows up under the bell.");
    },
    answer(id, b) { ui.answer = ui.answer === b.dataset.q ? null : b.dataset.q; rerender(); focusIn('input[name="a"]'); },
    form(id) { ui.form = ui.form === id ? null : id; rerender(); focusIn('#pjName'); },
    resolve(id) {
      openModal(`<h2 id="modalTitle">Mark it resolved?</h2><p class="body">Resolved pins stay on the map as white rings, so others can learn from them.</p>
        <form data-form="resolve" data-id="${esc(id)}"><div class="field"><label for="rsNote">What changed? <span class="muted">(optional)</span></label><input class="input" id="rsNote" name="note" maxlength="140"></div>
        <div class="row"><button class="btn" type="button" data-act="closeModal">Cancel</button><button class="btn primary" type="submit">Mark resolved</button></div></form>`);
    },
    reopen(id) { const p = S.problems[id]; p.project.resolved = null; commit('Reopened.'); },
    edit(id) { ui.edit = ui.edit === id ? null : id; rerender(); focusIn('#edText'); },
    del(id) {
      if (ui.del !== id) { ui.del = id; rerender(); setTimeout(() => { if (ui.del === id) { ui.del = null; rerender(); } }, 4000); return; }
      delete S.problems[id]; Object.values(S.follows).forEach(a => { const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); });
      ui.del = null; save();
      if (R.name === 'map') { closePanel(); rerender(); toast('Deleted.'); } else { toast('Deleted.'); go('#problems'); }
    },
    hide(id) { S.problems[id].hidden = true; commit('Hidden from the map. Only the team and the poster see it now.'); },
    restore(id) { S.problems[id].hidden = false; commit('It shows again.'); },
    share(id) {
      const url = location.href.split('#')[0] + '#p.' + id;
      const done = () => toast('Link copied.');
      const fallback = () => openModal(`<h2 id="modalTitle">Link to this problem</h2><input class="input" value="${esc(url)}" readonly onfocus="this.select()"><div class="row"><button class="btn primary" type="button" data-act="closeModal">Done</button></div>`);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
    },
    report(id) {
      const reasons = ['Personal information', 'Spam', 'Wrong location', 'Not a real problem', 'Unkind or unsafe', 'Something else'];
      openModal(`<h2 id="modalTitle">Report this post</h2><p class="body">The team looks at every report. The person who posted it isn't told who reported it.</p>
        <form data-form="report" data-id="${esc(id)}"><div class="opts" style="margin:14px 0">${reasons.map((r, i) => `<label class="opt"><input type="radio" name="reason" value="${esc(r)}"${i === 0 ? ' checked' : ''}><span>${esc(r)}</span></label>`).join('')}</div>
        <div class="field"><label for="rpNote">Anything to add? <span class="muted">(optional)</span></label><input class="input" id="rpNote" name="note" maxlength="200"></div>
        <div class="row"><button class="btn" type="button" data-act="closeModal">Cancel</button><button class="btn primary" type="submit">Send report</button></div></form>`);
    },
    modHide(rid) { const r = S.reports.find(x => x.id === rid); if (!r) return; r.status = 'hidden'; if (S.problems[r.target]) S.problems[r.target].hidden = true; commit('Post hidden.'); },
    modDismiss(rid) { const r = S.reports.find(x => x.id === rid); if (!r) return; r.status = 'dismissed'; commit('Report closed.'); },
    showOnMap(id) { pendingAction = () => whenMapReady(() => select(id, { fly: true })); go('#map'); },
    pick(id) { select(id, { fly: !MapView.isOnScreen((S.problems[id] || S.profiles[id]).lon, (S.problems[id] || S.profiles[id]).lat) }); },
    invite(pid, b) {
      if (!needMe()) return; const k = b.dataset.person + ':' + pid; S.invites = S.invites || {};
      if (S.invites[k]) delete S.invites[k]; else S.invites[k] = now();
      commit(S.invites[k] ? "Invite saved. In the real version they'd get a message." : null);
    },
    projF(v) { projF = v; RENDER.projects(); },
    peopleF(v) { peopleF = v; RENDER.people(); },
    meTab(v) { meTab = v; if (v === 'notes') { /* opening counts as reading */ } RENDER.me(); if (v === 'notes') { const u = who(); if (u) { S.lastRead[u] = now(); save(); setTimeout(updateChrome, 1200); } } },
    theme(v) { setTheme(v); },
    actAs(v) { S.actAs = v || null; ui.ask = ui.join = ui.answer = ui.form = ui.edit = ui.del = null; commit(v ? 'Now acting as ' + nameOf(v) + ' (demo).' : 'Back to you.'); },
    reset() {
      if (!ui.reset) { ui.reset = true; rerender(); setTimeout(() => { if (ui.reset) { ui.reset = false; rerender(); } }, 4000); return; }
      ui.reset = false; const theme = S.theme; S = seed(); S.theme = theme; S.bannerSeen = true; save(); closePanel(); toast('Demo reset. Only the samples are left.'); go('#home'); rerender();
    },
    signOut() { S.me = null; S.actAs = null; commit('Signed out.'); go('#home'); },
    movePin() {
      const f = $('#mpanelBody form.post');
      if (f && pending) { const v = readPost(f); Object.assign(pending, { text: v.text, details: v.details, tags: v.tags, needs: v.needs }); }
      $('#mpanel').hidden = true; $('#appMap').classList.remove('panel-open'); panelMode = null;
      if (pending) MapView.flyTo(pending.lon, pending.lat, null, { zoom: MapView.zoom(), ease: true, duration: 300 });
      placing = true; $('#cross').hidden = false; $('#placebar').hidden = false; $('#cta').hidden = true; $('#appMap').classList.add('placing');
    },
    postAnyway() { forcePost = true; const f = $('#mpanelBody form.post'); if (f) submitPost(f); }
  };
  function focusIn(sel) { requestAnimationFrame(() => { const el = $(sel); if (el) el.focus(); }); }
  document.addEventListener('click', e => {
    const post = e.target.closest('[data-action="post"]');
    if (post) { e.preventDefault(); startPost(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const fn = ACT[b.dataset.act]; if (!fn) return;
    if (b.tagName === 'A') e.preventDefault();
    fn(b.dataset.id, b, e);
  });
  document.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.actChange; if (!k) return;
    if (k === 'actAs') ACT.actAs(e.target.value);
    if (k === 'teamMode') { S.teamMode = e.target.checked; commit(S.teamMode ? 'Team mode on. The moderation page is open to you.' : 'Team mode off.'); }
  });

  /* ───────── forms (data-form) ───────── */
  const FORM = {
    ask(f) { const p = S.problems[f.dataset.id], v = f.q.value.trim(); if (!v) return; p.questions.push({ id: uid('q'), by: who(), text: v, t: now(), answer: null }); ui.ask = null; commit('Asked. The poster and the team will see it.'); },
    answer(f) { const p = S.problems[f.dataset.id], q = p.questions.find(x => x.id === f.dataset.q), v = f.a.value.trim(); if (!q || !v) return; q.answer = { by: who(), text: v, t: now() }; ui.answer = null; commit('Answered.'); },
    project(f) {
      const p = S.problems[f.dataset.id], v = f.name.value.trim(); if (!v) return;
      p.project = { name: v, by: who(), t: now(), updates: [], resolved: null }; ui.form = null;
      commit(`Project "${v}" formed. That's CREATE. Post an update when you do something.`);
    },
    update(f) { const p = S.problems[f.dataset.id], v = f.u.value.trim(); if (!v) return; const first = !p.project.updates.length; p.project.updates.push({ id: uid('up'), by: who(), text: v, t: now() }); commit(first ? 'Update posted. That\'s ACT.' : 'Update posted.'); },
    resolve(f) { const p = S.problems[f.dataset.id]; p.project.resolved = { by: who(), note: f.note.value.trim(), t: now() }; closeModal(); commit('Marked resolved. ✓'); },
    edit(f) { const p = S.problems[f.dataset.id]; const t = f.text.value.trim(); if (!t) return; p.text = t; p.details = f.details.value.trim() || undefined; p.edited = now(); ui.edit = null; commit('Saved.'); },
    report(f) {
      const reason = (f.querySelector('input[name="reason"]:checked') || {}).value || 'Something else';
      S.reports.push({ id: uid('r'), target: f.dataset.id, by: who() || 'guest', reason, note: f.note.value.trim(), t: now(), status: 'open' });
      closeModal(); commit('Reported. The team will look at it.');
    },
    join(f) {
      const err = [], name = f.name.value.trim(), city = f.city.value.trim();
      if (!name) err.push('Add your first name or a nickname.');
      if (!city) err.push('Add your city.');
      if (!f.agree.checked) err.push('Tick that you read the community guidelines.');
      const skills = $$('input[name="skill"]:checked', f).map(i => i.value);
      if (!skills.length) err.push('Pick at least one thing you can bring.');
      if (err.length) { $('#joinErr').innerHTML = `<div class="warnbox block"><ul>${err.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`; return; }
      const m = matchCity(city);
      const id = 'u-' + uid('');
      S.profiles[id] = { id, name, city: m ? m.name : city.split(',')[0].trim(), country: m ? m.country : (city.split(',')[1] || '').trim(), lat: m ? m.lat + (Math.random() - 0.5) * 0.04 : null, lon: m ? m.lon + (Math.random() - 0.5) * 0.04 : null,
        skills, cares: $$('input[name="care"]:checked', f).map(i => i.value), bio: f.bio.value.trim(), joined: now() };
      S.me = id; S.actAs = null; S.lastRead[id] = now();
      const back = S.returnTo; S.returnTo = null; save();
      toast(`Welcome, ${name}.` + (m ? '' : " We couldn't find that city, so you won't show on the map yet."));
      go(back || '#me'); updateChrome();
    },
    profile(f) {
      const pr = S.profiles[who()], m = matchCity(f.city.value.trim());
      pr.name = f.name.value.trim() || pr.name;
      if (m) { pr.city = m.name; pr.country = m.country; pr.lat = m.lat + (Math.random() - 0.5) * 0.04; pr.lon = m.lon + (Math.random() - 0.5) * 0.04; }
      pr.skills = $$('input[name="skill"]:checked', f).map(i => i.value); pr.cares = $$('input[name="care"]:checked', f).map(i => i.value); pr.bio = f.bio.value.trim();
      commit('Profile saved.');
    },
    contact(f) { S.messages.push({ id: uid('m'), name: f.name.value.trim(), text: f.msg.value.trim(), t: now() }); f.reset(); commit('Saved in this browser. In the real version it would go to the team.'); },
    post(f) { submitPost(f); }
  };
  document.addEventListener('submit', e => {
    const f = e.target, k = f.dataset && f.dataset.form; if (!k || !FORM[k]) return;
    e.preventDefault();
    if (k !== 'post' && k !== 'join' && k !== 'contact' && k !== 'report' && !who()) { needMe(); return; }
    FORM[k](f);
  });

  /* ───────── keyboard ───────── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#modal').hidden) { closeModal(); return; }
    if (!$('#bellDrop').hidden || !$('#filtersPop').hidden) { closeDrops(); return; }
    if (placing) { stopPlacing(); return; }
    if (R.name === 'map' && panelMode) closePanel();
  });

  /* ───────── start ───────── */
  $('#brandName').textContent = W.name; $('#footName').textContent = W.name; $('#footTagline').textContent = W.tagline;
  applyTheme(); updateChrome(); route();
})();
