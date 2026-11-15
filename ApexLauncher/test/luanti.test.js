// Luanti: engine + game install, settings file.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeZip, fakeFetch, tmpDir } = require('./helpers');
const game = require('../src/game');
const L = require('../src/luanti');

const ENGINE = makeZip({ 'luanti-9.9.9-win64/bin/luanti.exe': 'exe', 'luanti-9.9.9-win64/builtin/init.lua': '--' });
const MINECLONIA = makeZip({ 'mineclonia/game.conf': 'title = Mineclonia\n', 'mineclonia/mods/a/init.lua': '--' });
const FLAT = makeZip({ 'game.conf': 'title = VoxeLibre\n', 'mods/b/init.lua': '--' }); // zip without a top folder

const realPlatform = process.platform;
test.before(() => Object.defineProperty(process, 'platform', { value: 'win32' }));
test.after(() => Object.defineProperty(process, 'platform', { value: realPlatform }));

let engineDownloads = 0;
function setup(tag = '9.9.9') {
  global.fetch = fakeFetch(url => {
    if (url.includes('api.github.com')) return { body: { tag_name: tag, assets: [{ name: `luanti-${tag}-win64.zip`, browser_download_url: 'ENGINE' }] } };
    if (url.includes('/packages/ryvnf/mineclonia/releases/')) return { body: [{ id: 1, url: '/uploads/mcl.zip' }] };
    if (url.includes('/packages/Wuzzy/mineclone2/releases/')) return { body: [{ id: 2 }] };
  });
}
const helpers = {
  log: () => {},
  downloadAndExtract: async (url, archive, dest) => {
    if (url === 'ENGINE') engineDownloads++;
    const buf = url === 'ENGINE' ? ENGINE : url.includes('mcl.zip') ? MINECLONIA : FLAT;
    fs.mkdirSync(path.dirname(archive), { recursive: true });
    fs.writeFileSync(archive, buf);
    fs.rmSync(dest, { recursive: true, force: true });
    await game.extract(archive, dest);
    fs.rmSync(archive);
  }
};

test('engine installs once, keeps worlds when it updates', async () => {
  const root = tmpDir('luanti');
  setup('9.9.9');
  const e1 = await L._test.ensureEngine(root, () => {}, helpers);
  assert.ok(fs.existsSync(e1.exe) && e1.exe.endsWith(path.join('bin', 'luanti.exe')));
  await L._test.ensureEngine(root, () => {}, helpers);
  assert.strictEqual(engineDownloads, 1, 'not downloaded twice');
  fs.mkdirSync(path.join(e1.dir, 'worlds', 'MyWorld'), { recursive: true });
  fs.writeFileSync(path.join(e1.dir, 'worlds', 'MyWorld', 'world.mt'), 'x');
  setup('10.0.0');
  const e2 = await L._test.ensureEngine(root, () => {}, helpers);
  assert.strictEqual(e2.tag, '10.0.0');
  assert.ok(fs.existsSync(path.join(e2.dir, 'worlds', 'MyWorld', 'world.mt')), 'world kept after update');
});

test('games install whether the zip has a top folder or not', async () => {
  const root = tmpDir('luanti');
  setup();
  const e = await L._test.ensureEngine(root, () => {}, helpers);
  const g1 = await L._test.ensureGame(e.dir, 'mineclonia', () => {}, helpers);
  assert.strictEqual(g1.title, 'Mineclonia');
  assert.ok(fs.existsSync(path.join(e.dir, 'games', 'mineclonia', 'game.conf')));
  const g2 = await L._test.ensureGame(e.dir, 'mineclone2', () => {}, helpers);
  assert.strictEqual(g2.title, 'VoxeLibre');
  assert.ok(fs.existsSync(path.join(e.dir, 'games', 'mineclone2', 'game.conf')));
});

test('settings file gets game + name, keeps other lines', async () => {
  const dir = tmpDir('luanti');
  fs.writeFileSync(path.join(dir, 'minetest.conf'), 'fps_max = 144\nname = Old\n');
  await L._test.writeConf(dir, { game: 'mineclonia', name: 'Bandera' });
  const txt = fs.readFileSync(path.join(dir, 'minetest.conf'), 'utf8');
  assert.match(txt, /fps_max = 144/);
  assert.match(txt, /^name = Bandera$/m);
  assert.match(txt, /^menu_last_game = mineclonia$/m);
  assert.ok(!/name = Old/.test(txt));
});
