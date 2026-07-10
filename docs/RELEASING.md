# Releasing FoxBridge

This guide explains how maintainers build and distribute FoxBridge installers. It is written for someone comfortable with basic command-line steps but not necessarily an expert in Electron packaging.

**Volunteers and event staff who only install FoxBridge do not need Node.js, Git, or any developer tools.** They receive a `.dmg` (Mac) or installer (Windows, when available) and follow the installation steps below.

---

## Prerequisites

### For maintainers who build installers

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **v20.x** is currently used in this project (e.g. v20.19.2). Use a current Node 20 LTS release. |
| **npm** | Comes with Node.js. Run `npm install` from the repository root after cloning or pulling changes. |
| **Apple Silicon Mac** | The current Mac DMG is **arm64 only**. Build it on an Apple Silicon Mac (M1/M2/M3/M4 or later). |
| **Xcode Command Line Tools** | Required on macOS for native module rebuilds (`better-sqlite3`) and for `iconutil` when regenerating icons. |

After `npm install`, the `postinstall` script rebuilds `better-sqlite3` for Electron automatically. If you see `NODE_MODULE_VERSION` errors, run:

```bash
npm run rebuild:native
```

### Icon regeneration only (optional)

Desktop icons live in `build/`. They were generated from `apps/mobile/public/icon.svg`. To regenerate them locally you typically need:

- **ImageMagick** (`magick`) — rasterize SVG to PNG and build `.ico`
- **iconutil** (macOS) — bundle `.icns` from a `.iconset` folder

Do not modify the mobile icon in `apps/mobile/public/` when updating desktop icons unless the product team intentionally changes branding.

### For end users who install FoxBridge

| Requirement | Notes |
|-------------|--------|
| **macOS** | Apple Silicon Mac for the current `arm64` build. Intel Macs are not supported by this installer yet. |
| **Brother label printer** | Install the Brother driver for your model on each computer that will print badges. FoxBridge uses the system print dialog; the driver must be available to macOS. |
| **Network** | Internet access for RegFox sync and optional mobile cloud features. |

End users do **not** need Node.js, npm, Git, Cursor, or a development server.

---

## Version numbering

FoxBridge follows [semantic versioning](https://semver.org/) in `package.json`:

| Version | Meaning |
|---------|---------|
| **0.1.0** | Initial downloadable release |
| **0.1.1** | Bug fix (backward compatible) |
| **0.2.0** | New backward-compatible feature |
| **1.0.0** | Stable release |

**Before building a new public release**, update the `"version"` field in `package.json`. The installer filename and in-app version both come from this value.

Do not change the version for internal test builds unless you intend to distribute that build outside the team.

---

## Building the Mac installer

From the repository root:

```bash
npm install
npm run build
npm run dist:mac
```

### What each step does

1. **`npm install`** — Installs dependencies and rebuilds native modules for Electron.
2. **`npm run build`** — Type-checks TypeScript and builds the renderer (`dist/`) and Electron bundles (`dist-electron/`).
3. **`npm run dist:mac`** — Runs the build again, then packages with **electron-builder** into a signed-ready but currently **unsigned** `.dmg`.

### Expected output

Installers are written to `release/` (this folder is gitignored).

Naming pattern:

```text
release/FoxBridge-<version>-mac-<arch>.dmg
```

Example for version `0.1.0` on Apple Silicon:

```text
release/FoxBridge-0.1.0-mac-arm64.dmg
```

An unpacked `.app` for local smoke testing can be produced with:

```bash
npm run pack:mac
```

Output: `release/mac-arm64/FoxBridge.app`

**Current limitation:** Mac builds target **arm64 only**. Universal or Intel (`x64`) builds are not configured yet.

---

## Testing before distribution

Run through this checklist on a Mac **without** Cursor or `npm run dev` running. Test the **installed** app from `/Applications/FoxBridge.app` (or the unpacked `.app`), not only the development server.

- [ ] Application launches
- [ ] Setup wizard appears on first run, or existing configuration loads on upgrade
- [ ] RegFox sync / update registrations works
- [ ] Attendee search works
- [ ] Badge preview renders correctly
- [ ] QR code displays on the badge
- [ ] RegFox check-in works (including “already checked in” handling)
- [ ] Meal validation works
- [ ] Print dialog opens
- [ ] Physical Brother label prints acceptably (layout issues are a known area to watch)
- [ ] Quit and reopen — state persists
- [ ] Settings and local database persist across restart
- [ ] App runs with Cursor and development servers closed

Record any failures before sending the DMG to volunteers.

---

## Installing an update

Users can upgrade by replacing the application bundle. Their data is stored separately and should remain intact.

1. **Quit FoxBridge** completely (FoxBridge menu → Quit, or Cmd+Q).
2. Open the **newer** `.dmg` file.
3. Drag **FoxBridge** into the **Applications** folder.
4. When macOS asks to **Replace** the existing app, choose **Replace**.
5. Reopen FoxBridge from Applications.

Settings, secrets, and the local SQLite database live under Electron **userData**, not inside the `.app` bundle. Replacing the app should **not** delete conference configuration or validation history.

**Important:** Before a high-stakes event, back up the userData folder (see [Data locations](#data-locations)). Do not delete userData during an update.

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

On macOS, FoxBridge stores persistent data at:

```text
~/Library/Application Support/foxbridge
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

If a new release causes problems, you can reinstall an **older** DMG while keeping user data:

1. Quit FoxBridge.
2. Mount the older `.dmg` and drag FoxBridge to Applications, replacing the current version.
3. Reopen FoxBridge.

User data in `~/Library/Application Support/foxbridge` is left in place unless you delete it manually.

**Warning:** Rollback is safe only while database schema changes remain backward compatible. A future release that runs **irreversible SQLite migrations** may make downgrading unsafe without restoring a database backup from before the upgrade.

---

## Windows status

- The **Windows installer has not yet been built or tested** in this project.
- **`build/icon.ico`** is prepared for future Windows packaging.
- Windows packaging, Brother printing, and driver behavior must be verified on a real Windows PC before distribution.

The `npm run dist:win` script exists for maintainers but should not be treated as production-ready until tested.

---

## Future release improvements

Planned but **not implemented** yet:

- Apple code signing
- Apple notarization
- GitHub Releases publishing
- Automatic in-app updates
- Windows CI builds
- Universal macOS builds (arm64 + x64)

---

## Related npm scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Type-check and compile app assets (no installer) |
| `npm run pack:mac` | Unpacked `FoxBridge.app` for quick Mac smoke tests |
| `npm run dist` | Build installers for all configured platforms |
| `npm run dist:mac` | Build the macOS `.dmg` |
| `npm run dist:win` | Build Windows installer (not yet validated) |

See also [`PROJECT_STATE.md`](./PROJECT_STATE.md) for overall product status.
