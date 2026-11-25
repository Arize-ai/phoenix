# improve-judge

A team's LLM judge for refund-policy compliance disagrees with their human reviewers. The
agent improves the judge, rescores every trace with it, and leaves a script the nightly
job can run on new traffic. The task tests whether the agent gives the judge the evidence
it needs, including member rules that no reviewed trace shows.

## The request

> Our `policy_compliant` judge (`/app/evals/policy_judge.py`) disagrees with our reviewers too often to be useful. It checks whether the refund decisions our support agent makes follow our refund policy, and the agent's traces are in Phoenix under the `refund-decisions` project. Our reviewers' verdicts are on some of those traces as `human_review` annotations.
>
> Can you improve the judge so it agrees with them, and rerun it so every trace in the project gets a fresh `policy_compliant` annotation? Our nightly job runs `python evals/policy_judge.py` on new traces, so it needs to keep working that way and stay on `gpt-5-nano`. It has to work on next week's traffic too, so don't tune it to the traces our reviewers looked at.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `refund-decisions` | 80 traces, one per refund request. The root `refund-agent` span has the customer's request and the agent's reply, with its decision, amount, and reason. Its children are a `get_order` tool call that returns the order record (category, price, shipping paid, final-sale flag, days since delivery, condition, opened flag, and membership), a `search_policies` retriever with the 4 policy passages that best match the order, and the LLM call. |
| `human_review` annotations | On 40 traces: `compliant` or `noncompliant`, with a one-line reason such as "Not damaged, so shipping isn't refundable. Should be $64.00, not $72.95." No reviewed trace is from an Acme Plus member. |
| `policy_compliant` annotations | On all 80 traces, labeled `pass` or `fail` by the starting judge. |
| `/app/evals/policy_judge.py` | The starting judge, on `gpt-5-nano`. It sees only the reply, asks whether the reply is polite and mentions the 30-day return window, and skips traces that already have a `policy_compliant` annotation. |
| Model access | A real `OPENAI_API_KEY`, so the agent can run its judge. |

## How the data was made

`fixture/build.py` builds every trace from hand-written templates: the policy passages,
products and prices, customer names, request and reply sentences, review notes, and the
number of traces of each kind. Each kind either follows the policy or breaks one rule on
purpose, such as charging the restocking fee on unopened electronics. Of the 80
production traces, 32 are noncompliant, across 13 kinds of mistake.

A fixed random seed, 31 for the production traces and 47 for the new traces, shuffles the
order of the kinds, which also decides which traces get a review. For each trace, it picks
the product from that split's list, the days since delivery and the opened flag within
the kind's range, the sentence variants, whether the decision comes before the reasons,
whether the reply adds a 30-day reminder, and whether the customer claims a delivery date
or a membership. The new traces use their own products, prices, and sentence variants.

The label comes from `policy_outcome`, which computes the refund the policy allows from
the order record:

- Gift cards and final-sale items get nothing, even when damaged.
- Damage reported within 14 days of delivery gets the item price plus shipping, with no
  restocking fee.
- Otherwise, a request more than 30 days after delivery gets nothing, or more than 60 days
  for an Acme Plus member.
- Every other refund is the item price, minus a 15% restocking fee for opened
  electronics. Plus members don't pay the fee.

The return-window and damage passages explicitly say that the gift-card and final-sale
exclusions take precedence, so a trace that retrieves both rules does not present the
judge with conflicting instructions.

A trace is compliant when the agent's refund matches that amount to the cent, where a
denial is a refund of 0. The review notes quote the same amounts. The Plus rules are in
one passage, `plus-members`, which `search_policies` returns only for a member's order.
Nearly every phrase that states a decision, a fee, a delivery date, or a membership
appears in both compliant and noncompliant replies. The few that don't appear in 1 to 3
traces each, so only the order record reliably decides the label.

The starting `policy_compliant` annotations come from `starting_judge_label`, a stand-in
for the starting prompt that passes a reply when it mentions the 30-day window.

`build.py` asserts that every trace's label matches its kind, so a compliant kind never
grants a wrong amount and a noncompliant kind never grants the right one. It also asserts
that no reviewed trace retrieves the `plus-members` passage and that some unreviewed trace
does. GPT-6 Astra checked the data and labels.

## How it's graded

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `production_traces` | Code | `expected.json`, `grading_data.json` | The `policy_compliant` annotations on the 40 unreviewed production traces cover at least 95% of them, with at least 80% recall on compliant and on noncompliant traces. These traces have 24 compliant and 16 noncompliant decisions, and 7 fall under the Plus rules: 6 from members and 1 from a customer who says they're a member but isn't. |
| `new_traces` | Code | `expected.json`, `grading_data.json` | The verifier adds 40 new traces and runs `python evals/policy_judge.py` from `/app` as the agent user, and the annotations on the new traces meet the same bars. The new traces have 24 compliant and 16 noncompliant decisions, and 18 fall under the Plus rules: 15 from members and 3 from customers who say they're members but aren't. |

`reward` is 1 only when every check passes.

Both checks read the latest `policy_compliant` annotation on each trace, whether it's on a
span or on the trace. The request doesn't name the labels, so any clear binary label
counts: `pass` and `fail`, `compliant` and `noncompliant`, negations such as
`not_compliant`, or a score. A label the verifier can't read falls back to the score,
where 0.5 or more passes, and counts as missing without one. During the rerun, a local
recorder answers any chat model request except `gpt-5-nano` with a 403.

These measures are reported beside `reward` and don't change it. The
[suite README](../README.md#what-a-run-reports) explains each one.

- `turn_count`, `tool_count`, and a `loaded_<skill>` flag for each skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of the rerun's judge requests whose prompt meets the
  rubric. For this task, the rubric grader is told that the judge needs the order record,
  the policy passages that apply, and the reply with its decision and amount.

## What the task tests

| Wrong approach | Fails |
| --- | --- |
| Reword the starting prompt, which still sees only the reply | `production_traces` and `new_traces` |
| Copy the `human_review` labels and leave the starting judge's labels elsewhere | `production_traces` and `new_traces` |
| Write a good judge but keep skipping traces that already have an annotation, so the old labels stay | `production_traces` |
| Hard-code the policy as the reviewed traces show it, without the Plus rules | `new_traces` |
| Run the judge on a model other than `gpt-5-nano`, or score new traces only when given a flag | `new_traces` |

## Calibration

The reference solution scores 1 and a do-nothing agent scores 0. Scripted wrong
approaches, such as copying the reviewers' labels, rescoring only unannotated traces, and
hard-coding the policy without the Plus rules, score 0.

## Known limits

- Only the 40 unreviewed traces are graded in the project. The request asks for a fresh
  label on every trace, but the reviewed traces' labels, and whether any label is new,
  aren't checked.
- Most kinds of mistake have 1 or 2 traces in each check, so a judge can miss a whole
  kind and still clear the 80% bar. The Plus kinds are the exception: a judge that gets
  all of them wrong fails `new_traces`.
- The `plus-members` passage appears in 6 unreviewed traces, so a judge that copies every
  distinct passage in the project into its prompt passes without reading each trace's own
  passages. That judge still covers the whole policy the project shows.
- The policy rules are exact, so code that applies them to the order record and reads the
  amount from the reply passes without a model call. `uses_phoenix_evals` and
  `prompt_quality` show whether the judge used a model.
- `gpt-5-nano` doesn't return the same labels on every run, so a judge close to the 80%
  bar can pass one run and fail the next.
