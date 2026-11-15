// Installs everything the game needs (Java 21, Fabric, Fabric API, Apex Client mod) and launches it.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const extractZip = require('extract-zip');
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

/**
 * Raw HTTP(S) GET that follows redirects and never decompresses on its own.
 * (fetch() transparently "un-gzips" responses, which broke zips from some servers:
 *  "invalid stored block lengths".)
 */
function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { ...UA, 'Accept-Encoding': 'identity', Accept: '*/*' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects > 8) return reject(new Error('Too many redirects'));
        return resolve(httpGet(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`server answered ${res.statusCode}`)); }
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('connection timed out')));
  });
}

async function download(url, dest, onProgress, sha256) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const tmp = dest + '.part';
    try {
      const res = await httpGet(url);
      const enc = String(res.headers['content-encoding'] || 'identity').toLowerCase();
      const total = enc === 'identity' ? Number(res.headers['content-length']) || 0 : 0;
      let done = 0;
      const hash = crypto.createHash('sha256');
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      // if a server compresses anyway, undo it properly instead of saving garbage
      const body = /gzip|deflate|br/.test(enc) ? res.pipe(enc.includes('br') ? zlib.createBrotliDecompress() : zlib.createUnzip()) : res;
      body.on('data', c => { done += c.length; hash.update(c); if (total && onProgress) onProgress(done / total); });
      await pipeline(body, fs.createWriteStream(tmp));
      if (total && done !== total) throw new Error('download was cut off');
      if (sha256 && hash.digest('hex') !== sha256.toLowerCase()) throw new Error('downloaded file is corrupted');
      await fsp.rename(tmp, dest);
      return;
    } catch (e) {
      lastErr = e;
      await fsp.rm(tmp, { force: true }).catch(() => {});
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

/** true if the file starts like a zip ("PK") or gzip */
async function looksLikeArchive(file) {
  const fh = await fsp.open(file, 'r');
  try {
    const b = Buffer.alloc(4);
    await fh.read(b, 0, 4, 0);
    return (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0x1f && b[1] === 0x8b);
  } finally { await fh.close(); }
}

/**
 * Download + check + unpack, with one full retry if anything is damaged.
 * label is used in progress text and error messages ("Java 21", "Luanti", "Mineclonia"...).
 */
async function downloadAndExtract(url, archive, dest, label, progress, sha256, log = () => {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      progress(`Downloading ${label}`, 0);
      await download(url, archive, p => progress(`Downloading ${label}`, p), sha256);
      if (!await looksLikeArchive(archive)) throw new Error('the server sent a web page instead of the file');
      progress(`Installing ${label} (this can take a minute)`, 1);
      await fsp.rm(dest, { recursive: true, force: true });
      await extract(archive, dest, log);
      await fsp.rm(archive, { force: true });
      return;
    } catch (e) {
      lastErr = e;
      log(`${label}: attempt ${attempt} failed — ${e.message}`);
      await fsp.rm(archive, { force: true }).catch(() => {});
      await fsp.rm(dest, { recursive: true, force: true }).catch(() => {});
    }
  }
  throw new Error(`Could not install ${label}: ${lastErr.message}. Check your internet connection and press Launch again.`);
}

const run = (file, args, opts = {}) => new Promise((res, rej) =>
  execFile(file, args, { windowsHide: true, timeout: 120000, ...opts }, (e, out, err) => e ? rej(e) : res(String(out) + String(err))));

