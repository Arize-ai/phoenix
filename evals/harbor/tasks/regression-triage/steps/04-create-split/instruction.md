In dataset `qa-bot-golden`, determine the examples where `candidate-v2` regressed
relative to `baseline-gpt4o` (baseline correctness score 1, candidate correctness
score 0). Then create a dataset split named "regressions" on `qa-bot-golden` containing
exactly those examples. GraphQL mutations are enabled for this task.

Answer schema:
{"split_name": "regressions", "example_keys": ["ex-...", ...]}

End your reply with exactly one fenced ```json code block matching the schema above.
Do not include any other fenced json blocks in your reply.
