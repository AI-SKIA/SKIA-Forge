# SKIA FORGE DESIGN BIBLE — ROOT AUTHORITY

**Version 1.0 — Updated 2026-06-03**

This file is the design law for **SKIA-Forge** only. It inherits the shared SKIA ecosystem tokens from **`Skia-FULL/design_bible.md` v3.3** (fonts, gold palette, type scale, card tiers, spacing). Forge-specific surfaces are defined in §6 (Forge Web) and §7 (Forge IDE).

**Agent law (translations, fonts, inference, vendors):** `docs/architecture/SOVEREIGN_PLATFORM.md` + `FORGE_RULES.md` §0.5.

All Forge pages, components, styles, and generators must comply.

**Not in scope for this repo:** skia.ca React app, React Native mobile, workspace hub pages, SKIA Echo / Video / Image, marketplace, onboarding, or any surface outside Forge Web + Forge IDE.

---

## 0. PRODUCT SURFACES

Forge ships **two user-facing surfaces**. Every UI change must declare which surface it targets.

| Surface | ID | Where | Context |
|---------|-----|-------|---------|
| **Forge Web** | `forge-web` | `forge.skia.ca` — static HTML in `public/`, dynamic `/forge/platform` from `src/forgePlatformUi.ts` | Context A (marketing/docs) or Context B (execution console) |
| **Forge IDE** | `forge-ide` | Electron desktop app — `skia-ide/` | Context B (tool surface) — **current design documented in §7; do not retro-fit to web marketing patterns** |

**Platform notes (Forge Web only):**

- **Desktop browser:** hub sidebar, locale switcher, **DOWNLOAD APP** CTA visible where applicable.
- **Mobile browser:** same pages; **DOWNLOAD APP hidden** (user is already on web). No native mobile Forge app in this repo.
- **Forge IDE:** no download CTAs (user already has the app).

**Canonical cross-product source:** `Skia-FULL/design_bible.md` v3.3 — when Forge and skia.ca share a rule, they must match. Forge-only exceptions are listed explicitly in §7 (IDE) or marked as implementation drift in §11.

---

## 1. FONTS (MANDATORY, NON-NEGOTIABLE)

Shared with skia.ca. Forge **must not** rely on the user’s operating system or browser to supply brand typography. All customer-facing UI uses **self-hosted `.ttf` files** loaded via `@font-face`.

### Allowed font names (exactly two — no others)

| CSS `font-family` value | Role | File on disk |
|-------------------------|------|--------------|
| **`"Agency FB"`** | Headings, nav labels, buttons, section titles, metadata labels | `public/fonts/agency-fb/AgencyFB-Regular.ttf` |
| **`"Centaur"`** | Body copy, descriptions, footers, form text, IDE UI chrome | `public/fonts/centaur/Centaur-Regular.ttf` |

**Syntax rule:** `font-family` must be **exactly** `"Agency FB"` or `"Centaur"` — **no fallback stack**.

```css
/* ✔ Correct */
font-family: "Centaur";
font-family: "Agency FB";

/* ❌ Forbidden — OS/browser fallbacks */
font-family: "Centaur", "Centaur MT", serif;
font-family: "Agency FB", "AgencyFB", sans-serif;
font-family: Arial, system-ui, sans-serif;
```

Use CSS variables where helpful (defined in `public/forge-premium-ui.css`, mirrors Skia-FULL `styles/skia-brand-fonts.css`):

```css
--font-heading: "Agency FB";
--font-body: "Centaur";
```

### Self-hosted delivery (Forge Web)

| Asset | Location |
|-------|----------|
| Font files | `public/fonts/agency-fb/`, `public/fonts/centaur/` |
| HTTP route | `/fonts/*` (static serve in `src/server.ts`) |
| `@font-face` + globals | `public/forge-premium-ui.css` — **every hub/doc page must link this stylesheet** |
| Enforcement | `node scripts/normalize-forge-font-families.mjs --check` |

**Never** link Google Fonts, Adobe Fonts, CDN font URLs, or `fonts.googleapis.com` / `fonts.gstatic.com`.

### Self-hosted delivery (Forge IDE)

