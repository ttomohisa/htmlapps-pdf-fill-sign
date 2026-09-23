# Changelog

## v1.0.0

- Released PDF Fill & Sign as the first stable version.
- Removed the Sans-serif / Serif / Monospace font-family selector from text and date overlays; the editor now uses one consistent local sans-serif stack.
- Kept text/date export as PDF.js FreeText annotations, ✓ / × / ○ and newly drawn signatures/initials as vector Ink annotations, and uploaded image assets as raster annotations.
- Kept the viewport-responsive desktop workspace introduced in v0.9.3 and the existing mobile layout.
- Updated English/Japanese README documentation for the stable release.
- Added actual v1.0.0 interface screenshots in Japanese, English, and mobile layouts, with links from both README files.
- Removed the bundled `htmlapps-template.zip` from the release repository.
- No runtime dependency or external network access was added; `connect-src 'none'` remains in force.

## v0.9.3

- Let the loaded desktop PDF workspace expand with viewport height instead of stopping at 620px; preserve 620px as the minimum on shorter screens.
- Keep the thumbnail rail, PDF preview and inspector aligned, with independent thumbnail and preview scrolling at every zoom level.
- Reclaim unused desktop spacing below the loaded workspace so the expanded editor ends near the footer without adding unnecessary page scroll.
- Preserve the phone layout and existing PDF export behavior.

## v0.9.2

- Changed Browser Kitty text and date overlays from raster Stamp export to PDF.js FreeText annotations so the saved PDF keeps them as text/vector content.
- Changed ✓ / × / ○ overlays to PDF.js Ink annotations with vector paths.
- Preserve normalized stroke points for newly drawn signatures and initials and export those strokes as vector Ink annotations; uploaded image-based signatures, initials, stamps, photos, and other images remain raster.
- Preserve vector signature stroke data through Undo / Redo and optional IndexedDB saved-signature reuse.
- Kept the `pdfjs_internal_editor_` AnnotationStorage prefix used by PDF.js so new annotations are included by `saveDocument()`.
- Fixed form-flatten text rendering to use the app's local sans-serif stack instead of referencing an undefined overlay item.

All notable changes to PDF Fill & Sign are documented here.

## 0.9.1 - Release Candidate patch - 2026-09-23

- Keep the desktop PDF viewport and thumbnail rail at the same fixed 620px height, so zooming changes the scrollable document area instead of stretching the workspace vertically.
- Preserve the existing mobile viewport sizing and scrolling behavior.

## 0.9.0 - Release Candidate - 2026-09-23

### Added

- Added Sans-serif / Serif / Monospace choices for text and date overlays using device-local system fonts only.
- Raised Browser Kitty overlay font-size range from 8–48 pt to 8–200 pt.
- Added cursor-anchored `Ctrl/Cmd + wheel` zoom over the PDF preview.
- Added a grouped − / percentage / + zoom control; clicking the percentage resets zoom to 100%.

### Changed

- Replaced the header’s generic local-processing phrase with an app-specific Fill / Sign / Save descriptor while keeping the explicit local-processing badge and privacy copy.
- Allowed the intro copy to use the available desktop width so the final short phrase no longer wraps by itself under normal desktop sizing.
- Constrained the desktop thumbnail rail to a fixed 620 px height with internal scrolling; phone layouts keep their horizontal thumbnail strip.
- Text/date previews and export bitmaps now use the same selected font family.

### Fixed

- **Critical:** corrected Browser Kitty export AnnotationStorage keys to use PDF.js’s `pdfjs_internal_editor_` prefix. v0.5.0–v0.8.0 could report successful PDF creation while PDF.js silently ignored Browser Kitty-added text, marks, signatures, images, initials, and visual flatten stamps.
- The same prefix correction now applies to visual form-flatten stamps.
- Removed the previous low-zoom minimum CSS font-size floor so text preview size continues to track PDF zoom accurately.

### Validation

- Browser mock regression mirrors PDF.js 6.3.289’s editor-prefix filtering and confirms Browser Kitty export entries are accepted as new annotations.
- Browser regression covers font switching, 160 pt text, grouped zoom controls, 100% reset, `Ctrl/Cmd + wheel`, fixed thumbnail height, one-line desktop intro, export generation, and 390 px page-level overflow.
- Source review against PDF.js 6.3.289 confirms `getNewAnnotationsMap()` accepts only AnnotationStorage keys beginning with `pdfjs_internal_editor_`.
- Production `pdfjs-dist` binary save/reopen still requires the repository’s normal Windows standalone build/regression because this Linux environment cannot run the PowerShell build pipeline.

