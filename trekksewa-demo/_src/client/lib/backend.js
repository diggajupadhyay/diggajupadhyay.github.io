/* global __BACKEND__ */
// The one place that talks to a server. The site is static, so until a backend is configured
// in site.config.json nothing is sent anywhere and callers get { mode: 'preview' } back.
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

/**
 * Send a partner application.
 * Returns { ok: true } | { ok: false, mode: 'preview' } | { ok: false, mode: 'error', message }.
 */
export async function submitApplication(application) {
  if (!backendReady) return { ok: false, mode: 'preview' };
  try {
    const res = await fetch(endpoint('partner_applications'), {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(application),
    });
    if (res.ok) return { ok: true };
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
