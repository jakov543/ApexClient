// Mods / resource packs / shaders from Modrinth.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { fakeFetch, tmpDir } = require('./helpers');
const content = require('../src/content');

function ver(id, file, deps = []) {
  return { id: id + '-v', version_number: '1.0', version_type: 'release', name: id,
    files: [{ url: `https://cdn.example/${file}`, filename: file, primary: true, hashes: {} }], dependencies: deps };
}
const PROJECTS = {
  'cool-mod': [ver('cool-mod', 'cool-mod.jar', [{ project_id: 'lib-api', dependency_type: 'required' }, { project_id: 'opt', dependency_type: 'optional' }])],
  'lib-api': [ver('lib-api', 'lib-api.jar')],
  'faithful': [ver('faithful', 'Faithful.zip')],
  'complementary': [ver('complementary', 'Complementary.zip')],
  'iris': [ver('iris', 'iris.jar')],
  'sodium': [ver('sodium', 'sodium.jar')],
  'old-mod': []
};
const calls = [];
global.fetch = fakeFetch(url => {
  calls.push(url);
  if (url.includes('/search?')) return { body: { total_hits: 1, hits: [{ project_id: 'cool-mod', slug: 'cool', title: 'Cool Mod', author: 'me', description: 'd', downloads: 1234, icon_url: 'x' }] } };
  const m = url.match(/\/project\/([^/]+)\/version/);
  if (m) return { body: PROJECTS[decodeURIComponent(m[1])] || [] };
});
const fakeDownload = async (url, dest) => { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, url); };

test('search builds the right Modrinth filters', async () => {
  const r = await content.search({ type: 'mod', query: 'cool', mc: '1.21.1' });
  assert.strictEqual(r.hits[0].title, 'Cool Mod');
  const url = decodeURIComponent(calls.at(-1));
  assert.ok(url.includes('project_type:mod') && url.includes('versions:1.21.1') && url.includes('categories:fabric'), url);
  await content.search({ type: 'resourcepack', query: '', mc: '1.8.9' });
  assert.ok(!decodeURIComponent(calls.at(-1)).includes('categories:fabric'), 'resource packs are not limited to fabric');
});

test('installing a mod also installs its required dependencies (not optional ones)', async () => {
  const root = tmpDir('content');
  const done = await content.install({ root, mc: '1.21.1', mode: 'apex', type: 'mod', projectId: 'cool-mod', title: 'Cool Mod', download: fakeDownload });
  assert.deepStrictEqual(done, ['Cool Mod', 'lib-api']);
  const mods = fs.readdirSync(path.join(root, 'instances', '1.21.1', 'mods')).sort();
  assert.deepStrictEqual(mods, ['cool-mod.jar', 'lib-api.jar']);
  const again = await content.install({ root, mc: '1.21.1', mode: 'apex', type: 'mod', projectId: 'cool-mod', title: 'Cool Mod', download: fakeDownload });
  assert.deepStrictEqual(again, [], 'second install does nothing');
});

test('a shader brings Iris + Sodium; resource packs go to resourcepacks', async () => {
  const root = tmpDir('content');
  const done = await content.install({ root, mc: '26.3', mode: 'fabric', type: 'shader', projectId: 'complementary', title: 'Complementary', download: fakeDownload });
  assert.deepStrictEqual(done, ['Complementary', 'Iris Shaders', 'Sodium']);
  assert.ok(fs.existsSync(path.join(root, 'instances', '26.3', 'shaderpacks', 'Complementary.zip')));
  assert.ok(fs.existsSync(path.join(root, 'instances', '26.3', 'mods', 'iris.jar')));
  await content.install({ root, mc: '1.8.9', mode: 'vanilla', type: 'resourcepack', projectId: 'faithful', title: 'Faithful', download: fakeDownload });
  assert.ok(fs.existsSync(path.join(root, 'instances', '1.8.9', 'resourcepacks', 'Faithful.zip')));
});

test('mods and shaders are refused on vanilla versions with a helpful message', async () => {
  const root = tmpDir('content');
  await assert.rejects(content.install({ root, mc: '1.8.9', mode: 'vanilla', type: 'mod', projectId: 'cool-mod', download: fakeDownload }), /runs without Fabric/);
  await assert.rejects(content.install({ root, mc: '1.21.1', mode: 'apex', type: 'mod', projectId: 'old-mod', title: 'Old Mod', download: fakeDownload }), /Old Mod has no version for Minecraft 1.21.1/);
});

test('installed list + remove; Apex built-in mods are protected', async () => {
  const root = tmpDir('content');
  await content.install({ root, mc: '1.21.1', mode: 'apex', type: 'mod', projectId: 'cool-mod', title: 'Cool Mod', download: fakeDownload });
  fs.writeFileSync(path.join(root, 'instances', '1.21.1', 'mods', 'ApexClient.jar'), 'x');
  fs.writeFileSync(path.join(root, 'instances', '1.21.1', 'mods', 'my-own.jar'), 'x');
  let list = content.installed(root, '1.21.1');
  assert.strictEqual(list.find(x => x.file === 'cool-mod.jar').title, 'Cool Mod');
  assert.strictEqual(list.find(x => x.file === 'ApexClient.jar').builtin, true);
  assert.ok(list.find(x => x.file === 'my-own.jar'), 'mods added by hand are listed too');
  await assert.rejects(content.remove(root, '1.21.1', 'mod', 'ApexClient.jar'), /part of Apex Client/);
  await assert.rejects(content.remove(root, '1.21.1', 'mod', '../evil.jar'), /Bad file name/);
  await content.remove(root, '1.21.1', 'mod', 'cool-mod.jar');
  list = content.installed(root, '1.21.1');
  assert.ok(!list.find(x => x.file === 'cool-mod.jar'));
  const done = await content.install({ root, mc: '1.21.1', mode: 'apex', type: 'mod', projectId: 'cool-mod', title: 'Cool Mod', download: fakeDownload });
  assert.deepStrictEqual(done, ['Cool Mod'], 'can be installed again after removing');
});
