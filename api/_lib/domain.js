// Spotter's business logic: coaches, clients, plans, workout logs, messages and activity.
// Everything here is plain rules and storage. There is no AI anywhere in Spotter.
import crypto from 'node:crypto';
import * as db from './store.js';
import { httpError } from './http.js';

const ALPHA = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const rid = (n = 12) => { let s = ''; for (const x of crypto.randomBytes(n)) s += ALPHA[x % ALPHA.length]; return s; };
const now = () => new Date().toISOString();
const clip = (s, n = 200) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim().slice(0, n);
const clipText = (s, n = 2000) => (s == null ? '' : String(s)).trim().slice(0, n);
const int = (v, lo, hi, d = null) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d; };
const DAY = 864e5;
export const todayISO = () => new Date().toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));

// ---------------- coaches & sessions ----------------
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');

export async function createCoach({ name, email, password, demo = false }) {
  email = clip(email, 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'Please enter a valid email.');
  if (!password || String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters.');
  const id = 'co_' + rid(10);
  if (!(await db.setNX('email:' + email, id))) throw httpError(409, 'An account with this email already exists. Try logging in.');
  const salt = rid(16);
  const coach = { id, name: clip(name, 80) || email.split('@')[0], email, salt, hash: hashPw(password, salt), mcpKey: 'sk_' + rid(32), demo, createdAt: now() };
  await db.set('coach:' + id, coach);
  await db.set('mcpkey:' + coach.mcpKey, id);
  return coach;
}

export async function verifyLogin(email, password) {
  const id = await db.get('email:' + clip(email, 120).toLowerCase());
  const coach = id && (await db.get('coach:' + id));
  if (!coach) return null;
  const a = Buffer.from(hashPw(password, coach.salt), 'hex'), b = Buffer.from(coach.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? coach : null;
}

export const getCoach = (id) => db.get('coach:' + id);
export async function coachByEmail(email) { const id = await db.get('email:' + String(email).toLowerCase()); return id ? getCoach(id) : null; }
export async function coachByMcpKey(key) { if (!/^sk_\w{10,64}$/.test(key || '')) return null; const id = await db.get('mcpkey:' + key); return id ? getCoach(id) : null; }

export async function rotateMcpKey(coach) {
  await db.del('mcpkey:' + coach.mcpKey);
  coach.mcpKey = 'sk_' + rid(32);
  await db.set('coach:' + coach.id, coach);
  await db.set('mcpkey:' + coach.mcpKey, coach.id);
  return coach;
}

const SESSION_TTL = 60 * 60 * 24 * 30;
export async function createSession(coachId) { const t = rid(32); await db.set('session:' + t, coachId, SESSION_TTL); return t; }
export async function coachFromSession(token) { if (!token) return null; const id = await db.get('session:' + token); return id ? getCoach(id) : null; }
export const endSession = (token) => db.del('session:' + token);

export const publicCoach = (c, base) => ({ id: c.id, name: c.name, email: c.email, demo: !!c.demo, mcpUrl: `${base}/mcp/${c.mcpKey}` });

// ---------------- activity feed ----------------
export async function activity(coachId, { by, client, text, kind = 'info' }) {
  await db.lpush('activity:' + coachId, { at: now(), by, clientId: client?.id || null, clientName: client?.name || null, text, kind }, 60);
}
export const listActivity = (coachId, n = 30) => db.lrange('activity:' + coachId, n);

// ---------------- clients ----------------
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
function profileFrom(input, base = {}) {
  const p = { ...base };
  const has = (k) => input[k] !== undefined && input[k] !== null;
  if (has('name')) p.name = clip(input.name, 80);
  if (has('goal')) p.goal = clip(input.goal, 240);
  if (has('age')) p.age = int(input.age, 10, 100);
  const exp = String(input.experience ?? '').toLowerCase();
  if (has('experience')) p.experience = EXPERIENCE.includes(exp) ? exp : clip(input.experience, 40);
  const dpw = input.days_per_week ?? input.daysPerWeek;
  if (dpw !== undefined && dpw !== null) p.daysPerWeek = int(dpw, 1, 7);
  if (has('equipment')) p.equipment = clip(input.equipment, 240);
  if (has('limitations')) p.limitations = clip(input.limitations, 400);
  if (has('notes')) p.notes = clipText(input.notes, 1500);
  return p;
}

export async function createClient(coach, input, by) {
  const prof = profileFrom(input);
  if (!prof.name) throw httpError(400, 'Client name is required.');
  const ids = (await db.get('clients:' + coach.id)) || [];
  if (ids.length >= 200) throw httpError(400, 'Client limit reached for this account.');
  const c = { id: 'cl_' + rid(10), coachId: coach.id, token: rid(22), goal: '', experience: '', equipment: '', limitations: '', notes: '', ...prof, plan: null, planVersion: 0, messages: [], history: [], createdAt: now(), updatedAt: now(), createdBy: by };
  await db.set('client:' + c.id, c);
  await db.set('ctoken:' + c.token, c.id);
  ids.unshift(c.id);
  await db.set('clients:' + coach.id, ids);
  await activity(coach.id, { by, client: c, text: 'added as a new client', kind: 'client' });
  return c;
}

export async function getClient(coachId, id) {
  const c = await db.get('client:' + id);
  return c && c.coachId === coachId ? c : null;
}
export async function clientByToken(token) {
  if (!/^\w{10,40}$/.test(token || '')) return null;
  const id = await db.get('ctoken:' + token);
  return id ? db.get('client:' + id) : null;
}
export async function listClientDocs(coachId) {
  const ids = (await db.get('clients:' + coachId)) || [];
  return (await db.mget(ids.map((i) => 'client:' + i))).filter(Boolean);
}
async function saveClient(c) { c.updatedAt = now(); await db.set('client:' + c.id, c); return c; }

const historyAdd = (c, by, text) => { c.history = [{ at: now(), by, text }, ...(c.history || [])].slice(0, 60); };

export async function updateProfile(coach, c, input, by) {
  Object.assign(c, profileFrom(input, {}));
  if (!c.name) throw httpError(400, 'Client name cannot be empty.');
  historyAdd(c, by, 'updated the profile');
  await saveClient(c);
  await activity(coach.id, { by, client: c, text: 'profile updated', kind: 'edit' });
  return c;
}

export async function deleteClient(coach, c) {
  const ids = ((await db.get('clients:' + coach.id)) || []).filter((i) => i !== c.id);
  await db.set('clients:' + coach.id, ids);
  await db.del('client:' + c.id, 'ctoken:' + c.token, 'logs:' + c.id);
}

// ---------------- plans ----------------
const LIMITS = { weeks: 16, workouts: 7, exercises: 16 };

function normExercise(e) {
  if (!e || typeof e !== 'object') return null;
  const name = clip(e.name, 80);
  if (!name) return null;
  const rest = e.rest_seconds ?? e.rest;
  return {
    id: /^ex_\w+$/.test(e.id || '') ? e.id : 'ex_' + rid(8),
    name,
    sets: int(e.sets, 1, 20, 3),
    reps: clip(e.reps ?? '10', 24) || '10',
    load: clip(e.load ?? '', 40),
    rest: int(rest, 0, 900, null),
    notes: clip(e.notes ?? e.cue ?? '', 200),
    ...(e.change && typeof e.change === 'object' ? { change: e.change } : {}),
  };
}

function normWorkout(w, i) {
  if (!w || typeof w !== 'object') return null;
  const exercises = (Array.isArray(w.exercises) ? w.exercises : []).map(normExercise).filter(Boolean).slice(0, LIMITS.exercises);
  return { id: /^wo_\w+$/.test(w.id || '') ? w.id : 'wo_' + rid(8), name: clip(w.name || w.title, 80) || `Workout ${i + 1}`, exercises };
}

function normWeek(w, n) {
  const src = Array.isArray(w?.workouts) ? w.workouts : Array.isArray(w?.days) ? w.days : [];
  return { n, focus: clip(w?.focus ?? '', 160), workouts: src.map(normWorkout).filter(Boolean).slice(0, LIMITS.workouts) };
}

// Compare exercises loosely (case, spacing, "rest 0" vs blank) so re-sent but unchanged rows aren't flagged.
const sig = (e) => [e.name, e.sets, e.reps, e.load, e.rest || '', e.notes].map((x) => String(x ?? '').toLowerCase().replace(/\s+/g, '').replace(/[.,;:]+$/, '')).join('|');
export const fmtEx = (e) => `${e.sets}×${e.reps}${e.load ? ' @ ' + e.load : ''}`;
const key = (s) => String(s || '').toLowerCase().trim();

// Keeps workout/exercise ids stable across edits and marks what changed (and who changed it).
// Returns a short list of human-readable changes.
function reconcileWeek(nw, ow, by) {
  const changes = [];
  if (!ow) { nw.workouts.forEach((w) => w.exercises.forEach((e) => delete e.change)); nw.removed = []; return changes; }
  const at = now();
  const usedW = new Set();
  nw.workouts.forEach((w, i) => {
    const prevW = ow.workouts.find((o) => o.id === w.id && !usedW.has(o.id)) || ow.workouts.find((o) => key(o.name) === key(w.name) && !usedW.has(o.id)) || (ow.workouts[i] && !usedW.has(ow.workouts[i].id) ? ow.workouts[i] : null);
    if (prevW) { w.id = prevW.id; usedW.add(prevW.id); }
    const pool = [...(prevW?.exercises || []), ...ow.workouts.filter((o) => o !== prevW).flatMap((o) => o.exercises)];
    const usedE = new Set();
    for (const e of w.exercises) {
      const prev = pool.find((p) => p.id === e.id && !usedE.has(p.id)) || pool.find((p) => key(p.name) === key(e.name) && !usedE.has(p.id));
      if (prev) { e.id = prev.id; usedE.add(prev.id); }
      if (prev && sig(prev) === sig(e)) { if (prev.change) e.change = prev.change; else delete e.change; continue; }
      if (prev) {
        const was = (key(prev.name) !== key(e.name) ? prev.name + ' ' : '') + fmtEx(prev);
        e.change = { by, kind: 'modified', prev: was, at };
        changes.push(`${e.name}: ${was} → ${fmtEx(e)}`);
      } else {
        e.change = { by, kind: 'new', at };
        changes.push(`Added ${e.name} (${fmtEx(e)}) to ${w.name}`);
      }
    }
  });
  const kept = new Set(nw.workouts.flatMap((w) => w.exercises.map((e) => e.id)));
  const removed = ow.workouts.flatMap((w) => w.exercises).filter((e) => !kept.has(e.id)).map((e) => ({ name: e.name, by, at }));
  removed.forEach((r) => changes.push(`Removed ${r.name}`));
  const removedW = ow.workouts.filter((o) => !usedW.has(o.id));
  removedW.forEach((o) => changes.push(`Removed workout ${o.name}`));
  nw.removed = changes.length ? [...removed, ...(ow.removed || []).filter((r) => r.by === by && Date.now() - Date.parse(r.at) < 7 * DAY)].slice(0, 12) : ow.removed || [];
  if (key(nw.focus) !== key(ow.focus)) changes.push(`Focus: ${nw.focus || '—'}`);
  return changes;
}

function stampWeek(nw, ow, by, note, changes) {
  // Keep the last explanation (usually Claude's "why") until someone writes a new one.
  const n = clip(note, 400);
  nw.note = n || ow?.note || '';
  nw.noteBy = n ? by : ow?.noteBy || ow?.updatedBy || by;
  if (!ow || changes.length) { nw.updatedBy = by; nw.updatedAt = now(); }
  else { nw.updatedBy = ow.updatedBy; nw.updatedAt = ow.updatedAt; }
}

export async function savePlan(coach, c, input, by, note = '') {
  const weeksIn = Array.isArray(input?.weeks) ? input.weeks : [];
  if (!weeksIn.length) throw httpError(400, 'A plan needs at least one week with workouts.');
  const old = c.plan;
  const weeks = weeksIn.slice(0, LIMITS.weeks).map((w, i) => normWeek(w, i + 1));
  let changes = [];
  weeks.forEach((w, i) => {
    const ow = old?.weeks?.[i] || null;
    const ch = reconcileWeek(w, ow, by);
    stampWeek(w, ow, by, note, ch);
    if (ow) changes.push(...ch.map((x) => `Week ${i + 1}: ${x}`));
  });
  if (old && old.weeks.length > weeks.length) changes.push(`Removed weeks ${weeks.length + 1}–${old.weeks.length}`);
  const startDate = isDate(input.startDate ?? input.start_date) ? (input.startDate ?? input.start_date) : old?.startDate || todayISO();
  c.plan = { title: clip(input.title, 100) || old?.title || 'Training plan', startDate, weeks, createdBy: old?.createdBy || by, createdAt: old?.createdAt || now(), updatedBy: by, updatedAt: now(), note: clip(note, 400) };
  c.planVersion = (c.planVersion || 0) + 1;
  const summary = old ? `edited the plan${changes.length ? ` (${changes.length} change${changes.length > 1 ? 's' : ''})` : ''}` : `created a ${weeks.length}-week plan “${c.plan.title}”`;
  historyAdd(c, by, summary + (note ? ` — ${clip(note, 160)}` : ''));
  await saveClient(c);
  await activity(coach.id, { by, client: c, text: summary, kind: 'plan' });
  return { client: c, changes };
}

export async function updateWeek(coach, c, n, input, by, note = '') {
  if (!c.plan) throw httpError(400, `${c.name} has no plan yet. Use save_plan to create one first.`);
  n = int(n, 1, LIMITS.weeks, 0);
  if (!n || n > c.plan.weeks.length + 1) throw httpError(400, `Week must be between 1 and ${c.plan.weeks.length + 1}.`);
  const nw = normWeek(input, n);
  if (!nw.workouts.length) throw httpError(400, 'The week needs at least one workout with exercises.');
  const ow = c.plan.weeks[n - 1] || null;
  if (!input.focus && ow) nw.focus = ow.focus;
  const changes = reconcileWeek(nw, ow, by);
  stampWeek(nw, ow, by, note, ow ? changes : ['new']);
  c.plan.weeks[n - 1] = nw;
  c.plan.updatedBy = by; c.plan.updatedAt = now();
  c.planVersion = (c.planVersion || 0) + 1;
  const summary = ow ? `updated Week ${n}${changes.length ? ` (${changes.length} change${changes.length > 1 ? 's' : ''})` : ''}` : `added Week ${n}`;
  historyAdd(c, by, summary + (note ? ` — ${clip(note, 160)}` : ''));
  await saveClient(c);
  await activity(coach.id, { by, client: c, text: summary + (note ? ` — ${clip(note, 120)}` : ''), kind: 'plan' });
  return { client: c, changes };
}

export async function markWeekReviewed(c, n) {
  const w = c.plan?.weeks?.[n - 1];
  if (!w) throw httpError(404, 'Week not found.');
  w.workouts.forEach((x) => x.exercises.forEach((e) => delete e.change));
  w.removed = []; w.reviewedAt = now();
  c.planVersion = (c.planVersion || 0) + 1;
  return saveClient(c);
}

// ---------------- messages ----------------
export async function addMessage(coach, c, text, by) {
  text = clipText(text, 1200);
  if (!text) throw httpError(400, 'Message is empty.');
  const m = { id: 'm_' + rid(8), at: now(), by, text, readAt: null };
  c.messages = [m, ...(c.messages || [])].slice(0, 100);
  await saveClient(c);
  await activity(coach.id, { by, client: c, text: 'sent a message: “' + clip(text, 90) + (text.length > 90 ? '…”' : '”'), kind: 'message' });
  return m;
}
export async function markMessagesRead(c) {
  let changed = false;
  (c.messages || []).forEach((m) => { if (!m.readAt) { m.readAt = now(); changed = true; } });
  if (changed) await saveClient(c);
}

// ---------------- workout logs ----------------
export async function getLogs(clientId) { return (await db.get('logs:' + clientId)) || { sessions: [], checkins: [] }; }

export async function upsertSession(c, s) {
  const logs = await getLogs(c.id);
  const id = clip(s.id, 48);
  if (!id) throw httpError(400, 'Missing session id.');
  const i = logs.sessions.findIndex((x) => x.id === id);
  const prev = i >= 0 ? logs.sessions[i] : null;
  const status = s.status === 'done' ? 'done' : prev?.status === 'done' ? 'done' : 'in_progress';
  const entries = (Array.isArray(s.entries) ? s.entries : []).slice(0, 20).map((e) => ({
    exerciseId: clip(e.exerciseId, 24), name: clip(e.name, 80),
    planned: { sets: int(e.planned?.sets, 0, 20, 0), reps: clip(e.planned?.reps, 24), load: clip(e.planned?.load, 40) },
    sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 20).map((x) => ({ reps: clip(x.reps, 12), load: clip(x.load, 24), done: !!x.done })),
  }));
  const sess = {
    id, week: int(s.week, 1, LIMITS.weeks, 1), workoutId: clip(s.workoutId, 24), workoutName: clip(s.workoutName, 80),
    status, startedAt: prev?.startedAt || now(), updatedAt: now(),
    completedAt: status === 'done' ? prev?.completedAt || now() : null,
    effort: s.effort != null ? int(s.effort, 1, 10) : prev?.effort ?? null,
    pain: s.pain != null ? !!s.pain : !!prev?.pain,
    painNote: s.painNote != null ? clip(s.painNote, 200) : prev?.painNote || '',
    comment: s.comment != null ? clipText(s.comment, 600) : prev?.comment || '',
    entries,
  };
  if (i >= 0) logs.sessions[i] = sess; else logs.sessions.push(sess);
  logs.sessions = logs.sessions.slice(-400);
  await db.set('logs:' + c.id, logs);
  if (sess.status === 'done' && prev?.status !== 'done') {
    const coach = { id: c.coachId };
    const bits = [sess.effort ? `effort ${sess.effort}/10` : '', sess.pain ? `pain: ${sess.painNote || 'yes'}` : ''].filter(Boolean).join(' · ');
    await activity(coach.id, { by: 'client', client: c, text: `finished ${sess.workoutName}${bits ? ` (${bits})` : ''}`, kind: sess.pain ? 'pain' : 'workout' });
  } else if (!prev) {
    await activity(c.coachId, { by: 'client', client: c, text: `started ${sess.workoutName}`, kind: 'live' });
  }
  return sess;
}

export async function addCheckin(c, weight) {
  const w = parseFloat(String(weight).replace(',', '.'));
  if (!(w > 20 && w < 400)) throw httpError(400, 'Enter a bodyweight in kg.');
  const logs = await getLogs(c.id);
  const today = todayISO();
  logs.checkins = [...(logs.checkins || []).filter((x) => x.date !== today), { date: today, at: now(), weight: Math.round(w * 10) / 10 }].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
  await db.set('logs:' + c.id, logs);
  await activity(c.coachId, { by: 'client', client: c, text: `logged bodyweight ${Math.round(w * 10) / 10} kg`, kind: 'checkin' });
  return logs.checkins;
}

// ---------------- summaries (pure rules) ----------------
export function planPosition(plan, at = Date.now()) {
  if (!plan?.weeks?.length) return { week: 0, total: 0, started: false, finished: false, dayN: 0 };
  const start = Date.parse(plan.startDate + 'T00:00:00Z');
  const dayN = Math.floor((Date.parse(new Date(at).toISOString().slice(0, 10) + 'T00:00:00Z') - start) / DAY);
  const total = plan.weeks.length;
  return { week: dayN < 0 ? 1 : Math.min(Math.floor(dayN / 7) + 1, total), total, started: dayN >= 0, finished: dayN >= total * 7, dayN };
}

export function summarize(c, logs, at = Date.now()) {
  const pos = planPosition(c.plan, at);
  const done = logs.sessions.filter((s) => s.status === 'done').sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const weekStats = (c.plan?.weeks || []).map((w, i) => {
    const ids = new Set(done.filter((s) => s.week === i + 1).map((s) => s.workoutId));
    return { week: i + 1, planned: w.workouts.length, done: Math.min(ids.size, w.workouts.length) };
  });
  const last = done[0] || null;
  const live = logs.sessions.find((s) => s.status === 'in_progress' && at - Date.parse(s.updatedAt) < 3 * 3600e3) || null;
  const flags = [];
  if (!c.plan) flags.push({ kind: 'info', code: 'no_plan', text: 'No plan yet' });
  if (live) flags.push({ kind: 'live', code: 'training', text: 'Training now' });
  const pain = done.find((s) => s.pain && at - Date.parse(s.completedAt) < 10 * DAY);
  if (pain) flags.push({ kind: 'bad', code: 'pain', text: 'Pain reported' + (pain.painNote ? `: ${pain.painNote}` : '') });
  if (c.plan && pos.started) {
    const since = last ? Math.floor((at - Date.parse(last.completedAt)) / DAY) : pos.dayN;
    if (since >= 5) flags.push({ kind: 'warn', code: 'inactive', text: last ? `No workout in ${since} days` : `Not started (${since} days)` });
  }
  if (last?.effort >= 9 && at - Date.parse(last.completedAt) < 7 * DAY) flags.push({ kind: 'warn', code: 'hard', text: `Last session felt very hard (${last.effort}/10)` });
  if (c.plan && pos.finished) flags.push({ kind: 'info', code: 'finished', text: 'Plan finished — needs next block' });
  else if (c.plan && pos.started && pos.week === pos.total) flags.push({ kind: 'info', code: 'ending', text: 'Plan ends this week' });
  const lastWeights = (logs.checkins || []).slice(-2);
  return {
    id: c.id, name: c.name, goal: c.goal, token: c.token,
    planTitle: c.plan?.title || null, week: pos.week, totalWeeks: pos.total, started: pos.started, finished: pos.finished,
    thisWeek: weekStats[pos.week - 1] || { planned: 0, done: 0 }, weekStats,
    lastWorkout: last ? { at: last.completedAt, name: last.workoutName, effort: last.effort } : null,
    live: live ? { name: live.workoutName, at: live.updatedAt, setsDone: live.entries.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0) } : null,
    weight: lastWeights.length ? { now: lastWeights[lastWeights.length - 1].weight, prev: lastWeights.length > 1 ? lastWeights[0].weight : null } : null,
    unread: (c.messages || []).filter((m) => !m.readAt).length,
    flags, updatedAt: c.updatedAt, planVersion: c.planVersion || 0,
  };
}

