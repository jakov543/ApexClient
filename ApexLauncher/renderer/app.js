const $ = id => document.getElementById(id);

const MODS = [
  { n: 'FPS', d: 'Shows your frames per second.', c: 'HUD', i: '⚡' },
  { n: 'CPS', d: 'Left and right clicks per second.', c: 'HUD', i: '🖱️' },
  { n: 'Keystrokes', d: 'WASD, mouse buttons and space bar on screen.', c: 'HUD', i: '⌨️' },
  { n: 'Coordinates', d: 'X Y Z and the direction you face.', c: 'HUD', i: '🧭' },
  { n: 'Ping', d: 'Your latency to the server.', c: 'HUD', i: '📶' },
  { n: 'Armor Status', d: 'Armor and held item with durability.', c: 'HUD', i: '🛡️' },
  { n: 'Potion Effects', d: 'Active effects with time left.', c: 'HUD', i: '🧪' },
  { n: 'Clock', d: 'Real-life time on screen.', c: 'HUD', i: '🕒' },
  { n: 'Server IP', d: 'Shows the server you are playing on.', c: 'HUD', i: '🌐' },
  { n: 'Zoom', d: 'Hold C to zoom, scroll to adjust.', c: 'PVP', i: '🔍' },
  { n: 'Toggle Sprint', d: 'Sprint automatically when moving forward.', c: 'PVP', i: '🏃' },
  { n: 'Fullbright', d: 'See clearly in caves and at night.', c: 'VISUAL', i: '💡' },
  { n: 'Apex Cape', d: 'Wear the Apex Client cape.', c: 'COSMETIC', i: '🧣' },
  { n: 'Discord Rich Presence', d: 'Shows what you play on your Discord profile.', c: 'CLIENT', i: '💬' },
  { n: 'HUD Editor', d: 'Drag every HUD element where you want it.', c: 'CLIENT', i: '✋' }
];

const NEWS = [
  { tag: 'WELCOME', t: 'Apex Client is here', p: 'A fast, clean PvP client for Minecraft 1.21.1 with all your favourite mods built in.' },
  { tag: 'TIP', t: 'Press Right Shift', p: 'Open the mod menu in game to toggle mods and drag your HUD anywhere.' },
  { tag: 'DISCORD', t: 'Rich Presence', p: 'Your friends see your server, world and play time right on your Discord profile.' }
];

const LABELS = { ALL: 'All', HUD: 'HUD', PVP: 'PvP', VISUAL: 'Visual', COSMETIC: 'Cosmetic', CLIENT: 'Client' };
let info, settings, state = 'idle';

// ---------------------------------------------------------------- helpers
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = 'toast' + (err ? ' err' : '')), 4200);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gb = mb => (mb / 1024).toFixed(1) + ' GB';

// ---------------------------------------------------------------- navigation
document.querySelectorAll('.nav').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + btn.dataset.page));
  $('crumb').textContent = btn.querySelector('span').textContent;
}));

$('btnMin').onclick = () => apex.minimize();
$('btnClose').onclick = () => apex.close();

// ---------------------------------------------------------------- account
let currentAccount = null;

function readySub() {
  if (!currentAccount) return 'Sign in with Microsoft to play';
  return currentAccount.demo ? 'Demo mode · buy Minecraft for the full game' : 'Ready to play';
}
function idleLaunch() { setLaunch(currentAccount ? 'LAUNCH GAME' : 'SIGN IN TO PLAY', readySub()); }

function showLogin() { $('loginErr').textContent = ''; $('login').classList.add('show'); }

function setAccount(acc, firstStart = false) {
  currentAccount = acc;
  const pill = $('account');
  if (acc) {
    $('accName').innerHTML = esc(acc.name) + (acc.demo ? '<span class="demo-badge">DEMO</span>' : '');
    $('accSub').textContent = acc.demo ? 'No Minecraft licence' : 'Microsoft account';
    $('avatar').src = acc.uuid ? `https://mc-heads.net/avatar/${acc.uuid}/64` : 'assets/emblem.png';
    pill.classList.remove('guest');
    $('login').classList.remove('show');
  } else {
    $('accName').textContent = 'Sign in';
    $('accSub').textContent = 'Microsoft account';
    $('avatar').src = 'assets/emblem.png';
    pill.classList.add('guest');
    let skipped = false;
    try { skipped = localStorage.getItem('skipLogin') === '1'; } catch (_) {}
    if (!(firstStart && skipped)) showLogin();
  }
  if (state === 'idle') idleLaunch();
}

$('account').onclick = e => {
  e.stopPropagation();
  if (!currentAccount) return showLogin();
  $('account').classList.toggle('open');
};
document.addEventListener('click', () => $('account').classList.remove('open'));

$('btnLogout').onclick = async () => { await apex.logout(); setAccount(null); };

$('btnSkip').onclick = () => {
  try { localStorage.setItem('skipLogin', '1'); } catch (_) {}
  $('login').classList.remove('show');
};

