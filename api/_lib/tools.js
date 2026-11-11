// The actions the coach's Claude can take inside Spotter (MCP tools).
// Claude does all the thinking and writing; these only save, read and serve.
import * as D from './domain.js';

export const INSTRUCTIONS = `Spotter is this coach's client-training app. You (Claude) design and adjust training plans; Spotter saves them, lets the coach edit them, shows them to each client on their phone, and records what the client actually did. Spotter has no AI of its own — what you write is shown to the coach and client as-is.
Typical flows:
• New client: add_client → save_plan → give the coach the client's phone link to send.
• Weekly review: list_clients → get_client_progress → update_week (put what you changed and why in "note") → optionally send_message to encourage the client.
Write specific, safe programming: exact sets, reps, loads in kg (or "bodyweight", "RPE 7"), rest in seconds, and a short cue. Respect limitations and injuries; prefer swapping an exercise over pushing through pain. Keep messages to clients short, warm and in the coach's voice.`;

const exercise = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Exercise name, e.g. "Goblet squat".' },
    sets: { type: 'integer', minimum: 1, maximum: 20 },
    reps: { type: 'string', description: 'Reps or time per set, e.g. "10", "8-10", "8/leg", "30s", "AMRAP", "25 min".' },
    load: { type: 'string', description: 'Weight or intensity, e.g. "20 kg", "bodyweight", "RPE 7", "light band".' },
    rest_seconds: { type: 'integer', minimum: 0, maximum: 900 },
    notes: { type: 'string', description: 'One short coaching cue or modification the client will see.' },
  },
  required: ['name', 'sets', 'reps'],
};
const workout = {
  type: 'object',
  properties: { name: { type: 'string', description: 'e.g. "Day A — Lower body".' }, exercises: { type: 'array', items: exercise, maxItems: 16 } },
  required: ['name', 'exercises'],
};
const week = {
  type: 'object',
  properties: { focus: { type: 'string', description: 'One line on the goal of this week, e.g. "Learn the movements, moderate effort".' }, workouts: { type: 'array', items: workout, minItems: 1, maxItems: 7 } },
  required: ['workouts'],
};
const clientId = { type: 'string', description: 'The client_id from list_clients or add_client (a client name also works if it is unique).' };

class ToolError extends Error {}

const links = (ctx, c) => ({ coach_dashboard: `${ctx.base}/app/clients/${c.id}`, client_phone_link: `${ctx.base}/c/${c.token}` });

async function findClient(ctx, ref) {
  const q = String(ref || '').trim();
  if (!q) throw new ToolError('client_id is required. Call list_clients to see the coach\'s clients.');
  const byId = await D.getClient(ctx.coach.id, q);
  if (byId) return byId;
  const all = await D.listClientDocs(ctx.coach.id);
  const exact = all.filter((c) => c.name.toLowerCase() === q.toLowerCase());
  const loose = all.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const m = exact.length ? exact : loose;
  if (m.length === 1) return m[0];
  if (m.length > 1) throw new ToolError(`More than one client matches "${q}": ${m.map((c) => `${c.name} (${c.id})`).join(', ')}. Use the client_id.`);
  throw new ToolError(`No client found for "${q}". Call list_clients to see the coach's clients.`);
}

const ago = (iso) => { const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };

