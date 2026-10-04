# Duplicate selected PDF overlays

Goal: duplicate a selected addition on its current page through the inspector or Ctrl/Cmd+D.
Architecture: reuse cloneOverlayItem, viewport transforms, and commitMutation so appearance, normalized vector strokes, selection, and Undo/Redo remain consistent. No dependencies or shared infrastructure changes.
Spec: APP_SPEC.md, selected-overlay duplication requirements.

- [x] Add Node regression tests against extracted real application functions: all types, nested stroke isolation, fresh IDs, page/geometry bounds including rotation, Undo/Redo selection, absent/stale selection, and busy guards. Run red.
- [x] Implement duplicateSelected in src/index.template.html, localized inspector action, and shortcut with editable-focus/modal guards. Run green.
- [x] Update APP_SPEC, both READMEs, help and CHANGELOG.
- [x] Run repository syntax/build/checks and Node PDF round-trip tests for 0/90/180/270-degree pages (14 annotations per page).
- [ ] Browser desktop/mobile QA, image export round-trip, file download naming, and help reachability remain unverified: browser launch is blocked by the execution environment.
- [ ] Return branch, commit, diff, and evidence for independent parent review before publication.

Review focus: rotated/cropped pages; page-sized additions; repeated duplication; focus inside PDF form/inspector/contenteditable; no accidental duplication during export or dialogs.
