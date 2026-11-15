// Minecraft sign-in decisions: full game, pick a username, demo.
const test = require('node:test');
const assert = require('node:assert');
const { fakeFetch } = require('./helpers');
const m = require('../src/mcauth');

const xbox = { xAuth: async () => 'XBL3.0 x=1;token' };

function mojang({ profile = null, store = [], license = [], create = 200, nameStatus = 'AVAILABLE', login = 200 }) {
  let created = null;
  return fakeFetch((url, o) => {
    if (url.includes('login_with_xbox')) return login === 200 ? { body: { access_token: 'AT', expires_in: 86400 } } : { status: login, body: {} };
    if (url.endsWith('/minecraft/profile') && o.method === 'POST') {
      if (create !== 200) return { status: create, body: {} };
      created = JSON.parse(o.body).profileName; return { body: {} };
    }
    if (url.endsWith('/minecraft/profile')) return created ? { body: { id: 'newid', name: created } } : profile ? { body: profile } : { status: 404, body: {} };
    if (url.includes('/entitlements/mcstore')) return { body: { items: store.map(name => ({ name })) } };
    if (url.includes('/entitlements/license')) return { body: { items: license.map(name => ({ name })) } };
    if (url.includes('/available')) return { body: { status: nameStatus } };
  });
}

test('owner with a username gets the full game', async () => {
  global.fetch = mojang({ profile: { id: 'abc', name: 'Bandera' } });
  const s = await m.minecraftLogin(xbox);
  assert.deepStrictEqual([s.status, s.name, s.demo], ['ok', 'Bandera', false]);
  assert.strictEqual(m.toMclc(s).uuid, 'abc');
  assert.strictEqual(m.isValid(s), true);
});

test('Java & Bedrock bundle (Java only in /license) → pick a username → full game', async () => {
  global.fetch = mojang({ store: ['product_minecraft_bedrock'], license: ['product_minecraft_bedrock', 'game_minecraft'] });
  let s = await m.minecraftLogin(xbox);
  assert.strictEqual(s.status, 'needsName');
  assert.strictEqual(s.likelyJava, true);
  s = await m.createProfile(s, 'Bandera_HR');
  assert.deepStrictEqual([s.status, s.name, s.demo], ['ok', 'Bandera_HR', false]);
});

test('Game Pass without a username → pick a username', async () => {
  global.fetch = mojang({ license: ['product_game_pass_pc'] });
  const s = await m.minecraftLogin(xbox);
  assert.strictEqual(s.status, 'needsName');
});

test('only Bedrock: Mojang refuses the name → clear message, status bedrockOnly', async () => {
  global.fetch = mojang({ store: ['product_minecraft_bedrock'], create: 403 });
  const s = await m.minecraftLogin(xbox);
  await assert.rejects(m.createProfile(s, 'Someone'), /does not own Minecraft: Java Edition/);
  assert.strictEqual(s.status, 'bedrockOnly');
  assert.strictEqual(s.demo, true);
});

test('no Minecraft at all → demo', async () => {
  global.fetch = mojang({});
  const s = await m.minecraftLogin(xbox);
  assert.deepStrictEqual([s.status, s.demo], ['none', true]);
  assert.strictEqual(m.toMclc(s).meta.demo, true);
});

test('bad / taken usernames are explained', async () => {
  global.fetch = mojang({ license: ['game_minecraft'], nameStatus: 'DUPLICATE' });
  const s = await m.minecraftLogin(xbox);
  await assert.rejects(m.createProfile(s, 'a b'), /3–16 characters/);
  await assert.rejects(m.createProfile(s, 'Notch'), /already taken/);
});

test('Mojang login errors are readable', async () => {
  global.fetch = mojang({ login: 429 });
  await assert.rejects(m.minecraftLogin(xbox), /Too many sign-in attempts/);
  assert.strictEqual(m.niceError('error.gui.closed').message, 'Sign in cancelled.');
  assert.match(m.niceError('error.auth.xsts.userNotFound').message, /no Xbox profile/);
  assert.ok(m.niceError({ ts: 'error.auth.microsoft', response: { status: 400 } }).message.includes('(code 400)'));
});
