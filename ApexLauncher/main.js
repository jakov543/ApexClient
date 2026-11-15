const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Auth } = require('msmc');
const cfg = require('./config');
const game = require('./src/game');
const DiscordRPC = require('./src/discord');

let win;
let account = null;        // { name, uuid }
let mcAuth = null;         // msmc Minecraft object
let gameProc = null;
const auth = new Auth('select_account');
const rpc = new DiscordRPC(cfg.DISCORD_CLIENT_ID);
const launcherStart = Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------- settings
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaults = { ramMb: Math.max(2048, Math.floor(Math.min(4096, os.totalmem() / 1048576 / 2) / 256) * 256), closeOnLaunch: false, discordRpc: true, version: cfg.MC_VERSION, token: null };
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
function launcherPresence() {
  if (!settings.discordRpc) return rpc.clear();
  rpc.setActivity({
    details: 'In the launcher',
    state: `${cfg.NAME} ${cfg.VERSION}`,
    timestamps: { start: launcherStart },
    assets: { large_image: 'logo', large_text: cfg.NAME },
    ...(cfg.DISCORD_INVITE ? { buttons: [{ label: 'Join our Discord', url: cfg.DISCORD_INVITE }] } : {})
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
  const demo = !!(mc.profile && mc.profile.demo);
  return { name: demo ? 'Demo player' : mc.profile.name, uuid: demo ? null : mc.profile.id, demo };
}

ipcMain.handle('versions:list', async () => game.listVersions());

ipcMain.handle('account:get', async () => {
  if (account) return account;
  const token = readToken();
  if (!token) return null;
  try {
    const xbox = await auth.refresh(token);
    mcAuth = await xbox.getMinecraft();
    storeToken(xbox.save());
    account = toAccount(mcAuth);
    return account;
  } catch (e) {
    return null; // expired → ask to log in again
  }
});

ipcMain.handle('account:login', async () => {
  const xbox = await auth.launch('electron', { width: 500, height: 650, resizable: false, title: 'Sign in with Microsoft' });
  mcAuth = await xbox.getMinecraft();   // accounts without Minecraft get the official Demo
  storeToken(xbox.save());
  account = toAccount(mcAuth);
  return account;
});

ipcMain.handle('account:logout', () => {
  account = null; mcAuth = null; storeToken(null);
  return true;
});

ipcMain.handle('game:launch', async () => {
  if (gameProc) throw new Error('Game is already running');
  if (!mcAuth) throw new Error('SIGN_IN');
  // refresh the Minecraft token if it expired while the launcher was open
  if (!mcAuth.validate()) mcAuth = await mcAuth.refresh(true);

  const bundledModsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'mods')
    : path.join(__dirname, 'resources', 'mods');

  if (settings.discordRpc) rpc.clear(); // the in-game mod takes over Discord

  gameProc = await game.launch({
    app,
    auth: mcAuth.mclc(),
    version: settings.version || cfg.MC_VERSION,
    ramMb: settings.ramMb,
    bundledModsDir,
    onProgress: (text, p) => send('game:progress', { text, p }),
    onLog: line => send('game:log', line),
    onStart: () => {
      send('game:state', 'running');
      if (settings.closeOnLaunch) win.hide();
    },
    onClose: code => {
      gameProc = null;
      send('game:state', code === 0 ? 'closed' : 'crashed');
      if (settings.closeOnLaunch || !win || win.isDestroyed()) { rpc.stop(); app.quit(); return; }
      if (settings.discordRpc) launcherPresence();
    }
  });
  send('game:state', 'starting');
  return true;
});

ipcMain.handle('open:folder', () => {
  const dir = game.gameDir(app);
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});
ipcMain.handle('open:url', (_e, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});
