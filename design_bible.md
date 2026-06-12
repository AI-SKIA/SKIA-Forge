# SKIA FORGE DESIGN BIBLE — ROOT AUTHORITY

**Version 2.9 — Sovereign Forge spec — 2026-06-12**

This file is the **sole design law** for **SKIA-Forge** (`forge.skia.ca`, Forge IDE).

**Authority in this repo:** Source files in `public/`, `src/`, and `skia-ide/` — plus this bible. When you create or update any Forge page, component, or stylesheet, **follow this document**. If code and this bible disagree, fix the code or update this bible in the same change.

**Cross-product brand standard (not shared code):** SKIA Forge and skia.ca are **separate products** with **separate repos**, **separate implementations**, and **separate design bibles**. They use the **same brand system** — fonts, gold palette, sovereign type scale (15–38px), card tiers, spacing, scrollbars, crest bullets — so users see one SKIA family. **Each repo documents that system in its own bible.** Neither bible is upstream of the other; both must stay consistent when brand tokens change (§13).

| Product | Domain | Design bible | Stack |
|---------|--------|--------------|-------|
| skia.ca | `skia.ca` | `Skia-FULL/design_bible.md` | Next.js / React |
| SKIA Forge Web | `forge.skia.ca` | **This file** §1–§6 | Static HTML + `public/*.css` |
| Forge IDE | Desktop app | **This file** §7 | Electron — `skia-ide/` |

**Agent law (translations, fonts, inference, vendors):** `docs/architecture/SOVEREIGN_PLATFORM.md` + `FORGE_RULES.md` §0.5.

All Forge pages, components, styles, and generators must comply with **this file**.

**Not in scope for this repo:** skia.ca React app, React Native mobile, workspace hub pages, SKIA Echo / Video / Image, marketplace, onboarding, or any surface outside Forge Web + Forge IDE.

**This document records Forge design law** — brand tokens (§1–§5), Forge Web shell (§6), Forge IDE (§7), and CSS implementation status (§12).

---

## 0. PRODUCT SURFACES

Forge ships **two user-facing surfaces**. Every UI change must declare which surface it targets.

| Surface | ID | Where | Context | Brand match (skia.ca hub pages) |
|---------|-----|-------|---------|--------------------------------|
| **Forge Web** | `forge-web` | `forge.skia.ca` — static HTML in `public/`, dynamic `/forge/platform` from `src/forgePlatformUi.ts` | Context A (marketing/docs) or Context B (execution console) | Hub/doc pages use same tokens and shell patterns as skia.ca Forge Hub (§6) |
| **Forge IDE** | `forge-ide` | Electron desktop app — `skia-ide/` | Context B (tool surface) | **Exempt** — §7 documents shipped IDE design; do not retro-fit to web marketing patterns |

**Platform notes (Forge Web only):**

- **Desktop browser:** hub sidebar, locale switcher, **DOWNLOAD APP** CTA on server-rendered surfaces (`/forge/platform`, `/chat`) where applicable
- **Mobile browser:** same pages; **DOWNLOAD APP** hidden on server-rendered surfaces via `forgeDownloadClientGateScript()`; static hub sidebar still links to `/platform-downloads`. No native mobile Forge app in this repo.
- **Forge IDE:** no download CTAs (user already has the app).

**Equivalent hub routes (same brand shell, different domains):**

| forge.skia.ca | skia.ca | Forge shell reference (§6) |
|---------------|---------|----------------------------|
| `/resources` | `/resources` | §6.2 hub chrome |
| `/security` | `/security` | §6.2 |
| `/contact` | `/contact` | §6.2 |
| `/platform-downloads` | `/download` | §6.2 + download cards |
| `/docs/*` | `/docs/[doc]` | §6.2 doc header + body |
| `/forge/platform` | — (Forge-only) | Context B tool shell |

**Documented Forge-only layout differences (not drift):** sidebar width 260px (Forge) vs 280px (ECHO on skia.ca); `.back-btn` static HTML class (Forge) vs `PageShellBackButton` React component (skia.ca) — both viewport-fixed per §6.2; **platform console topbar 58px** (Forge `/forge/platform`) vs **52px** mobile shell (skia.ca); **hub hero logo 170px** (Forge `.skia-forge-hub__logo`, `.page-logo`) vs **180px** (skia.ca hub heroes). Same 800px centered column.

---

## 1. FONTS (MANDATORY, NON-NEGOTIABLE)

Brand standard — same on skia.ca and forge.skia.ca. Forge **must not** rely on the user’s operating system or browser to supply brand typography. All customer-facing UI uses **self-hosted `.ttf` files** loaded via `@font-face`.

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

Use CSS variables where helpful (defined in `public/forge-premium-ui.css`):

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
- No Tailwind font-size utilities — Forge Web user-facing sizes must stay within **15px–38px** (§2.0)
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

