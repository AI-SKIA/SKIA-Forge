---
description: SKIA Forge master rules — applies to every task in every session
alwaysApply: true
---

# SKIA Forge Master Rules

## 0. Pre-read before every task

Before any edit, read these files in full. They override stale docs and audit snapshots:

- **`docs/architecture/SOVEREIGN_PLATFORM.md`** — **agent law:** SKIA owns translations, fonts, TTS, Skia-Serve, IDE; never suggest vendor APIs or Google except continuity fallback when sovereign engines are down.
- **`.cursor/rules/FORGE_RULES.md` §6** — any task that adds/changes user-visible text (mandatory translation playbook).
- **`design_bible.md`** — **sole Forge design law (always read current version)** (brand tokens §1–§5, Forge Web §6, Forge IDE §7, CSS status §12). Never deviate on typography, gold, backgrounds. When changing §1–§5 brand tokens, also update **`Skia-FULL/design_bible.md`** §1–§5 per Forge bible §13.
- `docs/ENV_REFERENCE.md` — operator env vars, sovereign inference (Skia-Serve primary; continuity fallback operator-only — **§0.5**).
- `docs/API_REFERENCE.md` — canonical HTTP route index; verify against `src/server.ts` if routes changed.
- `local-dev/docs/forge-local-setup.md` — local vs production isolation (must not cross-contaminate).
- `guides/FORGE_COPY_AUDIT.md` — customer-facing copy prohibitions (no internal repo names in public HTML/MD).

**Read when the task touches that area (Skia-FULL repo — gitignored operator files stay on disk, never commit):**

| Task type | Also read |
|-----------|-----------|
| Deploy, env, ports, PATs, Northflank | **`Skia-FULL/northflank-services.md`** |
| Continuity fallback / provider chain docs | **`Skia-FULL/docs/provider-fallback-truth-table.md`** + `northflank-services.md` |
| Client fetch in `forgePlatformUi.ts`, `chatUi.ts`, browser bundles | **`Skia-FULL/docs/architecture/skia-routing-invariants.md`** (browser rules — **§7.1**) |
| Forge-web CSS / hub HTML / typography | **`design_bible.md`** §1–§6 + §12 implementation status |

**Deployment truth:** production host `forge.skia.ca`, port **4173** (`SKIA_PORT`). Upstream auth/brain default **`https://api.skia.ca`**. Private operator topology notes live in **Skia-FULL** `northflank-services.md` — never commit secrets or `.nf-*.json`.

## 0.5 Sovereign integrated platform — agent law (non-negotiable)

**Full spec:** `docs/architecture/SOVEREIGN_PLATFORM.md` (keep in sync with Skia-FULL copy).

SKIA builds integrated capabilities **in-house** — not third-party SaaS as the default. Forge participates in the same model:

| Capability | Forge uses |
|------------|------------|
| UI languages | `public/locales/` + IDE JSON — **`§6`** — no browser translate, no translation APIs |
| Typography | Self-hosted Agency FB + Centaur — `design_bible.md` §1, `npm run fonts:check` |
| AI / agent / embeddings | **`https://api.skia.ca`** → Skia-Serve on SKIA stack — Forge does **not** add vendor LLMs |
| Voice, image, video (product) | Sovereign engines on SKIA API — not Forge-local vendors |

### When making updates — agents must NOT

- Mention or recommend **Google, Gemini, OpenAI, Anthropic, DeepL, Google Translate, or Google Fonts** in customer copy, locale workflows, font tasks, or “how to implement X” — **except** Skia-FULL operator docs describing **continuity fallback** when Skia-Serve / image-engine / video-engine are unhealthy
- Propose external **APIs** for translations, fonts, TTS, or primary inference when SKIA already owns the capability
- Describe vendor LLMs as Forge’s brain — Forge is a **downstream consumer** of the SKIA API only

### If the user needs something SKIA does not ship yet

**Build it inside SKIA** (or Forge’s bounded scope) — do not default to “integrate [vendor] API” unless the user explicitly orders that.

## 1. Canonical numbers — verify before writing

