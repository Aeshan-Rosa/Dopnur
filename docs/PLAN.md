# Dopnur desktop implementation

## Product direction

A downloadable, local-first LaTeX studio for macOS and Windows. Preserve the familiar Overleaf workflow: project library, file tree, source editor, compiled PDF, bibliography, logs, and revisions. Give Dopnur its own warm, quiet identity: translucent ivory, evergreen, sage, and restrained terracotta. The app runs locally with no required Dopnur account or hosted backend.

## Architecture

- Electron main process owns project storage, native dialogs, compilation, encrypted secrets, and agent subprocesses.
- Sandboxed React renderer communicates through a narrow, validated preload bridge.
- CodeMirror provides LaTeX syntax, search/replace, autocomplete, selection, and undo.
- PDF.js renders real compiler output. A bundled sample PDF is explicitly identified until the first compilation.
- Tectonic is bundled by the release build; installed Tectonic, latexmk, and pdfLaTeX are detected as fallbacks. TeX packages may require a first-run download.
- Local JSON project documents include text and binary assets. Atomic persistence, source ZIP import/export, and independent revision snapshots provide portability and recovery.
- Codex/Claude subprocesses use the existing CLI authentication. API mode supports OpenAI Responses or an OpenAI-compatible Chat Completions endpoint. Credentials use Electron safeStorage.
- Agent context is supplied explicitly. Structured edits are reviewed against their original source; stale changes are rejected. CLI output is visible in a run console.

## Build sequence

1. Desktop shell, typed bridge, project storage and seed templates.
2. Polished library and three-pane workspace; editor, tabs, outlines, search.
3. Compilation, PDF controls, file/ZIP dialogs, diagnostic log, native menus.
4. Dopnur Agent connections, cancellation, proposed changes and review.
5. Bibliography library, revision history, focus session, shortcuts and settings.
6. Build, meaningful service tests, desktop interaction checks, visual inspection, local installer.

## Release boundaries

This version is a local single-user application. Server collaboration, tracked multi-author review, cloud sync, full visual LaTeX editing, and comprehensive TeX distribution compatibility are later milestones. Windows builds run in a Windows CI job. Public distribution requires publisher certificates and Apple notarization credentials supplied by the project owner.

## Reference documentation

- https://www.electronjs.org/docs/latest/tutorial/security
- https://docs.overleaf.com/navigating-in-the-editor/working-with-the-pdf-viewer
- https://developers.openai.com/codex/noninteractive/
- https://code.claude.com/docs/en/headless
- https://tectonic-typesetting.github.io/en-US/install.html

## Implementation result

All six build stages are implemented for the local desktop preview. The strict build, 14 service tests, 17 desktop checks, and a packaged macOS compilation smoke test pass. Native Mac and Windows installer artifacts are generated locally. See `VERIFICATION.md` for tested behavior and remaining platform/release limitations.
