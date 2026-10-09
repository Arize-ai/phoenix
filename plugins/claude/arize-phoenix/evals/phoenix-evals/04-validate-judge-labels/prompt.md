---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-evals]
---
I built an LLM judge for answer correctness. I have 80 examples that two of our analysts labeled by hand as pass or fail, and I have run my judge over the same 80 so I have its predictions. Before I trust the judge in production, I want to measure how well it agrees with the human labels and decide whether it is good enough. Walk me through what to compute, and drop it in `validate_judge.py`.
