// Spotter's MCP endpoint (the "plug" a coach adds to Claude as a custom connector).
// Streamable HTTP, stateless: every POST carries one JSON-RPC message (or a batch) and gets a JSON reply.
// URL: /mcp/<coach's secret key>  (rewritten to /api/mcp?key=...)
import { readBody, send, query, baseUrl } from './_lib/http.js';
import { coachByMcpKey } from './_lib/domain.js';
import { TOOLS, INSTRUCTIONS, callTool } from './_lib/tools.js';

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const key = query(req).key;
  const coach = key ? await coachByMcpKey(key) : null;

  if (req.method === 'GET' && /text\/html/.test(req.headers.accept || '')) {
    res.statusCode = coach ? 200 : 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spotter connector</title><body style="font:16px/1.5 system-ui;max-width:560px;margin:60px auto;padding:0 20px;color:#12161b">
      <h2>${coach ? 'This is a Spotter connector link' : 'Unknown connector link'}</h2>
      <p>${coach ? 'Paste this address into Claude → Customize → Connectors → Add custom connector. It is not meant to be opened in a browser.' : 'This link is not valid (it may have been reset). Log in to Spotter and copy your link from “Connect Claude”.'}</p>
      <p><a href="/app/connect">Open Spotter</a></p></body>`);
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return send(res, 405, fail(null, -32000, 'Method not allowed. Spotter speaks MCP over HTTP POST.')); }
  if (!coach) return send(res, 404, fail(null, -32001, 'Unknown Spotter connector link. Copy your link from Spotter → Connect Claude.'));

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, fail(null, -32700, 'Parse error')); }
  const ctx = { coach, base: baseUrl(req) };
  const batch = Array.isArray(body);
  const out = [];
  for (const m of batch ? body : [body]) { const r = await handleMessage(m, ctx); if (r) out.push(r); }
  if (!out.length) { res.statusCode = 202; return res.end(); }
  return send(res, 200, batch ? out : out[0]);
}

async function handleMessage(m, ctx) {
  if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0') return fail(m?.id, -32600, 'Invalid request');
  if (m.method === undefined) return null; // a response from the client; nothing to do
  if (m.id === undefined || m.id === null) return null; // notification (e.g. notifications/initialized)
  try {
    switch (m.method) {
      case 'initialize': {
        const v = m.params?.protocolVersion;
        return ok(m.id, {
          protocolVersion: VERSIONS.includes(v) ? v : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'spotter', title: 'Spotter — coaching plans', version: '1.0.0' },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping': return ok(m.id, {});
      case 'tools/list': return ok(m.id, { tools: TOOLS.map(({ run, ...t }) => t) });
      case 'tools/call': {
        const r = await callTool(ctx, m.params?.name, m.params?.arguments);
        return r ? ok(m.id, r) : fail(m.id, -32602, `Unknown tool: ${m.params?.name}`);
      }
      case 'resources/list': return ok(m.id, { resources: [] });
      case 'resources/templates/list': return ok(m.id, { resourceTemplates: [] });
      case 'prompts/list': return ok(m.id, { prompts: [] });
      default: return fail(m.id, -32601, `Method not found: ${m.method}`);
    }
  } catch (e) {
    console.error(e);
    return fail(m.id, -32603, 'Internal error');
  }
}
