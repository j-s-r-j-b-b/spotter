// The shared demo account: one coach with three clients and realistic recent history.
// Dates are relative to "now", so the demo always looks current after a reset.
import * as db from './store.js';
import * as D from './domain.js';

export const DEMO = { email: 'demo@spotter.fit', password: 'spotter-demo', name: 'Arjun Rao' };

const DAY = 864e5;
const midnight = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
const at = (dayOffset, hUTC = 1, m = 30) => new Date(midnight() + dayOffset * DAY + (hUTC * 60 + m) * 60000).toISOString();
const dateStr = (dayOffset) => new Date(midnight() + dayOffset * DAY).toISOString().slice(0, 10);
const kg = (v) => `${v} kg`;
const x = (name, sets, reps, load, rest, notes = '') => ({ id: 'ex_' + D.rid(8), name, sets, reps: String(reps), load, rest, notes });
const wo = (name, exercises) => ({ id: 'wo_' + D.rid(8), name, exercises });

function rahulWeek(n) {
  const p = n - 1, h = Math.floor(p / 2);
  return {
    focus: ['Learn the movements, leave 3 reps in the tank', 'Same moves, a little heavier', 'Build: an extra set on squats', 'Strongest week of the block'][p],
    workouts: [
      wo('Day A — Lower body', [
        x('Goblet squat', p >= 2 ? 4 : 3, 10, kg(20 + 2.5 * p), 90, 'Sit between your heels, chest tall'),
        x('Romanian deadlift', 3, 10, kg(30 + 5 * p), 90, 'Push hips back, soft knees, flat back'),
        x('Glute bridge', 3, 12, 'bodyweight', 60, 'Squeeze 2 seconds at the top'),
        x('Dead bug', 3, '8/side', 'bodyweight', 45, 'Lower back stays pressed into the floor'),
      ]),
      wo('Day B — Upper body', [
        x('Lat pulldown', 3, 10, kg(35 + 2.5 * p), 90, 'Pull elbows to your back pockets'),
        x('Dumbbell bench press', 3, 10, kg(14 + 2 * h), 90, 'Two seconds down, controlled'),
        x('Seated cable row', 3, 12, kg(30 + 2.5 * p), 75, 'Tall chest, pause at the squeeze'),
        x('Half-kneeling DB press', 3, '8/side', kg(8 + 2 * h), 60, 'Ribs down, squeeze the back glute'),
        x('Pallof press', 3, '10/side', 'light band', 45, 'Resist the twist'),
      ]),
      wo('Day C — Full body + conditioning', [
        x('Trap-bar deadlift', 3, 8, kg(50 + 5 * p), 120, 'Push the floor away'),
        x('Push-up', 3, 'AMRAP', 'bodyweight', 60, 'Stop 1–2 reps before your form breaks'),
        x('Walking lunge', 2, '10/leg', 'bodyweight', 60, 'Long steps, front knee over mid-foot'),
        x('Farmer carry', 3, '30 m', kg(16 + 2 * p) + ' each hand', 60, 'Walk tall, slow steps'),
        x('Bike intervals', 6, '30s hard / 60s easy', 'RPE 8', 0, 'Hard but repeatable'),
      ]),
    ],
  };
}

