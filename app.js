/** Spin Wheel Pro - client-only random name picker with accessible responsive UI. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const I18N = { en: { appTitle: 'Spin Wheel Pro' }, es: { appTitle: 'Ruleta Pro' } };
const PRESET_ENTRIES = ['Olivia', 'Liam', 'Noah', 'Emma', 'Ava', 'Ethan', 'Mia', 'Lucas'];
const SAFE_PALETTES = {
  mint: { label: '★ Mint Contrast', colors: ['#1f5b46', '#f2fbf6', '#2f7a5b', '#ffffff', '#3eb489', '#fbb03b'] },
  sage: { label: '★ Sage Gold', colors: ['#264337', '#edf7f1', '#39634f', '#ffffff', '#5da17f', '#f2c069'] },
  forest: { label: '● Forest Soft', colors: ['#19372b', '#e9f5ee', '#295442', '#f6fffa', '#3f7d62', '#d9b15a'] }
};
const VALID_COLORS = ['#1f5b46', '#2f7a5b', '#3eb489', '#5da17f', '#fbb03b', '#d9b15a', '#163022', '#264337'];

const state = {
  wheel: null,
  results: [],
  history: [],
  spinning: false,
  idleAutoSpin: false,
  angle: 0,
  startAngle: 0,
  endAngle: 0,
  spinStartTs: 0,
  spinDurationMs: 11000,
  lastTick: -1,
  settings: {
    duration: 11, spinSlowly: false, visibleSectors: 10, displayDuplicates: true,
    tickSound: 'wood', tickVolume: 0.4, celebrateSound: 'applause', celebrateVolume: 0.6,
    confetti: true, autoRemove: false, autoRemoveDelay: 5, winnerMessage: 'We have a winner!', showRemoveBtn: true,
    theme: 'light', language: 'en', showSpinText: true, showTitle: true, autoSpinOnLoad: true, reduceMotion: false,
    palette: 'mint', primary: '#3eb489', accent: '#fbb03b', colorMode: 'palette',
    wheelBgImage: '', centerImage: '', centerImageAlt: 'Decorative center image', centerImageSize: 120,
    contours: true, shadow: false, pointerColor: '#1f5b46'
  }
};

const canvas = $('#wheelCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = window.AudioContext ? new AudioContext() : null;

const makeWheel = () => ({ title: 'My Wheel', entries: PRESET_ENTRIES.map((text) => ({ text, weight: 1, color: '', image: '' })) });

function visibleEntries() {
  let e = (state.wheel?.entries || []).filter((x) => x.text.trim());
  if (!state.settings.displayDuplicates) {
    const seen = new Set(); e = e.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
  }
  return e;
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const size = Math.max(280, Math.min(canvas.clientWidth || 760, canvas.clientHeight || 760));
  canvas.width = size * dpr; canvas.height = size * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawWheel() {
  fitCanvas();
  const entries = visibleEntries(); const n = Math.max(entries.length, 1);
  const size = Math.min(canvas.clientWidth || 760, canvas.clientHeight || 760);
  const c = size / 2; const r = c - 10; const step = (Math.PI * 2) / n;
  const palette = SAFE_PALETTES[state.settings.palette]?.colors || SAFE_PALETTES.mint.colors;

  ctx.clearRect(0, 0, size, size);
  if (state.settings.shadow) { ctx.shadowColor = '#00000033'; ctx.shadowBlur = 10; }
  ctx.save(); ctx.translate(c, c); ctx.rotate(state.angle);

  if (state.settings.colorMode === 'image' && state.settings.wheelBgImage) {
    const img = new Image(); img.src = state.settings.wheelBgImage;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, -r, -r, r * 2, r * 2); ctx.restore();
  }

  entries.forEach((entry, i) => {
    const a0 = i * step; const a1 = a0 + step;
    ctx.fillStyle = state.settings.colorMode === 'palette' ? (entry.color || palette[i % palette.length]) : '#ffffff16';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath(); ctx.fill();
    if (state.settings.contours) {
      ctx.strokeStyle = '#24413366'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath(); ctx.stroke();
    }
    ctx.save(); ctx.rotate(a0 + step / 2); ctx.translate(r * 0.67, 0); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = textContrast(entry.color || palette[i % palette.length]);
    ctx.font = `${Math.max(12, Math.min(22, 280 / n))}px Inter, sans-serif`; ctx.textAlign = 'center';
    wrapped(entry.text, r * 0.45).forEach((line, li) => ctx.fillText(line, 0, li * 18));
    ctx.restore();
  });
  ctx.restore();

  ctx.beginPath(); ctx.fillStyle = '#f8fffb'; ctx.arc(c, c, 70, 0, Math.PI * 2); ctx.fill();
  if (state.settings.centerImage) {
    const img = new Image(); img.src = state.settings.centerImage; img.alt = state.settings.centerImageAlt;
    const s = state.settings.centerImageSize; ctx.save(); ctx.beginPath(); ctx.arc(c, c, s / 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, c - s / 2, c - s / 2, s, s); ctx.restore();
  }

  $('#pointer').style.borderTopColor = state.settings.pointerColor;
  $('#spinBtn').style.display = state.settings.showSpinText ? 'inline-flex' : 'none';
  $('#wheelTitleText').textContent = state.wheel?.title || 'My Wheel';
  $('#wheelTitleText').style.display = state.settings.showTitle ? 'block' : 'none';
}

function wrapped(text, maxWidth) {
  const words = text.split(' '); let line = ''; const lines = [];
  for (const word of words) {
    const test = `${line}${word} `.trim();
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line.trim()); line = `${word} `; }
    else line = `${test} `;
  }
  lines.push(line.trim());
  return lines.slice(0, 2);
}
function textContrast(hex) {
  if (!hex || !hex.startsWith('#')) return '#163022';
  const v = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  return ((r * 299 + g * 587 + b * 114) / 1000) > 145 ? '#163022' : '#f8fffb';
}

function spin() {
  if (state.spinning || visibleEntries().length < 2) return;
  state.idleAutoSpin = false; state.spinning = true;
  state.spinStartTs = performance.now(); state.startAngle = state.angle;
  state.spinDurationMs = (state.settings.spinSlowly ? state.settings.duration * 1.55 : state.settings.duration) * 1000;
  state.endAngle = state.angle + (7 + Math.random() * 7) * Math.PI * 2 + Math.random() * Math.PI * 2;
  requestAnimationFrame(animateSpin);
}
function animateSpin(ts) {
  const t = Math.min(1, (ts - state.spinStartTs) / state.spinDurationMs);
  const ease = 1 - ((1 - t) ** 4);
  state.angle = state.startAngle + (state.endAngle - state.startAngle) * ease;
  playTick(); drawWheel();
  if (t < 1) requestAnimationFrame(animateSpin); else finishSpin();
}
function winnerIndex() {
  const n = visibleEntries().length; if (!n) return -1;
  const step = (Math.PI * 2) / n;
  const p = ((1.5 * Math.PI - state.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(p / step) % n;
}
function finishSpin() {
  state.spinning = false;
  const winner = visibleEntries()[winnerIndex()]; if (!winner) return;
  state.results.unshift({ name: winner.text, at: new Date().toISOString() }); renderResults();
  if (state.settings.confetti && !state.settings.reduceMotion) launchConfetti();
  tone(state.settings.celebrateSound, state.settings.celebrateVolume, 0.45);
  $('#winnerTitle').textContent = state.settings.winnerMessage;
  $('#winnerName').textContent = winner.text;
  $('#removeWinnerBtn').style.display = state.settings.showRemoveBtn ? 'inline-block' : 'none';
  $('#winnerDialog').showModal();
  if (state.settings.autoRemove) setTimeout(() => removeWinner(winner.text), state.settings.autoRemoveDelay * 1000);
  persist();
}
function playTick() {
  const n = visibleEntries().length; if (!n) return;
  const idx = Math.floor((((-state.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / ((Math.PI * 2) / n));
  if (idx !== state.lastTick) { state.lastTick = idx; tone(state.settings.tickSound, state.settings.tickVolume, 0.03); }
}
function tone(kind, vol, dur) {
  if (!audioCtx) return;
  const freq = { wood: 180, click: 520, bell: 860, applause: 230, chime: 730, trumpet: 350 }[kind] || 300;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = (kind === 'bell' || kind === 'chime') ? 'sine' : 'square'; o.frequency.value = freq; g.gain.value = vol * 0.2;
  o.connect(g).connect(audioCtx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur); o.stop(audioCtx.currentTime + dur);
}
function launchConfetti() {
  for (let i = 0; i < 70; i += 1) {
    const d = document.createElement('div'); d.className = 'confetti';
    d.style.left = `${Math.random() * 100}vw`; d.style.background = `hsl(${Math.random() * 360} 85% 58%)`; d.style.animationDelay = `${Math.random() * 0.35}s`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
  }
}

function removeWinner(name) { state.wheel.entries = state.wheel.entries.filter((e) => e.text !== name); syncEntriesUI(); drawWheel(); persist(); }
function renderResults() { $('#resultsList').innerHTML = state.results.map((r) => `<li>${esc(r.name)} <small>${new Date(r.at).toLocaleString()}</small></li>`).join(''); }
function syncEntriesUI() { $('#entriesInput').value = state.wheel.entries.map((e) => e.text).join('\n'); renderAdvancedEditor(); $('#wheelTitle').value = state.wheel.title; }
function syncFromEntries() { pushHistory(); state.wheel.entries = $('#entriesInput').value.split(/\n/).map((text) => ({ text, weight: 1, color: '', image: '' })); drawWheel(); persist(); }
function pushHistory() { state.history.push(JSON.stringify(state.wheel.entries)); if (state.history.length > 60) state.history.shift(); }
function renderAdvancedEditor() {
  const box = $('#advancedEditor'); if (!$('#advancedMode').checked) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = `<table><tr><th>Name</th><th>Weight</th><th>Color</th><th>Image URL</th></tr>${state.wheel.entries.map((e, i) => `<tr><td><input data-i="${i}" data-k="text" value="${esc(e.text)}"></td><td><input data-i="${i}" data-k="weight" type="number" min="1" value="${e.weight || 1}"></td><td><input data-i="${i}" data-k="color" type="color" value="${e.color || '#3eb489'}"></td><td><input data-i="${i}" data-k="image" value="${esc(e.image || '')}"></td></tr>`).join('')}</table>`;
}


function randomShareId() {
  return (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
}
function saveSharedState(payload) {
  const key = 'spinwheel-shares';
  const db = JSON.parse(localStorage.getItem(key) || '{}');
  let id = randomShareId();
  while (db[id]) id = randomShareId();
  db[id] = { payload, createdAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(db));
  return id;
}
function loadSharedStateById(id) {
  const db = JSON.parse(localStorage.getItem('spinwheel-shares') || '{}');
  return db[id]?.payload || null;
}

function persist() {
  localStorage.setItem('spinwheel-account-default', JSON.stringify({ wheel: state.wheel, results: state.results, settings: state.settings }));
}
function encodeUrlState() {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ wheel: state.wheel, settings: state.settings, results: state.results.slice(0, 30) }))));
  history.replaceState(null, '', `#${payload}`);
}
function restoreState() {
  const shareId = new URLSearchParams(location.search).get('s');
  if (shareId) {
    const shared = loadSharedStateById(shareId);
    if (shared) {
      state.wheel = shared.wheel || shared.wheels?.[0] || makeWheel();
      state.settings = { ...state.settings, ...shared.settings }; state.results = shared.results || [];
      return;
    }
  }
  const hash = location.hash.slice(1);
  if (hash) {
    try {
      const v = JSON.parse(decodeURIComponent(escape(atob(hash))));
      state.wheel = v.wheel || v.wheels?.[0] || makeWheel();
      state.settings = { ...state.settings, ...v.settings }; state.results = v.results || [];
      return;
    } catch { /* noop */ }
  }
  const local = localStorage.getItem('spinwheel-account-default');
  if (local) {
    try {
      const v = JSON.parse(local);
      state.wheel = v.wheel || v.wheels?.[0] || makeWheel();
      state.settings = { ...state.settings, ...v.settings }; state.results = v.results || [];
      return;
    } catch { /* noop */ }
  }
  state.wheel = makeWheel();
}

