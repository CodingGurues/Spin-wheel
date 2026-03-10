/** Spin Wheel Pro v1.1.0 - client-only, offline-friendly random name picker. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const I18N = { en: { appTitle: 'Spin Wheel Pro' }, es: { appTitle: 'Ruleta Pro' } };
const PRESET_ENTRIES = ['Olivia', 'Liam', 'Noah', 'Emma', 'Ava', 'Ethan', 'Mia', 'Lucas'];
const SAFE_PALETTES = {
  aurora: { label: '★ Aurora (high contrast)', colors: ['#0f172a', '#e2e8f0', '#1d4ed8', '#f8fafc', '#334155', '#fef3c7'] },
  slateGold: { label: '★ Slate + Gold (high contrast)', colors: ['#111827', '#f3f4f6', '#374151', '#fbbf24', '#1f2937', '#fff7ed'] },
  skyStone: { label: '● Sky + Stone (balanced)', colors: ['#0c4a6e', '#e0f2fe', '#1e293b', '#e2e8f0', '#075985', '#f8fafc'] },
  plumMint: { label: '● Plum + Mint (balanced)', colors: ['#3f2b56', '#f5f3ff', '#4a044e', '#dcfce7', '#312e81', '#ecfeff'] }
};
const VALID_COLORS = ['#111827','#1f2937','#334155','#0f172a','#1d4ed8','#0c4a6e','#f8fafc','#f3f4f6','#e2e8f0','#fef3c7','#fbbf24','#dcfce7'];

const state = {
  wheels: [], activeWheelId: null, results: [], history: [], spinning: false,
  angle: 0, startAngle: 0, endAngle: 0, spinStartTs: 0, spinDurationMs: 11000, lastTick: -1, idleAutoSpin: false,
  settings: {
    duration: 11, spinSlowly: false, visibleSectors: 10, displayDuplicates: true,
    tickSound: 'wood', tickVolume: 0.4, celebrateSound: 'applause', celebrateVolume: 0.6,
    confetti: true, autoRemove: false, autoRemoveDelay: 5, winnerMessage: 'We have a winner!', showRemoveBtn: true,
    theme: 'light', language: 'en', showSpinText: true, showTitle: true, autoSpinOnLoad: true, reduceMotion: false,
    palette: 'aurora', primary: '#1d4ed8', accent: '#fbbf24', colorMode: 'palette',
    wheelBgImage: '', centerImage: '', centerImageAlt: 'Decorative center image', centerImageSize: 120,
    contours: true, shadow: true, pointerColor: '#ffffff'
  }
};

const canvas = $('#wheelCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = window.AudioContext ? new AudioContext() : null;

function mkWheel(name = 'Wheel 1') {
  return { id: crypto.randomUUID(), name, title: 'My Wheel', entries: PRESET_ENTRIES.map(text => ({ text, weight: 1, color: '', image: '' })) };
}
const activeWheel = () => state.wheels.find((w) => w.id === state.activeWheelId);
function visibleEntries() {
  let e = (activeWheel()?.entries || []).filter((x) => x.text.trim());
  if (!state.settings.displayDuplicates) {
    const seen = new Set();
    e = e.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
  }
  return e;
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const size = Math.max(280, Math.min(canvas.clientWidth || 760, canvas.clientHeight || 760));
  canvas.width = size * dpr; canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawWheel() {
  fitCanvas();
  const entries = visibleEntries();
  const n = Math.max(entries.length, 1);
  const size = Math.min(canvas.clientWidth || 760, canvas.clientHeight || 760);
  const c = size / 2, r = c - 10;
  const step = (Math.PI * 2) / n;
  const palette = SAFE_PALETTES[state.settings.palette]?.colors || SAFE_PALETTES.aurora.colors;

  ctx.clearRect(0, 0, size, size);
  if (state.settings.shadow) { ctx.shadowColor = '#0008'; ctx.shadowBlur = 18; }
  ctx.save(); ctx.translate(c, c); ctx.rotate(state.angle);

  if (state.settings.colorMode === 'image' && state.settings.wheelBgImage) {
    const img = new Image(); img.src = state.settings.wheelBgImage;
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip(); ctx.drawImage(img, -r, -r, r * 2, r * 2); ctx.restore();
  }

  entries.forEach((entry, i) => {
    const a0 = i * step;
    const a1 = a0 + step;
    ctx.fillStyle = state.settings.colorMode === 'palette' ? (entry.color || palette[i % palette.length]) : '#ffffff08';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath(); ctx.fill();
    if (state.settings.contours) {
      ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath(); ctx.stroke();
    }
    ctx.save();
    ctx.rotate(a0 + step / 2); ctx.translate(r * 0.67, 0); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = textContrast(entry.color || palette[i % palette.length]);
    ctx.font = `${Math.max(12, Math.min(22, 280 / n))}px Inter, sans-serif`; ctx.textAlign = 'center';
    wrapped(entry.text, r * 0.45).forEach((line, li) => ctx.fillText(line, 0, li * 18));
    ctx.restore();
  });
  ctx.restore();

  // center
  ctx.beginPath(); ctx.fillStyle = '#0d172e'; ctx.arc(c, c, 70, 0, Math.PI * 2); ctx.fill();
  if (state.settings.centerImage) {
    const img = new Image(); img.src = state.settings.centerImage; img.alt = state.settings.centerImageAlt;
    const s = state.settings.centerImageSize; ctx.save(); ctx.beginPath(); ctx.arc(c,c,s/2,0,Math.PI*2); ctx.clip(); ctx.drawImage(img, c-s/2, c-s/2, s, s); ctx.restore();
  }

  $('#pointer').style.borderTopColor = state.settings.pointerColor;
  $('#spinBtn').style.display = state.settings.showSpinText ? 'inline-flex' : 'none';
  $('#wheelTitleText').textContent = activeWheel()?.title || 'My Wheel';
  $('#wheelTitleText').style.display = state.settings.showTitle ? 'block' : 'none';
}

function wrapped(text, maxWidth) {
  const words = text.split(' '); let line = ''; const lines = [];
  for (const word of words) {
    const next = `${line}${word} `.trim();
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line.trim()); line = `${word} `; }
    else line = `${next} `;
  }
  lines.push(line.trim());
  return lines.slice(0, 2);
}
function textContrast(hex) {
  if (!hex || !hex.startsWith('#')) return '#111827';
  const v = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  return ((r * 299 + g * 587 + b * 114) / 1000) > 145 ? '#111827' : '#f8fafc';
}

function spin() {
  if (state.spinning || visibleEntries().length < 2) return;
  state.idleAutoSpin = false;
  state.spinning = true;
  state.spinStartTs = performance.now();
  state.startAngle = state.angle;
  const turns = 7 + Math.random() * 7;
  state.spinDurationMs = (state.settings.spinSlowly ? state.settings.duration * 1.55 : state.settings.duration) * 1000;
  state.endAngle = state.angle + turns * Math.PI * 2 + Math.random() * Math.PI * 2;
  requestAnimationFrame(animateSpin);
}
function animateSpin(ts) {
  const t = Math.min(1, (ts - state.spinStartTs) / state.spinDurationMs);
  const ease = 1 - Math.pow(1 - t, 4);
  state.angle = state.startAngle + (state.endAngle - state.startAngle) * ease;
  playTick(); drawWheel();
  if (t < 1) requestAnimationFrame(animateSpin); else finishSpin();
}
function winnerIndex() {
  const n = visibleEntries().length;
  if (!n) return -1;
  const step = (Math.PI * 2) / n;
  const pointerAngle = ((1.5 * Math.PI - state.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(pointerAngle / step) % n;
}
function finishSpin() {
  state.spinning = false;
  const entries = visibleEntries();
  const winner = entries[winnerIndex()];
  if (!winner) return;
  state.results.unshift({ name: winner.text, at: new Date().toISOString() });
  renderResults();
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
  const step = (Math.PI * 2) / n;
  const idx = Math.floor((((-state.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / step);
  if (idx !== state.lastTick) { state.lastTick = idx; tone(state.settings.tickSound, state.settings.tickVolume, 0.03); }
}
function tone(kind, vol, dur) {
  if (!audioCtx) return;
  const freq = { wood: 180, click: 520, bell: 860, applause: 230, chime: 730, trumpet: 350 }[kind] || 300;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = (kind === 'bell' || kind === 'chime') ? 'sine' : 'square';
  o.frequency.value = freq; g.gain.value = vol * 0.2;
  o.connect(g).connect(audioCtx.destination); o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.stop(audioCtx.currentTime + dur);
}
function launchConfetti() {
  for (let i = 0; i < 70; i += 1) {
    const d = document.createElement('div'); d.className = 'confetti';
    d.style.left = `${Math.random() * 100}vw`; d.style.background = `hsl(${Math.random() * 360} 90% 60%)`;
    d.style.animationDelay = `${Math.random() * 0.35}s`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
  }
}

function removeWinner(name) {
  const w = activeWheel();
  w.entries = w.entries.filter((e) => e.text !== name);
  syncEntriesUI(); drawWheel(); persist();
}
function renderResults() {
  $('#resultsList').innerHTML = state.results.map((r) => `<li>${esc(r.name)} <small>${new Date(r.at).toLocaleString()}</small></li>`).join('');
}
function syncEntriesUI() {
  const w = activeWheel();
  $('#entriesInput').value = w.entries.map((e) => e.text).join('\n');
  renderAdvancedEditor();
  renderWheelTabs();
}
function syncFromEntries() {
  pushHistory();
  activeWheel().entries = $('#entriesInput').value.split(/\n/).map((text) => ({ text, weight: 1, color: '', image: '' }));
  drawWheel(); persist();
}
function pushHistory() {
  state.history.push(JSON.stringify(activeWheel().entries));
  if (state.history.length > 60) state.history.shift();
}
function renderAdvancedEditor() {
  const box = $('#advancedEditor');
  if (!$('#advancedMode').checked) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = `<table><tr><th>Name</th><th>Weight</th><th>Color</th><th>Image URL</th></tr>${activeWheel().entries.map((e, i) => `<tr><td><input data-i="${i}" data-k="text" value="${esc(e.text)}"></td><td><input data-i="${i}" data-k="weight" type="number" min="1" value="${e.weight || 1}"></td><td><input data-i="${i}" data-k="color" type="color" value="${e.color || '#1d4ed8'}"></td><td><input data-i="${i}" data-k="image" value="${esc(e.image || '')}"></td></tr>`).join('')}</table>`;
}
function renderWheelTabs() {
  $('#wheelTabs').innerHTML = state.wheels.map((w) => `<button class="wheel-tab ${w.id === state.activeWheelId ? 'active' : ''}" data-wid="${w.id}">${esc(w.name)}</button>`).join('');
}

function persist() {
  localStorage.setItem('spinwheel-account-default', JSON.stringify({
    wheels: state.wheels, activeWheelId: state.activeWheelId, results: state.results, settings: state.settings
  }));
  encodeUrlState();
}
function encodeUrlState() {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
    wheels: state.wheels, activeWheelId: state.activeWheelId, settings: state.settings, results: state.results.slice(0, 30)
  }))));
  history.replaceState(null, '', `#${payload}`);
}
function restoreState() {
  const hash = location.hash.slice(1);
  if (hash) {
    try {
      const v = JSON.parse(decodeURIComponent(escape(atob(hash))));
      state.wheels = v.wheels; state.activeWheelId = v.activeWheelId || v.wheels[0]?.id;
      state.settings = { ...state.settings, ...v.settings }; state.results = v.results || [];
      return;
    } catch { /* fall through */ }
  }
  const local = localStorage.getItem('spinwheel-account-default');
  if (local) {
    try {
      const v = JSON.parse(local);
      state.wheels = v.wheels; state.activeWheelId = v.activeWheelId || v.wheels[0]?.id;
      state.settings = { ...state.settings, ...v.settings }; state.results = v.results || [];
      return;
    } catch { /* ignore */ }
  }
  state.wheels = [mkWheel('Wheel 1')]; state.activeWheelId = state.wheels[0].id;
}

