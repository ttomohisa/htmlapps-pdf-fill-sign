# APP_SPEC.md — PDF Fill & Sign / PDF記入・署名

This file is the product contract for PDF Fill & Sign. Implementation decisions must follow this specification unless a newer explicit user instruction overrides it.

## 1. Product identity

- **English name:** PDF Fill & Sign
- **Japanese name:** PDF記入・署名
- **Slug:** `pdf-fill-sign`
- **Repository:** `ttomohisa/htmlapps-pdf-fill-sign`
- **Target release:** v1.0.0
- **Current milestone:** v1.0.0 — Formal Release
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`
- **Primary color:** Browser Kitty `#16624F` for application UI accents. The supplied canonical app icon in `assets/favicon.svg` is used unchanged.

### One-sentence purpose

PDFに文字、日付、チェック、署名、印影画像などを書き込み、完成したPDFをブラウザー内だけで作成・保存する。

English:

> Fill in PDFs, add signatures and images, and save the completed PDF entirely in your browser.

## 2. Product boundary

PDF Fill & Sign is a local PDF completion tool, not an electronic-contract service.

The core outcome is:

```text
PDFを開く
↓
必要事項を書く
↓
署名する
↓
完成PDFを保存
```

The product does **not** provide:

- signature requests to other people,
- email delivery,
- accounts or cloud storage,
- collaborative editing,
- identity verification,
- SMS verification,
- audit trails,
- certificate-based digital signatures,
- contract lifecycle management.

## 3. Primary users

- People filling application forms, notices, consent forms, school/work documents, or other PDFs.
- People who want to add a handwritten signature, signature image, initials, or stamp image without printing and rescanning.
- People handling PDFs that they do not want to upload to a third-party service.

## 4. Core user flow for v1.0

1. Open one PDF from the device.
2. Review pages and existing form fields.
3. Enter text/date/marks or fill supported existing PDF form fields.
4. Add a handwritten signature, signature image, initials, stamp, or image when needed.
5. Move/resize added items and review the result.
6. Save a completed PDF with an editable output filename.

No account, upload step, or server round-trip may be inserted into this flow.

## 5. Privacy and runtime network policy

### 5.1 Completely local processing

User-selected PDFs, signatures, images, and entered values are processed inside the browser.

Runtime external network access is prohibited for the default app flow.

Required CSP includes:

```text
connect-src 'none'
```

The app must not use runtime:

- PDF uploads,
- external APIs,
- analytics,
- telemetry,
- tracking,
- CDN assets,
- remote fonts,
- remote images.

UI may state **完全ローカル処理 / Completely local processing** only while this remains true.

### 5.2 Persistence

The PDF file and current edit document are not persistently stored by default.

Allowed local persistence:

- language setting,
- non-sensitive UI preferences,
- signatures or initials only when the user explicitly chooses to save them on this device.

Saved signatures are opt-in, stay on the device, and can be deleted from the app.

## 6. Input contract

### 6.1 PDF input

- One PDF at a time.
- File picker required.
- Desktop Drag & Drop required.
- Smartphone file picker required.
- Maximum input size for v1.0: **100 MiB**.

If the PDF exceeds 100 MiB, do not start parsing; show a clear user-facing message.

There is no fixed page-count limit, but PDFs over 200 pages should show a performance notice.

### 6.2 Supported PDF categories

Target support:

- ordinary PDFs,
- scanned/image-only PDFs,
- portrait and landscape pages,
- multi-page PDFs,
- page rotations 0° / 90° / 180° / 270°,
- AcroForm PDFs,
- Japanese text/forms.

### 6.3 Supported AcroForm fields in v1.0

- single-line text,
- multiline text,
- checkbox,
- radio button,
- dropdown / choice field.

Read-only fields are displayed but not modified.

## 7. Limited / unsupported PDF cases

### Password-protected PDFs

Password entry/unlock is not part of v1.0.

Show a clear message and keep the app recoverable.

### XFA

XFA editing is not supported in v1.0. When possible, render the PDF and allow Browser Kitty overlays, while explaining that the embedded form type itself is unsupported.

### PDF portfolios / embedded files

Not an editing target.

### PDF/A

The app may open a PDF/A file, but does not promise that exported output preserves PDF/A conformance.

