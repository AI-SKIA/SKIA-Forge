# SKIA Forge — User-facing copy audit

> **Status (2026-05-24):** Partially superseded. i18n-driven hub pages and `public/locales/en/docs.json` resolved several items flagged below. Re-run greps before the next copy pass.

**Repository:** `c:\SKIA-Forge`  
**Audit date:** 2026-05-10  
**Scope:** Read-only inventory of user-accessible HTML, Express-served pages, dynamic HTML from TypeScript, documentation under `docs/` and `public/docs/`, and forbidden-string greps. No source files were modified except this report.

**Brand lens (from brief):** SKIA Forge is the developer/operator surface of the SKIA Sovereign Intelligence Platform — not a generic AI tool. Anthropomorphize SKIA as “she” where appropriate. Avoid internal repo names, vendor LLM brands, CI/eval jargon, and generic “chatbot/assistant/LLM” framing in customer copy.

---

## Step 1 — Page inventory & URL mapping

### Static files under `public/` (served as files or via explicit routes)

| URL path | File |
|----------|------|
| `/platform-downloads` | `public/platform-downloads.html` |
| `/resources` | `public/resources.html` |
| `/security` | `public/security.html` |
| `/contact` | `public/contact.html` |
| `/forge-premium-ui.css` | `public/forge-premium-ui.css` (not HTML) |

### Branded documentation HTML (`public/docs/`)

Served at **`/docs/<filename>.html`** via `express.static` on `public/docs/` (see `src/server.ts`).

| URL path | File |
|----------|------|
| `/docs/README.html` | `public/docs/README.html` |
| `/docs/API_REFERENCE.html` | `public/docs/API_REFERENCE.html` |
| `/docs/QUICKSTART.html` | `public/docs/QUICKSTART.html` |
| `/docs/USER_GUIDE.html` | `public/docs/USER_GUIDE.html` |
| `/docs/PRODUCT_MANUAL.html` | `public/docs/PRODUCT_MANUAL.html` |
| `/docs/CHANGELOG.html` | `public/docs/CHANGELOG.html` |
| `/docs/OPERATOR_MANUAL.html` | `public/docs/OPERATOR_MANUAL.html` |
| `/docs/ENTERPRISE_READINESS_CHECKLIST.html` | `public/docs/ENTERPRISE_READINESS_CHECKLIST.html` |
| `/docs/SECURITY_GUIDE.html` | `public/docs/SECURITY_GUIDE.html` |
| `/docs/DEVELOPER_GUIDE.html` | `public/docs/DEVELOPER_GUIDE.html` |
| `/docs/PRICING_AND_PACKAGES.html` | `public/docs/PRICING_AND_PACKAGES.html` |
| `/docs/TROUBLESHOOTING.html` | `public/docs/TROUBLESHOOTING.html` |
| `/docs/SUPPORT.html` | `public/docs/SUPPORT.html` |

### Markdown fallback (`docs/`)

Same `/docs/*` mount falls through to **`express.static`** on repository `docs/` — users can open **`/docs/README.md`**, **`/docs/API_REFERENCE.md`**, etc., directly.

### Redirects (no HTML body)

| URL path | Behavior |
|----------|----------|
| `/`, `/forge`, `/download` | `302` → `/platform-downloads` (`PLATFORM_DOWNLOADS_PATH` in `src/server.ts`) |

### Express / Node routes that render or serve HTML

| URL path | Implementation | Notes |
|----------|----------------|-------|
| `/chat` | `renderChatHtml()` in `src/chatUi.ts` | Inline HTML string |
| `/forge/platform` | `renderForgePlatformHtml()` in `src/forgePlatformUi.ts` | Inline HTML string |
| `/forge/app`, `/forge/app/` | `sendForgeAppHtml()` reads `skia-ide/dist/renderer/index.html` | Requires `skia-ide` build; 503 stub if missing |
| `/resources`, `/security`, `/contact`, `/platform-downloads` | `res.sendFile(...)` | See `src/server.ts` |

### SKIA Forge IDE (Electron) renderer HTML

Bundled from `skia-ide/src/renderer/` (webpack template `skia-ide/src/renderer/index.html`). Auxiliary windows load files under `skia-ide/src/renderer/docs/` (`index.html`, `changelog.html`, `report.html`, `documentation.html`) — see `skia-ide/src/main/main.ts` (`loadFile`).