function meeraWeek(n) {
  const p = n - 1, h = Math.floor(p / 2);
  const band = ['purple band', 'purple band', 'red band', 'red band', 'black band', 'black band'][p];
  return {
    focus: ['Groove the pull and build an easy running base', 'Same structure, slightly longer run', 'Lighter band — first real test of strength', 'Volume up on pulls and intervals', 'Lightest band, sharpest intervals', 'Test week: pull-up attempt + 5k time trial'][p],
    workouts: [
      wo('Day A — Pull strength', [
        x('Band-assisted pull-up', 4, 5, band, 120, 'Full hang at the bottom, chin over the bar'),
        x('Flexed-arm hang', 3, `${20 + 5 * p}s`, 'bodyweight', 90, 'Chin above the bar, shoulders down'),
        x('Inverted row', 3, 8, 'bodyweight', 75, 'Body in one straight line'),
        x('DB Romanian deadlift', 3, 10, kg(12 + 2 * h), 75, 'Hinge, feel the hamstrings'),
        x('Hollow hold', 3, `${25 + 5 * h}s`, 'bodyweight', 45, 'Lower back glued down'),
      ]),
      wo('Day B — Easy run', [x('Easy run', 1, `${25 + 3 * p} min`, 'conversational pace', 0, 'You should be able to talk in full sentences')]),
      wo('Day C — Upper body + core', [
        x('Negative pull-up', 4, 3, '5-second lowering', 120, 'Jump up, lower as slowly as you can'),
        x('Push-up', 3, 8 + p, 'bodyweight', 60, 'Elbows at 45°'),
        x('Single-arm DB row', 3, '10/side', kg(14 + 2 * h), 60, 'Pull to your hip'),
        x('Face pull', 3, 15, 'light band', 45, 'Thumbs back, squeeze the shoulder blades'),
        x('Side plank', 3, '30s/side', 'bodyweight', 30, 'Hips high'),
      ]),
      wo('Day D — Run intervals', [
        x('400 m repeats', 5 + Math.min(p, 3), '400 m', '5:45/km pace', 90, 'Same pace on every rep'),
        x('Cool-down jog', 1, '10 min', 'easy', 0, ''),
      ]),
    ],
  };
}

function kabirWeek(n) {
  const p = n - 1;
  return {
    focus: ['Moderate loads, 2 reps in reserve', 'Add weight where reps were easy', 'Hardest training week', 'Last push before a deload'][p],
    workouts: [
      wo('Upper A', [
        x('Bench press', 4, 8, kg(60 + 2.5 * p), 120, 'Feet planted, touch mid-chest'),
        x('Barbell row', 4, 8, kg(55 + 2.5 * p), 90, 'Flat back, pull to the belly button'),
        x('Incline DB press', 3, 10, kg(22), 90, ''),
        x('Lat pulldown', 3, 12, kg(50), 75, ''),
        x('Lateral raise', 3, 15, kg(8), 45, 'Lead with the elbows'),
      ]),
      wo('Lower A', [
        x('Back squat', 4, 8, kg(80 + 5 * p), 150, 'Brace hard before each rep'),
        x('Romanian deadlift', 3, 10, kg(70 + 5 * p), 90, ''),
        x('Leg press', 3, 12, kg(140 + 10 * p), 90, ''),
        x('Lying leg curl', 3, 12, kg(35), 60, ''),
        x('Standing calf raise', 4, 15, kg(40), 45, 'Pause at the bottom'),
      ]),
      wo('Upper B', [
        x('Overhead press', 4, 8, kg(40 + 2.5 * p), 120, 'Squeeze glutes, head through at the top'),
        x('Weighted pull-up', 4, 6, '+5 kg', 120, ''),
        x('DB bench press', 3, 10, kg(26), 90, ''),
        x('Cable row', 3, 12, kg(55), 75, ''),
        x('EZ-bar curl', 3, 12, kg(25), 60, ''),
      ]),
      wo('Lower B', [
        x('Deadlift', 4, 5, kg(110 + 5 * p), 180, 'Wedge in, push the floor away'),
        x('Bulgarian split squat', 3, '10/leg', kg(16) + ' each hand', 90, ''),
        x('Hip thrust', 3, 12, kg(80 + 5 * p), 90, ''),
        x('Leg extension', 3, 15, kg(40), 60, ''),
        x('Hanging knee raise', 3, 12, 'bodyweight', 45, ''),
      ]),
    ],
  };
}

function plan(title, startOffset, weeksFn, count, note) {
  const created = at(startOffset - 1, 12, 10);
  const weeks = Array.from({ length: count }, (_, i) => ({ n: i + 1, ...weeksFn(i + 1), updatedBy: 'claude', updatedAt: created, note }));
  return { title, startDate: dateStr(startOffset), weeks, createdBy: 'claude', createdAt: created, updatedBy: 'claude', updatedAt: created, note };
}

const firstNum = (r) => { const m = String(r).match(/^(\d+)(?:-\d+)?(?:\/\w+)?$/); return m ? m[1] : String(r); };

