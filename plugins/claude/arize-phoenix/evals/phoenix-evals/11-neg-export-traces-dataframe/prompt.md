---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Skill, Read]
runs: 3
tags: [phoenix-evals]
---
My LangGraph agent already sends traces to Phoenix (project `support-agent`). I just want to pull the root spans into a pandas dataframe so I can eyeball the inputs and outputs in a notebook. I'm not scoring anything or setting up evals, I only want to look at the data. What's the Python code?
