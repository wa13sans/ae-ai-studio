'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { crc32, collectFiles, makeZip, build } = require('../scripts/package');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-ai-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    'package.json': '{"version":"1.0.0-beta.1"}',
    'README.md': '한국어 English 中文',
    'LICENSE': 'Fixture license text',
    'CHANGELOG.md': 'Beta',
    'extension/index.html': '<html></html>',
    'extension/CSXS/manifest.xml': '<ExtensionManifest/>',
    'extension/host/bridge.jsx': '// host',
    'extension/shared/plan.js': '// plan'
  };
  for (const [name, data] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  return root;
}
function readStoredZip(buffer) {
  const entries = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0);
    assert.equal(buffer.readUInt16LE(offset + 6) & 0x800, 0x800);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    const data = buffer.subarray(start, start + size);
    assert.equal(crc32(data), buffer.readUInt32LE(offset + 14));
    entries[name] = data;
    offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50);
  assert.equal(buffer.readUInt32LE(buffer.length - 6), offset);
  assert.equal(buffer.readUInt16LE(buffer.length - 12), Object.keys(entries).length);
  return entries;
}

test('CRC32 matches the standard interoperability vector', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});
test('ZIP preserves Unicode names and contents and rejects traversal', () => {
  const zip = makeZip([{ name: '문서/说明.md', data: '한글 中文' }], 'release');
  const entries = readStoredZip(zip);
  assert.equal(entries['release/문서/说明.md'].toString(), '한글 中文');
  for (const name of ['../escape', '/absolute', 'a/../escape', 'a\\escape']) {
    assert.throws(() => makeZip([{ name, data: '' }], 'release'), /Unsafe archive/);
  }
});
test('release is reproducible, installable, and checksum-verifiable', t => {
  const root = fixture(t);
  const result = build(root, path.join(root, 'dist'));
  const first = fs.readFileSync(result.archive);
  const entries = readStoredZip(first);
  assert.equal(entries['ae-ai-studio-1.0.0-beta.1/README.md'].toString(), '한국어 English 中文');
  assert.ok(entries['ae-ai-studio-1.0.0-beta.1/extension/CSXS/manifest.xml']);
  assert.equal(crypto.createHash('sha256').update(first).digest('hex'), result.sha256);
  assert.equal(fs.readFileSync(result.checksum, 'utf8'), result.sha256 + '  ae-ai-studio-1.0.0-beta.1.zip\n');
  assert.deepEqual(fs.readFileSync(build(root, path.join(root, 'other-output')).archive), first);
});
test('release excludes project files, keys, environment files, and output', t => {
  const root = fixture(t);
  for (const name of ['.env', '.env.local', 'secret.pem', 'private.key', 'project.aep', 'trace.log']) {
    fs.writeFileSync(path.join(root, 'extension', name), 'must not ship');
  }
  fs.mkdirSync(path.join(root, 'node_modules'));
  fs.writeFileSync(path.join(root, 'node_modules', 'unexpected'), 'must not ship');
  const names = collectFiles(root).map(entry => entry.name);
  assert.equal(names.some(name => /\.env|\.pem|\.key|\.aep|\.log|node_modules/.test(name)), false);
});
test('missing host engine prevents producing an incomplete release', t => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, 'extension/host/bridge.jsx'));
  assert.throws(() => build(root, path.join(root, 'dist')), /Missing release file/);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});
test('symlinks cannot import files outside the release source', t => {
  const root = fixture(t);
  try { fs.symlinkSync(path.join(root, 'LICENSE'), path.join(root, 'extension', 'external-link')); }
  catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') return t.skip('Symlink creation requires permission on this platform.');
    throw error;
  }
  assert.throws(() => collectFiles(root), /Symbolic links/);
});
