Following up on your comparison of the two `qa-bot-golden` experiments: find every
dataset example where the baseline experiment passed (correctness score 1) but the
lower-scoring candidate failed (correctness score 0). Each dataset example has an
`example_key` field in its metadata — report those keys. Then state, in one sentence,
what the regressed examples' inputs have in common.

Answer schema:
{"regressed_example_keys": ["ex-...", ...], "pattern": "<one sentence>"}

End your reply with exactly one fenced ```json code block matching the schema above.
Do not include any other fenced json blocks in your reply.