function session(p, weekN, wIdx, dayOffset, o = {}) {
  const w = p.weeks[weekN - 1].workouts[wIdx];
  const entries = w.exercises.map((e) => {
    const ov = o.ex?.[e.name] || {};
    const done = ov.done ?? e.sets;
    return { exerciseId: e.id, name: e.name, planned: { sets: e.sets, reps: e.reps, load: e.load }, sets: Array.from({ length: e.sets }, (_, i) => ({ reps: String(ov.reps ?? firstNum(e.reps)), load: ov.load ?? e.load, done: i < done })) };
  });
  return { id: 'se_' + D.rid(10), week: weekN, workoutId: w.id, workoutName: w.name, status: 'done', startedAt: at(dayOffset, 1, 5), updatedAt: at(dayOffset, 2, 0), completedAt: at(dayOffset, 2, 0), effort: o.effort ?? 7, pain: !!o.pain, painNote: o.pain || '', comment: o.comment || '', entries };
}

export async function seedDemo(coach) {
  // wipe this coach's existing clients
  const ids = (await db.get('clients:' + coach.id)) || [];
  const docs = (await db.mget(ids.map((i) => 'client:' + i))).filter(Boolean);
  await db.del(...ids.map((i) => 'client:' + i), ...ids.map((i) => 'logs:' + i), ...docs.map((c) => 'ctoken:' + c.token), 'activity:' + coach.id);

  const mk = (name, profile, p, msgs) => ({ id: 'cl_' + D.rid(10), coachId: coach.id, token: D.rid(22), name, ...profile, plan: p, planVersion: 1, messages: msgs, history: [{ at: p.createdAt, by: 'claude', text: `created a ${p.weeks.length}-week plan “${p.title}”` }], createdAt: at(-30), updatedAt: p.updatedAt, createdBy: 'coach' });

  const rp = plan('Foundation block — fat loss', -9, rahulWeek, 4, '3 full-body-leaning days. Big lifts first, simple core work, conditioning on Day C. Loads start light to protect the lower back.');
  const rahul = mk('Rahul Verma', { goal: 'Lose 8 kg and stop the lower-back stiffness from desk work', age: 41, experience: 'beginner', daysPerWeek: 3, equipment: 'Full commercial gym', limitations: 'Occasional lower-back stiffness after long days at the desk', notes: 'Works 10–7, trains before work. Prefers short sessions (under 60 min).' }, rp,
    [{ id: 'm_' + D.rid(8), at: at(-10, 12, 20), by: 'claude', text: 'Welcome aboard, Rahul! Your first 4 weeks are in here — 3 sessions a week, about 50 minutes each. Log every set and tell me how it felt; I adjust from what you log.', readAt: at(-9, 1, 0) }]);
  const rahulLogs = { sessions: [
    session(rp, 1, 0, -9, { effort: 6, comment: 'Good start. RDLs felt new but OK.' }),
    session(rp, 1, 1, -7, { effort: 7 }),
    session(rp, 1, 2, -5, { effort: 8, pain: 'Left knee ached on the walking lunges', comment: 'Stopped the lunges after the first set.', ex: { 'Walking lunge': { done: 1 }, 'Push-up': { reps: '11' } } }),
    session(rp, 2, 0, -2, { effort: 5, comment: 'Squats felt easy — could have gone heavier.', ex: { 'Goblet squat': { load: '24 kg' } } }),
  ], checkins: [{ date: dateStr(-9), at: at(-9), weight: 92.4 }, { date: dateStr(-5), at: at(-5), weight: 91.9 }, { date: dateStr(-2), at: at(-2), weight: 91.5 }] };

  const mp = plan('First pull-up + sub-30 5k', -16, meeraWeek, 6, 'Two strength days built around the pull-up, two run days (one easy, one interval). Band assistance steps down every 2 weeks.');
  const meera = mk('Meera Iyer', { goal: 'First strict pull-up and a 5k under 30 minutes', age: 28, experience: 'intermediate', daysPerWeek: 4, equipment: 'Home: pull-up bar, bands, dumbbells up to 16 kg; park for runs', limitations: '', notes: 'Very consistent. Likes clear numbers to beat.' }, mp,
    [{ id: 'm_' + D.rid(8), at: at(-9, 13, 0), by: 'coach', text: 'Huge week Meera — 4 for 4! Bands get lighter next week. Keep the easy runs truly easy.', readAt: at(-8, 1, 0) }]);
  const meeraLogs = { sessions: [
    session(mp, 1, 0, -16, { effort: 7 }), session(mp, 1, 1, -15, { effort: 4 }), session(mp, 1, 2, -13, { effort: 7 }), session(mp, 1, 3, -11, { effort: 8 }),
    session(mp, 2, 0, -9, { effort: 7 }), session(mp, 2, 1, -8, { effort: 4 }), session(mp, 2, 2, -6, { effort: 7 }), session(mp, 2, 3, -4, { effort: 8, comment: 'Last two 400s were 5:30 pace!' }),
    session(mp, 3, 0, -2, { effort: 8, comment: 'Red band is tough — got 4 reps on the last set, not 5.', ex: { 'Band-assisted pull-up': { reps: '4' } } }),
  ], checkins: [{ date: dateStr(-16), at: at(-16), weight: 61.0 }, { date: dateStr(-9), at: at(-9), weight: 60.7 }] };

  const kp = plan('Upper/lower hypertrophy block', -24, kabirWeek, 4, 'Classic 4-day upper/lower split. Main lifts progress weekly; accessories stay in the 10–15 rep range.');
  const kabir = mk('Kabir Shah', { goal: 'Gain 3 kg of lean muscle before March', age: 35, experience: 'advanced', daysPerWeek: 4, equipment: 'Full commercial gym', limitations: '', notes: 'Travels for work roughly once a month.' }, kp, []);
  const kabirLogs = { sessions: [
    session(kp, 1, 0, -24, { effort: 7 }), session(kp, 1, 1, -23, { effort: 8 }), session(kp, 1, 2, -21, { effort: 7 }), session(kp, 1, 3, -20, { effort: 8 }),
    session(kp, 2, 0, -17, { effort: 8 }), session(kp, 2, 1, -16, { effort: 8 }), session(kp, 2, 2, -14, { effort: 8 }),
    session(kp, 3, 0, -10, { effort: 8 }), session(kp, 3, 1, -6, { effort: 8, comment: 'Work trip next week — will try the hotel gym.' }),
  ], checkins: [] };

  const all = [[rahul, rahulLogs], [meera, meeraLogs], [kabir, kabirLogs]];
  for (const [c, logs] of all) {
    await db.set('client:' + c.id, c);
    await db.set('ctoken:' + c.token, c.id);
    await db.set('logs:' + c.id, logs);
  }
  await db.set('clients:' + coach.id, all.map(([c]) => c.id));

  // activity, oldest first (the list keeps newest first)
  const feed = [];
  for (const [c, logs] of all) {
    feed.push({ at: c.plan.createdAt, by: 'claude', clientId: c.id, clientName: c.name, text: `created a ${c.plan.weeks.length}-week plan “${c.plan.title}”`, kind: 'plan' });
    for (const s of logs.sessions) feed.push({ at: s.completedAt, by: 'client', clientId: c.id, clientName: c.name, text: `finished ${s.workoutName} (effort ${s.effort}/10${s.pain ? ` · pain: ${s.painNote}` : ''})`, kind: s.pain ? 'pain' : 'workout' });
    for (const m of c.messages) feed.push({ at: m.at, by: m.by, clientId: c.id, clientName: c.name, text: `sent a message: “${m.text.slice(0, 90)}${m.text.length > 90 ? '…' : ''}”`, kind: 'message' });
  }
  feed.sort((a, b) => a.at.localeCompare(b.at));
  for (const f of feed) await db.lpush('activity:' + coach.id, f, 60);

  coach.seededAt = new Date().toISOString();
  await db.set('coach:' + coach.id, coach);
}

// Returns the demo coach, creating and seeding it on first use (and refreshing very old demo data).
export async function ensureDemo() {
  let coach = await D.coachByEmail(DEMO.email);
  if (!coach) {
    try { coach = await D.createCoach({ ...DEMO, demo: true }); }
    catch (e) { if (e.status !== 409) throw e; coach = await D.coachByEmail(DEMO.email); }
  }
  if (!coach.seededAt || Date.now() - Date.parse(coach.seededAt) > 6 * DAY) await seedDemo(coach);
  return coach;
}