- **Forge server:** `1.0.0` (root `package.json`)
- **SKIA Forge IDE:** `1.0.0` (`skia-ide/package.json`)
- **Locales:** 12 — `fr`, `en`, `zh`, `es`, `ar`, `pt`, `de`, `ja`, `ko`, `hi`, `tr`, `ru` (default: **`fr`** — keep in sync with skia.ca)
- **Live HTTP modules** (`POST /api/forge/module/:module`): `context`, `agent`, `sdlc`, `production`, `healing`, `architecture`
- **Primary LLM path:** Skia-Serve via `https://api.skia.ca` — **not** a local Ollama path in production
- **Continuity fallback:** lives on Skia-FULL runtime only when sovereign engines are down — see **`§0.5`** and **`Skia-FULL/docs/provider-fallback-truth-table.md`**; never document as Forge default

**When Forge copy/docs cite skia.ca product stats** (feature counts, workspaces, API routes): verify via **Skia-FULL** (`npm run docs:sync`, `python scripts/audit-feature-count.py`) — never hardcode stale numbers. If citing features, read **`Skia-FULL/frontend/components/featuresData/`** category files — not the stub `featuresData.ts`.

Always confirm route/module lists against **`src/server.ts`** and **`src/forgeModuleExecutor.ts`** — not README alone.

## 2. Three-repo ecosystem awareness

Forge is one leg of the SKIA ecosystem. Check cross-repo impact before closing:

| Repo | Role |
|------|------|
| `C:\Skia-FULL` | Product runtime, skia.ca, sovereign brain upstream |
| `C:\SKIA-Forge` | Governance/orchestration control plane + Forge IDE |
| `C:\Skia-Status` | Public status publication |

If a change affects shared locale keys, `MOBILE_APP_APPROVED`, platform gates, download URLs, or user-facing sovereign vocabulary, apply the equivalent update in every affected repo.

**Forge boundary:** Forge **calls** the SKIA API (`SkiaFullAdapter`, `/integration/skia-full/*`). It does **not** replace Skia-FULL as the product runtime. Do not add a production local-LLM bypass in Forge server code.

### forge-web ↔ skia.ca brand consistency (separate bibles, same brand)

**Each repo has its own design bible.** Forge work follows **`design_bible.md` only**; skia.ca work follows **`Skia-FULL/design_bible.md` only**. Both document the **same brand** (fonts, 15–38px scale, gold palette, card tiers, crest bullets, 800px hub shell) so the products look like one SKIA family.

**forge.skia.ca** hub and doc pages must stay visually consistent with **skia.ca** equivalent routes:

| forge.skia.ca | skia.ca equivalent | Forge bible |
|---------------|-------------------|-------------|
| `/resources` | `/resources` | §6 hub shell |
| `/security` | `/security` | §6 |
| `/contact` | `/contact` | §6 |
| `/platform-downloads` | `/download` | §6 + download cards |
| `/docs/*.html` | `/docs/[doc]` | §6 doc layout |

**When updating hub nav, footer links, or forge marketing copy:** cross-check **`Skia-FULL/frontend/lib/sidebarNav.ts`** and the matching skia.ca page for **label parity** — not as design authority. Mirror label/key changes in **`public/locales/*`** and hub HTML sidebar.

**Design law (Forge):** Forge `design_bible.md` §1–§6 (15–38px type scale, gold palette, Tier 1/2 cards, 8px scrollbars, 15px footer). Documented Forge-only layout differences (260px sidebar, `.back-btn` vs React back button) are in §1 and §6 — intentional, not drift.

**Token sync:** When changing brand tokens in either repo, update **both** bibles §1–§5 in the same maintenance window — Forge bible §13.

**Not applicable:** skia.ca workspace hubs, feature leaves, ECHO, mobile app — Forge does not ship those surfaces.

## 3. Audit before touching — read source, not snapshots

Before editing any file:

- Read the actual source (`.ts`, `.tsx`, `.html`, `.json`, `.css`).
- Read importers and importees of the target file.
- **Never** treat `guides/*_AUDIT.md`, old compliance snapshots, or `FORGE_MASTER_TREE.txt` as live truth — they are historical.
- For HTTP behavior, **`src/server.ts`** wins over `docs/API_REFERENCE.md` when they disagree — update docs after code changes.

## 4. No layout or visual changes without explicit authorisation

