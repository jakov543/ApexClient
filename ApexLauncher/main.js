const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Auth } = require('msmc');
const cfg = require('./config');
const game = require('./src/game');
const luanti = require('./src/luanti');
const content = require('./src/content');
const DiscordRPC = require('./src/discord');
const { minecraftLogin, createProfile, nameStatus, niceError, isValid, toMclc } = require('./src/mcauth');

let win;
let account = null;        // { name, uuid }
let mcAuth = null;         // msmc Minecraft object
let gameProc = null;
let launching = false;   // true while files are being prepared, before the game process exists
let sessionStart = 0;
const auth = new Auth('select_account');
const rpc = new DiscordRPC(cfg.DISCORD_CLIENT_ID);
const launcherStart = Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------- settings
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaults = { ramMb: Math.max(2048, Math.floor(Math.min(4096, os.totalmem() / 1048576 / 2) / 256) * 256), closeOnLaunch: false, discordRpc: true, version: cfg.MC_VERSION,
  fullscreen: false, width: 1280, height: 720, jvmArgs: '',
  game: 'minecraft', luantiGame: 'mineclonia', luantiName: '',
  servers: [
    { name: 'Hypixel', address: 'mc.hypixel.net' },
    { name: 'CubeCraft', address: 'play.cubecraft.net' },
    { name: 'Wynncraft', address: 'play.wynncraft.com' }
  ],
  stats: { totalMs: 0, launches: 0, lastPlayed: null, lastVersion: null, lastServer: null },
  token: null };
let settings = { ...defaults };

function loadSettings() {
  try { settings = { ...defaults, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch (_) {}
}
function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}
function storeToken(refresh) {
  settings.token = refresh == null ? null
    : safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(refresh).toString('base64') : refresh;
  saveSettings();
}
function readToken() {
  if (!settings.token) return null;
  if (settings.token.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(settings.token.slice(4), 'base64'));
  return settings.token;
}

// ---------------------------------------------------------------- Discord
const img = f => cfg.DISCORD_IMAGES + f;
function rpcButtons() {
  return cfg.DISCORD_INVITE
    ? [{ label: 'Join our Discord', url: cfg.DISCORD_INVITE }, { label: 'Get Apex Client', url: cfg.DOWNLOAD_URL }]
    : [{ label: 'Get Apex Client', url: cfg.DOWNLOAD_URL }];
}
function launcherPresence() {
  if (!settings.discordRpc) return rpc.clear();
  rpc.setActivity({
    details: 'In the launcher',
    state: `${cfg.NAME} ${cfg.VERSION}`,
    timestamps: { start: launcherStart },
    assets: { large_image: img('logo.png'), large_text: `${cfg.NAME} ${cfg.VERSION}` },
    buttons: rpcButtons()
  });
}
/** While the game runs: versions without the Apex mod get their presence from the launcher. */
function gamePresence(version, mode, server, demo) {
  if (!settings.discordRpc) return rpc.clear();
  const modeText = { fabric: 'Fabric + Sodium', vanilla: 'Vanilla' }[mode] || 'Apex Client';
  rpc.setActivity({
    details: server ? `Playing on ${server}` : (demo ? 'Playing the demo' : 'Playing Minecraft'),
    state: `Minecraft ${version} · ${modeText}`,
    timestamps: { start: Math.floor(Date.now() / 1000) },
    assets: { large_image: img('logo.png'), large_text: `${cfg.NAME} ${cfg.VERSION}`, small_image: img(mode === 'vanilla' ? 'vanilla.png' : 'overworld.png'), small_text: modeText },
    buttons: rpcButtons()
  });
}

// ---------------------------------------------------------------- window
function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 720, minWidth: 980, minHeight: 620,
    frame: false, backgroundColor: '#0b0716', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
}

const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

// only one launcher at a time — a second click focuses the open window
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.setAppUserModelId('com.apexclient.launcher'); // correct taskbar icon/name on Windows 10/11

app.whenReady().then(async () => {
  loadSettings();
  createWindow();
  if (settings.discordRpc) { rpc.start(); launcherPresence(); }
});
app.on('window-all-closed', () => { if (!gameProc) { rpc.stop(); app.quit(); } });

