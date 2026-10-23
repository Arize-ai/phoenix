---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Skill, Read, Write]
runs: 3
tags: [phoenix-evals]
---
I already have an evaluator function and a set of 50 QA examples, each with a `question` and an `expected` answer. My task calls gpt-4o to answer the question. I want to run my task plus the evaluator over all 50 as a Phoenix experiment so I can see the aggregate scores in the Phoenix UI and compare runs. Write the script to `run_eval_experiment.py`.
