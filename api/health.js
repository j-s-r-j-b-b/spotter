import { send } from './_lib/http.js';
import { storeKind } from './_lib/store.js';

export default function handler(req, res) {
  send(res, 200, { ok: true, app: 'spotter', store: storeKind, ai_inside: false });
}
