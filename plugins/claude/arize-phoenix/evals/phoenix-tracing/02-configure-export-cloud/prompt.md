---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
My Python app is already instrumented locally. I now need to point its tracing at our hosted Phoenix Cloud instance at `https://app.phoenix.arize.com` using our Phoenix API key. The API key must not be hardcoded in the source — our repo is public. Show me the setup and write it to `phoenix_export.py` in the current directory. Do not run it.
