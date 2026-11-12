# improve-judge

Improve an LLM judge until it agrees with human reviews, rescore the project with it,
and leave it working on traffic it never saw. Workflow: **improve an LLM judge**.

## The request

The agent receives `instruction.md` verbatim:

> Our `policy_compliant` judge (`/app/evals/policy_judge.py`) disagrees with our reviewers too often to be useful. It checks whether the refund decisions our support agent makes follow our refund policy, and the agent's traces are in Phoenix under the `refund-decisions` project. Our reviewers' verdicts are on 40 of those traces as `human_review` annotations.
>
> Can you improve the judge so it agrees with them, and rerun it over the whole project so every trace has a fresh `policy_compliant` annotation labeled `pass` or `fail`? Keep the script path and annotation name: our nightly job runs `python evals/policy_judge.py` on new traces, and we'll check it against reviews of traffic you haven't seen.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `refund-decisions` | 80 traces, one per refund request. Root `refund-agent` span (input: the customer's request; output: the agent's reply with its decision, amount, and reason). Children: `get_order` tool (item, category, price, shipping paid, final-sale flag, days since delivery, condition, opened flag), `search_policies` retriever (the 4 or 5 policy passages that govern the order), and the LLM call. |
| `human_review` annotations | On the root span of 40 traces: `compliant` or `noncompliant` (annotator kind `HUMAN`), with a one-line reason such as "Not damaged, so shipping isn't refundable. Should be $79.00, not $85.95." |
| `policy_compliant` annotations | On the root span of all 80 traces, from the starting judge (`pass` or `fail`, annotator kind `LLM`). |
| `/app/evals/policy_judge.py` | The starting judge. Its prompt sees only the reply and asks whether it's polite and mentions the 30-day return window. It scores only traces that don't have a `policy_compliant` annotation yet. |
| Model access | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. |

The policy has interacting rules. Gift cards and final-sale items are never refunded,
even when damaged. Damage reported within 14 days of delivery gets the item price plus
shipping, with no restocking fee. Otherwise, requests more than 30 days after delivery
are declined, and every other refund is the item price only, minus 15% for opened
electronics.

Each trace's label says whether the agent's decision and amount follow the policy for
that order. Of the 80 traces, 32 are noncompliant across 10 kinds of violation, and
every kind except one appears in both the reviewed and the unreviewed halves. The
single miscalculated restocking fee is unreviewed. Compliant replies
state accurate reasons, so the label never depends on wording.

## How it's graded

`reward` is 1 only when both checks pass. A check passes when the latest
`policy_compliant` annotation on each trace covers at least 95% of the traces and
catches at least 80% of compliant decisions **and** of noncompliant ones. The verifier
reads annotations on any span of a trace, or on the trace itself. Labels map to pass or
fail by meaning (`pass`, `compliant`, ... versus `fail`, `noncompliant`, ...).

| Check | Traces | Minimum recall on each class |
| --- | --- | --- |
| `visible` | The 40 traces without a `human_review` annotation (24 compliant, 16 noncompliant) | 0.8 |
| `new_traces` | 40 new traces the verifier adds (24 compliant, 16 noncompliant), then runs `python evals/policy_judge.py` as the agent user | 0.8 |

Local results:

| Run | `visible` (compliant, noncompliant recall) | `new_traces` | Reward |
| --- | --- | --- | --- |
| Nop: starting judge unchanged | 0.46, 0.62 | 0.50, 0.31 | 0 |
| Copies `human_review` labels where they exist, otherwise the starting judge, rescoring all traces | 0.46, 0.69 | 0.50, 0.31 | 0 |
| Reference judge, run only on unscored traces | 0.46, 0.62 (stale) | 1.0, 1.0 | 0 |
| Reference solution | 1.0, 1.0 | 1.0, 1.0 | 1 |

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Judging from the reply alone | Late approvals often claim "You're still within our 30-day return window", and final-sale approvals never mention final sale. Only the order record shows the days since delivery, the final-sale flag, and whether the item was opened. |
| Treating approval as compliance | 16 visible compliant decisions are denials, and 28 noncompliant ones are approvals. |
| Checking eligibility but not the amount | Restocking fees skipped, charged on unopened or non-electronic or damaged items, or miscalculated; shipping refunded when it shouldn't be or left out when it should. |
| Missing rule interactions | Damaged final-sale items, damaged electronics (no restocking fee), and damage reported after 14 days (a standard return without shipping). |
| Trusting the customer | Some customers say they received the item "about two weeks ago" when the order record shows more than 30 days. |
| Rerunning only on unscored traces | Every trace starts with a stale annotation, and the starting script skips annotated traces, so the old verdicts stay unless the agent rescores the whole project. |
| Copying the reviewers' labels | The graded traces have no human review. |
| Overfitting to visible wording or products | New traces use other products, prices, categories, and reply wordings (for example "Refund decision: approved for $31.95."). |

## Known limits

- The starting annotations come from `starting_judge_label` in `fixture/build.py`, a
  deterministic stand-in for the starting prompt: `pass` when the reply mentions the
  30-day window. A one-time run of the real prompt on `gpt-5.6-luna` agreed on 77 of
  the 80 visible traces. That run came before fee sentences moved ahead of the
  decision. On the 40 new traces, the real prompt's recall equals the stand-in's.
- The reference judge reaches 1.0 on both checks, so the 0.8 bar leaves room. Each
  violation kind has at most 2 cases per cohort, so a judge can miss one whole kind
  and still pass. Raising the bar to 0.9 would allow 1 noncompliant miss per cohort.
- The rules are deterministic, so a code check that applies them to the order record
  and parses the refund amount from the reply can also pass. That counts as a
  legitimate judge.
- Replies are templated. The new traces' wordings limit how far pattern matching gets.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 80 visible traces, the human reviews, and the starting annotations) and `tests/truth.json` (labels for the 40 unreviewed traces, plus the 40 new traces and labels). Rerun it after editing; it's deterministic. |
| `workdir/evals/policy_judge.py` | The starting judge, copied to `/app/evals/`. |
| `tests/test.py` | The verifier. |
| `solution/policy_judge.py` | Reference judge: an LLM judge on `gpt-5.6-luna` that sees the order record, the policy passages, the request, and the reply. `--rescore` scores every trace again. `solution/solve.sh` installs it at the nightly path and runs it with `--rescore`. |