| Asset | Location |
|-------|----------|
| Font files | Copied from `public/fonts/` → `skia-ide/dist/renderer/fonts/` at build (`webpack.config.js`) |
| `@font-face` | Inline in `skia-ide/src/renderer/index.html` (`url("fonts/…")` — works on `file://`) |
| Embedded help docs | `skia-ide/src/renderer/docs/forge-brand-fonts.css` + `../fonts/` paths |
| CSS variables | `skia-ide/src/renderer/styles/skia-brand-fonts.css` |

The IDE **must not** depend on `/forge-premium-ui.css` from the network.

### Heading Font — Agency FB

- Allowed weights: **400**, **500**
- **Weight 500 is the maximum allowed anywhere in the project.**
- **400 = default weight for all text**
- **500 = maximum; use for display/page/section titles, section numbers, card titles, buttons, and sidebar nav**
- **600+ = forbidden**
- **Bold (700+) = forbidden**
- **Semi-bold (600) = forbidden**
- Agency FB 500 maps to the Regular `.ttf` (no separate Medium file exists)

### Body Font — Centaur

- Allowed weights: **400 only**

### ❌ Forbidden

- No bold (700+) anywhere, for any reason, on any element
- **No component, page, or style may use font-weight 600 or higher.**
- **No font names other than `"Agency FB"` and `"Centaur"`** in customer UI (Monaco/xterm may use `"Centaur"` once `@font-face` is loaded — not system serif/sans stacks)
- No `"Centaur MT"`, `"AgencyFB"`, `serif`, `sans-serif`, `Arial`, `Times New Roman`, `system-ui`, `Inter`, or any other fallback in `font-family`
- No Google Fonts or external font CDNs
- No Tailwind font utilities
- No inline font-family overrides on marketing HTML except server error stubs with `@font-face` pointing at `/fonts/`

### ✔ Required @font-face structure (Forge Web)

```css
@font-face {
  font-family: "Agency FB";
  src: url("/fonts/agency-fb/AgencyFB-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Agency FB";
  src: url("/fonts/agency-fb/AgencyFB-Regular.ttf") format("truetype");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Centaur";
  src: url("/fonts/centaur/Centaur-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

Canonical copy: `public/forge-premium-ui.css` (also sets `html, body { font-family: "Centaur"; }`).

---

## 2. SKIA SOVEREIGN TYPE SCALE

**PC baseline — shared with skia.ca.** All Forge Web surfaces should converge on this scale (see §11 for current drift).

| Role | Size | Font | Weight | Color |
|------|------|------|--------|-------|
| Display / Hero tagline | 42px | Agency FB | 500 | `#d4af37` |
| Page title | 34px | Agency FB | 500 | `#d4af37` |
| Section title | 26px | Agency FB | 500 | `#ffffff` |
| Section number (01, 02…) | 20px | Agency FB | 500 | `#d4af37` |
| Section subtitle | 18px | Centaur | 400 | `rgba(255,255,255,0.65)` |
| Card title | 16px | Agency FB | 500 | `rgba(212,175,55,0.7)` |
| Body text | 15px | Centaur | 400 | `#ffffff` |
| Forge footer — tagline & links (`footer`, `.doc-footer`) | 15px | Centaur | 400 | Gold Text; copyright `rgba(212,175,55,0.62)` |
| Context A long-form body (docs prose) | 15px | Centaur | 400 | `rgba(232,228,220,0.82)` or `rgba(255,255,255,0.68)` |
| Sidebar nav (inactive) | 15px | Agency FB | 500 | `rgba(212,175,55,0.7)` |
| Sidebar nav (active) | 15px | Agency FB | 500 | `#d4af37` |
| Sidebar nav (hover) | 15px | Agency FB | 500 | `rgba(212,175,55,0.85)` |
| Button text | 14px | Agency FB | 500 | `rgba(212,175,55,0.7)` |
| Metadata / labels | 13px | Agency FB | 400 | `rgba(255,255,255,0.65)` |
| Caption / footnote | 12px | Centaur | 400 | `rgba(255,255,255,0.45)` |
| Placeholder / disabled | 13px | — | — | `rgba(255,255,255,0.35)` |

### CSS tokens (target — add to shared Forge CSS when implementing)

```css
--skia-font-display-size: 42px;
--skia-font-page-title-size: 34px;
--skia-font-section-title-size: 26px;
--skia-font-section-number-size: 20px;
--skia-font-section-subtitle-size: 18px;
--skia-font-card-title-size: 16px;
--skia-font-body-size: 15px;
--skia-font-nav-size: 15px;
--skia-font-button-size: 14px;
--skia-font-metadata-size: 13px;
--skia-font-caption-size: 12px;
```

