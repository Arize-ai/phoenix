---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Skill, Read]
runs: 3
tags: [phoenix-evals]
---
I have 500 machine-translation outputs and their reference translations in a CSV. I want a single corpus-level BLEU score over the whole set to report alongside my other metrics. Which library should I use and what is the exact call?