### Root / other directories

- **No** `.html` files at repo root.
- **`public/doc-embed/`** — not present in this repository (no equivalent directory found).

---

## Summary table — all surfaces, status, action

| Page / surface | Copy status | Action required |
|----------------|-------------|-----------------|
| `/platform-downloads` | **CRITICAL** | Remove eval/CI/routing-internal language; fix “Singularity Continuum” vs Forge naming; replace generic doc-card sub-labels; align primary download CTA copy. |
| `/security` | **CRITICAL** | Remove vendor hosting name (Northflank) from visible guidance; keep secrets messaging vendor-neutral. |
| `/resources` | **PARTIAL** | Mostly on-brand; optional polish on footer legal name (“Singularity Continuum”) for consistency with Forge naming. |
| `/contact` | **PARTIAL** | Support copy OK; optional naming/branding consistency in footer. |
| `/docs/*.html` (library) | **CRITICAL** (multiple) | Strip **Skia-FULL**, **`src/`**, **`skia-ide/`**, changelog references to internal repos from customer-facing HTML; rewrite troubleshooting heading “SKIA-Full Integration Unavailable”. |
| `/chat` (dynamic) | **PARTIAL** | Title duplicates “Web IDE”; “SKIA Chat” reads generic — reposition as governed execution / operator surface, not a casual chat UI. |
| `/forge/platform` (dynamic) | **PARTIAL** | “Forge Web IDE” + prompt-first UX risks generic AI framing; runtime status line exposes integration jargon (`brainOnly`, `/integration/skia-full`) — rewrite for operators. |
| `/forge/app` (built IDE) | **PARTIAL** | Shell strings (“Describe a task…”, documentation “Ask SKIA anything”) skew generic-chat — tighten to sovereign/governed language. |
| Electron `docs/*.html` | **PARTIAL** | Same theme as web IDE docs — minor generic phrasing in chat/docs sections. |

---

## Per-page blocks (template)

### PAGE: `/platform-downloads`

**FILE:** `public/platform-downloads.html`  
**COPY STATUS:** **CRITICAL**

**TITLE:** `SKIA | Download`  
**H1/MAIN HEADING:** `SKIA Forge` (logo image above)  
**SUBTITLE / TAGLINE:** `Frontier-grade, eval-gated intelligence for real software delivery`

**DOC CARDS / LINKS:** Mixed panels + linked cards — Overview → `/docs/README.html`; API reference → `/docs/API_REFERENCE.html`; Quickstart, User guide, Developer guide, Product manual, Enterprise readiness, Pricing & packages, Operator manual, Troubleshooting, Support, Security guide (paths as in file). Panel titles include “Frontier-Ready Intelligence Layer”, “Eval-Gated Reliability”, “Production-Grade Operations”, “One Intelligence Across Surfaces”. Linked cards repeat sub-label **`SKIA-FORGE SITE`** on each.

**DOWNLOAD LINKS:**

- `https://skia.ca/api/app/download/windows.exe` — visible label **“Download SKIA Singularity Continuum”** (primary featured tab)
- `https://skia.ca/api/app/skia-forge-download/windows.exe` — **“Download SKIA Forge”**
- Platform grid: Windows, macOS Intel/ARM, Linux — `https://skia.ca/api/app/skia-forge-download/...`

**FEATURE PANELS:** See doc cards; panel copy references eval-gated reliability and CI gates (below).

**INSTRUCTIONS/STEPS:**

- “How Forge + SKIA works”: steps 1–3 (web vs desktop, execution paths, structured outputs).
- “Why teams choose SKIA Forge”: A–C; **B** mentions **“routing invariants”**.

**FOOTER:** `One ecosystem. One universe. All SKIA.` / `© 2026 SKIA Singularity Continuum. The future is an understatement.` — links Resources, Security, Contact & Support.

**SIDEBAR NAV:** Forge Home, Product, Resources, Security, Contact & Support, Download SKIA Forge.

**INTERNAL LANGUAGE TO REMOVE:** `eval-gated`, `Eval-Gated`, `Regression-sensitive CI gates`, `routing invariants`, **`SKIA-FORGE SITE`** (repeated), **`SKIA Singularity Continuum`** as product/download naming where Forge/desktop naming is intended.

