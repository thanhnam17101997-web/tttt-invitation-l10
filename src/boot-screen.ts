import { UI_TEXT } from './ui-text';

/** Stage bootstrap: never reveal an incomplete font/layout first frame. */
const bootEl = document.getElementById('bootScreen');
const bootErrorEl = document.getElementById('bootError');
const bootStartedAt = performance.now();
const MINIMUM_BOOT_MS = 1500;

// Dev troll interaction
const retryBtn = document.getElementById('bootRetry') as HTMLButtonElement | null;
const trollModal = document.getElementById('trollModal');
const trollVideo = document.getElementById('trollVideo') as HTMLVideoElement | null;
const trollCloseBtn = document.getElementById('trollCloseBtn');

retryBtn?.addEventListener('click', () => {
  if (!retryBtn || retryBtn.disabled) return;

  retryBtn.disabled = true;
  retryBtn.textContent = UI_TEXT.troll.scanningText;

  window.setTimeout(() => {
    retryBtn.textContent = UI_TEXT.troll.bypassingText;
  }, 600);

  window.setTimeout(() => {
    retryBtn.textContent = UI_TEXT.troll.exploitFoundText;
  }, 1300);

  window.setTimeout(() => {
    retryBtn.disabled = false;
    retryBtn.textContent = UI_TEXT.troll.retryAgainButton;

    if (trollModal && trollVideo) {
      trollModal.style.display = 'flex';
      trollModal.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => trollModal.classList.add('is-visible'));
      trollVideo.currentTime = 0;
      void trollVideo.play().catch(() => { });
    }
  }, 2000);
});

trollCloseBtn?.addEventListener('click', () => {
  if (trollModal) {
    trollModal.classList.remove('is-visible');
    trollModal.setAttribute('aria-hidden', 'true');
    if (trollVideo) {
      trollVideo.pause();
      trollVideo.currentTime = 0;
    }
    window.setTimeout(() => {
      trollModal.style.display = 'none';
    }, 300);
  }
});

export async function waitForStageAssets(): Promise<void> {
  // Font weights used by Canvas measureText() and HTML. A font CDN outage is
  // not a reason to trap a visitor in loading: established fallbacks work.
  const fonts = Promise.all([
    document.fonts.load('700 76px "DynaPuff Hero", "Be Vietnam Pro"', 'Hi, KANG GIANG!'),
    document.fonts.load('600 18px "Be Vietnam Pro"', 'TÌNH TÍNH TING TING'),
  ]);
  await Promise.race([
    fonts,
    new Promise<void>((resolve) => window.setTimeout(resolve, 3500)),
  ]);
  // Give Safari a paint + resize opportunity after fonts and viewport settle.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export async function finishBoot(): Promise<void> {
  // Readiness remains the gate. The dwell only applies after a fresh visit and
  // does not participate in the interaction timeline, which starts on touch.
  const remaining = Math.max(0, MINIMUM_BOOT_MS - (performance.now() - bootStartedAt));
  if (remaining) await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
  document.body.classList.add('stage-boot-complete');
  // Wait for one complete scene frame before the 350ms opacity exit.
  requestAnimationFrame(() => bootEl?.classList.add('is-done'));
}

export function failBoot(message: string): void {
  if (bootErrorEl) bootErrorEl.textContent = message;
  bootEl?.classList.add('is-error');

  // Friendly console warning for curious devs opening F12
  console.log(
    `%c${UI_TEXT.troll.consoleAlertTag} %c${UI_TEXT.troll.consoleAlertMessage}`,
    'color: #ff3366; font-size: 15px; font-weight: bold;',
    'color: #ffe0ad; font-size: 13px; font-weight: bold;'
  );
}
