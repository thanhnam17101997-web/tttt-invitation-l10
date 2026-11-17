# Paste this into Antigravity

You are implementing a NEW completely independent web project: **TÌNH TÍNH TING TING — Interactive Invitation**. This repository includes a prepared brief and original assets. Do not touch, import, inspect or modify any Godot / stage-engine / capture-system project. This directory is the only work scope.

FIRST: read carefully, in this order:
1. `README.md`
2. `MASTER_SPEC.md`
3. `INTERACTION_SPEC.md`
4. `ASSET_MANIFEST.md`
5. `ACCEPTANCE_TESTS.md`
6. `references/approved-3-screen-direction.png`, then `references/storyboard-8-step.png`
7. actual assets under `assets/`.

Visual objective is CRITICAL: the bubbly shiny candy 2.5D objects and giant rounded puffy living letters in the 3-screen reference. Do NOT deliver plain flat circles or a stock bold font with a CSS shadow and describe it as gummy. Keep the supplied white official logo. Don't infer factual event dates/links from the reference artwork: those were illustrative placeholders.

Plan a Vite + TypeScript / Canvas 2D + semantic HTML/CSS implementation. Prioritize responsiveness and mobile touch compatibility. Invitation is a website with 9:16 *composition* only, not an Instagram Story integration. A recipient should be able to play for about 8–10s, see letters assemble into `Hi, [ASCII name]!`, then press **MỞ LỜI MỜI** to bring up a real event popup. Crucially show **Xem lời mời** shortcut from the beginning; no puzzle. Popup close resumes play; separate replay. Personal links `/i/<id>` must resolve guest records on the selected static host. Configured global event details and social links should be editable, with no fabricated content.

**IMPORTANT EXECUTION PLAN: DO MILESTONE 1 ONLY FIRST.**
- Implement a standalone running render proof: one glossy soft pink blob + one inflated gummy `L`, visible together on a phone-sized screen, with tap/drag/release, springiness, bounded collisions, and a magnetic-return button.
- Start/build it; validate with available tooling (and browser if accessible).
- Report precisely the files changed, how to open the proof on a phone, limitations, and what decisions need approval.
- **STOP. Ask for explicit review/approval before M2.** Do not start the rest of the invitation or manager in this first pass.

Later, only after approval, implement M2 and M3 as specified. Avoid heavy frameworks/backend/3D engine and minimize iteration cost. Keep this repo isolated. Preserve original assets. No hardcoded fictitious event details or URLs. If fidelity requires a material compromise, show the limitation rather than pretending exact image reproduction.