**COPY ISSUES:** Subtitle and reliability panel use internal QA/eval vocabulary; step B exposes routing invariant jargon; duplicate download CTAs use inconsistent product names (“Singularity Continuum” vs “SKIA Forge”).

**NOTES:** Doc targets under `/docs/*.html` **exist** under `public/docs/` (verified). Cross-links use relative Forge paths; external skia.ca assets used for logo.

---

### PAGE: `/resources`

**FILE:** `public/resources.html`  
**COPY STATUS:** **PARTIAL**

**TITLE:** `Resources | SKIA Forge`  
**H1:** `Resources`  
**SUBTITLE:** `Everything you need to understand, deploy, and operate SKIA Forge`

**DOC CARDS / LINKS:** Grid to `/docs/PRODUCT_MANUAL.html`, `QUICKSTART.html`, `USER_GUIDE.html`, `DEVELOPER_GUIDE.html`, `API_REFERENCE.html`, `OPERATOR_MANUAL.html`, `TROUBLESHOOTING.html`, `CHANGELOG.html`, `PRICING_AND_PACKAGES.html`, `ENTERPRISE_READINESS_CHECKLIST.html`, `SECURITY_GUIDE.html`; Support card → `/contact` with tag `SUPPORT.md` (see Notes).

**DOWNLOAD LINKS:** `https://skia.ca/api/app/skia-forge-download/windows.exe` — “Download SKIA Forge”; GitHub releases link for Release Notes.

**FEATURE PANELS:** N/A (doc grid only).

**INSTRUCTIONS/STEPS:** N/A.

**FOOTER / SIDEBAR:** Same pattern as downloads hub — footer tagline + Singularity Continuum copyright; sidebar mirrors other pages.

**INTERNAL LANGUAGE TO REMOVE:** None mandatory on this file’s primary copy; linked docs may contain forbidden terms.

**COPY ISSUES:** Footer legal name “SKIA Singularity Continuum” may conflict with positioning SKIA Forge / sovereign platform as primary brand.

**NOTES:** Support card description references SUPPORT scope but routes to **contact** — tag still says `SUPPORT.md`; `/docs/SUPPORT.html` exists separately.

---

### PAGE: `/security`

**FILE:** `public/security.html`  
**COPY STATUS:** **CRITICAL**

**TITLE:** `Security | SKIA Forge`  
**H1:** `Security`  
**SUBTITLE:** `SKIA Forge applies layered controls across every surface — request, governance, and execution`

**DOC CARDS / LINKS:** N/A.

**DOWNLOAD LINKS:** N/A.

**FEATURE PANELS:** Security Model cards (Request Validation, Governance Enforcement, Safety Gates, Execution Previews); Key Security Components (internal service names **SecurityAnalysisService**, **Governance Decision Engine**, etc.).

**INSTRUCTIONS/STEPS:** Operational Security Practices numbered 01–04 — **01** references **Northflank secrets**.

**FOOTER / SIDEBAR:** Standard Forge footer; sidebar uses absolute `https://forge.skia.ca/platform-downloads` for Forge Home / Download.

**INTERNAL LANGUAGE TO REMOVE:** **`Northflank`**.

**COPY ISSUES:** Internal implementation class names are exposed as marketing/security storytelling — consider human-readable descriptions only.

**NOTES:** Hardening checklist references JWT/API rotation — appropriate for operators; keep vendor-neutral secret injection language.

---

### PAGE: `/contact`

**FILE:** `public/contact.html`  
**COPY STATUS:** **PARTIAL**

**TITLE:** `Contact & Support | SKIA Forge`  
**H1:** `Contact & Support`  
**SUBTITLE:** `SKIA Forge runtime and SKIA Forge IDE — startup, updates, integrations, governance, or getting started — we're here`

**DOC CARDS / LINKS:** N/A.

**DOWNLOAD LINKS:** N/A.

**FEATURE PANELS:** Support scope icons; SLA P1–P3; triage grid; escalation steps 1–3.

**INSTRUCTIONS/STEPS:** Escalation list; form fields Name / Email / Subject / Message; POST to `https://api.skia.ca/api/auth/contact`.

**FOOTER / SIDEBAR:** Standard.

**INTERNAL LANGUAGE TO REMOVE:** None flagged as forbidden-list violations in visible HTML.

**COPY ISSUES:** “Build and test pipeline breakages” in support scope is engineer-internal tone — soften or clarify as operator-facing.

