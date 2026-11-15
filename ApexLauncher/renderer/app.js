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
  { n: 'HUD Editor', d: 'Drag every HUD element where you want it.', c: 'CLIENT', i: '✋' },
  { n: 'Server Quick Join', d: 'Join your favourite servers straight from the launcher.', c: 'CLIENT', i: '🚀' },
  { n: 'Screenshot Gallery', d: 'All your F2 screenshots in one place.', c: 'CLIENT', i: '🖼️' },
  { n: 'Sodium', d: 'Big FPS boost on every Fabric version.', c: 'VISUAL', i: '🚀' }
];

const NEWS = [
  { tag: 'v1.4', t: 'New in-game menus', p: 'Brand-new main menu and Right Shift mod menu with profiles, search, and OPTIONS for every mod (1.21.1).' },
  { tag: 'v1.3', t: 'New look & Discord status', p: 'Fresh logo, Rich Presence on every version, and Java 25 support for the newest Minecraft.' },
  { tag: 'NEW', t: 'Every version, 1.8 → latest', p: 'Pick any version next to Launch. 1.21.1 has all Apex mods, other versions get Fabric + Sodium.' },

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
  if (btn.dataset.page === 'shots' && typeof loadShots === 'function') loadShots();
}));

$('btnMin').onclick = () => apex.minimize();
$('btnClose').onclick = () => apex.close();

// ---------------------------------------------------------------- account
let currentAccount = null;

function readySub() {
  if (!currentAccount) return 'Sign in with Microsoft to play';
  if (currentAccount.status === 'needsName') return 'Pick your username to play';
  return currentAccount.demo ? 'Demo mode · tap your name → Why Demo?' : 'Ready to play';
}
function idleLaunch() { setLaunch(currentAccount ? 'LAUNCH GAME' : 'SIGN IN TO PLAY', readySub()); }

function showLogin() { $('loginErr').textContent = ''; $('login').classList.add('show'); }

function setAccount(acc, firstStart = false) {
  currentAccount = acc;
  const pill = $('account');
  if (acc) {
    $('accName').innerHTML = esc(acc.name) + (acc.demo ? '<span class="demo-badge">DEMO</span>' : '');
    $('accSub').textContent = { needsName: 'Owns Minecraft · pick a name', bedrockOnly: 'Bedrock only · no Java', none: 'No Java Edition here' }[acc.status] || 'Microsoft account';
    $('btnWhyDemo').classList.toggle('hidden', !acc.demo);
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
  $('setAccName').innerHTML = acc ? esc(acc.name) + (acc.demo ? '<span class="demo-badge">DEMO</span>' : '') : 'Not signed in';
  $('setAccSub').textContent = acc ? ({ needsName: 'Owns Minecraft — choose a username', bedrockOnly: 'Only Bedrock on this account — Demo', none: 'No Java Edition on this account — Demo' }[acc.status] || 'Signed in with Microsoft') : 'Sign in to play';
  $('setAvatar').src = $('avatar').src;
  $('btnSetAcc').textContent = acc ? 'Sign out' : 'Sign in';
  if (state === 'idle') idleLaunch();
}

$('btnSetAcc').onclick = async () => {
  if (currentAccount) { await apex.logout(); setAccount(null); toast('Signed out'); }
  else showLogin();
};

$('account').onclick = e => {
  e.stopPropagation();
  if (!currentAccount) return showLogin();
  $('account').classList.toggle('open');
};
document.addEventListener('click', () => $('account').classList.remove('open'));

$('btnLogout').onclick = async () => { await apex.logout(); setAccount(null); toast('Signed out'); };
$('btnSwitch').onclick = async () => { await apex.logout(); setAccount(null); };
$('btnWhyDemo').onclick = e => { e.stopPropagation(); $('account').classList.remove('open'); currentAccount && currentAccount.status === 'needsName' ? showNameModal() : showDemoModal(); };

// ---------------------------------------------------------------- username / demo help
let nameTimer = null;
function showNameModal() {
  $('nameErr').textContent = ''; $('nameSt').textContent = ''; $('nameSt').className = 'name-st';
  $('nameModal').classList.add('show');
  setTimeout(() => $('nameInput').focus(), 50);
}
$('nameInput').oninput = () => {
  const n = $('nameInput').value.trim();
  clearTimeout(nameTimer);
  $('nameErr').textContent = '';
  if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) {
    $('nameSt').textContent = n ? '3–16: A-Z 0-9 _' : ''; $('nameSt').className = 'name-st bad'; return;
  }
  $('nameSt').textContent = 'Checking…'; $('nameSt').className = 'name-st wait';
  nameTimer = setTimeout(async () => {
    try {
      const st = await apex.nameStatus(n);
      if ($('nameInput').value.trim() !== n) return;
      const map = { AVAILABLE: ['✓ Available', 'ok'], DUPLICATE: ['✕ Taken', 'bad'], NOT_ALLOWED: ['✕ Not allowed', 'bad'], RATE_LIMITED: ['Slow down…', 'wait'] };
      const [t, c] = map[st] || ['Can\'t check', 'wait'];
      $('nameSt').textContent = t; $('nameSt').className = 'name-st ' + c;
    } catch (_) { $('nameSt').textContent = ''; }
  }, 500);
};
$('nameInput').onkeydown = e => { if (e.key === 'Enter') $('btnNameCreate').click(); };
$('btnNameLater').onclick = () => $('nameModal').classList.remove('show');
$('btnNameCreate').onclick = async () => {
  const b = $('btnNameCreate'); b.disabled = true; $('nameErr').textContent = '';
  try {
    const acc = await apex.createProfile($('nameInput').value.trim());
    setAccount(acc);
    $('nameModal').classList.remove('show');
    toast(`Welcome, ${acc.name}! You now have the full game.`);
  } catch (e) {
    $('nameErr').textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  } finally { b.disabled = false; }
};

