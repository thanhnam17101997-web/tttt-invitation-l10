# MASTER_SPEC — TTTT Interactive Invitation V1.3

## Intent
An online invitation so tactile and lively that a friend reacts “wow, this is actually interactive.” It is a **web experience**, not a game, animated poster, slideshow or Instagram-hosted app. Single-finger interactions and fast access to the invitation are essential.

## Visual north star
`references/storyboard-8-step.png` and especially `references/approved-3-screen-direction.png` are visual targets: dark rich plum/purple background, glossy candy-gel soft blobs, chubby inflated gummy lettering, friendly exaggerated highlights, soft dimensional gradients, lively colorful confetti, playful hand-drawn punctuation. Preserve the wonderful glossy 3D look as much as possible with mobile-compatible 2.5D rendering. The uploaded brand artwork is identity/color/decorative reference, not an instruction to flatten the gummy art direction.

- Brand logo: `assets/brand/logo-white.png`, **use actual image** (not imagined text or reconstruction).
- Palette derived visually, initial not spectrophotometric exact: purple background `#1A0B35` (or richer plum), pink `#FF346D`, gold `#FFC15A`, aqua `#58D7D4`, violet `#8270D9`, cream `#FFE8C5`, with pastel glows/highlights.
- Main animated objects **look genuinely rounded and inflated**. Plain CSS text, stock bold fonts with one drop shadow, or flat geometric circles are not acceptable as the final look.
- Name letters should look like the blobs themselves, with dimensional shape/highlights and elastic motion.
- Official handwritten logo appears top area during play/reveal, on invitation card as appropriate.
- For event copy/buttons use a readable Vietnamese-capable UI typeface; display physics letters use a fat Latin face or shaped contours with custom candy shading. Typeface is an implementation choice to verify, not a finalized selection; don't download/share font binaries unless licensing permits use in project.
- The 3-screen reference has **fictional event date/time**. Never extract those details into production.

## User-facing flow
1. **Play state**: colorful floating blobs are alive on load. A clear invitation to touch (“Ê, chạm thử đi!”). The official logo. Always-visible nonintrusive **“Xem lời mời”** shortcut.
2. **8–10 seconds active play target**: tap/drag/flick blobs, bouncy collisions and squish. Letters of the recipient's ASCII display name gradually materialize as playable gummy objects. No puzzles, no precision targets, no counter visible. 8–10 seconds is a pacing target, not forced blocking; see INTERACTION_SPEC.
3. **Personal reveal**: natural pause, scattered letters magnetically collect into **“Hi, [Name]!”**, overshoot softly into aligned position, confetti burst. Allow short settle time (~2 seconds).
4. **Ready state**: a prominent **“MỞ LỜI MỜI”** button appears **under the name**. The invitation does **not** pop open automatically; remains waiting for user choice. Small “Nghịch tiếp” affordance can keep interaction alive.
5. **Invitation popup/modal**: cream/pink softly shaped card with official logo, personalized greeting if specified, event description in Vietnamese, confirmed date/time/place and working Facebook/Instagram/Website links. Close button returns to interactive name scene **without resetting**. Re-open invitation anytime. Optional separate “Chơi lại” restarts the animation.
6. The **“Xem lời mời”** shortcut at all times immediately opens popup; never force waiting 10 seconds or completing a gesture.

## Composition/responsiveness
- Reference canvas: 1080×1920 / 9:16. Must adapt gracefully to actual screen aspect ratios and browser chrome; use dynamic viewport height (`dvh` fallback), safe-area insets and responsive layout.
- Safe center for logo, name and CTA to survive screen recordings/crops. Decorative blobs may cross the edges.
- Native touch and mouse support; Pointer Events for interactions. No mandatory device motion/gyro.
- Main buttons minimum ~44 CSS px touch targets; no links hidden by blobs. HTML UI layer above canvas with correct pointer routing.
- Text/popup readable at small 320px viewport widths. Focus/escape behavior where appropriate.
- Site must remain usable on common iOS Safari, Android Chrome and major in-app browsers; cannot literally guarantee every phone, so include graceful static fallback.
- No audio required; do not rely on autoplay sound. Reduce motion if `prefers-reduced-motion` or low performance.

## Personalization / output
- A **single web codebase**, not a different render per guest.
- Public URL `/i/<opaque-id>` resolves a guest data record. ASCII display names; stable IDs. No need for account/login for guests.
- One global event config shared across all guests; guest record holds id, displayName, optional personalMessage, optional theme. Keep data and UI separate from rendering.
- V1 **static JSON + local admin/generator tool**, not production online `/admin` backed by an unsecured public-write JSON file. Make it easy to edit/export event/guest data and regenerate/deploy. Explain updates require redeploy in the static version.
- Invite links should work on copy/paste and reload: accommodate static host SPA fallback or use hash-based routes where necessary.
- Opaque IDs reduce casual exposure in URL but **do not make guest records private** when the JSON file is public. No personal secrets/sensitive data in that file. If true private data or edit-after-send without redeploy is required, that is a V2 backend feature.
- Admin/generator can be local-only (no login necessary if not publicly hosted); if publicly shipped, it must not pretend to be private or save write changes without backend.
- Event URL fields should be blank until verified and hidden/disabled in guest UI if unavailable. Never use dummy `example.com` as a working event link.
- Recipients may voluntarily screen-record. **No Story upload/API, no native video export**, no social account integration.

## Recommended tech / architecture
- Vite + TypeScript; HTML/CSS accessible UI; Canvas 2D for particles and interactive shapes/letters. Explore geometry/deformation or lightweight precomputed bevel shading rather than heavy WebGL dependency.
- Fixed-step or delta-clamped physics and requestAnimationFrame with pause/resume on tab visibility. Rendering/physics decoupled from UI state.
- 5–7 blob objects, variable masses/inertias/spring deformation. Dynamic quality downgrade and reduced-motion fallback.
- Type rendering: font contour/outline-based gummy lettering preferred over crude shadowed HTML text. Names ASCII only; retain glyph spacing when magnetically assembling. If contour rendering cannot satisfy glossy quality within performance budget, document actual tradeoff and propose a fallback with visual comparison; do not claim pixel-identical.
- Modal HTML accessible, buttons/links semantic, keyboard reachable.
- Use packaged files; no outside dependency on user's other projects.

## Milestones and stop points
**M1: Rendering Proof** — one glossy squishy pink blob, one glossy gummy letter `L`, same material language. Both respond to tap, drag/flick, soft collision/bounce; button to magnetically return the letter to a target. Open in browser and test on phone. **STOP and request visual/interaction approval before M2.**

**M2: Public invitation** — complete interaction state machine, chosen name generated from sample JSON, meaningful reveal, modal, social links, skip behavior, responsiveness, optimized fallback. **STOP and request approval before M3.**

**M3: Static personalization + delivery** — local guest/event manager, import/export data, reliable guest IDs, docs, build and deployment instructions, mobile tests.

## Explicitly excluded
Godot and capture-system integration, on-device camera, motion permissions, realtime generative AI, 3D runtime requirement, complex server auth/backend, automatic DM sending, RSVP, analytics tracking, Story APIs, native video export. Keep the web invitation completely independent.