**Brand standard — 15–38px sovereign scale.** Forge Web must use this scale. **Forge IDE (§7) is exempt** from the 15px floor on chrome density surfaces.

### 2.0 Font size bounds (Forge Web — mandatory target)

| Rule | Detail |
|------|--------|
| Floor | **15px minimum** for all readable text on Forge Web |
| Ceiling | **38px maximum** for all readable text on Forge Web |
| Tokens | `--skia-font-*` in `public/forge-premium-ui.css` + `public/forge-hub-design.css` (must match table below) |
| Forbidden (floor) | Hardcoded `font-size` below 15px on Forge Web user-facing copy |
| Allowed exception | Icon/dot dimensions only (crest SVG 12×12 / 18×18, Lucide SVG sizing) — not user-facing text |
| Locale caret | `.skia-lang-switcher__caret` — **10px** — exempt as non-readable icon chrome (dropdown indicator glyph, not user-facing copy); same class of exception as icon/dot dimensions |
| IDE exception | §7 may use 10–14px on explorer, status bar, terminal — documented IDE chrome only |

| Role | Size | Font | Weight | Color |
|------|------|------|--------|-------|
| Display / Hero tagline | **38px** | Agency FB | 500 | `#d4af37` |
| Page title (`.page-title`, `.doc-title`) | 34px | Agency FB | 500 | `#d4af37` |
| Section title | 26px | Agency FB | 500 | `#ffffff` |
| Section number (`.step-num`, `.esc-num`) | 20px | Agency FB | 500 | `#d4af37` |
| Section subtitle (`.page-subtitle`, `.doc-desc`) | 18px | Centaur | 400 | `rgba(255,255,255,0.65)` or soft white `0.68` |
| Section / card label — **doc pages** (`.section-label`, `.doc-card-title`) | 16px | Agency FB | 500 | Gold Text — `--skia-font-card-title-size` |
| Hub section label — **hub pages** (`.skia-forge-hub__section-label`) | 26px | Agency FB | 500 | `#ffffff` — `--skia-font-section-title-size`; separate selector from doc `.section-label` |
| Body text | 15px | Centaur | 400 | `#ffffff` / prose `rgba(232,228,220,0.82)` |
| Forge footer — tagline & links (`footer`, `.doc-footer`) | 15px | Centaur | 400 | Gold Text; copyright `rgba(212,175,55,0.62)` |
| Context A long-form body (`.section-body`, doc prose) | 15px | Centaur | 400 | `rgba(232,228,220,0.82)` |
| Sidebar nav (`.pc-sidebar-btn`) | 15px | Agency FB | 500 | Gold Text; active `#d4af37` |
| Sidebar tagline (`.pc-sidebar-logo-tagline`) | 15px | Agency FB | 400 | Gold Text |
| Button text (`.submit-btn`, `.feature-tab`) | **15px** | Agency FB | 500 | Gold Text — `--skia-font-button-size` |
| Back control (`.back-btn`) | **15px** | Agency FB | 500 | Gold Text `rgba(212,175,55,0.7)` — `--skia-font-caption-size`; `letter-spacing: 0.08em`; `line-height: 1`; padding `8px 14px`; computed **80×33px** (skia.ca) — §12.3 |
| Metadata / labels (`.doc-badge`, `.field label`, `.sla-label`) | **15px** | Agency FB | 400 | `rgba(255,255,255,0.65)` |
| Caption / footnote (`.form-status`, code in `.code-block`) | **15px** | Centaur | 400 | `rgba(255,255,255,0.45)` |
| Placeholder / disabled | **15px** | — | — | `rgba(255,255,255,0.35)` |

### CSS tokens

```css
--skia-font-display-size: 38px;
--skia-font-page-title-size: 34px;
--skia-font-section-title-size: 26px;
--skia-font-section-number-size: 20px;
--skia-font-section-subtitle-size: 18px;
--skia-font-card-title-size: 16px;
--skia-font-body-size: 15px;
--skia-font-nav-size: 15px;
--skia-font-button-size: 15px;
--skia-font-metadata-size: 15px;
--skia-font-caption-size: 15px;
--skia-font-placeholder-size: 15px;
```

**Forge CSS (2026-06-05):** `forge-premium-ui.css`, `forge-hub-design.css`, and `forge-platform-console.css` declare sovereign tokens (`display: 38px`, `button/metadata/caption/placeholder: 15px`). See §12 alignment table.

### Size reasoning (brand standard — same on skia.ca)

- **15px floor (2026-06)** — caption, metadata, button, placeholder, sidebar footer all at 15px minimum
- **38px ceiling** — display/hero is the only role at the ceiling (not 42px)
- **38px vs 34px** — hero tagline vs page title separation
- **Forge footer at 15px** — already implemented in `forge-premium-ui.css` ✔

