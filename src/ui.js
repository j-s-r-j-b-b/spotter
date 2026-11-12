import { h } from 'preact';
import htm from 'htm';
export const html = htm.bind(h);

const P = {
  check: 'M5 12.5l4.2 4.2L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  users: 'M16 20v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 11a4 4 0 100-8 4 4 0 000 8zM22 20v-1a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 01-12 0zM12 17v5',
  back: 'M19 12H5M11 18l-6-6 6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  msg: 'M4 5h16v11H8l-4 4z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  user: 'M20 21v-1a5 5 0 00-5-5H9a5 5 0 00-5 5v1M12 11a4 4 0 100-8 4 4 0 000 8z',
  logout: 'M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  phone: 'M7 2h10a1 1 0 011 1v18a1 1 0 01-1 1H7a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2',
  alert: 'M12 9v4M12 17v.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  dumbbell: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
  send: 'M4 12l16-8-6 16-2-6z',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z',
  menu: 'M4 6h16M4 12h16M4 18h16',
};
export const Icon = ({ n, s = 16, w = 2, cls = '' }) => html`<svg class=${'ic ' + cls} width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[n]} /></svg>`;

export const Logo = ({ dark }) => html`<span class=${'logo' + (dark ? ' dark' : '')}><svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill=${dark ? '#D4F53C' : '#12161B'}/><path d="M8 13h3v6H8zM21 13h3v6h-3zM11 15h10v2H11z" fill=${dark ? '#12161B' : '#D4F53C'}/><rect x="5.5" y="14" width="2.5" height="4" rx="1" fill=${dark ? '#12161B' : '#D4F53C'}/><rect x="24" y="14" width="2.5" height="4" rx="1" fill=${dark ? '#12161B' : '#D4F53C'}/></svg><b>Spotter</b></span>`;

export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 2800);
}

export async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast(label, 'ok');
}

// "Ask Claude" opens the coach's OWN Claude in a new tab with the request already typed in (claude.ai/new?q=…).
// Spotter never calls an AI model itself; the coach reviews the request and presses send in Claude.
export const claudeLink = (p) => 'https://claude.ai/new?q=' + encodeURIComponent(p);
export const CLAUDE_CONNECTORS = 'https://claude.ai/new?modal=add-custom-connector#customize/connectors/yours';
export const AskClaude = ({ p, label = 'Ask Claude', solid = true }) => html`<a class=${'btn sm ' + (solid ? 'claude' : 'claude-o')} href=${claudeLink(p)} target="_blank" rel="noopener"
  title="Opens your Claude in a new tab with this request typed in"
  onClick=${() => { navigator.clipboard?.writeText(p).catch(() => {}); toast('Opening your Claude with this request — press send there', 'claude'); }}>
  <${Icon} n="spark" s=${13} w=${2.4} /> ${label} <${Icon} n="ext" s=${12} /></a>`;
export const PromptBox = ({ p, t }) => html`<div class="prompt-box">${t ? html`<span class="tiny muted">${t}</span>` : null}<p>${p}</p>
  <div class="row"><${AskClaude} p=${p} /><button class="btn sm" title="Copy" onClick=${() => copy(p, 'Prompt copied — paste it into Claude')}><${Icon} n="copy" s=${13} /> Copy</button></div></div>`;

export function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : d < 30 ? d + 'd ago' : new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
export const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDate = (d) => new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const fmtEx = (e) => `${e.sets}×${e.reps}${e.load ? ' @ ' + e.load : ''}`;

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
const HUES = ['#E8F0D0', '#DCEBFA', '#FBE3D6', '#E9E1FA', '#D9F2E6', '#FAE6EE', '#F6EFD2'];
const hue = (s = '') => HUES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
export const Avatar = ({ name, size = 36 }) => html`<span class="av" style=${`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;background:${hue(name)}`}>${initials(name)}</span>`;

const ACTOR = { claude: 'Claude', coach: 'You', client: 'Client' };
export const Actor = ({ by, label }) => html`<span class=${'actor ' + by}>${by === 'claude' ? html`<${Icon} n="spark" s=${11} w=${2.4} />` : null}${label || ACTOR[by] || by}</span>`;
export const Flag = ({ f }) => html`<span class=${'flag ' + f.kind}>${f.kind === 'live' ? html`<i class="pulse"></i>` : null}${f.text}</span>`;

export function navigate(to, replace) {
  if (to === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  dispatchEvent(new PopStateEvent('popstate'));
  if (!replace) window.scrollTo(0, 0);
}
export const Link = ({ to, children, ...p }) => html`<a href=${to} onClick=${(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(to); }} ...${p}>${children}</a>`;

export function Modal({ title, onClose, children, wide }) {
  return html`<div class="modal-bg" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-label=${title}>
      <div class="modal-h"><h3>${title}</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
      ${children}
    </div></div>`;
}
