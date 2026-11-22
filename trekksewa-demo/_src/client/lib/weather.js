// Forecasts from Open-Meteo (https://open-meteo.com, CC BY 4.0). No API key; the request
// goes straight from the visitor's browser. Results are kept for an hour, and the last
// good forecast is shown (clearly dated) when there is no connection.

import { h } from './dom.js';
import * as store from './store.js';

import sun from 'lucide-static/icons/sun.svg';
import moon from 'lucide-static/icons/moon.svg';
import cloudSun from 'lucide-static/icons/cloud-sun.svg';
import cloud from 'lucide-static/icons/cloud.svg';
import cloudFog from 'lucide-static/icons/cloud-fog.svg';
import cloudDrizzle from 'lucide-static/icons/cloud-drizzle.svg';
import cloudRain from 'lucide-static/icons/cloud-rain.svg';
import cloudSnow from 'lucide-static/icons/cloud-snow.svg';
import cloudLightning from 'lucide-static/icons/cloud-lightning.svg';
import wind from 'lucide-static/icons/wind.svg';

const ICON = { sun, moon, 'cloud-sun': cloudSun, cloud, fog: cloudFog, drizzle: cloudDrizzle, rain: cloudRain, snow: cloudSnow, storm: cloudLightning, wind };

// WMO weather interpretation codes
const WMO = {
  0: ['Clear', 'sun'],
  1: ['Mostly clear', 'sun'],
  2: ['Partly cloudy', 'cloud-sun'],
  3: ['Overcast', 'cloud'],
  45: ['Fog', 'fog'],
  48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'drizzle'],
  53: ['Drizzle', 'drizzle'],
  55: ['Heavy drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'drizzle'],
  57: ['Freezing drizzle', 'drizzle'],
  61: ['Light rain', 'rain'],
  63: ['Rain', 'rain'],
  65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'],
  67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'],
  80: ['Showers', 'rain'],
  81: ['Showers', 'rain'],
  82: ['Violent showers', 'rain'],
  85: ['Snow showers', 'snow'],
  86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'],
  96: ['Thunderstorm with hail', 'storm'],
  99: ['Thunderstorm with hail', 'storm'],
};
export const describe = (code, isDay = true) => {
  const [label, key] = WMO[code] || ['Unknown', 'cloud'];
  return { label, icon: key === 'sun' && !isDay ? 'moon' : key };
};

const TTL = 60 * 60 * 1000;

/** Fetch JSON from the forecast service, marking rate-limit refusals so the page can say so. */
async function request(params) {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.limited = res.status === 429;
    throw err;
  }
  return res.json();
}

/** What to tell the visitor when no forecast, fresh or saved, can be shown. */
export function failureText(e) {
  if (e && e.limited) return 'The forecast service is busy right now. Try again in a little while.';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'You are offline. The forecast will load when you have a connection.';
  return 'The forecast is not available right now. Try again in a little while.';
}
const keyFor = (lat, lon) => `wx:${lat.toFixed(3)},${lon.toFixed(3)}`;

export function iconEl(name, size = 24) {
  const span = h('span', { class: 'wx-icon', 'aria-hidden': 'true' });
  span.innerHTML = ICON[name] || ICON.cloud; // bundled SVG, not remote data
  const svg = span.firstElementChild;
  if (svg) {
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
  }
  return span;
}

/** Returns { data, fetchedAt, stale } or throws when there is nothing to show. */
export async function getForecast({ lat, lon, alt, days = 6 }) {
  const key = keyFor(lat, lon);
  const cached = store.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL) return { ...cached, stale: false };
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_gusts_10m_max,precipitation_probability_max,sunrise,sunset',
    timezone: 'Asia/Kathmandu',
    forecast_days: String(days),
    wind_speed_unit: 'kmh',
  });
  if (typeof alt === 'number') params.set('elevation', String(alt));
  try {
    const data = await request(params);
    if (!data.daily || !data.current) throw new Error('unexpected response');
    const entry = { data, fetchedAt: Date.now() };
    store.set(key, entry);
    return { ...entry, stale: false };
  } catch (e) {
    if (cached) return { ...cached, stale: true };
    throw e;
  }
}

/**
 * One request for many points. `points` is [{ lat, lon, alt }]. Returns
 * { list: [forecast per point], fetchedAt, stale }. Cached for an hour like single forecasts.
 */