function bindUI() {
  // desktop + mobile nav
  $$('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-view]').forEach((x) => x.classList.remove('active')); btn.classList.add('active');
    $$('.view').forEach((x) => x.classList.remove('active')); $(`#${btn.dataset.view}`).classList.add('active');
  }));
  $('#sidebarToggle').addEventListener('click', toggleSidebar);
  $('#reopenSidebar').addEventListener('click', toggleSidebar);
  $('#mobileNavToggle').addEventListener('click', () => {
    const hidden = $('#mobileNavMenu').classList.toggle('hidden');
    $('#mobileNavToggle').setAttribute('aria-expanded', String(!hidden));
  });

  $('#spinBtn').onclick = spin; canvas.onclick = spin;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') spin();
    if (e.key === 'Enter' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) spin();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('#undoBtn').click(); }
  });

  $('#entriesInput').addEventListener('input', syncFromEntries);
  $('#shuffleBtn').onclick = () => { pushHistory(); state.wheel.entries.sort(() => Math.random() - 0.5); syncEntriesUI(); drawWheel(); persist(); };
  $('#sortBtn').onclick = () => { pushHistory(); state.wheel.entries.sort((a, b) => a.text.localeCompare(b.text)); syncEntriesUI(); drawWheel(); persist(); };
  $('#undoBtn').onclick = () => { const prev = state.history.pop(); if (prev) { state.wheel.entries = JSON.parse(prev); syncEntriesUI(); drawWheel(); persist(); } };
  $('#advancedMode').onchange = () => { $('#entriesInput').disabled = $('#advancedMode').checked; renderAdvancedEditor(); };
  $('#advancedEditor').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.i); const k = e.target.dataset.k; if (Number.isNaN(i)) return;
    state.wheel.entries[i][k] = k === 'weight' ? Number(e.target.value) : e.target.value; drawWheel(); persist();
  });

  $('#keepWinnerBtn').onclick = () => $('#winnerDialog').close();
  $('#closeWinnerBtn').onclick = () => $('#winnerDialog').close();
  $('#removeWinnerBtn').onclick = () => { removeWinner($('#winnerName').textContent); $('#winnerDialog').close(); };

  $('#newBtn').onclick = () => {
    state.wheel = makeWheel(); state.results = []; state.history = []; state.angle = 0;
    syncEntriesUI(); renderResults(); drawWheel(); persist();
    history.replaceState(null, '', location.pathname); // keep URL stable by default
    if (state.settings.autoSpinOnLoad && !state.settings.reduceMotion) startIdleAutoSpin();
  };
  $('#saveBtn').onclick = downloadJson;
  $('#loadBtn').onclick = () => $('#loadInput').click();
  $('#loadInput').onchange = loadJson;
  $('#fullscreenBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  $('#shareBtn').onclick = () => { $('#shareTitle').value = state.wheel.title; $('#shareDialog').showModal(); };
  $('#generateShareBtn').onclick = generateShare;
  $('#closeShareDialog').onclick = () => $('#shareDialog').close();

  $('#openSettingsDialog').onclick = () => $('#settingsDialog').showModal();
  $('#closeSettingsDialog').onclick = () => $('#settingsDialog').close();
  $$('.acc-header').forEach((h) => h.addEventListener('click', () => {
    const panel = $(`#${h.dataset.acc}`); const open = panel.classList.toggle('open'); h.setAttribute('aria-expanded', String(open));
  }));

  setPaletteOptions();
  bind('durationSlider', 'input', (v) => { state.settings.duration = Number(v); $('#durationValue').textContent = v; });
  $$('.preset').forEach((b) => b.onclick = () => { $('#durationSlider').value = b.dataset.v; $('#durationSlider').dispatchEvent(new Event('input')); });
  bind('spinSlowly', 'change', (v) => state.settings.spinSlowly = v, true);
  bind('visibleSectors', 'input', (v) => state.settings.visibleSectors = Number(v));
  bind('tickSound', 'change', (v) => state.settings.tickSound = v);
  bind('tickVolume', 'input', (v) => state.settings.tickVolume = Number(v));
  bind('winnerMessage', 'input', (v) => state.settings.winnerMessage = v);
  bind('showRemoveBtn', 'change', (v) => state.settings.showRemoveBtn = v);
  bind('confettiToggle', 'change', (v) => state.settings.confetti = v);
  bind('celebrateSound', 'change', (v) => state.settings.celebrateSound = v);
  bind('celebrateVolume', 'input', (v) => state.settings.celebrateVolume = Number(v));
  bind('autoRemove', 'change', (v) => state.settings.autoRemove = v);
  bind('autoRemoveDelay', 'input', (v) => state.settings.autoRemoveDelay = Number(v));
  bind('themeSelect', 'change', (v) => { state.settings.theme = v; applyTheme(); });
  bind('languageSelect', 'change', (v) => { state.settings.language = v; applyLanguage(); });
  bind('showSpinText', 'change', (v) => state.settings.showSpinText = v, true);
  bind('autoSpinOnLoad', 'change', (v) => { state.settings.autoSpinOnLoad = v; if (v && !state.spinning && !state.settings.reduceMotion) startIdleAutoSpin(); else state.idleAutoSpin = false; }, true);
  bind('reduceMotion', 'change', (v) => { state.settings.reduceMotion = v; if (v) state.idleAutoSpin = false; else if (state.settings.autoSpinOnLoad) startIdleAutoSpin(); }, true);
  bind('showTitle', 'change', (v) => state.settings.showTitle = v, true);
  bind('displayDuplicates', 'change', (v) => state.settings.displayDuplicates = v, true);
  bind('wheelTitle', 'input', (v) => { state.wheel.title = v; drawWheel(); });
  bind('paletteSelect', 'change', (v) => state.settings.palette = v, true);
  bind('primaryColor', 'change', (v) => { if (VALID_COLORS.includes(v)) { state.settings.primary = v; document.documentElement.style.setProperty('--primary', v); }});
  bind('accentColor', 'change', (v) => { if (VALID_COLORS.includes(v)) { state.settings.accent = v; document.documentElement.style.setProperty('--accent', v); }});
  bind('colorMode', 'change', (v) => state.settings.colorMode = v, true);
  bind('centerImgSize', 'input', (v) => state.settings.centerImageSize = Number(v), true);
  bind('centerImageAlt', 'input', (v) => state.settings.centerImageAlt = v);
  bind('contoursToggle', 'change', (v) => state.settings.contours = v, true);
  bind('shadowToggle', 'change', (v) => state.settings.shadow = v, true);
  bind('pointerColor', 'input', (v) => state.settings.pointerColor = v, true);

  toDataUrl('#wheelBgUpload', (v) => { state.settings.wheelBgImage = v; drawWheel(); persist(); });
  toDataUrl('#centerImgUpload', (v) => { state.settings.centerImage = v; drawWheel(); persist(); });
  $('#importSheetBtn').onclick = importGoogleSheet;

  $('#sortResultsBtn').onclick = () => { state.results.sort((a, b) => a.name.localeCompare(b.name)); renderResults(); persist(); };
  $('#clearResultsBtn').onclick = () => { state.results = []; renderResults(); persist(); };
}

