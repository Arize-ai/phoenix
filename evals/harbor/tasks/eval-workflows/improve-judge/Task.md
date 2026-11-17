# improve-judge

The user has an LLM judge that checks whether a support agent's refund decisions follow
policy, and it disagrees with their human reviewers too often. The agent has to improve
the judge, rescore every trace with it, and leave a script that works on next week's
traffic. The verifier checks the judge's labels on traces without reviews, then runs the
script on new traces.

## The request

The agent gets `instruction.md` word for word:

> Our `policy_compliant` judge (`/app/evals/policy_judge.py`) disagrees with our reviewers too often to be useful. It checks whether the refund decisions our support agent makes follow our refund policy, and the agent's traces are in Phoenix under the `refund-decisions` project. Our reviewers' verdicts are on 40 of those traces as `human_review` annotations.
>
> Can you improve the judge so it agrees with them, and rerun it over the whole project so every trace has a fresh `policy_compliant` annotation labeled `pass` or `fail`? Keep the script path, the annotation name, and the `gpt-5-nano` model: our nightly job runs `python evals/policy_judge.py` on new traces with an API key that can only call `gpt-5-nano`. The judge has to work on next week's traffic too, so don't tune it to these 40 traces.

The request doesn't tell the agent how to avoid overfitting. Splitting the 40 reviews
into a development and a test set is one good way, and it's up to the agent.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `refund-decisions` | 80 traces, one per refund request. The root `refund-agent` span has the customer's request and the agent's reply, with its decision, amount, and reason. Its children are a `get_order` tool call (item, category, price, shipping paid, final-sale flag, days since delivery, condition, opened flag, membership), a `search_policies` retriever with the 4 policy passages that best match the order, and the LLM call. |
| `human_review` annotations | On 40 of the traces: `compliant` or `noncompliant`, with a one-line reason such as "Not damaged, so shipping isn't refundable. Should be $59.99, not $66.94." None of the reviewed traces is from an Acme Plus member. |
| `policy_compliant` annotations | On all 80 traces, from the starting judge. |
| `/app/evals/policy_judge.py` | The starting judge, on `gpt-5-nano`. It sees only the reply and asks whether it's polite and mentions the 30-day return window. It skips traces that already have a `policy_compliant` annotation. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run its judge. |

The refund policy has rules that interact:

- Gift cards and final-sale items are never refunded, even when damaged.
- Damage reported within 14 days of delivery gets the item price plus shipping, with no
  restocking fee.
- Otherwise, requests more than 30 days after delivery are declined, or more than 60
  days for Acme Plus members.
- Every other refund is the item price only, minus 15% for opened electronics. Plus
  members don't pay the 15%.

The Plus rules are in one passage, `plus-members`, which `search_policies` retrieves
only for a Plus member's order. No reviewed trace retrieves it. Six unreviewed traces
do, so the agent can find it in the project, and the reference judge reads it there.

A trace is compliant when the agent's decision and amount follow the policy for that
order. Of the 80 traces, 32 are noncompliant, across 13 kinds of mistake. Three of
those kinds involve the Plus rules: a member declined inside the 60-day window, a member
charged the restocking fee, and a refund past 30 days to a customer who says they're a
member but isn't one. The new traces add a fourth: the restocking fee waived for a
customer who isn't a member.

## How the data was made

`fixture/build.py` generates every trace from hand-written templates: the policy
passages, products, prices, customer names, request and reply sentences, review notes,
and the number of traces of each kind. A fixed random seed, 31 for the production
traces and 47 for the new traces, shuffles the kinds and picks each order's facts and
sentence variants within the kind's ranges. No real model output is included. The store
and customers are invented, and no public dataset or user data is used.

Each kind either follows the refund policy or breaks one rule on purpose. A trace is
compliant when the agent's refund matches, to the cent, what `policy_outcome` computes
from the order record. The review notes quote the same amounts.

Four checks cover the data:

- `build.py` asserts that every trace's label matches `policy_outcome`, so a compliant
  kind never grants a wrong amount and a noncompliant kind never grants the right one.
- The seeder, `environments/fixtures/seed_phoenix.py`, waits until every span is in
  Phoenix before it logs the annotations.
