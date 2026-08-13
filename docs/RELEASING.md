# Releasing FoxBridge

This guide explains how maintainers build and distribute FoxBridge installers. It is written for someone comfortable with basic command-line steps but not necessarily an expert in Electron packaging.

**Volunteers and event staff who only install FoxBridge do not need Node.js, Git, or any developer tools.** They receive a `.dmg` (Mac) or `.exe` installer (Windows) and follow the installation steps below.

---

## Prerequisites

### For maintainers who build installers

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **v20.x** is currently used in this project (e.g. v20.19.2). Use a current Node 20 LTS release. GitHub Actions Windows builds also use Node 20. |
| **npm** | Comes with Node.js. Run `npm install` from the repository root after cloning or pulling changes. |
| **macOS (for Mac DMGs)** | Build on a Mac. The current Mac target is a **universal** DMG (Apple Silicon + Intel). |
| **Windows builds** | Prefer GitHub Actions (`windows-latest`) or a Windows PC. Cross-compiling NSIS from macOS requires Wine and is **not** set up on typical Macs. |
| **Xcode Command Line Tools** | Required on macOS for native module rebuilds (`better-sqlite3`) and for `iconutil` when regenerating icons. |

After `npm install`, the `postinstall` script rebuilds `better-sqlite3` for Electron automatically. If you see `NODE_MODULE_VERSION` errors, run:

```bash
npm run rebuild:native
```

### Icon regeneration only (optional)

Desktop icons live in `build/`. They were generated from `apps/mobile/public/icon.svg`. To regenerate them locally you typically need:

- **ImageMagick** (`magick`) — rasterize SVG to PNG and build `.ico`
- **iconutil** (macOS) — bundle `.icns` from a `.iconset` folder

Existing files:

- `build/icon.icns` — macOS
- `build/icon.ico` — Windows (multiple sizes; do not replace lightly)
- `build/icon.png` — high-resolution source raster

Do not modify the mobile icon in `apps/mobile/public/` when updating desktop icons unless the product team intentionally changes branding.

### For end users who install FoxBridge

| Requirement | Notes |
|-------------|--------|
| **macOS** | Universal DMG supports Apple Silicon and Intel Macs. |
| **Windows** | 64-bit Windows (`x64`). Install the NSIS `.exe` (no Node.js required). |
| **Brother label printer** | Install the Brother driver for your model on **each** computer that will print badges. FoxBridge uses the system print dialog / installed printer names. |
| **Network** | Internet access for RegFox sync and optional mobile cloud features. |

End users do **not** need Node.js, npm, Git, Cursor, or a development server.

---

## Version numbering

