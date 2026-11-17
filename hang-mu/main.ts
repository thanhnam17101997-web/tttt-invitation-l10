import { supabase } from '../src/supabase';
import { DEFAULT_EVENT_CONFIG, eventFromRow, eventToRow, generateGuestLink, type EventConfig } from '../src/data';
import { UI_TEXT } from '../src/ui-text';

type Theme = 'pink' | 'mint' | 'yellow' | 'lilac' | 'gold';
type Guest = { id: string; invite_token: string; short_code: string; display_name: string; personal_message: string | null; theme: Theme };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const gate = $<HTMLElement>('authGate');
const loginForm = $<HTMLFormElement>('loginForm');
const loginError = $<HTMLElement>('loginError');

let guests: Guest[] = [];
let eventConfig: EventConfig = { ...DEFAULT_EVENT_CONFIG };
let adminReady = false;

function showError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  window.alert(`Có lỗi: ${msg}`);
}

function field(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | null;
  return el ? el.value.trim() : '';
}

function setField(id: string, val: string | null | undefined): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = val || '';
}

function fillEvent() {
  setField('inputEventName', eventConfig.eventName);
  setField('inputEventDesc', eventConfig.description);
  setField('inputDate', eventConfig.date);
  setField('inputStartTime', eventConfig.startTime);
  setField('inputEndTime', eventConfig.endTime);
  setField('inputVenue', eventConfig.venue);
  setField('inputAddress', eventConfig.address);
  setField('inputFb', eventConfig.facebookUrl);
  setField('inputIg', eventConfig.instagramUrl);
  setField('inputWeb', eventConfig.websiteUrl);
  setField('inputTiktok', eventConfig.tiktokUrl);
  setField('inputMaps', eventConfig.mapsUrl);
}

function addTextCell(row: HTMLTableRowElement, text: string) {
  const td = row.insertCell();
  td.textContent = text;
  return td;
}

function actionButton(label: string, action: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-sm btn-secondary';
  btn.textContent = label;
  btn.addEventListener('click', action);
  return btn;
}

function renderGuests() {
  const table = document.getElementById('guestTableBody');
  if (!table) return;
  table.replaceChildren();

  const countBadge = document.getElementById('guestCountBadge');
  if (countBadge) countBadge.textContent = `${guests.length} khách`;

  for (const guest of guests) {
    const tr = document.createElement('tr');
    addTextCell(tr, guest.display_name);
    const tokenTd = addTextCell(tr, guest.invite_token.slice(0, 8) + '…');
    tokenTd.title = guest.invite_token;
    addTextCell(tr, guest.personal_message || '—');
    addTextCell(tr, guest.theme);
    const link = guest.short_code
      ? `${window.location.origin}/i/${guest.short_code}`
      : generateGuestLink(guest.invite_token);
    const linkCell = tr.insertCell();
    const linkText = document.createElement('span');
    linkText.className = 'link-display';
    linkText.textContent = link;
    linkCell.append(linkText, actionButton('Copy', () => {
      void navigator.clipboard.writeText(link).then(() => window.alert(UI_TEXT.admin.copiedLinkAlert)).catch(showError);
    }));
    const actions = tr.insertCell();
    const open = document.createElement('a');
    open.href = link;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.className = 'btn btn-sm btn-primary';
    open.textContent = 'Xem';
    actions.append(open, actionButton('Sửa', () => { void editGuest(guest).catch(showError); }), actionButton('Xóa', () => { void deleteGuest(guest).catch(showError); }));
    table.append(tr);
  }
}

async function reloadData() {
  const [eventResult, guestResult] = await Promise.all([
    supabase.from('event_config').select('*').eq('id', 1).single(),
    supabase.from('guests').select('id,invite_token,short_code,display_name,personal_message,theme').order('created_at', { ascending: false }),
  ]);
  if (eventResult.error) throw eventResult.error;
  if (guestResult.error) throw guestResult.error;
  eventConfig = eventFromRow(eventResult.data as Record<string, unknown>);
  guests = (guestResult.data || []) as Guest[];
  fillEvent();
  renderGuests();
}

