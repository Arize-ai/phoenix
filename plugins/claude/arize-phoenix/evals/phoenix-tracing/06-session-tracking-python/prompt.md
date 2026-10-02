---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
My multi-turn chatbot in Python is already traced to Phoenix, but every turn shows up as a separate, unrelated trace. I want all the turns of one conversation grouped together as a session in Phoenix so I can follow a whole conversation. Show me how and write it to `session_tracing.py` in the current directory. Do not run it.
