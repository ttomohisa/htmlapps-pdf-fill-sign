const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/index.template.html'), 'utf8');
function setup(item, rotation = 0) {
  const state = { pdf: {}, page: 1, scale: 1, overlays: item ? [item] : [], selectedId: item?.id, formValues: {}, formInitialValues: {}, history: [], future: [] };
  // Affine PDF viewports include non-zero crop origins and the four page rotations.
  const toView = ([x,y]) => rotation === 90 ? [y-20,x-10] : rotation === 180 ? [210-x,y-20] : rotation === 270 ? [320-y,210-x] : [x-10,320-y];
  const toPdf = ([x,y]) => rotation === 90 ? [y+10,x+20] : rotation === 180 ? [210-x,y+20] : rotation === 270 ? [210-y,320-x] : [x+10,320-y];
  state.viewport = { width: rotation % 180 ? 300 : 200, height: rotation % 180 ? 200 : 300, convertToViewportPoint: (x,y)=>toView([x,y]), convertToPdfPoint: (x,y)=>toPdf([x,y]) };
  let id = 0;
  const context = vm.createContext({ state, crypto: { randomUUID: () => `copy-${++id}` }, requestAnimationFrame: f=>f(), document: {querySelector: ()=>null}, CSS: {escape:x=>x}, setTool: ()=>{}, renderOverlays: ()=>{}, renderInspector: ()=>{}, renderFormLayer: ()=>{}, syncAllFormStorage: ()=>{}, updateRequiredWarning: ()=>{}, updateHistoryButtons: ()=>{}, updateSaveState: ()=>{} });
  const names = ['cloneOverlayItem','cloneEditState','editStateSignature','pushHistory','restoreEditState','commitMutation','undoEdit','redoEdit','selectedOverlay','newOverlayId','viewportRectFromPdfRect','pdfRectFromViewportRect','duplicateSelected'];
  for (const name of names) {
    const match = source.match(new RegExp(`      function ${name}\\([^]*?(?=\\n      (?:async )?function |\\n      const |\\n      \\$)`));
    if (match) vm.runInContext(match[0], context);
  }
  return { state, context, run: code => vm.runInContext(code, context) };
}
const original = type => ({ id:'original', pageIndex:0, type, content:'Example', x:30, y:50, width:60, height:30, fontSize:18, color:'#1456a0', imageData:'data:image/png;base64,asset', vectorThicknessRatio:.04, vectorStrokes:[[{x:.1,y:.2},{x:.8,y:.9}]] });
for (const type of ['text','date','mark','image','signature','initials']) test(`duplicates ${type}, preserves appearance, isolates strokes and selection history`, () => {
  const {state,run} = setup(original(type));
  assert.equal(run('typeof duplicateSelected'), 'function');
  run('duplicateSelected()');
  assert.equal(state.overlays.length,2);
  const [first,copy] = state.overlays;
  assert.notEqual(copy.id,first.id);
  for(const key of ['pageIndex','type','content','width','height','fontSize','color','imageData','vectorThicknessRatio']) assert.equal(copy[key],first[key],key);
  assert.equal(JSON.stringify(copy.vectorStrokes),JSON.stringify(first.vectorStrokes));
  assert.notEqual(copy.vectorStrokes[0][0],first.vectorStrokes[0][0]);
  assert.notEqual(copy.x,first.x);
  assert.equal(state.selectedId,copy.id);
  run('undoEdit()'); assert.equal(state.overlays.length,1); assert.equal(state.selectedId,'original');
  run('redoEdit()'); assert.equal(state.overlays.length,2); assert.equal(state.selectedId,copy.id);
});
for(const rotation of [0,90,180,270]) test(`duplicate stays bounded at all edges, rotation ${rotation}`,()=>{
  for(const [x,y,width,height] of [[10,20,60,30],[150,290,60,30],[10,20,200,300]]) {
    const {state,run}=setup({...original('mark'),x,y,width,height},rotation);
    run('duplicateSelected()');
    const rect=run('viewportRectFromPdfRect(state.overlays[1])');
    assert.ok(rect.left>=0 && rect.top>=0);
    assert.ok(rect.left+rect.width<=state.viewport.width+.001 && rect.top+rect.height<=state.viewport.height+.001);
    assert.equal(state.overlays[1].width,width); assert.equal(state.overlays[1].height,height);
  }
});
test('empty, another page, exporting, and drag states are unchanged',()=>{
  for(const change of ['state.selectedId=null','state.page=2','state.exporting=true','state.drag={}']) {
    const {state,run}=setup(original('text')); run(change); run('duplicateSelected()');
    assert.equal(state.overlays.length,1); assert.equal(state.history.length,0);
  }
});
test('repeated copies have independent identity and a single history operation each',()=>{
  const {state,run}=setup(original('text')); run('duplicateSelected(); duplicateSelected()');
  assert.equal(new Set(state.overlays.map(x=>x.id)).size,3); assert.equal(state.history.length,2);
});
test('duplicate shortcut respects editable focus, modifiers, dialogs and selection',()=>{
  class Input {} class Textarea {} class Select {}
  const {state,context,run}=setup(original('text'));
  Object.assign(context,{HTMLInputElement:Input, HTMLTextAreaElement:Textarea, HTMLSelectElement:Select,
    helpDialog:{open:false},signatureDialog:{open:false},exportDialog:{open:false}, window:{addEventListener:(type,fn)=>context.keydown=fn}});
  const start=source.indexOf("      window.addEventListener('keydown', event => {",source.indexOf('function duplicateSelected'));
  const end=source.indexOf("      window.addEventListener('beforeunload'",start);
  vm.runInContext(source.slice(start,end),context);
  let prevented=0;
  const dispatch=(properties={})=>context.keydown({key:'d',ctrlKey:true,target:{},preventDefault:()=>prevented++,...properties});
  for(const target of [new Input(),new Textarea(),new Select(),{isContentEditable:true}]) dispatch({target});
  dispatch({shiftKey:true});dispatch({altKey:true});dispatch({ctrlKey:false});
  assert.equal(state.overlays.length,1);assert.equal(prevented,0);
  context.helpDialog.open=true;dispatch();context.helpDialog.open=false;
  context.document.querySelector=()=>({});dispatch();context.document.querySelector=()=>null;
  assert.equal(state.overlays.length,1);
  dispatch(); assert.equal(state.overlays.length,2);assert.equal(prevented,1);
  dispatch({ctrlKey:false,metaKey:true,key:'D'});assert.equal(state.overlays.length,3);assert.equal(prevented,2);
  state.selectedId=null;dispatch();assert.equal(prevented,2);
});
test('inspector duplicate action and bilingual labels are wired in the source',()=>{
  assert.match(source,/id="duplicateOverlayButton"[^>]*data-i18n="duplicateItem"/);
  assert.match(source,/\$\('#duplicateOverlayButton'\)\.addEventListener\('click', duplicateSelected\)/);
  assert.match(source,/duplicateItem: 'Duplicate selected item'/);
  assert.match(source,/duplicateItem: '選択項目を複製'/);
});
test('every source inline script is syntactically valid after build placeholders',()=>{
  const prepared=source.replace(/__(?:APP_CONFIG_JSON|BUILD_MANIFEST_JSON|EMBEDDED_ASSET_BUNDLE_JSON)__/g,'{}');
  for(const match of prepared.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
