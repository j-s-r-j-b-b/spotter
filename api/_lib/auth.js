import { cookies, httpError } from './http.js';
import { coachFromSession } from './domain.js';

export async function requireCoach(req) {
  const coach = await coachFromSession(cookies(req).sid);
  if (!coach) throw httpError(401, 'Please log in.');
  return coach;
}
