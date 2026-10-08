---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-evals]
---
I have a Python RAG support bot (OpenAI plus a vector store). It sometimes answers with claims that are not in the retrieved context. I want an evaluator that takes the retrieved context and the bot's answer and judges whether the answer is grounded in that context. I will run it over an exported dataframe of traces, so write it to be reusable. Put it in `groundedness_eval.py`.
