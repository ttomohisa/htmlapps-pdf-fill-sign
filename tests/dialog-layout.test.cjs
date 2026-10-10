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
