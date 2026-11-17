import { loadInvitation, GuestRecord, EventConfig } from './data';
import { waitForStageAssets, finishBoot, failBoot } from './boot-screen';
import { LivingCharacter } from './characters';
import { GummyGlyph, buildNameLayout } from './typography';
import { InvitationModal } from './invitation-modal';
import { ParticleSystem } from './particles';
import { MochiStageRenderer } from './mochi-renderer';
import { vec, dist } from './physics';
import { UI_TEXT, applyUiText } from './ui-text';

// Apply centralized UI copy immediately to DOM elements
applyUiText();

// DOM Elements
const canvas = document.getElementById('stageCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: true })!;
const mochiCanvas = document.getElementById('mochiCanvas') as HTMLCanvasElement;
const container = document.getElementById('stageContainer') as HTMLElement;

const touchHintEl = document.getElementById('touchHint');
const ctaContainerEl = document.getElementById('ctaContainer');
const shortcutContainerEl = document.getElementById('shortcutContainer');
const btnOpenInvite = document.getElementById('btnOpenInvite');
const btnShortcut = document.getElementById('btnShortcut');
const btnPlayMore = document.getElementById('btnPlayMore');
const btnReplay = document.getElementById('btnReplay');

// State Machine Definition
export type InvitationState = 'BOOT' | 'PLAY' | 'LETTERS_EMERGING' | 'MAGNET_REVEAL' | 'NAME_READY';

let currentState: InvitationState = 'BOOT';
let currentGuest: GuestRecord;
let currentEvent: EventConfig;
let modal: InvitationModal;

// Viewport state
let logicalWidth = 0;
let logicalHeight = 0;
let dpr = 1;
let isInitialized = false;

// Physics objects
let characters: LivingCharacter[] = [];
let glyphs: GummyGlyph[] = [];
const particles = new ParticleSystem();
const mochiRenderer = new MochiStageRenderer(mochiCanvas);

// Interactive pointer tracking
let activePointerId: number | null = null;
let activeDragObject: LivingCharacter | GummyGlyph | null = null;
let pointerDownPos = { x: 0, y: 0 };
let pointerDownTime = 0;

// Pacing & Activity Tracking
const EXPLORE_DURATION_MS = 15_000;
const LETTER_START_MS = 4_000;

let exploreStartedAt: number | null = null;
let revealStartedAt = 0;

// Frame time & fixed physics accumulator
const FIXED_DT = 1 / 60;
let accumulator = 0;
let lastFrameTime = 0;
let metricWindowStarted = 0;
let metricFrames = 0;
let metricRenderMs = 0;

/**
 * Measure container dimensions safely (guards against 0-dimension Safari startup)
 */
function updateDimensions(): boolean {
  const rect = container.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  if (w < 80 || h < 80) return false;

  const prevW = logicalWidth;
  const prevH = logicalHeight;

  logicalWidth = w;
  logicalHeight = h;
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mochiRenderer.resize(logicalWidth, logicalHeight, dpr);

  // Update object proportions proportionally on resize
  if (isInitialized && (prevW !== logicalWidth || prevH !== logicalHeight)) {
    characters.forEach((c) => c.updateProportions(logicalWidth, logicalHeight));
    // Recalculate name target positions
    recalculateNameLayout();
  }

  return true;
}

function recalculateNameLayout() {
  const layout = buildNameLayout(
    currentGuest.displayName,
    logicalWidth * 0.5,
    logicalHeight * 0.38,
    logicalWidth * 0.88
  );

  // Update targets of existing glyphs
  if (glyphs.length === layout.glyphs.length) {
    for (let i = 0; i < glyphs.length; i++) {
      glyphs[i].setTarget(layout.glyphs[i].targetX, layout.glyphs[i].targetY, layout.glyphs[i].scale);
    }
  }
}

/**
 * Setup Characters & Glyphs
 */
function setupSceneObjects() {
  // 5 Living Colorful Gummy Characters (Pink dome, Yellow star, Mint bean, Lilac flower, Gold coin)
  characters = [
    new LivingCharacter('pink_dome', 0.23, 0.34, Math.min(logicalWidth * 0.20, 78)),
    new LivingCharacter('yellow_star', 0.77, 0.32, Math.min(logicalWidth * 0.18, 70)),
    new LivingCharacter('mint_bean', 0.22, 0.76, Math.min(logicalWidth * 0.18, 68)),
    new LivingCharacter('lilac_flower', 0.52, 0.82, Math.min(logicalWidth * 0.19, 72)),
    new LivingCharacter('gold_coin', 0.80, 0.74, Math.min(logicalWidth * 0.17, 64)),
  ];

  characters.forEach((c) => c.updateProportions(logicalWidth, logicalHeight));

  // Build Name Glyphs for personalized greeting
  const layout = buildNameLayout(
    currentGuest.displayName,
    logicalWidth * 0.5,
    logicalHeight * 0.38,
    logicalWidth * 0.88
  );

  glyphs = layout.glyphs;
}

/**
 * Robust stage initialization
 */
async function initApp() {
  try {
    // Start database and font loading simultaneously. Nothing is rendered
    // until BOTH finish, so Canvas never measures a fallback font.
    const [loaded] = await Promise.race([
      Promise.all([loadInvitation(), waitForStageAssets()]),
      new Promise<never>((_, reject) => window.setTimeout(
        () => reject(new Error(UI_TEXT.errors.timeout)), 20000)),
    ]);
    currentGuest = loaded.guest;
    currentEvent = loaded.event;

    // Avoid a zero-sized canvas during initial Safari visualViewport setup.
    for (let attempts = 0; !updateDimensions() && attempts < 60; attempts++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    if (logicalWidth < 80 || logicalHeight < 80) {
      throw new Error(UI_TEXT.errors.viewportUnavailable);
    }

    modal = new InvitationModal();
    setupSceneObjects();
    isInitialized = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      transitionTo('NAME_READY');
    } else {
      transitionTo('PLAY');
    }

    setupUIEvents();
    setupInput();
    if (new URLSearchParams(window.location.search).get('modal') === '1' || window.location.hash.includes('modal')) {
      window.setTimeout(() => modal.open(currentEvent, currentGuest), 100);
    }

    render(performance.now());
    void finishBoot();
    lastFrameTime = performance.now();
    requestAnimationFrame(loop);

    // Recalculate if Safari loads/updates fonts after bootstrap.
    document.fonts.addEventListener('loadingdone', () => {
      if (isInitialized) recalculateNameLayout();
    });
  } catch (error) {
    failBoot(error instanceof Error ? error.message : UI_TEXT.errors.genericLoadFailed);
  }
}


function transitionTo(newState: InvitationState) {
  if (currentState === newState) return;

  currentState = newState;

  if (newState === 'PLAY') {
    exploreStartedAt = null;
    revealStartedAt = 0;

    if (touchHintEl) touchHintEl.style.display = 'flex';
    if (ctaContainerEl) ctaContainerEl.style.display = 'none';
    if (shortcutContainerEl) shortcutContainerEl.style.display = 'flex';

    glyphs.forEach((g) => {
      g.isEmerging = false;
      g.emergeProgress = 0;
      g.isMagnetizing = false;
      g.hasSnapped = false;
      g.cancelEmergence();
    });

  } else if (newState === 'LETTERS_EMERGING') {
    if (touchHintEl) touchHintEl.style.display = 'none';

    glyphs.forEach((g, index) => {
      window.setTimeout(() => {
        if (currentState !== 'LETTERS_EMERGING') return;

        // Each letter grows out of one of the five moving gummy bodies.
        const host = characters[index % characters.length];
        if (!host) return;
        // Each letter begins as a bud on an upper shoulder.
        // Alternate sides so repeated letters don't all grow from one spot.
        const angle = -Math.PI / 2 + (index % 3 - 1) * 0.43;
        g.beginFromBlob(host, angle);
      }, index * 140);
    });

  } else if (newState === 'MAGNET_REVEAL') {
    revealStartedAt = performance.now();

    if (touchHintEl) touchHintEl.style.display = 'none';
    if (shortcutContainerEl) shortcutContainerEl.style.display = 'none';

    // All letters participate, including those
    // which have not emerged during exploration.
    glyphs.forEach((g) => {
      g.isEmerging = true;
      g.emergeProgress = 1;
      g.triggerSnap();
    });

  } else if (newState === 'NAME_READY') {
    if (touchHintEl) touchHintEl.style.display = 'none';
    if (ctaContainerEl) ctaContainerEl.style.display = 'flex';
    if (shortcutContainerEl) shortcutContainerEl.style.display = 'none';

    glyphs.forEach((g) => {
      g.cancelEmergence();
      g.isEmerging = true;
      g.emergeProgress = 1;
      g.isMagnetizing = false;
      g.hasSnapped = true;
      g.x = g.targetX;
      g.y = g.targetY;
      g.vx = 0;
      g.vy = 0;
      g.rotation = 0;
    });
  }
}


function setupUIEvents() {
  // Open Invitation Popup CTA
  btnOpenInvite?.addEventListener('click', () => {
    modal.open(currentEvent, currentGuest);
  });

  // Always-accessible shortcut "Xem lời mời"
  btnShortcut?.addEventListener('click', () => {
  if (
    currentState === 'PLAY' ||
    currentState === 'LETTERS_EMERGING'
  ) {
    transitionTo('MAGNET_REVEAL');
  }
});

  // Keep playing without resetting
  btnPlayMore?.addEventListener('click', () => {
    glyphs.forEach((g) => {
      g.tap();
      particles.burst(vec(g.x, g.y), 6, [40, 120]);
    });
  });

  // Replay sequence from beginning
  btnReplay?.addEventListener('click', () => {
    setupSceneObjects();
    transitionTo('PLAY');
  });
}

function getCanvasPos(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return vec(e.clientX - rect.left, e.clientY - rect.top);
}

function setupInput() {
  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (!isInitialized) return;
    const p = getCanvasPos(e);
    pointerDownPos = { ...p };
    pointerDownTime = performance.now();

if (currentState === 'PLAY' && exploreStartedAt === null) {
  exploreStartedAt = pointerDownTime;
}

    // Hit test: Glyphs first (top priority)
    for (let i = glyphs.length - 1; i >= 0; i--) {
      const g = glyphs[i];
      if (g.isEmerging && !g.isAttached && g.contains(p)) {
        activePointerId = e.pointerId;
        activeDragObject = g;
        g.startDrag(p);
        canvas.setPointerCapture(e.pointerId);
        particles.burst(p, 6, [40, 110], ['spark']);
        return;
      }
    }

    // Hit test: Characters
    for (let i = characters.length - 1; i >= 0; i--) {
      const c = characters[i];
      if (c.contains(p)) {
        activePointerId = e.pointerId;
        activeDragObject = c;
        c.startDrag(p);
        canvas.setPointerCapture(e.pointerId);
        particles.burst(p, 6, [40, 110], ['spark']);
        return;
      }
    }

    // Ambient spark on empty space
    particles.burst(p, 6, [40, 120], ['spark', 'circle']);
  });

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (activeDragObject && e.pointerId === activePointerId) {
      const p = getCanvasPos(e);
      activeDragObject.drag(p, FIXED_DT);
    }
  });

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const p = getCanvasPos(e);
    const elapsed = performance.now() - pointerDownTime;
    const dragDistance = dist(p, pointerDownPos);

    if (activeDragObject) {
      if (dragDistance < 12 && elapsed < 320) {
        activeDragObject.tap();
        particles.burst(p, 10, [60, 180], ['spark', 'pill']);
      }
      activeDragObject.endDrag();
      if (activeDragObject instanceof LivingCharacter) {
        mochiRenderer.requestContourRefresh(activeDragObject);
      }
    }

    activePointerId = null;
    activeDragObject = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
}

