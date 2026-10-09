---
type: regex
target: {source: file, path: groundedness_eval.py}
match: not_contains
---
llm_classify|OpenAIModel|AnthropicModel|run_evals|rails\s*=|phoenix\.evals\.legacy|_PROMPT_TEMPLATE
