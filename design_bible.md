# SKIA FORGE DESIGN BIBLE — ROOT AUTHORITY

**Version 3.2 (Forge profile) — 2026-05-31**

Canonical product rules live in **`Skia-FULL/design_bible.md` v3.2**. This file is the Forge operational (Context B) profile for hub, IDE, and control-plane surfaces.

This document is the authoritative Forge-only design system.
All Forge surfaces must comply.

### Context A (Forge marketing pages)

Public download/resource pages (`/platform-downloads`, `/resources`, etc.) use warm Context A shell **`#080400`** and Tier 1 doc cards per Skia-FULL design bible §3.

---

## 1. TYPOGRAPHY

### Brand Fonts
- Heading/UI font: **Agency FB**
- Body font: **Centaur**

### Allowed Weights
- Agency FB: **400**, **500**
- Centaur: **400 only**
- **500 is the maximum permitted weight**
- **600+ is forbidden**
- **700+ bold is forbidden**

### Usage Rules
- Use Agency FB for navigation, panel titles, card titles, labels, and buttons.
- Use Centaur for body copy, descriptions, helper text, and long-form text.
- Default text weight is 400 unless a stronger hierarchy is needed; use 500 only for Agency FB.
- Use monospace fonts only for code/editor/terminal surfaces.

### Canonical Font Loading

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

---

## 2. GOLD SYSTEM (THE ONLY GOLD VALUES ALLOWED)

| Name | Value | Usage |
|------|-------|-------|
| Gold Full | `#d4af37` | Active nav indicator, active nav text, key accents, critical title accents |
| Gold Text | `rgba(212,175,55,0.7)` | Inactive nav text, card labels, button text, secondary accent text |
| Gold Hover | `rgba(212,175,55,0.85)` | Hover state for gold text and interactive controls |
| Gold Border | `rgba(212,175,55,0.2)` | Default card borders, input borders, panel dividers |
| Gold Subtle | `rgba(212,175,55,0.08)` | Active-item background tints, selected states, subtle overlays |

Rules:
- Do not use any gold brighter than `#d4af37`.
- Use these five values only for gold styling.

---

## 3. CONTEXT B BACKGROUND SYSTEM

Forge is a cold operational UI system.

| Token | Value | Purpose |
|------|-------|---------|
| `--forge-bg` | `#0a0a0a` | Primary application background |
| `--forge-sidebar` | `#0d0d0a` | Sidebar shell |
| `--forge-panel-bg` | `#111111` | Primary panel/card surfaces |
| `--forge-elevated-bg` | `#1a1a1a` | Elevated controls and secondary surface accents only |

Rules:
- Default page/application shell background is `#0a0a0a`.
- Persistent tool surfaces must stay in the cold palette.
- No warm gradients in operational shells.

---

## 4. TIER 3 COLD CARDS

Tier 3 is the canonical Forge card system.

| Element | Value |
|---------|-------|
| Background | `#111111` |
| Border | `rgba(212,175,55,0.2)` |
| Border hover/focus | `rgba(212,175,55,0.45)` |
| Text primary | `#ffffff` |
| Text muted | `rgba(255,255,255,0.65)` |

Rules:
- Use Tier 3 for settings cards, auth cards, generator panels, and utility cards.
- Keep card corners and shadows minimal and consistent.
- Use Gold Border and Gold Hover for state changes.

---

## 5. PANELS AND LAYOUT RULES

### Application Shell
- Three-zone desktop layout is canonical where applicable:
  - Left sidebar
  - Center work/editor surface
  - Right chat/assistant or utility panel
- Panels must use cold backgrounds and gold-border delineation.

### Panel Hierarchy
- App shell background: `#0a0a0a`
- Panel background: `#111111`
- Deep utility surfaces (terminal/editor host) may use darker black variants.

### Text in Panels
- Panel headings: Agency FB 400/500
- Panel body/supporting text: Centaur 400 (or UI-specific monospace for code output)

---

## 6. MONACO EDITOR RULES

- Monaco editor surface is part of Forge operational UI and uses cold background treatment.
- Code font stack must be monospace (for example Consolas / JetBrains Mono / Cascadia Mono).
- Editor chrome (tabs, borders, host containers) must use Forge gold-border and cold-surface tokens.
- Do not force Agency FB or Centaur as Monaco code font.
- Keep editor readability first; brand fonts apply to surrounding UI, not code glyphs.

