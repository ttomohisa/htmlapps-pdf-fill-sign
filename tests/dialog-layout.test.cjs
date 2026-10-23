const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/index.template.html'), 'utf8');
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
// Source-level guard for the short-desktop reproduction. Native browser QA
// separately verifies actual boxes, scrolling, keyboard focus, and PDF export.
function rule(selector) {
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  return blocks.filter(([, names]) => names.split(',').map(x => x.trim()).includes(selector)).map(([, , body]) => body).join('\n');
}
for (const kind of ['signature', 'export']) {
  test(`${kind} dialog uses a shrinkable scrolling body at desktop and mobile widths`, () => {
    assert.match(rule(`.${kind}-dialog[open]`), /display:\s*flex\s*;/);
    assert.match(rule(`.${kind}-dialog[open]`), /flex-direction:\s*column\s*;/);
    assert.match(rule(`.${kind}-dialog-header`), /flex:\s*0 0 auto\s*;/);
    const body = rule(`.${kind}-dialog-body`);
    assert.match(body, /min-height:\s*0\s*;/);
    assert.match(body, /flex:\s*1 1 auto\s*;/);
    assert.match(body, /overflow-y:\s*auto\s*;/);
    assert.match(body, /overscroll-behavior:\s*contain\s*;/);
  });
}

test('an open modal locks the underlying document scroll', () => {
  assert.match(css, /html:has\(dialog\[open\]\)\s*\{[^}]*overflow:\s*hidden/);
});

test('phone footer hides without removing loaded PDF action bar', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 640px)'), css.indexOf('@media (max-width: 390px)'));
  assert.match(mobile, /footer\s*\{\s*display:\s*none;?\s*\}/);
  assert.match(mobile, /\.pdf-mobile-action-bar:not\(\[hidden\]\)\s*\{[^}]*display:\s*grid/);
  assert.match(mobile, /body\.pdf-has-mobile-actions\s*\{[^}]*padding-bottom:/);
});
test('existing landscape-phone mode also hides only the informational footer', () => {
  const landscape = css.slice(css.indexOf('@media (max-width: 900px) and (max-height: 500px) and (orientation: landscape)'));
  assert.match(landscape, /footer\s*\{\s*display:\s*none;?\s*\}/);
  assert.match(landscape, /\.pdf-mobile-action-bar:not\(\[hidden\]\)\s*\{[^}]*display:\s*grid/);
});