export const TOOLS = [
  {
    name: 'list_clients',
    title: 'List clients',
    description: 'List all of the coach\'s clients with their plan, which week they are in, this week\'s workouts done vs planned, their last workout and any flags (pain reported, missed sessions, plan ending). Use this first to find a client_id.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(ctx) {
      const docs = await D.listClientDocs(ctx.coach.id);
      const rows = await Promise.all(docs.map(async (c) => {
        const s = D.summarize(c, await D.getLogs(c.id));
        return {
          client_id: c.id, name: c.name, goal: c.goal || null,
          plan: s.planTitle ? `${s.planTitle} — ${s.finished ? 'finished' : s.started ? `week ${s.week} of ${s.totalWeeks}` : `starts ${c.plan.startDate}`}` : 'no plan yet',
          this_week: s.planTitle ? `${s.thisWeek.done} of ${s.thisWeek.planned} workouts done` : null,
          last_workout: s.lastWorkout ? `${s.lastWorkout.name}, ${ago(s.lastWorkout.at)}${s.lastWorkout.effort ? `, effort ${s.lastWorkout.effort}/10` : ''}` : 'none yet',
          flags: s.flags.map((f) => f.text),
        };
      }));
      return { coach: ctx.coach.name, client_count: rows.length, clients: rows, dashboard: `${ctx.base}/app` };
    },
  },
  {
    name: 'add_client',
    title: 'Add a client',
    description: 'Create a new client in Spotter. Returns the client_id and the private phone link the client uses to see and log their workouts. Usually followed by save_plan.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        goal: { type: 'string', description: 'The client\'s main goal in one line.' },
        age: { type: 'integer' },
        experience: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        days_per_week: { type: 'integer', minimum: 1, maximum: 7 },
        equipment: { type: 'string', description: 'e.g. "Home: dumbbells 5–15 kg, bench, bands" or "Full commercial gym".' },
        limitations: { type: 'string', description: 'Injuries, pain or things to avoid.' },
        notes: { type: 'string', description: 'Anything else the coach should remember.' },
      },
      required: ['name'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async run(ctx, a) {
      const c = await D.createClient(ctx.coach, a, 'claude');
      return { created: true, client_id: c.id, name: c.name, ...links(ctx, c), next_step: 'Call save_plan to write their program. The coach sends the client_phone_link to the client.' };
    },
  },
  {
    name: 'save_plan',
    title: 'Save a training plan',
    description: 'Write (or completely replace) a client\'s multi-week training plan. Each week has workouts; each workout has exercises with sets, reps, load, rest and a cue. The plan appears instantly in the coach\'s dashboard and on the client\'s phone. To change just one week of an existing plan, prefer update_week.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: clientId,
        title: { type: 'string', description: 'e.g. "Foundation block — fat loss".' },
        start_date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today. Week 1 starts on this date.' },
        weeks: { type: 'array', items: week, minItems: 1, maxItems: 16, description: 'Week 1 first.' },
        note: { type: 'string', description: 'Short summary for the coach of how the plan is built and why.' },
      },
      required: ['client_id', 'weeks'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    async run(ctx, a) {
      const c = await findClient(ctx, a.client_id);
      const replaced = !!c.plan;
      const { client } = await D.savePlan(ctx.coach, c, { title: a.title, startDate: a.start_date, weeks: a.weeks }, 'claude', a.note);
      const p = client.plan;
      return {
        saved: true, replaced_existing_plan: replaced, client: client.name, title: p.title, start_date: p.startDate, weeks: p.weeks.length,
        workouts_per_week: p.weeks.map((w) => w.workouts.length), ...links(ctx, client),
        tell_the_coach: 'The plan is live. They can review or tweak it in the dashboard, and send the client_phone_link to the client.',
      };
    },
  },
  {
    name: 'update_week',
    title: 'Update one week',
    description: 'Replace one week of a client\'s plan (for example after reviewing progress). Send the complete new list of workouts for that week. Spotter highlights each changed exercise for the coach and shows your note. Use week = total weeks + 1 to add a new week at the end.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: clientId,
        week: { type: 'integer', minimum: 1, description: 'Week number (1-based).' },
        focus: { type: 'string' },
        workouts: { type: 'array', items: workout, minItems: 1, maxItems: 7 },
        note: { type: 'string', description: 'What you changed and why, in one or two sentences, for the coach.' },
      },
      required: ['client_id', 'week', 'workouts', 'note'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    async run(ctx, a) {
      const c = await findClient(ctx, a.client_id);
      const { client, changes } = await D.updateWeek(ctx.coach, c, a.week, { focus: a.focus, workouts: a.workouts }, 'claude', a.note);
      return { updated: true, client: client.name, week: a.week, changes: changes.length ? changes : ['No exercise changes'], ...links(ctx, client) };
    },
  },
  {
    name: 'get_client_progress',
    title: 'Get client progress',
    description: 'Read a client\'s profile, full plan, and every logged workout: what was planned vs. what they actually did (sets, reps, loads), how hard it felt (effort 1–10), any pain they reported, their comments, bodyweight check-ins and adherence per week. Use before adjusting a plan or writing a check-in.',
    inputSchema: { type: 'object', properties: { client_id: clientId }, required: ['client_id'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
    async run(ctx, a) {
      const c = await findClient(ctx, a.client_id);
      return D.progressReport(c, await D.getLogs(c.id), links(ctx, c));
    },
  },
  {
    name: 'send_message',
    title: 'Message a client',
    description: 'Send a short message from the coach to the client. It appears at the top of the client\'s phone page (Spotter shows the coach whether it has been seen). Write it in the coach\'s voice.',
    inputSchema: { type: 'object', properties: { client_id: clientId, message: { type: 'string' } }, required: ['client_id', 'message'] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async run(ctx, a) {
      const c = await findClient(ctx, a.client_id);
      const m = await D.addMessage(ctx.coach, c, a.message, 'claude');
      return { sent: true, client: c.name, message_id: m.id, shows_on: links(ctx, c).client_phone_link };
    },
  },
  {
    name: 'update_client',
    title: 'Update client details',
    description: 'Update a client\'s profile — goal, age, experience, days per week, equipment, limitations/injuries or notes. Only the fields you send are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: clientId, name: { type: 'string' }, goal: { type: 'string' }, age: { type: 'integer' },
        experience: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] }, days_per_week: { type: 'integer', minimum: 1, maximum: 7 },
        equipment: { type: 'string' }, limitations: { type: 'string' }, notes: { type: 'string' },
      },
      required: ['client_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(ctx, a) {
      const c = await findClient(ctx, a.client_id);
      const { client_id, ...fields } = a;
      const u = await D.updateProfile(ctx.coach, c, fields, 'claude');
      return { updated: true, client: u.name, profile: { goal: u.goal, age: u.age ?? null, experience: u.experience, days_per_week: u.daysPerWeek ?? null, equipment: u.equipment, limitations: u.limitations, notes: u.notes } };
    },
  },
];

export async function callTool(ctx, name, args) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return null;
  try {
    const out = await t.run(ctx, args || {});
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] };
  } catch (e) {
    if (e instanceof ToolError || e.status) return { content: [{ type: 'text', text: e.message }], isError: true };
    console.error(e);
    return { content: [{ type: 'text', text: 'Spotter hit an unexpected error. Please try again.' }], isError: true };
  }
}
