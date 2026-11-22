// Partner application form: role switching, validation, draft saving and submission.

import { $, $$, h } from '../lib/dom.js';
import { url } from '../lib/site.js';
import * as store from '../lib/store.js';
import { toast, download } from '../lib/ui.js';
import { submitApplication } from '../lib/backend.js';

const form = $('[data-partner-form]');
const done = $('[data-partner-done]');
if (form) {
  const ROLE_LABEL = { guide: 'Guide', porter: 'Porter', agency: 'Agency', gear: 'Gear shop', other: 'Other service' };
  const contact = (() => {
    try {
      return JSON.parse($('#partner-config').textContent).contact || {};
    } catch {
      return {};
    }
  })();
  const errorEl = $('[data-form-error]', form);
  const opened = Date.now();
  const params = new URLSearchParams(location.search);

  // ---------- role switching: only the chosen role's fields are enabled and submitted
  function applyRole() {
    const role = form.elements.role.value;
    for (const fs of $$('.role-fields', form)) {
      const on = fs.dataset.role === role;
      fs.hidden = !on;
      fs.disabled = !on;
    }
    // gear shops and "other" services are not asked to accept the staff standards
    const pledge = $('[data-pledge]', form);
    const needs = ['guide', 'porter', 'agency'].includes(role);
    pledge.hidden = !needs;
    pledge.querySelector('input').disabled = !needs;
  }

  // ---------- draft: nothing typed is lost if the page closes or the signal drops
  const SKIP = new Set(['website_url', 'consent', 'pledge']);
  function saveDraft() {
    const data = {};
    for (const el of form.elements) {
      if (!el.name || SKIP.has(el.name) || el.disabled) continue;
      if (el.type === 'checkbox') {
        if (el.checked) (data[el.name] ||= []).push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else if (el.value) data[el.name] = el.value;
    }
    store.set('partner-draft', data);
  }
  function loadDraft() {
    const data = store.get('partner-draft');
    if (!data) return;
    for (const el of form.elements) {
      if (!el.name || !(el.name in data)) continue;
      const v = data[el.name];
      if (el.type === 'checkbox') el.checked = Array.isArray(v) && v.includes(el.value);
      else if (el.type === 'radio') el.checked = v === el.value;
      else el.value = v;
    }
  }

  loadDraft();
  const wanted = params.get('role');
  if (wanted && ROLE_LABEL[wanted]) form.elements.role.value = wanted;
  applyRole();
  form.addEventListener('change', (e) => {
    if (e.target.name === 'role') applyRole();
    saveDraft();
  });
  form.addEventListener('input', saveDraft);

  // ---------- collect
  function collect() {
    const fd = new FormData(form);
    const details = {};
    for (const [key, value] of fd.entries()) {
      if (['role', 'name', 'phone', 'email', 'district', 'consent', 'pledge', 'website_url'].includes(key)) continue;
      const v = String(value).trim();
      if (!v) continue;
      if (key in details) details[key] = [].concat(details[key], v);
      else details[key] = v;
    }
    for (const multi of ['regions', 'languages', 'agency_services', 'gear_offer', 'gear_categories']) if (multi in details) details[multi] = [].concat(details[multi]);
    if (fd.get('pledge')) details.accepted_standards = true;
    return {
      role: fd.get('role'),
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim() || null,
      district: String(fd.get('district') || '').trim() || null,
      details,
      consent: fd.get('consent') === 'yes',
      source: params.get('trek') ? `trek:${params.get('trek')}` : 'partners-page',
    };
  }

  function summaryText(app) {
    const lines = [`TrekkSewa partner application`, `Role: ${ROLE_LABEL[app.role] || app.role}`, `Name: ${app.name}`, `Phone: ${app.phone}`];
    if (app.email) lines.push(`Email: ${app.email}`);
    if (app.district) lines.push(`Home district: ${app.district}`);
    for (const [k, v] of Object.entries(app.details)) lines.push(`${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`);
    return lines.join('\n');
  }

  /** kind: 'sent' (stored), 'whatsapp' | 'email' (handed to that app to send), 'preview', 'error' */
  function showDone(kind, app, message) {
    const text = summaryText(app);
    const actions = [h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => download('trekksewa-application.txt', text) }, 'Download a copy')];
    const waLink = contact.whatsapp ? `https://wa.me/${String(contact.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : '';
    const mailLink = contact.email ? `mailto:${contact.email}?subject=${encodeURIComponent('TrekkSewa partner application')}&body=${encodeURIComponent(text)}` : '';
    if (kind !== 'sent') {
      if (waLink) actions.unshift(h('a', { class: 'btn btn-sm', href: waLink, target: '_blank', rel: 'noopener' }, kind === 'whatsapp' ? 'Open WhatsApp again' : 'Send by WhatsApp'));
      if (mailLink) actions.unshift(h('a', { class: 'btn btn-sm', href: mailLink }, kind === 'email' ? 'Open email again' : 'Send by email'));
      actions.push(h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: backToForm }, 'Back to the form'));
    }
    const after = 'We will contact you on the mobile number you gave before anything is published.';
    const copy = {
      sent: ['Application received', `Thank you. ${after}`, 'धन्यवाद। तपाईंको आवेदन प्राप्त भयो।'],
      whatsapp: ['One more step: press send in WhatsApp', `WhatsApp has opened with your application written out. Press send there and it reaches us. ${after}`, 'ह्वाट्सएपमा "पठाउनुहोस्" थिच्नुहोस्।'],
      email: ['One more step: press send in your email', `Your email program has opened with your application written out. Press send there and it reaches us. ${after}`, 'इमेलमा "पठाउनुहोस्" थिच्नुहोस्।'],
      preview: ['This is how applying will work', 'Online applications are not switched on yet, so nothing has been sent to TrekkSewa. Your answers are saved on this device and will be here when applications open.', ''],
      error: ['Your application was not sent', message || 'Something went wrong. Your answers are saved on this device; please try again.', ''],
    }[kind];
    done.className = `partner-done card card-pad done-${kind}`;
    done.replaceChildren(
      h('h2', {}, copy[0]),
      h('p', {}, copy[1]),
      copy[2] ? h('p', { lang: 'ne' }, copy[2]) : null,
      h('pre', { class: 'app-summary' }, text),
      h('div', { class: 'cluster', style: '--gap:.6rem' }, actions),
      kind === 'sent' ? h('p', { class: 'small' }, h('a', { href: url('services/') }, 'Back to services')) : null,
    );
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
    done.focus({ preventScroll: true });
  }
  function backToForm() {
    done.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    for (const el of $$('[aria-invalid]', form)) el.removeAttribute('aria-invalid');
    const invalid = [...form.elements].filter((el) => !el.disabled && el.willValidate && !el.checkValidity());
    if (invalid.length) {
      for (const el of invalid) el.setAttribute('aria-invalid', 'true');
      const first = invalid[0];
      const label = first.labels?.[0]?.textContent.replace('*', '').trim() || 'a required field';
      errorEl.textContent = invalid.length === 1 ? `Please check: ${label}.` : `Please check ${invalid.length} fields, starting with: ${label}.`;
      errorEl.hidden = false;
      first.focus();
      return;
    }
    const app = collect();
    // bots fill hidden fields and submit instantly; people do neither
    if (form.elements.website_url.value || Date.now() - opened < 4000) {
      showDone('preview', app);
      return;
    }
    const button = $('[data-submit]', form);
    button.disabled = true;
    const result = await submitApplication(app, summaryText(app));
    button.disabled = false;
    if (result.ok && result.via === 'database') {
      store.remove('partner-draft');
      showDone('sent', app);
      toast('Application sent');
    } else if (result.ok)
      showDone(result.via, app); // the draft stays until they have really pressed send
    else if (result.mode === 'preview') showDone('preview', app);
    else showDone('error', app, result.message);
  });
}