---

## 7. TERMINAL RULES

- Terminal host uses deep cold background (`#050500` or equivalent dark neutral within Forge cold range).
- Terminal toolbar uses cold variant with gold-border separators.
- Terminal text uses monospace only.
- Terminal tabs and controls must use Gold Border / Gold Subtle / Gold Full for state.
- Destructive terminal actions may use semantic danger color.

---

## 8. SIDEBAR / NAV RULES

- Sidebar background must remain in cold palette (canonical: `#0d0d0a`).
- Navigation text uses Agency FB.
- Inactive nav text: Gold Text.
- Active nav text and active indicator stripe: Gold Full.
- Hover nav state: Gold Hover.
- Sidebar sections separated with Gold Border.

---

## 9. BUTTON RULES

- Button labels use Agency FB.
- Button text defaults to Gold Text.
- Primary active/confirmed state uses Gold Full.
- Hover state uses Gold Hover.
- Button backgrounds use cold surfaces with optional Gold Subtle tint for active state.
- Borders use Gold Border by default.
- Maintain uppercase/letter-spaced control style where existing Forge UI patterns require it.

---

## 10. ICONOGRAPHY RULES

- Stroke icons are the default.
- Icon color for standard controls is Gold Full or Gold Text based on state.
- Hover icon state may use Gold Hover.
- No emoji in core UI.
- No decorative non-system icon sets that break Forge visual consistency.

---

## 11. SPACING SYSTEM

| Value | Usage |
|-------|-------|
| 8px | Tight gaps, icon spacing, compact control clusters |
| 12px | Compact inner padding |
| 16px | Standard inner padding and horizontal rhythm |
| 24px | Standard section spacing |
| 36px | Large section spacing |
| 48px | Major block separation |

Rules:
- Use this spacing scale only.
- Do not introduce ad-hoc spacing values outside this set unless explicitly approved.

---

## 12. SCROLLBAR (CANONICAL)

This is the canonical Forge scrollbar.

- Width/height: 6px to 8px depending on surface density
- Track: `#0a0a0a` (or equivalent cold track)
- Thumb: `rgba(212,175,55,0.7)`
- Thumb hover: `rgba(212,175,55,0.85)`
- Rounded corners required
- Firefox uses thin scrollbar with gold thumb on dark track

Canonical CSS:

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb {
  background: rgba(212,175,55,0.7);
  border-radius: 8px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(212,175,55,0.85);
}
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(212,175,55,0.7) #0a0a0a;
}
```

---

## 13. SEMANTIC COLORS

| Value | Role |
|-------|------|
| `#4ade80` | Success, healthy state, completion |
| `#ff5c5c` | Error, destructive state, failure |
| `#f2c94c` | Warning, cautionary state |

Rules:
- Semantic colors are functional, not decorative.
- Do not replace Forge gold identity accents with semantic colors.

---

## 14. FORBIDDEN RULES (FORGE-SPECIFIC)

- No font weights above 500.
- No bold 700+ text.
- No brand fonts outside Agency FB and Centaur for standard UI text.
- No warm gradients on Forge operational shells.
- No non-cold page backgrounds for core Forge app surfaces.
- No non-Tier-3 card system for Forge operational cards.
- No unapproved gold values (no bright yellow/amber replacements).
- No filled icon sets as default control iconography.
- No emoji in product UI controls/navigation.
- No spacing values outside the Forge spacing scale.
- No platform-default grey/blue scrollbars on styled surfaces.
- No arbitrary component palettes that bypass Forge tokens.

---

## 15. MANDATORY RULES (FORGE-SPECIFIC)

- All Forge UI typography must use Agency FB and Centaur, with monospace reserved for code/terminal content.
- All gold accents must use the five-value Forge gold system.
- All core app shells must use Context B cold backgrounds.
- All operational cards and panels must use Tier 3 cold styling.
- Monaco editor surfaces must keep monospace readability and Forge chrome styling.
- Terminal surfaces must remain cold, monospace, and token-consistent.
- Sidebar and navigation states must use Gold Text / Gold Hover / Gold Full hierarchy.
- Buttons must use Forge button color-state rules and border tokens.
- Spacing must conform to the 8/12/16/24/36/48 scale.
- Scrollbars must use the canonical Forge scrollbar system.
- Semantic colors must be used only for functional status states.