### Existing certificate-based signatures

The app does not create cryptographic digital signatures.

When an existing digital signature is detected, warn that editing the PDF can invalidate or alter the verification result.

## 8. Terminology and legal copy

The app's “signature” means a visual signature placed on the PDF page, such as:

- handwritten ink,
- signature image,
- initials.

Do not claim that Browser Kitty provides identity verification, legal validity guarantees, certified e-signatures, or certificate-based signing.

Help copy must state that the tool places visual content into PDFs and does not provide identity verification, signature-request workflows, audit trails, or digital certificates.

## 9. Main UI contract

Use the current `htmlapps-template` application shell rather than creating a separate visual system.

Required template conventions include:

- `app-header` / `header-inner`,
- canonical `brand-mark` using `assets/favicon.svg`,
- `version-badge`,
- compact language switcher,
- compact help icon,
- `page-intro`,
- `local-badge`,
- `workspace` / template design tokens,
- canonical `AppToast`,
- canonical `AppConfirm`,
- template help-dialog behavior,
- template responsive and reduced-motion rules.

The replaceable app body remains between `APP:BEGIN` and `APP:END`.

## 10. Initial state

The initial page makes the first action obvious:

```text
PDFに記入・署名

PDFをここにドロップ
または端末からPDFを選択

[PDFを選択]

PDF · 最大100 MB · 1ファイル
```

Do not show a blank workspace or developer terminology.

## 11. Viewer foundation

Desktop viewer:

- file name and metadata,
- previous / next page,
- current page / page count,
- zoom out / zoom in,
- fit width,
- close PDF,
- page thumbnail rail,
- central PDF stage.

Smartphone viewer:

- keep page controls immediately adjacent to the preview,
- stack the viewer intentionally rather than merely shrinking desktop,
- show thumbnails as a horizontal rail below the preview,
- no page-level horizontal overflow,
- respect safe areas and narrow widths down to 320 px.

## 12. PDF coordinate model for editing milestones

Overlay geometry is stored in PDF page coordinates, not screen pixels.

Each editable overlay records at minimum:

```js
{
  pageIndex,
  x,
  y,
  width,
  height,
  rotation,
  type,
  properties
}
```

Coordinate conversion must explicitly account for:

- PDF page dimensions,
- viewport scale,
- page rotation,
- devicePixelRatio.

Changing zoom must never change saved PDF-space geometry.

## 13. Editing tools targeted for v1.0

- Select
- Text
- Date
- ✓
- ×
- ○
- Handwritten signature
- Signature image
- Initials
- Image / stamp

### Text

- Japanese / English / numbers / common symbols.
- Multiline support.
- Default 12 pt.
- Range approximately 8–48 pt.
- Plain text only for v1.0; no rich-text editor.

### Date

Default Japanese format: `YYYY/MM/DD`.

Default English format: `YYYY-MM-DD`.

Supported presets may include `YYYY/MM/DD`, `YYYY-MM-DD`, `MM/DD/YYYY`, and `DD/MM/YYYY`.

### Handwritten signature

- Pointer Events.
- Mouse, pen/stylus, and touch.
- Transparent background.
- Automatic whitespace crop.
- Black and blue at minimum.
- Optional opt-in local reuse.

### Signature / stamp images

Supported image inputs:

- PNG,
- JPEG,
- WebP.

Transparent PNG transparency must be preserved.

## 14. Existing form handling

If supported form fields exist, do not expose the term “AcroForm” in primary UI.

Use plain language such as:

> このPDFには入力できる欄があります。

Provide natural HTML controls where practical and allow Tab navigation.

Existing signature fields are visual guidance only. Do not pretend a visual Browser Kitty signature becomes a cryptographic signed field.

## 15. Undo / Redo

Target v1.0 undo scope:

- add/remove overlay,
- move,
- resize,
- text/date changes,
- style changes,
- form-field value changes.

Keep up to 100 operations.

For reversible deletion, prefer the canonical template toast with Undo instead of a confirmation dialog.

Use `AppConfirm` for destructive actions such as replacing an edited document, clearing all work, or deleting all saved signatures.

## 16. Keyboard support

Target v1.0:

- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Ctrl/Cmd + Y`: Redo
- `Delete` / `Backspace`: delete selected overlay when not typing
- `Escape`: cancel selection/dialog when appropriate
- Arrow keys: fine move
- `Shift + Arrow`: larger move

v0.1.0 viewer navigation may also use PageUp/PageDown and Left/Right when focus is not in an input.

## 17. Export contract

Primary output: PDF.

Default naming example:

```text
application.pdf
→
application-filled.pdf
```

The output filename must be editable before download. Unsafe filename characters must be sanitized and `.pdf` kept predictable.

Do not overwrite the source PDF silently.

### v0.5.0 implementation

v0.5.0 uses the already-embedded PDF.js save path rather than introducing a second PDF engine. Browser Kitty overlay items are converted to transparent appearance bitmaps and stored as standard PDF Stamp annotations when `saveDocument()` creates the output PDF. This keeps the original page content intact and allows Japanese text, marks, signatures, initials, and imported images to share one local export path.

### v0.6.0 form implementation

v0.6.0 keeps PDF.js as the single PDF engine. Supported `Widget` annotations are read with `getAnnotations()` and represented with Browser Kitty-owned HTML controls positioned through the same PDF.js viewport coordinate conversion used by the editor. User-facing UI says that the PDF has fillable fields rather than exposing `AcroForm` as primary terminology.

Changed form values are written to PDF.js `AnnotationStorage` and saved through `saveDocument()`. Existing values remain unchanged unless the user edits them. Text/multiline, checkbox, radio, and choice fields participate in Browser Kitty Undo / Redo history. Signature widgets are visual placement guidance only and open the existing visual-signature workflow; they are not converted into certificate-based digital signatures.

When **Flatten entered values** is ON, Browser Kitty creates a self-contained visual Stamp appearance for each supported non-signature field at the original widget rectangle and saves the original widget with `noView` / `noPrint`. Signature widgets are hidden without adding an empty replacement; any Browser Kitty visual signature is exported separately as its own Stamp annotation. This makes the completed output visually fixed and non-interactive in normal viewers without rasterizing the whole PDF page. The underlying AcroForm dictionaries are not physically removed in v0.6.0, so this is explicitly a visual/non-interactive flattening strategy rather than structural form deletion.

v1.0 may further harden the output representation if cross-viewer regression testing shows a need to move Browser Kitty overlays from appearance annotations into page content streams or to remove form objects structurally.

## 18. Form flattening

When supported existing PDF form fields are present, the save flow provides:

- **入力内容を固定する / Flatten entered values** — default ON.

ON produces a completed visual PDF by writing the current supported field appearance as a self-contained Stamp annotation and saving the original widget as non-viewable/non-printing. v0.6.0 does not physically remove the AcroForm field dictionaries.

OFF preserves editable supported form fields through PDF.js where technically safe.

Browser Kitty-added text/signatures/images are always self-contained in the exported PDF. v0.6.0 currently stores them as standard PDF Stamp annotations; v1.0 may harden this representation after cross-viewer regression testing.

## 19. Japanese font requirements

If Browser Kitty exports editable/vector text using a PDF font, that export must not rely on an operating-system font being available. If a milestone exports Browser Kitty overlay text as a self-contained appearance image instead, the generated PDF must contain all pixels needed to render the text without a font dependency.

Any chosen export font must be:

- redistributable,
- embedded locally,
- Japanese capable,
- compatible with the single-HTML build.

Subset embedded glyphs when practical to control output size.

## 20. Application states

Explicit states:

```text
empty
loading-pdf
ready
editing
exporting
result
error
```

Async work from a previous source must not overwrite a newer source. Use a monotonically increasing generation/token or the template async-state pattern.

## 21. User-facing errors

Required categories:

- invalid/corrupt PDF,
- file over 100 MiB,
- password-protected PDF,
- unsupported image,
- memory pressure / allocation failure,
- export failure.

Do not show only `Error`.

Technical details may be placed behind a secondary detail affordance.

## 22. Accessibility

Required:

- visible focus,
- accessible names,
- real buttons/inputs,
- keyboard operation,
- `aria-live` status,
- Escape closing for dialogs,
- sufficient contrast,
- touch-friendly hit areas,
- `prefers-reduced-motion` support.

Do not distinguish critical states by color alone.

## 23. Bilingual UI

Japanese and English live in the same HTML.

Switching language does not reload the PDF or page.

User PDF contents and user-entered text are never translated automatically.

## 24. Help dialog

Use the current template help dialog in the upper-right header.

It must contain current behavior only:

- how to open/use the PDF,
- local processing/privacy,
- current milestone limits,
- password/size/device limitations,
- later signing terminology when signing exists.

The dialog must remain fully scrollable on narrow/short smartphone screens.

## 25. Technical architecture

Expected v1.0 structure:

```text
PDF file
  ├─ PDF.js
  │   ├─ page rendering
  │   ├─ metadata
  │   └─ thumbnails
  ├─ supported form layer
  ├─ Browser Kitty overlay layer
  │   ├─ text/date
  │   ├─ marks
  │   ├─ signature/initials
  │   └─ image/stamp
  └─ PDF export engine
      ├─ original PDF
      ├─ form values
      ├─ overlays
      └─ completed PDF
