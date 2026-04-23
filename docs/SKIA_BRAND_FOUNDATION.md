SKIA Brand Foundation
Canonical Identity • Visual System • Runtime Context • Cross‑Client Consistency

This document is the single source of truth for SKIA’s brand identity, visual system, architectural posture, and cross‑surface behavior. All UI, styling, components, flows, and interactions across web, desktop, and mobile must align with this foundation.

1. SKIA Identity
SKIA is a sovereign intelligence system — intentional, minimal, precise, and grounded in real backend behavior.
She is not playful, animated, or ornamental.
Her presence is defined by discipline, clarity, and authority.

Tone:

Calm

Direct

Intelligent

Evidence‑based

No fluff, no theatrics

Philosophy:

SKIA does not guess — she knows.

SKIA does not glow — she stands still.

SKIA does not decorate — she defines.

SKIA is sovereign, not whimsical.

2. Runtime & System Context
SKIA is a multi‑client platform with a single canonical backend runtime:

Backend system of record: src/server.ts

Clients:

Web (Next.js)

Mobile (Expo)

Desktop (Electron shell)

All clients depend on backend contracts.
Frontend API handlers proxy backend truth — they do not define it.

Active systems include:

Auth

Session

Billing & credit tiers

Moderation

Voice/TTS microservice

Operator/security modules

Scaffold systems must be labeled as such to prevent architecture drift.

3. Visual Identity System
SKIA’s visual identity is sovereign minimalism — dark, gold, disciplined, and intentional.

Color Palette
Purpose	Color
Primary background	#0a0a0a
Sidebar background	#0d0d0a
Panel/Card background	#120d00 – #1a1100
Gold accent	#d4af37
Border color	#2a1f00
Input background	#0f0d00


Typography
Uppercase

Letter‑spacing: 0.1em

Clean, minimal, no decorative fonts

Gold for primary text, muted gold for secondary text

Logo
SKIA wordmark

Crown emblem

Gold #d4af37

Used in: sidebar header, chat header, onboarding, system chrome

UI Behavior
No glow

No pulse

No animations

No gradients

No rounded corners (0–2px max)

Borders are thin, gold, intentional

SKIA’s UI is still, sovereign, and deliberate.

4. Cross‑Client Consistency
All SKIA surfaces must reflect the same identity:

Web
Primary reference implementation

Uses shared design system components

Dashboard/workspace patterns

Gold hierarchy and sovereign spacing rules

Mobile
Mirrors backend contracts

Adapts layout to native patterns

Maintains SKIA’s dark/gold sovereign palette

Desktop
Electron shell hosting the web experience

Must visually match the web client exactly

5. Chat Experience Specification
SKIA’s chat interface is a core brand surface.

SKIA Message Bubble
Background: #120d00

Left border: 3px solid #d4af37

Prefix: SKIA crown icon

Text: gold

User Message
Background: #1a1100

Right‑aligned

Text: muted gold

Input Area
Background: #0f0d00

Border: transparent → gold on focus

Placeholder: Ask SKIA anything...

Send Button
Gold

Uppercase

Border: 1px solid #d4af37

Top Bar
SKIA logo

+ NEW CHAT button (uppercase, gold)

Bottom Tagline
One ecosystem. One universe. All SKIA.  
Muted gold, small, centered.

6. Navigation System
Sidebar navigation uses uppercase spaced typography:

EXPLORER

SEARCH

AGENT

FORGE

SETTINGS

States:

Default: muted gold

Hover: bright gold

Active: bright gold + left border or highlight

Icons:

Minimal

Thin-line

Gold

7. Component Rules
Buttons
Background: #1a1100

Border: 1px solid #d4af37

Text: uppercase gold

Border-radius: 0–2px

No shadows

Cards / Panels
Background: #120d00

Border: 1px solid #2a1f00

No rounded corners

Scrollbars
Dark track

Gold thumb

Minimal width

8. Onboarding Experience
Centered sovereign panel:

Background: #0a0a0a

SKIA logo at top

Gold text

Gold-bordered button

Opening message:
I am SKIA. I see your codebase. Let me understand your architecture.

Button:
OPEN A PROJECT

9. Architectural Guidance
Backend is the source of truth

Frontend adapts, does not redefine

Mobile and desktop are clients, not authorities

Claims of autonomy must reflect real code paths

Scaffold modules must be labeled non‑production

All documentation and UI must reflect current-state reality, not future-state aspirations.

10. Brand Enforcement Rules
Cursor must enforce:

No deviation from the sovereign palette

No animations

No rounded corners beyond 2px

No gradients

No playful or whimsical elements

No glow or neon

No soft UI

No shadows

SKIA is sovereign, minimal, intentional, and disciplined.

End of SKIA Brand Foundation
This file supersedes all previous brand descriptions and consolidates SKIA’s identity into one authoritative reference.