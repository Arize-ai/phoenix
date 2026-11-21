The `support-qa` dataset in Phoenix at http://127.0.0.1:6006 holds support questions.
Each example's output has an `expected` field with a fact the answer must contain.

Run the support bot in `/app` over every example as a Phoenix experiment. Score each
answer with an evaluator named `contains_expected`: 1 when the answer contains the
`expected` text, ignoring letter case, and 0 otherwise. `README.md` explains how to run
the bot locally.