export async function getForecasts(points, { days = 3 } = {}) {
  const key = `wxm:${points.map((p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`).join(';')}`;
  const cached = store.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL) return { ...cached, stale: false };
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
    elevation: points.map((p) => p.alt).join(','),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_gusts_10m_max',
    timezone: 'Asia/Kathmandu',
    forecast_days: String(days),
    wind_speed_unit: 'kmh',
  });
  try {
    const json = await request(params);
    const list = Array.isArray(json) ? json : [json];
    if (list.length !== points.length || !list.every((x) => x && x.daily)) throw new Error('unexpected response');
    const entry = { list, fetchedAt: Date.now() };
    store.set(key, entry);
    return { ...entry, stale: false };
  } catch (e) {
    if (cached) return { ...cached, stale: true };
    throw e;
  }
}

/** Plain-language warnings derived from one day of forecast. */
export function dayAlerts(d) {
  const out = [];
  if (d.snow >= 15) out.push({ level: 'high', text: `Heavy snow, about ${Math.round(d.snow)} cm` });
  else if (d.snow >= 5) out.push({ level: 'watch', text: `Snow, about ${Math.round(d.snow)} cm` });
  if (d.rain >= 50) out.push({ level: 'high', text: `Very heavy rain, about ${Math.round(d.rain)} mm` });
  else if (d.rain >= 20) out.push({ level: 'watch', text: `Heavy rain, about ${Math.round(d.rain)} mm` });
  if (d.gust >= 70) out.push({ level: 'high', text: `Gusts to ${Math.round(d.gust)} km/h` });
  else if (d.gust >= 50) out.push({ level: 'watch', text: `Gusts to ${Math.round(d.gust)} km/h` });
  if (d.min <= -20) out.push({ level: 'watch', text: `Very cold night, ${Math.round(d.min)} °C` });
  return out;
}

export function toDays(data) {
  const d = data.daily;
  return d.time.map((t, i) => ({
    date: t,
    code: d.weather_code[i],
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    // precipitation_sum counts melted snow too (7 cm of snow is about 10 mm of water),
    // so take the snow out to leave what actually falls as rain
    rain: Math.max(0, Math.round(((d.precipitation_sum?.[i] ?? 0) - (d.snowfall_sum?.[i] ?? 0) / 0.7) * 10) / 10),
    snow: d.snowfall_sum?.[i] ?? 0,
    gust: d.wind_gusts_10m_max?.[i] ?? 0,
    prob: d.precipitation_probability_max?.[i] ?? null,
    sunrise: d.sunrise?.[i],
    sunset: d.sunset?.[i],
  }));
}

export const deg = (v) => `${Math.round(v)}°`;
const clock = (iso) => (iso ? iso.slice(11, 16) : '');
export const dayName = (iso, i) => (i === 0 ? 'Today' : new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }));

/** Fill `el` with a current-conditions block and a daily strip. */
export async function renderWeather(el) {
  const lat = Number(el.dataset.lat);
  const lon = Number(el.dataset.lon);
  const alt = el.dataset.alt ? Number(el.dataset.alt) : undefined;
  try {
    const { data, fetchedAt, stale } = await getForecast({ lat, lon, alt });
    const cur = data.current;
    const now = describe(cur.weather_code, cur.is_day === 1);
    const days = toDays(data);
    const alerts = days.slice(0, 3).flatMap((d, i) => dayAlerts(d).map((a) => ({ ...a, text: `${dayName(d.date, i)}: ${a.text}` })));

    const head = h(
      'div',
      { class: 'wx-now' },
      iconEl(now.icon, 44),
      h('div', {}, h('p', { class: 'wx-temp' }, `${Math.round(cur.temperature_2m)} °C`), h('p', { class: 'wx-desc' }, `${now.label} · feels like ${deg(cur.apparent_temperature)}`)),
      h(
        'dl',
        { class: 'wx-facts' },
        h('div', {}, h('dt', {}, 'Wind'), h('dd', {}, `${Math.round(cur.wind_speed_10m)} km/h`)),
        h('div', {}, h('dt', {}, 'Gusts'), h('dd', {}, `${Math.round(cur.wind_gusts_10m)} km/h`)),
        h('div', {}, h('dt', {}, 'Sunrise'), h('dd', {}, clock(days[0].sunrise))),
        h('div', {}, h('dt', {}, 'Sunset'), h('dd', {}, clock(days[0].sunset))),
      ),
    );
    const strip = h(
      'ol',
      { class: 'wx-days' },
      days.map((d, i) => {
        const w = describe(d.code);
        const wet = d.snow >= 1 ? `${Math.round(d.snow)} cm snow` : d.rain >= 1 ? `${Math.round(d.rain)} mm` : 'Dry';
        return h(
          'li',
          {},
          h('span', { class: 'wx-day' }, dayName(d.date, i)),
          iconEl(w.icon, 24),
          h('span', { class: 'sr-only' }, w.label),
          h('span', { class: 'wx-range' }, h('b', {}, deg(d.max)), ' ', h('span', {}, deg(d.min))),
          h('span', { class: 'wx-wet' }, wet),
        );
      }),
    );
    const alertBox = alerts.length
      ? h(
          'ul',
          { class: 'wx-alerts' },
          alerts.map((a) => h('li', { class: `badge badge-${a.level}` }, a.text)),
        )
      : null;
    const when = new Date(fetchedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const foot = h(
      'p',
      { class: 'xsmall muted wx-foot' },
      stale ? `Offline: showing the forecast saved on ${when}. ` : `Updated ${when}. `,
      'Model forecast for this point',
      typeof alt === 'number' ? ` at ${alt.toLocaleString('en-GB')} m` : '',
      ' from ',
      h('a', { href: 'https://open-meteo.com/', rel: 'noopener', target: '_blank' }, 'Open-Meteo'),
      '. Mountain weather changes fast and differs from valley to ridge; ask locally before a pass.',
    );
    el.replaceChildren(...[head, alertBox, strip, foot].filter(Boolean));
    el.dataset.state = stale ? 'stale' : 'ok';
  } catch (e) {
    el.replaceChildren(h('p', { class: 'muted' }, failureText(e)));
    el.dataset.state = 'error';
  }
}
