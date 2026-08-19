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
| **macOS (for Mac DMGs)** | **Production** Mac releases are built on GitHub Actions (`macos-latest`): universal DMG + ZIP, Developer ID signed, notarized. **Local** `npm run dist:mac` remains an unsigned smoke build and does not require Apple credentials. |
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

**Before building a new public release**, update the `"version"` field in **both** `package.json` and `package-lock.json`. The installer filename, in-app version, Git tag, and GitHub Release name all come from this value.

The production Mac workflow **fails** if you push tag `v0.1.3` while `package.json` still says `0.1.2`.

Do not change the version for internal test builds unless you intend to distribute that build outside the team. Do not tag `v0.1.2` as a GitHub Release after already distributing unsigned 0.1.2 installers — the next production update channel release should be a new version (for example `0.1.3`).

---

## Building the Mac installer

There are two Mac packaging paths. They must not be mixed up.

| Path | Command / trigger | Signing | GitHub Release | Use |
|------|-------------------|---------|----------------|-----|
| **Local unsigned smoke** | `npm run dist:mac` | No | No | Maintainer laptop checks without Apple credentials |
| **CI signed smoke** | Actions → **Release macOS** → Run workflow | Developer ID + notarize | **No** | Prove certificates before a public tag |
| **Production release** | Git tag `v<version>` matching `package.json` | Developer ID + notarize | **Yes** | Volunteer installers + future auto-update assets |

### Local unsigned smoke (no Apple credentials)

From the repository root on a Mac:

```bash
npm install
npm run dist:mac
```

This packages a **universal** DMG and ZIP with **signing and notarization disabled**. The script prints a warning. Do **not** give this build to volunteers as a production installer.

### Expected local output

Installers are written to `release/` (this folder is gitignored).

```text
release/mac-universal/FoxBridge.app
release/FoxBridge-<version>-mac-universal.dmg
release/FoxBridge-<version>-mac-universal.zip
release/latest-mac.yml
```

Example:

```text
release/FoxBridge-0.1.2-mac-universal.dmg
release/FoxBridge-0.1.2-mac-universal.zip
```

An unpacked `.app` for local smoke testing can be produced with:

```bash
npm run pack:mac
```

**Important:** `pack:mac` builds for the **host architecture only**. On Apple Silicon that yields an **ARM64-only** app that Intel Macs reject. Never publish `pack:mac` / `mac-arm64` output to the update channel. Production and multi-Mac packages must stay **universal** (`x86_64` + `arm64`).

### Production signed + notarized Mac release (GitHub Actions)

Production Mac builds run on **`macos-latest`** via [`.github/workflows/release-mac.yml`](../.github/workflows/release-mac.yml).

**Normal future Mac release path** (version-to-version upgrades):

1. Bump `package.json` **and** `package-lock.json`.
2. Run the Mac release tests (`test:packaged-cloud-config`, `test:mac-release-config`, Cloud/updater/UI tests, `npm run build`).
3. Commit and push `main`.
4. Tag **exactly** `v` + that version (`v0.1.5`) and push the tag. Do **not** create the GitHub Release by hand.
5. The tag-driven **Release macOS** workflow builds, signs (Developer ID + Hardened Runtime), notarizes, staples, verifies, and publishes the five-file GitHub Release.
6. Existing packaged FoxBridge installations discover the new GitHub Release (`latest-mac.yml`).
7. The operator chooses **Update Now** in Settings → Software Update.
8. The operator chooses **Restart & Update**.

Manual DMG installation remains for **first install and recovery**. It should **not** be required for normal version-to-version upgrades. Live-validated: **0.1.4 → 0.1.5** on both test Macs via the in-app flow (**PASSED**).