function showDemoModal() {
  const a = currentAccount || {};
  $('demoTitle').textContent = a.status === 'bedrockOnly' ? 'This account only has Minecraft Bedrock' : 'No Minecraft: Java Edition on this account';
  $('demoText').textContent = a.status === 'bedrockOnly'
    ? 'Bedrock Edition (Windows / console / phone) is a different game. The launcher needs Java Edition. "Minecraft: Java & Bedrock Edition for PC" includes both.'
    : 'Microsoft says this account does not own Minecraft: Java Edition, so the launcher started the free Demo. The most common reasons:';
  $('demoOwns').textContent = a.entitlements && a.entitlements.length ? 'Account owns: ' + a.entitlements.join(', ') : 'Account owns: nothing from Minecraft';
  $('demoModal').classList.add('show');
}
$('btnDemoOk').onclick = () => $('demoModal').classList.remove('show');
$('btnDemoSwitch').onclick = async () => { $('demoModal').classList.remove('show'); await apex.logout(); setAccount(null); showLogin(); };

// ---------------------------------------------------------------- version picker
const MODE = {
  apex: { tag: 'APEX', cls: 'tag-apex', text: 'Apex Client · all mods' },
  fabric: { tag: 'FPS BOOST', cls: 'tag-fabric', text: 'Fabric + Sodium' },
  vanilla: { tag: 'VANILLA', cls: 'tag-vanilla', text: 'Vanilla' }
};
let versions = [];

function showVersion(id) {
  const v = versions.find(x => x.id === id) || { id, mode: id === info.mc ? 'apex' : 'vanilla' };
  $('mcVersion').textContent = v.id;
  $('mcMode').textContent = MODE[v.mode].text;
}

function renderVersions() {
  const q = $('verSearch').value.trim();
  const list = versions.filter(v => !q || v.id.includes(q));
  $('verList').innerHTML = list.length ? list.map(v => `
    <button class="ver-item ${v.id === settings.version ? 'sel' : ''}" data-v="${esc(v.id)}">
      <span>${esc(v.id)}</span><span class="ver-tag ${MODE[v.mode].cls}">${MODE[v.mode].tag}</span></button>`).join('')
    : '<div class="ver-empty">No version found</div>';
  $('verList').querySelectorAll('.ver-item').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    settings.version = b.dataset.v;
    await apex.setSettings({ version: settings.version });
    showVersion(settings.version);
    $('versionCard').classList.remove('open');
  });
}