```

## 26. Dependencies

v0.1.0:

- `pdfjs-dist` pinned exactly in `dependencies.json` and `dependencies.lock.json`.
- PDF.js main module and Worker embedded by the standard template dependency pipeline.

v0.5.0 export and v0.6.0 form editing/flattening continue to use `pdfjs-dist` and its built-in `AnnotationStorage` / `saveDocument()` path, so v0.6.0 adds no runtime dependency.

A second PDF-writing library or custom-font library may be added later only if a concrete post-v0.6 requirement cannot be met through PDF.js, and only through the template dependency pipeline.

No runtime CDN.

## 27. Security

- Do not evaluate user-entered text as HTML or JavaScript.
- Escape/safely insert filenames into DOM.
- Do not execute PDF JavaScript.
- Do not auto-open embedded attachments.
- Do not automatically navigate PDF links.
- Keep restrictive CSP and `connect-src 'none'`.

## 28. Performance

- Do not render every page at full resolution at startup.
- Current page receives full-quality rendering.
- Thumbnails are lazy rendered.
- Release/reuse offscreen canvas/page resources where practical.
- Heavy PDFs must show visible progress/state rather than freezing without explanation.

## 29. Browser target

Primary:

- current Chrome,
- current Edge.

Compatibility targets:

- current Firefox,
- current Safari,
- iOS Safari,
- Android Chromium.

Direct `file://` opening of generated standalone HTML is required.

## 30. Build and repository contract

Follow the current `htmlapps-template`.

Do not maintain a parallel custom build system.

Required release artifacts:

```text
dist/index.html
dist/index.self-extract.html
```

Canonical icon source:

```text
assets/favicon.svg
```

The builder must embed that exact SVG for both:

- browser favicon,
- upper-left application brand icon.

Common template infrastructure under `scripts/`, `components/`, `schemas/`, and `.github/` should stay aligned with the current template unless an app-specific technical need is documented.

## 31. Repository assets for formal release

At v1.0.0 prepare at minimum:

```text
assets/favicon.svg
assets/screenshot.png
assets/screenshot-en.png
assets/screenshot-mobile.png
```

Screenshots must show the actual application, not generated mockups.

## 32. Test PDF matrix

Maintain non-sensitive fixtures covering at least:

```text
01-basic.pdf
02-multipage.pdf
03-landscape.pdf
04-rotated-90.pdf
05-rotated-180.pdf
06-rotated-270.pdf
07-scan.pdf
08-acroform-text.pdf
09-acroform-checkbox.pdf
10-acroform-radio.pdf
11-acroform-dropdown.pdf
12-acroform-multiline.pdf
13-japanese-form.pdf
14-password.pdf
15-digital-signature.pdf
16-xfa.pdf
17-large-pages.pdf
18-corrupt.pdf
```

Fixtures must not contain real personal or confidential information.

# Development plan

## v0.1.0 — PDF Foundation

### Goal

Complete the template-compliant, local PDF viewing foundation before any editing feature is introduced.

### Scope