- Never touch hub page layout, colours, spacing, or component structure unless the user explicitly authorises UI changes.
- Design bible is law: Agency FB **400/500 only** (600+ forbidden), Centaur **400** body, gold **`#d4af37` only**, black-based backgrounds, CSS tokens — no ad-hoc inline styles on marketing surfaces.
- **Forge Web type bounds:** no user-facing text below **15px** or above **38px** (`design_bible.md` §2). **Forge IDE §7 is exempt** (dense chrome may use smaller sizes).
- IDE Monaco/terminal surfaces may use monospace; still follow Forge gold/background tokens in chrome.

## 5. Platform parity — two Forge surfaces

Forge has **two surfaces**, not skia.ca's five. Do not merge identifiers with Skia-FULL `SkiaPlatform`.

| Surface | Where | Notes |
|---------|-------|-------|
| **forge-web** | `forge.skia.ca` — `public/*.html`, `public/docs/`, dynamic shells in `src/chatUi.ts`, `src/forgePlatformUi.ts` | Download CTA on **desktop browser only** |
| **forge-ide** | Electron — `skia-ide/` | User already has the app — **no download CTAs** |

### Platform detection (required)

All Forge platform checks go through **`src/utils/platformContext.ts`** (web) and preload injection in **`skia-ide/src/main/preload.ts`** (`__SKIA_PLATFORM__ = 'forge-ide'`).

```typescript
export type SkiaPlatform = 'web-browser' | 'mobile-browser' | 'forge-web' | 'forge-ide';
```

- **Never** use `window.innerWidth` or raw UA sniffing for feature visibility — use `platformContext.ts`.
- Download markup: `src/utils/forgeDownloadMarkup.ts` + client gate in HTML shells.

### Intentional divergence

| Element | forge-web (desktop) | forge-web (mobile browser) | forge-ide |
|---------|---------------------|----------------------------|-----------|
| Download SKIA Forge | Show | **Hide** | **Hide** |
| Mobile app store CTA | Per flag below | Per flag below | Per flag below |
| All other product features | Yes | Yes | Yes |

### MOBILE_APP_APPROVED — sync on store approval

```typescript
// src/utils/platformContext.ts
export const MOBILE_APP_APPROVED = false; // flip true only after both stores approve
```

Keep in sync with **`Skia-FULL/frontend/src/utils/platformContext.ts`** when approval happens.

**Before closing any UI/copy task affecting downloads or platform gates:**
- [ ] `src/utils/platformContext.ts` updated if flag logic changes
- [ ] `forge-web` HTML/locale strings updated
- [ ] `forge-ide` checked (usually N/A for download CTAs)
- [ ] Skia-FULL updated if skia.ca cross-links or shared flag changed

## 6. Translations — authoritative playbook (read this for any copy/i18n task)

> **TL;DR:** All UI text lives in **JSON locale files in the repo**. Users pick language with the **in-app globe**. Forge does **not** use browser translate, OS language packs, or external translation APIs. Edit `public/locales/en/*.json`, translate into the other 11 folders, run **`npm run locales:sync`**. Same model as skia.ca; see **`§0.5`** / `SOVEREIGN_PLATFORM.md`.

### 6.1 How localization works (never explain differently)

| Question | Answer |
|----------|--------|
| Where do strings live? | `public/locales/<lang>/*.json` (hub/docs) and `skia-ide/src/renderer/i18n/locales/*.json` (IDE) |
| What is English source? | **`public/locales/en/`** only — always edit English first |
| How many languages? | **12:** `fr`, `en`, `zh`, `es`, `ar`, `pt`, `de`, `ja`, `ko`, `hi`, `tr`, `ru` |
| Default locale | **`fr`** (`DEFAULT_LOCALE` in `src/lib/i18n/config.ts`) — keep aligned with skia.ca |
| How does the user switch language? | **Globe control** on hub pages → loads `/locales/<lang>/<namespace>.json` via `public/forge-page-locale.js` |
| Does the browser translate for us? | **No** |
| Do we call translation APIs? | **No** — see **`§0.5`**; hand-maintained JSON + `apply-maintainer-translations.mjs` only |
| Mobile locales? | **N/A for Forge** — no Forge mobile app; do not run skia.ca’s `sync-mobile-locales.mjs` here |

