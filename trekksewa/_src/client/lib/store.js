// Everything the visitor saves stays in this browser (localStorage). Nothing is sent anywhere.

const PREFIX = 'ts-';

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('ts:store', { detail: { key } }));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    window.dispatchEvent(new CustomEvent('ts:store', { detail: { key } }));
  } catch {
    /* storage unavailable */
  }
}

// ---- saved treks
export const savedTreks = () => get('saved', []);
export const isSaved = (slug) => savedTreks().includes(slug);
export function toggleSaved(slug) {
  const list = savedTreks();
  const i = list.indexOf(slug);
  if (i >= 0) list.splice(i, 1);
  else list.unshift(slug);
  set('saved', list);
  return i < 0;
}
