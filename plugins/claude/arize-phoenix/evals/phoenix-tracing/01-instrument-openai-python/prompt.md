---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
I have a Python app that calls the OpenAI SDK directly. I want its LLM calls traced to my Phoenix instance so I can see model, inputs, outputs, and token counts in the UI. Set up the instrumentation for me and write it to `tracing_setup.py` in the current directory. Do not run it.