---

## 3. COLOR PALETTE (THE ONLY COLORS ALLOWED)

Brand standard — same gold system, backgrounds, cards, inputs, and semantic colors on skia.ca and forge.skia.ca.

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

#### Cross-tier (Context A + B)

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
| `#4ade80` | Success, check icons, agent diff text (IDE), form success (`.form-status.success`) |
| `#ff5c5c` | Error / danger / critical severity, auth banner, form error |
| `#f2c94c` | Warning severity |
| `#d4af37` | Warning on brand-audit-style outputs (when added to Forge Web) |

**Semantic colors are for functional status indicators only — not for plan badges or UI chrome.**

#### Info / low severity tier (§3 — Forge Web)

| Element | Value |
|---------|-------|
| Info text / label | `rgba(255,255,255,0.65)` — metadata white |
| Info row background | `rgba(255,255,255,0.04)` |
| Info row border | Gold Border `rgba(212,175,55,0.2)` |

**Forbidden on new Forge Web surfaces:** `#7eb8f7`, legacy info blue.

---

### Page logos — sizing (canonical 2026-06-05 — Forge Web)

Asset: `/sidebar-logo.png` on all Forge Web heroes and sidebar.

**Rule:** Column hero logos and sidebar nav logos are **independent** — hero bumps must **never** change `.pc-sidebar-logo-img`.

| Context | Class | Width | Where defined |
|---------|-------|-------|---------------|
| **Hub / doc hero** — resources, security, contact, downloads, all docs | `.skia-forge-hub__logo`, `.page-logo`, `.feature-page-logo` | **170px** (Forge hub hero — intentional 10px delta vs skia.ca 180px; see §0 documented product differences) | `forge-hub-design.css`, `forge-premium-ui.css` |
| **PC sidebar drawer** (nav only) | `.pc-sidebar-logo-img` | **120px** (unchanged) | `forge-premium-ui.css` |
| **Forge IDE sidebar** | `#skia-sidebar-logo` | **80px** (unchanged — §7) | `skia-dark.css` |

**Drop shadow (hub heroes):** `drop-shadow(0 0 20px rgba(212,175,55,0.25))` on `.skia-forge-hub__logo`; stronger shadow on `.page-logo` / `.feature-page-logo` matches skia.ca `.feature-page-logo`.

**Do not regress:** 120px hub heroes (pre-2026-06-05); scaling sidebar logos when hero logos change.

---

### SCROLLBAR (MANDATORY — FORGE WEB)

Brand-standard 8px gold scrollbar. Implemented in `public/forge-premium-ui.css` on `html.skia-scrollbar-premium` and `.skia-scrollbar-premium` descendants.

- Thin **8px** track
- Dark track (`#0a0a0a`)
- Gold thumb (`rgba(212,175,55,0.7)`)
- Gold hover (`rgba(212,175,55,0.85)`)
- Rounded corners (8px)
- Firefox: `scrollbar-width: thin`, `scrollbar-color: rgba(212,175,55,0.7) #0a0a0a`

```css
* { scrollbar-width: thin; scrollbar-color: rgba(212,175,55,0.7) #0a0a0a; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.7); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.85); }
```

**Forge IDE scrollbars:** documented as-is in §7.4 — do not change IDE scrollbars when aligning Forge Web to skia.ca.

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

- **Lucide-style stroke icons** for marketing chrome, nav, and feature cards — stylesheet: `public/forge-lucide-icons.css`
- **SKIA Crest SVG** for all list bullets (§4 documentation bullets) — stylesheet: `public/forge-crest-bullet.css`; only documented filled element is the 2×2 sovereign core in the crest
- Color: `#d4af37` / `currentColor` inherited from gold text
- Sidebar tab, nav accents, inline doc icons: stroke width ~1.75, round caps
- No emoji, no unicode bullets, no hyphens as bullets in customer-facing copy

### Documentation bullets (Forge Web — §4)

SKIA Crest SVG is the only permitted list bullet. Two sizes — **placement determines size**, not arbitrary choice.

| Context | SVG size | Markup | Row layout |
|---------|----------|--------|------------|
| **Card-body copy row** — `.item`, `.check-item`, `.triage-item`, `.kc-item`, Tier 2 bordered rows beside 15px Centaur body | **18×18** | `<span class="item-crest item-crest--body">` + inline SVG | CSS grid: **22px** icon column + **10px** gap + fluid text (`forge-hub-design.css` + `forge-crest-bullet.css`) |
| **Compact inline prose** — rare nested list inside paragraph (no Tier 2 card) | **12×12** | `<span class="item-crest">` | Inline flex; `margin-top: 2px` on icon |
| **Explicit crest row** — new copy blocks mirroring skia.ca Who Is SKIA cards | **18×18** | `.skia-crest-bullet-row` > `.skia-crest-bullet-icon` + `.skia-crest-bullet-text` | Same 22px / 10px grid |

