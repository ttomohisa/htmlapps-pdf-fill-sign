'use strict';
// Native Chromium checks run only in the existing unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const PHONE_WIDTH = 640;
const HELP = "#helpButton", LANGUAGE = "#languageButton", CLOSE = "#closeHelpButton";
const artifacts = path.resolve('test-results/mobile-layout');

function syntheticPdf() {
  const stream = '0.09 0.38 0.31 rg 30 30 140 60 re f\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 240] /Resources << >> /Contents 4 0 R >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
  let data = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((value, index) => { offsets.push(Buffer.byteLength(data)); data += `${index + 1} 0 obj\n${value}\nendobj\n`; });
  const xref = Buffer.byteLength(data);
  data += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10,'0') + ' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}

function syntheticAcroFormPdf() {
  const content = '0.09 0.38 0.31 rg 20 25 120 35 re f\n';
  const blank = 'q 1 w 0 0 0 RG 1 1 18 18 re S Q\n';
  const checked = 'q 1 w 0 0 0 RG 1 1 18 18 re S 2 10 m 8 4 l 17 16 l S Q\n';
  const streamObject = data => '<< /Length ' + Buffer.byteLength(data) + ' >>\nstream\n' + data + 'endstream';
  const appearanceObject = data => '<< /Type /XObject /Subtype /Form /FormType 1 /BBox [0 0 20 20] /Resources << >> /Length ' + Buffer.byteLength(data) + ' >>\nstream\n' + data + 'endstream';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 240] /Resources << /Font << /Helv 10 0 R >> >> /Contents 4 0 R /Annots [6 0 R 7 0 R] >>',
    streamObject(content),
    '<< /Fields [6 0 R 7 0 R] /DA (/Helv 12 Tf 0 g) /DR << /Font << /Helv 10 0 R >> >> /NeedAppearances true >>',
    '<< /Type /Annot /Subtype /Widget /FT /Tx /T (customer) /Rect [20 170 180 196] /V (Original) /DA (/Helv 12 Tf 0 g) /P 3 0 R /F 4 >>',
    '<< /Type /Annot /Subtype /Widget /FT /Btn /T (agreed) /Rect [20 120 40 140] /V /Off /AS /Off /P 3 0 R /F 4 /AP << /N << /Off 8 0 R /Yes 9 0 R >> >> >>',
    appearanceObject(blank), appearanceObject(checked),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let data = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((value, index) => {
    offsets.push(Buffer.byteLength(data));
    data += (index + 1) + ' 0 obj\n' + value + '\nendobj\n';
  });
  const xref = Buffer.byteLength(data);
  data += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' +
    offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(data);
}