function bind(id, event, setter, redraw = false) {
  const el = $(`#${id}`); if (!el) return;
  el.addEventListener(event, (e) => { setter(e.target.type === 'checkbox' ? e.target.checked : e.target.value); if (redraw) drawWheel(); persist(); });
}
function setPaletteOptions() {
  $('#paletteSelect').innerHTML = Object.entries(SAFE_PALETTES).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
  const opts = VALID_COLORS.map((c) => `<option value="${c}">${c.toUpperCase()}</option>`).join('');
  $('#primaryColor').innerHTML = opts; $('#accentColor').innerHTML = opts;
}
function toggleSidebar() {
  $('#sidebar').classList.toggle('collapsed');
  const collapsed = $('#sidebar').classList.contains('collapsed');
  $('#sidebarToggle').setAttribute('aria-expanded', String(!collapsed));
  $('#reopenSidebar').classList.toggle('hidden', !collapsed);
  $('#sidebarToggle .caret').textContent = collapsed ? '❯' : '❮';
}
function downloadJson() {
  const data = JSON.stringify({ wheel: state.wheel, settings: state.settings, results: state.results }, null, 2);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = 'wheel.json'; a.click();
}
async function loadJson(e) {
  const f = e.target.files?.[0]; if (!f) return;
  const v = JSON.parse(await f.text());
  state.wheel = v.wheel || v.wheels?.[0] || makeWheel(); state.results = v.results || []; state.settings = { ...state.settings, ...v.settings };
  hydrateSettingsUI(); syncEntriesUI(); renderResults(); drawWheel(); persist();
}
function generateShare() {
  const payload = { wheel: state.wheel, settings: state.settings, results: state.results.slice(0, 30) };
  const sid = saveSharedState(payload);
  const link = `${location.origin}${location.pathname}?s=${sid}`;
  $('#shareOut').value = link;
  $('#embedOut').value = `<iframe src="${link}" width="700" height="700" title="${esc($('#shareTitle').value || state.wheel.title)}"></iframe>`;
}
function importGoogleSheet() {
  const url = prompt('Paste Google Sheets CSV export URL (OAuth flow is not possible without server).');
  if (!url) return;
  fetch(url).then((r) => r.text()).then((csv) => {
    state.wheel.entries = csv.split(/\r?\n/).filter(Boolean).map((l) => ({ text: l.split(',')[0], weight: 1, color: '', image: '' }));
    syncEntriesUI(); drawWheel(); persist();
  }).catch(() => alert('Import failed. Check sheet link permissions.'));
}
function toDataUrl(selector, cb) {
  $(selector).addEventListener('change', (e) => {
    const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f);
  });
}

