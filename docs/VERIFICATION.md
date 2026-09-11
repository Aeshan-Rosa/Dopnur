# Verification — Dopnur 0.1.0

Verified on macOS ARM64 on 11 September 2026.

## Completed checks

- TypeScript strict compilation and a Vite production build pass.
- All 14 automated service tests pass.
- All 17 desktop end-to-end checks pass in an isolated Electron profile.
- The packaged macOS app launches as a packaged application, discovers its own bundled Tectonic binary, compiles a real LaTeX document, and renders the resulting PDF with no renderer exceptions.
- npm audit reported zero known vulnerabilities after upgrading PDF.js and Sharp to patched versions and installing the formatter.
- macOS DMG/ZIP and a Windows x64 NSIS installer were built locally. No files were published.

## Service coverage

The service suite checks portable path restrictions, traversal attempts, Windows reserved file names, duplicate files, invalid main documents, ZIP round trips with Unicode and binary data, ZIP wrapper handling, symlink exclusion, atomic save ordering, independent revision snapshots, source fingerprints for PDF freshness, parsed compiler diagnostics, literal subprocess argument passing, cancellation, API URL rules, HTTP request formatting, agent proposal validation, and concurrent-edit conflicts.

## Desktop coverage

1. Launch with a real, precompiled sample PDF.
2. Edit in CodeMirror and verify that autosave reaches native project storage.
3. Recompile using the real bundled Tectonic engine.
4. Reject invalid LaTeX with diagnostics while retaining the previous PDF.
5. Automatically compile after an edit, even after autosave has completed.
6. Create a nested LaTeX file.
7. Add and display a bibliography entry.
8. Save a revision and verify it on disk.
9. Export a valid source ZIP and PDF through native-dialog handlers.
10. Re-import the exported ZIP and preserve its files.
11. Open the agent panel and connection preferences.
12. Send a request to a localhost mock API, review its diff, approve it, insert the changes, and verify the automatic pre-edit snapshot.
13. Display the project library and templates.
14. Persist and apply light/dark preferences.
15. Fit the workspace into a 1080 × 760 desktop window without document overflow.
16. Complete without renderer exceptions.
17. Close the native window immediately after an edit and verify that pending changes are saved.

## Visual review

The workspace, project library, agent panel, connection preferences, revision diff, compact layout, and dark appearance were rendered and inspected. Clean screenshots from the actual packaged application are in `docs/screenshots/`.

## Deliberately unverified

- No live paid-provider requests were made. Installed Codex and Claude CLI help output and current official documentation were used to verify the integration flags. Actual account authentication, quotas, and model availability must be checked with the user’s configured provider.
- The Windows installer was cross-built on macOS. Windows installation, OS credential encryption, native CLI execution, and process cancellation still require a real Windows smoke test.
- Intel macOS was not tested or packaged in this session.
- Publisher signing, Apple notarization, clean-machine Gatekeeper/SmartScreen behavior, automatic updating, and broad TeX-package compatibility are not claimed.
- The included sample article, invalid-source path, and regular local build were compiled. This is not a compatibility certification for every LaTeX document or package.

## Reproduce

```sh
npm ci
npm run setup:compiler
npm run check
npm run test:desktop
npm audit
```

For the packaged Mac smoke test, build the ARM64 macOS package first, then run `node scripts/packaged-smoke.mjs`. Test reports and intermediate screenshots are written into `.test-artifacts/`; test profiles are isolated under `.test-profile/` and ignored by Git.
