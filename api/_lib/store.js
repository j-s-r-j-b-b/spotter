// Tiny key-value store: Upstash Redis (REST) when configured on Vercel, a local JSON file in development.
import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeKind = URL_ && TOKEN ? 'redis' : process.env.VERCEL ? 'temporary' : 'local-file';
const P = 'sp:';

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}

// Local file: { key: { v, exp } }
const FILE = process.env.VERCEL ? '/tmp/spotter-store.json' : path.join(process.cwd(), '.data', 'store.json');
const readFile = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const writeFile = (d) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d)); };
const val = (d, k) => { const e = d[k]; if (!e) return undefined; if (e.exp && e.exp < Date.now()) { delete d[k]; return undefined; } return e.v; };

export async function get(key) {
  if (storeKind === 'redis') { const v = await redis(['GET', P + key]); return v == null ? null : JSON.parse(v); }
  return val(readFile(), key) ?? null;
}

export async function set(key, value, ttlSec) {
  if (storeKind === 'redis') return redis(ttlSec ? ['SET', P + key, JSON.stringify(value), 'EX', ttlSec] : ['SET', P + key, JSON.stringify(value)]);
  const d = readFile(); d[key] = { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 }; writeFile(d);
}

// Set only if the key does not exist yet. Returns true when it was set.
export async function setNX(key, value) {
  if (storeKind === 'redis') return (await redis(['SET', P + key, JSON.stringify(value), 'NX'])) === 'OK';
  const d = readFile(); if (val(d, key) !== undefined) return false;
  d[key] = { v: value, exp: 0 }; writeFile(d); return true;
}

export async function del(...keys) {
  keys = keys.filter(Boolean);
  if (!keys.length) return;
  if (storeKind === 'redis') return redis(['DEL', ...keys.map((k) => P + k)]);
  const d = readFile(); keys.forEach((k) => delete d[k]); writeFile(d);
}

export async function mget(keys) {
  if (!keys.length) return [];
  if (storeKind === 'redis') return (await redis(['MGET', ...keys.map((k) => P + k)])).map((v) => (v == null ? null : JSON.parse(v)));
  const d = readFile(); return keys.map((k) => val(d, k) ?? null);
}

// Capped list, newest first.
export async function lpush(key, value, max = 60) {
  if (storeKind === 'redis') { await redis(['LPUSH', P + key, JSON.stringify(value)]); return redis(['LTRIM', P + key, 0, max - 1]); }
  const d = readFile(); const l = val(d, key) || []; l.unshift(value); d[key] = { v: l.slice(0, max), exp: 0 }; writeFile(d);
}

export async function lrange(key, n = 30) {
  if (storeKind === 'redis') return (await redis(['LRANGE', P + key, 0, n - 1])).map((v) => JSON.parse(v));
  return (val(readFile(), key) || []).slice(0, n);
}
