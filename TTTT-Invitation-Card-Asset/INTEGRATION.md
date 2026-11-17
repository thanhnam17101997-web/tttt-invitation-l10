# Blank Organic Invitation Card — Integration

This is an editable vector/background asset, NOT an invitation screenshot. It contains no logo, text, dates, buttons, or social links.

Files:
- organic-card-blank.svg — primary transparent SVG background (800 x 1300 viewBox)
- organic-card-blank.png — raster backup (800 x 1300)
- preview.png — visual preview only; do not use as background in app

Recommended integration:
1. Copy the SVG to public/assets/invitation/organic-card-blank.svg.
2. Present a modal container with max-height: calc(100dvh - safe-area margins) and a readable HTML card body. The background artwork must never contain user-specific text.
3. Keep the background aspect ratio around 800:1300; prefer scaling uniformly, not stretching the shape to fill arbitrary text heights.
4. Place all real content in an HTML layer centered over the card, with approximately 12–15% horizontal interior padding. Reserve generous top/bottom clearances; test short mobile viewports.
5. For long content, scroll the interior HTML or the card container rather than compress typography or distort the SVG. Social links and close controls must remain tappable.
6. Preserve existing invitation state when modal closes. Do not make a new modal with generic borders and hard rectangular background.
7. Add the official user-supplied logo separately at runtime, not in the background.
8. Render Facebook/Instagram/Website as functional HTML anchors using configured URLs only.
9. Do not invent event dates, times or locations.

Acceptance: all dynamic guest names, Vietnamese accents in event copy, event details and social URLs must be editable without editing/regenerating this asset.
