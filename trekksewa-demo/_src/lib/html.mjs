// Tiny HTML templating: a tagged template that escapes every interpolated value unless it
// is itself the result of html`` or wrapped in raw(). Arrays are joined; null, undefined
// and booleans render as nothing, so `${cond && html`...`}` works.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

export const raw = (s) => new Raw(String(s ?? ''));

function render(v) {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}

export function html(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += render(values[i]);
  }
  return new Raw(out);
}

/** class names from a list of strings / falsy values */
export const cx = (...parts) => parts.filter(Boolean).join(' ');

/** attribute helper: attrs({ hidden: true, 'data-x': 3 }) -> raw string */
export function attrs(obj) {
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === false || v === null || v === undefined) continue;
    out += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return raw(out);
}

/** JSON safe to embed inside a <script type="application/json"> block */
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');
export const jsonScript = (data) => raw(JSON.stringify(data).replace(/</g, '\\u003c').replace(LINE_SEPARATORS, ''));
