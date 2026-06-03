# ICON_AUDIT — Electron desktop shortcut vs installer / window icons

**Root cause (audit conclusion)**  
The symptom (**generic white document icon on the Desktop shortcut only**, while the **NSIS installer shows the correct icon** and the **running app shows the correct title-bar/taskbar icon**) is best explained by **F — multiple mechanisms**, dominated by **B + C**:

- **B) Windows `.exe` icon embedding vs runtime icon file** — The **installer** icon comes from **`build.nsis.installerIcon`** (explicit ICO passed to the installer UI). The **running app** title bar uses **`BrowserWindow`** `{ icon: <path> }` loading **`skia-forge-app.ico`** from **`app.asar.unpacked`** (explicit path; see `main.ts` below). The **Desktop shortcut** is created by **NSIS** and normally inherits its displayed icon from the **target executable’s embedded application icon resource**, not from `BrowserWindow`. If Explorer fails to use or extract that embedded icon for the shortcut (resource layout, size layers, cache), the shortcut can fall back to a **generic document icon** while the other two surfaces still look correct.

- **C) NSIS shortcut defaults** — There is **no checked-in `.nsi`** script in this repository that explicitly sets **`CreateShortCut`** `Icon` / `IconIndex` to the branding ICO. **`electron-builder`** generates NSIS output from internal templates (see Step 3). Without a custom **`include`** script forcing shortcut icon parameters, shortcut icons rely on **defaults** (typically “take icon from target exe”). That matches **shortcut-specific** failure modes.

- **E)** is **not** the cause of “broken shortcut only,” because **`BrowserWindow` icon is explicitly set** when an ICO path resolves (`main.ts` lines 891–921).

- **A)** is **unlikely**: **`assets/skia-forge-app.ico`** exists and **`win.icon`** / **`build.icon`** are set in `skia-ide/package.json`.

- **D)** (Explorer icon cache only) **cannot be ruled out** per machine but does not explain consistent structural separation between installer UI vs shortcut vs runtime file icon.

---

## Step 1 — Icon-related files (`.ico`, `.png`, `.icns`)

Sizes were measured on disk **2026-05-10** (workspace: `c:\SKIA-Forge`). Re-validated **2026-06-03** — conclusions unchanged; no source changes applied for shortcut icon fix. Duplicate paths from build output are listed because they affect packaged layout.

| Full path | Size (bytes) | Referenced by |
|-----------|----------------|----------------|
| `c:\SKIA-Forge\assets\logo.png` | 804 427 | Web / branding usage (`public/logo.png` sibling); not Electron app icon in `package.json` |
| `c:\SKIA-Forge\public\favicon.ico` | 17 786 | Forge HTTP static routes / HTML favicons (`src/server.ts` serves `/favicon.ico`) |
| `c:\SKIA-Forge\public\logo.png` | 804 427 | Static marketing / sidebar imagery |
| `c:\SKIA-Forge\public\sidebar-logo.png` | 172 618 | Static pages / docs HTML |
| `c:\SKIA-Forge\public\skia-forge-favicon.png` | 287 275 | `src/server.ts` → `/favicon.png` |
| `c:\SKIA-Forge\skia-ide\assets\logo.png` | 804 427 | `skia-ide/webpack.config.js` copies to `dist/renderer/assets/logo.png`; renderer UI |
| `c:\SKIA-Forge\skia-ide\assets\sidebar-logo.png` | 172 618 | Same webpack copy; renderer UI |
| `c:\SKIA-Forge\skia-ide\assets\skia-forge-app.icns` | 1 604 962 | `skia-ide/package.json` → `build.mac.icon`, `build.files`, `asarUnpack` |
| `c:\SKIA-Forge\skia-ide\assets\skia-forge-app.ico` | 134 862 | **`build.icon`**, **`build.win.icon`**, **`build.nsis.installerIcon` / `uninstallerIcon`**, `files` / `asarUnpack`; **`main.ts`** window icon resolution |
| `c:\SKIA-Forge\skia-ide\assets\skia-forge-app.png` | 861 118 | `build.linux.icon`, `files` / `asarUnpack`; fallback name in `resolveAppWindowIcon` |

**Build artifacts (same bytes as sources where copied):**

