import { assertSupabaseConfig, supabase } from './supabase';
import { UI_TEXT } from './ui-text';

export interface EventConfig {
  eventName: string;
  description: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  address: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  tiktokUrl: string | null;
  mapsUrl: string | null;
  logo: string;
}
export interface GuestRecord {
  id: string;
  displayName: string;
  personalMessage?: string;
  theme?: 'pink' | 'mint' | 'yellow' | 'lilac' | 'gold';
}

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  eventName: UI_TEXT.defaultEvent.eventName,
  description: UI_TEXT.defaultEvent.description,
  date: UI_TEXT.defaultEvent.date,
  startTime: UI_TEXT.defaultEvent.startTime,
  endTime: UI_TEXT.defaultEvent.endTime,
  venue: UI_TEXT.defaultEvent.venue,
  address: UI_TEXT.defaultEvent.address,
  facebookUrl: UI_TEXT.defaultEvent.facebookUrl,
  instagramUrl: UI_TEXT.defaultEvent.instagramUrl,
  websiteUrl: UI_TEXT.defaultEvent.websiteUrl,
  tiktokUrl: UI_TEXT.defaultEvent.tiktokUrl,
  mapsUrl: UI_TEXT.defaultEvent.mapsUrl,
  logo: UI_TEXT.defaultEvent.logo,
};

export function eventFromRow(row: Record<string, unknown>): EventConfig {
  const val = (key: string): string | null => typeof row[key] === 'string' ? row[key] as string : null;
  return {
    eventName: val('event_name') || DEFAULT_EVENT_CONFIG.eventName,
    description: val('description') || '',
    date: val('event_date'),
    startTime: val('start_time'),
    endTime: val('end_time'),
    venue: val('venue'), address: val('address'),
    facebookUrl: val('facebook_url'), instagramUrl: val('instagram_url'),
    websiteUrl: val('website_url'), tiktokUrl: val('tiktok_url'),
    mapsUrl: val('maps_url'), logo: val('logo') || DEFAULT_EVENT_CONFIG.logo,
  };
}
export function eventToRow(c: EventConfig) {
  return {
    id: 1, event_name: c.eventName, description: c.description,
    event_date: c.date, start_time: c.startTime, end_time: c.endTime,
    venue: c.venue, address: c.address, facebook_url: c.facebookUrl,
    instagram_url: c.instagramUrl, website_url: c.websiteUrl,
    tiktok_url: c.tiktokUrl, maps_url: c.mapsUrl, logo: c.logo,
    updated_at: new Date().toISOString(),
  };
}

export function generateGuestLink(token: string, origin = window.location.origin): string {
  // Query URLs work on static hosting without rewrite rules.
  return `${origin}/?guest=${encodeURIComponent(token)}`;
}

export async function loadInvitation(): Promise<{ guest: GuestRecord; event: EventConfig }> {
  assertSupabaseConfig();
  const params = new URLSearchParams(window.location.search);
  const shortCode = window.location.pathname.match(/^\/i\/([a-f0-9]{12})\/?$/i)?.[1] ?? null;
  const token = params.get('guest');
  if (!shortCode && !token) throw new Error(UI_TEXT.errors.noLinkCode);
  if (shortCode) {
    const [guestResponse, eventResponse] = await Promise.all([
      supabase.rpc('get_invitation_short', { p_code: shortCode }),
      supabase.rpc('get_public_event'),
    ]);
    if (guestResponse.error) throw new Error(`Không thể đọc thiệp: ${guestResponse.error.message}`);
    if (eventResponse.error) throw new Error(`Không thể đọc sự kiện: ${eventResponse.error.message}`);
    const found = Array.isArray(guestResponse.data) ? guestResponse.data[0] : null;
    if (!found || !found.display_name) throw new Error(UI_TEXT.errors.notFoundOrExpired);
    const eventRow = Array.isArray(eventResponse.data) ? eventResponse.data[0] : null;
    return {
      guest: {
        id: shortCode, displayName: String(found.display_name),
        personalMessage: typeof found.personal_message === 'string' ? found.personal_message : undefined,
        theme: found.theme,
      },
      event: eventRow ? eventFromRow(eventRow as Record<string, unknown>) : DEFAULT_EVENT_CONFIG,
    };
  }
  // Development preview can use the exact test token as usual, but there is no
  // silent fallback to a different person's invitation.
  if (!token) throw new Error(UI_TEXT.errors.noLinkCode);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error(UI_TEXT.errors.invalidFormat);
  }
  const [guestResponse, eventResponse] = await Promise.all([
    supabase.rpc('get_invitation', { p_token: token }),
    supabase.rpc('get_public_event'),
  ]);
  if (guestResponse.error) throw new Error(`Không thể đọc thiệp: ${guestResponse.error.message}`);
  if (eventResponse.error) throw new Error(`Không thể đọc sự kiện: ${eventResponse.error.message}`);
  const found = Array.isArray(guestResponse.data) ? guestResponse.data[0] : null;
  if (!found || !found.display_name) throw new Error(UI_TEXT.errors.notFoundOrExpired);
  const eventRow = Array.isArray(eventResponse.data) ? eventResponse.data[0] : null;
  const event = eventRow ? eventFromRow(eventRow as Record<string, unknown>) : DEFAULT_EVENT_CONFIG;
  return {
    guest: {
      id: token,
      displayName: String(found.display_name),
      personalMessage: typeof found.personal_message === 'string' ? found.personal_message : undefined,
      theme: found.theme,
    },
    event,
  };
}