function hydrateSettingsUI() {
  $('#durationSlider').value = state.settings.duration; $('#durationValue').textContent = String(state.settings.duration);
  $('#spinSlowly').checked = state.settings.spinSlowly;
  $('#visibleSectors').value = state.settings.visibleSectors;
  $('#tickSound').value = state.settings.tickSound; $('#tickVolume').value = state.settings.tickVolume;
  $('#winnerMessage').value = state.settings.winnerMessage; $('#showRemoveBtn').checked = state.settings.showRemoveBtn;
  $('#confettiToggle').checked = state.settings.confetti; $('#celebrateSound').value = state.settings.celebrateSound; $('#celebrateVolume').value = state.settings.celebrateVolume;
  $('#autoRemove').checked = state.settings.autoRemove; $('#autoRemoveDelay').value = state.settings.autoRemoveDelay;
  $('#themeSelect').value = state.settings.theme; $('#languageSelect').value = state.settings.language;
  $('#showSpinText').checked = state.settings.showSpinText; $('#autoSpinOnLoad').checked = state.settings.autoSpinOnLoad; $('#reduceMotion').checked = state.settings.reduceMotion;
  $('#showTitle').checked = state.settings.showTitle; $('#displayDuplicates').checked = state.settings.displayDuplicates;
  $('#paletteSelect').value = state.settings.palette; $('#primaryColor').value = state.settings.primary; $('#accentColor').value = state.settings.accent;
  $('#colorMode').value = state.settings.colorMode; $('#centerImgSize').value = state.settings.centerImageSize; $('#centerImageAlt').value = state.settings.centerImageAlt;
  $('#contoursToggle').checked = state.settings.contours; $('#shadowToggle').checked = state.settings.shadow; $('#pointerColor').value = state.settings.pointerColor;
}
function applyTheme() {
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && sysDark);
  if (dark) {
    document.documentElement.style.setProperty('--bg', '#121212');
    document.documentElement.style.setProperty('--surface', '#1a1a1a');
    document.documentElement.style.setProperty('--surface-2', '#242424');
    document.documentElement.style.setProperty('--text', '#f4f4f4');
    document.documentElement.style.setProperty('--muted', '#c2c2c2');
    document.documentElement.style.setProperty('--focus', '#88c9af');
    document.body.style.background = 'linear-gradient(135deg,#121212,#1a1a1a)';
  } else {
    document.documentElement.style.setProperty('--bg', '#f8fbf8');
    document.documentElement.style.setProperty('--surface', '#ffffff');
    document.documentElement.style.setProperty('--surface-2', '#f3faf5');
    document.documentElement.style.setProperty('--text', '#163022');
    document.documentElement.style.setProperty('--muted', '#4f6b5e');
    document.documentElement.style.setProperty('--focus', '#1f7a5c');
    document.body.style.background = 'linear-gradient(135deg,#ffffff,#f4faf4)';
  }
  document.documentElement.style.setProperty('--primary', state.settings.primary);
  document.documentElement.style.setProperty('--accent', state.settings.accent);
}
function startIdleAutoSpin() {
  if (state.settings.reduceMotion || !state.settings.autoSpinOnLoad || state.spinning) return;
  state.idleAutoSpin = true; let last = performance.now(); const radPerMs = (Math.PI * 2) / 20000;
  const frame = (ts) => {
    if (!state.idleAutoSpin || state.spinning || state.settings.reduceMotion || !state.settings.autoSpinOnLoad) return;
    const dt = ts - last; last = ts; state.angle += radPerMs * dt; drawWheel(); requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function applyLanguage() {
  document.documentElement.lang = state.settings.language;
  $$('[data-i18n]').forEach((el) => { el.textContent = I18N[state.settings.language]?.[el.dataset.i18n] || el.textContent; });
}
function esc(v) { return String(v).replace(/[&<>'"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[m])); }

function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  restoreState();
  bindUI();
  hydrateSettingsUI();
  syncEntriesUI(); renderResults();
  applyTheme(); applyLanguage(); drawWheel();
  if (state.settings.autoSpinOnLoad && !state.settings.reduceMotion) startIdleAutoSpin();
  window.addEventListener('resize', drawWheel);
}

init();
