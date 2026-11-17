# ACCEPTANCE_TESTS — checklist for real implementation

## M1: Render proof (approval gate)
- [ ] App starts locally in new standalone repo, no Godot dependency, no build errors.
- [ ] At least one glossy pink blob with organic edges, soft gradient and dynamic specular/highlights resembles 3-screen reference.
- [ ] Gummy letter `L` looks made of same material, not plain text with a cheap drop shadow.
- [ ] Blob and letter respond to tap/drag/release with spring, momentum and bounded motion.
- [ ] Letter can magnetically move to a target on button press with overshoot/settling.
- [ ] Can run in a mobile browser (actual iPhone Safari/Android Chrome when available); no mandatory WebGL permission.
- [ ] STOP and request review before M2.

## M2: Full public invitation
- [ ] Visual 9:16 composition follows approved reference while adapting to 320px wide/short/tall screens.
- [ ] Official supplied logo is used (not recreated text).
- [ ] “Ê, chạm thử đi!” clearly encourages touch.
- [ ] “Xem lời mời” shortcut exists from first frame and opens invitation immediately.
- [ ] Play is enjoyable approximately 8–10 seconds with active gestures; no hard puzzle or forced wait.
- [ ] Name letters emerge, can be moved/flicked, then assemble visibly and correctly into `Hi, Linh!`.
- [ ] Second test with `Minh Anh` (space) and a longer ASCII name: correct spacing, sizing and wrapping.
- [ ] Name reveal does not yank a currently dragged glyph from finger.
- [ ] Large button **MỞ LỜI MỜI** appears *below assembled name*; popup NOT automatic.
- [ ] Popup contains title/logo, actual configured date/time/place, description, working real Facebook/Instagram/Website links; absence shows no dummy URLs.
- [ ] Closing popup returns to the still-interactive name scene; reopen without resetting; replay is separate.
- [ ] Every meaningful gesture gives prompt visual feedback; controls not covered by Canvas.
- [ ] Body Vietnamese accents render properly (e.g., `Bạn được mời đến`, `Địa điểm`, `Hà Nội`).
- [ ] Link target/keyboard/focus, accessible names, close via Escape; good tap target sizes.
- [ ] Reduced-motion variant and non-Canvas fallback still provide invitation information and links.
- [ ] Stop and request M2 approval before admin M3.

## M3: Personalization manager/deployment
- [ ] Working unique guest IDs with reloadable/deep-linkable URLs on chosen static host.
- [ ] One event config controls details/URLs across guests; guests only customize name, message, optional theme.
- [ ] Local tool can add/edit/remove entries, validate names, preview, export stable guest JSON + link list. No claim of private online dashboard without backend.
- [ ] Guest data does not contain sensitive secrets; docs explain static JSON is publicly readable and updates require redeploy.
- [ ] Missing/unknown guest ID has friendly fallback and invitation remains accessible.
- [ ] Build and deploy instructions work, including route fallback if needed.
- [ ] No API keys/secrets in client bundle.
- [ ] Real-device test recommended: Safari iOS and Chrome Android; where unavailable, state test limitations honestly.

## Visual review criteria
- [ ] Puffy letter contours and rendering like jelly/balloons; baseline font shouldn't read as regular bold sans.
- [ ] Cream pop-up, coin, smiley blobs and bright streak details look cohesive with reference.
- [ ] Motion does not compromise legibility or social link interaction.
- [ ] Brand illustration assets remain unchanged; no direct copied fictional event date/time from generated image.
