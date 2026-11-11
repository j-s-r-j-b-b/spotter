import { useState, useEffect } from 'preact/hooks';
import { html, Icon, Logo, Link, navigate, toast, copy, timeAgo, Avatar, Actor, Flag, Modal } from './ui.js';
import { api } from './api.js';
import { ClientPage } from './client-detail.js';

export function usePoll(fn, ms, deps = []) {
  useEffect(() => {
    let alive = true, t;
    const tick = async () => { if (!alive) return; if (!document.hidden) { try { await fn(); } catch {} } if (alive) t = setTimeout(tick, ms); };
    tick();
    const vis = () => { if (!document.hidden) { clearTimeout(t); tick(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; clearTimeout(t); document.removeEventListener('visibilitychange', vis); };
  }, deps);
}

export const PROMPTS = (first = 'Rahul') => [
  { t: 'Add a client and write their plan', p: 'Add a new client to Spotter: Priya Nair, 32, wants to lose fat and feel stronger, beginner, trains 3 days a week at home with dumbbells up to 15 kg. Her right knee hurts on deep squats. Then write her a 4-week plan.' },
  { t: 'Weekly check across all clients', p: 'How are my Spotter clients doing this week? Tell me who I should worry about and why.' },
  { t: 'Review and adjust one client', p: `Review ${first}'s progress in Spotter and adjust next week based on what he actually did. Then send him a short check-in message.` },
  { t: 'Write the next block', p: 'Kabir\'s plan ends this week. Look at how he did and write his next 4-week block in Spotter.' },
];

export function CoachApp({ path }) {
  const [me, setMe] = useState(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => { api('/api/auth').then((r) => setMe(r.coach)).catch(() => navigate('/login', true)); }, []);
  useEffect(() => setMenu(false), [path]);
  if (!me) return html`<div class="boot"><${Logo} /></div>`;

  const m = path.match(/^\/app\/clients\/(\w+)/);
  const page = m ? html`<${ClientPage} id=${m[1]} me=${me} key=${m[1]} />`
    : path === '/app/connect' ? html`<${ConnectPage} me=${me} setMe=${setMe} />`
    : html`<${ClientsPage} me=${me} />`;
  const logout = async () => { await api('/api/auth?op=logout', { method: 'POST', body: {} }); navigate('/login'); };
  const reset = async () => {
    if (!confirm('Reset the demo account to its starting data? This removes anything added during testing.')) return;
    await api('/api/coach?op=reset_demo', { method: 'POST', body: {} });
    toast('Demo data reset', 'ok'); navigate('/app', true); location.reload();
  };
  const nav = [['/app', 'users', 'Clients'], ['/app/connect', 'plug', 'Connect Claude']];
  return html`<div class="shell">
    <aside class=${'side' + (menu ? ' open' : '')}>
      <div class="side-top"><${Link} to="/app"><${Logo} /><//><button class="icon-btn only-m" onClick=${() => setMenu(!menu)} aria-label="Menu"><${Icon} n=${menu ? 'x' : 'menu'} /></button></div>
      <nav class="side-nav">
        ${nav.map(([to, ic, label]) => html`<${Link} to=${to} class=${'nav-i' + ((to === '/app' ? path === '/app' || path.startsWith('/app/clients') : path === to) ? ' on' : '')}><${Icon} n=${ic} /> ${label}<//>`)}
      </nav>
      <div class="side-foot">
        <div class="me"><${Avatar} name=${me.name} size=${30} /><div><b>${me.name}</b><span class="tiny muted">${me.email}</span></div></div>
        <button class="nav-i" onClick=${logout}><${Icon} n="logout" /> Log out</button>
        <p class="tiny muted noai"><${Icon} n="shield" s=${12} /> No AI inside Spotter</p>
      </div>
    </aside>
    <main class="main">
      ${me.demo && html`<div class="demo-bar"><span><b>Demo account</b> — shared with everyone trying Spotter.</span><button class="btn sm" onClick=${reset}><${Icon} n="refresh" s=${13} /> Reset demo data</button></div>`}
      ${page}
    </main>
  </div>`;
}

// ---------------- Clients overview ----------------
function WeekBar({ stats, current }) {
  return html`<span class="weekbar">${stats.map((w) => {
    const r = w.planned ? w.done / w.planned : 0;
    return html`<i class=${(w.week === current ? 'cur ' : '') + (w.week > current ? 'future' : r >= 1 ? 'full' : r > 0 ? 'part' : 'none')} title=${`Week ${w.week}: ${w.done}/${w.planned}`}></i>`;
  })}</span>`;
}
export const Dots = ({ done, planned }) => html`<span class="dots">${Array.from({ length: planned }, (_, i) => html`<i class=${i < done ? 'on' : ''}></i>`)}<b>${done}/${planned}</b></span>`;

function ClientRow({ c }) {
  return html`<${Link} to=${'/app/clients/' + c.id} class=${'c-row' + (c.live ? ' is-live' : '')}>
    <${Avatar} name=${c.name} size=${40} />
    <div class="c-main"><b>${c.name}</b><span class="muted small ell">${c.goal || 'No goal set'}</span></div>
    <div class="c-plan">${c.planTitle ? html`<span class="small"><b>${c.finished ? 'Plan finished' : c.started ? `Week ${c.week}` : 'Starts soon'}</b><span class="muted"> of ${c.totalWeeks}</span></span><${WeekBar} stats=${c.weekStats} current=${c.week} />` : html`<span class="muted small">No plan yet</span>`}</div>
    <div class="c-week">${c.planTitle ? html`<${Dots} ...${c.thisWeek} />` : html`<span class="muted small">—</span>`}</div>
    <div class="c-last small">${c.live ? html`<span class="live-txt"><i class="pulse"></i>${c.live.name}</span>` : c.lastWorkout ? html`<span>${timeAgo(c.lastWorkout.at)}</span><span class="tiny muted ell">${c.lastWorkout.name}</span>` : html`<span class="muted">No workouts yet</span>`}</div>
    <div class="c-flags">${c.flags.filter((f) => f.code !== 'training').map((f) => html`<${Flag} f=${f} />`)}</div>
  <//>`;
}

export function FeedItem({ a, showClient = true }) {
  const ic = { plan: 'dumbbell', workout: 'check', pain: 'alert', message: 'msg', client: 'user', live: 'bolt', checkin: 'scale', edit: 'user' }[a.kind] || 'spark';
  const body = html`<span class=${'fi-ic ' + a.by + (a.kind === 'pain' ? ' pain' : '')}><${Icon} n=${ic} s=${13} w=${2.3} /></span>
    <div class="fi-b"><div><${Actor} by=${a.by} label=${a.by === 'client' ? 'Client' : undefined} /> ${showClient && a.clientName ? html`<b>${a.clientName}</b>` : null}</div><p>${a.text}</p><span class="tiny muted">${timeAgo(a.at)}</span></div>`;
  return a.clientId && showClient ? html`<${Link} to=${'/app/clients/' + a.clientId} class="fi">${body}<//>` : html`<div class="fi">${body}</div>`;
}

function ClientsPage({ me }) {
  const [d, setD] = useState(null);
  const [adding, setAdding] = useState(false);
  usePoll(async () => setD(await api('/api/coach?op=overview')), 4000);
  if (!d) return html`<div class="page"><div class="skel" style="height:56px;width:240px"></div><div class="skel" style="height:300px;margin-top:24px"></div></div>`;
  const cs = d.clients;
  const attention = cs.filter((c) => c.flags.some((f) => f.kind === 'bad' || f.kind === 'warn')).length;
  const live = cs.filter((c) => c.live).length;
  const firstFlagged = cs.find((c) => c.flags.some((f) => f.code === 'pain')) || cs[0];
  const prompt = PROMPTS(firstFlagged?.name.split(' ')[0])[1].p;
  return html`<div class="page">
    <header class="page-h">
      <div><h1>Clients</h1><p class="muted">${cs.length} client${cs.length === 1 ? '' : 's'}${cs.length ? ` · ${attention} need${attention === 1 ? 's' : ''} attention` : ''}${live ? ` · ${live} training right now` : ''}</p></div>
      <button class="btn" onClick=${() => setAdding(true)}><${Icon} n="plus" /> Add client</button>
    </header>
    ${d.store === 'temporary' && html`<div class="warn-bar"><${Icon} n="alert" s=${14} /> Storage isn't connected on this deployment, so data may reset. Add Upstash Redis in Vercel.</div>`}
    ${cs.length ? html`
      <div class="ask-claude"><${Icon} n="spark" s=${16} /><span>Try in Claude: <q>${prompt}</q></span><button class="btn sm" onClick=${() => copy(prompt, 'Prompt copied — paste it into Claude')}><${Icon} n="copy" s=${13} /> Copy</button></div>
      <div class="cols">
        <div class="card list-card">
          <div class="c-row head"><span></span><span>Client</span><span>Plan</span><span>This week</span><span>Last workout</span><span>Needs a look</span></div>
          ${cs.map((c) => html`<${ClientRow} c=${c} key=${c.id} />`)}
        </div>
        <aside class="card feed">
          <h3><i class="pulse"></i> Live activity</h3>
          ${d.activity.length ? d.activity.map((a, i) => html`<${FeedItem} a=${a} key=${a.at + i} />`) : html`<p class="muted small">Nothing yet.</p>`}
        </aside>
      </div>` : html`<${Onboard} me=${me} onAdd=${() => setAdding(true)} />`}
    ${adding && html`<${AddClient} onClose=${() => setAdding(false)} />`}
  </div>`;
}

function Onboard({ me, onAdd }) {
  const p = PROMPTS()[0].p;
  return html`<div class="card onboard">
    <span class="eyebrow">Get started</span>
    <h2>Connect your Claude, then ask it to add your first client</h2>
    <ol class="steps-ol">
      <li>Copy your private connector link: <div class="url-box"><code>${me.mcpUrl}</code><button class="btn sm" onClick=${() => copy(me.mcpUrl, 'Connector link copied')}><${Icon} n="copy" s=${13} /> Copy</button></div></li>
      <li>In Claude, go to <b>Customize → Connectors → Add custom connector</b>. Name it <b>Spotter</b> and paste the link. <${Link} to="/app/connect">Detailed steps<//></li>
      <li>In a new chat, paste this:<div class="prompt-box"><p>${p}</p><button class="btn sm" onClick=${() => copy(p, 'Prompt copied')}><${Icon} n="copy" s=${13} /> Copy</button></div></li>
    </ol>
    <p class="muted small">Your new client will appear here within a few seconds. Prefer to start by hand? <button class="linkish" onClick=${onAdd}>Add a client yourself</button>.</p>
  </div>`;
}

function AddClient({ onClose }) {
  const [f, setF] = useState({ name: '', goal: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api('/api/coach?op=add_client', { method: 'POST', body: f }); navigate('/app/clients/' + r.id); }
    catch (x) { toast(x.message, 'bad'); setBusy(false); }
  };
  return html`<${Modal} title="Add a client" onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <label>Name<input required autofocus value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Priya Nair" /></label>
      <label>Goal<input value=${f.goal} onInput=${(e) => setF({ ...f, goal: e.target.value })} placeholder="e.g. Lose 5 kg and feel stronger" /></label>
      <p class="tiny muted">Tip: it's faster to ask Claude — it fills in the profile and writes the plan in one go.</p>
      <div class="row end"><button type="button" class="btn ghost" onClick=${onClose}>Cancel</button><button class="btn dark" disabled=${busy}>Add client</button></div>
    </form>
  <//>`;
}

// ---------------- Connect Claude ----------------
const TOOL_LIST = [
  ['list_clients', 'See every client, their week, adherence and flags'],
  ['add_client', 'Create a client and get their private phone link'],
  ['save_plan', 'Write a full multi-week training plan'],
  ['update_week', 'Rewrite one week, with a note on what changed and why'],
  ['get_client_progress', 'Read planned vs. actual sets, effort, pain notes and bodyweight'],
  ['send_message', 'Send a short message that shows on the client\'s phone'],
  ['update_client', 'Update goal, equipment, injuries or notes'],
];

function ConnectPage({ me, setMe }) {
  const rotate = async () => {
    if (!confirm('Reset your connector link? Claude will stop working until you paste the new link into Claude\'s connector settings.')) return;
    const r = await api('/api/coach?op=rotate_key', { method: 'POST', body: {} });
    setMe(r.coach); toast('New link created — update it in Claude', 'ok');
  };
  return html`<div class="page narrow">
    <header class="page-h"><div><h1>Connect Claude</h1><p class="muted">Spotter has no AI of its own. You plug in your Claude, and it works inside Spotter on your behalf.</p></div></header>

    <div class="card">
      <h3>Your private connector link</h3>
      <div class="url-box big"><code>${me.mcpUrl}</code><button class="btn dark sm" onClick=${() => copy(me.mcpUrl, 'Connector link copied')}><${Icon} n="copy" s=${13} /> Copy</button></div>
      <p class="tiny muted"><${Icon} n="shield" s=${12} /> Anyone with this link can manage your clients through their Claude. Keep it private. <button class="linkish" onClick=${rotate}>Reset link</button></p>
    </div>

    <div class="card">
      <h3>Add it to Claude (one minute)</h3>
      <ol class="steps-ol">
        <li>Open <b>Claude</b> (claude.ai or the desktop app) and go to <b>Customize → Connectors</b> (<a href="https://claude.ai/customize/connectors" target="_blank" rel="noopener">claude.ai/customize/connectors</a>). In some versions it's under <b>Settings → Connectors</b>.</li>
        <li>Click <b>Add custom connector</b>. Name: <b>Spotter</b>. Remote MCP server URL: paste the link above. Click <b>Add</b>. No sign-in is needed.</li>
        <li>Start a new chat. In the <b>+ / tools</b> menu, check that <b>Spotter</b> is switched on.</li>
        <li>Ask for something (examples below). The first time Claude uses a Spotter action it asks your permission. Choose <b>Always allow</b> so it can work smoothly.</li>
      </ol>
      <p class="tiny muted">Works with the Claude Free plan (one custom connector) and every paid plan. On Team/Enterprise, an owner may need to allow custom connectors first.</p>
    </div>

    <div class="card">
      <h3>Things to ask</h3>
      <div class="prompts">${PROMPTS().map((x) => html`<div class="prompt-box"><span class="tiny muted">${x.t}</span><p>${x.p}</p><button class="btn sm" onClick=${() => copy(x.p, 'Prompt copied')}><${Icon} n="copy" s=${13} /> Copy</button></div>`)}</div>
    </div>

    <div class="card">
      <h3>What Claude can do in Spotter</h3>
      <div class="tools">${TOOL_LIST.map(([n, d]) => html`<div class="tool-row"><code>${n}</code><span>${d}</span></div>`)}</div>
      <p class="tiny muted">Spotter only stores, shows and serves. Every word of every plan and message is written by your Claude or by you.</p>
    </div>
  </div>`;
}
