const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const palettes = {
  vibrant: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#f15bb5'],
  pastel: ['#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff', '#cdb4db', '#b8f2e6'],
  sunset: ['#f94144', '#f3722c', '#f8961e', '#f9844a', '#f9c74f', '#90be6d'],
  ocean: ['#003049', '#669bbc', '#00a6fb', '#0582ca', '#006494', '#17c3b2'],
  custom: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']
};
const i18n = { en: { appTitle: 'Spin Wheel Pro' }, es: { appTitle: 'Ruleta Pro' } };
const defaultEntries = ['Olivia','Liam','Noah','Emma','Ava','Ethan','Mia','Lucas'];
const app = {
  wheels: [], activeWheelId: null, results: [], history: [], spinning: false,
  spinAngle: 0, velocity: 0, spinStart: 0, spinTargetMs: 11000, lastTickSector: -1,
  settings: {
    duration: 11, visibleSectors: 10, spinSlowly: false, displayDuplicates: true,
    tickSound: 'wood', tickVolume: 0.4, celebrateSound: 'applause', celebrateVolume: 0.6,
    confetti: true, autoRemove: false, autoRemoveDelay: 5, winnerMessage: 'We have a winner!',
    showRemoveBtn: true, showTitle: true, showSpinText: true, colorMode: 'palette', palette: 'vibrant',
    wheelBgImage: '', centerImage: '', centerImageSize: 120, pageBg: '#0f172a', gradient: true,
    shadow: true, contours: true, pointerColor: '#f8fafc', theme: 'system'
  }
};

function makeWheel(name = 'Wheel 1') {
  return { id: crypto.randomUUID(), name, title: 'My Wheel', entries: defaultEntries.map((t) => ({ text: t, weight: 1, color: null, image: '' })) };
}

function getActiveWheel(){ return app.wheels.find(w => w.id === app.activeWheelId); }
function effectiveEntries(w) {
  let arr = (w?.entries || []).filter(e => e.text.trim());
  if (!app.settings.displayDuplicates) {
    const seen = new Set(); arr = arr.filter(e => seen.has(e.text) ? false : (seen.add(e.text), true));
  }
  return arr;
}
function pushHistory(){ app.history.push(JSON.stringify(getActiveWheel().entries)); if (app.history.length > 50) app.history.shift(); }

const canvas = $('#wheelCanvas'); const ctx = canvas.getContext('2d');
function fitCanvas() {
  const dpr = devicePixelRatio || 1;
  const size = Math.min(canvas.clientWidth || 900, canvas.clientHeight || 900);
  canvas.width = size * dpr; canvas.height = size * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawWheel() {
  fitCanvas();
  const w = getActiveWheel(); if (!w) return;
  const entries = effectiveEntries(w); const n = Math.max(entries.length, 1);
  const size = Math.min(canvas.clientWidth, canvas.clientHeight); const c = size / 2; const r = c - 12;
  ctx.clearRect(0, 0, size, size);
  if (app.settings.shadow) { ctx.shadowColor = '#0008'; ctx.shadowBlur = 18; }
  ctx.save(); ctx.translate(c, c); ctx.rotate(app.spinAngle);
  const step = (Math.PI * 2) / n;

  if (app.settings.colorMode === 'image' && app.settings.wheelBgImage) {
    const img = new Image(); img.src = app.settings.wheelBgImage;
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip(); ctx.drawImage(img, -r, -r, r*2, r*2); ctx.restore();
  }
  entries.forEach((entry, i) => {
    const a0 = i * step, a1 = a0 + step;
    if (app.settings.colorMode === 'palette') {
      const pal = palettes[app.settings.palette] || palettes.vibrant;
      ctx.fillStyle = entry.color || pal[i % pal.length];
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,a0,a1); ctx.closePath(); ctx.fill();
    }
    if (app.settings.contours) { ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,a0,a1); ctx.closePath(); ctx.stroke(); }
    ctx.save();
    ctx.rotate(a0 + step / 2); ctx.translate(r * 0.68, 0); ctx.rotate(Math.PI / 2);
    const fill = textColorForBg(ctx.fillStyle || '#fff'); ctx.fillStyle = fill;
    ctx.font = `${Math.max(12, Math.min(22, 260 / n))}px sans-serif`; ctx.textAlign = 'center';
    wrapText(entry.text, 0, 0, r * 0.44, 18).forEach((line, li) => ctx.fillText(line, 0, li * 18));
    ctx.restore();
  });
  ctx.restore();

  ctx.beginPath(); ctx.fillStyle = '#0b1220'; ctx.arc(c, c, 68, 0, Math.PI * 2); ctx.fill();
  if (app.settings.centerImage) {
    const img = new Image(); img.src = app.settings.centerImage;
    const s = app.settings.centerImageSize; ctx.save(); ctx.beginPath(); ctx.arc(c, c, s / 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, c - s / 2, c - s / 2, s, s); ctx.restore();
  }
  if (app.settings.showSpinText) { $('.spin-overlay').style.display = 'block'; $('.spin-overlay').textContent = 'Click to spin'; }
  else $('.spin-overlay').style.display = 'none';
  $('#pointer').style.borderTopColor = app.settings.pointerColor;
}
function textColorForBg(hex){
  if (!hex || !hex.startsWith('#')) return '#111'; const n = hex.slice(1); const v = n.length===3? n.split('').map(c=>c+c).join(''): n;
  const [r,g,b] = [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)); const yiq = ((r*299)+(g*587)+(b*114))/1000; return yiq > 128 ? '#0f172a' : '#f8fafc';
}
function wrapText(t, x,y,maxW,lh){ const words=t.split(' '); const lines=[]; let line=''; for(const w of words){ const test=(line+w+' ').trim(); if(ctx.measureText(test).width>maxW && line){ lines.push(line.trim()); line=w+' '; } else line=test+' '; } lines.push(line.trim()); return lines.slice(0,2); }

