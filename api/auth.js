// Coach accounts: sign up, log in, demo login, log out, who-am-I.
import { readBody, send, query, cookies, setCookie, baseUrl, handle, httpError } from './_lib/http.js';
import * as D from './_lib/domain.js';
import { DEMO, ensureDemo } from './_lib/seed.js';
import { storeKind } from './_lib/store.js';

const MAX_AGE = 60 * 60 * 24 * 30;

async function startSession(req, res, coach) {
  setCookie(req, res, 'sid', await D.createSession(coach.id), MAX_AGE);
  return send(res, 200, { coach: D.publicCoach(coach, baseUrl(req)) });
}

export default handle(async (req, res) => {
  const op = query(req).op;
  if (req.method === 'GET') {
    const coach = await D.coachFromSession(cookies(req).sid);
    if (!coach) throw httpError(401, 'Not logged in.');
    return send(res, 200, { coach: D.publicCoach(coach, baseUrl(req)), store: storeKind });
  }
  if (req.method !== 'POST') throw httpError(405, 'Method not allowed');
  const b = await readBody(req);
  if (op === 'signup') {
    if (String(b.email || '').toLowerCase() === DEMO.email) throw httpError(409, 'That is the shared demo account. Use “Try the demo” instead.');
    return startSession(req, res, await D.createCoach({ name: b.name, email: b.email, password: b.password }));
  }
  if (op === 'login') {
    if (String(b.email || '').trim().toLowerCase() === DEMO.email) await ensureDemo();
    const coach = await D.verifyLogin(String(b.email || '').trim(), String(b.password || ''));
    if (!coach) throw httpError(401, 'Email or password is incorrect.');
    return startSession(req, res, coach);
  }
  if (op === 'demo') return startSession(req, res, await ensureDemo());
  if (op === 'logout') {
    await D.endSession(cookies(req).sid);
    setCookie(req, res, 'sid', '', 0);
    return send(res, 200, { ok: true });
  }
  throw httpError(400, 'Unknown action');
});