Product copy is **bundled with the app/site**. Every user gets all 12 languages even if their browser or OS is English-only.

### 6.2 File map — which JSON for which surface

**Hub + docs (forge-web)** — `public/locales/<lang>/`:

| File | Pages / surfaces |
|------|------------------|
| `common.json` | Sidebar, footer, back button, shared nav labels |
| `platform-downloads.json` | `/platform-downloads` |
| `resources.json` | `/resources` |
| `security.json` | `/security` |
| `contact.json` | `/contact` |
| `docs.json` | `/docs/*.html` branded doc pages |
| `forge-platform.json` | `/forge/platform` (dynamic shell in `src/forgePlatformUi.ts`) |

**Runtime wiring:** HTML uses `data-i18n="namespace.path.to.key"` (see `public/platform-downloads.html`). Dynamic TS HTML in `src/chatUi.ts` / `src/forgePlatformUi.ts` reads the same JSON via server i18n helpers.

**IDE (forge-ide)** — separate tree:

| Path | Purpose |
|------|---------|
| `skia-ide/src/renderer/i18n/locales/*.json` | IDE chrome, panels, menus |
| `node scripts/sync-forge-locales.mjs` | Optional: pull chat-related strings from sibling **`Skia-FULL/frontend/locales`** (file copy only, **no API**) |

**Config to keep in sync with skia.ca:** `src/lib/i18n/config.ts` ↔ `Skia-FULL/frontend/lib/i18n/config.ts`.

### 6.3 Recipe — add or change a user-visible string (mandatory steps)

**Step 1 — Remove hardcoded text**

- Hub: no visible English in `public/*.html` body — use `data-i18n`, `data-i18n-html`, or `data-i18n-aria-label`.
- Dynamic shells: `src/chatUi.ts`, `src/forgePlatformUi.ts` — keys only, no literal user-facing strings.
- IDE: `skia-ide/src/renderer/` — use i18n keys, not raw strings.

**Step 2 — Add/update English key**

Edit **`public/locales/en/<namespace>.json`**. Use nested keys, e.g. `hero.subtitle`, not flat concatenation.

**Step 3 — Translate all 11 other languages**

For **each** of `fr`, `zh`, `es`, `ar`, `pt`, `de`, `ja`, `ko`, `hi`, `tr`, `ru`:

- Edit **`public/locales/<lang>/<namespace>.json`** with a **real translation** of the new/changed value.
- **Do not** leave English in `fr/` (etc.) except intentional brand tokens (`SKIA Forge`, `SKIA FORGE`, URLs, code paths).

**Shortcut for repeated English phrases:** add an entry to **`scripts/apply-maintainer-translations.mjs`** → `PHRASES`:

```javascript
'Your exact English string from en JSON': {
  fr: '…', de: '…', es: '…', pt: '…', ja: '…', ko: '…',
  zh: '…', ar: '…', hi: '…', tr: '…', ru: '…',
},
```

Then run `npm run locales:maintain` (or full `npm run locales:sync`). Same pattern as **`Skia-FULL/scripts/apply-maintainer-translations.mjs`**.

**Step 4 — Sync and verify (always run before done)**

```bash
npm run locales:sync
```

This runs, in order:

| Script | Purpose |
|--------|---------|
| `restore-forge-locale-tokens.mjs` | Fix leaked product-name placeholder bytes |
| `propagate-locale-keys-from-en.mjs` | Copy **missing keys** from `en/` into other langs (English fallback for new keys only) |
| `apply-maintainer-translations.mjs` | Apply `PHRASES` map |
| `validate-locale-parity.mjs` | **Fail** if any lang is missing keys that exist in `en/` |

Optional but recommended after hub/doc copy changes:

```bash
node scripts/verify-forge-i18n-html.mjs    # no hardcoded visible text in public HTML
node scripts/verify-md-locale-parity.mjs   # docs/*.md slugs exist in en/docs.json
```

**Step 5 — IDE strings (if you touched IDE UI)**

Edit `skia-ide/src/renderer/i18n/locales/en.json` **and** the other 11 IDE locale files the same way. Optionally sync chat labels from Skia-FULL: `node scripts/sync-forge-locales.mjs`.