// Collision response between blobs and free-floating letters.
// During magnetic reveal, the letters keep their scripted targets;
// characters yield instead of pushing the greeting out of place.
function resolveCollisions(dt: number) {
  const revealing =
    currentState === 'MAGNET_REVEAL' ||
    currentState === 'NAME_READY';

  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const a = characters[i];
      const b = characters[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);

      if (distance < 0.001) {
        dx = 1;
        dy = 0;
        distance = 1;
      }

      const overlap = a.radius + b.radius - distance;
      if (overlap <= 0) continue;

      const nx = dx / distance;
      const ny = dy / distance;
      const moveA = !a.isDragging;
      const moveB = !b.isDragging;

      if (moveA) {
        const share = moveB ? 0.5 : 1;
        a.x -= nx * overlap * share;
        a.y -= ny * overlap * share;
      }
      if (moveB) {
        const share = moveA ? 0.5 : 1;
        b.x += nx * overlap * share;
        b.y += ny * overlap * share;
      }

      const closingSpeed =
        (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closingSpeed < 0) {
        const impulse = -closingSpeed * 0.3;
        if (moveA) {
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
        }
        if (moveB) {
          b.vx += nx * impulse;
          b.vy += ny * impulse;
        }
      }
      a.applyImpact(-nx, -ny, overlap, Math.max(0, -closingSpeed));
      b.applyImpact(nx, ny, overlap, Math.max(0, -closingSpeed));
    }
  }

  for (const c of characters) {
    for (const g of glyphs) {
      if (!g.isEmerging || g.isAttached) continue;

      let dx = g.x - c.x;
      let dy = g.y - c.y;
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        dx = 1;
        dy = 0;
        distance = 1;
      }

      const overlap = c.radius + g.width * 0.55 - distance;
      if (overlap <= 0) continue;

      const nx = dx / distance;
      const ny = dy / distance;

      if (revealing || g.isMagnetizing) {
        if (!c.isDragging) {
          c.x -= nx * overlap;
          c.y -= ny * overlap;
          c.applyImpact(-nx, -ny, overlap);
        }
      } else {
        if (!c.isDragging) {
          c.x -= nx * overlap * 0.5;
          c.y -= ny * overlap * 0.5;
        }
        if (!g.isDragging) {
          g.x += nx * overlap * 0.5;
          g.y += ny * overlap * 0.5;
          g.vx += nx * overlap * 2 * dt;
          g.vy += ny * overlap * 2 * dt;
        }
      }
    }
  }
}

