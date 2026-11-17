import { EventConfig, GuestRecord } from './data';
import { UI_TEXT } from './ui-text';

export class InvitationModal {
  overlayEl: HTMLElement;
  cardEl: HTMLElement;
  btnCloseEl: HTMLElement;
  isOpen = false;
  onCloseCallback?: () => void;

  constructor() {
    this.overlayEl = document.getElementById('modalOverlay') as HTMLElement;
    this.cardEl = document.getElementById('modalCard') as HTMLElement;
    this.btnCloseEl = document.getElementById('modalCloseBtn') as HTMLElement;

    this.btnCloseEl?.addEventListener('click', () => {
      this.close();
    });

    this.overlayEl?.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    // Escape key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open(eventConfig: EventConfig, guest: GuestRecord, onClose?: () => void) {
    this.onCloseCallback = onClose;
    this.isOpen = true;

    // Populate data
    const guestMsgEl = document.getElementById('modalGuestMsg');
    if (guestMsgEl) {
      if (guest.personalMessage) {
        guestMsgEl.textContent = `“${guest.personalMessage}”`;
        guestMsgEl.style.display = 'block';
      } else {
        guestMsgEl.style.display = 'none';
      }
    }

    const descEl = document.getElementById('modalDescription');
    if (descEl) {
      descEl.textContent = eventConfig.description || UI_TEXT.modal.fallbackDescription;
    }

    // Date row
    const dateRow = document.getElementById('rowDate');
    const dateText = document.getElementById('textDate');
    if (dateRow && dateText) {
      if (eventConfig.date) {
        dateText.textContent = eventConfig.date;
        dateRow.style.display = 'flex';
      } else {
        dateRow.style.display = 'none';
      }
    }

    // Time row
    const timeRow = document.getElementById('rowTime');
    const timeText = document.getElementById('textTime');
    if (timeRow && timeText) {
      const timeStr = [eventConfig.startTime, eventConfig.endTime].filter(Boolean).join(' - ');
      if (timeStr) {
        timeText.textContent = timeStr;
        timeRow.style.display = 'flex';
      } else {
        timeRow.style.display = 'none';
      }
    }

    // Venue row
    const venueRow = document.getElementById('rowVenue');
    const venueText = document.getElementById('textVenue');
    if (venueRow && venueText) {
      const venueStr = [eventConfig.venue, eventConfig.address].filter(Boolean).join(', ');
      if (venueStr) {
        venueText.textContent = venueStr;
        venueRow.style.display = 'flex';
      } else {
        venueRow.style.display = 'none';
      }
    }

    // Only render verified configured links; never leave a fake # destination.
    const socialLinks: Array<[string, string | null]> = [
      ['btnSocialFb', eventConfig.facebookUrl],
      ['btnSocialIg', eventConfig.instagramUrl],
      ['btnSocialWeb', eventConfig.websiteUrl],
      ['btnSocialTiktok', eventConfig.tiktokUrl],
      ['btnSocialMaps', eventConfig.mapsUrl],
    ];
    socialLinks.forEach(([id, url]) => {
      const link = document.getElementById(id) as HTMLAnchorElement | null;
      if (!link) return;
      link.style.display = url ? 'inline-flex' : 'none';
      if (url) link.href = url;
      else link.removeAttribute('href');
    });

    // Check if any details exist
    const hasAnyDetails = !!(eventConfig.date || eventConfig.startTime || eventConfig.venue);
    const detailsContainer = document.getElementById('modalDetailsContainer');
    const dividerTop = document.getElementById('modalDividerTop');
    if (detailsContainer) {
      detailsContainer.style.display = hasAnyDetails ? 'flex' : 'none';
    }
    if (dividerTop) {
      dividerTop.style.display = hasAnyDetails ? 'block' : 'none';
    }

    // Check if any social links exist
    const hasAnySocial = socialLinks.some(([, url]) => Boolean(url));
    const socialContainer = document.getElementById('modalSocialContainer');
    const dividerBottom = document.getElementById('modalDividerBottom');
    if (socialContainer) {
      socialContainer.style.display = hasAnySocial ? 'flex' : 'none';
    }
    if (dividerBottom) {
      dividerBottom.style.display = hasAnySocial ? 'block' : 'none';
    }

    // Show modal with animation
    this.overlayEl.classList.add('visible');
    this.overlayEl.setAttribute('aria-hidden', 'false');
    this.cardEl.focus();
  }

  close() {
    this.isOpen = false;
    this.overlayEl.classList.remove('visible');
    this.overlayEl.setAttribute('aria-hidden', 'true');
    this.onCloseCallback?.();
  }
}

