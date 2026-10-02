---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
I have a plain Python function `get_weather(city: str) -> str` that calls a weather API. It does not show up in Phoenix because nothing instruments it. I want it to appear as a TOOL span following OpenInference conventions, capturing its input and output. Add the instrumentation and write the result to `weather_tool.py` in the current directory. Do not run it.
