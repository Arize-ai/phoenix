---
type: regex
target: {source: file, path: groundedness_eval.py}
match: not_contains
---
llm_classify|OpenAIModel|AnthropicModel|run_evals|\brails\s*=|phoenix\.evals\.legacy|default_templates
