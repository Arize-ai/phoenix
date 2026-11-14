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
| Project `refund-decisions` | 80 traces, one per refund request. The root `refund-agent` span has the customer's request and the agent's reply, with its decision, amount, and reason. Its children are a `get_order` tool call (item, category, price, shipping paid, final-sale flag, days since delivery, condition, opened flag), a `search_policies` retriever with the 4 or 5 policy passages that apply, and the LLM call. |
| `human_review` annotations | On 40 of the traces: `compliant` or `noncompliant`, with a one-line reason such as "Not damaged, so shipping isn't refundable. Should be $59.99, not $66.94." |
| `policy_compliant` annotations | On all 80 traces, from the starting judge. |
| `/app/evals/policy_judge.py` | The starting judge, on `gpt-5-nano`. It sees only the reply and asks whether it's polite and mentions the 30-day return window. It skips traces that already have a `policy_compliant` annotation. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run its judge. |

The refund policy has rules that interact:

- Gift cards and final-sale items are never refunded, even when damaged.
- Damage reported within 14 days of delivery gets the item price plus shipping, with no
  restocking fee.
- Otherwise, requests more than 30 days after delivery are declined.
- Every other refund is the item price only, minus 15% for opened electronics.

A trace is compliant when the agent's decision and amount follow the policy for that
order. Of the 80 traces, 32 are noncompliant, across 10 kinds of mistake.

## How it's graded

`reward` is 1 only if both checks pass. Each check reads the latest `policy_compliant`
annotation on each trace. It passes when the annotations cover at least 95% of the
traces, and the judge catches at least 80% of the compliant traces and at least 80% of
the noncompliant ones. Checking each class separately means a judge that says `pass` to
everything fails. Labels count by meaning, so `compliant` works as well as `pass`.

| Check | Which traces | What passes |
| --- | --- | --- |
| `production` | The 40 traces without a human review (24 compliant, 16 noncompliant). | At least 80% recall on each class. |
| `new_traces` | 40 new traces the verifier adds (24 compliant, 16 noncompliant). It then runs `python evals/policy_judge.py` as the agent user. | At least 80% recall on each class. |

The new traces use other products, prices, and reply wording, so a judge tuned to the
40 reviewed traces fails them.

During the rerun, every model request goes through a local recorder. It refuses any
model except `gpt-5-nano` with a 403, the way the nightly key would. A small model
like this one gets the labels right only when the prompt is clear and carries the right
evidence, so prompt quality shows up in `reward`.

How some approaches score in local runs:

| Approach | `production` recall (compliant, noncompliant) | `new_traces` recall | Reward |
| --- | --- | --- | --- |
| Do nothing | 0.62, 0.50 | 0.46, 0.56 | 0 |
| Copy reviewers' labels where they exist, starting judge elsewhere | 0.62, 0.50 | 0.46, 0.56 | 0 |
| Good judge, but run only on traces without an annotation | 0.62, 0.50 (old labels stay) | 1.0, 1.0 | 0 |
| Reference solution | 1.0, 0.94 | 1.0, 0.94 | 1 |

### Also reported

These don't change `reward`. The [suite README](../README.md#what-a-run-reports)
explains each one.

- `turns`, `tool_calls`, and a `loaded_<skill>` flag for each skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of judge requests whose prompt meets the rubric. For this
  task, the rubric grader is told that a `policy_compliant` judge needs the order record
  (category, price, shipping paid, final-sale flag, days since delivery, condition,
  opened flag), the policy passages that apply, and the reply with its decision and
  amount. Code can't fully check it, so a model call is fine.

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Finding out why the judge disagrees before changing it | The starting judge reads only the reply. An agent that tweaks its wording without reading the disagreements keeps missing what the reviewers caught, and fails both checks. |
| Giving the judge the evidence it needs | Many mistakes show only in the order record: days since delivery, the final-sale flag, whether an electronic item was opened. A judge without the order record and policy can't catch them. |
| Checking the amount, not just the decision | About half the mistakes are wrong amounts: a skipped or wrong restocking fee, or shipping refunded when it shouldn't be. |
| Checking the customer's claims against the record | Some customers say they got the item "about two weeks ago". It's true for some and false for others, so only the order record's days since delivery decides. |
| Measuring agreement, and not overfitting to it | The request asks the agent not to tune to the 40 reviews. The new traces use different products and wording, so a judge that memorized the reviewed cases fails `new_traces`. |
| Rescoring the whole project | Every trace starts with an old annotation, and the starting script skips annotated traces. Unless the agent rescores everything, the old labels stay and `production` fails. Logging an annotation again with the same name replaces the old one. |
| Keeping the nightly job working | The verifier runs the script at the same path, on the pinned model, with no arguments. A judge that needs a flag, a different model, or a manual step fails `new_traces`. |
| Not copying the reviewers | The graded traces have no review, so copying `human_review` labels doesn't help. |

## Known limits

- The starting annotations come from a deterministic stand-in for the starting prompt
  (`starting_judge_label` in `fixture/build.py`): `pass` when the reply mentions the
  30-day window. One run of the real starting prompt agreed with it on all 80 production traces and 38 of 40 new ones.
- The reference judge scores at least 0.94 on both checks, so the 80% bar leaves room. Each kind of
  mistake has at most 2 cases in each check, so a judge can miss one whole kind and still
  pass.
- The policy rules are exact, so a code check that applies them to the order record and
  reads the amount from the reply can also pass. That's a legitimate judge.
- The replies come from templates. Each phrase that states a decision, a fee, or a date
  claim appears in both compliant and noncompliant replies, so only the order record
  decides the label. The new traces' different wording limits how far pattern matching
  gets.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 80 traces, the reviews, and the starting annotations) and `tests/truth.json` (labels for the 40 traces without reviews, plus the 40 new traces and their labels). It's deterministic; rerun it after editing. |
| `workdir/evals/policy_judge.py` | The starting judge, copied to `/app/evals/`. |
| `tests/test.py` | The verifier. |
| `solution/policy_judge.py` | The reference judge: an LLM judge on `gpt-5-nano` that sees the order record, the policy passages, the request, and the reply. `--rescore` scores every trace again. `solution/solve.sh` installs it at the nightly path and runs it with `--rescore`. |
