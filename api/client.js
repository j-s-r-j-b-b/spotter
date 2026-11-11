// The client's phone page API. No login: the private token in the link is the key.
import { readBody, send, query, handle, httpError } from './_lib/http.js';
import * as D from './_lib/domain.js';

export default handle(async (req, res) => {
  const q = query(req);
  const c = await D.clientByToken(q.t);
  if (!c) throw httpError(404, 'This link is not valid any more. Ask your coach for a new one.');

  if (req.method === 'GET') {
    const [coach, logs] = await Promise.all([D.getCoach(c.coachId), D.getLogs(c.id)]);
    const pos = D.planPosition(c.plan);
    return send(res, 200, {
      client: { name: c.name, goal: c.goal },
      coach: { name: coach?.name || 'Your coach' },
      plan: c.plan, planVersion: c.planVersion || 0, position: pos,
      sessions: logs.sessions, checkins: logs.checkins || [],
      messages: (c.messages || []).map(({ id, at, text, readAt }) => ({ id, at, text, readAt })),
    });
  }
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const b = await readBody(req);
  if (q.op === 'session') return send(res, 200, { session: await D.upsertSession(c, b) });
  if (q.op === 'checkin') return send(res, 200, { checkins: await D.addCheckin(c, b.weight) });
  if (q.op === 'read') { await D.markMessagesRead(c); return send(res, 200, { ok: true }); }
  throw httpError(400, 'Unknown action');
});
