// Optional Node export integration: build first; uses preinstalled @napi-rs/canvas
// and the cached pinned PDF.js legacy bundle for Node compatibility, not browser QA.
const fs=require('fs'), vm=require('vm'), assert=require('assert/strict');
const canvas=require('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
const root=require('path').resolve(__dirname,'..');
function fixture(rotation){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [10 20 410 620] /Rotate ${rotation} /Resources << >> /Contents 4 0 R >>`,'<< /Length 0 >>\nstream\n\nendstream'];let pdf='%PDF-1.7\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array(Buffer.from(pdf));}
(async()=>{
 const pdfjs=await import(root+'/.cache/pdfjs-dist-6.3.289/extracted/package/legacy/build/pdf.mjs');
 const source=fs.readFileSync(root+'/src/index.template.html','utf8');
 for(const rotation of [0,90,180,270]) {
 const pdf=await pdfjs.getDocument({data:fixture(rotation),isEvalSupported:false,standardFontDataUrl:root+'/.cache/pdfjs-dist-6.3.289/extracted/package/standard_fonts/'}).promise;
 const page=await pdf.getPage(1); const viewport=page.getViewport({scale:1});
 const state={pdf,pdfjs,page:1,viewport,overlays:[],history:[],future:[],formValues:{},formInitialValues:{}};
 const context=vm.createContext({state,PDFJS_EDITOR_PREFIX:'pdfjs_internal_editor_',crypto:require('crypto').webcrypto,requestAnimationFrame:()=>{},setTool:()=>{},renderOverlays:()=>{},renderInspector:()=>{},updateHistoryButtons:()=>{},updateSaveState:()=>{}});
 for(const name of ['cloneOverlayItem','cloneEditState','editStateSignature','pushHistory','commitMutation','selectedOverlay','newOverlayId','viewportRectFromPdfRect','pdfRectFromViewportRect','duplicateSelected','colorToRgbBytes','createStraightInkLine','createInkEntry','viewportRectFromPdfRectForExport','viewportPathToPdf','markToInkEntry','signatureToInkEntry','textToFreeTextEntry','createExportAnnotations']) {
 const match=source.match(new RegExp(`      (?:async )?function ${name}\\([^]*?(?=\\n      (?:async )?function |\\n      const |\\n      \\$)`)); if(!match)throw Error(name);vm.runInContext(match[0],context);
 }
 const cases=[['text','Copy text'],['date','2026-10-04'],['mark','✓'],['mark','×'],['mark','○'],['signature',''],['initials','']];
 for(let i=0;i<cases.length;i++){
 const [type,content]=cases[i];const item={id:`original-${i}`,pageIndex:0,type,content,x:30,y:60+i*55,width:80,height:30,color:'#1456a0',fontSize:12};if(type==='signature'||type==='initials'){item.vectorStrokes=[[{x:.1,y:.1},{x:.5,y:.8},{x:.9,y:.2}]];item.vectorThicknessRatio=.035;}state.overlays.push(item);state.selectedId=item.id;vm.runInContext('duplicateSelected()',context);
 }
 const entries=await vm.runInContext('createExportAnnotations()',context);assert.equal(entries.length,14);
 // Transfer VM-owned arrays into this realm as the browser application naturally would.
 for(const {key,value} of entries)pdf.annotationStorage.setValue(key,structuredClone(value));
 const bytes=await pdf.saveDocument();if(process.env.PDF_TEST_OUTPUT_DIR) fs.writeFileSync(require('path').join(process.env.PDF_TEST_OUTPUT_DIR,`fill-duplicate-${rotation}.pdf`),bytes);
 const reopened=await pdfjs.getDocument({data:bytes,isEvalSupported:false,standardFontDataUrl:root+'/.cache/pdfjs-dist-6.3.289/extracted/package/standard_fonts/'}).promise;const annotations=await(await reopened.getPage(1)).getAnnotations();
 assert.equal(annotations.length,14);assert.equal(annotations.filter(x=>x.subtype==='FreeText').length,4);assert.equal(annotations.filter(x=>x.subtype==='Ink').length,10);
 for(const content of ['Copy text','2026-10-04'])assert.equal(annotations.filter(x=>x.contentsObj?.str===content).length,2);
 console.log(`PASS rotation ${rotation}: original + duplicate for text/date/three marks/vector signature/initials, 14 saved/reopened annotations`);
 await reopened.cleanup();await pdf.cleanup();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