async function loadVersions() {
  try {
    versions = await apex.versions();
    // Apex version first
    versions.sort((a, b) => (b.mode === 'apex') - (a.mode === 'apex'));
  } catch (_) {
    versions = [{ id: info.mc, mode: 'apex' }];
    $('verList').innerHTML = '<div class="ver-empty">Offline — only the Apex version is listed</div>';
  }
  showVersion(settings.version);
  renderVersions();
}

$('versionCard').onclick = e => {
  if (e.target.closest('.ver-menu')) return;
  e.stopPropagation();
  if (state !== 'idle') return;
  $('versionCard').classList.toggle('open');
  if ($('versionCard').classList.contains('open')) { $('verSearch').value = ''; renderVersions(); $('verSearch').focus(); }
};
$('verSearch').oninput = renderVersions;
$('verMenu').onclick = e => e.stopPropagation();
document.addEventListener('click', () => $('versionCard').classList.remove('open'));

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
    if (acc.status === 'needsName') showNameModal();
    else if (acc.demo) showDemoModal();
    else toast(`Signed in as ${acc.name} — have fun!`);
  } catch (e) {
    const msg = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    $('loginErr').textContent = /cancel|closed by user/i.test(msg) ? 'Sign in cancelled.' : msg;
  } finally { b.disabled = false; }
};

// ---------------------------------------------------------------- launch
function setLaunch(main, sub, p = null, cls = '') {
  $('launchText').textContent = main;
  $('launchSub').textContent = sub;
  $('btnLaunch').className = 'launch ' + cls;
  $('launchFill').style.width = p == null ? '0' : Math.round(p * 100) + '%';
}

async function startGame(server) {
  if (state !== 'idle') return toast('Minecraft is already starting or running.');
  if (!currentAccount) return showLogin();
  if (server && currentAccount.demo) return toast('Demo accounts can\'t join servers — that needs a Minecraft licence.', true);
  document.querySelector('[data-page=home]').click();
  state = 'preparing';
  setLaunch('PREPARING', server ? `Joining ${server}…` : 'Checking files…', 0, 'busy');
  try {
    await apex.launch(server ? { server } : {});
  } catch (e) {
    state = 'idle';
    idleLaunch();
    if (/SIGN_IN/.test(String(e.message || e))) return showLogin();
    if (/NEEDS_NAME/.test(String(e.message || e))) return showNameModal();
    toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true);
  }
}
$('btnLaunch').onclick = () => startGame();

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
    if (s === 'crashed') showCrash();
    loadStats(); loadShots();
  }
});

function showCrash() {
  const tail = logLines.slice(-60).join('\n');
  let hint = 'Here are the last lines from the game log. Send them to the server owner or developer if you need help.';
  if (/requires version \d+ or later of .*\(java\)|UnsupportedClassVersionError/i.test(tail)) hint = 'This Minecraft version needs a newer Java. The launcher picks the right one automatically now — just press Launch again.';
  else if (/OutOfMemoryError|Could not reserve enough space/i.test(tail)) hint = 'Minecraft ran out of memory. Go to Settings and give it more RAM (or less, if your PC has under 8 GB).';
  else if (/jvm\.cfg|Could not find or load main class|Error: could not open/i.test(tail)) hint = 'Java files are damaged. Go to Settings → Repair game files, then launch again.';
  else if (/Incompatible mod|requires.*fabric|Mod resolution/i.test(tail)) hint = 'A mod does not match this Minecraft version. Pick the APEX version (1.21.1) or remove extra mods.';
  else if (/GLFW error|OpenGL|pixel format/i.test(tail)) hint = 'Graphics driver problem. Update your graphics driver (NVIDIA / AMD / Intel) and try again.';
  $('crashHint').textContent = hint;
  $('crashLog').textContent = tail || 'No log output.';
  $('crash').classList.add('show');
  $('crashLog').scrollTop = 1e9;
}
$('btnCrashClose').onclick = () => $('crash').classList.remove('show');
$('btnCrashLogs').onclick = () => apex.openLogs();
$('btnCrashCopy').onclick = async () => { await navigator.clipboard.writeText($('crashLog').textContent); toast('Log copied'); };

