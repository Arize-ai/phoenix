---
type: regex
target: {source: file, path: relevance_eval.py}
match: not_contains
---
OpenAIModel|llm_classify|\brails\s*=|default_templates|run_evals|phoenix\.evals\.legacy