**NOTES:** Direct mailto `dany.francis@skia.ca` exposed — confirm intentional for public page.

---

### Documentation HTML pages (`/docs/*.html`)

**FILES:** All files listed in Step 1 under `public/docs/`.  
**COPY STATUS:** **CRITICAL** where repository-internal names appear; otherwise **PARTIAL**.

Common shell across these pages:

- **TITLE:** varies (`Documentation Index | SKIA Forge`, topic-specific titles).
- **H1:** topic title (e.g. Documentation Index, User Guide).
- **SUBTITLE / intro:** first `.doc-desc` paragraph — several cite **`src/server.ts`**, **`docs/`**, **`skia-ide/`**, ports — developer-internal.
- **SIDEBAR NAV:** Forge Home (`https://forge.skia.ca/platform-downloads`), Product (`/forge/platform`), Resources, Security, Contact & Support, Download SKIA Forge.
- **FOOTER:** Same tagline + **© 2026 SKIA Singularity Continuum**.

**Highest-severity shared issues:**

| Topic file | Representative forbidden / internal exposure |
|------------|-------------------------------------------|
| `USER_GUIDE.html` | **`Skia-FULL`** as a runtime role; **`skia-ide/`** path |
| `CHANGELOG.html` | **`src/server.ts`**, **`Skia-FULL`** in changelog narrative |
| `TROUBLESHOOTING.html` | Section title **“SKIA-Full Integration Unavailable”**; internal paths |
| `README.html`, `API_REFERENCE.html`, `DEVELOPER_GUIDE.html` | **`src/server.ts`**, repo layout references |

**INTERNAL LANGUAGE TO REMOVE (representative):** `Skia-FULL`, `SKIA-Full`, `Skia-FULL`, `src/server.ts`, `skia-ide/` (as repo path), changelog bullets naming nested repo cleanup.

**COPY ISSUES:** Docs alternate **SKIA-Forge** vs **SKIA Forge**; heavy repo-path language isn’t operator-grade for public HTML.

**NOTES:** HTML mirrors Markdown sources in `docs/`; fixing HTML without fixing MD leaves `/docs/*.md` URLs exposing the same issues.

---

### PAGE: `/chat` (dynamic HTML, not stored as `.html`)

**FILE:** `src/chatUi.ts` (`renderChatHtml`)  
**COPY STATUS:** **PARTIAL**

**TITLE:** `SKIA Forge | Web IDE`  
**H1/H2:** `SKIA Chat`  
**SUBTITLE:** Status line bound to `/providers/status`.

**VISIBLE STRINGS:** “Download App” → `/api/app/download`; placeholder **“Ask SKIA…”**; diff preview placeholders “Old code” / “New code”; messages labeled “You” / “SKIA”.

**INTERNAL LANGUAGE TO REMOVE:** None from forbidden list in static template string.

**COPY ISSUES:** “SKIA Chat” + chat layout reads **generic chatbot surface** — misaligned with sovereign operator positioning.

---

### PAGE: `/forge/platform` (dynamic HTML)

**FILE:** `src/forgePlatformUi.ts` (`renderForgePlatformHtml`)  
**COPY STATUS:** **PARTIAL**

**TITLE:** `SKIA Forge | Web IDE`  
**H1:** `Forge Web IDE`  
**LEDE:** `Choose a module, write your prompt, and run it.`

**SIDEBAR:** IDE Modules — Agent, Context, SDLC, Production, Healing, Architecture, Lifecycle Orchestrate.

**RUNTIME TEXT (JS):** Status updates fetch `/integration/skia-full` and `/api/forge/mode` — visible line includes **`brainOnly`** and integration labels (internal).

**INTERNAL LANGUAGE TO REMOVE:** Dynamic **`brainOnly`**, **`skia-full`** URL exposure is implementation-facing for a “Product” sidebar link target audience.

**COPY ISSUES:** Prompt-first microcopy overlaps generic AI assistant patterns.

---

### PAGE: `/forge/app` (web IDE bundle)

**FILE (source):** `skia-ide/src/renderer/index.html` → built to `skia-ide/dist/renderer/index.html`  
**COPY STATUS:** **PARTIAL**

