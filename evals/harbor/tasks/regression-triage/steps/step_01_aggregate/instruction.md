The Phoenix database contains a dataset named `qa-bot-golden` with two experiments.

Using the tools available to you, find both experiments and compute each experiment's
mean `correctness` score across all of its runs (the score is recorded as an experiment
run annotation named "correctness"). Identify which experiment has the LOWER mean.

Answer schema:
{"lower_experiment": "<experiment name>",
 "means": {"<experiment name>": <mean, 3 decimal places>, "<experiment name>": <mean>}}

End your reply with exactly one fenced ```json code block matching the schema above.
Do not include any other fenced json blocks in your reply.