function spin(){
  if (app.spinning || effectiveEntries(getActiveWheel()).length < 2) return;
  app.spinning = true; app.spinStart = performance.now();
  const d = (app.settings.spinSlowly ? app.settings.duration * 1.6 : app.settings.duration) * 1000;
  app.spinTargetMs = d;
  const turns = 7 + Math.random() * 7;
  const extra = Math.random() * Math.PI * 2;
  app.startAngle = app.spinAngle;
  app.targetAngle = app.spinAngle + turns * Math.PI * 2 + extra;
  requestAnimationFrame(stepSpin);
}
function stepSpin(ts){
  const t = Math.min(1, (ts - app.spinStart) / app.spinTargetMs);
  const ease = 1 - Math.pow(1 - t, 4);
  app.spinAngle = app.startAngle + (app.targetAngle - app.startAngle) * ease;
  playTickIfNeeded(); drawWheel();
  if (t < 1) requestAnimationFrame(stepSpin); else finishSpin();
}
function playTickIfNeeded(){
  const entries = effectiveEntries(getActiveWheel()); if (!entries.length) return;
  const step = (Math.PI*2)/entries.length;
  const idx = Math.floor((((-app.spinAngle)%(Math.PI*2)+(Math.PI*2))%(Math.PI*2))/step);
  if (idx !== app.lastTickSector){ app.lastTickSector = idx; playTone(app.settings.tickSound, app.settings.tickVolume, 0.03); }
}
function winnerIndex(){
  const entries = effectiveEntries(getActiveWheel()); const n = entries.length;
  const step = (Math.PI*2)/n;
  const ang = ((Math.PI*1.5 - app.spinAngle)%(Math.PI*2) + Math.PI*2)%(Math.PI*2);
  return Math.floor(ang/step)%n;
}
function finishSpin(){
  app.spinning = false;
  const w = getActiveWheel(); const entries = effectiveEntries(w); const idx = winnerIndex(); const winner = entries[idx];
  if (!winner) return;
  app.results.unshift({name: winner.text, at: new Date().toISOString()}); renderResults();
  playTone(app.settings.celebrateSound, app.settings.celebrateVolume, 0.5);
  if (app.settings.confetti) confetti();
  $('#winnerTitle').textContent = app.settings.winnerMessage;
  $('#winnerName').textContent = winner.text;
  $('#removeWinnerBtn').style.display = app.settings.showRemoveBtn ? 'inline-block' : 'none';
  $('#winnerDialog').showModal();
  if (app.settings.autoRemove) setTimeout(() => removeWinner(winner.text), app.settings.autoRemoveDelay * 1000);
}
function removeWinner(name){
  const w = getActiveWheel(); w.entries = w.entries.filter(e => e.text !== name); syncEntriesUI(); drawWheel(); saveLocal();
}
function renderResults(){ $('#resultsList').innerHTML = app.results.map(r=>`<li>${r.name} <small>${new Date(r.at).toLocaleString()}</small></li>`).join(''); }
function confetti(){ for(let i=0;i<80;i++){ const d=document.createElement('div'); d.className='confetti'; d.style.left=Math.random()*100+'vw'; d.style.background=`hsl(${Math.random()*360} 90% 60%)`; d.style.animationDelay=(Math.random()*0.4)+'s'; document.body.appendChild(d); setTimeout(()=>d.remove(),2800);} }

