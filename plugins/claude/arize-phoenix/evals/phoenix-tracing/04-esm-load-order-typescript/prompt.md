---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
I'm instrumenting a TypeScript app that uses ESM (`"type": "module"`, `import` syntax) and the OpenAI SDK. I called `register()` and then imported and used OpenAI, but no spans show up in Phoenix. Set it up so OpenAI calls are actually traced under ESM, and write it to `instrumentation.ts` in the current directory. Do not run it.
