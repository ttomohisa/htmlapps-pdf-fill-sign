const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(process.env.PDF_APP_SOURCE || path.join(__dirname, '../src/index.template.html'), 'utf8');
function load(context, names) {
  for (const name of names) {
    const match = source.match(new RegExp(`      (?:async )?function ${name}\\([^]*?(?=\\n      (?:async )?function |\\n      const |\\n      \\$)`));
    assert.ok(match, `source function ${name}`);
    vm.runInContext(match[0], context);
  }
}
const plain = value => JSON.parse(JSON.stringify(value));
const original = type => ({id:'original',pageIndex:0,type,content:'Example',x:43.375,y:71.625,width:67.25,height:28.375,fontSize:18,color:'#1456a0',imageData:'data:image/png;base64,asset',vectorThicknessRatio:.04,vectorStrokes:[[{x:.1,y:.2},{x:.8,y:.9}]]});
function viewport(rotation=0,scale=1,width=213.5,height=327.75,origin=[10.25,-23.5]) {
  const [ox,oy]=origin;
  const forward=(x,y)=>rotation===90?[y-oy,x-ox]:rotation===180?[ox+width-x,y-oy]:rotation===270?[oy+height-y,ox+width-x]:[x-ox,oy+height-y];
  const inverse=(x,y)=>rotation===90?[y+ox,x+oy]:rotation===180?[ox+width-x,y+oy]:rotation===270?[ox+width-y,oy+height-x]:[x+ox,oy+height-y];
  return {width:(rotation%180?height:width)*scale,height:(rotation%180?width:height)*scale,
    convertToViewportPoint:(x,y)=>forward(x,y).map(n=>n*scale),convertToPdfPoint:(x,y)=>inverse(x/scale,y/scale)};
}
function setup({type='text',rotation=0,scale=1}={}) {
  const item=original(type), state={pdf:{numPages:2},page:1,scale,generation:1,viewport:viewport(rotation,scale),overlays:[item],selectedId:item.id,formValues:{},formInitialValues:{},history:[],future:[],pageBusy:false};
  const nodes=new Map();let context, id=0;
  const node=id=>{
    if(!nodes.has(id)) nodes.set(id,{value:'',hidden:false,disabled:false,style:{},listeners:{},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this.listeners[type]=fn;},focus(){context.document.activeElement=this;},querySelectorAll(){return[];},setAttribute(){}});
    return nodes.get(id);
  };
  context=vm.createContext({state,crypto:{randomUUID:()=>`copy-${++id}`},requestAnimationFrame:fn=>fn(),document:{querySelector:()=>null,activeElement:null},CSS:{escape:x=>x},$:node,
    setTool:()=>{},renderOverlays:()=>{},renderInspector:()=>{},renderFormLayer:()=>{},syncAllFormStorage:()=>{},updateRequiredWarning:()=>{},updateHistoryButtons:()=>{},updateSaveState:()=>{},updateMobileUi:()=>{},translate:x=>x,overlayTypeLabel:x=>x.type,
    AppToast:{show(){}},renderCurrentPage:async()=>{state.viewport=viewport(90,.65,781,432);},setScale:scale=>{state.scale=scale;}});
  load(context,['sameFormValue','cloneFormValue','cloneOverlayItem','cloneEditState','editStateSignature','pushHistory','restoreEditState','commitMutation','undoEdit','redoEdit','selectedOverlay','positionableSelection','newOverlayId','viewportRectFromPdfRect','pdfRectFromViewportRect','duplicateSelected','moveSelectedBy','deleteSelected','goPage']);
  return {state,context,node,run:code=>vm.runInContext(code,context)};
}
function centerSetup(options) {
  const app=setup(options);
  load(app.context,['positionableSelection','centerSelected','updatePositionButtons']);
  return app;
}
function keys(context) {
  Object.assign(context,{HTMLInputElement:class Input{},HTMLTextAreaElement:class Textarea{},HTMLSelectElement:class Select{},helpDialog:{open:false},signatureDialog:{open:false},exportDialog:{open:false},window:{addEventListener:(type,fn)=>context.keydown=fn}});
  const start=source.indexOf("      window.addEventListener('keydown', event => {",source.indexOf('function duplicateSelected'));
  const end=source.indexOf("      window.addEventListener('beforeunload'",start);
  vm.runInContext(source.slice(start,end),context);
}
function event(properties={}) {return {key:'ArrowRight',target:{},defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...properties};}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