### Privacy

- v0.9.0 adds no runtime dependency or external connection. Font choices use only fonts already available on the device and `connect-src 'none'` remains in force.

## 0.8.0 - Mobile / UX / Accessibility - 2026-09-23

### Added

- Added a persistent smartphone bottom action bar based on the template mobile-bottom-bar pattern with **Tools / Pages / Selected / Save** actions.
- Added two-finger pinch zoom for the PDF stage while retaining native one-finger panning inside the scrollable preview.
- Added keyboard interaction for Browser Kitty overlay items: Enter / Space selects, Delete / Backspace removes, and Arrow / Shift+Arrow moves the focused item.
- Added Arrow / Home / End keyboard navigation within the editing toolbar.
- Added explicit focus-visible treatment for overlays, thumbnails, and PDF form controls.
- Added mobile help copy describing the persistent actions and touch gestures.

### Changed

- Smartphone touch targets for page/zoom controls, form navigation, history, and editing tools are now at least 44 px in the mobile layouts.
- The overlay resize handle grows to 26 px on phone layouts while preserving the PDF-coordinate editing model.
- Empty inspector content is hidden on phones; the Selected bottom action becomes available only when a Browser Kitty item is selected.
- The duplicate viewer-header Save PDF button is hidden on phone layouts because Save is persistently available in the bottom action bar.
- Signature and export dialogs now constrain themselves to the dynamic viewport and use internal scrolling on short screens.
- Added compact landscape-phone handling up to 900 px wide / 500 px high, including the bottom action bar, larger touch targets, and shorter dialog content.
- Toast placement and document bottom padding now account for the fixed mobile action bar and safe-area inset.
- Updated Japanese / English help, README files, and `APP_SPEC.md` for the v0.8.0 mobile/accessibility boundary.

### Validation

- Browser regression passes at 320 / 360 / 390 / 412 px with no page-level horizontal scrolling.
- 844 × 390 landscape-phone regression passes with the persistent action bar and no page-level horizontal scrolling.
- 320 × 568 end-to-end smartphone regression covers PDF open → handwritten signature → placement → Save → PDF creation → download.
- Short-viewport regression confirms signature and export dialogs remain within the viewport and scroll internally when necessary.
- Synthetic two-pointer regression confirms pinch preview and committed zoom; keyboard regression covers overlay movement and toolbar navigation.

### Privacy

- v0.8.0 adds no runtime dependency or external connection. `connect-src 'none'` remains in force.

## 0.7.0 - Editing Reliability - 2026-09-23

### Added

- Added explicit **Unsaved changes** / **Saved** state beside the source PDF metadata.
- Added a saved baseline tied to the completed-PDF download action rather than merely creating export bytes.
- Added `beforeunload` protection only while the current PDF content differs from the saved baseline.
- Added safe PDF replacement: a new PDF is parsed successfully before the current PDF is destroyed.
- Added last-open-request-wins guards for overlapping asynchronous PDF loads.
- Added export-operation locking so repeated clicks or Enter presses cannot run `saveDocument()` concurrently.
- Added stale-export guards tied to the open-document generation.
- Added full source-filename `title` text and safe 180-character output filename capping.

### Changed

- Undo / Redo edit signatures now ignore transient selection state and compare only content that affects the completed PDF.
- Closing or replacing a saved/unchanged PDF no longer shows a redundant discard confirmation.
- Destructive close and replace confirmations now use context-specific action labels.
- A failed replacement PDF leaves the previously open PDF and its editing state intact.
- A failed first open returns to the actionable empty state with an error toast instead of leaving a dead viewer shell.
- Export failure restores controls and retains the editing session for retry.
- Updated Japanese / English help, README files, and `APP_SPEC.md` for the v0.7.0 reliability boundary.

### Validation

- Browser regression covers dirty/saved transitions, `beforeunload`, discard confirmation, export de-duplication, Undo / Redo relative to the saved baseline, failed replacement retention, stale open suppression, and long filenames.
- 390 px viewport regression confirms no page-level horizontal scrolling with the save-state indicator visible.

### Privacy

