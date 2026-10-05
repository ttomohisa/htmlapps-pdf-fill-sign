const {test}=require('node:test');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'verify-position-artifacts.cjs'),'utf8');
// Execute only the normalizer from the actual verifier, without building or running it.
function normalize(html){const context=vm.createContext({require,assert,zlib,Buffer});const start=source.indexOf('const strictGunzip =');const end=source.indexOf('\nassert.',start);vm.runInContext(source.slice(start,end)+'\nthis.normalize = normalized;',context);return context.normalize(html);}
function fixture(level=1){const bytes=Buffer.from('PDF module fixture '.repeat(1000));const stored=zlib.gzipSync(bytes,{level});const asset={mime:'text/javascript',compression:'gzip',originalBytes:bytes.length,storedBytes:stored.length,base64:stored.toString('base64')};const manifest={generatedAtUtc:'2026-10-05T00:00:00Z',dependencies:[{id:'pdfjs-dist',version:'6.3.289',assets:[{key:'pdf',mime:asset.mime,compression:'gzip',bytes:bytes.length,storedBytes:stored.length,sha256:createHash('sha256').update(bytes).digest('hex')}]}]};const bundle={schemaVersion:2,dependencies:{'pdfjs-dist':{version:'6.3.289',assets:{pdf:asset}}}};return `<!doctype html>\nconst BUILD_MANIFEST = ${JSON.stringify(manifest)};\nconst assetBundle = ${JSON.stringify(bundle)};\nconst productBehavior = 'center';`;}
test('artifact comparison accepts different lossless gzip output for identical runtime bytes',()=>{const a=fixture(1),b=fixture(9);assert.notEqual(a,b);assert.equal(normalize(a),normalize(b));});
test('artifact comparison rejects stale app behavior and changed asset metadata',()=>{const a=fixture();for(const b of [a.replace("'center'","'wrong'"),a.replace('6.3.289','6.3.999')])assert.notEqual(normalize(a),normalize(b));});
test('artifact comparison validates decoded bytes rather than trusting manifest hashes',()=>{const a=fixture();assert.throws(()=>normalize(a.replace(/"sha256":"[^"]+"/,'"sha256":"'+'0'.repeat(64)+'"')));assert.throws(()=>normalize(a.replace(/"originalBytes":\d+/,'"originalBytes":1')));assert.throws(()=>normalize(a.replace(/"storedBytes":\d+/g,'"storedBytes":1')));});
test('only a valid generated timestamp is ignored',()=>{const a=fixture();assert.equal(normalize(a),normalize(a.replace('2026-10-05T00:00:00Z','2025-01-01T00:00:00Z')));assert.throws(()=>normalize(a.replace('2026-10-05T00:00:00Z','bad-date')));});
test('recompressed changed payload and truncated gzip cannot pass integrity checks',()=>{
  const html=fixture();const match=html.match(/const assetBundle = ([^\n]+);/);const bundle=JSON.parse(match[1]);const asset=bundle.dependencies['pdfjs-dist'].assets.pdf;
  const raw=zlib.gunzipSync(Buffer.from(asset.base64,'base64'));raw[0]^=1;const corrupted=zlib.gzipSync(raw);asset.base64=corrupted.toString('base64');asset.storedBytes=corrupted.length;
  const manifestMatch=html.match(/const BUILD_MANIFEST = ([^\n]+);/);const manifest=JSON.parse(manifestMatch[1]);manifest.dependencies[0].assets[0].storedBytes=corrupted.length;
  assert.throws(()=>normalize(html.replace(match[1],JSON.stringify(bundle)).replace(manifestMatch[1],JSON.stringify(manifest))),/SHA-256/);
  const truncated=corrupted.subarray(0,-4);asset.base64=truncated.toString('base64');asset.storedBytes=truncated.length;manifest.dependencies[0].assets[0].storedBytes=truncated.length;
  assert.throws(()=>normalize(html.replace(match[1],JSON.stringify(bundle)).replace(manifestMatch[1],JSON.stringify(manifest))));
});
test('gzip trailing bytes and extra members rejected just like browser DecompressionStream',async()=>{
  const html=fixture();const bundleMatch=html.match(/const assetBundle = ([^\n]+);/),manifestMatch=html.match(/const BUILD_MANIFEST = ([^\n]+);/);
  for(const suffix of [Buffer.from([0]),zlib.gzipSync(Buffer.alloc(0))]) {
    const bundle=JSON.parse(bundleMatch[1]),manifest=JSON.parse(manifestMatch[1]);const asset=bundle.dependencies['pdfjs-dist'].assets.pdf;
    const bytes=Buffer.concat([Buffer.from(asset.base64,'base64'),suffix]);asset.base64=bytes.toString('base64');asset.storedBytes=bytes.length;manifest.dependencies[0].assets[0].storedBytes=bytes.length;
    assert.throws(()=>normalize(html.replace(bundleMatch[1],JSON.stringify(bundle)).replace(manifestMatch[1],JSON.stringify(manifest))),/single gzip member/);
    await assert.rejects(new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
});