FoxBridge follows [semantic versioning](https://semver.org/) in `package.json`:

| Version | Meaning |
|---------|---------|
| **0.1.0** | Initial downloadable release |
| **0.1.1** | Bug fix (backward compatible) |
| **0.1.2** | Sprint 17 badge/book updates |
| **0.2.0** | New backward-compatible feature |
| **1.0.0** | Stable release |

**Before building a new public release**, update the `"version"` field in **both** `package.json` and `package-lock.json`. The installer filename and in-app version both come from this value.

Do not change the version for internal test builds unless you intend to distribute that build outside the team.

---

## Building the Mac installer

From the repository root on a Mac:

```bash
npm install
npm run build
npm run dist:mac
```

### What each step does

1. **`npm install`** — Installs dependencies and rebuilds native modules for Electron.
2. **`npm run build`** — Type-checks TypeScript and builds the renderer (`dist/`) and Electron bundles (`dist-electron/`).
3. **`npm run dist:mac`** — Runs the build again, then packages with **electron-builder** into a signed-ready but currently **unsigned** universal `.dmg`.

### Expected output

Installers are written to `release/` (this folder is gitignored).

```text
release/FoxBridge-<version>-mac-universal.dmg
```

Example:

```text
release/FoxBridge-0.1.2-mac-universal.dmg
```

An unpacked `.app` for local smoke testing can be produced with:

```bash
npm run pack:mac
```

**Important:** `pack:mac` builds for the **host architecture only**. On Apple Silicon that yields an **ARM64-only** app that Intel Macs reject. For multi-Mac validation and production-style packages, always use **`npm run dist:mac`** (universal: `x86_64` + `arm64`).

---

## Building the Windows installer

### Option A — GitHub Actions (recommended from a Mac)

1. Push your changes to GitHub (or run the workflow on the branch you care about).
2. Open the repository on GitHub → **Actions** → **Build Windows Installer**.
3. Choose **Run workflow** (`workflow_dispatch`), or push a `v*` tag.
4. When the job finishes, download the artifact named like:

```text
FoxBridge-<version>-win-x64
```

5. Extract the NSIS installer, typically named:

```text
FoxBridge-<version>-win-x64.exe
```

The workflow runs `npm ci`, the desktop build, meal/payment/badge/book tests, then `npm run dist:win`. It uploads the `.exe` as an **artifact only** — it does **not** create a GitHub Release or require code-signing secrets.

### Option B — Local Windows machine

```bash
npm install
npm run build
npm run dist:win
```

Expected output:

```text
release/FoxBridge-<version>-win-x64.exe
```

### Cross-compiling from macOS

Current **electron-builder** can often produce the Windows NSIS `.exe` on a Mac by downloading portable NSIS tooling (Wine is not always required). If packaging fails on your Mac, use GitHub Actions (`windows-latest`) or a Windows PC instead of installing Wine system-wide.

Still **smoke-test the installer on a real Windows computer** before distributing it to volunteers. A `.exe` produced on macOS is a packaging artifact, not a substitute for Windows runtime verification.

### Windows installer behavior

| Item | Behavior |
|------|----------|
| Format | NSIS `.exe` |
| Arch | `x64` only |
| Shortcuts | Desktop + Start Menu (“FoxBridge”) |
| Uninstall | Available through Windows Apps & features / the NSIS uninstaller |
| Signing | Currently **unsigned** |
| Secrets | Same as Mac: RegFox credentials and any **local** privileged Cloud key live under Electron `userData` via `safeStorage` (or a local fallback). **Never** bake a service-role / privileged Cloud key into the installer. Optional non-secret FoxBridge Cloud public defaults (`FOXBRIDGE_CLOUD_URL`, `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY` / `FOXBRIDGE_CLOUD_ANON_KEY`, `FOXBRIDGE_SCANNER_URL`) may be injected at packaging/CI time. |

### Microsoft Defender SmartScreen

The first launch of an **unsigned** Windows build may show a SmartScreen warning (“Windows protected your PC”). That is expected until Authenticode signing is configured. Users who trust the build can choose **More info** → **Run anyway**. Only install FoxBridge from a known organizational source.

### Brother printing on Windows (verification status)

| Verified | Not verified |
|----------|--------------|
| App opens without a printer installed | Physical Brother QL-820NWB badge print quality on Windows |
| Printer list uses Electron / Windows printer names | Exact media sizes / tape cut options vs macOS CUPS |
| `webContents.print()` path is used (same as Mac AirPrint path) | Silent/production Brother driver options |

**Install Brother’s Windows driver separately** on each PC before expecting label output. FoxBridge does **not** bundle Brother drivers. Do not treat Windows badge printing as production-ready until a Brother print has been smoke-tested on a real Windows computer.

macOS-only CUPS helpers (`lpstat` for remembering the last queue) are **not** run on Windows; Windows falls back to the selected Electron printer name.

---

## Where installers are produced

| Platform | Local output folder | Typical filename |
|----------|---------------------|------------------|
| macOS | `release/` | `FoxBridge-<version>-mac-universal.dmg` |
| Windows | `release/` | `FoxBridge-<version>-win-x64.exe` |

`release/` is gitignored. **Never commit** `.dmg`, `.exe`, `.app`, SQLite databases, `.env`, or attendee dumps.

---

## Testing before distribution

Run through this checklist on a clean machine **without** Cursor or `npm run dev` running. Test the **installed** app, not only the development server.

- [ ] Application launches
- [ ] Setup wizard appears on first run, or existing configuration loads on upgrade
- [ ] RegFox sync / update registrations works
- [ ] Attendee search works
- [ ] Badge preview renders correctly
- [ ] QR code displays on the badge
- [ ] RegFox check-in works (including “already checked in” handling)
- [ ] Meal validation works
- [ ] Payment status display works
- [ ] Print dialog opens (when a printer is present)
- [ ] Physical Brother label prints acceptably (**Mac verified historically; Windows TBD**)
- [ ] Quit and reopen — state persists
- [ ] Settings and local database persist across restart
- [ ] App runs with Cursor and development servers closed

### FoxBridge Sync production packaging (Sprint 21.9)

For Sync-ready installers (Clean desk enrollment without Settings → Advanced):

1. Follow **[`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md)** — migrations through **019** (Sprint 23 check-in/audit), deploy all required `desktop-*` Edge Functions (including check-in + upstream reconciliation), bootstrap conference + enrollment/Principal as needed.
2. Build Desktop with public packaging env (never service-role):

```bash
export FOXBRIDGE_CLOUD_URL='https://YOUR_PROJECT.supabase.co'
export FOXBRIDGE_CLOUD_PUBLISHABLE_KEY='YOUR_ANON_OR_PUBLISHABLE_KEY'
export FOXBRIDGE_SCANNER_URL='https://scanner.your-conference.example.com'
npm run dist:mac   # or npm run dist:win
```

3. Build and host the Scanner PWA with matching `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` at the HTTPS origin used for `FOXBRIDGE_SCANNER_URL`.
4. Run the clean-install validation checklist in [`FOXBRIDGE_SYNC_DEPLOYMENT.md`](./FOXBRIDGE_SYNC_DEPLOYMENT.md) §3 on a machine with no prior FoxBridge userData.

**Sprint 21.10:** That clean-install path was validated **PASS** (packaged Mac Desktop, desk enrollment, one-scan phone pairing via `https://fox-bridge.vercel.app`, meal → Cloud → Desktop Sync → SQLite, restart persistence) **without** a local service-role key.

Repo automated readiness (does **not** replace live Cloud E2E):

```bash
npm run test:sync-deployment-readiness
```

**Note:** `.github/workflows/build-windows.yml` does not currently inject `FOXBRIDGE_CLOUD_*`. Wire CI secrets/vars before treating that workflow artifact as Sync-ready for organizers.

Record any failures before sending the installer to volunteers.

---

## Installing an update (macOS)

Users can upgrade by replacing the application bundle. Their data is stored separately and should remain intact.

1. **Quit FoxBridge** completely (FoxBridge menu → Quit, or Cmd+Q).
2. Open the **newer** `.dmg` file.
3. Drag **FoxBridge** into the **Applications** folder.
4. When macOS asks to **Replace** the existing app, choose **Replace**.
5. Reopen FoxBridge from Applications.

Settings, secrets, and the local SQLite database live under Electron **userData**, not inside the `.app` bundle. Replacing the app should **not** delete conference configuration or validation history.

**Important:** Before a high-stakes event, back up the userData folder (see [Data locations](#data-locations)). Do not delete userData during an update.

---

## Installing on Windows

1. Double-click `FoxBridge-<version>-win-x64.exe`.
2. Follow the NSIS prompts (optional install directory).
3. Finish the installer (desktop and Start Menu shortcuts are created).
4. Open **FoxBridge** from the Start Menu or desktop shortcut.
5. If SmartScreen blocks the first open, use **More info** → **Run anyway** only for a trusted build.

To uninstall: Windows **Settings → Apps** → FoxBridge → Uninstall (or the uninstaller from the install folder).

---

## macOS Gatekeeper

The current FoxBridge build is **unsigned** and **not notarized**. macOS may block or warn on first launch. This is expected until Apple Developer signing is configured.

### Safe first launch

1. **Right-click** (or Control-click) **FoxBridge** in Applications.
2. Choose **Open**.
3. In the dialog, click **Open** again to confirm.

Alternatively, if macOS shows that FoxBridge was blocked:

1. Open **System Settings** → **Privacy & Security**.
2. Scroll to the security message about FoxBridge.
3. Click **Open Anyway** (wording may vary by macOS version).

Only open FoxBridge from a source you trust (your organization’s build maintainer).

**Do not** disable Gatekeeper globally or run broad “allow everything” security bypass commands. Those weaken the whole Mac, not just FoxBridge.

---

## Data locations

### macOS

```text
~/Library/Application Support/foxbridge
```

### Windows

```text
%APPDATA%\foxbridge
```

Typical contents (no secret values listed here):

| Item | Purpose |
|------|---------|
| **Settings** | Conference setup, language, feature toggles (`settings/app-settings.json`) |
| **Encrypted or protected secrets** | RegFox API key and similar credentials (`settings/secrets.bin` or fallback store) |
| **SQLite database** | Meal validations and related local records (`foxbridge.db`) |
| **Printer preference** | Last successful printer name for the print dialog |
| **Cloud publish state** | Last publish metadata when mobile cloud sync is configured |

**Maintainers:** Do not delete this folder when installing or testing an update. Deleting it forces a full re-setup and loses local validation history.

To back up before an event, copy the entire `foxbridge` folder to safe storage.

---

## Rollback

If a new release causes problems, you can reinstall an **older** installer while keeping user data:

1. Quit FoxBridge.
2. Install the older package (Mac: replace the `.app` from an older DMG; Windows: run the older NSIS installer or reinstall after uninstall).
3. Reopen FoxBridge.

User data under `userData` is left in place unless you delete it manually.

**Warning:** Rollback is safe only while database schema changes remain backward compatible. A future release that runs **irreversible SQLite migrations** may make downgrading unsafe without restoring a database backup from before the upgrade.

---

## Future release improvements

Planned but **not implemented** yet:

- Apple code signing and notarization
- Windows Authenticode signing
- GitHub Releases publishing (workflow currently uploads artifacts only)
- Automatic in-app updates

---

## Related npm scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Type-check and compile app assets (no installer) |
| `npm run pack:mac` | Unpacked macOS app for quick Mac smoke tests |
| `npm run pack:win` | Unpacked Windows `dir` target (local Windows / CI tooling) |
| `npm run dist` | Build installers for all configured platforms |
| `npm run dist:mac` | Build the macOS universal `.dmg` |
| `npm run dist:win` | Build the Windows x64 NSIS `.exe` |

See also [`PROJECT_STATE.md`](./PROJECT_STATE.md) for overall product status.
