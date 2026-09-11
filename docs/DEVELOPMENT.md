# Developing Dopnur

## Development

Requires Node.js 22.22+ and npm.

```sh
npm ci
npm run assets
npm run setup:compiler
npm run dev
```

The compiler setup downloads a pinned official Tectonic release and checks its SHA-256 digest. Generated icons, the sample figure, and a real sample PDF are already included. To regenerate the PDF after changing the article template:

```sh
node scripts/create-sample.mjs
```

`npm run dev` starts Vite and the native Electron window together. `npm run dev:ui` is only a renderer-development server: the UI requires the desktop bridge and deliberately does not pretend native features work in a browser.

```sh
npm run check          # TypeScript, production build, service tests
npm run test:desktop   # Native Electron end-to-end test and screenshots
npm audit             # Dependency security audit
npm run dist:mac       # macOS DMG and ZIP, current architecture
npm run dist:win       # Windows NSIS installer
```

For a Windows cross-build, first run `DOPNUR_TARGET=win32-x64 npm run setup:compiler` and then `npm run dist:win -- --x64`. Native Windows builds are the preferred validation route. The checked-in GitHub Actions workflow builds on both macOS and Windows without publishing anything automatically.

## Where your work lives

- macOS: `~/Library/Application Support/dopnur/`
- Windows: `%APPDATA%/dopnur/`
- Packaged builds can use the product name’s capitalization for this directory; Electron’s `app.getPath('userData')` is authoritative.

Projects are JSON documents under `projects/`, containing UTF-8 text and base64 binary assets. Revisions live in `history/`. Archived projects move into `archive/` and can be recovered from those JSON files. PDFs are cached separately. Folder imports copy files into this library; they do not edit the source folder in place. Export ZIPs for portable backups. Do not edit a project’s storage JSON while Dopnur is running.


## Project structure

```text
electron/      Native window, storage, compiler, agent, and IPC
src/           React workspace, CodeMirror editor, and PDF.js preview
shared/        Templates and the sample document assets
resources/     App icon, compiler license, downloaded compiler binaries
scripts/       Development, packaging, assets, and desktop checks
tests/         Native service tests
docs/          Screenshots, setup, architecture, and verification
```

See [the implementation plan](PLAN.md), [verification notes](VERIFICATION.md), and [release instructions](RELEASING.md).

[Back to Dopnur](../README.md)