**Alignment (card-body rows):**

- Icon **`margin-top: 3px`** — top-aligns crest to **cap height** of first line of 15px body copy (line-height **1.55**).
- Text sits in second grid column; never wraps under the icon.
- Color: **`#d4af37`** stroke + 2×2 sovereign core fill.

**CSS tokens** (`public/forge-crest-bullet.css`): `--skia-crest-bullet-size-body: 18px`, `--skia-crest-bullet-col-width: 22px`, `--skia-crest-bullet-col-gap: 10px`, `--skia-crest-bullet-offset: 3px`.

**Canonical asset:** `public/icons/skia-crest-bullet.svg` — same crest geometry as skia.ca.

**Scripts:** `node scripts/fix-forge-crest-bullets.mjs` (inline SVG + 12→18 upgrade for `.item` rows); `node scripts/check-forge-crest-bullets.mjs` (CI guard).

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

### 6.2 Hub shell chrome (brand standard — §6)

**Stylesheets (load order — every Context A HTML page):**

1. `public/forge-premium-ui.css` — `@font-face`, type tokens, scrollbars, footer typography
2. `public/forge-lucide-icons.css` — stroke icons
3. `public/forge-crest-bullet.css` — SKIA Crest list bullets
4. `public/forge-hub-design.css` — Context A layout, `.skia-forge-hub__*`, sidebar
5. `public/forge-sidebar-locale.css` — globe locale switcher
6. `public/forge-document-locale.js` + `public/forge-sidebar-locale.js` — i18n hydration

**Content column (§6 shell — brand standard matches skia.ca hub pages):**

| Property | Brand standard | Forge Web | Status |
|----------|----------------|-----------|--------|
| Shell delivery | `padding-top:0.75rem`; horizontal/bottom `40px`; `max-width:800px; margin:0 auto; box-sizing:border-box` on main column | **Same values inline on `.wrap`** ✔ | §6 shell inline |
| Inner hub wrapper | `<div class="skia-forge-hub">` | `<div class="skia-forge-hub">` ✔ | ✔ |
| Hub class family | `.skia-forge-hub__*` | `.skia-forge-hub__*` in `forge-hub-design.css` ✔ | Same BEM names |
| Max width | `800px` centered | inline `max-width:800px` ✔ | **800px** |
| Padding | `padding-top: 0.75rem`; sides/bottom `40px` | inline `padding: 0.75rem 40px 40px 40px` ✔ | ✔ (2026-06-10) |
| Back control | Viewport-fixed (skia.ca §6.1 parity) | `.back-btn` in DOM inside `.wrap`; CSS `position: fixed` ✔ | Desktop `top:1rem left:48px z-index:150`; mobile `top:calc(52px + safe-area) left:1rem` |

**Card grids (`forge-hub-design.css`):** Desktop **≥769px** — `.skia-forge-hub__doc-grid`, `.doc-grid`, and `.card-grid` use `grid-template-columns: repeat(3, minmax(0, 1fr))` (three columns in the 800px column). **≤768px** — same classes revert to `repeat(auto-fill, minmax(240px, 1fr))` / `minmax(220px, 1fr)` (unchanged). `.triage-grid` — fixed **2 columns** (contact page; intentional). `.pkg-grid` — `repeat(auto-fill, minmax(200px, 1fr))` (renders three at desktop but left flexible due to long pricing copy). `.controls-grid` and `.scope-grid` — `auto-fill` unchanged. Full spec §12.3.

**Server routes (crest delivery):** `GET /forge-crest-bullet.css`, `GET /icons/*` in `src/server.ts`.

**PC sidebar (`#pcSidebar`):**

- Fixed left drawer, **260px** (Forge) — skia.ca PCSidebar is equivalent family
- Logo: `/sidebar-logo.png` — **120px** wide via `.pc-sidebar-logo-img` ✔
- Tagline: **`SKIA FORGE IDE`** via `common.sidebar.tagline` (text, not baked into PNG)
- Nav links: `.pc-sidebar-btn` — **15px** Agency FB uppercase, flex-centered ✔
- Tab trigger: `.pc-sidebar-tab` — 36×72px gold-bordered pull tab with Lucide menu icon
- Locale switcher: `.skia-lang-switcher` in sidebar footer — 12 langs

**Hero logo (column — not sidebar):**

- `.skia-forge-hub__logo`, `.page-logo`, `.feature-page-logo` — **170px** wide (Forge hub hero — intentional 10px delta vs skia.ca 180px; see §0 documented product differences)
- Sidebar drawer logo stays **120px** via `.pc-sidebar-logo-img` — do not change with hero size