### Size reasoning

- **42px vs 34px** — clear separation between hero tagline and page titles
- **Section numbers at 20px** — never wraps to two lines
- **Sidebar nav at 15px** — primary navigation legibility
- **Body at 15px** — tighter and more refined than 16px
- **Button at 14px** — slightly smaller than nav so buttons do not overpower layout
- **Forge footer at 15px body** — tagline, copyright, nav links on hub and doc pages

---

## 3. COLOR PALETTE (THE ONLY COLORS ALLOWED)

Shared with skia.ca — identical gold system, backgrounds, cards, inputs, and semantic colors.

### Gold System (5 values — use only these)

| Name | Value | Usage |
|------|-------|-------|
| Gold Full | `#d4af37` | Active nav left stripe, active nav text, display/hero titles, page titles, section numbers, key accents, logo accent, active button states |
| Gold Text | `rgba(212,175,55,0.7)` | Inactive nav items, card titles, button text, section labels, footer text, category labels |
| Gold Hover | `rgba(212,175,55,0.85)` | Hover state for any gold text element, nav hover, button hover |
| Gold Border | `rgba(212,175,55,0.2)` | Default borders — cards (Context B), inputs, section dividers, panel borders |
| Gold Subtle | `rgba(212,175,55,0.08)` | Active item background, card hover background, selected button background |

**Gold must never turn yellow. Do not use values brighter than `#d4af37`.
Forbidden: `#ffd700`, `#ffcc33`, `#f1c232`, `#e6b800`, `#F59E0B`, any Tailwind yellow.**

---

### Backgrounds — Two-Context System

**Every Forge page must be explicitly assigned to Context A or Context B.**

#### Context A — Hub / Content Pages (Forge Web)

Warm dark brown. Open layout, hero elements, browsable content, documentation.

| Value | Token | Forge Web pages |
|-------|-------|-----------------|
| `#080400` | `--skia-page-bg` | `platform-downloads.html`, `resources.html`, `security.html`, `contact.html`, all `public/docs/*.html` (14 doc slugs) |

Optional ambient radial highlight on body (current implementation):

`radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,180,0,0.07) 0%, transparent 65%)` over `#080400`.

#### Context B — Tool / Task Pages

Cold near-black. Forms, persistent UI, execution console, IDE shell.

| Value | Token | Forge pages |
|-------|-------|-------------|
| `#0a0a0a` | `--skia-page-bg-context-b` | `/forge/platform` (`forgePlatformUi.ts`), **entire Forge IDE** (`skia-ide/`) |

**Rule:** No page defaults to either value accidentally. New pages must be explicitly assigned at build time.

---

### Cards & Panels — Three-Tier System

Context A and Context B use different card treatments. Do not apply `#111111` flat cards to Context A pages.

#### Tier 1 — Warm Heavy Cards (Context A only)

Feature cards, doc cards, package cards, primary content blocks on hub and doc pages.

| Element | Value |
|---------|-------|
| Background (web) | `linear-gradient(135deg, rgba(15,8,0,0.95) 0%, rgba(25,14,0,0.95) 100%)` or solid `#120a04` |
| Border | `rgba(212,175,55,0.3)` |
| Border on hover | `rgba(212,175,55,0.45)` |
| Body text | `rgba(255,255,255,0.68)` |

#### Tier 2 — Warm Light Cards (Context A only)

Checklist items, step rows, item lists, triage rows, `.item`, `.step`, `.check-item` on doc pages.

| Element | Value |
|---------|-------|
| Background | `rgba(212,175,55,0.04)` |
| Border | `rgba(212,175,55,0.18)` |
| Body text | `rgba(255,255,255,0.68)` |

#### Tier 3 — Cold Flat Cards (Context B only)

Execution console panels, IDE settings groups, auth inline blocks, generator-style panels.

| Element | Value |
|---------|-------|
| Background | `#111111` |
| Border | `rgba(212,175,55,0.2)` to `rgba(212,175,55,0.3)` |
| Border on hover | `rgba(212,175,55,0.45)` |

#### Shared