function bindAdminEvents(): void {
  const btnLogout = document.getElementById('btnLogout');
  btnLogout?.addEventListener('click', () => {
    void supabase.auth.signOut().then(() => {
      unmountAdminUI();
      gate.style.display = 'flex';
      adminReady = false;
    });
  });

  const formEvent = document.getElementById('formEvent') as HTMLFormElement | null;
  formEvent?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!adminReady) return;
    const n = (id: string) => field(id) || null;
    const next: EventConfig = {
      ...eventConfig,
      eventName: field('inputEventName') || DEFAULT_EVENT_CONFIG.eventName,
      description: field('inputEventDesc'),
      date: n('inputDate'), startTime: n('inputStartTime'), endTime: n('inputEndTime'),
      venue: n('inputVenue'), address: n('inputAddress'),
      facebookUrl: n('inputFb'), instagramUrl: n('inputIg'), websiteUrl: n('inputWeb'),
      tiktokUrl: n('inputTiktok'), mapsUrl: n('inputMaps'),
    };
    void (async () => {
      const { error } = await supabase.from('event_config').upsert(eventToRow(next));
      if (error) throw error;
      eventConfig = next;
      window.alert(UI_TEXT.admin.savedEventAlert);
    })().catch(showError);
  });

  const inputGuestName = document.getElementById('inputGuestName') as HTMLInputElement | null;
  inputGuestName?.addEventListener('input', () => {
    const name = field('inputGuestName');
    setField('inputGuestId', name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  });

  const formAddGuest = document.getElementById('formAddGuest') as HTMLFormElement | null;
  formAddGuest?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = field('inputGuestName');
    if (!name) return;
    const theme = field('selectTheme') as Theme;
    void (async () => {
      const { error } = await supabase.from('guests').insert({
        display_name: name, personal_message: field('inputGuestMsg') || null, theme,
      });
      if (error) throw error;
      formAddGuest.reset();
      await reloadData();
      window.alert(UI_TEXT.admin.addedGuestAlert);
    })().catch(showError);
  });

  const btnExportJson = document.getElementById('btnExportJson');
  btnExportJson?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ event: eventConfig, guests }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tttt-backup.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const btnImportJson = document.getElementById('btnImportJson');
  btnImportJson?.addEventListener('click', () => {
    window.alert(UI_TEXT.admin.importDisabledAlert);
  });

  const btnResetDefault = document.getElementById('btnResetDefault') as HTMLButtonElement | null;
  if (btnResetDefault) btnResetDefault.disabled = true;
}

function mountAdminUI(): void {
  if (document.getElementById('adminApp')) return;

  const template = document.getElementById('adminAppTemplate') as HTMLTemplateElement | null;
  if (!template) return;

  document.body.appendChild(template.content.cloneNode(true));
  bindAdminEvents();
}

function unmountAdminUI(): void {
  const app = document.getElementById('adminApp');
  if (app) app.remove();
  const importer = document.getElementById('fileImporter');
  if (importer) importer.remove();
  adminReady = false;
}

async function enterAdmin() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    unmountAdminUI();
    gate.style.display = 'flex';
    return;
  }

  // RLS-protected event_config: a non-admin cannot read this record.
  const check = await supabase.from('event_config').select('id').eq('id', 1).maybeSingle();
  if (check.error || !check.data) {
    await supabase.auth.signOut();
    unmountAdminUI();
    gate.style.display = 'flex';
    loginError.textContent = UI_TEXT.adminSecurity.unauthorized;
    return;
  }

  mountAdminUI();
  await reloadData();
  gate.style.display = 'none';
  adminReady = true;
}

// Security Layer 2: Escalating Brute-force Defense
const LOCKOUT_KEY = 'hangmu_lockout_until';
const STRIKE_KEY = 'hangmu_strike_count';

function getLockoutRemaining(): number {
  const until = Number(localStorage.getItem(LOCKOUT_KEY) || 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function recordFailedAttempt(): void {
  const strikes = Number(localStorage.getItem(STRIKE_KEY) || 0) + 1;
  localStorage.setItem(STRIKE_KEY, String(strikes));

  if (strikes >= 5) {
    // Escalate: redirect persistent attacker straight to honeypot!
    localStorage.removeItem(LOCKOUT_KEY);
    localStorage.removeItem(STRIKE_KEY);
    window.location.href = '/admin';
    return;
  }

  if (strikes === 3) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + 60000));
    loginError.textContent = UI_TEXT.adminSecurity.lockout60s;
  } else if (strikes === 4) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + 300000));
    loginError.textContent = UI_TEXT.adminSecurity.lockout5m;
  } else {
    loginError.textContent = UI_TEXT.adminSecurity.invalidCredentials(3 - strikes);
  }
}

function clearLockout(): void {
  localStorage.removeItem(STRIKE_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const remaining = getLockoutRemaining();
  if (remaining > 0) {
    loginError.textContent = UI_TEXT.adminSecurity.lockoutRemaining(remaining);
    return;
  }

  loginError.textContent = UI_TEXT.adminSecurity.loggingIn;
  const { error } = await supabase.auth.signInWithPassword({
    email: field('loginEmail'), password: field('loginPassword'),
  });
  if (error) {
    recordFailedAttempt();
    return;
  }
  try {
    await enterAdmin();
    clearLockout();
    loginError.textContent = '';
  } catch {
    recordFailedAttempt();
  }
});

async function editGuest(g: Guest) {
  const name = window.prompt('Tên khách', g.display_name);
  if (name === null) return;
  if (!name.trim()) { window.alert(UI_TEXT.admin.nameRequiredAlert); return; }
  const message = window.prompt('Lời nhắn riêng', g.personal_message || '');
  if (message === null) return;
  const { error } = await supabase.from('guests').update({
    display_name: name.trim(), personal_message: message.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', g.id);
  if (error) throw error;
  await reloadData();
}

async function deleteGuest(g: Guest) {
  if (!window.confirm(UI_TEXT.admin.deleteConfirm(g.display_name))) return;
  const { error } = await supabase.from('guests').delete().eq('id', g.id);
  if (error) throw error;
  await reloadData();
}

// Initial session check
const initialLockout = getLockoutRemaining();
if (initialLockout > 0) {
  loginError.textContent = UI_TEXT.adminSecurity.lockoutRemaining(initialLockout);
}

void enterAdmin().catch((err) => {
  unmountAdminUI();
  gate.style.display = 'flex';
  loginError.textContent = err instanceof Error ? err.message : String(err);
});