function playTone(kind, vol, dur){
  const ac = (window.__ac ||= new (window.AudioContext || window.webkitAudioContext)());
  const o = ac.createOscillator(), g = ac.createGain();
  const freq = { wood:170, click:500, bell:900, applause:220, chime:780, trumpet:350 }[kind] || 300;
  o.frequency.value = freq; o.type = kind==='bell'||kind==='chime' ? 'sine' : 'square'; g.gain.value = vol * 0.18;
  o.connect(g).connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur); o.stop(ac.currentTime + dur);
}

function syncEntriesUI(){
  const w = getActiveWheel(); $('#entriesInput').value = w.entries.map(e=>e.text).join('\n'); renderAdvancedEditor(); renderWheelTabs();
}
function syncFromTextarea(){
  const w = getActiveWheel(); pushHistory();
  w.entries = $('#entriesInput').value.split(/\n/).map(t=>({text:t,weight:1,color:null,image:''}));
  saveLocal(); drawWheel();
}
function renderAdvancedEditor(){
  const box = $('#advancedEditor'); if (!$('#advancedMode').checked){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden'); box.innerHTML = '<table><tr><th>Name</th><th>Weight</th><th>Color</th></tr>' + getActiveWheel().entries.map((e,i)=>`<tr><td><input data-ai="${i}" data-k="text" value="${escapeHtml(e.text)}"></td><td><input data-ai="${i}" data-k="weight" type="number" min="1" value="${e.weight||1}"></td><td><input data-ai="${i}" data-k="color" type="color" value="${e.color||'#3b82f6'}"></td></tr>`).join('') + '</table>';
}
function renderWheelTabs(){
  $('#wheelTabs').innerHTML = app.wheels.map((w,i)=>`<button class="wheel-tab ${w.id===app.activeWheelId?'active':''}" data-wid="${w.id}">${w.name}</button>`).join('');
}
function escapeHtml(s){ return s.replace(/[&<>'"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[m])); }

function saveStateToUrl(){
  const payload = { wheels: app.wheels, settings: app.settings, results: app.results.slice(0,20), activeWheelId: app.activeWheelId };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  history.replaceState(null, '', '#' + encoded);
}
function loadStateFromUrl(){
  const h = location.hash.slice(1); if (!h) return false;
  try { const parsed = JSON.parse(decodeURIComponent(escape(atob(h)))); Object.assign(app, { wheels: parsed.wheels, settings: { ...app.settings, ...parsed.settings }, results: parsed.results || [], activeWheelId: parsed.activeWheelId || parsed.wheels[0]?.id }); return true; }
  catch { return false; }
}
function saveLocal(){ localStorage.setItem('spinwheel-account-default', JSON.stringify({ wheels: app.wheels, settings: app.settings, results: app.results, activeWheelId: app.activeWheelId })); saveStateToUrl(); }
function loadLocal(){ const v = localStorage.getItem('spinwheel-account-default'); if (!v) return false; try{ const p=JSON.parse(v); Object.assign(app,p); return true;}catch{return false;} }

function setupUI(){
  $('#spinBtn').onclick = spin; canvas.onclick = spin;
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') spin(); if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault(); $('#undoBtn').click();} });
  $('#entriesInput').addEventListener('input', syncFromTextarea);
  $('#shuffleBtn').onclick = () => { const w=getActiveWheel(); pushHistory(); w.entries.sort(()=>Math.random()-0.5); syncEntriesUI(); drawWheel(); saveLocal(); };
  $('#sortBtn').onclick = () => { const w=getActiveWheel(); pushHistory(); w.entries.sort((a,b)=>a.text.localeCompare(b.text)); syncEntriesUI(); drawWheel(); saveLocal(); };
  $('#undoBtn').onclick = () => { const prev=app.history.pop(); if(prev){getActiveWheel().entries=JSON.parse(prev); syncEntriesUI(); drawWheel(); saveLocal();}};
  $('#removeWinnerBtn').onclick = () => { removeWinner($('#winnerName').textContent); $('#winnerDialog').close(); };
  $('#keepWinnerBtn').onclick = () => $('#winnerDialog').close(); $('#closeWinnerBtn').onclick = () => $('#winnerDialog').close();
  $$('.tab').forEach(t => t.onclick = () => { $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); $$('.tab-content').forEach(c=>c.classList.remove('active')); $('#'+t.dataset.tab).classList.add('active');});

  $('#durationSlider').oninput = (e) => { app.settings.duration = +e.target.value; $('#durationValue').textContent = e.target.value; saveLocal(); };
  $$('.presetDuration').forEach(b=>b.onclick = () => { $('#durationSlider').value = b.dataset.v; $('#durationSlider').dispatchEvent(new Event('input')); });
  bindSetting('visibleSectors','input',v=>+v); bindSetting('spinSlowly','change',v=>v); bindSetting('displayDuplicates','change',v=>v,drawWheel);
  bindSetting('tickSoundSelect','change',v=>v); bindSetting('tickVolume','input',v=>+v);
  bindSetting('celebrateSoundSelect','change',v=>v); bindSetting('celebrateVolume','input',v=>+v);
  bindSetting('confettiToggle','change',v=>v); bindSetting('autoRemoveToggle','change',v=>v); bindSetting('autoRemoveDelay','input',v=>+v);
  bindSetting('winnerMessage','input',v=>v); bindSetting('showRemoveBtn','change',v=>v);
  bindSetting('showTitleToggle','change',v=>v); bindSetting('showSpinTextToggle','change',v=>v,drawWheel);
  bindSetting('colorMode','change',v=>v,drawWheel); bindSetting('paletteSelect','change',v=>v,drawWheel);
  bindSetting('centerImgSize','input',v=>+v,drawWheel); bindSetting('pageBgColor','input',v=>v,()=>{document.body.style.background=v;});
  bindSetting('gradientToggle','change',v=>v,()=>document.body.style.backgroundImage=app.settings.gradient?'linear-gradient(135deg,#ffffff10,#00000040)':'none');
  bindSetting('wheelShadowToggle','change',v=>v,drawWheel); bindSetting('contoursToggle','change',v=>v,drawWheel);
  bindSetting('pointerColor','input',v=>v,drawWheel);

  $('#paletteSelect').innerHTML = Object.keys(palettes).map(k=>`<option value="${k}">${k}</option>`).join('');
  $('#shareTheme').innerHTML = $('#paletteSelect').innerHTML;
  renderCustomPalette();
  $('#refreshColorsBtn').onclick = () => { palettes.custom = palettes.custom.sort(() => Math.random() - 0.5); renderCustomPalette(); drawWheel(); };

  $('#advancedMode').onchange = () => { if ($('#advancedMode').checked) $('#entriesInput').disabled = true; else $('#entriesInput').disabled = false; renderAdvancedEditor(); };
  $('#advancedEditor').addEventListener('input', (e) => {
    const i = +e.target.dataset.ai, key = e.target.dataset.k; if (Number.isNaN(i)) return;
    getActiveWheel().entries[i][key] = key === 'weight' ? +e.target.value : e.target.value; drawWheel(); saveLocal();
  });
  $('#wheelTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.wheel-tab'); if(!b) return; app.activeWheelId = b.dataset.wid; syncEntriesUI(); drawWheel(); saveLocal();
  });
  $('#addWheelBtn').onclick = () => { const nw = makeWheel(`Wheel ${app.wheels.length + 1}`); app.wheels.push(nw); app.activeWheelId = nw.id; syncEntriesUI(); drawWheel(); saveLocal(); };

  $('#collapsePanelBtn').onclick = () => { const p = $('#sidePanel'); p.style.display = p.style.display==='none' ? 'block' : 'none'; };
  $('#fullscreenBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

  $('#newWheelBtn').onclick = () => { app.wheels = [makeWheel('Wheel 1')]; app.activeWheelId = app.wheels[0].id; app.results=[]; syncEntriesUI(); renderResults(); drawWheel(); saveLocal(); };
  $('#saveWheelBtn').onclick = () => {
    const blob = new Blob([JSON.stringify({wheels:app.wheels,settings:app.settings,results:app.results},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='wheel.json'; a.click();
  };
  $('#loadWheelBtn').onclick = () => $('#loadWheelInput').click();
  $('#loadWheelInput').onchange = async (e) => { const f=e.target.files[0]; if(!f) return; const p=JSON.parse(await f.text()); app.wheels=p.wheels; app.settings={...app.settings,...p.settings}; app.results=p.results||[]; app.activeWheelId=app.wheels[0].id; syncEntriesUI(); drawWheel(); renderResults(); saveLocal(); };

  $('#shareBtn').onclick = () => { $('#shareDialog').showModal(); $('#shareTitle').value = getActiveWheel().title; };
  $('#generateShareBtn').onclick = () => {
    const code = crypto.randomUUID().slice(0,8); const payload = { ...JSON.parse(JSON.stringify(app)), code, visibility: $('#shareVisibility').value, views: 0, createdAt: new Date().toISOString() };
    const arr = JSON.parse(localStorage.getItem('spinwheel-gallery')||'[]'); arr.unshift(payload); localStorage.setItem('spinwheel-gallery', JSON.stringify(arr));
    saveStateToUrl(); const link = location.href; $('#shareLinkOut').value = link; $('#embedCodeOut').value = `<iframe src="${link}" width="640" height="640" title="${$('#shareTitle').value}"></iframe>`;
    $('#sharePreview').innerHTML = `<strong>Preview:</strong> ${escapeHtml($('#shareTitle').value)} / ${$('#shareVisibility').value}`; renderGallery();
  };
  $('#closeShareBtn').onclick = () => $('#shareDialog').close();

  $('#gallerySearch').oninput = renderGallery;
  $('#galleryList').onclick = (e) => {
    const btn = e.target.closest('button[data-code]'); if(!btn) return;
    const list = JSON.parse(localStorage.getItem('spinwheel-gallery')||'[]'); const item = list.find(i=>i.code===btn.dataset.code); if(!item) return;
    item.views++; localStorage.setItem('spinwheel-gallery', JSON.stringify(list));
    app.wheels = item.wheels; app.settings = { ...app.settings, ...item.settings }; app.results = item.results || []; app.activeWheelId = item.activeWheelId || item.wheels[0].id;
    syncEntriesUI(); drawWheel(); renderResults(); renderGallery();
  };

  $('#sortResultsBtn').onclick = ()=>{app.results.sort((a,b)=>a.name.localeCompare(b.name)); renderResults(); saveLocal();};
  $('#clearResultsBtn').onclick = ()=>{app.results=[]; renderResults(); saveLocal();};
  $('#importSheetBtn').onclick = ()=>{
    const u = prompt('Paste Google Sheet CSV export URL (OAuth would require backend; using URL import):'); if(!u) return;
    fetch(u).then(r=>r.text()).then(t=>{ const lines=t.split(/\r?\n/).filter(Boolean).map(l=>l.split(',')[0]); getActiveWheel().entries=lines.map(x=>({text:x,weight:1,color:null,image:''})); syncEntriesUI(); drawWheel(); saveLocal(); }).catch(()=>alert('Import failed.'));
  };

  $('#addImageBtn').onclick = ()=> alert('Use background/center upload controls or advanced mode per-entry image fields.');
  fileToDataUrl('#wheelBgUpload', v => { app.settings.wheelBgImage = v; drawWheel(); saveLocal(); });
  fileToDataUrl('#centerImgUpload', v => { app.settings.centerImage = v; drawWheel(); saveLocal(); });

  $('#moreBtn').onclick = () => { $('#preferencesDialog').showModal(); $('#prefShowSpinText').checked = app.settings.showSpinText; };
  $('#prefShowSpinText').onchange = (e) => { app.settings.showSpinText = e.target.checked; $('#showSpinTextToggle').checked = e.target.checked; drawWheel(); saveLocal(); };
  $('#themeSelect').onchange = (e)=>{ app.settings.theme=e.target.value; applyTheme(); saveLocal(); };
  $('#closePreferencesBtn').onclick = () => $('#preferencesDialog').close();

  $('#languageBtn').onclick = ()=> $('#languageSelect').focus();
  $('#languageSelect').onchange = (e)=>applyLanguage(e.target.value);
}

function bindSetting(id, evt, map, cb){ const el = $('#'+id); el.addEventListener(evt, (e)=>{ const keyMap={visibleSectors:'visibleSectors',spinSlowly:'spinSlowly',displayDuplicates:'displayDuplicates',tickSoundSelect:'tickSound',tickVolume:'tickVolume',celebrateSoundSelect:'celebrateSound',celebrateVolume:'celebrateVolume',confettiToggle:'confetti',autoRemoveToggle:'autoRemove',autoRemoveDelay:'autoRemoveDelay',winnerMessage:'winnerMessage',showRemoveBtn:'showRemoveBtn',showTitleToggle:'showTitle',showSpinTextToggle:'showSpinText',colorMode:'colorMode',paletteSelect:'palette',centerImgSize:'centerImageSize',pageBgColor:'pageBg',gradientToggle:'gradient',wheelShadowToggle:'shadow',contoursToggle:'contours',pointerColor:'pointerColor'}; app.settings[keyMap[id]]=map(e.target.type==='checkbox'?e.target.checked:e.target.value); cb?.(); saveLocal(); if(['colorMode','paletteSelect'].includes(id))drawWheel(); }); }
function fileToDataUrl(sel, cb){ $(sel).addEventListener('change', (e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>cb(r.result); r.readAsDataURL(f); }); }
function renderCustomPalette(){ $('#customPalette').innerHTML = palettes.custom.map((c,i)=>`<input type="color" data-cidx="${i}" value="${c}" />`).join(''); $('#customPalette').oninput = (e)=>{ if(e.target.dataset.cidx!==undefined){ palettes.custom[+e.target.dataset.cidx]=e.target.value; drawWheel(); } }; }
function renderGallery(){ const q = $('#gallerySearch').value.toLowerCase(); const list=(JSON.parse(localStorage.getItem('spinwheel-gallery')||'[]')).filter(i=>i.visibility==='public' && (i.wheels?.[0]?.title||'').toLowerCase().includes(q)); $('#galleryList').innerHTML=list.map(i=>`<div class="item"><div><strong>${escapeHtml(i.wheels?.[0]?.title||'Untitled')}</strong></div><div>Code: ${i.code} | Views: ${i.views||0} | ${new Date(i.createdAt).toLocaleDateString()}</div><button data-code="${i.code}">Open</button><button data-code="${i.code}">Copy this wheel</button></div>`).join('')||'<p>No public wheels.</p>'; }
function applyTheme(){ const t=app.settings.theme; const sys=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'; document.body.classList.toggle('light',(t==='light')||(t==='system'&&sys==='light')); }
function applyLanguage(lang){ document.documentElement.lang=lang; $$('[data-i18n]').forEach(el=>el.textContent=(i18n[lang]&&i18n[lang][el.dataset.i18n])||el.textContent); }

function init(){
  const loaded = loadStateFromUrl() || loadLocal();
  if (!loaded) { app.wheels = [makeWheel('Wheel 1')]; app.activeWheelId = app.wheels[0].id; }
  syncEntriesUI(); renderResults(); setupUI(); drawWheel(); renderGallery(); applyTheme();
  window.addEventListener('resize', drawWheel);
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
init();