async function exerciseAcroFormRoundTrip(page, label, errors) {
  const fixture = syntheticAcroFormPdf();
  await page.locator('#fileInput').setInputFiles({name:'fillable.pdf',mimeType:'application/pdf',buffer:fixture});
  const textField = page.locator('#formLayer input[type="text"]');
  const checkField = page.locator('#formLayer input[type="checkbox"]');
  await textField.waitFor({state:'visible',timeout:15000});
  await checkField.waitFor({state:'visible',timeout:15000});
  assert.equal(await textField.inputValue(),'Original',label+': AcroForm initial value loaded');
  await textField.fill('Edited QA field');
  await checkField.check();
  await page.locator('#exportPdfButton').click();
  assert.equal(await page.locator('#flattenFormsRow').isVisible(),true,label+': flattening offered for AcroForm');
  await page.locator('#flattenFormsCheckbox').uncheck();
  await page.locator('#exportCreateButton').click();
  await page.waitForFunction(() => !document.querySelector('#exportResult').hidden ||
    !document.querySelector('#exportError').hidden,null,{timeout:30000});
  if (await page.locator('#exportError').isVisible())
    throw new Error(label+': AcroForm editable PDF export failed: '+await page.locator('#exportErrorMessage').innerText()+
      '; browser errors='+JSON.stringify(errors));
  const pending=page.waitForEvent('download');
  await page.locator('#exportDownloadButton').click();
  const output=fs.readFileSync(await (await pending).path());
  assert.equal(output.subarray(0,5).toString('latin1'),'%PDF-',label+': AcroForm output PDF');
  await page.locator('#exportCloseButton').click();
  await page.locator('#fileInput').setInputFiles({name:'reopened-form.pdf',mimeType:'application/pdf',buffer:output});
  await page.waitForFunction(()=>document.querySelector('#fileName')?.textContent==='reopened-form.pdf' &&
    !document.querySelector('#stageMessage')?.classList.contains('show'));
  await textField.waitFor({state:'visible'});
  await checkField.waitFor({state:'visible'});
  assert.equal(await textField.inputValue(),'Edited QA field',label+': AcroForm value survives editable export');
  assert.equal(await checkField.isChecked(),true,label+': checkbox value survives editable export');

  // The default flatten option should preserve visible values while
  // disabling the original widget fields in the newly saved PDF.
  await page.locator('#exportPdfButton').click();
  assert.equal(await page.locator('#flattenFormsCheckbox').isChecked(),true,label+': flatten ON by default');
  await page.locator('#exportCreateButton').click();
  await page.waitForFunction(() => !document.querySelector('#exportResult').hidden ||
    !document.querySelector('#exportError').hidden,null,{timeout:30000});
  if (await page.locator('#exportError').isVisible())
    throw new Error(label+': flattened AcroForm export failed: '+await page.locator('#exportErrorMessage').innerText()+
      '; browser errors='+JSON.stringify(errors));
  const flattenPending=page.waitForEvent('download');
  await page.locator('#exportDownloadButton').click();
  const flattened=fs.readFileSync(await (await flattenPending).path());
  assert.equal(flattened.subarray(0,5).toString('latin1'),'%PDF-',label+': flattened PDF header');
  await page.locator('#exportCloseButton').click();
  await page.locator('#fileInput').setInputFiles({name:'flattened-form.pdf',mimeType:'application/pdf',buffer:flattened});
  await page.waitForFunction(()=>document.querySelector('#fileName')?.textContent==='flattened-form.pdf' &&
    !document.querySelector('#stageMessage')?.classList.contains('show'));
  // Saving a visually flattened PDF should not leave editable form controls.
  assert.equal(await page.locator('#formLayer [data-form-control="true"]').count(),0,
    label+': flattened PDF does not show editable original fields');
  const inkPixels=await page.locator('#pdfCanvas').evaluate(canvas=>{
    const ctx=canvas.getContext('2d');
    const scale=canvas.width/200;
    const x=Math.max(0,Math.floor(20*scale)), y=Math.max(0,Math.floor(44*scale));
    const w=Math.min(canvas.width-x,Math.floor(160*scale)), h=Math.min(canvas.height-y,Math.floor(26*scale));
    const data=ctx.getImageData(x,y,w,h).data;
    let visible=0;
    for(let i=0;i<data.length;i+=4)if(data[i]<205&&data[i+1]<205&&data[i+2]<205)visible+=1;
    return visible;
  });
  assert.ok(inkPixels>15,label+': flattened field appearance is painted in the exported PDF ('+inkPixels+')');
}

function isPhone(width, height) { return width <= PHONE_WIDTH || (width <= 900 && height <= 500 && width >= height); }
async function checkActions(page, width, height, label) {
  const nav = page.locator('#mobileActionBar');
  assert.equal(await nav.locator('button').count(), 4, label + ': functional actions retained');
  assert.equal(await nav.isVisible(), isPhone(width, height), label + ': functional bar breakpoint');
  if (isPhone(width, height)) {
    const box = await nav.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, label + ': action bar stays inside viewport');
  }
}
async function exerciseActions(page, width, height, label) {
  await page.locator('#fileInput').setInputFiles({name:'synthetic.pdf', mimeType:'application/pdf', buffer:syntheticPdf()});
  await page.locator('#viewer').waitFor();
  // A visible viewer/default canvas can precede parsing; wait for the fixture's green shape.
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#pdfCanvas');
    if (!canvas || canvas.width <= 1 || canvas.height <= 1) return false;
    const pixel = canvas.getContext('2d').getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height * .75), 1, 1).data;
    return document.querySelector('#fileName').textContent === 'synthetic.pdf' && pixel[3] === 255 && pixel[1] > pixel[0] + 20;
  });
  if (isPhone(width, height)) {
    assert.equal(await page.locator('#mobileSaveButton').isEnabled(), true, label + ': Save enabled');
    assert.equal(await page.locator('#mobileEditButton').isDisabled(), true, label + ': no selected item');
    await page.locator('#mobilePagesButton').click();
    assert.match(await page.locator('#mobilePagesButton').getAttribute('class'), /is-active/);
    await page.locator('#mobileToolsButton').click();
  }
  await checkActions(page, width, height, label);
}