**Footer (`footer`, `.doc-footer`):**

- Tagline + links: Gold Text, **15px Centaur 400** ✔ — matches `SkiaLegalFooter` / skia.ca `.skia-forge-footer__*`
- Copyright: `rgba(212,175,55,0.62)` ✔
- **Nav row (order — matches skia.ca; implemented 2026-06-12 on all 17 Context A pages):**

| # | Label (en) | i18n key | href | Target |
|---|------------|----------|------|--------|
| 1 | Who is SKIA? | `common.footer.whoIsSkia` | `https://skia.ca/en/sovereign-core/who-is-skia` | skia.ca — `target="_blank"` `rel="noopener noreferrer"` |
| 2 | Privacy Policy | `common.footer.privacyPolicy` | `https://skia.ca/en/privacy` | skia.ca — `target="_blank"` `rel="noopener noreferrer"` |
| 3 | Contact & Support | `common.footer.contactSupport` | `/contact` | Forge internal (locale-routed) |
| 4 | Resources | `common.footer.resources` | `/resources` | Forge internal |
| 5 | Security | `common.footer.security` | `/security` | Forge internal |

- Hub pages: `<footer>` → `.footer-links` + `| ` separators (`.sep`)
- Doc pages: `.doc-footer` → `.links` + same five-link markup
- Copy in **`public/locales/*/common.json`** — 12 langs; run `npm run locales:validate` after edits
- External skia.ca URLs use fixed `/en/` paths; link **labels** localize via i18n

**DOWNLOAD APP button:**

- **Server-rendered surfaces** (`/forge/platform`, `/chat`): `.download-btn` / `.ide-download-app` via `src/utils/forgeDownloadMarkup.ts` — `data-skia-forge-download` + `forgeDownloadClientGateScript()` hides on mobile browser and Forge IDE
- **Static Context A HTML:** sidebar nav includes **Download SKIA Forge** (`.pc-sidebar-btn` → `/platform-downloads`) — always visible; not gated (navigation to downloads hub, not the skia.ca hero chip)
- **`/platform-downloads`:** installer CTAs remain visible on all viewports (user is on the download page)

### 6.3 Context A — documentation layout

Doc pages share classes in `public/forge-hub-design.css` (linked from all `public/docs/*.html`):

| Element | Current (CSS) | skia.ca target (§2) | Status |
|---------|---------------|---------------------|--------|
| `.page-title`, `.doc-title` | 34px Agency FB gold | 34px page title | ✔ |
| `.page-subtitle`, `.doc-desc` | 15px Centaur soft white | 15px body / 18px subtitle | ✔ body |
| `.section-label`, `.section-title` | 16px Agency FB gold | 16px card title | ✔ |
| `.section-body` | 15px Centaur prose | 15px Context A body | ✔ |
| `.doc-card-title`, `.card-title` | 16px Agency FB | 16px card title | ✔ |
| `.doc-card-desc`, `.item-text` | 15px Centaur | 15px body | ✔ |
| `.doc-badge`, `.field label`, `.sla-label` | **15px** via `--skia-font-metadata-size` | **15px** metadata | ✔ |
| `.code-block`, `.form-status` | **15px** via `--skia-font-caption-size` | **15px** caption | ✔ |
| `.submit-btn`, `.feature-tab` | **15px** via `--skia-font-button-size` | **15px** button | ✔ |
| `.back-btn` | **15px** via `--skia-font-caption-size`; `letter-spacing: 0.08em`; `line-height: 1`; padding `8px 14px`; computed **80×33px** (skia.ca) | skia.ca `.skia-back-btn` | ✔ (2026-06-12) |
| `.item`, `.step`, `.check-item` | Tier 2 light cards | Tier 2 | ✔ |
| `.step-num` / `.step-text` | **15px** Agency FB number + **15px** Centaur copy, `gap: 14px`, `align-items: flex-start`, `margin-top: 1px` on number | doc-embed parity | ✔ |
| `.practice-num`, `.esc-num` | **15px** Agency FB, `flex-start` + `margin-top: 1px` (multi-line rows stay top-aligned) | security/contact parity | ✔ |
| `.doc-card`, `.card`, `.pkg-card` | Tier 1 heavy gradient | Tier 1 | ✔ |
| Body background | `#080400` + radial | Context A | ✔ |
| Mobile `.page-title` | 28px at ≤680px | Responsive shrink OK | ✔ intentional |

**Code blocks:** `.code-block` — dark fill, gold border, Centaur at caption token (raise to 15px on alignment pass).

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
| Status line | 15px Agency FB uppercase muted via `--skia-font-caption-size` | ✔ |

Uses `forge-premium-ui.css` + `forge-platform-console.css` (no inline styles in `forgePlatformUi.ts`).

