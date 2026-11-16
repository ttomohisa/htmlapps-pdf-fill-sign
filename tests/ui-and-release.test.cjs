'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'src/index.template.html'),'utf8');
const workflow = fs.readFileSync(path.join(root,'.github/workflows/release-on-merge.yml'),'utf8');
const app = JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8'));

test('hero titles differ from the app header in both languages and are concise',()=>{
  assert.match(source,/introTitle: 'PDFに書き込んで保存'/);
  assert.match(source,/introTitle: 'Write on your PDF'/);
  assert.notEqual(app.nameJa,'PDFに書き込んで保存');
  assert.notEqual(app.name,'Write on your PDF');
  assert.match(source,/lead: '文字やチェック、署名・画像を追加してPDFを保存できます。'/);
  assert.match(source,/lead: 'Add text, marks, signatures, or images, then save the PDF\.'/);
  assert.doesNotMatch(source,/処理は端末内だけで完結します。/);
  assert.doesNotMatch(source,/Processing stays entirely on your device\./);
});
test('phone styles hide the introduction and processing badge without removing either from desktop',()=>{
  assert.match(source,/@media \(max-width: 640px\), \(max-width: 900px\) and \(max-height: 500px\) and \(orientation: landscape\)/);
  assert.match(source,/\.page-intro, \.local-badge \{ display: none; \}/);
  assert.match(source,/<section class="page-intro"/);
  assert.match(source,/class="local-badge"/);
  assert.match(source,/\.pdf-drop-icon/);
  assert.match(source,/<path d="m8 10 4 4 4-4"\/>/);
});
test('merged pull requests trigger exactly one versioned GitHub Release',()=>{
  assert.match(workflow,/pull_request:\s*\n\s+types: \[closed\]/);
  assert.match(workflow,/branches: \[main\]/);
  assert.match(workflow,/if: github\.event\.pull_request\.merged == true/);
  assert.match(workflow,/contents: write/);
  assert.match(workflow,/merge_commit_sha/);
  assert.match(workflow,/\.\/scripts\/check-repository\.ps1/);
  assert.match(workflow,/\$tag = "v\$version"/);
  assert.match(workflow,/git tag --list/);
  assert.match(workflow,/gh release view/);
  assert.match(workflow,/gh release create/);
  assert.match(workflow,/--target \$env:MERGED_COMMIT/);
  assert.match(workflow,/--generate-notes/);
  assert.match(workflow,/dist\/index\.html#pdf-fill-sign\.html/);
  assert.match(workflow,/dist\/index\.self-extract\.html#pdf-fill-sign\.self-extract\.html/);
  assert.equal(app.version,'1.0.6');
});