| Path | Size (bytes) | Notes |
|------|----------------|-------|
| `skia-ide\dist\renderer\assets\*.ico` / `.png` / `.icns` | same as `skia-ide/assets` | Webpack `CopyWebpackPlugin` copies `assets/` into renderer bundle |
| `skia-ide\release\win-unpacked\resources\app.asar.unpacked\assets\skia-forge-app.ico` (etc.) | same | **`asarUnpack`** output beside packaged app |
| `skia-ide\release\win-unpacked\resources\assets\skia-forge-app.ico` (etc.) | same | **`extraResources`** copy from `dist/renderer/assets` → `resources/assets` |

**Extra asset (not `.ico/.png/.icns`):** `skia-ide/assets/skia_logo_forge_app.jpg` exists but is **not** referenced in `package.json` `build` icon keys.

---

## Step 2 — Build configuration

### Root `package.json` (`c:\SKIA-Forge\package.json`)

- **No `build` / `electron-builder` section.** This package is the Forge HTTP server (`main`: `dist/index.js`). Electron packaging for the desktop app lives under **`skia-ide/`**.

### `skia-ide/package.json` — `build` section (electron-builder)

Source file: `c:\SKIA-Forge\skia-ide\package.json` **lines 15–95**.

Extracted values:

| Setting | Value |
|---------|--------|
| **`build.directories.output`** | `"release"` — installers and unpacked binaries written under `skia-ide/release/` |
| **Global / Windows icon path** | **`"icon": "assets/skia-forge-app"`** (base name; electron-builder resolves `.ico` on Windows) |
| **`build.win.icon`** | **`"assets/skia-forge-app.ico"`** |
| **`build.win.target`** | **NSIS**, **`arch`: `["x64"]`** only |
| **`build.win.sign`** | `null` (no code signing in config) |
| **Installer artifact name** | **`artifactName`**: **`SKIA-FORGE-Setup-${version}-win-x64.exe`** (`build.nsis.artifactName`, **line 61**) |
| **`build.nsis`** | **`oneClick`: false**, **`allowToChangeInstallationDirectory`: true**, **`createDesktopShortcut`: `"always"`**, **`createStartMenuShortcut`: true**, **`installerIcon`**: **`assets/skia-forge-app.ico`**, **`uninstallerIcon`**: **`assets/skia-forge-app.ico`**, **`shortcutName`**: **`SKIA FORGE`** (**lines 54–62**) |
| **`build.executableName`** | **`SKIA-FORGE`** → produces **`SKIA-FORGE.exe`** (**line 18**) |
| **`build.productName`** | **`SKIA FORGE`** (**line 17**) |

**Squirrel:** Not configured. Windows target is **NSIS only**.

**Separate files:** No `electron-builder.yml` / `electron-builder.yaml`, **`forge.config.js`**, or **`electron-forge.config.js`** were found in the repo.

**`build/` directory:** No dedicated **`build/`** packaging folder for Electron beyond **`skia-ide/release/`** output.

---

## Step 3 — NSIS script (`.nsi`)

- **No `.nsi` files** anywhere under `c:\SKIA-Forge` (search for `*.nsi`: **0 files**).
- Shortcut creation is therefore entirely from **`electron-builder` / `app-builder-lib` generated NSIS** (not reviewed line-by-line here because it is **generated at publish time**, not stored in the repo).
- Implications:
  - **`CreateShortCut`** behavior is **not** overridden by this repository.
  - There is **no** checked-in control over **`Icon`** / **`IconIndex`** on the desktop shortcut unless **`build.nsis.include`** or similar is added (currently **absent**).

---

## Step 4 — Main process (`BrowserWindow`, `app.setIcon`)

**File:** `c:\SKIA-Forge\skia-ide\src\main\main.ts`

### `app.setIcon` / Dock

- **`app.setIcon`** is **not** called (grep: **no matches**).
- **`BrowserWindow`** is the mechanism used for window/taskbar branding.

### `resolveAppWindowIcon` — **lines 886–904**

Comment **lines 886–889** documents that icons **must be real files on disk**; **`asarUnpack`** exposes **`skia-forge-app.ico`** under **`app.asar.unpacked`**.

Logic:

