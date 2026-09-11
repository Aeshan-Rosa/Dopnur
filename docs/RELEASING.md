# Desktop releases

## Prerequisites

Use Node.js 22.22+ and `npm ci`. Run `npm run assets` and `npm run setup:compiler` on the target host. The Tectonic binary must match the target architecture; this repository pins version 0.17.0 and checks the publisher’s SHA-256 release digest.

Run `npm run check`, `npm audit`, and `npm run test:desktop` before release. Inspect generated screenshots in `.test-artifacts/`. The desktop suite creates an isolated profile and a localhost API fixture, with no paid-provider calls.

## macOS

`npm run dist:mac` builds a DMG and ZIP for the host architecture. Native ARM64 and Intel runners should each download the corresponding compiler. Do not cross-package an ARM64 compiler inside an Intel app.

For public distribution, provide an Apple Developer ID certificate through the standard electron-builder `CSC_LINK` and `CSC_KEY_PASSWORD` secrets. Add notarization using `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, or an App Store Connect API key supported by electron-builder. Unsigned development builds are only for local testing and may be blocked by Gatekeeper on another machine.

## Windows

Use a Windows x64 runner, then `npm run dist:win -- --x64`. The NSIS wizard supports a chosen installation directory and a desktop shortcut.

Development builds set `win.signExecutable: false` while retaining executable icon and metadata editing. For a signed release, enable signing explicitly and provide the publisher certificate.

macOS can produce an unsigned cross-build after `DOPNUR_TARGET=win32-x64 npm run setup:compiler`. This does not validate Windows behavior. Before public release, exercise actual Windows installation/uninstallation, compilation, paths with spaces, OS key encryption, CLI discovery, cancellation, and npm-installed CLI shims. Provide a publisher signing certificate using electron-builder’s Windows signing configuration. Unsigned installers may trigger SmartScreen.

## CI

`.github/workflows/desktop.yml` builds on native macOS and Windows hosts and uploads build artifacts. It does not create a public release or upload source to any additional service. The end-to-end suite is run on macOS; Windows artifacts still require an interactive smoke test.

## Third-party notices

The app includes Electron/Chromium, PDF.js, CodeMirror, DM Sans, JetBrains Mono, Lora, Lucide icons, fflate, and Tectonic. Their license files must travel with the packaged application. The setup script and release metadata identify the exact Tectonic binary. Tectonic’s MIT license is in `resources/TECTONIC-LICENSE`. Electron includes its Chromium third-party notices in the installed distribution.
