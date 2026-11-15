// Installs everything the game needs (Java 21, Fabric, Fabric API, Apex Client mod) and launches it.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const AdmZip = require('adm-zip');
const { Client } = require('minecraft-launcher-core');
const cfg = require('../config');

const UA = { 'User-Agent': `ApexClient-Launcher/${cfg.VERSION}` };

function gameDir(app) {
  return path.join(app.getPath('appData'), cfg.GAME_FOLDER);
}

async function getJson(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function download(url, dest, onProgress) {
  const r = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!r.ok) throw new Error(`Download failed (${r.status}): ${url}`);
  const total = Number(r.headers.get('content-length')) || 0;
  let done = 0;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  const body = Readable.fromWeb(r.body);
  body.on('data', c => { done += c.length; if (total && onProgress) onProgress(done / total); });
  await pipeline(body, fs.createWriteStream(tmp));
  await fsp.rename(tmp, dest);
}

function findFile(dir, names) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { const f = findFile(p, names); if (f) return f; }
    else if (names.includes(entry.name) && path.basename(path.dirname(p)) === 'bin') return p;
  }
  return null;
}

// ---------------------------------------------------------------- Java 21 (bundled like Lunar)
async function ensureJava(root, progress) {
  const runtime = path.join(root, 'runtime', 'java21');
  const exe = process.platform === 'win32' ? ['javaw.exe'] : ['java'];
  let java = findFile(runtime, exe);
  if (java) return java;

  const os = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform];
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';
  const url = `https://api.adoptium.net/v3/binary/latest/21/ga/${os}/${arch}/jre/hotspot/normal/eclipse`;
  const archive = path.join(root, 'runtime', `java21.${ext}`);

  progress('Downloading Java 21', 0);
  await download(url, archive, p => progress('Downloading Java 21', p));
  progress('Installing Java 21', 1);
  await fsp.mkdir(runtime, { recursive: true });
  if (ext === 'zip') new AdmZip(archive).extractAllTo(runtime, true);
  else await new Promise((res, rej) => execFile('tar', ['-xzf', archive, '-C', runtime], e => e ? rej(e) : res()));
  await fsp.rm(archive, { force: true });

  java = findFile(runtime, exe);
  if (!java) throw new Error('Java install failed');
  if (process.platform !== 'win32') await fsp.chmod(java, 0o755);
  return java;
}

// ---------------------------------------------------------------- Fabric loader profile
async function ensureFabric(root, progress) {
  progress('Checking Fabric', 0);
  const loaders = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${cfg.MC_VERSION}`);
  const loader = (loaders.find(l => l.loader.stable) || loaders[0]).loader.version;
  const id = `fabric-loader-${loader}-${cfg.MC_VERSION}`;
  const file = path.join(root, 'versions', id, `${id}.json`);
  if (!fs.existsSync(file)) {
    const profile = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${cfg.MC_VERSION}/${loader}/profile/json`);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, JSON.stringify(profile, null, 2));
  }
  return id;
}