const logLines = [];
apex.onLog(line => {
  logLines.push(line.trimEnd());
  if (logLines.length > 600) logLines.splice(0, logLines.length - 600);
  if (!$('logs').classList.contains('hidden')) renderLogs();
});
function renderLogs() { const l = $('logs'); l.textContent = logLines.join('\n') || 'No logs yet.'; l.scrollTop = l.scrollHeight; }
$('btnLogs').onclick = () => { $('logs').classList.toggle('hidden'); renderLogs(); };
$('btnFolder').onclick = () => apex.openFolder();
$('btnLogsFolder').onclick = () => apex.openLogs();
$('btnRepair').onclick = async () => {
  if (!confirm('Download Java, Minecraft and libraries again? Your worlds, screenshots and settings stay safe.')) return;
  try { await apex.repair(); toast('Repaired — the next launch downloads fresh game files.'); }
  catch (e) { toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true); }
};

// ---------------------------------------------------------------- stats
function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h < 100 ? `${h} h ${m % 60} min` : `${h} h`;
}
function fmtAgo(t) {
  if (!t) return 'Never';
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'Just now';
  if (d < 3600) return Math.floor(d / 60) + ' min ago';
  if (d < 86400) return Math.floor(d / 3600) + ' h ago';
  if (d < 86400 * 30) return Math.floor(d / 86400) + ' days ago';
  return new Date(t).toLocaleDateString();
}
async function loadStats() {
  const st = await apex.stats();
  $('stTime').textContent = fmtDuration(st.totalMs);
  $('stLaunches').textContent = st.launches;
  $('stLast').textContent = fmtAgo(st.lastPlayed).toLowerCase();
  $('stRam').textContent = gb(settings.ramMb);
}

// ---------------------------------------------------------------- servers
const statusCache = {};
const cleanMotd = m => (m && m.clean ? m.clean.join('  ') : '').replace(/\s+/g, ' ').trim();

