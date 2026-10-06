---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
I'm setting up Phoenix tracing for my Python app and need it to send its traces to our hosted Phoenix Cloud instance at `https://app.phoenix.arize.com` using our Phoenix API key. The API key must not be hardcoded in the source — our repo is public. Set up the Phoenix tracing and export, and create the file `phoenix_export.py` in the current directory with the complete setup — actually write the file, don't just print the code. Do not run it.
