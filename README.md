# Spotter

**Your Claude writes the program. Spotter keeps clients on it.**

Spotter is a small business for online fitness and strength coaches. The coach connects their own Claude to Spotter through MCP.

- **Claude** does the thinking and writing. It designs plans, reviews progress and writes check-in messages.
- **Spotter** does everything else. It saves and versions plans, lets the coach edit them, gives each client a private phone link to train from, records every set, effort score and pain note, and keeps working after the chat ends.

**There is no AI inside Spotter.** There are no OpenAI, Anthropic or other AI keys anywhere in this codebase. Every word of every plan comes from the coach's Claude or from the coach.

## Try it

| What | Where |
|---|---|
| Live app | https://spotter-six-eta.vercel.app |
| Test login | `demo@spotter.fit` / `spotter-demo` (or click **Try the demo account**) |
| MCP link (demo account) | `https://spotter-six-eta.vercel.app/mcp/sk_WhUnBLjBjmLdWAa54UtpPozcboBVQBo7` |

Every coach account gets its own private link under **Connect Claude**. The demo account is shared: **Reset demo data** in the top bar restores the starting clients.

### Connect Spotter to Claude (about 1 minute)

1. Copy the MCP link above (or your own link from Spotter → **Connect Claude**).
2. In claude.ai, open **Settings → Customize → Connectors**, click **+ Add**, then **Add custom connector**. Spotter's **Connect Claude** page has a button that opens this dialog directly.
3. Name it **Spotter** and paste the link as the MCP server URL. Under Authentication, keep **No sign-in** (Claude detects it), then click **Add**. The link itself is the key, like a Zapier MCP link.
4. In a new chat, make sure Spotter is switched on in the tools menu. Ask:
   > Add a new client to Spotter: Priya Nair, 32, wants to lose fat and feel stronger, beginner, trains 3 days a week at home with dumbbells up to 15 kg. Her right knee hurts on deep squats. Then write her a 4-week plan.
5. Open Spotter. Priya and her plan are there. Edit any exercise and save. Open **Client view** to see what Priya sees on her phone, then tick off sets and finish the workout.
6. Back in Claude:
   > Review Rahul's progress in Spotter and adjust next week based on what he actually did. Then send him a short check-in message.

   Spotter highlights every exercise Claude changed and shows Claude's reason.

   Or start from Spotter: each client's page has an **Ask your Claude** strip. Its suggestions are picked by plain rules from the client's flags, such as pain, plan ending or missed workouts. Clicking one opens your own Claude (`claude.ai/new?q=…`) with the request already typed in. Spotter itself never calls an AI model.

Free Claude plans can add one custom connector. Pro, Max, Team and Enterprise can add more. On Team and Enterprise plans, an owner may need to allow custom connectors first.

## The MCP tools

| Tool | What it does |
|---|---|
| `list_clients` | Every client with their week, adherence and flags (pain, missed sessions, plan ending) |
| `add_client` | Creates a client and returns their private phone link |
| `save_plan` | Writes or replaces a full multi-week plan |
| `update_week` | Rewrites one week, with a note for the coach. Changed exercises are highlighted |
| `get_client_progress` | Planned vs. actual sets, reps and loads, effort, pain notes, comments, bodyweight |
| `send_message` | A message that shows on the client's phone, with seen/unseen status |
| `update_client` | Goal, equipment, injuries, notes |

The transport is MCP Streamable HTTP, stateless JSON-RPC over `POST /mcp/<key>`, and handles `initialize`, `tools/list`, `tools/call` and `ping`.

## How it's built

- `index.html` and `src/`: a Preact + htm single-page app with no build step. It has three surfaces: landing/auth, the coach dashboard (`/app`), and the client phone view (`/c/<token>`).
- `api/`: Vercel serverless functions. `mcp.js` is the Claude plug, `coach.js` the dashboard API (cookie login), `client.js` the phone API (token link), and `auth.js` handles sign-up and login.
- `api/_lib/domain.js`: all the business rules, including plan versioning, the change diffing that shows "Claude changed this", adherence, and flags. Pure code, no AI.
- Storage is Upstash Redis on Vercel, or a local JSON file in development.

Run locally: `node dev.mjs` → http://localhost:5200 (needs Node 20+).

Deploy: import the repo into Vercel and add **Upstash Redis** from the Vercel Marketplace (Storage tab). The `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables are picked up automatically.