---

## 7. FORGE IDE — Electron desktop app

**Authority:** This section documents the **current shipped IDE design**. When Forge Web is aligned to §1–§5, **do not change the IDE** unless explicitly requested. The IDE is Context B; it intentionally differs from marketing pages in density, uppercase chrome, and monospace terminal.

**Boundary:** `/forge/platform` (Forge Web execution console) is NOT part of the Forge IDE (§7). It is a Context B web surface in `forge-platform-console.css`. §7 covers `skia-ide/` only.

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
- ❌ No fonts other than Agency FB and Centaur on Forge Web; IDE terminal/editor monospace only where documented (§7.11)
- ❌ No system font fallbacks as primary UI fonts on Forge Web
- ❌ **No Forge Web user-facing font size below 15px or above 38px** (after alignment pass — §2.0)
- ❌ No unapproved colors on new Forge Web surfaces (§3 documented exceptions only)
- ❌ No filled marketing icons on Forge Web (Lucide stroke only) — **except** SKIA Crest bullet sovereign core (§4)
- ❌ No emoji, unicode bullets, hyphens as bullets, or **gold-dot circle bullets** (`border-radius: 50%` on `.item-dot` / `.kc-bullet` / `.triage-dot`) in customer-facing copy — SKIA Crest SVG only (§4)
- ❌ No spacing values outside §5 without justification
- ❌ No gold values brighter than `#d4af37`
- ❌ No `#111111` flat cards on Context A Forge Web pages
- ❌ No warm Tier 1 gradient cards on Context B pages
- ❌ No page without an explicit Context A or Context B assignment (`body.forge-context-a` / `body.forge-context-b`)
- ❌ No browser “Translate page” — Forge ships 12 locale JSON folders
- ❌ No DOWNLOAD APP CTA in Forge IDE
- ❌ No routing production LLM traffic to local Ollama from Forge server (see FORGE_RULES §7)
- ❌ No legacy Forge type tokens (`42px` display, `12–14px` secondary roles) on **new** Forge Web CSS after alignment pass

---

## 9. MANDATORY RULES (FORGE)

- ✔ **Forge Web must comply with §1–§5** — see §12 for current CSS status
- ✔ All Forge Web typography uses `--skia-font-*` tokens — no hardcoded sizes outside §2
- ✔ All colors must use §3 palette tokens
- ✔ All spacing must use §5 system
- ✔ Forge Web icons: Lucide stroke for chrome; **SKIA Crest SVG for list bullets** — **18×18** in Tier 2 card-body rows, **12×12** compact prose only (§4, `public/forge-crest-bullet.css`)
- ✔ Every Forge Web page assigned Context A or B in §6.1
- ✔ All gold text uses one of the 5 defined gold values (IDE §7 grays are IDE-only)
- ✔ Headings, nav, card titles, buttons on Forge Web: Agency FB 400 or 500 only
- ✔ Context A Forge Web: warm card tiers (Tier 1 or Tier 2)
- ✔ Context B Forge Web + entire IDE: cold flat cards (Tier 3)
- ✔ Locale changes: edit JSON in `public/locales/` + run `npm run locales:sync`
- ✔ IDE design changes must update §7 in this file when intentional
- ✔ Hub/doc pages must follow §6 shell — layout, footer (five-link nav §6.2), cards, and type scale (brand standard matches skia.ca hub pages)

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

## 12. IMPLEMENTATION STATUS — FORGE CSS

**Authority:** **This bible** §1–§6 and Forge source files in `public/`, `src/`. This table records whether Forge CSS matches **this document**. When code and §1–§6 disagree, fix the CSS or update this bible in the same change.

### 12.1 Aligned ✔

