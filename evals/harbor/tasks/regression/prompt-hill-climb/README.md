# prompt-hill-climb

Create a dataset evaluator, iterate on prompt until a prompt task passes over a dataset.

## Fixture

Phoenix dataset `banking_saas_dataset_clean`, with 28 examples and nothing else. It is a
text-to-SQL safety dataset for a banking assistant: each example is a customer's natural
language question, and the reference is either the SQL query that answers it, scoped to
that customer's own `user_id`, or a canned refusal. About half the questions are legitimate
requests about balances, transactions, and payments; the rest try to read other users'
data, inject SQL, write to the database, or escalate privileges, and must be refused.

- `input`: `{"messages": [{"role": "user", "content": <question>}]}`
- `output`: `{"reference": <SQL or refusal>}`
- `metadata`: `{"id": 1..28, "user_id": "usr_..."}`

## Steps and verifiers

1. `step_01_create_evaluator`
   - Instruction: attach an exact-match evaluator (ignoring fences and whitespace) to the dataset.
   - Verifier:
     - `one_evaluator_attached`: exactly one evaluator is bound to the dataset.
     - `evaluator_is_exact_match`: for every example, the evaluator passes the reference as
       is, fenced, and padded, and fails one changed token and an empty output. Probes run
       through Phoenix's `evaluatorPreviews` mutation on the evaluator's own sandbox. LLM
       evaluators fail outright.
     - `no_experiments_yet`: no experiments exist and the dataset still has 28 examples.
2. `step_02_hill_climb`
   - Instruction: baseline with the empty prompt, then one experiment per prompt until all 28 pass.
   - Verifier:
     - `first_experiment_imperfect`: at least two experiments, and the first scores below 1.0.
     - `all_experiments_fully_scored`: every experiment has 28 runs, each scored by the evaluator.
     - `last_experiment_passes_all`: the last experiment has no errored runs and 28 passes.
     - Also writes `first_score`, `last_score`, and `best_score`, and snapshots the
       experiments to `/var/lib/phoenix-eval/state/step_02.json` for step 3.
3. `step_03_compare`
   - Instruction: compare first and last experiments, show moved examples, record the learning on the last one.
   - Verifier:
     - `no_new_experiments_or_scores`: experiments, run counts, and annotation count match the step 2 snapshot.
     - `reply_names_both_experiments`: the final reply names the first and last experiment.
     - `reply_links_comparison_view`: the reply links `/datasets/<id>/compare?experimentId=...` for exactly that pair.
     - `learning_recorded_on_last_experiment`: the last experiment's metadata gained a dated entry and lost no keys.
     - `judge_accepts_comparison`: an LLM judge (`PHOENIX_EVAL_JUDGE_MODEL`, default
       `claude-sonnet-5`) confirms the reply states matching scores, compares latency and
       cost, cites real moved examples, and gives a verdict.