### 6.4 npm scripts reference (translations only)

| Command | When |
|---------|------|
| `npm run locales:sync` | **Default — run after any locale edit** |
| `npm run locales:propagate` | New keys in `en/` only — fills missing keys in other langs |
| `npm run locales:maintain` | After editing `PHRASES` in `apply-maintainer-translations.mjs` |
| `npm run locales:validate` | CI/check — all langs have same key structure as `en/` |
| `npm run locales:restore-tokens` | After bad machine imports — fixes corrupted tokens |

### 6.5 Forbidden — agents must never do these

- **Never** use browser “Translate page” or **any external translation API** to produce locale JSON — see **`§0.5`**. Those approaches **corrupted** locale files in the past.
- **Never** ship a task with **only** `public/locales/en/` updated.
- **Never** hardcode user-visible English in hub HTML when a locale key should exist.
- **Never** tell the user to “enable browser translation” — Forge ships its own languages.

### 6.6 Forge vs skia.ca (same process, different paths)

| skia.ca | SKIA-Forge |
|---------|------------|
| `frontend/locales/en/*.json` | `public/locales/en/*.json` |
| `propagate-locale-keys-from-en.mjs` | `scripts/propagate-locale-keys-from-en.mjs` |
| `validate-locale-parity.mjs` | `scripts/validate-locale-parity.mjs` |
| `apply-maintainer-translations.mjs` | `scripts/apply-maintainer-translations.mjs` |
| 5 surfaces incl. mobile | **2 surfaces:** forge-web + forge-ide only |
| `sync-mobile-locales.mjs` | **Not used** |

### 6.7 Task done criteria (translations)

Do **not** mark a copy/i18n task complete unless:

- [ ] English key added/updated in `public/locales/en/<namespace>.json`
- [ ] Same key updated in **all 11** non-English locale folders (or covered by `PHRASES` + `locales:maintain`)
- [ ] `npm run locales:sync` exits 0 (`validate-locale-parity` passes)
- [ ] No hardcoded hub text (`verify-forge-i18n-html.mjs` if HTML changed)
- [ ] IDE locales updated too if IDE UI changed

**If the user asks “how do I update translations?”** — point to **this section (§6)** only; do not invent a different workflow.

## 7. Integration invariants — never violate

Read `docs/API_REFERENCE.md` and `src/config/localBackend.ts` before env, auth, or upstream URL changes.

### 7.1 Client routing invariants (forge-web browser bundles)

Applies to **`src/forgePlatformUi.ts`**, **`src/chatUi.ts`**, and any JS served to the browser on `forge.skia.ca`. Mirrors **Skia-FULL** `docs/architecture/skia-routing-invariants.md` (browser half).

**Prohibitions:**

1. **Same-origin only in the browser** — client code calls `/api/...`, `/integration/...`, `/providers/...`, `/rpc`, etc. on the Forge origin. **Never** hardcode `https://api.skia.ca` or other cross-origin URLs in browser bundles.
2. **No internal engine hostnames in client bundles** — no `backend:4000`, `chat-engine:`, `skia-serve:`, `image-engine:`, `embedding-engine:`, `tts-service:` in code shipped to the browser.
3. **Auth through Forge proxy** — session/auth uses **`/api/auth/*`** (server forwards to `SKIA_BACKEND_URL`). Do not add duplicate login flows in static HTML.
4. **Production brain** — document Skia-Serve via SKIA API as primary; never Ollama or localhost as Forge production default in customer docs.

**After client routing changes:** grep browser-served TS for `api.skia.ca`, `localhost`, and internal hostnames. Run **`npm run typecheck`** and affected tests.

Server-side upstream fetch (`skiaFullAdapter.ts`, `skiaSessionProxy.ts`, `server.ts`) **may** call `https://api.skia.ca` — these rules apply to **browser** code only.

### 7.2 Server integration prohibitions