// ---------------------------------------------------------------- IPC
ipcMain.on('win:min', () => win.minimize());
ipcMain.on('win:close', () => win.close());
ipcMain.handle('app:info', () => ({
  name: cfg.NAME, version: cfg.VERSION, mc: cfg.MC_VERSION, totalRamMb: Math.floor(os.totalmem() / 1048576), newsUrl: cfg.NEWS_URL
}));

ipcMain.handle('settings:get', () => { const { token, ...rest } = settings; return rest; });
ipcMain.handle('settings:set', (_e, patch) => {
  const { token, ...safe } = patch || {};
  settings = { ...settings, ...safe };
  saveSettings();
  if ('discordRpc' in safe) { if (safe.discordRpc) { rpc.start(); launcherPresence(); } else rpc.stop(); }
  return true;
});

function toAccount(mc) {
  return {
    name: mc.demo ? (mc.status === 'needsName' ? 'Choose a name' : 'Demo player') : mc.name,
    uuid: mc.demo ? null : mc.id,
    demo: mc.demo,
    status: mc.status || (mc.demo ? 'none' : 'ok'),
    likelyJava: !!mc.likelyJava,
    entitlements: mc.entitlements || []
  };
}

// launcher log file (userData/launcher.log) so sign-in problems can be checked later
function logLine(line) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'launcher.log'), `[${new Date().toISOString()}] ${line}\n`); } catch (_) {}
  send('game:log', '[Launcher] ' + line);
}

/** Microsoft refresh token -> Minecraft session */
async function signInWithToken(token) {
  let xbox;
  try { xbox = await auth.refresh(token); } catch (e) { throw niceError(e); }
  storeToken(xbox.save());
  return minecraftLogin(xbox);
}

ipcMain.handle('versions:list', async () => game.listVersions());

ipcMain.handle('account:get', async () => {
  if (account) return account;
  const token = readToken();
  if (!token) return null;
  try {
    mcAuth = await signInWithToken(token);
    account = toAccount(mcAuth);
    return account;
  } catch (e) {
    logLine('Auto sign-in failed: ' + niceError(e).message);
    return null; // expired → ask to log in again
  }
});

ipcMain.handle('account:login', async () => {
  try {
    const xbox = await auth.launch('electron', { width: 500, height: 650, resizable: false, title: 'Sign in with Microsoft', autoHideMenuBar: true });
    storeToken(xbox.save());
    mcAuth = await minecraftLogin(xbox);  // no Minecraft on the account → official Demo
    account = toAccount(mcAuth);
    logLine(`Signed in as ${account.name} — status ${account.status}${account.entitlements.length ? ' — owns: ' + account.entitlements.join(', ') : ''}`);
    return account;
  } catch (e) {
    const err = niceError(e);
    logLine('Sign-in failed: ' + err.message);
    throw err;
  }
});

ipcMain.handle('account:nameStatus', async (_e, name) => {
  if (!mcAuth) throw new Error('SIGN_IN');
  return nameStatus(mcAuth, String(name || '').trim());
});
ipcMain.handle('account:createProfile', async (_e, name) => {
  if (!mcAuth) throw new Error('SIGN_IN');
  if (!isValid(mcAuth)) { const t = readToken(); if (!t) throw new Error('SIGN_IN'); mcAuth = await signInWithToken(t); }
  try {
    await createProfile(mcAuth, String(name || '').trim());
    account = toAccount(mcAuth);
    logLine(`Created Java username ${account.name}`);
    return account;
  } catch (e) {
    account = toAccount(mcAuth);   // status may have changed (e.g. Mojang says no Java licence)
    const err = niceError(e); logLine('Create username failed: ' + err.message); throw err;
  }
});

ipcMain.handle('account:logout', () => {
  account = null; mcAuth = null; storeToken(null);
  return true;
});

function sessionStats(version, server) {
  sessionStart = Date.now();
  settings.stats = { ...defaults.stats, ...settings.stats };
  settings.stats.launches++;
  settings.stats.lastPlayed = Date.now();
  settings.stats.lastVersion = version;
  settings.stats.lastServer = server || null;
  saveSettings();
}