| Element | Value |
|---------|-------|
| Overlay / modal background | `#000000` |
| Zebra / alternating row | Do not use `#1a1a1a` on Forge Web — use Tier 2 light wash `rgba(212,175,55,0.04)` if striping is needed |

### Dropdown / Collapsible Cards on Context A

Whenever a page uses **Context A background (`#080400`)**, ALL dropdowns, collapsible sections, expandable cards, and nested content blocks MUST use **Tier 1 warm heavy cards**.

- Tier 3 cold flat cards (`#111111`) are forbidden on Context A.
- Tier 2 light cards are only for checklists or step rows, NOT dropdowns or collapsible panels.
- Collapsible shells must visually “lift” from the background using the Tier 1 gradient and `rgba(212,175,55,0.3)` border.

**Context B** (`#0a0a0a`): collapsible/dropdown shells use **Tier 3** (`#111111`).

---

### Input Fields

| Element | Value |
|---------|-------|
| Input background | `#111111` |
| Input border (default) | `rgba(212,175,55,0.2)` to `rgba(212,175,55,0.3)` |
| Input border (focus) | `rgba(212,175,55,0.7)` or `#d4af37` |
| Input text | `#ffffff` |
| Input placeholder | `rgba(255,255,255,0.35)` |

---

### Typography Colors

| Value | Usage |
|-------|-------|
| `#ffffff` | Primary body text |
| `rgba(255,255,255,0.68)` | Card body text, desc text on Context A pages |
| `rgba(255,255,255,0.65)` | Muted / secondary text, metadata |
| `rgba(255,255,255,0.55)` | IDE secondary hints (Forge IDE — §7) |
| `rgba(255,255,255,0.45)` | Captions, footnotes |
| `rgba(255,255,255,0.35)` | Placeholder, disabled text |
| `rgba(232,228,220,0.82)` | Context A long-form body copy (embedded docs) |

---

### Semantic Colors

| Value | Role |
|-------|------|
| `#4ade80` | Success, check icons, agent diff text (IDE) |
| `#ff5c5c` | Error, danger, auth banner (execution console) |
| `#f2c94c` | Warning |

**Semantic colors are for functional status indicators only — not for plan badges or decorative chrome.**

---

### SCROLLBAR (MANDATORY — FORGE WEB TARGET)

Canonical ecosystem scrollbar (align Forge Web to this on implementation pass):