1. **No production local brain bypass** — do not route production LLM traffic to Ollama or localhost from Forge server code.
2. **No customer-facing internal names** — no `Skia-FULL`, `Northflank`, `src/server.ts`, repo paths, or eval/CI jargon in `public/` or customer `docs/*.md` / `public/docs/*.html`.
3. **Auth proxy** — IDE and clients use **`/api/auth/*`** → `SKIA_BACKEND_URL` (default `https://api.skia.ca`). Marketing HTML does not duplicate login buttons.
4. **`/api/forge/*`** requires authenticated sessions — do not weaken `requireAuth` without explicit security review.
5. **Internal artifacts** — `internal/contracts/*` and `/docs/contracts/*` are not public; server blocks contract static serve.
6. **Embeddings** — vector indexing uses **embedding-engine**, not Skia-Serve or `api.skia.ca` chat paths (`docs/ENV_REFERENCE.md`).

If a requested change violates an invariant: **STOP**, name it, propose a compliant alternative.

## 8. Forge local install vs product (production) — never mix

Forge has **two operator environments**. They share **application code** but use **different config, upstream URLs, secrets, and start scripts**. A change for one must **never** silently change the other.

| | **Forge local install** | **Forge product (production)** |
|--|-------------------------|--------------------------------|
| **Purpose** | Dev / test against local SKIA stack on your machine | Live **`skia-forge`** on Northflank → **`forge.skia.ca:4173`** |
| **Source of truth** | `local-dev/docs/forge-local-setup.md`, `local-dev/run-forge-locally.md`, `src/config/localBackend.ts` | `docs/ENV_REFERENCE.md`, Northflank `skia-forge` runtime env (operator record in **Skia-FULL** `northflank-services.md`) |
| **Start** | `local-dev/scripts/start-forge-local.ps1` / `.sh` (loads env first) | Northflank deploy of `AI-SKIA/SKIA-Forge` |
| **Upstream brain** | `LOCAL_SKIA_BACKEND_URL` → default `http://localhost:3000` (Skia-FULL `local-dev/` stack) | `SKIA_BACKEND_URL` / `SKIA_FULL_API_URL` → **`https://api.skia.ca`** |
| **Env files** | `local-dev/.env.forge.local`, optional `local-dev/forge.local.config.json` — **gitignored** | Northflank service env — **never committed** |
| **Local mode trigger** | **`LOCAL_SKIA_BACKEND_URL` in process env only** (`localBackend.ts` — not inferred from committed JSON alone) | Must **not** set `LOCAL_*` on Northflank |
| **`npm run dev` alone** | Uses **production** `https://api.skia.ca` unless local env was loaded first | N/A — production is the hosted service |
| **Governance** | `LOCAL_FOUNDER_OVERRIDE`, `LOCAL_FORGE_SOVEREIGN_MODE` (autonomous when local) | Production governance — no local founder bypass |
| **IDE sources** | Optional `apply-forge-ide-local-patch.ps1` + `local-dev/ide-overrides/` | Ship unpatched `skia-ide/` — `prebuild` runs `assert-no-local-ide-patch.mjs` |
| **GitHub PAT** | Optional in gitignored `.env` for private-release testing | `GITHUB_TOKEN` on Northflank **`skia-forge`** only — rotate via **Skia-FULL** `scripts/nf-patch-skia-forge-github-token.mjs` |

### Code contract (`src/config/localBackend.ts`)

- **Production defaults (hardcoded):** `PRODUCTION_SKIA_BACKEND_URL` / `PRODUCTION_SKIA_FULL_API_URL` = `https://api.skia.ca`
- **Local mode:** active only when `LOCAL_SKIA_BACKEND_URL` is set in **env** and `NODE_ENV !== 'production'`
- **`NODE_ENV=production`** on Northflank **always** ignores `LOCAL_SKIA_BACKEND_URL` — even if mistakenly set in hosting env
- **Never** add a production code path that reads `forge.local.config.json` without `LOCAL_SKIA_BACKEND_URL` in env

### Dependency on Skia-FULL local stack

Forge local install expects a running **Skia-FULL** local stack (`Skia-FULL/local-dev/`). See **`Skia-FULL/.cursor/rules/SKIA_RULES.md` §11.5** for the platform local vs product split — do not cross-contaminate Skia-FULL compose/Northflank when doing Forge-only work.

### Agent prohibitions (non-negotiable)