test('cross-page Undo/Redo never restores a hidden selection or navigates away',async()=>{
  const {state,run}=setup();run('duplicateSelected()');await run('goPage(2)');run('undoEdit()');
  assert.equal(state.page,2);assert.equal(state.selectedId,null);assert.equal(state.overlays.length,1);
  const before=plain(state.overlays);run('moveSelectedBy(1,0)');assert.deepEqual(plain(state.overlays),before);
  run('redoEdit()');assert.equal(state.page,2);assert.equal(state.selectedId,null);assert.equal(state.overlays.length,2);
});
test('movement rejects stale selection on an asymmetrically sized other page',()=>{
  const {state,run}=setup();state.page=2;state.viewport=viewport(90,.65,781,432);const before=plain(state.overlays);
  run('moveSelectedBy(1,0)');assert.deepEqual(plain(state.overlays),before);assert.equal(state.history.length,0);
});
test('toolbar arrows change focus without nudging an item or changing the page',()=>{
  for(const selected of [true,false]) {
    const {state,context,node}=setup();keys(context);if(!selected) state.selectedId=null;
    const buttons=[{focus(){context.document.activeElement=this;}},{focus(){context.document.activeElement=this;}}];
    node('#editToolbar').querySelectorAll=()=>buttons;context.document.activeElement=buttons[0];
    const start=source.indexOf("      $('#editToolbar').addEventListener('keydown'");
    const end=source.indexOf("      $('#mobileActionBar').addEventListener('click'",start);
    vm.runInContext(source.slice(start,end),context);
    const before=plain(state.overlays),e=event({target:buttons[0]});node('#editToolbar').listeners.keydown(e);
    if(!e.stopped)context.keydown(e);
    assert.equal(context.document.activeElement,buttons[1]);assert.deepEqual(plain(state.overlays),before);assert.equal(state.page,1);assert.equal(state.history.length,0);
  }
});
test('any open dialog and consumed key event block all global edit/navigation shortcuts',()=>{
  for(const blocked of ['dialog','consumed']) for(const properties of [{key:'z',ctrlKey:true},{key:'z',ctrlKey:true,shiftKey:true},{key:'y',metaKey:true},{key:'d',ctrlKey:true},{key:'Delete'},{key:'ArrowRight'},{key:'PageDown'},{key:'+',ctrlKey:true}]) {
    const {state,context,run}=setup();run('duplicateSelected()');keys(context);
    if(blocked==='dialog')context.document.querySelector=()=>({open:true});
    const before=plain(state);context.keydown(event({...properties,defaultPrevented:blocked==='consumed'}));assert.deepEqual(plain(state),before);
  }
});
test('interactive controls keep unmodified keys while explicit shortcuts and ordinary editor keys work',()=>{
  for(const key of ['ArrowRight','ArrowUp','PageDown','Delete','Backspace','Escape']) {
    const {state,context}=setup();keys(context);const before=plain(state);
    context.keydown(event({key,target:{closest:()=>({tagName:'BUTTON'})}}));assert.deepEqual(plain(state),before);
  }
  const {state,context,run}=setup();keys(context);
  context.keydown(event({key:'d',ctrlKey:true,target:{closest:()=>({tagName:'BUTTON'})}}));assert.equal(state.overlays.length,2);
  context.keydown(event({key:'z',ctrlKey:true}));assert.equal(state.overlays.length,1);
  context.keydown(event({key:'y',metaKey:true}));assert.equal(state.overlays.length,2);
  const x=state.overlays[1].x;context.keydown(event());near(state.overlays[1].x,x+1);
  for(const target of [new context.HTMLInputElement(),new context.HTMLTextAreaElement(),new context.HTMLSelectElement(),{isContentEditable:true}]) {
    const before=plain(state);context.keydown(event({key:'z',ctrlKey:true,target}));assert.deepEqual(plain(state),before);
  }
  state.selectedId=null;context.keydown(event({key:'PageDown'}));assert.equal(state.page,2);
});
for(const rotation of [0,90,180,270]) for(const scale of [.25,.73,1,2.65]) test(`centers each displayed axis without changing dimensions at rotation ${rotation}, zoom ${scale}`,()=>{
  for(const axis of ['horizontal','vertical']) {
    const {state,run}=centerSetup({rotation,scale});const before=plain(state.overlays[0]);const rectBefore=run('viewportRectFromPdfRect(state.overlays[0])');
    run(`centerSelected('${axis}')`);const after=state.overlays[0],rect=run('viewportRectFromPdfRect(state.overlays[0])');
    near(axis==='horizontal'?rect.left+rect.width/2:rect.top+rect.height/2,axis==='horizontal'?state.viewport.width/2:state.viewport.height/2);
    near(axis==='horizontal'?rect.top:rect.left,axis==='horizontal'?rectBefore.top:rectBefore.left);
    const preserved=item=>{const {x,y,...rest}=item;return rest;};assert.deepEqual(plain(preserved(after)),preserved(before));
    assert.equal(state.history.length,1);const centered=plain(after);run(`centerSelected('${axis}');centerSelected('${axis}')`);assert.equal(state.history.length,1);assert.deepEqual(plain(state.overlays[0]),centered);
    run('undoEdit()');assert.deepEqual(plain(state.overlays[0]),before);assert.equal(state.selectedId,before.id);
    run('redoEdit()');assert.deepEqual(plain(state.overlays[0]),centered);assert.equal(state.selectedId,before.id);
  }
});
for(const type of ['text','date','mark','image','signature','initials']) test(`centering preserves ${type}, assets, strokes, identity and form values`,()=>{
  const {state,run}=centerSetup({type,rotation:270,scale:1.13});state.formInitialValues={field:'old'};state.formValues={field:'filled'};const before=plain(state.overlays[0]);const strokes=state.overlays[0].vectorStrokes;
  run("centerSelected('horizontal');centerSelected('vertical')");const {x,y,...rest}=plain(state.overlays[0]);delete before.x;delete before.y;assert.deepEqual(rest,before);assert.equal(state.overlays[0].vectorStrokes,strokes);assert.deepEqual(plain(state.formValues),{field:'filled'});assert.equal(state.history.length,2);
});
test('position controls reject empty, form-only, off-page and busy selections',()=>{
  for(const change of ['state.selectedId=null','state.selectedId="pdf-form-field"','state.page=2','state.pdf=null','state.viewport=null','state.pageBusy=true','state.opening=true','state.renderTask={}','state.exporting=true','state.drag={}']) {
    const {state,node,run}=centerSetup();run(change);const before=plain(state.overlays);run("centerSelected('horizontal');centerSelected('vertical');updatePositionButtons();moveSelectedBy(1,0)");
    assert.deepEqual(plain(state.overlays),before);assert.equal(state.history.length,0);assert.equal(node('#centerHorizontalButton').disabled,true);assert.equal(node('#centerVerticalButton').disabled,true);
  }
});
test('oversized axes disable independently without resizing or clamping the other axis',()=>{
  for(const rotation of [0,90,180,270]) for(const dimension of ['width','height']) {
    const {state,node,run}=centerSetup({rotation});state.overlays[0][dimension]=900;const before=plain(state.overlays[0]);run('updatePositionButtons()');
    const horizontal=(dimension==='width')===(rotation%180===0),blocked=horizontal?'horizontal':'vertical',allowed=horizontal?'vertical':'horizontal';
    assert.equal(node(horizontal?'#centerHorizontalButton':'#centerVerticalButton').disabled,true);assert.equal(node(horizontal?'#centerVerticalButton':'#centerHorizontalButton').disabled,false);
    run(`centerSelected('${blocked}')`);assert.deepEqual(plain(state.overlays[0]),before);assert.equal(state.history.length,0);
    run(`centerSelected('${allowed}')`);assert.equal(state.overlays[0].width,before.width);assert.equal(state.overlays[0].height,before.height);assert.equal(state.history.length,1);
  }
});
test('page-sized, already centered, and invalid-axis actions do not add history or clear redo',()=>{
  const {state,run}=centerSetup();state.overlays[0]={...original('image'),x:10.25,y:-23.5,width:213.5,height:327.75};state.future=[{marker:'preserve'}];
  run("centerSelected('horizontal');centerSelected('vertical');centerSelected('diagonal')");assert.equal(state.history.length,0);assert.deepEqual(plain(state.future),[{marker:'preserve'}]);
});
test('loading, export and dragging refresh actual disabled inspector buttons',()=>{
  const {state,node,context,run}=centerSetup();load(context,['renderInspector','showStage','hideStage','setExportView','beginOverlayPointer','finishOverlayPointer']);
  run('renderInspector()');assert.equal(node('#centerHorizontalButton').disabled,false);
  run("showStage('Loading')");assert.equal(node('#centerHorizontalButton').disabled,true);
  run('hideStage()');assert.equal(node('#centerHorizontalButton').disabled,false);
  state.exporting=true;run("setExportView('progress')");assert.equal(node('#centerHorizontalButton').disabled,true);
  state.exporting=false;run("setExportView('setup')");assert.equal(node('#centerHorizontalButton').disabled,false);
  context.pointer=event({pointerId:1,clientX:10,clientY:20});context.element=node('overlay');run("beginOverlayPointer(pointer,element,state.overlays[0],'move')");assert.equal(node('#centerHorizontalButton').disabled,true);
  run('finishOverlayPointer(pointer)');assert.equal(node('#centerHorizontalButton').disabled,false);
  state.page=2;run('renderInspector()');assert.equal(node('#inspectorSelection').hidden,true);
});
test('bilingual buttons, help and click handlers are present without a new hotkey',()=>{
  for(const [id,label,axis] of [['centerHorizontalButton','centerHorizontal','horizontal'],['centerVerticalButton','centerVertical','vertical']]) {
    assert.match(source,new RegExp(`id="${id}"[^>]*data-i18n="${label}"[^>]*disabled`));
    assert.ok(source.includes(`$('#${id}').addEventListener('click', () => centerSelected('${axis}'))`));
  }
  assert.match(source,/centerHorizontal: '左右中央に配置'/);assert.match(source,/centerVertical: '上下中央に配置'/);
  assert.match(source,/centerHorizontal: 'Center horizontally'/);assert.match(source,/centerVertical: 'Center vertically'/);
  assert.match(source,/data-i18n="helpCentering"/);
});
test('shifted page-sized axes tolerate transform noise at fractional zoom and all rotations',()=>{
  for(const rotation of [0,90,180,270]) for(const scale of [.25,.73,1.13,2.65]) {
    const {state,node,run}=centerSetup({rotation,scale});state.overlays[0]={...original('image'),x:10.25,y:71.625,width:213.5,height:327.75};
    run('updatePositionButtons()');assert.equal(node('#centerHorizontalButton').disabled,false);assert.equal(node('#centerVerticalButton').disabled,false);
    run("centerSelected('horizontal');centerSelected('vertical')");near(state.overlays[0].x,10.25);near(state.overlays[0].y,-23.5);assert.equal(state.overlays[0].width,213.5);assert.equal(state.overlays[0].height,327.75);assert.equal(state.history.length,1);
  }
});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const phase of ['getPage','fit','render','forms']) for(const order of [[3,2],[2,3]]) test(`latest page owns ready geometry across ${phase} completion order ${order}`,async()=>{
  const {state,context,node,run}=centerSetup();state.renderRequestId=0;state.fit=phase==='fit';const gates={2:deferred(),3:deferred()};
  const widths={2:300,3:700};
  state.pdf={numPages:3,getPage:async number=>{
    if(phase==='getPage')await gates[number].promise;
    return {number,getViewport:({scale})=>viewport(0,scale,widths[number],400,[0,0]),render:()=>({promise:phase==='render'?gates[number].promise:Promise.resolve(),cancel(){}})};
  }};
  Object.assign(context,{window:{devicePixelRatio:1},computeFitScale:async page=>{if(phase==='fit')await gates[page.number].promise;return 1;},updateMeta:()=>{},updateThumbnailSelection:()=>{},ensurePageFormFields:async index=>{if(phase==='forms')await gates[index+1].promise;},focusPendingFormField:()=>{},classifyOpenError:()=> 'invalid'});
  node('#pdfCanvas').getContext=()=>({});load(context,['showStage','hideStage','renderCurrentPage']);
  const renders={2:run('goPage(2)')};await tick();renders[3]=run('goPage(3)');await tick();state.overlays[0].pageIndex=2;state.selectedId='original';
  gates[order[0]].resolve();await renders[order[0]];
  if(order[0]===2){run('updatePositionButtons()');assert.equal(node('#centerHorizontalButton').disabled,true);assert.equal(state.pageBusy,true);}
  gates[order[1]].resolve();await renders[order[1]];
  assert.equal(state.page,3);assert.equal(state.viewport.width,700);assert.equal(state.pageBusy,false);assert.equal(state.renderTask,null);
  run("centerSelected('horizontal')");near(state.overlays[0].x,(700-state.overlays[0].width)/2);
});
test('replacement loading keeps positioning disabled after an older render finishes and recovers on load failure',async()=>{
  const {state,context,node,run}=centerSetup();state.openRequestId=0;const runtime=deferred();
  Object.assign(context,{MAX_BYTES:100*1024*1024,hasUnsavedChanges:()=>false,ensurePdfJs:()=>runtime.promise,classifyOpenError:()=> 'invalid',console:{error(){}},file:{name:'replacement.pdf',type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(0)}});
  load(context,['showStage','hideStage','openFile']);const opening=run('openFile(file)');assert.equal(state.opening,true);assert.equal(node('#centerHorizontalButton').disabled,true);
  run('hideStage()');assert.equal(state.pageBusy,false);assert.equal(node('#centerHorizontalButton').disabled,true);
  runtime.resolve({getDocument:()=>({promise:Promise.reject(new Error('invalid fixture'))})});await opening;
  assert.equal(state.opening,false);assert.equal(node('#centerHorizontalButton').disabled,false);assert.equal(state.overlays.length,1);
});
