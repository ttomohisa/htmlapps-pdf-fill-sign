const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');

const rejected = [
  "画面が低いときは署名・保存ダイアログの中をスクロールして操作できます。閉じるボタンは上部に残ります。ダイアログを開いている間は背景ページをスクロールしません。",
  "In a short window, scroll inside the signature or save dialog to reach its actions. The close button stays at the top. The background page does not scroll while a dialog is open.",
  "既存の入力欄はページの回転や拡大率に合わせて表示されます。EN / JAで表示言語を切り替えても、入力した内容は変わりません。",
  "Existing fields follow the page rotation and zoom. Switching the interface language with EN / JA does not change your entered values."
];

test('help contains user guidance rather than implementation or layout audit prose', () => {
  const root = path.join(__dirname, '..');
  const files = ['src/index.template.html', 'dist/index.html', 'dist/index.self-extract.html',
    ...fs.readdirSync(root).filter(name => name.endsWith('.html'))];
  for (const file of files) {
    const filename = path.join(root, file);
    if (!fs.existsSync(filename)) continue;
    let html = fs.readFileSync(filename, 'utf8');
    const payload = html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/);
    if (payload) html = gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64')).toString('utf8');
    for (const copy of rejected) assert.ok(!html.includes(copy), `${file}: remove internal-facing help copy: ${copy}`);
  }
});