/** Unpacks a .zip / .tar.gz. Windows 10/11 ship tar.exe (fast, native); extract-zip streams as a fallback. */
async function extract(archive, dest, log = () => {}) {
  await fsp.mkdir(dest, { recursive: true });
  if (archive.endsWith('.zip')) {
    const winTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (process.platform === 'win32' && fs.existsSync(winTar)) {
      try { await run(winTar, ['-xf', archive, '-C', dest], { timeout: 15 * 60000 }); return; }
      catch (e) { log(`tar.exe failed (${e.message}) — using built-in unzip`); await fsp.rm(dest, { recursive: true, force: true }); await fsp.mkdir(dest, { recursive: true }); }
    }
    await extractZip(archive, { dir: path.resolve(dest) });   // streaming, no size limits
  } else {
    await run('tar', ['-xzf', archive, '-C', dest], { timeout: 15 * 60000 });
  }
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

// ---------------------------------------------------------------- Java (bundled like Lunar)
/** Runs `java -version`; true when this Java really works. */
async function javaWorks(javaExe) {
  if (!javaExe || !fs.existsSync(javaExe)) return false;
  // a half-unpacked Java has bin\javaw.exe but no lib\jvm.cfg (Java 8: lib\amd64\jvm.cfg)
  const home = path.dirname(path.dirname(javaExe));
  const cfgOk = ['lib/jvm.cfg', 'lib/amd64/jvm.cfg', 'lib/aarch64/jvm.cfg'].some(f => fs.existsSync(path.join(home, f)));
  if (!cfgOk) return false;
  const cli = javaExe.replace(/javaw\.exe$/i, 'java.exe');
  try { await run(fs.existsSync(cli) ? cli : javaExe, ['-version'], { timeout: 30000 }); return true; }
  catch (_) { return false; }
}

async function ensureJava(root, progress, major = 21, log = () => {}) {
  const runtime = path.join(root, 'runtime', `java${major}`);
  const marker = path.join(runtime, '.apex-ok');
  const exe = process.platform === 'win32' ? ['javaw.exe'] : ['java'];

  let java = findFile(runtime, exe);
  const home = java && path.dirname(path.dirname(java));
  const cfgOk = home && ['lib/jvm.cfg', 'lib/amd64/jvm.cfg', 'lib/aarch64/jvm.cfg'].some(f => fs.existsSync(path.join(home, f)));
  if (fs.existsSync(marker) && cfgOk) return java;
  if (java && await javaWorks(java)) { await fsp.writeFile(marker, 'ok'); return java; }

  // broken or missing → clean reinstall
  progress(`Repairing Java ${major}`, 0);
  await fsp.rm(runtime, { recursive: true, force: true });

  const os = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform];
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  // Java 8 has no Apple-silicon build at Adoptium; Rosetta runs the x64 one
  const jarch = (major === 8 && process.platform === 'darwin') ? 'x64' : arch;
  const q = `architecture=${jarch}&heap_size=normal&image_type=jre&jvm_impl=hotspot&os=${os}&vendor=eclipse`;
  let assets = [];
  try { assets = await getJson(`https://api.adoptium.net/v3/assets/latest/${major}/hotspot?${q}`); } catch (_) {}
  if (!assets.length) {
    // not offered (e.g. a short-lived non-LTS release) → use the next LTS, which runs it fine
    const next = [17, 21, 25, 29, 33].find(v => v > major);
    if (next) { await fsp.rm(runtime, { recursive: true, force: true }); return ensureJava(root, progress, next, log); }
    throw new Error(`No Java ${major} available for this PC`);
  }
  const pkg = assets[0].binary.package;
  const ext = pkg.name.endsWith('.zip') ? 'zip' : 'tar.gz';
  const archive = path.join(root, 'runtime', `java${major}-download.${ext}`);

  await downloadAndExtract(pkg.link, archive, runtime, `Java ${major}`, progress, pkg.checksum, log);

  java = findFile(runtime, exe);
  if (java && process.platform !== 'win32') await fsp.chmod(java, 0o755);
  if (!java || !await javaWorks(java)) {
    await fsp.rm(runtime, { recursive: true, force: true });
    throw new Error(`Java ${major} could not be installed. Your antivirus may have blocked it — allow "%APPDATA%\\.apexclient" and try again.`);
  }
  await fsp.writeFile(marker, 'ok');
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
  // exactly what this Minecraft version asks for (8, 17, 21, 25, …); 16 → 17 (16 is no longer offered)
  const major = (json.javaVersion && json.javaVersion.majorVersion) || 8;
  return major === 16 ? 17 : major;
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
  set('discord.imageBase', cfg.DISCORD_IMAGES);
  set('discord.largeImage', cfg.DISCORD_IMAGES + 'logo.png');
  set('discord.buttonLabel', cfg.DISCORD_INVITE ? 'Join our Discord' : 'Get Apex Client');
  set('discord.buttonUrl', cfg.DISCORD_INVITE || cfg.DOWNLOAD_URL);
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

  const javaPath = await ensureJava(root, progress, await javaMajorFor(mc), l => opts.onLog('[Launcher] ' + l));
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
    // "running" only once the game window is really up (Fabric error screens appear before this)
    if (!started && /Backend library: LWJGL|LWJGL version|Sound engine started|Created: \d+x\d+x\d+ minecraft:textures|Apex Client .* loaded/i.test(String(l))) { started = true; opts.onStart(); }
  });
  launcher.on('arguments', () => progress('Starting Minecraft', 1));
  launcher.on('close', code => opts.onClose(code));

  const proc = await launcher.launch({
    authorization: opts.auth,
    root,
    javaPath,
    version,
    memory: { max: `${opts.ramMb}M`, min: '1024M' },
    window: opts.window && opts.window.width ? { width: opts.window.width, height: opts.window.height, fullscreen: !!opts.window.fullscreen } : undefined,
    customArgs: (opts.jvmArgs || '').split(/\s+/).filter(a => /^-[XD]/.test(a)),
    ...(opts.server ? { quickPlay: { type: 'multiplayer', identifier: opts.server.includes(':') ? opts.server : opts.server + ':25565' } } : {}),
    overrides: { detached: false, maxSockets: 8, gameDirectory: instance }
  });
  if (!proc) throw new Error('Minecraft failed to start (see logs)');
  setTimeout(() => { if (!started && proc.exitCode === null) { started = true; opts.onStart(); } }, 120000);
  return proc;
}

module.exports = { launch, gameDir, listVersions, download, extract, downloadAndExtract };