// Exercise the actual embedded PDF.js save and reopen path, not just DOM source guards.
async function exerciseExportRoundTrip(page,label,errors) {
  await page.locator('.pdf-tool-button[data-tool="text"]').first().click();
  await page.locator('#overlayLayer').click({position:{x:60,y:75}});
  await page.locator('#contentInput').fill('Round-trip PDF QA');
  await page.locator('#exportPdfButton').click();
  await page.locator('#exportCreateButton').click();
  await page.waitForFunction(() => !document.querySelector('#exportResult').hidden ||
    !document.querySelector('#exportError').hidden, null, {timeout:30000});
  if (await page.locator('#exportError').isVisible()) {
    throw new Error('PDF creation failed: ' + await page.locator('#exportErrorMessage').innerText() +
      '; console errors: ' + JSON.stringify(errors));
  }
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportDownloadButton').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(),/\.pdf$/i,label+': expected PDF download');
  const output = fs.readFileSync(await download.path());
  assert.equal(output.subarray(0,5).toString('latin1'),'%PDF-',label+': PDF file header');
  assert.ok(output.length>syntheticPdf().length,label+': output contains added content');
  await page.locator('#exportCloseButton').click();
  await page.locator('#fileInput').setInputFiles({
    name:'round-trip.pdf',mimeType:'application/pdf',buffer:output
  });
  await page.waitForFunction(()=>document.querySelector('#fileName')?.textContent==='round-trip.pdf' &&
    !document.querySelector('#stageMessage')?.classList.contains('show'));
  assert.equal((await page.locator('#fileName').textContent()).trim(),'round-trip.pdf',label+': exported PDF reopens');
}

// Check rendered geometry, including clipping by an ancestor (isVisible alone misses it).

async function exerciseVisualAnnotationsRoundTrip(page,label,errors) {
  await page.locator('#fileInput').setInputFiles({name:'media.pdf',mimeType:'application/pdf',buffer:syntheticPdf()});
  await page.waitForFunction(()=>document.querySelector('#fileName')?.textContent==='media.pdf' &&
    !document.querySelector('#stageMessage')?.classList.contains('show'));
  const inkCount=()=>page.locator('#pdfCanvas').evaluate(canvas=>{
    const ctx=canvas.getContext('2d');
    const height=Math.floor(canvas.height*.53);
    const pixels=ctx.getImageData(0,0,canvas.width,height).data;
    let dark=0;
    for(let i=0;i<pixels.length;i+=4)
      if(pixels[i]<195 && pixels[i+1]<195 && pixels[i+2]<195)dark++;
    return dark;
  });
  const before=await inkCount();
  await page.locator('.pdf-tool-button[data-tool="check"]').click();
  await page.locator('#overlayLayer').click({position:{x:55,y:75}});
  await page.locator('#signatureButton').click();
  const canvas=page.locator('#signatureCanvas');
  await canvas.waitFor({state:'visible'});
  const area=await canvas.boundingBox();
  assert.ok(area&&area.width>100&&area.height>50,label+': signature pad visible');
  await page.mouse.move(area.x+area.width*.2,area.y+area.height*.6);
  await page.mouse.down();
  await page.mouse.move(area.x+area.width*.5,area.y+area.height*.3,{steps:8});
  await page.mouse.move(area.x+area.width*.8,area.y+area.height*.6,{steps:8});
  await page.mouse.up();
  assert.equal(await page.locator('#signatureUseButton').isEnabled(),true,label+': drawn signature can be used');
  await page.locator('#signatureUseButton').click();
  const image=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');
    canvas.width=24;canvas.height=24;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#142baa';ctx.fillRect(2,2,20,20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#imageInput').setInputFiles({name:'stamp.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await page.waitForFunction(()=>document.querySelectorAll('#overlayLayer .pdf-overlay-item').length===3);
  await page.locator('#exportPdfButton').click();
  await page.locator('#exportCreateButton').click();
  await page.waitForFunction(()=>!document.querySelector('#exportResult').hidden ||
    !document.querySelector('#exportError').hidden,null,{timeout:30000});
  if(await page.locator('#exportError').isVisible())
    throw new Error(label+': mark/signature/image export failed: '+await page.locator('#exportErrorMessage').innerText()+
      '; browser errors='+JSON.stringify(errors));
  const pending=page.waitForEvent('download');
  await page.locator('#exportDownloadButton').click();
  const output=fs.readFileSync(await (await pending).path());
  assert.equal(output.subarray(0,5).toString('latin1'),'%PDF-',label+': visual annotation PDF header');
  await page.locator('#exportCloseButton').click();
  await page.locator('#fileInput').setInputFiles({name:'annotations.pdf',mimeType:'application/pdf',buffer:output});
  await page.waitForFunction(()=>document.querySelector('#fileName')?.textContent==='annotations.pdf' &&
    !document.querySelector('#stageMessage')?.classList.contains('show'));
  const after=await inkCount();
  assert.ok(after>before+60,label+': saved PDF visibly contains new annotations ('+before+' -> '+after+')');
}