- On November 13, 2026, GPT-6 Astra reviewed the data and labels read-only through
  Codex. It found that wrong denials gave reasons no correct denial used, such as
  opened items not being returnable. Commit 5cec5f25bd makes wrong denials cite the
  same reasons as correct ones, and bdefa98ab3 does the same for approval and
  date-claim wording.
- In Docker, the reference solution scores 1 and a do-nothing agent scores 0. The
  tables in the next section show what other approaches score.

## How it's graded

`reward` is 1 only if both checks pass. Each check reads the latest `policy_compliant`
annotation on each trace. It passes when the annotations cover at least 95% of the
traces, and the judge catches at least 80% of the compliant traces and at least 80% of
the noncompliant ones. Checking each class separately means a judge that says `pass` to
everything fails. Labels count by meaning, so `compliant` works as well as `pass`.

| Check | Which traces | What passes |
| --- | --- | --- |
| `production` | The 40 traces without a human review (24 compliant, 16 noncompliant). 7 involve the Plus rules: 6 from members, and 1 from a customer who says they're a member but isn't. | At least 80% recall on each class. |
| `new_traces` | 40 new traces the verifier adds (24 compliant, 16 noncompliant). 18 involve the Plus rules: 15 from members, and 3 from customers who say they're members but aren't. It then runs `python evals/policy_judge.py` as the agent user. | At least 80% recall on each class. |

The new traces use other products, prices, and reply wording, and many more of them
come from Acme Plus members, so a judge tuned to the 40 reviewed traces fails them.

During the rerun, every model request goes through a local recorder. It refuses any
model except `gpt-5-nano` with a 403, the way the nightly key would. A small model
like this one gets the labels right only when the prompt is clear and carries the right
evidence, so prompt quality shows up in `reward`.

How some approaches score in local runs:

| Approach | `production` recall (compliant, noncompliant) | `new_traces` recall | Reward |
| --- | --- | --- | --- |
| Do nothing | 0.46, 0.56 | 0.29, 0.69 | 0 |
| Copy reviewers' labels where they exist, starting judge elsewhere | 0.46, 0.56 | Same as doing nothing | 0 |
| Good judge, but run only on traces without an annotation | 0.46, 0.56 (old labels stay) | 1.0, 1.0 | 0 |
| Reference judge, but with the 8 passages from the reviewed traces in place of each trace's own | 0.88, 0.88 | 0.71, 0.62 | 0 |
| Code check with the rules the reviewed traces show | 0.88, 0.88 | 0.71, 0.62 | 0 |
| Code check with every rule, Plus rules included | 1.0, 1.0 | 1.0, 1.0 | 1 |
| Reference solution | 1.0, 1.0 in each of 3 runs | 1.0, 1.0 in each of 3 runs | 1 |

In the pilot, before the Plus rules were added, all four agents' judges scored 1.0 on
both classes in both checks. Here are their saved judges replayed on this task, three
times each. Every miss is on a Plus kind.

| Pilot agent | How its judge works | `production` recall | `new_traces` recall | Reward |
| --- | --- | --- | --- | --- |
| Fable, no skills | LLM judge with the order record and a hard-coded copy of the passages, which each trace's own passages replace or add to | 1.0, 1.0 | 1.0, 1.0 | 1 |
| Fable, with skills | LLM judge with the order record and a hard-coded policy; never reads the passages | 0.88, 0.88 | 0.71, 0.62 (0.71, 0.69 once) | 0 |
| Haiku, no skills | LLM judge with the order record and a hard-coded list of the 8 passages | 0.88, 0.88 | 0.71, 0.69 | 0 |
| Haiku, with skills | LLM judge with the order record and each trace's own passages | 1.0, 1.0 | 1.0, 1.0 | 1 |

### Also reported

These don't change `reward`. The [suite README](../README.md#what-a-run-reports)
explains each one.

