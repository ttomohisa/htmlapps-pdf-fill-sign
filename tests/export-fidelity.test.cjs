'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/index.template.html'), 'utf8');
function functions(a,b) {
  const start=source.indexOf('      '+a);
  const end=source.indexOf('      '+b,start+1);
  assert.ok(start>=0 && end>start, 'Cannot isolate production code: '+a);
  return source.slice(start,end);
}
function contextForFields(field) {
  const calls=[];
  const ctx={
    font:'12px sans-serif', fillStyle:'', strokeStyle:'', lineWidth:1,
    scale(){}, fillRect(){calls.push({type:'fillRect'});}, strokeRect(){calls.push({type:'strokeRect'});},
    beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
    setLineDash(){}, measureText(text){return {width:Array.from(text).length*parseFloat(this.font)*.55};},
    fillText(text,x,y){calls.push({type:'fillText',text,x,y,font:this.font});}
  };
  const canvas={getContext:()=>ctx};
  const state={formValues:{id:field.value}, pdfjs:{}};
  const sandbox=vm.createContext({
    state, OVERLAY_FONT:'Arial, sans-serif',
    document:{createElement:kind=>{assert.equal(kind,'canvas');return canvas;}},
    canvasToImageBitmap:async()=>({close(){}}),
    currentFormValue:f=>f.value
  });
  for(const [a,b] of [
    ['function formFieldKind(', 'function isSupportedFormAnnotation('],
    ['function wrapExportText(', 'function colorToRgbBytes('],
    ['function formRectNormalized(', 'function cssColorFromArray('],
    ['function cssColorFromArray(', 'function formChoiceDisplay('],
    ['function formChoiceDisplay(', 'function layoutFlattenedFormText('],
    ['function layoutFlattenedFormText(', 'async function createFlattenFormAnnotations(']
  ])vm.runInContext(functions(a,b),sandbox);
  return {calls,run:()=>vm.runInContext('formFieldToBitmap(field)',Object.assign(sandbox,{field}))};
}
test('flattening fits all multiline text instead of silently omitting trailing lines',async()=>{
  const f={id:'id',fieldType:'Tx',multiLine:true,rect:[0,0,200,30],
    value:'One\nTwo\nThree\nFour\nFive\nSix',fontSize:12};
  const {calls,run}=contextForFields(f);
  await run();
  assert.deepEqual(calls.filter(x=>x.type==='fillText').map(x=>x.text),
    ['One','Two','Three','Four','Five','Six']);
});
test('unfittable input fails safely instead of exporting a partial value',async()=>{
  const f={id:'id',fieldType:'Tx',multiLine:true,rect:[0,0,24,12],
    value:'A'.repeat(800),fontSize:12};
  const {run}=contextForFields(f);
  await assert.rejects(run(),/FORM_TEXT_OVERFLOW/);
});
test('transparent PDF widgets are not repainted as opaque white rectangles',async()=>{
  const f={id:'id',fieldType:'Tx',rect:[0,0,110,25],value:'Hello',fontSize:12};
  const {calls,run}=contextForFields(f);
  await run();
  assert.equal(calls.filter(x=>x.type==='fillRect').length,0);
  assert.equal(calls.filter(x=>x.type==='strokeRect').length,0);
});
test('explicit widget colors preserve the requested background and border',async()=>{
  const f={id:'id',fieldType:'Tx',rect:[0,0,110,25],value:'Hello',
    backgroundColor:[220,225,230],borderColor:[35,40,45],fontSize:12};
  const {calls,run}=contextForFields(f);await run();
  assert.equal(calls.filter(x=>x.type==='fillRect').length,1);
  assert.equal(calls.filter(x=>x.type==='strokeRect').length,1);
});
test('short multiline and single-line Japanese text still fits without horizontal squeezing',async()=>{
  for(const value of ['東京都', 'ABC123']) {
    const f={id:'id',fieldType:'Tx',rect:[0,0,85,25],value,fontSize:14};
    const {calls,run}=contextForFields(f);
    await run();
    const drawn=calls.filter(x=>x.type==='fillText');
    assert.equal(drawn.length,1);
    assert.equal(drawn[0].text,value);
  }
});
test('small pages clamp new text and marks inside the displayed page',()=>{
  const state={viewport:{width:90,height:110},page:1,tool:'text',overlays:[],selectedId:null};
  let rect;
  const sandbox=vm.createContext({state,
    $:name=>name==='#overlayLayer'?{getBoundingClientRect:()=>({left:0,top:0})}:{focus(){},select(){}},
    translate:()=> 'Text',pdfRectFromViewportRect:r=>(rect=r,{x:r.left,y:r.top,width:r.width,height:r.height}),
    cloneEditState:()=>({}),newOverlayId:()=> 'id',pushHistory(){},setTool(){},
    renderOverlays(){},renderInspector(){},requestAnimationFrame(){},language:'en'
  });
  vm.runInContext(functions('function createOverlayAt(', 'function positionableSelection('),sandbox);
  vm.runInContext('createOverlayAt(45,55)',sandbox);
  assert.ok(rect.left>=0 && rect.top>=0);
  assert.ok(rect.left+rect.width<=90);
  assert.ok(rect.top+rect.height<=110);
});
test('the PDF ink representation respects edited mark font sizes',()=>{
  const viewport={
    scale:1,
    convertToViewportPoint:(x,y)=>[x,y],
    convertToPdfPoint:(x,y)=>[x,y]
  };
  const sandbox=vm.createContext({state:{pdfjs:{AnnotationEditorType:{INK:15}}},
    colorToRgbBytes:()=>[32,33,31],viewport,
  });
  vm.runInContext(functions('function createStraightInkLine(', 'function signatureToInkEntry('),sandbox);
  const item={pageIndex:0,type:'mark',content:'✓',x:10,y:20,width:38,height:38,color:'#20211f'};
  const low=vm.runInContext('markToInkEntry(item,viewport,0)',Object.assign(sandbox,{item:{...item,fontSize:8}}));
  const high=vm.runInContext('markToInkEntry(item,viewport,0)',Object.assign(sandbox,{item:{...item,fontSize:40}}));
  assert.notDeepEqual(Array.from(low.paths.points[0]),Array.from(high.paths.points[0]));
});
test('bitmap created before an overlay export error is released',async()=>{
  let closed=false, calls=0;
  const state={overlays:[{id:'a',pageIndex:0,type:'image',x:0,y:0,width:10,height:10},
                         {id:'b',pageIndex:0,type:'image',x:0,y:0,width:10,height:10}],
    pdf:{getPage:async()=>({rotate:0,getViewport:()=>({})})},pdfjs:{AnnotationEditorType:{STAMP:13}}};
  const sandbox=vm.createContext({state,PDFJS_EDITOR_PREFIX:'pdfjs_internal_editor_',
    overlayToBitmap:async()=>{if(++calls>1)throw Error('second bitmap failed');return{close(){closed=true;}};},
    textToFreeTextEntry(){},markToInkEntry(){},signatureToInkEntry(){}
  });
  vm.runInContext(functions('async function createExportAnnotations(','async function generateCompletedPdf('),sandbox);
  await assert.rejects(vm.runInContext('createExportAnnotations()',sandbox),/second bitmap failed/);
  assert.equal(closed,true);
});
test('a later flattening failure cleans successful overlay bitmaps and leaves fields intact',async()=>{
  let closed=false, setCalls=0;
  const storage={setValue(){setCalls++;},remove(){}};
  const state={pdf:{annotationStorage:storage},file:{name:'x.pdf'},generation:1};
  const sandbox=vm.createContext({state,
    ensureAllFormFieldsScanned:async()=>{},
    syncAllFormStorage(){},editStateSignature:()=> 'snapshot',
    createExportAnnotations:async()=>[{key:'overlay',value:{bitmap:{close(){closed=true;}}}}],
    createFlattenFormAnnotations:async()=>{throw Error('FORM_TEXT_OVERFLOW');},
    captureFormStorage(){throw Error('not reached')},applyFlattenFormFlags(){throw Error('not reached')},
    restoreFormStorage(){throw Error('not reached')},
    revokeExportResult(){throw Error('not reached')}
  });
  vm.runInContext(functions('async function generateCompletedPdf(','function setExportView('),sandbox);
  await assert.rejects(vm.runInContext('generateCompletedPdf("x.pdf",{flattenForms:true})',sandbox),/FORM_TEXT_OVERFLOW/);
  assert.equal(closed,true);assert.equal(setCalls,0);
});
test('digitally signed PDFs show a localized warning in the export dialog',()=>{
  assert.match(source,/typeof pdf\.getSignatures === 'function' \? await pdf\.getSignatures\(\)/);
  assert.match(source,/id="existingSignatureWarning"[^>]*data-i18n="existingSignatureWarning"/);
  assert.match(source,/\$\('#existingSignatureWarning'\)\.hidden = !state\.hasExistingSignatures/);
  assert.match(source,/existingSignatureWarning: 'このPDFにはデジタル署名が含まれています/);
  assert.match(source,/existingSignatureWarning: 'This PDF contains digital signatures/);
});