async function auditHeader(page, label) {
  const badge = page.locator('header #versionBadge');
  assert.equal(await badge.textContent(), 'v' + require('../app.config.json').version, label + ': current header version');
  assert.equal(await badge.isVisible(), true, label + ': version visible');
  const clipped = await badge.evaluate(el => {
    const r = el.getBoundingClientRect(), problems = [];
    if (r.width <= 0 || r.height <= 0 || r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) problems.push('outside viewport');
    if (el.scrollWidth > el.clientWidth + 1) problems.push('version text clipped');
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p), b = p.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(s.overflowX) && (r.left < b.left - 1 || r.right > b.right + 1)) problems.push('ancestor clips x: ' + p.className);
      if (/hidden|clip|auto|scroll/.test(s.overflowY) && (r.top < b.top - 1 || r.bottom > b.bottom + 1)) problems.push('ancestor clips y: ' + p.className);
    }
    return problems;
  });
  assert.deepEqual(clipped, [], label + ': complete header version remains readable');
  const help = page.locator('#helpButton svg');
  assert.equal(await help.isVisible(), true, label + ': Help icon visible');
  assert.ok(await help.evaluate(svg => {
    const paths = [...svg.querySelectorAll('path')], shape = paths.map(p => p.getAttribute('d')).join(' ');
    return /[aAcC]/.test(shape) && paths.some(p => /[hH]\.01/.test(p.getAttribute('d')) && getComputedStyle(p).strokeLinecap === 'round') && svg.getBBox().width > 0;
  }), label + ': question-mark curve and painted dot, not information icon');
  const shield = page.locator('.local-badge svg');
  if (await shield.count()) {
    assert.ok(await shield.evaluate(svg => [...svg.querySelectorAll('path')].some(p => /^M12 3 5 6/.test(p.getAttribute('d')))), label + ': local-processing shield');
  }
}

