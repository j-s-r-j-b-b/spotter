import { useState, useRef } from 'preact/hooks';
import { html, Icon, Link, navigate, toast, copy, timeAgo, fmtDay, fmtDate, fmtEx, Avatar, Actor, Flag } from './ui.js';
import { api } from './api.js';
import { usePoll, Dots } from './coach.js';

const who = (by) => ({ claude: 'Claude', coach: 'you', client: 'client' }[by] || by);
const num = (s) => { const m = String(s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const newEx = () => ({ id: 'ex_n' + Math.random().toString(36).slice(2, 9), name: '', sets: 3, reps: '10', load: '', rest: 60, notes: '' });

export function ClientPage({ id }) {
  const [d, setD] = useState(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState('plan');
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wk, setWk] = useState(null);
  const dirtyRef = useRef(false); dirtyRef.current = dirty;
  const ver = useRef(null);
  const wkInit = useRef(false);

  const apply = (r, fromPoll) => {
    setD(r);
    const v = r.client.planVersion || 0;
    if (dirtyRef.current) { if (v !== ver.current) setStale(true); return; }
    if (fromPoll && ver.current !== null && v !== ver.current && r.client.plan?.updatedBy === 'claude') toast('Claude just updated this plan', 'claude');
    if (ver.current === null || v !== ver.current) { ver.current = v; setDraft(r.client.plan ? structuredClone(r.client.plan) : null); setStale(false); }
    if (!wkInit.current && r.summary.week) { wkInit.current = true; setWk(r.summary.week); }
  };
  usePoll(async () => {
    try { apply(await api(`/api/coach?op=client&id=${id}`), true); }
    catch (e) { if (e.status === 404) setMissing(true); else throw e; }
  }, 4000, [id]);

  if (missing) return html`<div class="page"><${Link} to="/app" class="back"><${Icon} n="back" s=${14} /> All clients<//><div class="card empty"><h3>Client not found</h3><p class="muted">They may have been deleted.</p></div></div>`;
  if (!d) return html`<div class="page"><div class="skel" style="height:80px"></div><div class="skel" style="height:420px;margin-top:20px"></div></div>`;

  const { client: c, summary: s, logs } = d;
  const edit = (fn) => { const p = structuredClone(draft); fn(p); setDraft(p); setDirty(true); };
  const discard = () => { setDirty(false); dirtyRef.current = false; ver.current = d.client.planVersion; setDraft(d.client.plan ? structuredClone(d.client.plan) : null); setStale(false); };
  const save = async () => {
    setSaving(true);
    try {
      const r = await api(`/api/coach?op=plan&id=${id}`, { method: 'POST', body: { plan: draft } });
      setDirty(false); dirtyRef.current = false; ver.current = null; apply(r); setStale(false);
      toast(`Saved — ${c.name.split(' ')[0]} sees the update now`, 'ok');
    } catch (e) { toast(e.message, 'bad'); }
    setSaving(false);
  };
  const run = async (op, body = {}, q = '') => { const r = await api(`/api/coach?op=${op}&id=${id}${q}`, { method: 'POST', body }); apply(r); return r; };

  const sessions = logs.sessions.slice().sort((a, b) => (b.completedAt || b.updatedAt).localeCompare(a.completedAt || a.updatedAt));
  const unseen = (c.messages || []).filter((m) => !m.readAt).length;
  const tabs = [['plan', 'Plan'], ['progress', `Progress${sessions.length ? ` · ${sessions.length}` : ''}`], ['messages', `Messages${c.messages?.length ? ` · ${c.messages.length}` : ''}`], ['profile', 'Profile']];

  return html`<div class="page">
    <${Link} to="/app" class="back"><${Icon} n="back" s=${14} /> All clients<//>
    <header class="cl-head">
      <${Avatar} name=${c.name} size=${56} />
      <div class="cl-id">
        <h1>${c.name}</h1>
        <p class="muted">${c.goal || 'No goal set yet'}</p>
        <div class="flags">${s.flags.map((f) => html`<${Flag} f=${f} />`)}${s.live ? html`<span class="small muted">· ${s.live.setsDone} sets ticked so far</span>` : null}</div>
      </div>
      <div class="cl-actions">
        <span class="tiny muted">Client's phone link</span>
        <div class="row">
          <button class="btn sm" onClick=${() => copy(d.phoneUrl, 'Phone link copied — send it to ' + c.name.split(' ')[0])}><${Icon} n="link" s=${13} /> Copy link</button>
          <a class="btn sm" href=${d.phoneUrl} target="_blank" rel="noopener"><${Icon} n="phone" s=${13} /> Open client view</a>
        </div>
      </div>
    </header>

    <div class="tabs" role="tablist">${tabs.map(([k, l]) => html`<button role="tab" class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}${k === 'messages' && unseen ? html`<i class="badge">${unseen} unseen</i>` : null}</button>`)}</div>

    ${tab === 'plan' && html`<${PlanTab} c=${c} s=${s} draft=${draft} edit=${edit} wk=${wk || s.week || 1} setWk=${setWk} dirty=${dirty} stale=${stale} discard=${discard} run=${run} startBlank=${() => { setDraft({ title: 'Training plan', startDate: new Date().toISOString().slice(0, 10), weeks: [{ n: 1, focus: '', workouts: [{ id: 'wo_n1', name: 'Day A', exercises: [newEx()] }] }] }); setDirty(true); setWk(1); }} />`}
    ${tab === 'progress' && html`<${ProgressTab} c=${c} s=${s} logs=${logs} sessions=${sessions} />`}
    ${tab === 'messages' && html`<${MessagesTab} c=${c} run=${run} />`}
    ${tab === 'profile' && html`<${ProfileTab} c=${c} run=${run} />`}

    ${dirty && html`<div class="savebar"><span><${Icon} n="alert" s=${14} /> Unsaved changes to ${c.name.split(' ')[0]}'s plan</span><div class="row"><button class="btn ghost" onClick=${discard}>Discard</button><button class="btn volt" onClick=${save} disabled=${saving}>${saving ? 'Saving…' : 'Save changes'}</button></div></div>`}
  </div>`;
}

// ---------------- Plan editor ----------------
function PlanTab({ c, s, draft, edit, wk, setWk, dirty, stale, discard, run, startBlank }) {
  if (!draft) {
    const p = `Write a 4-week plan in Spotter for ${c.name}${c.goal ? ` (goal: ${c.goal})` : ''}.`;
    return html`<div class="card empty">
      <div class="empty-ic"><${Icon} n="dumbbell" s=${22} /></div>
      <h3>No plan yet</h3>
      <p class="muted">Ask your Claude to write one. It'll appear here in seconds, ready for you to review.</p>
      <div class="prompt-box"><p>${p}</p><button class="btn sm" onClick=${() => copy(p, 'Prompt copied — paste it into Claude')}><${Icon} n="copy" s=${13} /> Copy</button></div>
      <button class="linkish" onClick=${startBlank}>or start a blank plan yourself</button>
    </div>`;
  }
  const weeks = draft.weeks;
  const i = Math.min(wk, weeks.length) - 1;
  const w = weeks[i];
  const changed = (x) => x.workouts.some((o) => o.exercises.some((e) => e.change)) || (x.removed || []).length > 0;
  return html`<div>
    ${stale && html`<div class="warn-bar"><${Icon} n="spark" s=${14} /> This plan was changed (probably by Claude) while you were editing. <button class="linkish" onClick=${discard}>Discard my edits and load the latest</button></div>`}
    <div class="card plan-head">
      <input class="title-in" value=${draft.title} onInput=${(e) => edit((p) => { p.title = e.target.value; })} aria-label="Plan title" />
      <div class="plan-meta small muted">
        <label class="inline">Starts <input type="date" value=${draft.startDate} onChange=${(e) => edit((p) => { p.startDate = e.target.value; })} /></label>
        <span>·</span><span>${s.finished ? 'Finished' : s.started ? `Week ${s.week} of ${weeks.length} now` : 'Not started yet'}</span>
        ${draft.createdBy && html`<span>·</span><span>Written by <${Actor} by=${draft.createdBy} /></span>`}
        ${draft.updatedBy && draft.updatedAt !== draft.createdAt && html`<span>·</span><span>Last change by <${Actor} by=${draft.updatedBy} /> ${timeAgo(draft.updatedAt)}</span>`}
      </div>
    </div>

    <div class="week-tabs">
      ${weeks.map((x, k) => html`<button class=${(k === i ? 'on ' : '') + (k + 1 === s.week && s.started && !s.finished ? 'cur' : '')} onClick=${() => setWk(k + 1)}>
        Week ${k + 1}${k + 1 === s.week && s.started && !s.finished ? html`<span class="now">now</span>` : null}${changed(x) ? html`<i class=${'chg ' + (x.updatedBy || 'claude')} title="Has unreviewed changes"></i>` : null}
        <span class="wk-done">${(s.weekStats[k] || {}).done ?? 0}/${x.workouts.length}</span></button>`)}
      <button class="add" onClick=${() => { edit((p) => { const last = structuredClone(p.weeks[p.weeks.length - 1]); last.n = p.weeks.length + 1; last.workouts.forEach((o) => { o.id = 'wo_n' + Math.random().toString(36).slice(2, 8); o.exercises.forEach((e) => { e.id = 'ex_n' + Math.random().toString(36).slice(2, 9); delete e.change; }); }); last.removed = []; delete last.updatedBy; last.note = ''; p.weeks.push(last); }); setWk(weeks.length + 1); }}><${Icon} n="plus" s=${13} /> Week</button>
    </div>

    ${changed(w) && html`<div class=${'change-banner ' + (w.updatedBy || 'claude')}>
      <div><${Actor} by=${w.updatedBy || 'claude'} /> <b>changed Week ${i + 1}</b> <span class="muted small">${timeAgo(w.updatedAt)}</span>
      ${w.note ? html`<p>${(w.noteBy || w.updatedBy) !== w.updatedBy ? html`<${Actor} by=${w.noteBy} /> ` : null}“${w.note}”</p>` : null}
      ${(w.removed || []).length ? html`<p class="small muted">Removed: ${w.removed.map((r) => r.name).join(', ')}</p>` : null}
      <p class="tiny muted">Changed exercises are highlighted below.</p></div>
      <button class="btn sm" disabled=${dirty} title=${dirty ? 'Save or discard your edits first' : ''} onClick=${() => run('reviewed', {}, `&week=${i + 1}`).then(() => toast('Marked as reviewed', 'ok'))}><${Icon} n="check" s=${13} /> Mark reviewed</button>
    </div>`}

    <label class="focus-in"><span class="tiny muted">Week ${i + 1} focus</span><input value=${w.focus} placeholder="What this week is about" onInput=${(e) => edit((p) => { p.weeks[i].focus = e.target.value; })} /></label>

    ${w.workouts.map((o, oi) => html`<div class="card workout" key=${o.id}>
      <div class="wo-h">
        <input class="wo-name" value=${o.name} onInput=${(e) => edit((p) => { p.weeks[i].workouts[oi].name = e.target.value; })} aria-label="Workout name" />
        <span class="muted small">${o.exercises.length} exercise${o.exercises.length === 1 ? '' : 's'}</span>
        <button class="icon-btn" title="Delete workout" onClick=${() => { if (confirm(`Delete “${o.name}” from Week ${i + 1}?`)) edit((p) => { p.weeks[i].workouts.splice(oi, 1); }); }}><${Icon} n="trash" s=${15} /></button>
      </div>
      <div class="ex-grid ex-headrow"><span>#</span><span>Exercise</span><span>Sets</span><span>Reps</span><span>Load</span><span>Rest (s)</span><span>Cue for the client</span><span></span></div>
      ${o.exercises.map((e, ei) => {
        const up = (k, v) => edit((p) => { p.weeks[i].workouts[oi].exercises[ei][k] = v; });
        return html`<div class=${'ex-grid ex-row' + (e.change ? ' ch ' + e.change.by : '')} key=${e.id}>
          <span class="ex-n">${ei + 1}</span>
          <div class="ex-name"><input value=${e.name} placeholder="Exercise" onInput=${(ev) => up('name', ev.target.value)} />
            ${e.change && html`<span class=${'ch-tag ' + e.change.by}>${e.change.kind === 'new' ? 'New' : 'Was ' + e.change.prev} · ${who(e.change.by)}</span>`}</div>
          <input class="num" type="number" min="1" max="20" value=${e.sets} onInput=${(ev) => up('sets', ev.target.value)} aria-label="Sets" />
          <input value=${e.reps} onInput=${(ev) => up('reps', ev.target.value)} aria-label="Reps" />
          <input value=${e.load} placeholder="—" onInput=${(ev) => up('load', ev.target.value)} aria-label="Load" />
          <input class="num" type="number" min="0" max="900" step="15" value=${e.rest ?? ''} placeholder="—" onInput=${(ev) => up('rest', ev.target.value)} aria-label="Rest seconds" />
          <input value=${e.notes} placeholder="Optional cue" onInput=${(ev) => up('notes', ev.target.value)} aria-label="Cue" />
          <div class="ex-act">
            <button class="icon-btn" title="Move up" disabled=${ei === 0} onClick=${() => edit((p) => { const a = p.weeks[i].workouts[oi].exercises; [a[ei - 1], a[ei]] = [a[ei], a[ei - 1]]; })}><${Icon} n="up" s=${14} /></button>
            <button class="icon-btn" title="Move down" disabled=${ei === o.exercises.length - 1} onClick=${() => edit((p) => { const a = p.weeks[i].workouts[oi].exercises; [a[ei + 1], a[ei]] = [a[ei], a[ei + 1]]; })}><${Icon} n="down" s=${14} /></button>
            <button class="icon-btn" title="Remove" onClick=${() => edit((p) => { p.weeks[i].workouts[oi].exercises.splice(ei, 1); })}><${Icon} n="x" s=${14} /></button>
          </div>
        </div>`;
      })}
      <button class="add-row" onClick=${() => edit((p) => { p.weeks[i].workouts[oi].exercises.push(newEx()); })}><${Icon} n="plus" s=${13} /> Add exercise</button>
    </div>`)}

    <div class="row between plan-foot">
      <button class="btn" onClick=${() => edit((p) => { p.weeks[i].workouts.push({ id: 'wo_n' + Math.random().toString(36).slice(2, 8), name: `Day ${String.fromCharCode(65 + w.workouts.length)}`, exercises: [newEx()] }); })}><${Icon} n="plus" /> Add workout</button>
      ${weeks.length > 1 && html`<button class="btn ghost danger" onClick=${() => { if (confirm(`Delete Week ${i + 1}?`)) { edit((p) => { p.weeks.splice(i, 1); }); setWk(Math.max(1, i)); } }}><${Icon} n="trash" s=${14} /> Delete Week ${i + 1}</button>`}
    </div>

    ${(c.history || []).length > 0 && html`<details class="card history"><summary>Change history (${c.history.length})</summary>
      ${c.history.slice(0, 25).map((h) => html`<div class="hist"><${Actor} by=${h.by} /><span>${h.text}</span><span class="tiny muted">${timeAgo(h.at)}</span></div>`)}
    </details>`}
  </div>`;
}

// ---------------- Progress ----------------
function Spark({ pts }) {
  if (pts.length < 2) return null;
  const ws = pts.map((p) => p.weight), lo = Math.min(...ws) - 0.5, hi = Math.max(...ws) + 0.5, W = 260, H = 64;
  const xy = pts.map((p, k) => [8 + (k / (pts.length - 1)) * (W - 16), 8 + (1 - (p.weight - lo) / (hi - lo)) * (H - 16)]);
  return html`<svg class="spark" viewBox=${`0 0 ${W} ${H}`} width="100%" height=${H} role="img" aria-label="Bodyweight trend">
    <polyline points=${xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    ${xy.map(([x, y], k) => html`<circle cx=${x} cy=${y} r=${k === xy.length - 1 ? 4.5 : 3} fill=${k === xy.length - 1 ? 'currentColor' : 'var(--card)'} stroke="currentColor" stroke-width="2" />`)}
  </svg>`;
}

function SessionCard({ x }) {
  const doneSets = x.entries.reduce((n, e) => n + e.sets.filter((t) => t.done).length, 0);
  const totalSets = x.entries.reduce((n, e) => n + (e.planned.sets || e.sets.length), 0);
  return html`<div class=${'card sess' + (x.status !== 'done' ? ' live' : '') + (x.pain ? ' pain' : '')}>
    <div class="sess-h">
      <div><b>${x.workoutName}</b><span class="small muted"> · Week ${x.week} · ${fmtDay(x.completedAt || x.startedAt)}</span></div>
      <div class="row wrap">
        ${x.status !== 'done' ? html`<span class="flag live"><i class="pulse"></i>In progress · ${doneSets}/${totalSets} sets</span>` : html`<span class="flag ok">Done · ${doneSets}/${totalSets} sets</span>`}
        ${x.effort ? html`<span class=${'flag ' + (x.effort >= 9 ? 'warn' : 'plain')}>Effort ${x.effort}/10</span>` : null}
        ${x.pain ? html`<span class="flag bad">Pain: ${x.painNote || 'yes'}</span>` : null}
      </div>
    </div>
    ${x.comment && html`<p class="quote">“${x.comment}”</p>`}
    <div class="sess-t">
      ${x.entries.map((e) => {
        const d = e.sets.filter((t) => t.done);
        const pl = num(e.planned.load), used = d.length ? num(d[d.length - 1].load) : null;
        const diff = pl != null && used != null && used !== pl ? (used > pl ? 'up' : 'down') : null;
        return html`<div class="sess-r">
          <span>${e.name}</span>
          <span class="mono muted">${e.planned.sets}×${e.planned.reps}${e.planned.load ? ' @ ' + e.planned.load : ''}</span>
          <span class=${'mono ' + (d.length === 0 ? 'bad-t' : d.length < (e.planned.sets || e.sets.length) ? 'warn-t' : '')}>
            ${d.length === 0 ? 'Skipped' : `${d.length}/${e.planned.sets || e.sets.length} · ${d.map((t) => t.reps).join(', ')}${d[0].load && d[0].load !== e.planned.load ? ' @ ' + d[d.length - 1].load : ''}`}
            ${diff && html` <span class=${'diff ' + diff}>${diff === 'up' ? '▲' : '▼'}</span>`}
          </span>
        </div>`;
      })}
    </div>
  </div>`;
}

function ProgressTab({ c, s, logs, sessions }) {
  const ck = logs.checkins || [];
  const wDelta = ck.length > 1 ? Math.round((ck[ck.length - 1].weight - ck[0].weight) * 10) / 10 : null;
  return html`<div>
    <div class="stats">
      <div class="card stat"><span class="tiny muted">This week</span>${c.plan ? html`<${Dots} ...${s.thisWeek} />` : html`<b>—</b>`}<span class="small muted">${c.plan ? `Week ${s.week} of ${s.totalWeeks}` : 'No plan'}</span></div>
      <div class="card stat"><span class="tiny muted">Last workout</span><b>${s.lastWorkout ? timeAgo(s.lastWorkout.at) : '—'}</b><span class="small muted">${s.lastWorkout ? `${s.lastWorkout.name}${s.lastWorkout.effort ? ` · effort ${s.lastWorkout.effort}/10` : ''}` : 'Nothing logged yet'}</span></div>
      <div class="card stat"><span class="tiny muted">Bodyweight</span><b>${ck.length ? ck[ck.length - 1].weight + ' kg' : '—'}</b><span class="small muted">${wDelta != null ? `${wDelta > 0 ? '+' : ''}${wDelta} kg since ${fmtDate(ck[0].date)}` : 'Client logs it from their phone'}</span>${ck.length > 1 ? html`<${Spark} pts=${ck} />` : null}</div>
    </div>
    ${c.plan && html`<div class="card"><h3>Workouts done per week</h3><div class="adh">
      ${s.weekStats.map((w) => html`<div class=${'adh-col' + (w.week === s.week ? ' cur' : '') + (w.week > s.week ? ' future' : '')}><div class="adh-bar"><i style=${`height:${w.planned ? (w.done / w.planned) * 100 : 0}%`}></i></div><span class="tiny">${w.done}/${w.planned}</span><span class="tiny muted">W${w.week}</span></div>`)}
    </div></div>`}
    <h3 class="sec-h">Logged workouts</h3>
    ${sessions.length ? sessions.map((x) => html`<${SessionCard} x=${x} key=${x.id} />`) : html`<div class="card empty"><p class="muted">No workouts logged yet. They appear here live as ${c.name.split(' ')[0]} ticks off sets on their phone.</p></div>`}
  </div>`;
}

// ---------------- Messages ----------------
function MessagesTab({ c, run }) {
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => { e.preventDefault(); if (!t.trim()) return; setBusy(true); try { await run('message', { text: t }); setT(''); toast('Sent — it shows on their phone', 'ok'); } catch (x) { toast(x.message, 'bad'); } setBusy(false); };
  return html`<div class="narrow-col">
    <form class="card composer" onSubmit=${send}>
      <textarea rows="3" value=${t} onInput=${(e) => setT(e.target.value)} placeholder=${`Message ${c.name.split(' ')[0]} — it appears at the top of their phone page`}></textarea>
      <div class="row between"><span class="tiny muted"><${Icon} n="spark" s=${12} /> Or ask Claude: “Send ${c.name.split(' ')[0]} a short check-in about this week.”</span><button class="btn dark" disabled=${busy || !t.trim()}><${Icon} n="send" s=${14} /> Send</button></div>
    </form>
    ${(c.messages || []).length ? c.messages.map((m) => html`<div class="card msg">
      <div class="row between"><span><${Actor} by=${m.by} label=${m.by === 'claude' ? 'Claude (for you)' : 'You'} /> <span class="tiny muted">${timeAgo(m.at)}</span></span><span class=${'tiny ' + (m.readAt ? 'ok-t' : 'muted')}>${m.readAt ? html`<${Icon} n="eye" s=${12} /> Seen ${timeAgo(m.readAt)}` : 'Not seen yet'}</span></div>
      <p>${m.text}</p>
    </div>`) : html`<p class="muted center small">No messages yet.</p>`}
  </div>`;
}

// ---------------- Profile ----------------
function ProfileTab({ c, run }) {
  const [f, setF] = useState({ name: c.name, goal: c.goal || '', age: c.age ?? '', experience: c.experience || '', daysPerWeek: c.daysPerWeek ?? '', equipment: c.equipment || '', limitations: c.limitations || '', notes: c.notes || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await run('profile', { ...f, age: f.age === '' ? null : f.age, daysPerWeek: f.daysPerWeek === '' ? null : f.daysPerWeek }); toast('Profile saved', 'ok'); } catch (x) { toast(x.message, 'bad'); } setBusy(false); };
  const del = async () => { if (!confirm(`Delete ${c.name} and all their workout history? This can't be undone.`)) return; await api(`/api/coach?op=delete&id=${c.id}`, { method: 'POST', body: {} }); toast('Client deleted'); navigate('/app'); };
  return html`<div class="narrow-col">
    <form class="card form" onSubmit=${save}>
      <div class="grid2"><label>Name<input value=${f.name} onInput=${set('name')} required /></label><label>Goal<input value=${f.goal} onInput=${set('goal')} /></label></div>
      <div class="grid3"><label>Age<input type="number" value=${f.age} onInput=${set('age')} /></label>
        <label>Experience<select value=${f.experience} onChange=${set('experience')}><option value="">—</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <label>Days per week<input type="number" min="1" max="7" value=${f.daysPerWeek} onInput=${set('daysPerWeek')} /></label></div>
      <label>Equipment<input value=${f.equipment} onInput=${set('equipment')} placeholder="e.g. Home: dumbbells up to 15 kg" /></label>
      <label>Injuries / limitations<input value=${f.limitations} onInput=${set('limitations')} placeholder="e.g. Right knee hurts on deep squats" /></label>
      <label>Notes<textarea rows="3" value=${f.notes} onInput=${set('notes')}></textarea></label>
      <div class="row between"><span class="tiny muted">Claude reads this profile before writing or changing plans.</span><button class="btn dark" disabled=${busy}>Save profile</button></div>
    </form>
    <div class="card danger-zone"><div><b>Delete client</b><p class="small muted">Removes their plan, workout history and phone link.</p></div><button class="btn ghost danger" onClick=${del}><${Icon} n="trash" s=${14} /> Delete</button></div>
  </div>`;
}
