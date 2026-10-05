// Source-derived VM boundary tests, not browser or real-PDF rendering/export QA.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const readable = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const published = fs.readFileSync(path.join(root, 'pdf-fill-sign.html'), 'utf8');
// Only the generated timestamp is expected to differ between separate builds.
const normalized = value => value.replace(/("generatedAtUtc"\s*:\s*")[^"]+("\s*[,}])/g, '$1TIMESTAMP$2');
assert.equal(normalized(published), normalized(readable), 'Root standalone is stale; rebuild and copy dist/index.html to pdf-fill-sign.html');
const loader = fs.readFileSync(path.join(root, 'dist/index.self-extract.html'), 'utf8');
const payload = loader.match(/<script id="self-extract-payload" type="application\/octet-stream">\s*([A-Za-z0-9+/=\s]+)<\/script>/);
assert.ok(payload, 'Self-extract payload');
const restored = zlib.gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64'));
assert.deepEqual(restored, Buffer.from(readable), 'Self-extract must restore the readable artifact exactly');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-position-artifacts-'));
try {
  const unpacked = path.join(temp, 'unpacked.html');fs.writeFileSync(unpacked, restored);
  for(const source of [path.join(root, 'dist/index.html'),path.join(root, 'pdf-fill-sign.html'),unpacked]) {
    const result = spawnSync(process.execPath, ['--test', path.join(__dirname, 'duplicate-overlays.test.cjs'), path.join(__dirname, 'position-actions.test.cjs')], {env:{...process.env, PDF_APP_SOURCE:source},encoding:'utf8'});
    process.stdout.write(result.stdout || '');process.stderr.write(result.stderr || '');
    assert.equal(result.status, 0, `Behavior tests failed: ${source}`);
  }
  console.log('PASS readable/root/self-extract parity and behavior regressions. Browser and real-PDF behavior are not exercised.');
} finally { fs.rmSync(temp, {recursive:true,force:true}); }
