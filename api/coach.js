// Coach dashboard API (cookie login required).
import { readBody, send, query, baseUrl, handle, httpError } from './_lib/http.js';
import * as D from './_lib/domain.js';
import { requireCoach } from './_lib/auth.js';
import { seedDemo } from './_lib/seed.js';
import { storeKind } from './_lib/store.js';

export default handle(async (req, res) => {
  const coach = await requireCoach(req);
  const q = query(req);
  const base = baseUrl(req);
  const loadClient = async () => {
    const c = await D.getClient(coach.id, q.id);
    if (!c) throw httpError(404, 'Client not found.');
    return c;
  };
  const full = async (c) => { const logs = await D.getLogs(c.id); return { client: c, logs, summary: D.summarize(c, logs), phoneUrl: `${base}/c/${c.token}` }; };

  if (req.method === 'GET') {
    if (q.op === 'overview') {
      const docs = await D.listClientDocs(coach.id);
      const clients = await Promise.all(docs.map(async (c) => D.summarize(c, await D.getLogs(c.id))));
      return send(res, 200, { coach: D.publicCoach(coach, base), clients, activity: await D.listActivity(coach.id, 25), store: storeKind });
    }
    if (q.op === 'client') return send(res, 200, await full(await loadClient()));
    throw httpError(400, 'Unknown request');
  }

  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const b = await readBody(req);
  switch (q.op) {
    case 'add_client': { const c = await D.createClient(coach, b, 'coach'); return send(res, 200, { id: c.id }); }
    case 'profile': return send(res, 200, await full(await D.updateProfile(coach, await loadClient(), b, 'coach')));
    case 'plan': { const { client, changes } = await D.savePlan(coach, await loadClient(), b.plan || {}, 'coach', b.note || ''); return send(res, 200, { ...(await full(client)), changes }); }
    case 'reviewed': return send(res, 200, await full(await D.markWeekReviewed(await loadClient(), Number(q.week))));
    case 'message': { const c = await loadClient(); await D.addMessage(coach, c, b.text, 'coach'); return send(res, 200, await full(c)); }
    case 'delete': { await D.deleteClient(coach, await loadClient()); return send(res, 200, { ok: true }); }
    case 'rotate_key': return send(res, 200, { coach: D.publicCoach(await D.rotateMcpKey(coach), base) });
    case 'reset_demo': {
      if (!coach.demo) throw httpError(403, 'Only the demo account can be reset.');
      await seedDemo(coach);
      return send(res, 200, { ok: true });
    }
    default: throw httpError(400, 'Unknown action');
  }
});
