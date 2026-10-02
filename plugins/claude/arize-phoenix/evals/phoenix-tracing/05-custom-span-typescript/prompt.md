---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
In my TypeScript app I have an async function `lookupOrder(orderId)` that calls an external REST API. I want it to appear in Phoenix as a TOOL span following OpenInference conventions, with its input and output captured. Add the instrumentation and write it to `tracedTool.ts` in the current directory. Do not run it.