The signed app is submitted to Apple **once**. `scripts/notarize-mac-retry.sh` captures the Apple submission id and polls `notarytool info` until **Accepted** or **Invalid** (about **3 hours** overall, 60-second poll interval). Transient network errors retry the current submit/info call without creating a new submission after an id is known. **Invalid** fetches `notarytool log` and fails without resubmitting. After **Accepted** the ticket is stapled to the `.app`, then the universal DMG, ZIP, and `latest-mac.yml` are generated from that stapled app. Notarization uses Apple **notarytool** (not deprecated `altool`).

electron-builder packages with **`--publish never`**. A GitHub Release is created or updated only on a matching `v*` tag, **after** local verification of the complete five-file asset set, via `scripts/publish-github-mac-release.sh`. The job then checks that the GitHub Release contains every required name (`scripts/verify-github-mac-release.sh`) and fails if any file is missing.

GitHub Release `v<version>` **must** contain exactly these names:

```text
FoxBridge-<version>-mac-universal.dmg
FoxBridge-<version>-mac-universal.dmg.blockmap
FoxBridge-<version>-mac-universal.zip
FoxBridge-<version>-mac-universal.zip.blockmap
latest-mac.yml
```

The public GitHub repo is the update **provider** (`provider: github`, owner `Stevenco9`, repo `FoxBridge`). Installed apps read release metadata over HTTPS **without** a GitHub token in the client. **Do not** put `GH_TOKEN` or signing secrets in the packaged app.

### Mac release requirements (do not regress)

Every production Mac release must continue to preserve:

| Requirement | Why |
|-------------|-----|
| Developer ID Application signing | Gatekeeper |
| Hardened Runtime | Notarization / security |
| Apple notarization (`notarytool`) | First-launch trust |
| Stapling of the notarization ticket on the `.app` | Offline Gatekeeper |
| Universal `x86_64` + `arm64` artifacts | Intel + Apple Silicon |
| Packaged public Cloud configuration | Principal/Linked setup without local `.env` |
| No privileged Cloud / service-role credentials in the packaged app | Secret-model boundary |
| Complete five-file GitHub Release set | Humans (DMG) + updater (ZIP + yml + blockmaps) |
| `latest-mac.yml` matching the ZIP `sha512` and `size` | electron-updater integrity |
| Public GitHub updater feed (`private: false`, no client token) | In-app Software Update |
| User-confirmed download and Restart & Update | Do not interrupt an event |
| Stable app name, `appId` (`com.foxbridge.desktop`), and userData path | Preserve `~/Library/Application Support/foxbridge` |

Do not redesign these systems for a routine version bump.

### First signed smoke (no production Release)

Before the first public tag, run a signed dry run:

1. Open the repository on GitHub → **Actions** → **Release macOS**.
2. Choose **Run workflow** (`workflow_dispatch`) on the branch that contains this pipeline.
3. Wait for the job to finish (signing + Apple notarization can take several minutes).
4. Download the Actions artifact `FoxBridge-<version>-mac-universal`.
5. Confirm there is **no** new GitHub Release.

`workflow_dispatch` **never** publishes a GitHub Release. A GitHub Release is created only when a matching `v*` tag is pushed. That limitation is intentional.

### Required GitHub Actions secrets (names only)

Never commit these values. Never paste them into `package.json`, `.env`, or the Desktop app.