// ---------------------------------------------------------------- Mods: Apex Client + Fabric API
async function ensureMods(root, bundledModsDir, progress) {
  const mods = path.join(root, 'mods');
  await fsp.mkdir(mods, { recursive: true });

  // Apex Client mod: use the jar bundled in the installer, otherwise download the newest release.
  const bundled = fs.existsSync(bundledModsDir) ? fs.readdirSync(bundledModsDir).filter(f => f.endsWith('.jar')) : [];
  const target = path.join(mods, 'ApexClient.jar');
  if (bundled.length) {
    for (const f of fs.readdirSync(mods)) if (/^ApexClient.*\.jar$/i.test(f)) await fsp.rm(path.join(mods, f));
    await fsp.copyFile(path.join(bundledModsDir, bundled[0]), target);
  } else if (cfg.MOD_URL) {
    progress('Updating Apex Client', 0);
    try {
      await download(cfg.MOD_URL, target + '.new', p => progress('Updating Apex Client', p));
      for (const f of fs.readdirSync(mods)) if (/^ApexClient.*\.jar$/i.test(f)) await fsp.rm(path.join(mods, f));
      await fsp.rename(target + '.new', target);
    } catch (e) {
      await fsp.rm(target + '.new', { force: true });
      if (!fs.existsSync(target)) throw new Error('Could not download Apex Client mod: ' + e.message);
      // offline: keep using the jar we already have
    }
  }

  // Fabric API from Modrinth
  if (!fs.readdirSync(mods).some(f => /^fabric-api.*\.jar$/i.test(f))) {
    progress('Downloading Fabric API', 0);
    const q = `loaders=${encodeURIComponent('["fabric"]')}&game_versions=${encodeURIComponent(`["${cfg.MC_VERSION}"]`)}`;
    const versions = await getJson(`https://api.modrinth.com/v2/project/fabric-api/version?${q}`);
    if (!versions.length) throw new Error('No Fabric API for ' + cfg.MC_VERSION);
    const fileInfo = versions[0].files.find(f => f.primary) || versions[0].files[0];
    await download(fileInfo.url, path.join(mods, fileInfo.filename), p => progress('Downloading Fabric API', p));
  }
}

// ---------------------------------------------------------------- give the in-game mod the Discord id
async function writeModConfig(root) {
  const file = path.join(root, 'config', 'apexclient.properties');
  await fsp.mkdir(path.dirname(file), { recursive: true });
  let text = fs.existsSync(file) ? await fsp.readFile(file, 'utf8') : '';
  const set = (key, val) => {
    if (val === undefined || val === '') return;
    const line = `${key}=${String(val).replace(/:/g, '\\:')}`;
    const re = new RegExp(`^${key.replace('.', '\\.')}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : text + (text.endsWith('\n') || !text ? '' : '\n') + line + '\n';
  };
  if (!/^0+$/.test(cfg.DISCORD_CLIENT_ID)) set('discord.clientId', cfg.DISCORD_CLIENT_ID);
  set('discord.buttonUrl', cfg.DISCORD_INVITE);
  await fsp.writeFile(file, text);
}

// ---------------------------------------------------------------- launch
/**
 * @param opts { app, auth, ramMb, bundledModsDir, onProgress(text, 0..1), onLog(line), onStart(), onClose(code) }
 */
async function launch(opts) {
  const root = gameDir(opts.app);
  await fsp.mkdir(root, { recursive: true });
  const progress = (text, p) => opts.onProgress(text, p);

  const javaPath = await ensureJava(root, progress);
  const fabricId = await ensureFabric(root, progress);
  await ensureMods(root, opts.bundledModsDir, progress);
  await writeModConfig(root);

  const launcher = new Client();
  let started = false;

  launcher.on('progress', e => {
    const names = { assets: 'Downloading assets', natives: 'Downloading natives', 'classes-custom': 'Downloading Fabric', classes: 'Downloading libraries' };
    progress(names[e.type] || 'Downloading game files', e.total ? e.task / e.total : 0);
  });
  launcher.on('debug', l => opts.onLog(String(l)));
  launcher.on('data', l => {
    opts.onLog(String(l));
    if (!started && /Apex Client .* loaded|Setting user|LWJGL/i.test(String(l))) { started = true; opts.onStart(); }
  });
  launcher.on('arguments', () => progress('Starting Minecraft', 1));
  launcher.on('close', code => opts.onClose(code));

  const proc = await launcher.launch({
    authorization: opts.auth,
    root,
    javaPath,
    version: { number: cfg.MC_VERSION, type: 'release', custom: fabricId },
    memory: { max: `${opts.ramMb}M`, min: '1024M' },
    overrides: { detached: false, maxSockets: 8 }
  });
  if (!proc) throw new Error('Minecraft failed to start (see logs)');
  setTimeout(() => { if (!started) { started = true; opts.onStart(); } }, 20000);
  return proc;
}

module.exports = { launch, gameDir };