- v0.7.0 adds no runtime dependency or external connection. `connect-src 'none'` remains in force.

## 0.6.0 - Existing PDF Forms - 2026-09-23

### Added

- Added detection and plain-language guidance for supported existing PDF form fields.
- Added browser-native controls aligned over PDF Widget annotations for single-line text, multiline text, checkboxes, radio buttons, dropdowns, and choice lists.
- Added existing-value preservation, read-only field handling, and non-blocking required-field warnings.
- Added Tab / Shift+Tab and Previous / Next field navigation across pages without trapping focus at the first or last supported field.
- Added supported form-value changes to the existing 100-operation Undo / Redo history.
- Added visual guidance for PDF signature fields that opens Browser Kitty's visual-signature workflow without creating a certificate-based digital signature.
- Added default-ON **Flatten entered values** export and an OFF option that keeps supported form fields editable where safe.
- Added XFA-form warning copy while preserving Browser Kitty overlay editing as a fallback.

### Changed

- Form values now save through the existing PDF.js `AnnotationStorage` / `saveDocument()` path alongside Browser Kitty overlays.
- Visual flattening writes self-contained Stamp appearances for supported non-signature fields and saves the original widgets with `noView` / `noPrint`; it does not rasterize the full page.
- Signature widgets are hidden during flattening without adding an empty replacement appearance; a Browser Kitty visual signature is exported separately when the user places one.
- Updated the edit-state snapshot model so form values discovered by background scanning do not create false Undo history entries.
- Updated overlay/form stacking so Browser Kitty-added items can still be selected when they overlap a fillable field.
- Updated Japanese / English help, README files, and `APP_SPEC.md` for the v0.6.0 feature boundary.

### Privacy

- v0.6.0 adds no runtime dependency and no external connection. Form discovery, editing, flattening, and saving remain in-browser with `connect-src 'none'`.

### Limitations

- XFA form fields are not edited.
- PDF signature fields receive only visual Browser Kitty signatures; no cryptographic signature or identity verification is created.
- v0.6.0 flattening is visual/non-interactive: original form widgets are hidden from viewing/printing, but the underlying AcroForm dictionaries remain in the PDF structure.

## 0.5.0 - PDF Export - 2026-09-23

### Added

- Added completed-PDF generation using the already embedded PDF.js `AnnotationStorage` / `saveDocument()` path.
- Added a Save PDF action in the viewer header and a responsive export dialog.
- Added editable output filenames with a safe `-filled.pdf` default and filename sanitization.
- Added export progress, success, failure, retry, and explicit download states.
- Added export for text, dates, marks, handwritten signatures, signature images, initials, and generic image/stamp overlays.
- Added page-rotation-aware Stamp annotation serialization for 0° / 90° / 180° / 270° pages.

### Changed

- Browser Kitty overlays are converted to self-contained appearance bitmaps and written as standard PDF Stamp annotations, preserving the original PDF page content.
- Updated Japanese / English help, README content, product descriptions, and close-PDF wording for the v0.5.0 save flow.
- Fixed duplicate v0.4.0 signature/image CSS and removed unintended padding from initials image overlays.

### Privacy

- PDF generation runs entirely in the browser using the already embedded PDF.js code. No runtime dependency or external connection was added.
- `connect-src 'none'` remains in force.

### Not yet included

- Existing AcroForm editing and form flattening.
- Certificate-based digital signatures.

## 0.4.0 - Images / Initials / Stamps - 2026-09-22

### Added

- Added PNG, JPEG, and WebP image import for signatures and general PDF overlays.
- Added handwritten and image-based initials as a separate overlay type.
- Added generic image / stamp placement for seals, photos, logos, and other images.
- Added image normalization with a 1600 px maximum dimension while preserving transparency by normalizing to PNG in-browser.
- Added explicit opt-in local persistence for one signature and one initials asset using IndexedDB.
- Added use-saved and delete-saved controls in the signature / initials dialog.
- Added Draw / Image tabs to the signature workflow.

### Changed

- Updated image-like overlay resizing to preserve aspect ratio for signatures, initials, and imported images.
- Updated the inspector and accessibility labels for signature, initials, and image overlay types.
- Updated Japanese / English help, README content, and application descriptions for the v0.4.0 feature boundary.

### Privacy

