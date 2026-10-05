---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-tracing]
---
I call a niche LLM provider ("acme-llm") over a plain HTTP request — there is no auto-instrumentor for it. I have a function `call_acme(messages: list[dict]) -> dict` that returns `{"text": ..., "model": ..., "prompt_tokens": ..., "completion_tokens": ...}`. I want each call to show up in Phoenix as a proper LLM span: the model name, the input and output messages, and the prompt/completion/total token counts, following OpenInference conventions so Phoenix renders it correctly. Instrument the function and write it to `acme_llm_span.py` in the current directory. Do not run it.
