// The client's view: a private link, no login, built for a phone at the gym.
import { useState, useEffect, useRef } from 'preact/hooks';
import { html, Icon, Logo, timeAgo, fmtDay } from './ui.js';
import { api } from './api.js';

const firstNum = (r) => { const m = String(r).match(/^(\d+)(?:-\d+)?(?:\/\w+)?$/); return m ? m[1] : String(r); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'se_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const EFFORT = ['', 'Very easy', 'Easy', 'Easy', 'Moderate', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Max effort'];

export function Phone({ token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null); // { week, workout }
  const [weekSel, setWeekSel] = useState(null);
  const load = async () => { const r = await api('/api/client?t=' + encodeURIComponent(token)); setD(r); return r; };

  useEffect(() => { load().then((r) => setWeekSel(r.position?.week || 1)).catch((e) => setErr(e.message)); }, [token]);
  useEffect(() => {
    if (open) return;
    const t = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 15000);
    return () => clearInterval(t);
  }, [open]);
  useEffect(() => {
    if (!d || open || !d.messages.some((m) => !m.readAt)) return;
    const t = setTimeout(() => api(`/api/client?t=${token}&op=read`, { method: 'POST', body: {} }).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [d, open]);

  if (err) return html`<div class="ph"><header class="ph-top"><${Logo} dark /></header><div class="ph-card ph-center"><${Icon} n="alert" s=${26} /><h2>Link not found</h2><p class="ph-muted">${err}</p></div></div>`;
  if (!d) return html`<div class="ph"><header class="ph-top"><${Logo} dark /></header><div class="ph-skel"></div><div class="ph-skel"></div></div>`;
  if (open) return html`<${Workout} token=${token} d=${d} week=${open.week} workout=${open.workout} onClose=${(reload) => { setOpen(null); window.scrollTo(0, 0); if (reload) load(); }} />`;

  const first = d.client.name.split(' ')[0];
  const coachFirst = d.coach.name.split(' ')[0];
  const plan = d.plan;
  const pos = d.position;
  const n = Math.min(Math.max(weekSel || pos.week || 1, 1), plan?.weeks.length || 1);
  const week = plan?.weeks[n - 1];
  const doneIn = (wkN, woId) => d.sessions.filter((s) => s.week === wkN && s.workoutId === woId && s.status === 'done').sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const liveIn = (wkN, woId) => d.sessions.find((s) => s.week === wkN && s.workoutId === woId && s.status === 'in_progress');
  const doneCount = week ? week.workouts.filter((w) => doneIn(n, w.id)).length : 0;
  const nextId = week?.workouts.find((w) => !doneIn(n, w.id))?.id;
  const msg = d.messages[0];
  const ck = d.checkins;

  return html`<div class="ph">
    <header class="ph-top"><${Logo} dark /><span class="ph-coach">Coach ${coachFirst}</span></header>
    <h1 class="ph-hello">Hi ${first}</h1>
    ${d.client.goal && html`<p class="ph-goal">${d.client.goal}</p>`}

    ${msg && html`<div class=${'ph-card ph-msg' + (!msg.readAt ? ' new' : '')}>
      <div class="ph-row"><span class="ph-k"><${Icon} n="msg" s=${13} /> From ${coachFirst}</span>${!msg.readAt ? html`<span class="ph-new">New</span>` : html`<span class="ph-muted ph-t">${timeAgo(msg.at)}</span>`}</div>
      <p>${msg.text}</p>
    </div>`}

    ${!plan ? html`<div class="ph-card ph-center"><${Icon} n="dumbbell" s=${26} /><h2>Your plan is on its way</h2><p class="ph-muted">${coachFirst} is putting it together. Check back soon.</p></div>` : html`
      <div class="ph-week">
        <button class="ph-arrow" disabled=${n <= 1} onClick=${() => setWeekSel(n - 1)} aria-label="Previous week"><${Icon} n="back" s=${18} /></button>
        <div class="ph-week-c">
          <span class="ph-k">${plan.title}</span>
          <h2>Week ${n} <span class="ph-muted">of ${plan.weeks.length}</span>${n === pos.week && pos.started && !pos.finished ? html` <span class="ph-now">This week</span>` : null}</h2>
          ${!pos.started && n === 1 ? html`<p class="ph-muted">Starts ${new Date(plan.startDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</p>` : null}
          ${week.focus && html`<p class="ph-focus">${week.focus}</p>`}
        </div>
        <button class="ph-arrow" disabled=${n >= plan.weeks.length} onClick=${() => setWeekSel(n + 1)} aria-label="Next week" style="transform:scaleX(-1)"><${Icon} n="back" s=${18} /></button>
      </div>
      <div class="ph-progress"><div class="ph-bar"><i style=${`width:${week.workouts.length ? (doneCount / week.workouts.length) * 100 : 0}%`}></i></div><span>${doneCount} of ${week.workouts.length} done</span></div>

      ${week.workouts.map((w) => {
        const done = doneIn(n, w.id), live = liveIn(n, w.id);
        const sets = w.exercises.reduce((a, e) => a + (e.sets || 0), 0);
        const st = done ? 'done' : live ? 'live' : w.id === nextId && n === pos.week ? 'next' : '';
        return html`<button class=${'ph-wo ' + st} onClick=${() => setOpen({ week: n, workout: w })}>
          <div class="ph-wo-b"><b>${w.name}</b><span>${w.exercises.length} exercises · ${sets} sets</span>
            <span class="ph-wo-ex">${w.exercises.slice(0, 3).map((e) => e.name).join(' · ')}${w.exercises.length > 3 ? ' …' : ''}</span></div>
          <span class="ph-wo-st">${done ? html`<${Icon} n="check" s=${15} w=${3} /> ${fmtDay(done.completedAt).split(',')[0]}` : live ? 'Resume' : st === 'next' ? 'Up next' : html`<${Icon} n="arrow" s=${16} />`}</span>
        </button>`;
      })}
    `}

    <${Weight} token=${token} ck=${ck} onSaved=${load} />
    <footer class="ph-foot">Your plan is written by ${coachFirst} with help from Claude · Spotter</footer>
  </div>`;
}

function Weight({ token, ck, onSaved }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const last = ck[ck.length - 1];
  const save = async (e) => {
    e.preventDefault(); if (!v) return; setBusy(true);
    try { await api(`/api/client?t=${token}&op=checkin`, { method: 'POST', body: { weight: v } }); setV(''); await onSaved(); } catch (x) { alert(x.message); }
    setBusy(false);
  };
  return html`<form class="ph-card ph-weight" onSubmit=${save}>
    <div><span class="ph-k"><${Icon} n="scale" s=${13} /> Bodyweight</span><b>${last ? `${last.weight} kg` : '—'}</b><span class="ph-muted ph-t">${last ? 'Last logged ' + timeAgo(last.at) : 'Log it once a week, same time of day'}</span></div>
    <div class="ph-weight-in"><input inputmode="decimal" placeholder="kg" value=${v} onInput=${(e) => setV(e.target.value)} aria-label="Bodyweight in kg" /><button class="ph-btn sm" disabled=${busy || !v}>Log</button></div>
  </form>`;
}

function freshSession(workout, week) {
  return {
    id: uid(), week, workoutId: workout.id, workoutName: workout.name, status: 'in_progress',
    entries: workout.exercises.map((e) => ({ exerciseId: e.id, name: e.name, planned: { sets: e.sets, reps: e.reps, load: e.load }, sets: Array.from({ length: e.sets }, () => ({ reps: firstNum(e.reps), load: e.load || '', done: false })) })),
  };
}

function Workout({ token, d, week, workout, onClose }) {
  const existing = d.sessions.find((s) => s.week === week && s.workoutId === workout.id && s.status === 'in_progress')
    || d.sessions.filter((s) => s.week === week && s.workoutId === workout.id && s.status === 'done').sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const [s, setS] = useState(() => (existing ? structuredClone(existing) : freshSession(workout, week)));
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState(null);
  const timer = useRef();
  const persist = (x) => { clearTimeout(timer.current); timer.current = setTimeout(() => api(`/api/client?t=${token}&op=session`, { method: 'POST', body: x }).catch(() => {}), 500); };
  const update = (fn) => { const x = structuredClone(s); fn(x); setS(x); persist(x); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const total = s.entries.reduce((a, e) => a + e.sets.length, 0);
  const done = s.entries.reduce((a, e) => a + e.sets.filter((t) => t.done).length, 0);
  const planEx = (id) => workout.exercises.find((e) => e.id === id) || {};

  if (saved) return html`<div class="ph ph-donescreen">
    <div class="ph-big-check"><${Icon} n="check" s=${44} w=${3} /></div>
    <h1>Workout logged</h1>
    <p class="ph-muted">${d.coach.name.split(' ')[0]} can see it now.</p>
    <div class="ph-card ph-sum"><div><b>${done}/${total}</b><span>sets</span></div><div><b>${saved.effort || '—'}</b><span>effort</span></div><div><b>${saved.pain ? 'Yes' : 'No'}</b><span>pain</span></div></div>
    <button class="ph-btn volt full" onClick=${() => onClose(true)}>Back to my week</button>
  </div>`;

  return html`<div class="ph ph-workout">
    <header class="ph-top sticky"><button class="ph-arrow" onClick=${() => { clearTimeout(timer.current); if (done) api(`/api/client?t=${token}&op=session`, { method: 'POST', body: s }).catch(() => {}); onClose(true); }} aria-label="Back"><${Icon} n="back" s=${18} /></button><div class="ph-top-t"><b>${workout.name}</b><span class="ph-muted">Week ${week}${s.status === 'done' ? ' · logged' : ''}</span></div><span class="ph-count">${done}/${total}</span></header>

    ${s.entries.map((e, i) => {
      const pe = planEx(e.exerciseId);
      return html`<section class="ph-ex" key=${e.exerciseId + i}>
        <div class="ph-ex-h"><span class="ph-ex-n">${i + 1}</span><div><h3>${e.name}</h3><span class="ph-presc">${e.planned.sets} × ${e.planned.reps}${e.planned.load ? ' @ ' + e.planned.load : ''}${pe.rest ? ` · rest ${pe.rest}s` : ''}</span></div></div>
        ${pe.notes && html`<p class="ph-cue"><${Icon} n="spark" s=${12} /> ${pe.notes}</p>`}
        <div class="ph-sets">
          <div class="ph-set ph-set-h"><span>Set</span><span>Reps</span><span>Load</span><span></span></div>
          ${e.sets.map((t, k) => html`<div class=${'ph-set' + (t.done ? ' done' : '')} key=${k}>
            <span class="ph-set-n">${k + 1}</span>
            <input value=${t.reps} onInput=${(ev) => update((x) => { x.entries[i].sets[k].reps = ev.target.value; })} aria-label=${`Set ${k + 1} reps`} />
            <input value=${t.load} placeholder="—" onInput=${(ev) => update((x) => { x.entries[i].sets[k].load = ev.target.value; })} aria-label=${`Set ${k + 1} load`} />
            <button class="ph-tick" aria-pressed=${t.done} aria-label=${`Mark set ${k + 1} done`} onClick=${() => update((x) => { x.entries[i].sets[k].done = !t.done; if (!t.done && navigator.vibrate) navigator.vibrate(15); })}><${Icon} n="check" s=${18} w=${3} /></button>
          </div>`)}
        </div>
      </section>`;
    })}

    <div class="ph-finishbar"><div class="ph-bar"><i style=${`width:${total ? (done / total) * 100 : 0}%`}></i></div><button class="ph-btn volt full" onClick=${() => setSheet(true)}>${s.status === 'done' ? 'Update this log' : done === total ? 'Finish workout' : `Finish workout (${done}/${total} sets)`}</button></div>
    ${sheet && html`<${FinishSheet} s=${s} onClose=${() => setSheet(false)} onSave=${async (extra) => {
      clearTimeout(timer.current);
      const x = { ...s, ...extra, status: 'done' };
      await api(`/api/client?t=${token}&op=session`, { method: 'POST', body: x });
      setSheet(false); setSaved(x);
    }} />`}
  </div>`;
}

function FinishSheet({ s, onClose, onSave }) {
  const [effort, setEffort] = useState(s.effort || null);
  const [pain, setPain] = useState(!!s.pain);
  const [painNote, setPainNote] = useState(s.painNote || '');
  const [comment, setComment] = useState(s.comment || '');
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await onSave({ effort, pain, painNote: pain ? painNote : '', comment }); } catch (e) { alert(e.message); setBusy(false); } };
  return html`<div class="ph-sheet-bg" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="ph-sheet" role="dialog" aria-label="Finish workout">
      <div class="ph-grab"></div>
      <h3>How hard was it overall?</h3>
      <div class="ph-effort">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => html`<button class=${effort === k ? 'on' : ''} onClick=${() => setEffort(k)}>${k}</button>`)}</div>
      <p class="ph-muted ph-effort-l">${effort ? EFFORT[effort] : '1 = very easy · 10 = couldn\'t do one more rep'}</p>
      <h3>Any pain or discomfort?</h3>
      <div class="ph-seg"><button class=${!pain ? 'on' : ''} onClick=${() => setPain(false)}>No</button><button class=${pain ? 'on bad' : ''} onClick=${() => setPain(true)}>Yes</button></div>
      ${pain && html`<input class="ph-in" value=${painNote} onInput=${(e) => setPainNote(e.target.value)} placeholder="Where, and on which exercise?" />`}
      <h3>Note for your coach <span class="ph-muted">(optional)</span></h3>
      <textarea class="ph-in" rows="2" value=${comment} onInput=${(e) => setComment(e.target.value)} placeholder="Anything they should know?"></textarea>
      <button class="ph-btn volt full" disabled=${busy || !effort} onClick=${go}>${busy ? 'Saving…' : !effort ? 'Pick an effort score' : 'Save workout'}</button>
    </div>
  </div>`;
}