async function serverStatus(addr, force) {
  if (!force && statusCache[addr] && Date.now() - statusCache[addr].t < 60000) return statusCache[addr].d;
  try {
    const r = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(addr)}`);
    const d = await r.json();
    statusCache[addr] = { t: Date.now(), d };
    return d;
  } catch (_) { return { online: false }; }
}

function serverIcon(d) { return d && d.icon ? d.icon : 'assets/emblem.png'; }

async function renderServers(force = false) {
  const list = settings.servers || [];
  $('serverList').innerHTML = list.length ? list.map((sv, i) => `
    <div class="srv" data-i="${i}">
      <img src="assets/emblem.png" alt="">
      <div class="info"><b>${esc(sv.name)}</b><span class="addr">${esc(sv.address)}</span>
        <div class="motd">Checking…</div></div>
      <div class="players"><b>—</b>players</div>
      <button class="primary play" data-addr="${esc(sv.address)}">Play</button>
      <button class="del" title="Remove">✕</button>
    </div>`).join('') : '<div class="empty">No servers yet — add one above.</div>';

  $('serverList').querySelectorAll('.play').forEach(b => b.onclick = () => startGame(b.dataset.addr));
  $('serverList').querySelectorAll('.del').forEach(b => b.onclick = async () => {
    const i = +b.closest('.srv').dataset.i;
    settings.servers.splice(i, 1);
    await apex.setSettings({ servers: settings.servers });
    renderServers(); renderQuick();
  });

  list.forEach(async (sv, i) => {
    const d = await serverStatus(sv.address, force);
    const row = $('serverList').querySelector(`.srv[data-i="${i}"]`);
    if (!row) return;
    row.querySelector('img').src = serverIcon(d);
    row.querySelector('.motd').innerHTML = d.online
      ? `<span class="dot-on"></span>${esc(cleanMotd(d.motd) || 'Online')}`
      : '<span class="dot-off"></span>Offline';
    row.querySelector('.players').innerHTML = d.online
      ? `<b>${(d.players && d.players.online || 0).toLocaleString()}</b>of ${(d.players && d.players.max || 0).toLocaleString()} · ${esc(d.version || '')}`.slice(0, 120)
      : '<b>—</b>offline';
  });
}

async function renderQuick() {
  const list = (settings.servers || []).slice(0, 6);
  $('quick').innerHTML = list.length ? list.map((sv, i) => `
    <button class="qs" data-addr="${esc(sv.address)}" data-i="${i}">
      <img src="assets/emblem.png" alt=""><div class="meta"><b>${esc(sv.name)}</b><small>Checking…</small></div>
      <span class="go">PLAY</span></button>`).join('')
    : '<div class="empty" style="padding:18px">Add servers on the Servers page.</div>';
  $('quick').querySelectorAll('.qs').forEach(b => b.onclick = () => startGame(b.dataset.addr));
  list.forEach(async (sv, i) => {
    const d = await serverStatus(sv.address);
    const el = $('quick').querySelector(`.qs[data-i="${i}"]`);
    if (!el) return;
    el.querySelector('img').src = serverIcon(d);
    el.querySelector('small').innerHTML = d.online
      ? `<span class="dot-on"></span>${(d.players && d.players.online || 0).toLocaleString()} online`
      : '<span class="dot-off"></span>Offline';
  });
}

$('addServer').onsubmit = async e => {
  e.preventDefault();
  const address = $('srvAddr').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9.\-]+(:\d{1,5})?$/i.test(address)) return toast('That doesn\'t look like a server address.', true);
  const name = $('srvName').value.trim() || address;
  settings.servers = [...(settings.servers || []), { name, address }];
  await apex.setSettings({ servers: settings.servers });
  $('srvName').value = ''; $('srvAddr').value = '';
  renderServers(); renderQuick();
  toast(`Added ${name}`);
};
$('btnRefreshServers').onclick = () => renderServers(true);

// ---------------------------------------------------------------- screenshots
async function loadShots() {
  const list = await apex.shots();
  $('shots').innerHTML = list.length ? list.map((sh, i) => `
    <div class="shot" data-i="${i}"><img loading="lazy" src="${encodeURI(sh.url)}" alt=""><span>${esc(sh.version)} · ${new Date(sh.time).toLocaleString()}</span></div>`).join('')
    : '<div class="empty" style="grid-column:1/-1">No screenshots yet. Press F2 in game!</div>';
  $('shots').querySelectorAll('.shot').forEach(el => el.onclick = () => apex.openShot(list[+el.dataset.i].path));
}
$('btnShotsFolder').onclick = () => apex.shotsFolder();

document.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => document.querySelector(`[data-page=${b.dataset.goto}]`).click());

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
    <div class="news-item"><span class="tag">${esc(n.tag)}</span><div><b>${esc(n.t)}</b><p>${esc(n.p)}</p></div></div>`).join('');
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

  $('fullscreen').checked = !!settings.fullscreen;
  $('fullscreen').onchange = e => apex.setSettings({ fullscreen: e.target.checked });
  $('resW').value = settings.width || 1280;
  $('resH').value = settings.height || 720;
  const saveRes = () => {
    const w = Math.min(7680, Math.max(640, +$('resW').value || 1280));
    const h = Math.min(4320, Math.max(480, +$('resH').value || 720));
    $('resW').value = w; $('resH').value = h;
    apex.setSettings({ width: w, height: h });
  };
  $('resW').onchange = saveRes; $('resH').onchange = saveRes;
  $('jvmArgs').value = settings.jvmArgs || '';
  $('jvmArgs').onchange = e => apex.setSettings({ jvmArgs: e.target.value.trim() });
  ram.addEventListener('change', () => { settings.ramMb = +ram.value; loadStats(); });
}

// ---------------------------------------------------------------- start
(async () => {
  info = await apex.info();
  settings = await apex.getSettings();
  settings.version = settings.version || info.mc;
  showVersion(settings.version);
  loadVersions();
  renderMods();
  renderNews();
  bindSettings();
  loadStats();
  renderServers();
  renderQuick();
  loadShots();
  $('accName').textContent = 'Signing in…';
  const acc0 = await apex.getAccount();
  setAccount(acc0, true);
  if (acc0 && acc0.status === 'needsName') showNameModal();
  else if (acc0 && acc0.demo) showDemoModal();
})();
