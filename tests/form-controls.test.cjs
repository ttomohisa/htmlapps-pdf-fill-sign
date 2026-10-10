// Production form functions with the exact PageViewport/Util shipped in the HTML.
// This dependency-free VM test is not browser rendering or PDF save/reopen QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(process.env.PDF_APP_SOURCE || path.join(root, 'src/index.template.html'), 'utf8');
const release = fs.readFileSync(process.env.PDF_APP_SOURCE || path.join(root, 'pdf-fill-sign.html'), 'utf8');
const bundle = JSON.parse(release.match(/const assetBundle = ([^\n]+);/)[1]);
const asset = bundle.dependencies['pdfjs-dist'].assets.pdf;
const stored = Buffer.from(asset.base64, 'base64');
const engine = (asset.compression === 'gzip' ? zlib.gunzipSync(stored) : stored).toString('utf8');
const classes = ['Util', 'PageViewport'].map(name => {
  const match = engine.match(new RegExp(`^class ${name} \\{[^]*?^\\}`, 'm'));
  assert.ok(match, `Embedded PDF.js class ${name}`);
  return match[0];
}).join('\n');
const plain = value => JSON.parse(JSON.stringify(value));
function load(context, names) {
  for (const name of names) {
    const match = source.match(new RegExp(`      (?:async )?function ${name}\\([^]*?(?=\\n      (?:async )?function |\\n      const |\\n      \\$)`));
    assert.ok(match, `Production function ${name}`);
    vm.runInContext(match[0], context);
  }
}
function element(tagName = 'div') {
  return { tagName, dataset: {}, style: {}, children: [], attributes: {}, listeners: {},
    classList: { toggle() {}, add() {} },
    set textContent(value) { this.text = value; this.children = []; },
    get textContent() { return this.text; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    appendChild(child) { this.children.push(child); }
  };
}
function setup({ rotation = 0, scale = 1, userUnit = 1, viewBox = [0, 0, 500, 650] } = {}) {
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const state = { pdf: {}, page: 1, tool: 'select', scale, formFieldsByPage: new Map(), formValues: {}, formInitialValues: {} };
  const context = vm.createContext({ state, $, document: { createElement: element, querySelector: () => null,
    querySelectorAll: () => [], documentElement: {} }, APP_CONFIG: JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'))),
    language: 'ja', updateMeta() {}, renderInspector() {}, renderOverlays() {}, updateFormNotice() {},
    beginFormFieldEdit() {}, commitFormFieldEdit() {}, setFormFieldValue() {}, handleFormTab() {},
    rotation, scale, userUnit, viewBox });
  function $(id) { return node(id); }
  vm.runInContext(classes + '\nstate.viewport = new PageViewport({ viewBox, scale, userUnit, rotation });', context);
  vm.runInContext(source.slice(source.indexOf('      const translations = {'), source.indexOf('      const $ = selector')), context);
  load(context, ['translate', 'applyLanguage', 'formFieldKind', 'initialFormValue', 'currentFormValue',
    'viewportRectFromPdfRect', 'formRectInViewport', 'formFieldLabel', 'renderFormLayer']);
  return { context, state, node, run: code => vm.runInContext(code, context) };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

for (const rotation of [0, 90, 180, 270]) for (const scale of [.25, .73, 1, 2.65]) {
  test(`fillable fields use the shipped viewport API at rotation ${rotation}, zoom ${scale}`, () => {
    const { state, context, run } = setup({ rotation, scale, userUnit: 1.5, viewBox: [10, -20, 510, 630] });
    assert.equal(typeof state.viewport.convertToViewportRectangle, 'undefined', 'Exercise the current PDF.js API');
    for (const rect of [[40, 520, 300, 546], [300, 546, 40, 520], [40, 477, 60, 497]]) {
      context.field = { rect };
      const before = plain(rect);
      const actual = run('formRectInViewport(field)');
      // Independent affine calculation includes crop origin, page rotation and user unit.
      const [a, b, c, d, e, f] = state.viewport.transform;
      const xs = [], ys = [];
      for (const x of [rect[0], rect[2]]) for (const y of [rect[1], rect[3]]) {
        xs.push(a * x + c * y + e); ys.push(b * x + d * y + f);
      }
      const expected = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
      for (const key of Object.keys(expected)) near(actual[key], expected[key]);
      assert.deepEqual(rect, before, 'Do not mutate PDF-space geometry');
    }
  });
}
test('supported field controls survive language changes with values and geometry intact', () => {
  const { state, context, node, run } = setup();
  state.formFieldsByPage.set(0, [
    { id: 'name', fieldType: 'Tx', fieldName: 'qa_name', alternativeText: 'QA Name', rect: [40, 520, 300, 546] },
    { id: 'approved', fieldType: 'Btn', checkBox: true, fieldName: 'qa_approved', rect: [40, 477, 60, 497] }
  ]);
  state.formValues = { name: 'Synthetic QA', approved: true };
  for (const language of ['ja', 'en', 'ja']) {
    context.language = language;
    run('applyLanguage()');
    const controls = node('#formLayer').children;
    assert.equal(controls.length, 2);
    assert.equal(controls[0].children[0].value, 'Synthetic QA');
    assert.equal(controls[1].children[0].checked, true);
    assert.equal(controls[0].style.left, '40px'); assert.equal(controls[0].style.top, '104px');
    assert.equal(controls[0].style.width, '260px'); assert.equal(controls[0].style.height, '26px');
    assert.equal(controls[0].children[0].attributes['aria-label'], 'QA Name');
  }
  assert.deepEqual(state.formValues, { name: 'Synthetic QA', approved: true });
});
test('missing page/field geometry remains a harmless empty form layer', () => {
  const { state, run } = setup();
  assert.equal(run('formRectInViewport(null)'), null);
  assert.equal(run('formRectInViewport({})'), null);
  state.viewport = null;
  assert.equal(run('formRectInViewport({rect:[0,0,20,20]})'), null);
  assert.doesNotThrow(() => run('renderFormLayer()'));
});
test('language switch shows the destination code and accessible name; privacy wording stays accurate', () => {
  const { state, context, node, run } = setup(); state.pdf = null;
  for (const [language, label, accessibleName, badge] of [
    ['ja', 'EN', '英語に切り替え', '完全ローカル処理'],
    ['en', 'JA', 'Switch to Japanese', 'Completely local processing']
  ]) {
    context.language = language; run('applyLanguage()');
    assert.equal(node('#languageButton').textContent, label);
    assert.equal(node('#languageButton').attributes['aria-label'], accessibleName);
    assert.equal(run("translate('localBadge')"), badge);
  }
});
test('this patch uses canonical 1.0.4 metadata and a matching static header fallback', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json')));
  assert.equal(config.version, '1.0.4');
  assert.match(source, /id="versionBadge">v1\.0\.4<\/span>/);
  const { state, node, run } = setup(); state.pdf = null;
  const assignment = source.match(/      \$\('#versionBadge'\)\.textContent = [^\n]+/)[0];
  run(assignment);
  assert.equal(node('#versionBadge').textContent, `v${config.version}`);
});