1. **`fileNames`**: `["skia-forge-app.ico", "skia-forge-app.png"]` (**line 892**).
2. **Packaged:** **`process.resourcesPath/app.asar.unpacked`**, then **`path.join(root, "assets", name)`** → e.g. **`resources/app.asar.unpacked/assets/skia-forge-app.ico`** (**lines 894–901**).
3. **Fallback root:** **`path.resolve(__dirname, "../../assets")`** — then **`path.join(root, "assets", name)`** → **`…/skia-ide/assets/assets/skia-forge-app.ico`**.  
   - **Note:** Under **`skia-ide/assets`**, there is **no nested `assets/`** directory (only flat files). This fallback likely **does not resolve** in dev unless the first packaged branch ran. **Packaged** behavior uses **`app.asar.unpacked`** first (**lines 894–896**).

### Main window — **lines 912–941**

- **`createWindow`** uses **`...browserWindowIconOptions()`** (**lines 915–921**), which spreads **`{ icon: "<resolved path>" }`** when **`resolveAppWindowIcon()`** returns a path (**lines 907–910**).

### Other windows

- **`openLocalChangelog`** (**lines 195–201**): **`...browserWindowIconOptions()`**.
- **`showAboutWindow`** (**lines 206–218**): **`...browserWindowIconOptions()`**.
- Documentation / report windows around **796+**, **1082+**: additional **`BrowserWindow`** constructors exist — audit focused on primary **`createWindow`** and shared helper.

### Windows App User Model ID — **lines 35–37**

- **`app.setAppUserModelId("ca.skia.forge")`** on **`win32`** — affects taskbar grouping / Jump Lists; **not** the desktop shortcut `.lnk` icon by itself.

---

## Step 5 — Installer / unpacked output on disk (observed)

Under **`c:\SKIA-Forge\skia-ide\release`**:

| File | Size (bytes) |
|------|----------------|
| **`SKIA-FORGE-Setup-1.0.0-win-x64.exe`** | **102 868 109** |
| **`win-unpacked\SKIA-FORGE.exe`** | **177 038 336** |
| **`win-unpacked\resources\elevate.exe`** | **107 520** |

No **`dist/`** or **`out/`** Electron installers were found at repo root; **`skia-ide/package.json`** directs output to **`release/`**.

---

## Step 6 — Mapping symptoms to options A–F

| Option | Verdict | Evidence |
|--------|---------|----------|
| **A** Missing/wrong path in build config | **Unlikely** | **`win.icon`**, **`build.icon`**, **`nsis.installerIcon`** all point at existing **`skia-forge-app.ico`**. |
| **B** Icon not embedded / not used for shortcut | **Plausible (primary)** | Installer uses **explicit ICO** for wizard; runtime uses **explicit file path**; shortcut typically uses **exe embedded icon** — three different pipelines. |
| **C** NSIS shortcut without explicit ICO | **Plausible** | No custom **`.nsi`**; defaults rely on target **`SKIA-FORGE.exe`**. |
| **D** Windows icon cache only | **Possible** on some machines | Cannot confirm from repo alone. |
| **E** `BrowserWindow` icon unset | **Ruled out** for title-bar symptom | **`browserWindowIconOptions()`** applied to **`createWindow`** (**lines 915–921**). |
| **F** Combined | **Best match** | **B + C** (+ optional **D**). |

---

## Recommendations (informational — out of “read-only” scope for this audit)

1. Inspect **`SKIA-FORGE.exe`** with a PE/resource viewer (e.g. confirm RT_ICON / RT_GROUP_ICON entries and sizes).
2. On a failing PC, check the shortcut **Properties → Change Icon** to see whether Windows resolves the exe icon.
3. If embedding is fine, add **`build.nsis.include`** pointing to a small **`.nsh`** that sets **`CreateShortCut`** icon explicitly to **`skia-forge-app.ico`** (electron-builder documented extension point).
4. Fix **`resolveAppWindowIcon`** dev fallback path if dev runs without **`app.asar.unpacked`** (join **`root`** + **`name`** without extra **`assets`** segment when **`root`** is already **`…/skia-ide/assets`**).

---

*Generated by repository audit only; no application source files were modified except this document.*
