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
// Different .NET/zlib versions can encode the same modules into different gzip
// streams. Validate every byte/hash/length, then compare the decoded assets.
const strictGunzip = stored => {
  // The builder emits one member with a plain 10-byte header (no optional fields).
  // gunzipSync alone accepts trailing padding/extra members which the browser's
  // DecompressionStream rejects. Require full consumption of that one member.
  assert.ok(stored.length >= 18 && stored.subarray(0, 4).equals(Buffer.from([31, 139, 8, 0])), 'Builder gzip header');
  const inflated = zlib.inflateRawSync(stored.subarray(10), { info: true });
  assert.equal(inflated.engine.bytesWritten + 18, stored.length, 'Exactly one complete single gzip member');
  return zlib.gunzipSync(stored); // Also verify trailer CRC32 and uncompressed size.
};
const normalized = html => {
  const manifestMatch = html.match(/const BUILD_MANIFEST = ([^\n]+);/);
  const bundleMatch = html.match(/const assetBundle = ([^\n]+);/);
  assert.ok(manifestMatch && bundleMatch, 'Embedded manifest and asset bundle');
  const manifest = JSON.parse(manifestMatch[1]), bundle = JSON.parse(bundleMatch[1]);
  assert.equal(typeof manifest.generatedAtUtc, 'string');
  assert.ok(Number.isFinite(Date.parse(manifest.generatedAtUtc)), 'Valid build timestamp');
  manifest.generatedAtUtc = 'TIMESTAMP';
  assert.equal(Object.keys(bundle.dependencies).length, manifest.dependencies.length);
  const seenDependencies = new Set();
  for (const dependency of manifest.dependencies) {
    assert.ok(!seenDependencies.has(dependency.id), 'Unique dependency');
    seenDependencies.add(dependency.id);
    const embedded = bundle.dependencies[dependency.id];
    assert.ok(embedded, 'Manifest dependency is embedded');
    assert.equal(Object.keys(embedded.assets).length, dependency.assets.length);
    const seenAssets = new Set();
    for (const entry of dependency.assets) {
      assert.ok(!seenAssets.has(entry.key), 'Unique asset');
      seenAssets.add(entry.key);
      const asset = embedded.assets[entry.key];
      assert.ok(asset, 'Manifest asset is embedded');
      assert.equal(asset.compression, entry.compression);
      assert.equal(asset.mime, entry.mime);
      assert.ok(['gzip', 'none'].includes(asset.compression), 'Supported compression');
      const stored = Buffer.from(asset.base64, 'base64');
      assert.equal(stored.toString('base64'), asset.base64, 'Canonical base64');
      assert.equal(stored.length, asset.storedBytes, 'Stored bundle length');
      assert.equal(stored.length, entry.storedBytes, 'Stored manifest length');
      const bytes = asset.compression === 'gzip' ? strictGunzip(stored) : stored;
      assert.equal(bytes.length, asset.originalBytes, 'Decoded bundle length');
      assert.equal(bytes.length, entry.bytes, 'Decoded manifest length');
      assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), entry.sha256, 'Decoded asset SHA-256');
      asset.base64 = bytes.toString('base64');
      asset.storedBytes = entry.storedBytes = bytes.length;
    }
  }
  return html.replace(manifestMatch[1], JSON.stringify(manifest)).replace(bundleMatch[1], JSON.stringify(bundle));
};
assert.ok(normalized(published) === normalized(readable), 'Root standalone is stale; rebuild and copy dist/index.html to pdf-fill-sign.html');
const loader = fs.readFileSync(path.join(root, 'dist/index.self-extract.html'), 'utf8');
const payload = loader.match(/<script id="self-extract-payload" type="application\/octet-stream">\s*([A-Za-z0-9+/=\s]+)<\/script>/);
assert.ok(payload, 'Self-extract payload');
const restored = strictGunzip(Buffer.from(payload[1].replace(/\s/g, ''), 'base64'));
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