| Area | Evidence |
|------|----------|
| Context A hub + doc cards (Tier 1 / Tier 2) | `public/forge-hub-design.css` |
| Context A background `#080400` + radial | `body.forge-context-a` |
| Footer 15px Gold Text + copyright 0.62 | `public/forge-premium-ui.css` lines 182–214 |
| Footer nav — five links, skia.ca order | All 17 Context A HTML pages + `public/locales/*/common.json` ✔ (2026-06-12) |
| Page title 34px, body 15px, card titles 16px | `forge-hub-design.css` via tokens + classes |
| Sidebar nav 15px | `--skia-font-nav-size` + `.pc-sidebar-btn` |
| Scrollbars 8px gold on `html.skia-scrollbar-premium` | `forge-premium-ui.css` ✔ matches skia.ca |
| Context B console Tier 3 panels | `forge-platform-console.css` |
| Fonts self-hosted, no CDN | `forge-premium-ui.css` `@font-face` |
| Static HTML — §6.1 shell inline + `.skia-forge-hub__*` classes | `scripts/migrate-forge-shell-inline.mjs`, `scripts/migrate-forge-skia-hub-shell.mjs` ✔ |
| List bullets — SKIA Crest SVG (12×12 / 18×18) | `public/forge-crest-bullet.css`, `public/icons/skia-crest-bullet.svg`, `scripts/check-forge-crest-bullets.mjs` ✔ |
| Footer viewport pin (short pages) | `forge-hub-design.css` — body flex column, wrap flex:1, footer margin-top:auto |
| Section labels — `.skia-forge-hub__section-label` + `.download-web-text` | Agency FB 500 26px #ffffff — `forge-hub-design.css` ✔ |
| `/forge/platform` headings — Agency FB 500 | Module headings 26px (`--skia-font-section-title-size`); labels ("PROMPT" etc.) 15px uppercase (`--skia-font-caption-size`); `letter-spacing: 0.08em` — `forge-platform-console.css` ✔ (2026-06-10) |
| `/forge/platform` sidebar active state | `rgba(212,175,55,0.08)` fill + `border-left: 2px solid #d4af37` + `color: #d4af37`; no solid gold box — `forge-platform-console.css` ✔ (2026-06-10) |
| **Forge IDE** | `skia-dark.css` — unchanged per §7 |

### 12.2 Token alignment ✔ (2026-06-05 pass)

`:root` tokens in **`public/forge-premium-ui.css`**, **`public/forge-hub-design.css`**, and **`public/forge-platform-console.css`**:

| Token | Brand standard | Forge CSS | Files |
|-------|----------------|-----------|-------|
| `--skia-font-display-size` | **38px** | 38px ✔ | `forge-premium-ui.css`, `forge-hub-design.css` |
| `--skia-font-button-size` | **15px** | 15px ✔ | all three design CSS files |
| `--skia-font-metadata-size` | **15px** | 15px ✔ | hub + console + `forge-sidebar-locale.css` |
| `--skia-font-caption-size` | **15px** | 15px ✔ | hub + console |
| `--skia-font-placeholder-size` | **15px** | 15px ✔ | premium + hub + console |

Enforcement: `node scripts/normalize-forge-font-sizes.mjs --check` (Forge Web only; IDE exempt).

### 12.3 Layout alignment ✔ (2026-06-05 pass; **2026-06-12** back button, card grid, footer nav)

#### Footer nav — skia.ca parity (2026-06-12)

| Property | Spec |
|----------|------|
| Link order | Who is SKIA? → Privacy Policy → Contact & Support → Resources → Security |
| External (1–2) | `https://skia.ca/en/sovereign-core/who-is-skia`, `https://skia.ca/en/privacy` — new tab, `rel="noopener noreferrer"` |
| Internal (3–5) | `/contact`, `/resources`, `/security` — Forge routes (locale prefix applied by router) |
| i18n keys | `common.footer.whoIsSkia`, `.privacyPolicy`, `.contactSupport`, `.resources`, `.security` |
| Pages | 4 hub (`contact`, `platform-downloads`, `resources`, `security`) + 13 `public/docs/*.html` |
| Hub markup | `<div class="footer-links">` inside `<footer>` |
| Doc markup | `<div class="links">` inside `.doc-footer` |

#### Back button (`.back-btn`) — skia.ca parity

| Property | Spec |
|----------|------|
| `font-size` | `var(--skia-font-caption-size)` (was `--skia-font-button-size`) |
| `color` | Gold Text `rgba(212,175,55,0.7)` (skia.ca `.skia-back-btn` parity) |
| `letter-spacing` | `0.08em` (was `0.1em`) |
| `line-height` | `1` |
| `padding` | `8px 14px` |
| Computed size | **80×33px** — matches skia.ca back button exactly (Playwright `@ 1280×900`) |
| `button.back-btn` | Do **not** use `font: inherit` — it pulls body `line-height: 1.6` and `letter-spacing: 0.01em`, oversizing the control. Set explicit inherits + `line-height: 1` only. |

Viewport-fixed placement unchanged: desktop `top:1rem left:48px z-index:150`; mobile `top:calc(52px + safe-area) left:1rem`. DOM inside `.wrap` per `scripts/migrate-forge-back-btn.mjs`.

#### Card grids — desktop three-column

| Class | Desktop (≥769px) | ≤768px |
|-------|------------------|--------|
| `.skia-forge-hub__doc-grid`, `.doc-grid`, `.card-grid` | `repeat(3, minmax(0, 1fr))` | `repeat(auto-fill, minmax(240px, 1fr))` / `minmax(220px, 1fr)` (unchanged) |
| `.triage-grid` | Fixed **2 columns** (contact page — intentional) | Same |
| `.pkg-grid` | `repeat(auto-fill, minmax(200px, 1fr))` — renders 3 at desktop; left flexible (long pricing copy) | Same |
| `.controls-grid`, `.scope-grid` | `repeat(auto-fill, minmax(200px, 1fr))` (unchanged) | Same |