1. **Do not** set `LOCAL_SKIA_BACKEND_URL`, `LOCAL_FOUNDER_OVERRIDE`, or `localhost` upstream URLs on **Northflank `skia-forge`**.
2. **Do not** run `apply-forge-ide-local-patch.ps1` before a production IDE build or release.
3. **Do not** copy production secrets from Northflank / **`Skia-FULL/northflank-services.md`**, **`.nf-*.json`**, or PAT files into `local-dev/.env.forge.local` or committed files.
4. **Do not** change `PRODUCTION_*` constants or default production URLs in `localBackend.ts` to localhost for convenience.
5. **Do not** use **Skia-FULL** `nf-patch-skia-frontend-github-token.mjs` for Forge — frontend and forge use **different** Northflank services and **different** PATs.
6. **Do not** route production LLM traffic to Ollama or localhost from Forge server code — Forge is a **downstream consumer** of the SKIA API only.
7. **Shared code** (routes, modules, locales) may serve both environments — env resolution must stay in `localBackend.ts` / `process.env`, never hardcoded prod URLs in local-only scripts or vice versa.
8. **Do not commit** `northflank-services.md`, `.nf-*.json`, production PATs, or JWT secrets — all belong in gitignored operator env only.

### Before any env, deploy, token, or upstream URL task — classify first

```
Forge local   → local-dev/*, start-forge-local.*, load-forge-local-env.ps1, LOCAL_SKIA_BACKEND_URL
Forge product → docs/ENV_REFERENCE.md, Northflank skia-forge, Skia-FULL nf-patch-skia-forge-github-token.mjs
Both          → application source only; split env/deploy updates into two explicit steps
```

### Local-only artifacts (never in production / CI / release)

| Artifact | Local only |
|----------|------------|
| `local-dev/.env.forge.local` | Copy from `.env.forge.local.example` |
| `local-dev/forge.local.config.json` | Optional `LOCAL_*` defaults |
| `local-dev/ide-overrides/` + IDE patch marker | Revert with `revert-forge-ide-local-patch.ps1` |
| `JWT_SECRET` in local env | Must match local Skia-FULL login — not production JWT |

### Task closure (local vs prod)

State which environment was touched. If only one: confirm the other was **not** modified (no Northflank patch, no `LOCAL_*` in tracked defaults, no IDE patch left applied).

## 9. Governance and module execution

- Governance modes: `strict`, `adaptive`, `autonomous` — policy in `src/forgeGovernance.ts`, `src/forgePolicy.ts`.
- High-risk operations require previews, approval tokens, or explicit mode — do not bypass in production code paths.
- Module domains live under `src/forge/modules/` — use typed Zod schemas in `src/contracts.ts`.
- Prefer additive, test-covered changes; run **`npm test`** for touched modules.

## 10. After every meaningful update

**Minimum gate:**

```bash
npm run typecheck
npm run test
```

**When the change touches specific areas:**

| Area | Command |
|------|---------|
| TypeScript / routes / governance | `npm run lint` + `npm run test` |
| Hub i18n JSON | `npm run locales:sync` + `node scripts/verify-forge-i18n-html.mjs` |
| Corrupted product-name tokens | `npm run locales:restore-tokens` |
| CSS / colours / fonts (forge-web) | `node scripts/normalize-forge-colors.mjs --check` + `node scripts/normalize-forge-font-sizes.mjs --check` + `npm run fonts:check` |
| Hub HTML / shared CSS links | `node scripts/apply-forge-hub-design.mjs --check` |
| Client fetch in platform/chat UI | Grep for `api.skia.ca`, `localhost`, internal engine hostnames in browser bundles — **§7.1** |
| IDE packaging | `cd skia-ide && npm run build` (runs `assert-no-local-ide-patch`) |
| Public copy / docs | Re-grep per `guides/FORGE_COPY_AUDIT.md` appendix before release |

**Manual doc updates:** `docs/CHANGELOG.md` for user-visible releases. Keep `docs/API_REFERENCE.md` aligned with `src/server.ts`.

## 11. Design bible is law (Forge profile)