function bindUI() {
  // Navigation
  $$('.nav-item').forEach((btn) => btn.addEventListener('click', () => {
    $$('.nav-item').forEach((x) => x.classList.remove('active')); btn.classList.add('active');
    $$('.view').forEach((x) => x.classList.remove('active')); $(`#${btn.dataset.view}`).classList.add('active');
  }));
  $('#sidebarToggle').addEventListener('click', toggleSidebar);
  $('#reopenSidebar').addEventListener('click', toggleSidebar);

  // Core spin
  $('#spinBtn').onclick = spin; canvas.onclick = spin;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') spin();
    if (e.key === 'Enter' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)) spin();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('#undoBtn').click(); }
  });

  // Entry controls
  $('#entriesInput').addEventListener('input', syncFromEntries);
  $('#shuffleBtn').onclick = () => { pushHistory(); activeWheel().entries.sort(() => Math.random() - 0.5); syncEntriesUI(); drawWheel(); persist(); };
  $('#sortBtn').onclick = () => { pushHistory(); activeWheel().entries.sort((a, b) => a.text.localeCompare(b.text)); syncEntriesUI(); drawWheel(); persist(); };
  $('#undoBtn').onclick = () => { const prev = state.history.pop(); if (prev) { activeWheel().entries = JSON.parse(prev); syncEntriesUI(); drawWheel(); persist(); } };
  $('#advancedMode').onchange = () => { $('#entriesInput').disabled = $('#advancedMode').checked; renderAdvancedEditor(); };
  $('#advancedEditor').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.i); const k = e.target.dataset.k; if (Number.isNaN(i)) return;
    activeWheel().entries[i][k] = (k === 'weight') ? Number(e.target.value) : e.target.value;
    drawWheel(); persist();
  });

  // Multi-wheel
  $('#addWheelBtn').onclick = () => {
    const nw = mkWheel(`Wheel ${state.wheels.length + 1}`);
    state.wheels.push(nw); state.activeWheelId = nw.id;
    syncEntriesUI(); drawWheel(); persist();
  };
  $('#wheelTabs').onclick = (e) => {
    const b = e.target.closest('[data-wid]'); if (!b) return;
    state.activeWheelId = b.dataset.wid; syncEntriesUI(); drawWheel(); persist();
  };

  // Winner dialog
  $('#keepWinnerBtn').onclick = () => $('#winnerDialog').close();
  $('#closeWinnerBtn').onclick = () => $('#winnerDialog').close();
  $('#removeWinnerBtn').onclick = () => { removeWinner($('#winnerName').textContent); $('#winnerDialog').close(); };

  // Top actions
  $('#newBtn').onclick = () => { state.wheels = [mkWheel('Wheel 1')]; state.activeWheelId = state.wheels[0].id; state.results = []; syncEntriesUI(); renderResults(); drawWheel(); persist(); };
  $('#saveBtn').onclick = downloadJson;
  $('#loadBtn').onclick = () => $('#loadInput').click();
  $('#loadInput').onchange = loadJson;
  $('#fullscreenBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  $('#shareBtn').onclick = () => { $('#shareTitle').value = activeWheel().title; $('#shareDialog').showModal(); };
  $('#generateShareBtn').onclick = generateShare;
  $('#closeShareDialog').onclick = () => $('#shareDialog').close();

  // Settings dialog + accordion
  $('#openSettingsDialog').onclick = () => $('#settingsDialog').showModal();
  $('#closeSettingsDialog').onclick = () => $('#settingsDialog').close();
  $$('.acc-header').forEach((h) => h.addEventListener('click', () => {
    const panel = $(`#${h.dataset.acc}`); const open = panel.classList.toggle('open'); h.setAttribute('aria-expanded', String(open));
  }));

  // Settings bind
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
  bind('reduceMotion', 'change', (v) => { state.settings.reduceMotion = v; if (v) { state.idleAutoSpin = false; } else if (state.settings.autoSpinOnLoad && !state.spinning) startIdleAutoSpin(); }, true);
  bind('showTitle', 'change', (v) => state.settings.showTitle = v, true);
  bind('displayDuplicates', 'change', (v) => state.settings.displayDuplicates = v, true);
  bind('wheelTitle', 'input', (v) => { activeWheel().title = v; drawWheel(); });
  bind('paletteSelect', 'change', (v) => state.settings.palette = v, true);
  bind('primaryColor', 'change', (v) => { if (VALID_COLORS.includes(v)) { state.settings.primary = v; document.documentElement.style.setProperty('--primary', v); }});
  bind('accentColor', 'change', (v) => { if (VALID_COLORS.includes(v)) { state.settings.accent = v; document.documentElement.style.setProperty('--accent', v); }});
  bind('colorMode', 'change', (v) => state.settings.colorMode = v, true);
  bind('centerImgSize', 'input', (v) => state.settings.centerImageSize = Number(v), true);
  bind('centerImageAlt', 'input', (v) => state.settings.centerImageAlt = v);
  bind('contoursToggle', 'change', (v) => state.settings.contours = v, true);
  bind('shadowToggle', 'change', (v) => state.settings.shadow = v, true);
  bind('pointerColor', 'input', (v) => state.settings.pointerColor = v, true);

  // Uploads/import
  toDataUrl('#wheelBgUpload', (v) => { state.settings.wheelBgImage = v; drawWheel(); persist(); });
  toDataUrl('#centerImgUpload', (v) => { state.settings.centerImage = v; drawWheel(); persist(); });
  $('#importSheetBtn').onclick = importGoogleSheet;

  // Results
  $('#sortResultsBtn').onclick = () => { state.results.sort((a, b) => a.name.localeCompare(b.name)); renderResults(); persist(); };
  $('#clearResultsBtn').onclick = () => { state.results = []; renderResults(); persist(); };
}