// Compact, Claude-friendly report of plan vs. what actually happened.
export function progressReport(c, logs, links) {
  const s = summarize(c, logs);
  const exLine = (e) => `${e.name} — ${fmtEx(e)}${e.rest ? `, rest ${e.rest}s` : ''}${e.notes ? ` (${e.notes})` : ''}`;
  const doneLine = (e) => {
    const d = e.sets.filter((x) => x.done);
    if (!d.length) return 'skipped';
    const sets = d.map((x) => `${x.reps || '?'}${x.load ? ' @ ' + x.load : ''}`).join(', ');
    return `${d.length}/${e.planned.sets || e.sets.length} sets: ${sets}`;
  };
  return {
    client: { client_id: c.id, name: c.name, goal: c.goal, age: c.age ?? null, experience: c.experience || null, days_per_week: c.daysPerWeek ?? null, equipment: c.equipment || null, limitations: c.limitations || null, notes: c.notes || null },
    plan: c.plan ? {
      title: c.plan.title, start_date: c.plan.startDate, current_week: s.week, total_weeks: s.totalWeeks, finished: s.finished,
      weeks: c.plan.weeks.map((w) => ({ week: w.n, focus: w.focus, last_changed_by: w.updatedBy || null, workouts: w.workouts.map((x) => ({ name: x.name, exercises: x.exercises.map(exLine) })) })),
    } : null,
    adherence: s.weekStats.map((w) => `Week ${w.week}: ${w.done} of ${w.planned} workouts done`),
    sessions: logs.sessions.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((x) => ({
      week: x.week, workout: x.workoutName, date: (x.completedAt || x.startedAt).slice(0, 10), status: x.status === 'done' ? 'completed' : 'in progress',
      effort_1_to_10: x.effort, pain: x.pain ? x.painNote || 'yes' : 'none', client_comment: x.comment || null,
      exercises: x.entries.map((e) => ({ name: e.name, planned: `${e.planned.sets}×${e.planned.reps}${e.planned.load ? ' @ ' + e.planned.load : ''}`, done: doneLine(e) })),
    })),
    bodyweight_kg: (logs.checkins || []).map((x) => `${x.date}: ${x.weight}`),
    flags: s.flags.map((f) => f.text),
    recent_messages_to_client: (c.messages || []).slice(0, 5).map((m) => ({ date: m.at.slice(0, 10), from: m.by === 'claude' ? 'Claude (for the coach)' : 'coach', text: m.text, seen_by_client: !!m.readAt })),
    links,
  };
}
