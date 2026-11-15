// UI wiring: every element the code uses exists, every button reaches the main process.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('renderer/index.html');
const js = read('renderer/app.js');
const preload = read('preload.js');
const main = read('main.js');

test('no duplicate element ids', () => {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepStrictEqual(dupes, []);
});

test('every $(\'id\') in app.js exists in index.html', () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const used = [...new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
  assert.deepStrictEqual(used.filter(u => !ids.has(u)), []);
});

test('every apex.* call exists in preload, every preload channel has a handler', () => {
  const api = new Set([...preload.matchAll(/^\s+(\w+):/gm)].map(m => m[1]));
  const calls = [...new Set([...js.matchAll(/apex\.(\w+)\(/g)].map(m => m[1]))];
  assert.deepStrictEqual(calls.filter(c => !api.has(c)), [], 'missing in preload');
  const channels = [...preload.matchAll(/ipcRenderer\.(?:invoke|send)\('([^']+)'/g)].map(m => m[1]);
  const handlers = new Set([...main.matchAll(/ipcMain\.(?:handle|on)\('([^']+)'/g)].map(m => m[1]));
  assert.deepStrictEqual(channels.filter(c => !handlers.has(c)), [], 'missing handler in main.js');
});

test('every sidebar page exists', () => {
  const pages = [...html.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]);
  for (const p of pages) assert.ok(html.includes(`id="page-${p}"`), `page-${p} missing`);
});

test('all launcher JavaScript parses', () => {
  const vm = require('vm');
  for (const f of ['main.js', 'preload.js', 'config.js', 'renderer/app.js', 'src/game.js', 'src/luanti.js', 'src/content.js', 'src/mcauth.js', 'src/discord.js']) {
    assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
  }
});
