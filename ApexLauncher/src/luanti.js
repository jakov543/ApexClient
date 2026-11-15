// Luanti (free, open-source block game) — downloaded and launched next to Minecraft.
// No account needed. Engine from GitHub releases, games (Mineclonia / VoxeLibre) from ContentDB.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const cfg = require('../config');

const ENGINE_FALLBACK = {
  tag: '5.15.1',
  url: 'https://github.com/luanti-org/luanti/releases/download/5.15.1/luanti-5.15.1-win64.zip'
};

const GAMES = {
  mineclonia: { id: 'mineclonia', title: 'Mineclonia', author: 'ryvnf', pkg: 'mineclonia', desc: 'Fast, Minecraft-like survival' },
  mineclone2: { id: 'mineclone2', title: 'VoxeLibre', author: 'Wuzzy', pkg: 'mineclone2', desc: 'Big Minecraft-like game with lots of content' }
};

const UA = { 'User-Agent': `ApexClient-Launcher/${cfg.VERSION}` };

function findFile(dir, name, depth = 4) {
  if (depth < 0 || !fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase() === name) return p;
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { const f = findFile(path.join(dir, e.name), name, depth - 1); if (f) return f; }
  }
  return null;
}

async function latestEngine() {
  try {
    const r = await fetch('https://api.github.com/repos/luanti-org/luanti/releases/latest', { headers: { ...UA, Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const a = (j.assets || []).find(x => /win64\.zip$/i.test(x.name));
    if (a) return { tag: j.tag_name, url: a.browser_download_url };
  } catch (_) { /* rate limit / offline → known good version */ }
  return ENGINE_FALLBACK;
}

/** Installs (or updates) the Luanti engine. Returns { dir, exe, tag }. */
async function ensureEngine(root, progress, helpers) {
  if (process.platform !== 'win32') throw new Error('Luanti in the launcher is Windows-only for now.');
  const base = path.join(root, 'luanti');
  const engine = path.join(base, 'engine');
  const marker = path.join(base, 'installed.txt');
  const have = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : '';
  const exeNow = findFile(path.join(engine, 'bin'), 'luanti.exe', 0);

  progress('Checking Luanti', 0);
  const latest = await latestEngine();
  if (exeNow && have === latest.tag) return { dir: engine, exe: exeNow, tag: have };
  if (exeNow && have && latest === ENGINE_FALLBACK) return { dir: engine, exe: exeNow, tag: have }; // offline

  const zip = path.join(base, 'engine-download.zip');
  const tmp = path.join(base, 'engine-tmp');
  await helpers.downloadAndExtract(latest.url, zip, tmp, `Luanti ${latest.tag}`, progress, null, helpers.log);

  const exe = findFile(tmp, 'luanti.exe') || findFile(tmp, 'minetest.exe');
  if (!exe) throw new Error('Luanti download looks broken — try again.');
  const top = path.dirname(path.dirname(exe)); // .../luanti-x.y.z-win64

  // keep worlds/settings/games from the old install
  const keep = ['worlds', 'games', 'mods', 'minetest.conf', 'client', 'screenshots', 'textures'];
  if (fs.existsSync(engine)) {
    for (const k of keep) {
      const from = path.join(engine, k);
      if (fs.existsSync(from) && !(k === 'client' || k === 'textures')) {
        await fsp.rm(path.join(top, k), { recursive: true, force: true });
        await fsp.rename(from, path.join(top, k));
      }
    }
    await fsp.rm(engine, { recursive: true, force: true });
  }
  await fsp.rename(top, engine);
  await fsp.rm(tmp, { recursive: true, force: true });
  await fsp.writeFile(marker, latest.tag);
  return { dir: engine, exe: path.join(engine, 'bin', path.basename(exe)), tag: latest.tag };
}

/** Installs a game from ContentDB into engine/games/<id>. */
async function ensureGame(engineDir, gameId, progress, helpers) {
  const g = GAMES[gameId] || GAMES.mineclonia;
  const dest = path.join(engineDir, 'games', g.id);
  if (fs.existsSync(path.join(dest, 'game.conf'))) return g;

  progress(`Downloading ${g.title}`, 0);
  const r = await fetch(`https://content.luanti.org/api/packages/${g.author}/${g.pkg}/releases/`, { headers: UA });
  if (!r.ok) throw new Error(`Could not reach the Luanti content store (code ${r.status}).`);
  const rel = (await r.json())[0];
  if (!rel) throw new Error(`No download found for ${g.title}.`);
  const url = rel.url
    ? (rel.url.startsWith('http') ? rel.url : 'https://content.luanti.org' + rel.url)
    : `https://content.luanti.org/packages/${g.author}/${g.pkg}/releases/${rel.id}/download/`;

  const base = path.dirname(engineDir);
  const zip = path.join(base, `${g.id}-download.zip`);
  const tmp = path.join(base, `${g.id}-tmp`);
  await helpers.downloadAndExtract(url, zip, tmp, g.title, progress, null, helpers.log);

  const conf = findFile(tmp, 'game.conf', 3);
  if (!conf) throw new Error(`${g.title} download looks broken — try again.`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.rename(path.dirname(conf), dest);
  await fsp.rm(tmp, { recursive: true, force: true });
  return g;
}

/** Sets the default game and player name in minetest.conf (portable install keeps it next to bin). */
async function writeConf(engineDir, settings) {
  const file = path.join(engineDir, 'minetest.conf');
  let text = fs.existsSync(file) ? await fsp.readFile(file, 'utf8') : '';
  const set = (k, v) => {
    const line = `${k} = ${v}`;
    const re = new RegExp(`^${k}\\s*=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : text + (text && !text.endsWith('\n') ? '\n' : '') + line + '\n';
  };
  set('menu_last_game', settings.game);
  if (settings.name) set('name', settings.name);
  set('screenshot_path', 'screenshots');
  await fsp.writeFile(file, text);
}

/**
 * opts: { root, game, name, server:'host:port'|null, onProgress, onLog, onStart, onClose, helpers:{download, extract} }
 */
async function launch(opts) {
  const progress = (t, p) => opts.onProgress(t, p);
  const eng = await ensureEngine(opts.root, progress, opts.helpers);
  const g = await ensureGame(eng.dir, opts.game, progress, opts.helpers);
  await writeConf(eng.dir, { game: g.id, name: opts.name });

  const args = [];
  if (opts.server) {
    const [host, port] = opts.server.split(':');
    args.push('--address', host, '--port', port || '30000', '--name', opts.name || 'Player', '--go');
  }
  progress('Starting Luanti', 1);
  const child = spawn(eng.exe, args, { cwd: path.dirname(eng.exe), windowsHide: false });
  child.stdout.on('data', d => opts.onLog(String(d)));
  child.stderr.on('data', d => opts.onLog(String(d)));
  child.on('error', e => opts.onLog('Luanti failed to start: ' + e.message));
  child.on('close', code => opts.onClose(code));
  setTimeout(() => { if (child.exitCode === null) opts.onStart(eng, g); }, 2500);
  return child;
}

/** Public Luanti servers for our games, most players first. */
async function servers() {
  const r = await fetch('https://servers.luanti.org/list', { headers: UA });
  if (!r.ok) throw new Error(`Server list unavailable (code ${r.status})`);
  const j = await r.json();
  return (j.list || [])
    .filter(s => s.address && s.port)
    .sort((a, b) => (b.clients || 0) - (a.clients || 0))
    .slice(0, 40)
    .map(s => ({
      name: s.name || s.address, address: `${s.address}:${s.port}`, players: s.clients || 0, max: s.clients_max || 0,
      game: s.gameid || '', desc: s.description || '', version: s.version || ''
    }));
}

module.exports = { launch, servers, GAMES, _test: { ensureEngine, ensureGame, writeConf } };