- current `htmlapps-template` shell and components,
- canonical supplied favicon/app icon,
- PDF file picker,
- desktop Drag & Drop,
- 100 MiB guard,
- PDF.js + embedded Worker,
- PDF parse/render,
- page count,
- previous/next navigation,
- lazy full-page thumbnail list,
- fit width,
- zoom in/out,
- rotation-aware PDF.js viewport rendering,
- loading state,
- invalid PDF error,
- password-PDF error,
- Japanese/English UI,
- responsive desktop/mobile viewer,
- runtime `connect-src 'none'`,
- standalone build configuration.

### Out of scope

- editing overlays,
- signatures,
- PDF export.

### Exit criteria

- Basic, multipage, landscape, rotated and scanned PDFs render.
- Viewer is usable at 320–390 px widths without page-level horizontal scrolling.
- Template header/help/toast/confirm patterns are preserved.
- Canonical favicon and header icon use the exact same supplied SVG.
- `file://` remains a required release target.

## v0.2.0 — Overlay Editing

### Goal

Make non-form PDFs writable with basic local overlays.

### Scope

- explicit PDF coordinate model,
- Select tool,
- Text,
- Japanese text prototype,
- Date,
- ✓ / × / ○,
- move,
- resize,
- delete,
- basic inspector,
- first Undo / Redo,
- keyboard movement,
- rotation/zoom coordinate regression tests.

### Exit criteria

Overlay position stays stable through zoom and 0/90/180/270° page rotation.

## v0.3.0 — Handwritten Signature

- Signature dialog.
- Pointer Events.
- Mouse, pen, touch.
- Clear.
- Black / blue.
- Transparent background.
- Whitespace crop.
- Place/move/resize/delete/undo.
- Smartphone signature interaction validation.

## v0.4.0 — Images / Initials / Stamps

- PNG / JPEG / WebP.
- Transparent PNG preservation.
- Signature image.
- Initials.
- Stamp / generic image.
- Image normalization.
- Optional opt-in saved signature.
- Local delete of saved signatures.
- Privacy copy for local persistence.

## v0.5.0 — PDF Export

- Completed-PDF generation through the already embedded PDF.js `AnnotationStorage` / `saveDocument()` path.
- Browser Kitty overlays serialized as standard PDF Stamp annotations with self-contained appearance images.
- Text/date/marks export, including Japanese text as appearance pixels.
- Signature/initials/image export with transparency preservation.
- Editable output filename.
- `-filled.pdf` default.
- Export progress, success, failure, retry, and explicit download states.
- Original page content preserved; form flattening remains v0.6.0 scope.
- Browser display vs saved-PDF geometry validation.

At the end of v0.5.0, the non-form PDF workflow should already work end-to-end.

## v0.6.0 — Existing PDF Forms

- Detect supported fields without technical jargon.
- Text / multiline / checkbox / radio / dropdown and choice-list controls.
- Read-only handling.
- Required metadata where available, with non-blocking missing-field warnings.
- Tab / Shift+Tab and previous/next field navigation, including across pages.
- Preserve existing values and synchronize duplicate widgets for the same supported field.
- Include supported form-value changes in the existing Undo / Redo history.
- Save form values through PDF.js `AnnotationStorage`.
- Default-ON visual/non-interactive flattening by writing field appearances as Stamp annotations and marking original widgets `noView` / `noPrint`.
- Keep-editable option where safe when flattening is OFF.
- XFA limitation handling with overlay fallback.
- Existing signature-field visual guidance only; no certificate signing.

### v0.6.0 exit criteria

- Supported text, multiline, checkbox, radio, and choice fields display existing values and save edited values.
- Read-only fields cannot be edited.
- Required warnings do not block export.
- Tab and previous/next navigation can cross pages without trapping keyboard focus at the first/last field.
- Flatten ON creates a visually fixed result while hiding original supported widgets; flatten OFF preserves supported editable fields.
- Browser Kitty overlays continue to export alongside form values.
- XFA forms are explained without pretending their embedded form fields are editable.
- Runtime network behavior remains unchanged (`connect-src 'none'`).

## v0.7.0 — Editing Reliability

