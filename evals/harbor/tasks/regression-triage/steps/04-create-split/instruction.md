GraphQL mutations are now enabled. Create a dataset split named "regressions" on
`qa-bot-golden` containing exactly the regressed examples you identified earlier
(the ones where the baseline experiment passed with correctness score 1 and the
candidate failed with correctness score 0).

Answer schema:
{"split_name": "regressions", "example_keys": ["ex-...", ...]}

End your reply with exactly one fenced ```json code block matching the schema above.
Do not include any other fenced json blocks in your reply.
