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
async function ensureJava(root, progress, major = 21) {
  const runtime = path.join(root, 'runtime', `java${major}`);
  const exe = process.platform === 'win32' ? ['javaw.exe'] : ['java'];
  let java = findFile(runtime, exe);
  if (java) return java;

  const os = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform];
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';
  // Java 8 has no Apple-silicon build at Adoptium; Rosetta runs the x64 one
  const jarch = (major === 8 && process.platform === 'darwin') ? 'x64' : arch;
  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${os}/${jarch}/jre/hotspot/normal/eclipse`;
  const archive = path.join(root, 'runtime', `java${major}.${ext}`);

  progress(`Downloading Java ${major}`, 0);
  await download(url, archive, p => progress(`Downloading Java ${major}`, p));
  progress(`Installing Java ${major}`, 1);
  await fsp.mkdir(runtime, { recursive: true });
  if (ext === 'zip') new AdmZip(archive).extractAllTo(runtime, true);
  else await new Promise((res, rej) => execFile('tar', ['-xzf', archive, '-C', runtime], e => e ? rej(e) : res()));
  await fsp.rm(archive, { force: true });

  java = findFile(runtime, exe);
  if (!java) throw new Error(`Java ${major} install failed`);
  if (process.platform !== 'win32') await fsp.chmod(java, 0o755);
  return java;
}

// ---------------------------------------------------------------- Fabric loader profile
async function ensureFabric(root, progress, mc = cfg.MC_VERSION) {
  progress('Checking Fabric', 0);
  const loaders = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${mc}`);
  if (!loaders.length) throw new Error(`Fabric does not support ${mc}`);
  const loader = (loaders.find(l => l.loader.stable) || loaders[0]).loader.version;
  const id = `fabric-loader-${loader}-${mc}`;
  const file = path.join(root, 'versions', id, `${id}.json`);
  if (!fs.existsSync(file)) {
    const profile = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${mc}/${loader}/profile/json`);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, JSON.stringify(profile, null, 2));
  }
  return id;
}

// ---------------------------------------------------------------- Mods
/** Downloads the newest build of a Modrinth project for this Minecraft version (skips if already there). */
async function modrinthMod(mods, slug, mc, label, progress, required) {
  const prefix = slug.replace(/-/g, '[-_]?');
  if (fs.readdirSync(mods).some(f => new RegExp(`^${prefix}.*\\.jar$`, 'i').test(f))) return;
  progress(`Downloading ${label}`, 0);
  const q = `loaders=${encodeURIComponent('["fabric"]')}&game_versions=${encodeURIComponent(`["${mc}"]`)}`;
  let versions = [];
  try { versions = await getJson(`https://api.modrinth.com/v2/project/${slug}/version?${q}`); } catch (e) { if (required) throw e; }
  if (!versions.length) { if (required) throw new Error(`No ${label} for ${mc}`); return; }
  const fileInfo = versions[0].files.find(f => f.primary) || versions[0].files[0];
  await download(fileInfo.url, path.join(mods, fileInfo.filename), p => progress(`Downloading ${label}`, p));
}

async function ensureApexMod(mods, bundledModsDir, progress) {
  await fsp.mkdir(mods, { recursive: true });
  // Apex Client mod: use the jar bundled in the installer, otherwise download the newest release.
  const bundled = fs.existsSync(bundledModsDir) ? fs.readdirSync(bundledModsDir).filter(f => f.endsWith('.jar')) : [];
  const target = path.join(mods, 'ApexClient.jar');
  if (cfg.MOD_URL) {
    progress('Updating Apex Client', 0);
    try {
      await download(cfg.MOD_URL, target + '.new', p => progress('Updating Apex Client', p));
      for (const f of fs.readdirSync(mods)) if (/^ApexClient.*\.jar$/i.test(f)) await fsp.rm(path.join(mods, f));
      await fsp.rename(target + '.new', target);
      return;
    } catch (e) {
      await fsp.rm(target + '.new', { force: true });
    }
  }
  if (bundled.length) {
    for (const f of fs.readdirSync(mods)) if (/^ApexClient.*\.jar$/i.test(f)) await fsp.rm(path.join(mods, f));
    await fsp.copyFile(path.join(bundledModsDir, bundled[0]), target);
  } else if (!fs.existsSync(target)) {
    throw new Error('Could not download the Apex Client mod — check your internet connection');
  }
}

// ---------------------------------------------------------------- versions
let manifestCache = null;
async function manifest() {
  if (!manifestCache) manifestCache = await getJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  return manifestCache;
}

const FIRST = '2014-09-02'; // 1.8 — older versions are not supported

/** All release versions 1.8+ with how we run them: apex | fabric | vanilla */
async function listVersions() {
  const [m, fabricGames] = await Promise.all([
    manifest(),
    getJson('https://meta.fabricmc.net/v2/versions/game').catch(() => [])
  ]);
  const fabric = new Set(fabricGames.filter(g => g.stable).map(g => g.version));
  return m.versions
    .filter(v => v.type === 'release' && v.releaseTime >= FIRST)
    .map(v => ({
      id: v.id,
      mode: v.id === cfg.MC_VERSION ? 'apex' : (fabric.has(v.id) ? 'fabric' : 'vanilla')
    }));
}

async function javaMajorFor(mc) {
  const m = await manifest();
  const v = m.versions.find(x => x.id === mc);
  if (!v) throw new Error(`Unknown Minecraft version ${mc}`);
  const json = await getJson(v.url);
  const major = (json.javaVersion && json.javaVersion.majorVersion) || 8;
  return major >= 21 ? 21 : major >= 17 ? 17 : major >= 16 ? 17 : 8;
}

// ---------------------------------------------------------------- give the in-game mod the Discord id
async function writeModConfig(instance) {
  const file = path.join(instance, 'config', 'apexclient.properties');
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
  const mc = opts.version || cfg.MC_VERSION;
  const instance = path.join(root, 'instances', mc);   // own saves/mods/options per version
  const mods = path.join(instance, 'mods');
  await fsp.mkdir(mods, { recursive: true });
  const progress = (text, p) => opts.onProgress(text, p);

  const versions = await listVersions();
  const entry = versions.find(v => v.id === mc);
  if (!entry) throw new Error(`Minecraft ${mc} is not supported`);

  const javaPath = await ensureJava(root, progress, await javaMajorFor(mc));
  let version = { number: mc, type: 'release' };

  if (entry.mode === 'apex') {
    version.custom = await ensureFabric(root, progress, mc);
    await ensureApexMod(mods, opts.bundledModsDir, progress);
    await modrinthMod(mods, 'fabric-api', mc, 'Fabric API', progress, true);
    await writeModConfig(instance);
  } else if (entry.mode === 'fabric') {
    version.custom = await ensureFabric(root, progress, mc);
    await modrinthMod(mods, 'fabric-api', mc, 'Fabric API', progress, false);
    await modrinthMod(mods, 'sodium', mc, 'Sodium (FPS boost)', progress, false);
  }

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
    version,
    memory: { max: `${opts.ramMb}M`, min: '1024M' },
    overrides: { detached: false, maxSockets: 8, gameDirectory: instance }
  });
  if (!proc) throw new Error('Minecraft failed to start (see logs)');
  setTimeout(() => { if (!started) { started = true; opts.onStart(); } }, 20000);
  return proc;
}

module.exports = { launch, gameDir, listVersions };
