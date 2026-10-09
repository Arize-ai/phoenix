---
type: regex
target: {source: file, path: relevance_eval.py}
match: not_contains
---
OpenAIModel|llm_classify|\brails\s*=|_PROMPT_TEMPLATE|run_evals|phoenix\.evals\.legacy