/** Luanti: free, no account needed */
async function launchLuanti(launchOpts) {
  const name = (settings.luantiName || (account && !account.demo && account.name) || '').trim()
    || 'Apex' + Math.floor(1000 + Math.random() * 9000);
  if (!settings.luantiName) { settings.luantiName = name; saveSettings(); }
  const g = luanti.GAMES[settings.luantiGame] || luanti.GAMES.mineclonia;
  let exited = false;
  const proc = await luanti.launch({
    root: game.gameDir(app),
    game: g.id,
    name,
    server: typeof launchOpts.server === 'string' ? launchOpts.server.trim() : null,
    helpers: { downloadAndExtract: game.downloadAndExtract, log: l => send('game:log', '[Launcher] ' + l) },
    onProgress: (text, p) => send('game:progress', { text, p }),
    onLog: line => send('game:log', line),
    onStart: () => {
      sessionStats('luanti:' + g.id, launchOpts.server);
      send('game:state', 'running');
      if (settings.discordRpc) rpc.setActivity({
        details: launchOpts.server ? `Playing on ${launchOpts.server}` : `Playing ${g.title}`,
        state: 'Luanti · free to play',
        timestamps: { start: Math.floor(Date.now() / 1000) },
        assets: { large_image: img('logo.png'), large_text: `${cfg.NAME} ${cfg.VERSION}`, small_image: img('overworld.png'), small_text: g.title },
        buttons: rpcButtons()
      });
      if (settings.closeOnLaunch) win.hide();
    },
    onClose: code => {
      exited = true;
      onGameClosed(code);
    }
  });
  if (!exited) { gameProc = proc; send('game:state', 'starting'); }
  return true;
}

// ---------------------------------------------------------------- mods / packs / shaders
async function versionMode(mc) {
  if (mc === cfg.MC_VERSION) return 'apex';
  try { return ((await game.listVersions()).find(v => v.id === mc) || {}).mode || 'vanilla'; }
  catch (_) { return 'vanilla'; }
}
ipcMain.handle('content:context', async () => {
  const mc = settings.version || cfg.MC_VERSION;
  return { mc, mode: await versionMode(mc) };
});
ipcMain.handle('content:search', (_e, o) => content.search({ ...o, mc: settings.version || cfg.MC_VERSION }));
ipcMain.handle('content:installed', () => content.installed(game.gameDir(app), settings.version || cfg.MC_VERSION));
ipcMain.handle('content:install', async (_e, o) => {
  if (gameProc) throw new Error('Close the game first, then install.');
  const mc = settings.version || cfg.MC_VERSION;
  const done = await content.install({
    root: game.gameDir(app), mc, mode: await versionMode(mc), type: o.type, projectId: o.id, title: o.title,
    download: game.download, progress: (text, p) => send('content:progress', { text, p })
  });
  logLine(`Installed for ${mc}: ${done.join(', ') || 'nothing new'}`);
  return done;
});
ipcMain.handle('content:remove', async (_e, o) => {
  if (gameProc) throw new Error('Close the game first, then remove.');
  await content.remove(game.gameDir(app), settings.version || cfg.MC_VERSION, o.type, o.file);
  return true;
});

ipcMain.handle('luanti:servers', () => luanti.servers());
ipcMain.handle('luanti:games', () => Object.values(luanti.GAMES).map(g => ({ id: g.id, title: g.title, desc: g.desc })));

ipcMain.handle('game:launch', async (_e, launchOpts = {}) => {
  if (gameProc || launching) throw new Error('A game is already starting or running.');
  launching = true;
  try {
    if ((launchOpts.game || settings.game) === 'luanti') return await launchLuanti(launchOpts);
    return await launchMinecraft(launchOpts);
  } finally {
    launching = false;
  }
});

