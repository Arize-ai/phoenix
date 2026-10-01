---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-evals]
---
I already have an evaluator function and a set of 50 QA examples, each with a `question` and an `expected` answer. I want to run my task plus the evaluator over all 50 as a Phoenix experiment so I can see the aggregate scores in the Phoenix UI and compare runs. Show me how, and write it to `run_eval_experiment.py` in the current directory. Do not run it.
