# ts-span-generator

Generates deterministic, realistic agent trace data and sends it to a Phoenix
instance via OTLP. Useful for developing and testing UI features against
message-heavy LLM spans without needing model credentials or a live agent.

The generated data is an "incident copilot" SRE conversation:

- **Trace 1** — a full incident investigation: 10 LLM spans whose input
  message history grows from 2 to 20 messages, 6 tool calls
  (`search_logs`, `get_metrics`, `get_config_diff`, `create_incident_action`)
  with JSON arguments and results, ending in a long Markdown postmortem
  summary as the final output message.
- **Trace 2** — a short 3-message exchange for contrast.

Both traces share a session (`incident-2026-08-06-checkout`) and a `user.id`.
The conversation text deliberately includes near-miss vocabulary
(`timeout` / `timed out` / `time-out`, `authentication` / `auth-service` /
`401 Unauthorized`, `database` / `databse` typo, `connection pool` /
`conn pool`, `rollback` / `rolled back`), which makes the data useful for
exercising search and text-matching features.

Content is fixed; timestamps are relative to the current time so the data
always appears in recent time-range filters.

## Usage

Prerequisites: Node.js >= 22.12 and a running Phoenix
(default `http://localhost:6006`).

```bash
npm install
npm start
# or against a non-default endpoint:
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006 npm start
```

If your Phoenix has authentication enabled, also set `PHOENIX_API_KEY`.

The data lands in the **`incident-copilot`** project by default (override
with `PHOENIX_PROJECT_NAME`): 19 spans per run (2 AGENT, 11 LLM, 6 TOOL).

## Verifying

```bash
curl -s "http://localhost:6006/v1/projects/incident-copilot/spans?limit=50" \
  | node -e "let b='';process.stdin.on('data',c=>b+=c).on('end',()=>console.log(JSON.parse(b).data.length,'spans'))"
```