| Secret name | Purpose |
|-------------|---------|
| `MAC_CSC_LINK` | Base64-encoded Developer ID Application `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Password for that `.p12` |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password (not the Apple ID password) |
| `APPLE_TEAM_ID` | 10-character Apple Team ID |

The workflow maps `MAC_CSC_*` to electron-builder’s `CSC_LINK` / `CSC_KEY_PASSWORD` for the **sign/notarize** step only. Release upload uses the Actions `GITHUB_TOKEN` (`GH_TOKEN` in that step) — not a packaged credential.

### Required GitHub Actions Variables (public Cloud config)

Production Mac and Windows builds fail closed unless these repository **Variables** are set. They are public client configuration (baked into the Desktop binary by Vite). They are **not** secrets.

| Variable name | Purpose |
|---------------|---------|
| `FOXBRIDGE_CLOUD_URL` | HTTPS FoxBridge Cloud endpoint |
| `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY` | Publishable/anon client key (RLS). Never a service-role key. |
| `FOXBRIDGE_SCANNER_URL` | HTTPS scanner PWA origin used in pairing QR codes |

`release-mac.yml` and `build-windows.yml` pass these into `npm run build` only. A pre-build script (`npm run validate:packaged-cloud-env`) rejects missing, HTTP, placeholder, or privileged-looking values without printing the key. After compile, `npm run verify:packaged-cloud-bundle` requires the same values to be present in `dist-electron` **before** electron-builder signs or packages.

Do **not** add `SUPABASE_SERVICE_ROLE_KEY`, RegFox API keys, Apple credentials, or `GITHUB_TOKEN` to Vite or these Variables.

**Sprint 24.4 history:** signed CI `0.1.2` (workflow `32084525251`) and published **v0.1.3** were built without these Variables, so packaged Cloud defaults were empty. **v0.1.3 GitHub Release assets remain untouched.** **0.1.4** is the corrected Cloud-complete production baseline. **0.1.5** is the live-validated updater target. GitHub Actions may print Variable values in step `env:` log groups; that is platform behavior for `vars.*`. These values are public client configuration, not privileged credentials. Do **not** move them into the privileged secret model merely to hide that display. Future CI-log hygiene; **not a Sprint 24 blocker**.

### Signed local packaging (optional)

`npm run dist:mac:release` signs and notarizes on a Mac that already has the same environment variables set. It still uses `--publish never`. Ordinary development should keep using `npm run dist:mac` / `npm run dev` without Apple credentials.

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

The workflow validates public Cloud Variables, runs `npm ci`, the desktop build, a compiled-bundle Cloud guard, meal/payment/badge/book tests, then `npm run dist:win` (**`--publish never`**, with the same public Cloud Variables because that script rebuilds). It uploads the `.exe` as an **artifact only** — it does **not** create a GitHub Release or require code-signing secrets.

Pushing a `v*` tag also starts **Release macOS**. Windows stays artifact-only so it does not compete with Mac GitHub Release publishing. Do not redesign Windows auto-update yet.

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
| Secrets | Same as Mac: RegFox credentials and any **local** privileged Cloud key live under Electron `userData` via `safeStorage` (or a local fallback). **Never** bake a service-role / privileged Cloud key into the installer. Public FoxBridge Cloud defaults (`FOXBRIDGE_CLOUD_URL`, `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY`, `FOXBRIDGE_SCANNER_URL`) are injected at packaging/CI from GitHub Actions repository Variables. |

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
| macOS | `release/` | `FoxBridge-<version>-mac-universal.dmg` (human install) |
| macOS | `release/` | `FoxBridge-<version>-mac-universal.zip` + `latest-mac.yml` (updater feed) |
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

**Sprint 24.4A:** Mac and Windows production workflows inject GitHub Actions repository Variables `FOXBRIDGE_CLOUD_URL`, `FOXBRIDGE_CLOUD_PUBLISHABLE_KEY`, and `FOXBRIDGE_SCANNER_URL` into `npm run build`, then verify `dist-electron`. Jobs fail closed if public Cloud config is missing. Privileged/service-role credentials remain local-only.

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

**Production** Mac releases (GitHub Actions **Release macOS**, including tag publishes) are signed with **Developer ID Application**, use **Hardened Runtime**, and are **notarized** with Apple notarytool. Volunteers installing a production DMG should get a normal first-launch experience without Right-click → Open workarounds.

**Local `npm run dist:mac` builds remain unsigned.** macOS may block or warn on first launch of those smoke builds. That is expected.

### Safe first launch (unsigned local smoke only)

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

Signing and notarization do **not** change this path. The Electron `name` remains `foxbridge` (`appId` `com.foxbridge.desktop` is the bundle id, not the userData folder).

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

## Auto-update (Sprint 24 — live-validated on macOS)

FoxBridge uses **electron-updater** with the **public GitHub Releases** provider configured in `package.json` (`Stevenco9/FoxBridge`, `private: false`). Packaged apps read `app-update.yml` from `Resources/` — no GitHub token in the client.

| Policy | Value |
|--------|-------|
| `autoDownload` | `false` — user must explicitly download (Settings → Software Update) |
| `autoInstallOnAppQuit` | `false` — never force-restart |
| Startup check | ~45s after app ready (packaged only) |
| Periodic check | ~5 hours while app is open |
| Dev mode | Disabled when `!app.isPackaged` |

**Safe IPC:** `getUpdateStatus`, `checkForUpdates`, `downloadUpdate`, `restartAndInstallUpdate`, plus `update:statusChanged` push events. No arbitrary feed URL or credential parameters.

**Settings UI:** Operations Home ⚙ shows a green badge when an update is available or ready to install. Settings → **Software Update** provides Check for Updates, Update Now, download progress, and Restart & Update (with confirmation). Dev mode shows a quiet packaged-build message instead of updater errors.

**Status states:** `idle`, `checking`, `available`, `downloading`, `downloaded`, `upToDate`, `error`.

**Live validation (PASSED):** Both test Macs updated **0.1.4 → 0.1.5** from inside FoxBridge (Settings → Software Update). The GitHub Releases + `latest-mac.yml` feed worked; the update downloaded; Restart & Update relaunched at **0.1.5**; normal userData was preserved. Neither Mac used the 0.1.5 DMG for that upgrade. **v0.1.3** remains published and unmodified. **0.1.4** remains the corrected production baseline tag.

---

## Future release improvements

Planned but **not implemented** yet:

- Windows Authenticode signing
- Windows GitHub Release / auto-update publishing
- GitHub Actions `env:` log hygiene for public `FOXBRIDGE_CLOUD_*` Variables (do not move them into the privileged secret model)

Mac Developer ID signing, notarization, stapling, universal ZIP / `latest-mac.yml`, tag-driven GitHub Release publishing (Sprint 24.1), main-process electron-updater (Sprint 24.2), Settings Software Update UI (Sprint 24.3), production public Cloud packaging guards (Sprint 24.4A), and **live in-app 0.1.4 → 0.1.5 auto-update on both test Macs** are complete. Sprint 24 macOS auto-update validation **PASSED**. Do not replace v0.1.3 or v0.1.4 assets.

---

## Related npm scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Type-check and compile app assets (no installer) |
| `npm run pack:mac` | Unpacked macOS app for quick Mac smoke tests (**host arch only**) |
| `npm run pack:win` | Unpacked Windows `dir` target (local Windows / CI tooling) |
| `npm run dist` | Unsigned local installers; never publishes |
| `npm run dist:mac` | Unsigned universal Mac DMG + ZIP smoke (no Apple credentials) |
| `npm run dist:mac:release` | Signed + notarized universal Mac; does not publish a Release |
| `npm run dist:win` | Windows x64 NSIS `.exe` (`--publish never`) |
| `npm run validate:packaged-cloud-env` | Fail closed if public Cloud Variables are missing/invalid (no key logging) |
| `npm run verify:packaged-cloud-bundle` | Fail closed if compiled `dist-electron` lacks public Cloud defaults |
| `npm run test:packaged-cloud-config` | Assert Cloud env/bundle guard behavior |
| `npm run test:mac-release-config` | Assert Mac release pipeline configuration |
| `npm run test:update-manager` | Assert electron-updater UpdateManager policy and IPC wiring |
| `npm run test:software-update-ui` | Assert Settings update UI wiring, badge rules, and i18n |
| `npm run verify:mac-release` | After a pack: check ZIP/DMG/`latest-mac.yml`/universal arch (CI also checks signing) |
| `npm run verify:github-mac-release` | Fail if GitHub Release `v<version>` is missing any of the five Mac assets |

See also [`PROJECT_STATE.md`](./PROJECT_STATE.md) for overall product status.