$('btnLogin').onclick = async () => {
  const b = $('btnLogin');
  b.disabled = true; $('loginErr').textContent = '';
  try {
    const acc = await apex.login();
    try { localStorage.removeItem('skipLogin'); } catch (_) {}
    setAccount(acc);
    toast(acc.demo ? 'Signed in — this account has no Minecraft, so you get the free Demo.' : 'Signed in — have fun!');
  } catch (e) {
    const msg = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    $('loginErr').textContent = /cancel|closed/i.test(msg) ? 'Sign in cancelled.' : msg;
  } finally { b.disabled = false; }
};

// ---------------------------------------------------------------- launch
function setLaunch(main, sub, p = null, cls = '') {
  $('launchText').textContent = main;
  $('launchSub').textContent = sub;
  $('btnLaunch').className = 'launch ' + cls;
  $('launchFill').style.width = p == null ? '0' : Math.round(p * 100) + '%';
}

$('btnLaunch').onclick = async () => {
  if (state !== 'idle') return;
  if (!currentAccount) return showLogin();
  state = 'preparing';
  setLaunch('PREPARING', 'Checking files…', 0, 'busy');
  try {
    await apex.launch();
  } catch (e) {
    state = 'idle';
    idleLaunch();
    if (/SIGN_IN/.test(String(e.message || e))) return showLogin();
    toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true);
  }
};

apex.onProgress(({ text, p }) => {
  if (state === 'running') return;
  setLaunch('INSTALLING', `${text}${p ? ' · ' + Math.round(p * 100) + '%' : '…'}`, p, 'busy');
});

apex.onState(s => {
  if (s === 'starting') { state = 'starting'; setLaunch('STARTING', 'Opening Minecraft…', 1, 'busy'); }
  if (s === 'running') { state = 'running'; setLaunch('PLAYING', 'Minecraft is running', null, 'running'); }
  if (s === 'closed' || s === 'crashed') {
    state = 'idle';
    idleLaunch();
    if (s === 'crashed') toast('Minecraft closed unexpectedly — check Settings → Game logs.', true);
  }
});

const logLines = [];
apex.onLog(line => {
  logLines.push(line.trimEnd());
  if (logLines.length > 600) logLines.splice(0, logLines.length - 600);
  if (!$('logs').classList.contains('hidden')) renderLogs();
});
function renderLogs() { const l = $('logs'); l.textContent = logLines.join('\n') || 'No logs yet.'; l.scrollTop = l.scrollHeight; }
$('btnLogs').onclick = () => { $('logs').classList.toggle('hidden'); renderLogs(); };
$('btnFolder').onclick = () => apex.openFolder();

// ---------------------------------------------------------------- mods page
function renderMods(filter = 'ALL') {
  const cats = ['ALL', ...new Set(MODS.map(m => m.c))];
  $('modFilters').innerHTML = cats.map(c => `<button class="${c === filter ? 'active' : ''}" data-c="${c}">${LABELS[c] || c}</button>`).join('');
  $('modFilters').querySelectorAll('button').forEach(b => b.onclick = () => renderMods(b.dataset.c));
  $('modGrid').innerHTML = MODS.filter(m => filter === 'ALL' || m.c === filter).map(m => `
    <div class="mod"><div class="ic">${m.i}</div>
      <div><b>${esc(m.n)}</b><p>${esc(m.d)}</p><div class="cat">${m.c}</div></div></div>`).join('');
}

// ---------------------------------------------------------------- news
async function renderNews() {
  let news = NEWS;
  if (info.newsUrl) {
    try { const r = await fetch(info.newsUrl, { cache: 'no-store' }); if (r.ok) news = (await r.json()).slice(0, 3); } catch (_) {}
  }
  $('news').innerHTML = news.map(n => `
    <div class="news-card"><span class="tag">${esc(n.tag)}</span><b>${esc(n.t)}</b><p>${esc(n.p)}</p></div>`).join('');
}

// ---------------------------------------------------------------- settings
function bindSettings() {
  const ram = $('ram');
  ram.max = Math.max(2048, Math.floor((info.totalRamMb - 1024) / 256) * 256);
  $('ramMax').textContent = gb(+ram.max);
  ram.value = settings.ramMb;
  $('ramVal').textContent = gb(settings.ramMb);
  ram.oninput = () => { $('ramVal').textContent = gb(+ram.value); };
  ram.onchange = () => apex.setSettings({ ramMb: +ram.value });

  $('closeOnLaunch').checked = settings.closeOnLaunch;
  $('closeOnLaunch').onchange = e => apex.setSettings({ closeOnLaunch: e.target.checked });
  $('discordRpc').checked = settings.discordRpc;
  $('discordRpc').onchange = e => apex.setSettings({ discordRpc: e.target.checked });
}

// ---------------------------------------------------------------- start
(async () => {
  info = await apex.info();
  settings = await apex.getSettings();
  $('mcVersion').textContent = info.mc;
  $('appVersion').textContent = 'v' + info.version;
  renderMods();
  renderNews();
  bindSettings();
  $('accName').textContent = 'Signing in…';
  setAccount(await apex.getAccount(), true);
})();
