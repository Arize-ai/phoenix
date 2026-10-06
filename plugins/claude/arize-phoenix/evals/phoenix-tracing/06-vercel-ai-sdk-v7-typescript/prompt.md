---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
I have a TypeScript app using the Vercel AI SDK (v7) with OpenAI. I set up Phoenix tracing by calling `register()`, but my `generateText` / `streamText` calls still don't show up as spans in Phoenix. Make the AI SDK's telemetry actually flow to Phoenix, and create the file `aiSdkTracing.ts` in the current directory with the complete setup — actually write the file, don't just print the code. Do not run it.
