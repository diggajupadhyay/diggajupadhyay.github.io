/* global __BACKEND__, __CONTACT__ */
// The one place that sends anything away from the visitor's device. The site is static, so a
// request goes wherever site.config.json says: a database, TrekkSewa's WhatsApp number or its
// email address. With none of them configured nothing is sent and callers get
// { mode: 'preview' } back.
//
// Supported today: Supabase (PostgREST). Only the public "anon" key is used here; what it may
// do is decided entirely by the row-level-security policies in backend/supabase-schema.sql
// (insert an application; read published partners; nothing else).

const cfg = typeof __BACKEND__ === 'object' && __BACKEND__ ? __BACKEND__ : { provider: 'none' };

export const backendReady = cfg.provider === 'supabase' && Boolean(cfg.supabaseUrl) && Boolean(cfg.supabaseAnonKey);

function headers(extra = {}) {
  return { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json', ...extra };
}
const endpoint = (path) => `${cfg.supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`;

// ------------------------------------------------------------------ where a request goes

const contact = typeof __CONTACT__ === 'object' && __CONTACT__ ? __CONTACT__ : {};

/**
 * Where a trekker's request for help with a plan goes. In order: the database when one is
 * configured, else TrekkSewa's WhatsApp number, else its email address, else nowhere yet
 * ({ kind: '' }), in which case the page offers to share the plan with someone of the
 * trekker's own choosing instead.
 */
export function requestChannel() {
  if (backendReady) return { kind: 'database' };
  const digits = String(contact.whatsapp || '').replace(/\D/g, '');
  if (digits.length >= 8) return { kind: 'whatsapp', to: digits };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email || '')) return { kind: 'email', to: contact.email };
  return { kind: '' };
}

/**
 * Send a partner application: to the database when one is configured, else through
 * TrekkSewa's WhatsApp number or email address with the application written out as `text`.
 * Returns { ok: true, via } | { ok: false, mode: 'preview' } | { ok: false, mode: 'error', message }.
 */
export async function submitApplication(application, text = '') {
  const channel = requestChannel();
  if (channel.kind === 'whatsapp') {
    window.open(`https://wa.me/${channel.to}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    return { ok: true, via: 'whatsapp' };
  }
  if (channel.kind === 'email') {
    location.href = `mailto:${channel.to}?subject=${encodeURIComponent('TrekkSewa partner application')}&body=${encodeURIComponent(text)}`;
    return { ok: true, via: 'email' };
  }
  if (channel.kind !== 'database') return { ok: false, mode: 'preview' };
  try {
    const res = await fetch(endpoint('partner_applications'), {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(application),
    });
    if (res.ok) return { ok: true, via: 'database' };
    let message = `The server answered ${res.status}.`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch {
      /* no JSON body */
    }
    return { ok: false, mode: 'error', message };
  } catch {
    return { ok: false, mode: 'error', message: 'No connection. Your answers are saved on this device; try again when you have signal.' };
  }
}

/** Published partner profiles. Returns [] when there is no backend or nothing is published. */
export async function listPartners({ role, region, limit = 60 } = {}) {
  if (!backendReady) return [];
  const params = new URLSearchParams({ select: '*', order: 'featured.desc,name.asc', limit: String(limit) });
  if (role) params.set('role', `eq.${role}`);
  if (region) params.set('regions', `cs.{${region}}`);
  try {
    const res = await fetch(`${endpoint('partners_public')}?${params}`, { headers: headers() });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------ requests from trekkers

const requestText = (r) =>
  [
    'Request from TrekkSewa',
    `Name: ${r.name}`,
    r.email ? `Email: ${r.email}` : '',
    r.whatsapp ? `WhatsApp/phone: ${r.whatsapp}` : '',
    r.country ? `Travelling from: ${r.country}` : '',
    r.wants.length ? `Please arrange: ${r.wants.join(', ')}` : '',
    r.message ? `Note: ${r.message}` : '',
    '',
    r.plan_text,
  ]
    .filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n');

/**
 * Send a request for help with a trek plan.
 * Returns { ok: true, via: 'database' | 'whatsapp' | 'email' } | { ok: false, mode, message }.
 */
export async function submitTripRequest(request) {
  const channel = requestChannel();
  if (channel.kind === 'database') {
    try {
      const res = await fetch(endpoint('trip_requests'), { method: 'POST', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(request) });
      if (res.ok) return { ok: true, via: 'database' };
      return { ok: false, mode: 'error', message: `The server answered ${res.status}. Please try again in a moment.` };
    } catch {
      return { ok: false, mode: 'error', message: 'No connection. Please try again when you have signal.' };
    }
  }
  if (channel.kind === 'whatsapp') {
    window.open(`https://wa.me/${channel.to}?text=${encodeURIComponent(requestText(request))}`, '_blank', 'noopener');
    return { ok: true, via: 'whatsapp' };
  }
  if (channel.kind === 'email') {
    location.href = `mailto:${channel.to}?subject=${encodeURIComponent(`Trek request: ${request.trek_name}, ${request.start_date}`)}&body=${encodeURIComponent(requestText(request))}`;
    return { ok: true, via: 'email' };
  }
  return { ok: false, mode: 'preview', message: 'Requests are not switched on yet.' };
}