- **Forge spec:** `design_bible.md` (current version) — **sole design law for this repo**: brand tokens (§1–§5), **Forge Web** (§6), **Forge IDE as-is** (§7), CSS implementation status (§12).
- **Cross-product consistency:** skia.ca uses **`Skia-FULL/design_bible.md`** as its sole law. Same brand tokens; **neither bible is upstream**. Sync §1–§5 when brand tokens change — Forge bible §13.
- **Type scale (forge-web):** **15px floor / 38px ceiling** — all `--skia-font-*` tokens per Forge `design_bible.md` §2 (see §12.2 for CSS verification).
- Gold: `#d4af37` and the five approved rgba variants only — no `#ffd700`, `#ffcc33`, Tailwind yellows.
- Background: Context A hub `#080400`; Context B tool/IDE `#0a0a0a`.
- Fonts: **self-hosted only** — exact names `"Agency FB"` and `"Centaur"` (see `design_bible.md` §1); `npm run fonts:check` after font/CSS changes.
- Icons: Lucide stroke on static HTML (`public/forge-lucide-icons.css`); doc lists use **inline SKIA Crest SVG** (§4) — no filled marketing icons.
- Do not retro-fit Forge IDE to web marketing patterns unless §7 is intentionally updated.
- **`Skia-FULL/THE SINGLE STANDARD EVERY FILE MUST MEET.md`** applies to skia.ca generative feature pages only — not Forge module/agent internals unless a Forge surface ships customer-facing generative deliverables with brand/style injection (then align with Skia-FULL quality bar, do not copy Next.js-specific patterns verbatim).

## 12. PR checklist — Forge changes

Before opening a PR:

1. **Surfaces:** forge-web and/or forge-ide updated? Download CTAs gated correctly?
2. **Locales:** all 12 `public/locales/*` namespaces touched for changed keys?
3. **Local isolation:** no committed `.env.forge.local`, no IDE patch marker, no localhost URLs in production code paths?
4. **Copy:** no forbidden internal vocabulary in customer layers?
5. **Tests:** `npm run preflight` passes (lint + build + test)?
6. **Cross-repo:** Skia-FULL / Skia-Status impact assessed? Hub nav/footer parity with skia.ca if forge-web marketing changed?
7. **forge-web layout (if CSS/HTML touched):** spot-check **1280px and 1920px** desktop viewports — Forge Web has **no mobile layout track** (see `design_bible.md` §3); download CTA hide on mobile UA is script-only.
8. **Client routing (if `forgePlatformUi.ts` / `chatUi.ts` touched):** no cross-origin or internal-host fetches in browser bundles — **§7.1**.

## 13. Task closure checklist (agents)

Reply or hand off only when you can state:

1. **Surfaces:** forge-web and/or forge-ide — and why any were N/A.
2. **Locales:** namespace + keys; all 12 language folders updated; `npm run locales:validate` passes.
3. **Backend mode:** production vs local — confirm no accidental localhost in production paths.
4. **Sovereign law:** no vendor API / Google suggestions in copy or docs edited — **`§0.5`**.
5. **Scripts run:** at minimum `npm run typecheck` and `npm test`; `npm run locales:sync` when locales changed.
6. **forge-web design (if CSS/fonts/HTML):** normalize `--check` scripts + `fonts:check`; compliance with Forge `design_bible.md` §1–§6 verified.
7. **Client routing (if browser UI changed):** confirm **§7.1** — same-origin fetches only in browser bundles.

## 14. On-demand procedures

**"how do I update translations?" / "update locale" / "translate copy"** — Follow **§6** only. Summary: edit `public/locales/en/*.json` → translate all 11 other langs → `npm run locales:sync`. **§0.5** — no external APIs, no browser translate.

**"audit docs"** — Scan `docs/`, `guides/`, `public/docs/`. Compare to `src/server.ts` and `guides/FORGE_COPY_AUDIT.md`. Flag stale internal names and drift.

**"run copy grep"** — Before marketing release, grep customer layers for: `Skia-FULL`, `Northflank`, `eval-gated`, `routing invariant`, repo paths in HTML.

**"local dev setup"** — Point user to `local-dev/docs/forge-local-setup.md`; never merge local env into production defaults in tracked files.

**"deploy / northflank / env patch"** — Read **`Skia-FULL/northflank-services.md`** first; classify Forge local vs Forge product per **§8**; use **`Skia-FULL/scripts/nf-patch-skia-forge-github-token.mjs`** for Forge PAT only (not frontend patch script).