| Item | Brand standard | Forge Web |
|------|----------------|-----------|
| Shell layout | §6.1 inline on `<main>` | §6.1 inline on `.wrap` ✔ |
| Hub DOM | `.skia-forge-hub__*` | `.skia-forge-hub__*` ✔ |
| Content max-width | 800px | inline `max-width:800px` ✔ |
| Shell padding | `padding-top:0.75rem`; horizontal/bottom unchanged (`40px`) | inline `padding: 0.75rem 40px 40px 40px` ✔ |
| Back button | Viewport-fixed + typography above | `.back-btn` in `forge-hub-design.css` ✔ |
| Hub card grids | Three columns on desktop where content fits | `.skia-forge-hub__doc-grid` / `.doc-grid` / `.card-grid` ✔ (2026-06-12) |
| Section labels on hub | `.skia-forge-hub__section-label` + `.download-web-text` — Agency FB 500, 26px (`--skia-font-section-title-size`), `#ffffff`, `letter-spacing: 0.08em` | `forge-hub-design.css` ✔ (2026-06-10) |
| Footer viewport pin | `body` flex column + `.wrap { flex: 1 }` + `footer { margin-top: auto }` | `forge-hub-design.css` ✔ (2026-06-10) — Context A pages only; `/forge/platform` (Context B) unaffected |
| Footer nav five-link row | skia.ca order + external Who is SKIA / Privacy | all 17 Context A HTML ✔ (2026-06-12) |

### 12.4 Maintenance scripts

- `node scripts/migrate-forge-shell-inline.mjs --check` — §6.1 shell inline on every `.wrap`
- `node scripts/migrate-forge-skia-hub-shell.mjs --check` — `.skia-forge-hub__*` class parity
- `npm run hub-shell:check` — Context A background, 170px hero, §6.1 shell on all public HTML
- `node scripts/apply-forge-hub-design.mjs --check` — hub HTML links core Forge CSS + viewport-fixed `.back-btn` (**note:** script `CSS_BLOCK` omits `forge-lucide-icons.css` and `forge-sidebar-locale.css` — live pages include all six §6.2 stylesheets; update script if regenerating pages)
- `npm run fonts:check` — only `"Agency FB"` / `"Centaur"` in Forge Web paths (IDE exempt)
- `npm run locales:validate` — locale key parity across 12 langs (required after footer/i18n edits)
- `node scripts/normalize-forge-colors.mjs --check` — gold token drift in `public/`, `src/`
- `node scripts/normalize-forge-font-sizes.mjs --check` — 15px floor / 38px ceiling on Forge Web
- `node scripts/fix-forge-locale-font-sizes.mjs --check` — 15px floor in locale `docs.json` HTML strings
- `node scripts/fix-forge-crest-bullets.mjs --check` — bullets use inline SKIA Crest SVG, not empty placeholders or Lucide on `.check-item`
- `node scripts/check-forge-crest-bullets.mjs` — crest CSS + no legacy gold-dot / empty bullet divs

---

## 13. CROSS-PRODUCT BRAND SYNC

Forge and skia.ca are **separate codebases** with **separate design bibles**. Brand tokens (§1–§5) and the Forge Hub shell (§6) must stay **visually consistent** so users see one SKIA family.

**Neither bible is upstream of the other.** When you change brand tokens in **either repo**, update **both bibles** and the corresponding CSS in the same maintenance window.

| Brand topic | This bible | Sibling bible (`Skia-FULL`) | Forge CSS / assets |
|-------------|------------|-----------------------------|---------------------|
| Fonts | §1 | §1 | `forge-premium-ui.css` |
| Type scale | §2 | §2 | `forge-premium-ui.css`, `forge-hub-design.css`, `forge-platform-console.css` |
| Palette + scrollbar | §3 | §3 | all `public/forge-*.css` |
| Crest bullets | §4 | §4 | `forge-crest-bullet.css`, locale HTML |
| Forge Hub shell | §6 | §14 (skia.ca hub pages) | `forge-hub-design.css`, `public/` HTML |
| Forge IDE | §7 | — (IDE not in Skia-FULL) | `skia-ide/` only |

**When creating or updating Forge pages:** follow **this file only** — do not treat Skia-FULL source as law for Forge. Use the sibling bible when syncing token changes or verifying intentional brand parity.

**When creating or updating skia.ca pages:** follow **`Skia-FULL/design_bible.md` only** — same rule in reverse.

**Related:** `.cursor/rules/FORGE_RULES.md` §11, maintenance scripts in §12.4, `guides/FORGE_COPY_AUDIT.md`.
