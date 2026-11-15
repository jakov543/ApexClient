// Test helpers: build zip files in memory, run a local HTTP server, fake fetch().
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** files: { 'dir/a.txt': 'text' | Buffer } → zip Buffer (deflate-compressed entries) */
function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10); central.writeUInt32LE(0, 12); central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** routes: { '/path': (req, res) => void } → Promise<{ base, close }> */
function serve(routes) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const h = routes[req.url.split('?')[0]];
      if (h) return h(req, res);
      res.writeHead(404); res.end('not found');
    });
    srv.listen(0, '127.0.0.1', () => resolve({ base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }));
  });
}

function tmpDir(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `apex-${name}-`));
  return d;
}

/** fake fetch: handler(url, opts) → { status, body } */
function fakeFetch(handler) {
  return async (url, opts = {}) => {
    const r = await handler(String(url), opts);
    if (!r) throw new Error('unexpected request ' + url);
    const status = r.status || 200;
    return { ok: status < 300, status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  };
}

module.exports = { makeZip, serve, tmpDir, fakeFetch, crc32 };