**TITLE:** `SKIA FORGE`  
**NAV:** EXPLORER, SEARCH, AGENT, FORGE, SETTINGS  
**PLACEHOLDERS:** e.g. “Describe a task for SKIA…”, “Search files and symbols…”, FORGE CONTROL PLANE, Agent view headers.

**INTERNAL LANGUAGE TO REMOVE:** None literal from forbidden grep list in source HTML.

**COPY ISSUES:** Same generic-task phrasing as `/forge/platform`; acceptable for IDE chrome but should align with governed intelligence vocabulary in onboarding strings.

---

### Electron-only docs (`skia-ide/src/renderer/docs/`)

| File | Role | COPY STATUS |
|------|------|----------------|
| `index.html` | Documentation hub | **PARTIAL** — simple onboarding bullets |
| `documentation.html` | Longer doc | **PARTIAL** — includes “Ask SKIA anything from the chat panel” (generic framing) |
| `changelog.html` | Release notes | **PARTIAL** — “Chat panel with SKIA backend integration” |
| `report.html` | Abuse/issue report | **PARTIAL** — minimal copy |

---

## Step 4 — Doc file inventory (`docs/` + `public/docs/`)

### `docs/` (Markdown and other)

| File | Linked from user-facing HTML? | Forbidden / internal terms? | Classification |
|------|--------------------------------|------------------------------|----------------|
| `README.md` | Indirectly via `/docs/README.md` fallback | **Yes** — `Skia-FULL`, `Northflank`, `frontend/pages/...` | **REWRITE** (or gate from public serve) |
| `API_REFERENCE.md` | Yes (`API_REFERENCE.html` + `.md`) | **Yes** — `Skia-FULL`, `frontend/lib/...` | **REWRITE** |
| `QUICKSTART.md` | Yes | **Yes** — `Skia-FULL`, adapter internals | **REWRITE** |
| `USER_GUIDE.md` | Yes | **Yes** — `Skia-FULL`, Next.js paths | **REWRITE** |
| `PRODUCT_MANUAL.md` | Yes | **Yes** — `Skia-FULL`, `frontend/pages/...` | **REWRITE** |
| `DEVELOPER_GUIDE.md` | Yes | **Yes** — extensive `Skia-FULL` / EPAAS internals | **REWRITE** (split internal appendix) |
| `OPERATOR_MANUAL.md` | Yes | **Yes** — `Skia-FULL`, Northflank | **REWRITE** |
| `SECURITY_GUIDE.md` | Yes | Verify line-by-line — likely paths | **REWRITE** |
| `TROUBLESHOOTING.md` | Yes | **Yes** — `Skia-FULL` routing | **REWRITE** |
| `CHANGELOG.md` | Yes | **Yes** — `Skia-FULL` | **REWRITE** |
| `PRICING_AND_PACKAGES.md` | Yes | **Yes** — `Skia-FULL` | **REWRITE** |
| `ENTERPRISE_READINESS_CHECKLIST.md` | Yes | **Yes** — `Skia-FULL` | **REWRITE** |
| `SUPPORT.md` | Linked as `.md`; Resources card points to `/contact` | **Yes** — `Skia-FULL` | **REWRITE** |
| `contracts/capability-parity.json` | Not linked from audited HTML | Internal artifact | **REMOVE** from public static serve **or** exclude via server config — **internal-only** |

### `public/docs/*.html`

Branded HTML versions of the above — **same classification as MD**: public customers should not see repo topology or **`Skia-FULL`** naming → **REWRITE** across the set unless archived as truly internal.

---

## Step 5 — Global grep results

**Method:** Workspace search over `c:\SKIA-Forge` (`*.html` / `*.js`), equivalent intent to the requested `grep -rn` patterns. Many `public/docs/*.html` files pack the body into **very long single lines** (e.g. line **142**); line numbers below refer to those files’ line structure.

### HTML — pattern hits (representative full lines as stored)

> Note: Long HTML lines are truncated in tooling output; the following subsstrings were verified present.