- `turns`, `tool_calls`, and a `loaded_<skill>` flag for each skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of judge requests whose prompt meets the rubric. For this
  task, the rubric grader is told that a `policy_compliant` judge needs the order record
  (category, price, shipping paid, final-sale flag, days since delivery, condition,
  opened flag, membership), the policy passages that apply, and the reply with its
  decision and amount. Code can't fully check it, so a model call is fine.

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Finding out why the judge disagrees before changing it | The starting judge reads only the reply. An agent that tweaks its wording without reading the disagreements keeps missing what the reviewers caught, and fails both checks. |
| Giving the judge the evidence it needs | Many mistakes show only in the order record: days since delivery, the final-sale flag, whether an electronic item was opened. A judge without the order record and policy can't catch them. |
| Reading the policy the agent retrieved | The Plus rules are only in the `plus-members` passage, which no reviewed trace retrieves. A judge that hard-codes the policy as the reviewed traces show it treats members like everyone else. It passes `production`, where 7 of the 40 graded traces involve the Plus rules, and fails `new_traces`, where 18 do. A judge that reads each trace's passages gets them right. |
| Applying two rules at once | The Plus cases turn on the membership field together with the days since delivery or the opened-electronics fee. A member's refund on day 45, or a member's opened headphones refunded in full, is compliant. The same reply for a customer who isn't a member is not. |
| Checking the amount, not only the decision | About half the mistakes are wrong amounts: a skipped or wrong restocking fee, or shipping refunded when it shouldn't be. |
| Checking the customer's claims against the record | Some customers say they got the item "about two weeks ago", or that they're an Acme Plus member. Each claim is true for some and false for others, so only the order record's days since delivery and membership decide. |
| Measuring agreement, and not overfitting to it | The request asks the agent not to tune to the 40 reviews. The new traces use different products and wording, so a judge that memorized the reviewed cases fails `new_traces`. |
| Rescoring the whole project | Every trace starts with an old annotation, and the starting script skips annotated traces. Unless the agent rescores everything, the old labels stay and `production` fails. Logging an annotation again with the same name replaces the old one. |
| Keeping the nightly job working | The verifier runs the script at the same path, on the pinned model, with no arguments. A judge that needs a flag, a different model, or a manual step fails `new_traces`. |
| Not copying the reviewers | The graded traces have no review, so copying `human_review` labels doesn't help. |

## Known limits

- The starting annotations come from a deterministic stand-in for the starting prompt
  (`starting_judge_label` in `fixture/build.py`): `pass` when the reply mentions the
  30-day window. The rerun scores the new traces with the real starting prompt, which
  labels a few of them differently: 0.29 and 0.69 recall in one run, against 0.33 and
  0.62 for the stand-in.
- In six local runs, the reference judge never scored below 0.94 on either class in
  either check, so the 80% bar leaves room. Most kinds of mistake have 1 or 2 cases in each
  check, so a judge can miss one whole kind and still pass. The Plus kinds are the
  exception on purpose: a judge that misses all of them fails `new_traces`.
- The Plus rules are visible only in the passages of 6 unreviewed traces. A judge that
  hard-codes every distinct passage in the project, not only the ones on reviewed
  traces, gets them and passes. That's fair: it covers the whole policy the project
  shows. Both pilot agents whose judges failed the replay listed the distinct passages
  across all 80 traces before writing them into the prompt, so with this fixture they
  would likely have copied the `plus-members` passage too. The replays show what the
  trap catches, not what those agents would do now.
- The policy rules are exact, so a code check that applies them to the order record and
  reads the amount from the reply can also pass. That's a legitimate judge.
- The replies come from templates. Each phrase that states a decision, a fee, a date
  claim, or a membership claim appears in both compliant and noncompliant replies, so
  only the order record decides the label. The one exception is "Gift cards aren't
  refundable", which is always right because it appears only when the record shows a
  gift card. The new traces' different wording limits how
  far pattern matching gets.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/phoenix_seed.json` (the 80 traces, the reviews, and the starting annotations) and `tests/truth.json` (labels for the 40 traces without reviews, plus the 40 new traces and their labels). `COMPLIANT` and `NONCOMPLIANT` set how many traces of each kind go to the reviewed, unreviewed, and new traces. It's deterministic; rerun it after editing. |
| `workdir/evals/policy_judge.py` | The starting judge, copied to `/app/evals/`. |
| `tests/test.py` | The verifier. |
| `solution/policy_judge.py` | The reference judge: an LLM judge on `gpt-5-nano` that sees the order record, the trace's own policy passages, the request, and the reply. Its prompt lists the general rules and says a passage for a group of customers, such as members, overrides them. `--rescore` scores every trace again. `solution/solve.sh` installs it at the nightly path and runs it with `--rescore`. |
