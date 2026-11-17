# INTERACTION_SPEC — Play / Name Reveal / Invitation

## State machine
```
BOOT -> PLAY -> LETTERS_EMERGING -> MAGNET_REVEAL -> NAME_READY
   \______________________________________________ (Open invitation at any time)
            Any visual state -> INVITE_MODAL -> previous background state
NAME_READY -> REPLAY -> PLAY
```
The invitation modal can be opened directly from the first frame via **“Xem lời mời”**. Never block invitation content behind physics performance or timed progression.

## Timeline / trigger design
- `t=0`: loaded, blobs visible and gently moving, touch prompt + small invitation shortcut.
- Target **8–10 seconds of engagement** before auto-triggering name assembly. Count actual play activity; avoid starting a strict 8-second idle countdown. Use mild cumulative dwell plus gestures (taps/drag/flick); do not require exact gestures or collection.
- A short inactive user should receive a gentle hint, not a fail state. Long idle should still allow instant skip. No unpleasant or forced reveal mid-touch.
- Letters emerge progressively during early/mid play from squishy blobs; never show complete assembled name too early. Some can be flung or touched.
- When eligible for reveal, wait until active pointer drag ends, then magnetize all letters. If a guest uses the shortcut, open modal directly.
- Magnetic snap/overshoot and particle burst should last about 1.5–2.5 seconds, then `NAME_READY` with a large **MỞ LỜI MỜI** CTA below name.
- Click CTA -> popup opens. Close -> return to previous visual state with no automatic restart; playing again is optional via a separate control.
- `NAME_READY` background still has subtle active blobs and limited reactions to touch (do not obscure CTA).

## Gestures
- TAP: compression/squash/return ~250–450ms, small particles.
- DRAG: pointer capture, follow pointer with slight lag and stretch along travel vector, bounded to avoid exaggerated distortion; touch input must not cause page scroll while manipulating canvas.
- FLICK / RELEASE: momentum according to capped measured pointer velocity; friction settles motion. Don't throw objects irrecoverably offscreen.
- COLLISION: gentle bounce with visible squash/wobble and optional neighboring ripple; avoid obvious overlap.
- IDLE: asynchronous subtle drift and breathing, no identical looping for every object.
- LETTER: same glossy gummy material and physical semantics as blobs, with separate magnetic assembly state.
- VISIBILITY CHANGE: pause simulation when page hidden; clamp dt on resume; never teleport.
- FEEDBACK: every deliberate tap/drag gets immediate visual reaction; no loading spinner per gesture.

## Visual physics guidelines (tune by feel)
- Soft and fun, not chaotic; no screen-wide explosion from an ordinary tap.
- Stretch deformation cap target ~25%; slow spring return. Moderate damping and restitution; no heavy realistic gravity.
- 5–7 large touchable blobs with differentiated behaviors (one shy/repelled, another attracted or curious) optional; visual complexity must remain low enough to read prompt/name.
- Collisions/particles may be simplified on weak devices. Protect 30fps+ usability rather than insist on 60fps.
- Pointer input should work in iOS Safari and Chrome Android; no sensors.

## Personalized letters
- Accept guest `displayName` as ASCII Latin letters/spaces, e.g. `Linh`, `Minh Anh`, `Phuong`. Validate/trim/collapse multiple spaces; don't truncate real names silently; handle invalid/missing guest IDs with friendly generic fallback or clear unavailable state.
- Build *separate glyph objects* for characters; spaces affect final layout but are not physical glyphs.
- Ensure actual letter rendering looks **inflated/rounded/organic**, high-quality highlight/bevel and under-shadow, matching blob material. Flat font + CSS `text-shadow` alone is insufficient.
- Generate final target positions from measured width, kerning, and responsive line break (not arbitrary uniform letter slots). For magnetic reveal, transition individual objects toward those targets then blend/snap into a single polished text layer if needed to avoid spacing artifacts.
- Long names gracefully shrink/wrap within central safe bounds. `Hi, [Name]!` is the phrase; do not require Vietnamese glyph physics.
- Full Vietnamese Unicode must work for all body/metadata and invitation details.

## Popup / re-entry
- Card rises/pops into center on request with soft easing; optionally background blobs gently move out of way.
- Card contains official logo asset, personalized salutation, event title, verified global details and three **real** URL buttons if configured.
- Links are normal anchors that open safely; keyboard tab and screen reader accessible. If URL absent, hide rather than route to fake destination.
- Close button prominent, returns to visual behind card. Canvas should not intercept popup taps; modal should trap focus and restore focus on dismissal where appropriate.
- Responsive for narrow/short phones; if content exceeds height, modal itself scrolls.
- Avoid card automatically appearing immediately after name reveal.

## Motion reduction / fallback
- Prefer-reduced-motion: skip or greatly simplify physics, provide name and button immediately; event data still accessible.
- Canvas failure: render HTML invitation with real content/links.
- Slow devices: cap particles, reduce per-blob deformation samples, reduce FPS target if necessary; do not delay input feedback.