| File | Line | Pattern / substring | Full line (as in file, may be one long HTML line) |
|------|------|---------------------|-----------------------------------------------------|
| `public/platform-downloads.html` | 130 | eval-gated | `Frontier-grade, eval-gated intelligence for real software delivery` |
| `public/platform-downloads.html` | 146–148 | Eval-Gated / Regression-sensitive | Panel title **Eval-Gated Reliability**; description contains **Regression-sensitive CI gates and full test coverage…** |
| `public/platform-downloads.html` | 279 | routing invariants | `…observability, routing invariants, health checks…` |
| `public/security.html` | 212 | Northflank | `…hosting provider (e.g. Northflank secrets), or SKIA Forge IDE configuration…` |
| `public/docs/USER_GUIDE.html` | 142 | Skia-FULL | Contains **Skia-FULL** — Core product runtime (separate repository). |
| `public/docs/CHANGELOG.html` | 142 | Skia-FULL, src/server.ts | Unreleased bullets reference **`src/server.ts`** and **Removed stale nested Skia-FULL copy…** |
| `public/docs/TROUBLESHOOTING.html` | 142 | SKIA-Full | Section **SKIA-Full Integration Unavailable** |
| `public/docs/API_REFERENCE.html`, `README.html`, `DEVELOPER_GUIDE.html` | 140–142 | src/ | References to **`src/server.ts`** and repo paths in intro/table |

**Patterns with no matches in `*.html`:** `Gemini`, `OpenAI`, `GPT`, `Claude`, `Ollama`, `ComfyUI`, `Skia-PC`, `SHA256` / `SHA256SUMS`, `DESKTOP_RELEASE_RUNBOOK`, `skia-routing`, explicit **`.env`**, word **`LLM`**, **`chatbot`**, **`AI assistant`**, **`frontend/`** (as literal substring in HTML grep — MD still contains `frontend/`).

**Additional branding hits (not in automated forbidden list but flagged for consistency):** Footer **`SKIA Singularity Continuum`** appears across most branded pages; **`SKIA-FORGE SITE`** repeated on `platform-downloads.html` doc cards.

### JavaScript (`*.js`)

No matches for **`Gemini`**, **`OpenAI`**, **`GPT`**, **`routing.invariant`**, or **`Skia-FULL`** under **`src/`** and **`skia-ide/`** source trees (tracked `.js`).

---

## Step 6 — `platform-downloads.html` known issues (explicit checklist)

| Issue | Status in codebase |
|-------|---------------------|
| Subtitle “Frontier-grade, eval-gated…” | **Present** — line 130 |
| “Regression-sensitive CI gates…” panel | **Present** — lines 146–148 |
| “routing invariants” in step B | **Present** — line 279 |
| “Download SKIA Singularity Continuum” button label | **Present** — lines 122–124 vs “Download SKIA Forge” later |
| Doc cards → `/docs/README.html`, `DEVELOPER_GUIDE.html`, `OPERATOR_MANUAL.html`, `ENTERPRISE_READINESS_CHECKLIST.html`, `PRODUCT_MANUAL.html` | **All exist** under `public/docs/` |
| Card sub-label **SKIA-FORGE SITE** | **Present** on every linked doc card in this file |

**Doc card recommendation:** Replace **SKIA-FORGE SITE** with per-card descriptors (e.g. “Product overview”, “HTTP API”, “Runbook”) so each card states what the reader gets.

---

## Priority fix list

### First (blocking / brand-unsafe)

1. **`public/platform-downloads.html`** — Rewrite subtitle, “Eval-Gated” panel, step B, duplicate download naming, and doc-card sub-labels.
2. **`public/docs/*.html` + `docs/*.md`** — Remove **`Skia-FULL`**, **`src/`**, **`skia-ide/`**, **Northflank**, **frontend/** path talk from customer-visible layers; split truly internal content into non-public docs.
3. **`public/security.html`** — Replace **Northflank** example with vendor-neutral “secrets manager / hosting provider” language.

### Second (positioning / tone)

4. **`src/chatUi.ts`**, **`src/forgePlatformUi.ts`**, IDE **`index.html`** / **`documentation.html`** — Reframe “chat” and prompt-first microcopy toward **governed intelligence** and **operator-grade** workflows; sanitize live status strings that expose **`brainOnly`** / **`skia-full`** paths.
5. **Footer legal line “SKIA Singularity Continuum”** — Align with **SKIA Forge** / sovereign platform naming consistently across the site.

### Third (polish & navigation)

6. **`public/resources.html`** — Align Support card destination vs label (`SUPPORT.md` tag vs `/contact`); ensure `/docs/SUPPORT.html` discovery matches messaging.
7. **Responsible disclosure / contact** — Confirm public email and API endpoint usage match privacy commitments.

---

*End of report.*