- Full Undo / Redo review.
- Up to 100 history operations.
- Keyboard shortcuts.
- Confirm destructive close / replace operations when the current content is unsaved.
- Track a saved baseline only after the completed-PDF download is initiated; content-only signatures exclude transient selection state.
- Show explicit Unsaved / Saved state without treating simple selection changes as edits.
- `beforeunload` warning only when the current PDF content differs from the last saved baseline.
- Safe PDF replacement: load the replacement successfully before destroying the currently open PDF.
- Last-open-request-wins stale-result guard for concurrent or delayed PDF loads.
- Serialize export generation and reject stale export results if the underlying PDF generation changes.
- Export failure recovery must retain all edits and restore retry/close controls.
- Long filename handling: preserve the full source name for inspection while sanitizing and capping the output filename.
- Zoom/page-switch state consistency.

### v0.7.0 exit criteria

- Closing or replacing a PDF with unsaved edits asks for confirmation; a saved/unchanged PDF closes without a redundant discard prompt.
- Browser/tab unload warning is present only while unsaved edits exist.
- Starting the completed-PDF download establishes the saved baseline; subsequent Undo / Redo correctly toggles saved vs unsaved according to content.
- A corrupt/unsupported replacement PDF does not discard the currently open PDF.
- When two PDF-open operations overlap, a stale earlier result cannot replace the later selection.
- Repeated export triggers produce at most one active `saveDocument()` operation.
- Export failure leaves the editing session intact and allows retry.
- Long filenames do not create page-level horizontal overflow and generated filenames remain valid.
- Existing v0.6 form editing/flattening and v0.5 overlay export behavior remain available.
- Runtime network behavior remains unchanged (`connect-src 'none'`).

## v0.8.0 — Mobile / UX / Accessibility

Implemented smartphone/accessibility boundary:

- Reuse the template mobile-bottom-bar pattern as a four-action persistent bar: **Tools / Pages / Selected / Save**.
- Keep **Selected** disabled until a Browser Kitty-added item is selected; hide the empty Inspector on phone layouts.
- Hide the duplicate viewer-header Save button on phone layouts because Save is persistently available at the bottom.
- Keep the PDF stage scrollable for one-finger pan and add two-pointer pinch zoom with a temporary transform preview followed by a PDF re-render at the committed scale.
- Preserve Pointer Events move / resize for Browser Kitty overlays and enlarge the mobile resize handle to 26 px.
- Make primary phone touch targets at least 44 px for viewer controls, form navigation, history, and editing tools.
- Account for bottom safe areas in the persistent action bar, document padding, toast placement, and bottom-sheet dialog content.
- Constrain signature/export dialogs to `100dvh`, make their bodies internally scrollable, and compact them further on short and landscape phone viewports.
- Support landscape-phone behavior through 900 px width / 500 px height.
- Add focus-visible treatment for overlays, thumbnails, and form controls.
- Add keyboard operation for focused overlays and Arrow / Home / End navigation in the editing toolbar.
- Keep `prefers-reduced-motion` behavior for scrolling/animation helpers.
- Validate target widths 320 / 360 / 390 / 412 px with no page-level horizontal overflow.

### v0.8.0 exit criteria

- PDF selection → form/text entry → handwritten signature → completed-PDF creation/download can be completed using only a 320 px smartphone viewport.
- 320 / 360 / 390 / 412 px portrait layouts have no page-level horizontal scrolling.
- A short 320 × 568 viewport keeps signature and export dialogs inside the viewport with internal scrolling where necessary.
- 844 × 390 landscape-phone layout keeps the persistent action bar, enlarged touch targets, and no page-level horizontal scrolling.
- Synthetic two-pointer regression commits a zoom change after pinch preview; one-finger pan remains native to the scrollable stage.
- Overlay keyboard move/delete/select behavior and editing-toolbar keyboard navigation work without triggering page navigation accidentally.
- Existing v0.7 reliability, v0.6 form editing, and v0.5 export paths remain available.
- Runtime network behavior remains unchanged (`connect-src 'none'`).

## v0.9.0 — Release Candidate

Release-candidate refinements implemented before the full fixture pass:

