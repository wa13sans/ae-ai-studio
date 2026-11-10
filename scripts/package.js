'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_FILES = ['README.md', 'LICENSE', 'CHANGELOG.md', 'package.json'];
const ROOT_DIRS = ['extension', 'docs', 'scripts', 'tests', '.github'];
const REQUIRED = ['extension/CSXS/manifest.xml', 'extension/index.html', 'extension/host/bridge.jsx', 'extension/shared/plan.js'];
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function excluded(name) {
  return name === 'node_modules' || name === 'dist' || name === '.git' ||
    name === '.DS_Store' || name === 'Thumbs.db' ||
    /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx|aep|aepx|log)$/i.test(name);
}
function collectFiles(source) {
  const root = path.resolve(source);
  const result = [];
  function walk(relative) {
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root + path.sep)) throw new Error('Archive path escapes the source directory.');
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Symbolic links are not allowed in release archives: ' + relative);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        if (!excluded(name)) walk(path.join(relative, name));
      }
    } else if (stat.isFile()) {
      result.push({ name: relative.split(path.sep).join('/'), data: fs.readFileSync(absolute) });
    } else throw new Error('Unsupported file in release archive: ' + relative);
  }
  for (const name of ROOT_FILES) walk(name);
  for (const name of ROOT_DIRS) if (fs.existsSync(path.join(root, name))) walk(name);
  return result.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
function makeZip(entries, prefix) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    if (entry.name.startsWith('/') || entry.name.split('/').some(p => p === '..' || p === '') || /\\/.test(entry.name)) {
      throw new Error('Unsafe archive entry: ' + entry.name);
    }
    const name = Buffer.from(prefix + '/' + entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    if (name.length > 65535 || data.length > 0xffffffff) throw new Error('Archive entry exceeds ZIP limits.');
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 names, store-only ZIP; no external dependencies.
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0x5c21, 12); // Fixed 2026-01-01 for reproducible archives.
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    localParts.push(header, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5c21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += header.length + name.length + data.length;
  }
  if (entries.length > 65535 || offset > 0xffffffff) throw new Error('Archive exceeds classic ZIP limits.');
  const centralData = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat(localParts.concat([centralData, end]));
}
function build(source, destination) {
  const root = path.resolve(source);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(pkg.version)) throw new Error('Invalid package version.');
  for (const required of REQUIRED) {
    if (!fs.existsSync(path.join(root, required))) throw new Error('Missing release file: ' + required);
  }
  const files = collectFiles(root);
  const base = 'ae-ai-studio-' + pkg.version;
  const zip = makeZip(files, base);
  const out = path.resolve(destination);
  fs.mkdirSync(out, { recursive: true });
  const archive = path.join(out, base + '.zip');
  const checksum = path.join(out, base + '.sha256');
  const sha256 = crypto.createHash('sha256').update(zip).digest('hex');
  fs.writeFileSync(archive, zip);
  fs.writeFileSync(checksum, sha256 + '  ' + path.basename(archive) + '\n', 'utf8');
  return { archive, checksum, sha256, files: files.length, bytes: zip.length };
}
if (require.main === module) {
  try {
    const result = build(path.resolve(__dirname, '..'), path.resolve(__dirname, '..', 'dist'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Packaging failed: ' + error.message);
    process.exitCode = 1;
  }
}
module.exports = { crc32, collectFiles, makeZip, build };
