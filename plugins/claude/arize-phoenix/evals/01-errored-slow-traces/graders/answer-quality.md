---
type: llm
focus: last_message
weight: 1
---
The user asked for terminal commands using the `px` CLI to find errored, slow traces and their exception messages. The mechanical checks (error predicate, latency threshold, time window, `exception.message`) are graded separately by regex; you grade only the three claims below. Each must hold for a pass.

1. The primary path is the `px` CLI: the main flow uses `px trace list`, `px trace get`, or `px api graphql` in copy-pasteable code blocks. A response whose main answer is the Python or TypeScript SDK, curl against REST, or the web UI fails. Mentioning any of those as an aside is fine.
2. The response selects the `support-bot` project somewhere in the main flow: `--project support-bot`, `export PHOENIX_PROJECT=support-bot`, `px project get support-bot`, or `getProjectByName(name: "support-bot")` all count. Fail only if the response never selects the project and relies on the default project or an arbitrary `projects(first: 1)` for the main flow.
3. The response tells the user, at least briefly, what the output of the commands contains, so they know what they are looking at. A one-line description or a step header that names the result is enough.