// Reserve an area for the assembled two-line greeting.
function keepNameAreaClear(dt: number) {
  if (
    currentState !== 'MAGNET_REVEAL' &&
    currentState !== 'NAME_READY'
  ) return;
  if (glyphs.length === 0) return;

  const left = Math.min(
    ...glyphs.map((g) => g.targetX - g.width / 2)
  ) - 20;
  const right = Math.max(
    ...glyphs.map((g) => g.targetX + g.width / 2)
  ) + 20;
  const top = Math.min(
    ...glyphs.map((g) => g.targetY - g.height / 2)
  ) - 12;
  const bottom = Math.max(
    ...glyphs.map((g) => g.targetY + g.height / 2)
  ) + 12;

  for (const c of characters) {
    if (c.isDragging) continue;

    const x1 = left - c.radius;
    const x2 = right + c.radius;
    const y1 = top - c.radius;
    const y2 = bottom + c.radius;
    if (c.x <= x1 || c.x >= x2 || c.y <= y1 || c.y >= y2) {
      continue;
    }

    const exits = [
      { distance: c.x - x1, dx: x1 - c.x, dy: 0 },
      { distance: x2 - c.x, dx: x2 - c.x, dy: 0 },
      { distance: c.y - y1, dx: 0, dy: y1 - c.y },
      { distance: y2 - c.y, dx: 0, dy: y2 - c.y },
    ];
    exits.sort((a, b) => a.distance - b.distance);

    const exit = exits[0];
    const distance = Math.hypot(exit.dx, exit.dy);
    if (distance < 0.001) continue;

    const nx = exit.dx / distance;
    const ny = exit.dy / distance;
    const step = Math.min(distance, 110 * dt);
    c.x += nx * step;
    c.y += ny * step;

    const normalVelocity = c.vx * nx + c.vy * ny;
    if (normalVelocity < 0) {
      c.vx -= nx * normalVelocity;
      c.vy -= ny * normalVelocity;
    }
    const damping = Math.exp(-8 * dt);
    c.vx *= damping;
    c.vy *= damping;
  }
}