async function launchMinecraft(launchOpts) {
  if (!mcAuth) throw new Error('SIGN_IN');
  if (mcAuth.status === 'needsName' && !launchOpts.allowDemo) throw new Error('NEEDS_NAME');
  // refresh the Minecraft token if it expired while the launcher was open
  if (!isValid(mcAuth)) {
    const token = readToken();
    if (!token) throw new Error('SIGN_IN');
    mcAuth = await signInWithToken(token);
  }

  const bundledModsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'mods')
    : path.join(__dirname, 'resources', 'mods');

  const ver = settings.version || cfg.MC_VERSION;
  const mode = ver === cfg.MC_VERSION ? 'apex' : (await game.listVersions().then(v => (v.find(x => x.id === ver) || {}).mode).catch(() => 'vanilla')) || 'vanilla';

  let exited = false;
  const proc = await game.launch({
    app,
    auth: toMclc(mcAuth),
    version: settings.version || cfg.MC_VERSION,
    ramMb: settings.ramMb,
    server: typeof launchOpts.server === 'string' ? launchOpts.server.trim() : null,
    window: { width: settings.width, height: settings.height, fullscreen: settings.fullscreen },
    jvmArgs: settings.jvmArgs,
    bundledModsDir,
    onProgress: (text, p) => send('game:progress', { text, p }),
    onLog: line => send('game:log', line),
    onStart: () => {
      sessionStats(settings.version, launchOpts.server);
      send('game:state', 'running');
      // Apex (1.21.1) has its own in-game Discord status; other versions get it from the launcher
      if (mode === 'apex') rpc.clear(); else gamePresence(ver, mode, launchOpts.server, mcAuth && mcAuth.demo);
      if (settings.closeOnLaunch) win.hide();
    },
    onClose: code => {
      exited = true;
      onGameClosed(code);
    }
  });
  if (!exited) { gameProc = proc; send('game:state', 'starting'); }
  return true;
}

/** Shared by Minecraft and Luanti when the game process ends. */
function onGameClosed(code) {
  gameProc = null;
  if (sessionStart) { settings.stats.totalMs += Date.now() - sessionStart; sessionStart = 0; saveSettings(); }
  const crashed = code !== 0 && code !== null;
  if (!win || win.isDestroyed()) { rpc.stop(); app.quit(); return; }
  if (settings.closeOnLaunch && !crashed) { rpc.stop(); app.quit(); return; }
  if (!win.isVisible()) win.show();           // show the launcher again so a crash can be read
  send('game:state', crashed ? 'crashed' : 'closed');
  if (settings.discordRpc) launcherPresence();
}

ipcMain.handle('open:folder', () => {
  const dir = game.gameDir(app);
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});
ipcMain.handle('open:instance', (_e, sub) => {
  const safe = ['mods', 'resourcepacks', 'shaderpacks', 'screenshots', 'logs'].includes(sub) ? sub : '';
  const dir = path.join(game.gameDir(app), 'instances', settings.version || cfg.MC_VERSION, safe);
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});
ipcMain.handle('open:url', (_e, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

// ---------------------------------------------------------------- screenshots / logs / repair
const inside = (base, p) => { const r = path.relative(base, p); return r && !r.startsWith('..') && !path.isAbsolute(r); };

ipcMain.handle('shots:list', () => {
  const inst = path.join(game.gameDir(app), 'instances');
  const out = [];
  if (!fs.existsSync(inst)) return out;
  for (const v of fs.readdirSync(inst)) {
    const dir = path.join(inst, v, 'screenshots');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.png$/i.test(f)) continue;
      const full = path.join(dir, f);
      out.push({ path: full, url: 'file:///' + full.replace(/\\/g, '/').replace(/^\//, ''), version: v, name: f, time: fs.statSync(full).mtimeMs });
    }
  }
  return out.sort((a, b) => b.time - a.time).slice(0, 200);
});
ipcMain.handle('shots:open', (_e, p) => { if (inside(game.gameDir(app), p)) shell.openPath(p); });
ipcMain.handle('shots:folder', () => {
  const dir = path.join(game.gameDir(app), 'instances', settings.version || cfg.MC_VERSION, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});
ipcMain.handle('open:logs', () => {
  const dir = path.join(game.gameDir(app), 'instances', settings.version || cfg.MC_VERSION, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});
ipcMain.handle('game:repair', async () => {
  if (gameProc) throw new Error('Close Minecraft first');
  const root = game.gameDir(app);
  for (const d of ['runtime', 'versions', 'libraries']) {
    await fs.promises.rm(path.join(root, d), { recursive: true, force: true });
  }
  logLine('Game files repaired (Java, versions and libraries will be downloaded again)');
  return true;
});
ipcMain.handle('stats:get', () => ({ ...defaults.stats, ...settings.stats }));