- Use one consistent local sans-serif stack for text/date overlays; no font-family selector and no external font fetch.
- Raise Browser Kitty overlay font-size range from 8–48 pt to 8–200 pt.
- Replace the header privacy phrase with an app-specific descriptor while retaining the explicit local-processing badge and privacy explanation elsewhere.
- Allow the intro copy to use the available width instead of leaving a short orphaned second line on normal desktop widths.
- Keep the desktop thumbnail rail at a fixed height with internal scrolling.
- Group − / percentage / + as one zoom control; clicking the percentage resets to 100%.
- Add `Ctrl/Cmd + wheel` cursor-anchored zoom over the PDF stage.
- **Critical export regression fix:** Browser Kitty-created annotations must use the PDF.js `pdfjs_internal_editor_` AnnotationStorage key prefix. v0.5.0–v0.8.0 used Browser Kitty-only prefixes, so PDF.js could return a successful save while ignoring those newly added overlay/flatten annotations.
- Keep form-value saving and Browser Kitty overlay saving on the same `saveDocument()` path, with temporary export entries always removed after the operation.

Regression focus:

- real saved-PDF reopen check for text, marks, signature, image, initials, form values, and flatten appearance,
- all PDF fixtures,
- rotations,
- Japanese,
- form fields,
- password/XFA/digital-signature warnings,
- corrupt/large PDFs,
- Chrome / Edge / Firefox / Safari,
- Android Chromium / iOS Safari where practical,
- runtime external requests = 0,
- CSP,
- readable standalone,
- self-extract standalone,
- `file://`,
- empty/loading/ready/editing/exporting/result/error states,
- Japanese/English help and limitations,
- README draft.

## v0.9.3 — Workspace Height RC

- On desktop, grow the left thumbnails, middle PDF stage, and right inspector together to `max(620px, 100dvh - 228px)`.
- Retain separately scrollable thumbnail/PDF panes so zooming never changes the outer editor height.
- Reduce the empty desktop gap beneath a loaded PDF so the taller workspace uses that space without moving the footer down unnecessarily.
- Do not change the phone-specific stacked layout or any PDF export paths.

## v0.9.2 — Vector Export RC

- Export Browser Kitty text and date overlays through PDF.js FreeText annotations rather than raster Stamp images.
- Export ✓ / × / ○ marks as vector Ink paths.
- Keep normalized stroke data for newly drawn signatures / initials and export those strokes as vector Ink annotations.
- Keep uploaded signature images, initials images, stamps, photos, logos, PNG, JPEG, and WebP assets raster.
- Keep the existing `pdfjs_internal_editor_` AnnotationStorage key prefix and the single `saveDocument()` path.
- Do not add a runtime dependency or external font/network request. Text/date preview uses one local sans-serif stack; PDF.js FreeText export remains vector/text without embedding a Browser Kitty-supplied font file.
- Preserve vector stroke data in history and optional locally saved signature / initials records.

Regression focus:

- saved-PDF reopen verification for text, date, ✓ / × / ○, drawn signature, drawn initials, uploaded signature image, transparent PNG, form values, flatten ON, and flatten OFF,
- 0 / 90 / 180 / 270° pages,
- Japanese and English text,
- large font sizes through 200 pt,
- runtime external requests = 0 and standalone behavior unchanged.

## v1.0.0 — Formal Release

- Remove the text/date font-family selector and use one consistent local sans-serif stack.
- Keep vector FreeText export for text/date, vector Ink export for marks and newly drawn signatures/initials, and raster export only for image-based assets.
- Promote version metadata and documentation from release-candidate wording to v1.0.0.
- Remove the bundled `htmlapps-template.zip` from the release repository.

Stop adding scope and finish release quality.

Final tasks:

- version metadata,
- CHANGELOG,
- README / README.ja,
- THIRD_PARTY_NOTICES / license review,
- favicon,
- PC Japanese screenshot,
- PC English screenshot,
- mobile screenshot,
- final readable standalone,
- final self-extract build,
- repository check,
- standalone verification,
- GitHub Pages verification.

### v1.0 release condition

Release when all of the following are true:

- A PDF can be opened, filled, visually signed, and saved.
- Supported form and non-form PDFs both work.
- Japanese text export works correctly.
- PC and smartphone flows both complete.
- Completely local processing remains factually true.
- The single-HTML release works without runtime external dependencies.
- No release-blocking known bug remains.
- README, favicon, and screenshots are complete.

Do not delay v1.0 only because additional optional features could still be added.