function updatePhysics(dt: number, time: number) {
  const bounds = {
    left: 20,
    top: 90,
    right: logicalWidth - 20,
    bottom: logicalHeight - 90,
  };

  // Update Characters
  characters.forEach((c) => c.update(dt, bounds, logicalWidth, logicalHeight, time));

  // Update Glyphs
  glyphs.forEach((g) => g.update(dt, bounds, time));

  // Shared collision response and protected greeting area
  resolveCollisions(dt);
  keepNameAreaClear(dt);

  // Particles
  particles.update(dt);

  // Check state machine progression
if (
  currentState === 'PLAY' ||
  currentState === 'LETTERS_EMERGING'
) {
  if (exploreStartedAt !== null) {
    const elapsed = performance.now() - exploreStartedAt;

    if (elapsed >= EXPLORE_DURATION_MS) {
      transitionTo('MAGNET_REVEAL');
    } else if (
      currentState === 'PLAY' &&
      elapsed >= LETTER_START_MS
    ) {
      transitionTo('LETTERS_EMERGING');
    }
  }

} else if (currentState === 'MAGNET_REVEAL') {
  const revealElapsed = performance.now() - revealStartedAt;

  // At most 2 seconds to hand over an active drag.
  if (activeDragObject && revealElapsed >= 2000) {
    activeDragObject.endDrag();
    activeDragObject = null;
    activePointerId = null;
  }

  // Do not finish while any glyph is still being dragged.
  const allSnapped = glyphs.every((g) => g.hasSnapped);

  if (allSnapped && !activeDragObject) {
    transitionTo('NAME_READY');
  }
}

}