- Imported PDF/image data remains local to the browser. Runtime external connections remain blocked with `connect-src 'none'`.
- Signatures and initials are persisted only when the user explicitly enables local saving; otherwise they remain session-only.

### Not yet included

- Existing AcroForm editing.
- Completed PDF export.

## 0.3.0 - Handwritten Signature - 2026-09-22

### Added

- Added a handwritten signature dialog using Pointer Events for mouse, touch, and pen input.
- Added black and blue signature ink choices.
- Added clear/reset controls and disabled signature confirmation until ink is present.
- Added automatic transparent-whitespace cropping before a signature is placed.
- Added signatures as first-class PDF-coordinate overlay items with move, delete, Undo / Redo, and aspect-ratio-preserving resize behavior.
- Added responsive signature-dialog behavior for smartphone screens.

### Changed

- Updated Japanese / English help, README content, and application descriptions for the v0.3.0 feature boundary.
- Updated the inspector so signature selections expose only relevant actions rather than text/font controls.
- Updated edit-discard messaging to include handwritten signatures.

### Privacy

- Handwritten signature pixels remain in the current in-browser editing session only and are not persisted by v0.3.0.
- Runtime external connections remain blocked with `connect-src 'none'`.

### Not yet included

- Signature image import, initials, or image/stamp placement.
- Existing AcroForm editing.
- Completed PDF export.

## 0.2.0 - Overlay Editing - 2026-09-22

### Added

- Added a PDF-coordinate overlay model so added content stays aligned across zoom changes and rotated PDF pages.
- Added Select, Text, Date, Check, Cross, and Circle editing tools.
- Added drag movement and lower-right resize handles for overlay items.
- Added a selection inspector for text content, font size, and color.
- Added Undo / Redo history for up to 100 edit operations.
- Added keyboard editing: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y, Delete/Backspace, Escape, Arrow keys, and Shift+Arrow.
- Added Undo toast after deleting an overlay item.
- Added a discard confirmation when closing a PDF that contains local overlay edits.

### Changed

- Expanded the viewer from the v0.1.0 reading foundation into the v0.2.0 editing workspace while retaining the current `htmlapps-template` shell, supplied app icon/favicon, CSP, dependency pipeline, and standalone structure.
- Added a right-side inspector on desktop and a stacked inspector layout on narrow screens.
- Updated Japanese / English help and README content for the v0.2.0 feature boundary.
- Disabled PDF.js runtime WASM asset loading for this milestone so PDF rendering does not depend on additional runtime codec files.

### Privacy

- Overlay content remains in browser memory only; it is not uploaded or persisted by the app.
- Runtime external connections remain blocked with `connect-src 'none'`.

### Not yet included

- Handwritten signatures, initials, and image/stamp placement.
- Existing AcroForm editing.
- Completed PDF export.

## 0.1.0 - PDF Foundation - 2026-09-22

### Added

- Created PDF Fill & Sign from the current Browser Kitty `htmlapps-template`.
- Added one-file PDF loading through file picker and desktop Drag & Drop with a 100 MiB guard.
- Added pinned PDF.js 6.3.289 and its Worker through the template dependency pipeline.
- Added page rendering, previous/next navigation, lazy thumbnails, fit-to-width, and manual zoom controls.
- Added Japanese / English UI and local-processing help copy.
- Added user-facing errors for invalid, password-protected, oversized, and memory-constrained PDF cases.

### Changed

- Realigned the application shell, header, version badge, page intro, local-processing badge, help dialog, toast, confirmation component, design tokens, and responsive behavior with the latest `htmlapps-template`.
- Synced generic template infrastructure under `scripts/`, `components/`, `schemas/`, `.github/`, and the standalone builder to the current template snapshot. The two standalone verification scripts carry only a minimal fixture-only compatibility patch; real output still requires the canonical favicon and header icon.
- Replaced the canonical `assets/favicon.svg` with the supplied PDF Fill & Sign artwork. The template build embeds this exact SVG as both the browser favicon and the upper-left application icon.
- Replaced the starter `APP_SPEC.md` with the formal PDF Fill & Sign v1.0 product contract and v0.1.0–v1.0.0 development plan.

### Privacy

- Runtime external connections remain blocked with `connect-src 'none'`.
- Selected PDFs are processed in the browser and are not uploaded by the app.

### Not yet included

- Text/date/mark overlays.
- Signatures and image/stamp placement.
- Existing form editing.
- Completed PDF export.
