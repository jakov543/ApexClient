// Downloads + unpacking: the code that installs Java, Luanti and games.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { makeZip, serve, tmpDir } = require('./helpers');
const game = require('../src/game');

const ZIP = makeZip({
  'jdk-21-jre/bin/java.txt': 'pretend java',
  'jdk-21-jre/lib/jvm.cfg': '-server KNOWN\n',
  'jdk-21-jre/lib/big.bin': crypto.randomBytes(300000)
});

let srv, flaky = 0;
test.before(async () => {
  srv = await serve({
    '/plain': (q, r) => { r.writeHead(200, { 'Content-Length': ZIP.length }); r.end(ZIP); },
    '/redirect': (q, r) => { r.writeHead(302, { Location: '/plain' }); r.end(); },
    '/gzipped': (q, r) => { const gz = zlib.gzipSync(ZIP); r.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': gz.length }); r.end(gz); },
    '/html': (q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<html>rate limited</html>'); },
    '/flaky': (q, r) => {
      if (flaky++ === 0) { r.writeHead(200, { 'Content-Length': ZIP.length }); r.write(ZIP.subarray(0, 1000)); return r.destroy(); }
      r.writeHead(200, { 'Content-Length': ZIP.length }); r.end(ZIP);
    },
    '/missing': (q, r) => { r.writeHead(404); r.end(); }
  });
});
test.after(() => srv.close());

const noop = () => {};

for (const route of ['/plain', '/redirect', '/gzipped', '/flaky']) {
  test(`downloadAndExtract works for ${route}`, async () => {
    const dir = tmpDir('dl');
    await game.downloadAndExtract(srv.base + route, path.join(dir, 'a.zip'), path.join(dir, 'out'), 'Test', noop, null, noop);
    assert.ok(fs.existsSync(path.join(dir, 'out', 'jdk-21-jre', 'lib', 'jvm.cfg')), 'jvm.cfg unpacked');
    assert.strictEqual(fs.statSync(path.join(dir, 'out', 'jdk-21-jre', 'lib', 'big.bin')).size, 300000);
    assert.ok(!fs.existsSync(path.join(dir, 'a.zip')), 'archive cleaned up');
  });
}

test('a web page instead of a zip gives a clear error', async () => {
  const dir = tmpDir('dl');
  await assert.rejects(
    game.downloadAndExtract(srv.base + '/html', path.join(dir, 'a.zip'), path.join(dir, 'out'), 'Luanti', noop, null, noop),
    /Could not install Luanti: the server sent a web page/);
  assert.ok(!fs.existsSync(path.join(dir, 'out')), 'no half-installed folder left');
});

test('404 gives a clear error', async () => {
  const dir = tmpDir('dl');
  await assert.rejects(
    game.downloadAndExtract(srv.base + '/missing', path.join(dir, 'a.zip'), path.join(dir, 'out'), 'Java 25', noop, null, noop),
    /Could not install Java 25: server answered 404/);
});

test('checksum mismatch is rejected, correct checksum accepted', async () => {
  const dir = tmpDir('dl');
  const good = crypto.createHash('sha256').update(ZIP).digest('hex');
  await game.download(srv.base + '/plain', path.join(dir, 'ok.zip'), noop, good);
  assert.ok(fs.existsSync(path.join(dir, 'ok.zip')));
  await assert.rejects(game.download(srv.base + '/plain', path.join(dir, 'bad.zip'), noop, 'ab'.repeat(32)), /corrupted/);
  const sha512 = crypto.createHash('sha512').update(ZIP).digest('hex');
  await game.download(srv.base + '/plain', path.join(dir, 'ok512.zip'), noop, { sha512 });
  assert.ok(fs.existsSync(path.join(dir, 'ok512.zip')));
});