function bind(id, event, setter, redraw = false) {
  const el = $(`#${id}`);
  el.addEventListener(event, (e) => {
    setter(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    if (redraw) drawWheel();
    persist();
  });
}
function setPaletteOptions() {
  $('#paletteSelect').innerHTML = Object.entries(SAFE_PALETTES).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
  const colorOptions = VALID_COLORS.map((c) => `<option value="${c}">${c.toUpperCase()}</option>`).join('');
  $('#primaryColor').innerHTML = colorOptions;
  $('#accentColor').innerHTML = colorOptions;
}

function toggleSidebar() {
  $('#sidebar').classList.toggle('collapsed');
  const collapsed = $('#sidebar').classList.contains('collapsed');
  $('#sidebarToggle').setAttribute('aria-expanded', String(!collapsed));
  $('#reopenSidebar').classList.toggle('hidden', !collapsed);
  $('#sidebarToggle .caret').textContent = collapsed ? '❯' : '❮';
}
function downloadJson() {
  const data = JSON.stringify({ wheels: state.wheels, activeWheelId: state.activeWheelId, settings: state.settings, results: state.results }, null, 2);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = 'wheel.json'; a.click();
}
async function loadJson(e) {
  const f = e.target.files?.[0]; if (!f) return;
  const v = JSON.parse(await f.text());
  state.wheels = v.wheels; state.activeWheelId = v.activeWheelId || v.wheels[0]?.id;
  state.results = v.results || []; state.settings = { ...state.settings, ...v.settings };
  hydrateSettingsUI(); syncEntriesUI(); renderResults(); drawWheel(); persist();
}
function generateShare() {
  encodeUrlState();
  const link = location.href;
  $('#shareOut').value = link;
  $('#embedOut').value = `<iframe src="${link}" width="700" height="700" title="${esc($('#shareTitle').value || activeWheel().title)}"></iframe>`;
}
function importGoogleSheet() {
  const url = prompt('Paste Google Sheets CSV export URL (OAuth flow is not possible without server).');
  if (!url) return;
  fetch(url).then((r) => r.text()).then((csv) => {
    const lines = csv.split(/\r?\n/).filter(Boolean).map((l) => l.split(',')[0]);
    activeWheel().entries = lines.map((text) => ({ text, weight: 1, color: '', image: '' }));
    syncEntriesUI(); drawWheel(); persist();
  }).catch(() => alert('Import failed. Check sheet link permissions.'));
}
function toDataUrl(selector, cb) {
  $(selector).addEventListener('change', (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f);
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
  $('#showSpinText').checked = state.settings.showSpinText; $('#autoSpinOnLoad').checked = state.settings.autoSpinOnLoad; $('#reduceMotion').checked = state.settings.reduceMotion; $('#showTitle').checked = state.settings.showTitle; $('#displayDuplicates').checked = state.settings.displayDuplicates;
  $('#wheelTitle').value = activeWheel().title;
  $('#paletteSelect').value = state.settings.palette; $('#primaryColor').value = state.settings.primary; $('#accentColor').value = state.settings.accent;
  $('#colorMode').value = state.settings.colorMode; $('#centerImgSize').value = state.settings.centerImageSize; $('#centerImageAlt').value = state.settings.centerImageAlt;
  $('#contoursToggle').checked = state.settings.contours; $('#shadowToggle').checked = state.settings.shadow; $('#pointerColor').value = state.settings.pointerColor;
}
function applyTheme() {
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && sysDark);
  if (dark) {
    document.documentElement.style.setProperty('--bg', '#0f1a14');
    document.documentElement.style.setProperty('--surface', '#14241c');
    document.documentElement.style.setProperty('--surface-2', '#1b2f25');
    document.documentElement.style.setProperty('--text', '#ecfdf5');
    document.documentElement.style.setProperty('--muted', '#b5d3c2');
    document.body.style.background = 'linear-gradient(135deg,#0f1a14,#1b2f25)';
  } else {
    document.documentElement.style.setProperty('--bg', '#f8fbf8');
    document.documentElement.style.setProperty('--surface', '#ffffff');
    document.documentElement.style.setProperty('--surface-2', '#f3faf5');
    document.documentElement.style.setProperty('--text', '#163022');
    document.documentElement.style.setProperty('--muted', '#4f6b5e');
    document.body.style.background = 'linear-gradient(135deg,#ffffff,#f4faf4)';
  }
  document.documentElement.style.setProperty('--primary', state.settings.primary);
  document.documentElement.style.setProperty('--accent', state.settings.accent);
}

function startIdleAutoSpin() {
  if (state.settings.reduceMotion || !state.settings.autoSpinOnLoad || state.spinning) return;
  state.idleAutoSpin = true;
  let last = performance.now();
  const radPerMs = (Math.PI * 2) / 20000;
  function frame(ts) {
    if (!state.idleAutoSpin || state.spinning || state.settings.reduceMotion || !state.settings.autoSpinOnLoad) return;
    const dt = ts - last; last = ts;
    state.angle += radPerMs * dt;
    drawWheel();
    requestAnimationFrame(frame);
  }
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