async function main() {
  fs.mkdirSync(artifacts, {recursive:true});
  const browser = await chromium.launch();
  try {
    const cases = [];
    for (const language of ['ja', 'en']) {
      for (const [width, height] of [[1360,900], [PHONE_WIDTH + 1,568], [PHONE_WIDTH,568], [320,568], [360,640], [390,844], [393,252]]) cases.push({file:'dist/index.html', language, width, height});
    }
    // Preserve the app's separate landscape-phone width and height boundaries.
    for (const [width,height] of [[900,500],[901,500],[900,501]]) cases.push({file:'dist/index.html',language:'en',width,height});
    // Also load the compressed and root download variants, without duplicating the full matrix.
    cases.push({file:'dist/index.self-extract.html', language:'en', width:360, height:640});
    cases.push({file:'pdf-fill-sign.html', language:'ja', width:1360, height:900});
    for (const {file, language, width, height} of cases) {
      const context = await browser.newContext({viewport:{width,height}, locale:language, reducedMotion:'reduce'});
      const page = await context.newPage();
      const errors = [], requests = [];
      const label = `${file} ${language} ${width}x${height}`;
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      try {
        await page.goto(pathToFileURL(path.resolve(file)).href);
        await page.locator(HELP).waitFor();
        if (await page.locator('html').getAttribute('lang') !== language) await page.locator(LANGUAGE).click();
        assert.equal((await page.locator('[data-i18n="localBadge"]').textContent()).trim(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label + ': privacy wording');
        assert.equal(await page.locator('body > footer').isVisible(), !isPhone(width, height), label + ': informational footer breakpoint');
        const badge = page.locator('.local-badge');
        assert.equal(await badge.isVisible(), !isPhone(width, height), label + ': privacy badge only on desktop');
        const hero = page.locator('.page-intro');
        const heroHeading = page.locator('#heroTitle');
        const heroDescription = page.locator('.page-intro [data-i18n="lead"]');
        assert.equal(await hero.isVisible(), true, label + ': intro description remains available');
        assert.equal(await heroHeading.isVisible(), !isPhone(width, height), label + ': hide hero heading on phones');
        assert.equal(await heroDescription.isVisible(), true, label + ': keep short description visible before opening a PDF');
        assert.equal(await page.locator('.app-header').evaluate(el => getComputedStyle(el).position),
          isPhone(width, height) ? 'static' : 'sticky', label + ': header position before PDF loading');
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('pdf-has-document')), false,
          label + ': introductory state before PDF loading');
        assert.notEqual((await page.locator('#heroTitle').textContent()).trim(),
          (await page.locator('#brandName').textContent()).trim(), label + ': distinct hero and header titles');
        const lead = (await page.locator('.page-intro [data-i18n="lead"]').textContent()).trim();
        assert.ok(lead.length < 90, label + ': compact intro');
        assert.doesNotMatch(lead, /処理は端末内だけで完結します|Processing stays entirely on your device/i, label + ': omit redundant privacy claim');
        const dropIconPaths = await page.locator('#dropZone .pdf-drop-icon svg').evaluate(el =>
          [...el.querySelectorAll('path')].map(path => path.getAttribute('d')).join(' '));
        assert.match(dropIconPaths, /m8 10 4 4 4-4/, label + ': drop area uses downward tray arrow');
        if (await badge.isVisible()) {
          const box = await badge.boundingBox(), text = await page.locator('[data-i18n="localBadge"]').boundingBox();
          assert.ok(box && text && box.x >= 0 && box.x + box.width <= width + 1 && text.x >= box.x && text.x + text.width <= box.x + box.width + 1, label + ': local-processing badge fits');
        }
        await exerciseActions(page, width, height, label);
        assert.equal(await hero.isVisible(), false, label + ': hide entire intro when PDF opens');
        assert.equal(await heroHeading.isVisible(), false, label + ': hide hero title when PDF opens');
        assert.equal(await heroDescription.isVisible(), false, label + ': hide intro description when PDF opens');
        assert.equal(await badge.isVisible(), false, label + ': hide processing badge when PDF opens');
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('pdf-has-document')), true,
          label + ': loaded PDF state');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');
        // Responsive changes must not leave the informational footer in a stale state.
        await page.setViewportSize({width:PHONE_WIDTH + 1, height});
        assert.equal(await page.locator('body > footer').isVisible(), !isPhone(PHONE_WIDTH + 1, height), label + ': wider resize');
        assert.equal(await hero.isVisible(), false, label + ': intro hidden after wider resize');
        assert.equal(await badge.isVisible(), false, label + ': badge hidden after wider resize');
        assert.equal(await page.locator('.app-header').evaluate(el => getComputedStyle(el).position),
          isPhone(PHONE_WIDTH + 1, height) ? 'static' : 'sticky', label + ': header breakpoint after wider resize');
        await page.setViewportSize({width:PHONE_WIDTH, height});
        assert.equal(await page.locator('body > footer').isVisible(), false, label + ': phone resize');
        assert.equal(await hero.isVisible(), false, label + ': intro hidden after phone resize');
        assert.equal(await badge.isVisible(), false, label + ': badge hidden after phone resize');
        assert.equal(await page.locator('.app-header').evaluate(el => getComputedStyle(el).position),
          'static', label + ': header does not stick after phone resize');
        await page.setViewportSize({width,height});
        assert.equal(await hero.isVisible(), false, label + ': intro remains hidden at original viewport');
        assert.equal(await badge.isVisible(), false, label + ': badge remains hidden at original viewport');
        assert.equal(await page.locator('.app-header').evaluate(el => getComputedStyle(el).position),
          isPhone(width, height) ? 'static' : 'sticky', label + ': header breakpoint restored');
        // The existing 120 ms fit-to-page debounce can scroll the selected thumbnail.
        // Finish that native render before testing the modal's background scroll lock.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForTimeout(150);
        await page.waitForFunction(() => !document.querySelector('#stageMessage').classList.contains('show'));
        // Capture the actual viewport after resize, not a stitched full-page image of fixed controls.
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await checkActions(page, width, height, label);
        if (file === 'dist/index.html' && [1360,320].includes(width)) await page.screenshot({path:path.join(artifacts, `${language}-${width}.png`)});

        await auditHeader(page, label);
        if (file === 'dist/index.html' && language === 'en' && width === 1360) await exerciseExportRoundTrip(page,label,errors);
        if (file === 'dist/index.html' && language === 'en' && width === 1360) await exerciseAcroFormRoundTrip(page,label,errors);
        if (file === 'dist/index.html' && language === 'en' && width === 1360) await exerciseVisualAnnotationsRoundTrip(page,label,errors);
        await page.locator(HELP).click();
        const visibleHelpText = await page.locator('#helpDialog').innerText();
        assert.doesNotMatch(visibleHelpText, /(?:EN\s*\/\s*JA|JA\s*[\/／]\s*EN|ヘッダーのEN|Use EN in the header)/, label + ': redundant language instructions removed');
        assert.doesNotMatch(visibleHelpText, /Browser Kitty|複製も元に戻す・やり直す操作に対応します|Undo\/Redo also covers duplication|表示言語を変更しても、入力した内容は変わりません|Changing the interface language keeps your entered values/i, label + ': requested Help copy removed');

        const body = page.locator('#helpDialog .dialog-body');
        await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
        const finalItem = page.locator('#helpDialog .dialog-body p:visible, #helpDialog .dialog-body li:visible').last();
        const end = await finalItem.evaluate(el => { const r = el.getBoundingClientRect(), b = el.closest('.dialog-body').getBoundingClientRect(), d = el.closest('dialog').getBoundingClientRect(); return {top:r.top,bottom:r.bottom,clipTop:Math.max(0,b.top,d.top),clipBottom:Math.min(innerHeight,b.bottom,d.bottom)}; });
        assert.ok(end.top >= end.clipTop - 1 && end.bottom <= end.clipBottom + 1, label + ': final Help guidance reachable ' + JSON.stringify(end));
        assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
        const header = await page.locator('#helpDialog .dialog-head, #helpDialog .dialog-header').boundingBox();
        assert.ok(header && header.y >= 0 && header.y + header.height <= height, label + ': Help header visible');
        const beforeScroll = await page.evaluate(() => scrollY);
        await page.mouse.move(2, Math.floor(height / 2));
        await page.mouse.wheel(0,400);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': modal background locked');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape closes Help');
        await page.locator(HELP).click();
        await page.locator('#helpDialog').locator(CLOSE).first().click();
        assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Help reopens and closes');
        // On a phone, verify that the header actually moves out of view on page scroll.
        if (isPhone(width, height)) {
          const position = await page.evaluate(() => {
            window.scrollTo({top: 0, behavior: 'instant'});
            window.scrollTo({top: 180, behavior: 'instant'});
            return {y: window.scrollY, headerTop: document.querySelector('.app-header').getBoundingClientRect().top};
          });
          assert.ok(position.y > 0, label + ': document can scroll on phone');
          assert.ok(position.headerTop < -10,
            label + ': mobile header scrolls offscreen instead of sticking ' + JSON.stringify(position));
          await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
        }
        await page.locator('#closePdfButton').click();
        await page.locator('#emptyView').waitFor({state:'visible'});
        assert.equal(await hero.isVisible(), true, label + ': intro returns when PDF is closed');
        assert.equal(await heroHeading.isVisible(), !isPhone(width,height), label + ': title reappears only on desktop');
        assert.equal(await heroDescription.isVisible(), true, label + ': short description returns after PDF is closed');
        assert.equal(await badge.isVisible(), !isPhone(width,height), label + ': privacy badge returns on desktop');
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('pdf-has-document')), false,
          label + ': reset loaded-PDF state on close');
        assert.deepEqual(errors, [], label + ': console errors');
        assert.deepEqual(requests, [], label + ': no external runtime requests');
        console.log('PASS ' + label);
      } catch (error) {
        await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(() => {});
        throw new Error(label + ': ' + error.message, {cause:error});
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
