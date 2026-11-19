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
test('phone styles retain the short description while hiding the hero heading and processing badge',()=>{
  assert.match(source,/@media \(max-width: 640px\), \(max-width: 900px\) and \(max-height: 500px\) and \(orientation: landscape\)/);
  assert.match(source,/\.page-intro h2, \.local-badge \{ display: none; \}/);
  assert.match(source,/\.page-intro p \{ margin-top: 0; \}/);
  assert.doesNotMatch(source,/\.page-intro, \.local-badge \{ display: none; \}/);
  assert.match(source,/<section class="page-intro"/);
  assert.match(source,/<p data-i18n="lead">文字やチェック、署名・画像を追加してPDFを保存できます。<\/p>/);
  assert.match(source,/class="local-badge"/);
  assert.match(source,/\.pdf-drop-icon/);
  assert.match(source,/<path d="m8 10 4 4 4-4"\/>/);
});
test('PDF load state hides the entire introduction and restores it on close',()=>{
  assert.match(source,/body\.pdf-has-document \.page-intro \{ display: none; \}/);
  assert.match(source,/document\.body\.classList\.toggle\('pdf-has-document', active\)/);
  assert.match(source,/function updateMobileUi\(\)/);
  assert.match(source,/async function releaseDocument\(\)/);
  assert.match(source,/await releaseDocument\(\)/);
});
test('phone header scrolls normally while desktop header stays sticky',()=>{
  assert.match(source,/\.app-header \{\s*position: sticky;/);
  assert.match(source,/@media \(max-width: 640px\), \(max-width: 900px\) and \(max-height: 500px\) and \(orientation: landscape\)/);
  assert.match(source,/\.app-header \{ position: static; \}/);
  assert.match(source,/body \.pdf-edit-toolbar, body \.pdf-inspector, body \.pdf-thumbnails \{ scroll-margin-top: 12px; \}/);
  assert.match(source,/\.pdf-mobile-action-bar:not\(\[hidden\]\) \{/);
});
test('PDF control row remains compact and accessible on narrow phones',()=>{
  assert.match(source,/\.pdf-viewer-controls \{ width: 100%; flex-wrap: nowrap; justify-content: space-between; gap: 4px; \}/);
  assert.match(source,/\.pdf-fit-button span, \.pdf-close-button span \{ display: none; \}/);
  assert.match(source,/@media \(max-width: 390px\)/);
  assert.match(source,/\.pdf-viewer-head \{ padding-inline: 0; \}/);
  assert.match(source,/<button class="button pdf-close-button" id="closePdfButton"[^>]+data-i18n-aria-label="closePdf"/);
  assert.match(source,/<span data-i18n="closePdf">PDFを閉じる<\/span>/);
  assert.match(source,/id="fitButton"[^>]+data-i18n-title="fitWidth"/);
  assert.match(source,/id="zoomResetButton"[^>]+data-i18n-aria-label="zoomReset"/);
});
test('Close PDF uses a compact cross icon on desktop and keeps phone tap targets',()=>{
  assert.match(source,/\.pdf-close-button \{ display: inline-flex; align-items: center; justify-content: center; gap: 6px;/);
  assert.match(source,/\.pdf-close-button svg \{ display: block; flex: none; width: 16px; height: 16px; \}/);
  assert.match(source,/<button class="button pdf-close-button" id="closePdfButton"[^>]+data-i18n-aria-label="closePdf"/);
  assert.match(source,/<path d="M18 6 6 18M6 6l12 12"\/>/);
  assert.doesNotMatch(source,/M14 2H6a2 2 0 0 0-2 2v16/);
  assert.match(source,/\.pdf-close-button svg \{ display: block; width: 18px; height: 18px; \}/);
  assert.match(source,/flex: 0 0 40px; width: 40px; height: 44px; min-height: 44px; padding: 0;/);
});
test('phone close control is red and prompts even without unsaved edits',()=>{
  assert.match(source,/\.pdf-viewer-head \.pdf-close-button \{ color: #b42318; \}/);
  assert.match(source,/closePdfConfirmTitle: 'PDFを閉じますか？'/);
  assert.match(source,/closePdfConfirmTitle: 'Close this PDF\?'/);
  assert.match(source,/if \(unsaved \|\| mobileQuery\?\.matches\) \{/);
  assert.match(source,/title: translate\(unsaved \? 'discardTitle' : 'closePdfConfirmTitle'\)/);
  assert.match(source,/confirmLabel: translate\(unsaved \? 'discardCloseAction' : 'closePdf'\)/);
  assert.match(source,/tone: unsaved \? 'danger' : 'default'/);
  assert.match(source,/if \(!confirmed \|\| state\.pdf !== currentPdf \|\| state\.exporting\) return;/);
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
