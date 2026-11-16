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
        assert.equal(await hero.isVisible(), !isPhone(width, height), label + ': intro hidden on phones');
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
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');
        // Responsive changes must not leave the informational footer in a stale state.
        await page.setViewportSize({width:PHONE_WIDTH + 1, height});
        assert.equal(await page.locator('body > footer').isVisible(), !isPhone(PHONE_WIDTH + 1, height), label + ': wider resize');
        assert.equal(await hero.isVisible(), !isPhone(PHONE_WIDTH + 1, height), label + ': intro at wider resize');
        assert.equal(await badge.isVisible(), !isPhone(PHONE_WIDTH + 1, height), label + ': badge at wider resize');
        await page.setViewportSize({width:PHONE_WIDTH, height});
        assert.equal(await page.locator('body > footer').isVisible(), false, label + ': phone resize');
        assert.equal(await hero.isVisible(), false, label + ': hide intro after phone resize');
        assert.equal(await badge.isVisible(), false, label + ': hide badge after phone resize');
        await page.setViewportSize({width,height});
        assert.equal(await hero.isVisible(), !isPhone(width, height), label + ': intro restored at original viewport');
        assert.equal(await badge.isVisible(), !isPhone(width, height), label + ': badge restored at original viewport');
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