- Thin **8px** track
- Dark track (`#0a0a0a`)
- Gold thumb (`rgba(212,175,55,0.7)`)
- Gold hover (`rgba(212,175,55,0.85)`)
- Rounded corners (8px)
- Firefox: `scrollbar-width: thin`, `scrollbar-color: rgba(212,175,55,0.7) #0a0a0a`

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.7); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.85); }
* { scrollbar-width: thin; scrollbar-color: rgba(212,175,55,0.7) #0a0a0a; }
```

**Forge IDE scrollbars:** documented as-is in §7.4 — do not change IDE scrollbars when aligning Forge Web.

Current Forge Web uses `html.skia-scrollbar-premium` in `public/forge-premium-ui.css` (**8px**, gold thumb per §3).

---

### ❌ Forbidden Colors

- `#ffd700`, `#ffcc33`, `#f1c232`, `#e6b800` — unapproved golds
- `#F59E0B` — off-brand amber
- `#1a1a1a` — forbidden on **Forge Web** zebra/striping (IDE may use `--skia-surface: #1a1a1a` per §7)
- Any Tailwind color utility
- Any color not listed in this section

---

## 4. ICONOGRAPHY

### Forge Web (`public/`)

- **Lucide-style stroke icons only** — no filled marketing icons
- Stylesheet: `public/forge-lucide-icons.css`
- Color: `#d4af37` / `currentColor` inherited from gold text
- Sidebar tab, nav accents, inline doc icons: stroke width ~1.75, round caps
- No emoji, no unicode bullets, no hyphens as bullets in customer-facing copy

### Documentation bullets

- **Default list bullets:** gold dot (5×5 circle) or inline gold accent — current doc HTML pattern
- **SKIA Crest SVG** (12×12, `#d4af37`) may be used where crest branding is intentional — match skia.ca doc patterns when adding new lists

### Forge IDE

- Chat prefix uses SKIA logo image (`#chat-logo`, 16×16)
- UI chrome uses text labels and borders — no emoji in IDE chrome

---

## 5. SPACING SYSTEM

| Value | Usage |
|-------|-------|
| 8px | Tight gaps, icon spacing |
| 12px | Inner card padding (compact) |
| 16px | Standard inner padding, horizontal padding |
| 24px | Section spacing (standard) |
| 36px | Section spacing (large) |
| 48px | Between major sections |

---

## 6. FORGE WEB — `forge.skia.ca`

Static marketing and documentation hub. Locale JSON in `public/locales/`; no browser/OS translation.

### 6.1 Page inventory & context assignment

| Page | Path | Context |
|------|------|---------|
| Downloads | `/platform-downloads` | A |
| Resources | `/resources` | A |
| Security | `/security` | A |
| Contact & Support | `/contact` | A |
| Documentation (14 slugs) | `/docs/*` | A |
| Execution console | `/forge/platform` | B |

Doc slugs: `readme`, `quickstart`, `user-guide`, `developer-guide`, `operator-manual`, `api-reference`, `security-guide`, `troubleshooting`, `support`, `pricing-and-packages`, `product-manual`, `enterprise-readiness-checklist`, `changelog`, plus generated HTML from `docs/*.md`.

### 6.2 Shared chrome

**Stylesheets (load order matters):**

- `public/forge-premium-ui.css` — fonts, scrollbars, logo sizing, footer typography
- `public/forge-lucide-icons.css` — stroke icons
- `public/forge-sidebar-locale.css` — globe locale switcher
- `public/forge-document-locale.js` + `public/forge-sidebar-locale.js` — i18n hydration

**PC sidebar (`#pcSidebar`):**

- Fixed left drawer, 260px, warm gradient shell
- Logo: `/sidebar-logo.png` — target 120px wide via `.pc-sidebar-logo-img` in `forge-premium-ui.css` (no circle crop)
- Nav links: `.pc-sidebar-btn` — uppercase, gold, 11px current / **15px target**
- Tab trigger: `.pc-sidebar-tab` — 36×72px gold-bordered pull tab with Lucide menu icon
- Locale switcher: `.skia-lang-switcher` in sidebar footer — globe + 12 langs

**Hero logo:**

- `.page-logo` / `.feature-page-logo` — 160px wide (110px mobile), gold drop-shadow

**Footer (`footer`, `.doc-footer`):**

- Tagline + links: Gold Text, **15px Centaur 400** (target; some pages currently 14px — see §11)
- Copyright: `rgba(212,175,55,0.62)`

**DOWNLOAD APP button:**

- Visible on **desktop browser only** — gated by `src/utils/forgeDownloadMarkup.ts` + client script
- Hidden on mobile browser and hidden entirely in Forge IDE

### 6.3 Context A — documentation layout

Doc pages share inline CSS patterns in `public/docs/*.html`:

| Element | Current | Target (§2) |
|---------|---------|-------------|
| `.doc-title` | 28px Agency FB, gold | 34px page title |
| `.doc-desc` | 14px Centaur soft white | 15px body |
| `.section-title` | 12px uppercase gold | 16px card title / metadata |
| `.section-body` | 13px Centaur | 15px body |
| `.item`, `.step`, `.check-item` | Tier 2 light cards | Tier 2 ✓ |
| `.card`, `.pkg-card` | Tier 1 heavy | Tier 1 ✓ |
| Body background | `#080400` + radial | Context A ✓ |

**Code blocks:** `.code-block` — dark fill, gold border, Centaur 12px (monospace not required on web docs).

### 6.4 Context B — execution console (`/forge/platform`)

Rendered by `src/forgePlatformUi.ts`. Cold tool layout:

| Element | Value |
|---------|-------|
| Page background | `#0a0a0a` |
| Topbar | 58px, `rgba(0,0,0,0.35)` + blur, gold brand 28px Agency FB |
| Main grid | 280px left rail + fluid main |
| Cards / panels | Tier 3 `#111111`, border `rgba(212,175,55,0.3)` |
| Download CTA | `.download-btn` — gold border, Gold Subtle fill, desktop only |
| Auth error banner | `#ff5c5c` semantic danger |
| Status line | 12px Agency FB uppercase muted |

Uses `forge-premium-ui.css` + `forge-platform-console.css` (no inline styles in `forgePlatformUi.ts`).

---

## 7. FORGE IDE — Electron desktop app

**Authority:** This section documents the **current shipped IDE design**. When Forge Web is aligned to §1–§5, **do not change the IDE** unless explicitly requested. The IDE is Context B; it intentionally differs from marketing pages in density, uppercase chrome, and monospace terminal.

**Source files:** `skia-ide/src/renderer/styles/skia-dark.css`, `skia-ide/src/renderer/index.html`, `skia-ide/src/renderer/editor/monacoSetup.ts`.

### 7.1 Shell layout

```
┌──────────────────────────────────────────────────────────────┐
│  Status bar (28px) — gold 10px uppercase                     │
├──────────┬─────────────────────────────┬─────────────────────┤
│ Sidebar  │  Center panel               │  Chat panel (360px) │
│ 240px    │  Editor / Settings / Forge  │  #0f0f0f background │
│ #0d0d0a  │  / Agent views              │                     │
├──────────┴─────────────────────────────┴─────────────────────┤
│  Terminal (220px min) — #050500, monospace                    │
└──────────────────────────────────────────────────────────────┘
```

Grid: `#app-shell` — `240px | 1fr | 360px`; height `calc(100vh - 28px)`.

### 7.2 CSS tokens (`skia-dark.css` `:root`)

| Token | Value | Usage |
|-------|-------|-------|
| `--skia-bg` | `#0a0a0a` | App background, editor, status bar |
| `--skia-sidebar` | `#0d0d0a` | Left sidebar |
| `--skia-panel` | `#111111` | Panels, chat header, settings label bar |
| `--skia-button-bg` | `#1a1a1a` | Buttons, user chat bubbles |
| `--skia-input` | `#111111` | Text inputs |
| `--skia-border` | `rgba(212,175,55,0.3)` | All structural borders |
| `--skia-gold` | `#d4af37` | Primary accent |
| `--skia-gold-accent` | `rgba(212,175,55,0.7)` | Secondary gold text |
| `--skia-muted-gold` | `#999999` | Inactive nav, user chat text |
| `--skia-text` | `#ffffff` | Primary text |
| `--skia-text-secondary` | `#999999` | Directory nodes |
| `--skia-text-muted` | `rgba(255,255,255,0.55)` | Labels, hints |
| `--skia-card` | `#111111` | Inputs, settings fields |
| `--skia-surface` | `#1a1a1a` | Buttons, select backgrounds |
| `--skia-success` | `#4ade80` | Agent diff output |
| `--skia-danger` | `#ff5c5c` | Auth errors |
| `--skia-warning` | `#f2c94c` | Warnings |

### 7.3 Typography (IDE-specific)

| Element | Size | Font | Weight | Notes |
|---------|------|------|--------|-------|
| `body` default | inherited | Centaur | 400 | **uppercase**, `letter-spacing: 0.1em` globally |
| `.view-header` | 24px | Centaur | 400 | Gold, uppercase |
| `#skia-nav .nav-item` | inherited | Centaur | 400 | Muted gold → gold active + 3px left stripe |
| Explorer tree | 11px | Centaur | 400 | **normal case**, `letter-spacing: 0.02em` |
| Chat messages | 14px | Centaur | 400 | User: right-aligned; Assistant: gold + left stripe |
| `#chat-input` | 12px | Centaur | 400 | **normal case**, 72px height |
| Buttons (global) | 10px | Centaur | 400 | Uppercase, gold border |
| Settings label | 10px | Centaur | 400 | Uppercase, `letter-spacing: 0.15em` |
| Settings row | 14px | Centaur | 400 | Normal case values |
| Status bar | 10px | Centaur | 400 | Gold |
| Forge status card title | 10px | Centaur | 400 | Uppercase gold |
| Forge status card value | 13px | Centaur | 400 | Gold, pre-wrap |

**Global rule:** `strong, b { font-weight: 400; }` — no bold in IDE chrome.

### 7.4 Scrollbars (IDE — keep as-is)

| Region | Width | Thumb |
|--------|-------|-------|
| Global (`::-webkit-scrollbar`) | 6px | `#d4af37` solid |
| Explorer tree | 4px | `var(--skia-border)`, hover `#d4af37` |
| Chat messages | thin | `var(--skia-border)` |

Do not unify IDE scrollbars to §3 canonical 8px without explicit IDE redesign request.

### 7.5 Sidebar navigation

- Logo: `#skia-sidebar-logo` — 80px wide, centered
- Nav items: `#skia-nav .nav-item` — padding 10px 14px, 3px gold left border when `.is-active`
- Settings entry: `#sidebar-settings` — pinned bottom, muted gold
- Explorer: `#explorer-tree` — file tree below nav, monospace-friendly filenames

### 7.6 Chat panel (`#chat-panel`)

| Element | Style |
|---------|-------|
| Background | `#0f0f0f` |
| Header | `--skia-panel`, gold brand + 16px logo |
| Assistant bubble | `--skia-panel`, 3px left gold border, gold text |
| User bubble | `--skia-button-bg`, muted gold text, right margin |
| Input | `--skia-card` bg, gold focus border |
| Tagline | 10px muted gold, centered |

### 7.7 Settings view

- Groups: `.settings-group` — bordered card, 4px radius
- Label bar: `.settings-label` — `--skia-card` header strip
- Rows: `.settings-row` — 14px, flex label/value
- Toggles: `.settings-toggle` — Gold Subtle fill
- Auth inline: `.settings-auth-inline` — Tier 2-style wash `rgba(212,175,55,0.04)`
- Locale select: `#settings-locale-select` — `--skia-surface`, gold border, min-width 12rem

### 7.8 Forge panel (`#view-forge`)

| Element | Style |
|---------|-------|
| `.forge-status-card` | `rgba(212,175,55,0.04)` bg, `rgba(212,175,55,0.15)` border, 4px radius |
| `.forge-offline-notice` | Gold Subtle bg, stronger border `rgba(212,175,55,0.35)` |
| `#forge-retry-btn` | Transparent, gold border, 10px uppercase |

### 7.9 Agent work panel (`#view-agent`)

- Hint text: 12px muted
- Log: `.agent-log` — `--skia-card`, bordered, 12px
- Log head: 10px gold uppercase
- Log body: 12px monospace (`Consolas`, `Cascadia Mono`)
- Diff rows: `--skia-success` green body text

### 7.10 Monaco editor (`skia-dark` theme)

| Element | Value |
|---------|-------|
| Editor background | `#0a0a0a` |
| Foreground | `#c9b37a` |
| Keywords / types | `#d4af37` |
| Strings | `#8a6f1e` |
| Comments | `#5a4a1e` italic |
| Line numbers | `#3a2f0a` / active `#d4af37` |
| Cursor | `#d4af37` |
| Selection | `#2a1f0088` |

Font: system monospace via Monaco defaults (not Centaur inside editor buffer).

### 7.11 Terminal (`#terminal-panel`)

**Documented exception — monospace allowed:**

| Element | Value |
|---------|-------|
| Background | `#050500` |
| Toolbar | `#0d0d00` |
| Font | `"Consolas", "JetBrains Mono", monospace` |
| Size | 12px |
| Brand | 10px gold uppercase |
| Tabs | Gold border when `.is-active`, Gold Subtle fill |
| xterm host | `#050500` |

Terminal is the only IDE surface where non-Centaur/non-Agency fonts are permitted.

### 7.12 IDE embedded docs (`skia-ide/src/renderer/docs/*.html`)

Standalone help pages inside the app — Context B styling:

- Background `#0a0a0a`, panel `#111111`, border `rgba(212,175,55,0.3)`
- Centaur body, gold headings uppercase
- Section cards: 8px radius, cold flat panels
- No sidebar locale switcher (IDE uses Settings locale select)

---

## 8. FORBIDDEN RULES (FORGE)

- ❌ No bold (700+) — anywhere except Monaco token rules inside editor
- ❌ No font-weight 600 or higher — anywhere in Forge Web or IDE chrome
- ❌ No fonts other than Agency FB and Centaur on Forge Web; IDE terminal/editor monospace only where documented
- ❌ No system font fallbacks as primary UI fonts on Forge Web
- ❌ No unapproved colors
- ❌ No filled marketing icons on Forge Web (Lucide stroke only)
- ❌ No emoji or unicode bullets in customer-facing copy
- ❌ No spacing values outside §5 without justification
- ❌ No gold values brighter than `#d4af37`
- ❌ No `#111111` flat cards on Context A Forge Web pages
- ❌ No warm Tier 1 gradient cards on Context B pages
- ❌ No page without an explicit Context A or Context B assignment
- ❌ No browser “Translate page” — Forge ships 12 locale JSON folders
- ❌ No DOWNLOAD APP CTA in Forge IDE
- ❌ No routing production LLM traffic to local Ollama from Forge server (see FORGE_RULES §7)

---

## 9. MANDATORY RULES (FORGE)

- ✔ All Forge Web typography must converge on §2 type scale (implementation pass)
- ✔ All colors must use §3 palette tokens
- ✔ All spacing must use §5 system
- ✔ Forge Web icons: Lucide stroke, sovereign gold
- ✔ Every Forge Web page assigned Context A or B in §6.1
- ✔ All gold text uses one of the 5 defined gold values
- ✔ Headings, nav, card titles, buttons on Forge Web: Agency FB 400 or 500 only
- ✔ Context A Forge Web: warm card tiers (Tier 1 or Tier 2)
- ✔ Context B Forge Web + entire IDE: cold flat cards (Tier 3)
- ✔ Locale changes: edit JSON in `public/locales/` + run `npm run locales:sync`
- ✔ IDE design changes must update §7 in this file when intentional

---

## 10. QUICK REFERENCE — GOLD DECISION TREE

1. Most important accent (active state, hero title, key number)? → **Gold Full `#d4af37`**
2. Label, nav item, card title, button text? → **Gold Text `rgba(212,175,55,0.7)`**
3. Forge footer tagline and links? → **Gold Text at 15px Centaur 400**; copyright → **`rgba(212,175,55,0.62)`**
4. Hover state? → **Gold Hover `rgba(212,175,55,0.85)`**
5. Border, divider, or input outline? → **Gold Border `rgba(212,175,55,0.2)`**
6. Background tint (active card, selected button)? → **Gold Subtle `rgba(212,175,55,0.08)`**

---

## 11. QUICK REFERENCE — BACKGROUND & CARD DECISION TREE

**Page background:**

- Marketing, docs, downloads, resources? → **Context A `#080400`**
- Execution console, IDE shell? → **Context B `#0a0a0a`**

**Card type:**

- Context A, primary content card? → **Tier 1 warm heavy gradient**
- Context A, checklist/step/item row? → **Tier 2 warm light**
- Context B, any card or panel? → **Tier 3 cold flat `#111111`**

---

## 12. IMPLEMENTATION STATUS (DO NOT SKIP — READ BEFORE CODING)

Design bible **v1.0** migrated to Forge Web on **2026-06-03**.

| Area | Status | Source |
|------|--------|--------|
| Context A hub + docs typography/cards | ✔ Implemented | `public/forge-hub-design.css` |
| Shared fonts + scrollbars + footer | ✔ Implemented | `public/forge-premium-ui.css` |
| Context B execution console, sign-in, chat | ✔ Implemented | `public/forge-platform-console.css` |
| Static HTML (`public/`, `public/docs/`) | ✔ Inline styles removed | `scripts/apply-forge-hub-design.mjs` |
| Dynamic shells | ✔ External CSS only | `forgePlatformUi.ts`, `forgeSignInUi.ts`, `chatUi.ts` |
| **Forge IDE** | ✔ Unchanged per §7 | `skia-dark.css` — no web retro-fit |

Maintenance scripts:

- `node scripts/apply-forge-hub-design.mjs --check` — hub HTML still links shared CSS
- `npm run fonts:check` — only `"Agency FB"` / `"Centaur"` in user-facing paths
- `scripts/normalize-forge-colors.mjs` — gold token drift in `public/`, `src/` (excludes design CSS token files where noted)
- `scripts/normalize-forge-font-sizes.mjs` — legacy drift cleanup; **skips** `forge-premium-ui.css`, `forge-hub-design.css`, `forge-platform-console.css`

---

## 13. CROSS-REPO SYNC

When skia.ca updates shared tokens in `Skia-FULL/design_bible.md`, mirror changes here in §1–§5 and verify Forge Web still lists correct page inventory in §6. Forge IDE (§7) only changes when the IDE team intentionally updates `skia-dark.css`.

**Related Forge docs:** `.cursor/rules/FORGE_RULES.md` §11, `guides/FORGE_COPY_AUDIT.md`, `public/forge-premium-ui.css`, `public/forge-hub-design.css`, `public/forge-platform-console.css`.