function drawBackground() {
  // The stage environment is now the visible DOM layer below transparent
  // WebGL/Canvas overlays, rather than an opaque Canvas fill that hides it.
}

function render(time: number) {
  ctx.save();
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  drawBackground();
  if (mochiRenderer.enabled) {
    mochiRenderer.sync(characters, glyphs, time);
    mochiRenderer.render();
    // A character remains on the proven Canvas fallback for the few frames
    // before its Poisson map is ready; no blank/floating face during boot.
    characters.forEach((c) => {
      if (mochiRenderer.hasBlob(c)) c.drawFaceOnly(ctx);
      else c.draw(ctx, time);
    });
  } else {
    // Legacy Canvas renderer is the unsupported-WebGL fallback only.
    characters.forEach((c) => c.draw(ctx, time));
    glyphs.forEach((g) => { if (g.isEmerging) g.draw(ctx); });
  }

  // Draw particles
  particles.draw(ctx);

  ctx.restore();
}

/**
 * Main animation loop with fixed-step accumulator
 */
function loop(now: number) {
  if (!isInitialized) return;

  let frameTime = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  frameTime = Math.min(frameTime, 0.033);
  accumulator += frameTime;

  while (accumulator >= FIXED_DT) {
    updatePhysics(FIXED_DT, now);
    accumulator -= FIXED_DT;
  }

  const renderStarted = performance.now();
  render(now);
  metricFrames++;
  metricRenderMs += performance.now() - renderStarted;
  if (!metricWindowStarted) metricWindowStarted = now;
  if (now - metricWindowStarted >= 1000) {
    mochiCanvas.dataset.l10Fps = String(Math.round(metricFrames * 1000 / (now - metricWindowStarted)));
    mochiCanvas.dataset.l10RenderMs = (metricRenderMs / metricFrames).toFixed(2);
    mochiCanvas.dataset.l10MapMs = mochiRenderer.getLastMapMs().toFixed(2);
    metricWindowStarted = now;
    metricFrames = 0;
    metricRenderMs = 0;
  }
  requestAnimationFrame(loop);
}

// Window resize handler with debounce
let resizeTimer: number | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    updateDimensions();
  }, 60);
});

window.visualViewport?.addEventListener('resize', () => {
  if (isInitialized) updateDimensions();
});

// Tab visibility handler
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    accumulator = 0;
  } else {
    lastFrameTime = performance.now();
    accumulator = 0;
  }
});


// Launch
void initApp();

