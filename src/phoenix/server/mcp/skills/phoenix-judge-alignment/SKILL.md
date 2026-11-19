---
name: phoenix-judge-alignment
description: Check and improve an LLM-as-a-judge evaluator against human labels in Phoenix. Turn human annotations into a labeled dataset, measure how often the judge catches real failures and how often its flags are wrong, read the disagreements, revise the judge prompt, and decide whether the judge is trustworthy enough to block, alert, or gate on. Use for "can we trust this judge", "does the eval agree with our reviewers", "improve the judge prompt", "the judge flags too many good answers", "validate the evaluator", "build a golden dataset from human annotations", or "should we turn this eval on". To write a new judge use phoenix-evals.
license: Apache-2.0
compatibility: Requires a Phoenix server with human annotations or a labeled dataset. Python needs arize-phoenix-client and arize-phoenix-evals. TypeScript needs @arizeai/phoenix-client and @arizeai/phoenix-evals.
metadata:
  targets: "agents mcp"
  author: oss@arize.com
  version: "1.0.0"
  languages: "Python, TypeScript"
---

# Phoenix judge alignment

A judge's numbers mean something only if the judge agrees with the people whose
judgment it stands in for. This skill measures that agreement and improves it.

Related skills: **phoenix-evals** writes and runs judges; **phoenix-experiments**
runs and compares experiments; **phoenix-cli** reads annotations from the terminal.

## Terms

Treat the failure as the positive class, because finding failures is the judge's
job. Every rate has a different denominator, so name it.

| Term | Formula | Answers |
| ---- | ------- | ------- |
| Recall (true positive rate) | TP / (TP + FN) | Of the real failures, how many did the judge flag? |
| False-positive rate (1 - true negative rate) | FP / (FP + TN) | Of the good records, how many did the judge flag anyway? |
| Precision | TP / (TP + FP) | Of the records the judge flagged, how many were real failures? |
| False-discovery share | FP / (TP + FP) = 1 - precision | Of the records the judge flagged, how many were wrong to flag? |

Map the user's words to the right row before computing anything:

- "Wrongly blocks X% of what it blocks", "of the alerts it raises, how many are
  noise", "how often is a flag wrong": false-discovery share (1 - precision).
- "Flags X% of good answers", "how often does it bother us on fine traffic":
  false-positive rate.
- "Catches X% of the failures", "misses": recall.

When the judge will block, page, or gate anything, report precision as well as
recall: people act on its flags, and precision is how often those flags are right.
Always give the counts behind each rate, starting with how many labels are failures
and how many are good. Accuracy alone hides a judge that flags almost nothing when
failures are rare: on 70 good records and 10 failures, a judge that flags nothing is
88% accurate and catches no failures.

## Workflow

1. **Collect the human labels.** Read human annotations from Phoenix, or a labeled
   dataset the user names. Join labels and judge results on the same record (trace,
   session, or span), even when the judge annotated a child span and reviewers
   annotated the root span or the trace. Keep one current human label per record:
   the most recent one. See [labels-python](references/labels-python.md) or
   [labels-typescript](references/labels-typescript.md).
2. **Map labels to pass and fail** on both sides. Write the mapping down; label
   names often differ (`bad`, `fail`, `unhelpful`, `violates`). A latest label that
   isn't a verdict (such as "unsure") means the record is unsettled; leave it out
   rather than falling back to an older verdict.
3. **Choose the job.**
   - **Assessing a judge as it is:** use the verdicts it already logged, on every
     labeled record. Don't rerun it or hold out a subset; you aren't tuning
     anything.
   - **Improving a judge:** split the labeled records before you look (about a
     third held out, with failures in both parts). Tune only on the rest.
4. **Measure and read the disagreements.** Compute the rates. Read every
   disagreement, or a sample of each kind, with the judge's explanation and any
   reviewer comment. See [agreement-python](references/agreement-python.md) or
   [agreement-typescript](references/agreement-typescript.md).
5. **When improving, write the rubric from the spec, then refine it.** Start from
   the full policy or requirements, including rules no labeled record happens to
   exercise, and give the judge the evidence each rule needs (tool results,
   retrieved documents, earlier turns). Use disagreements to sharpen definitions
   and decided cases. Don't paste labeled records into the prompt.
6. **Measure the final judge once on the held-out records** and report that number
   with the tuning-set number beside it.
7. **Decide.** Compare the rates with what the user can tolerate (below), and say
   what the judge's numbers can and can't be used for.

## Deciding whether to trust a judge

- **Use the user's tolerance when they state one,** such as "flags should be wrong
  at most 5% of the time" or "catch at least three quarters of failures". Check it
  against the rate's interval, not just the point estimate, and against the right
  denominator.
- **Without a stated tolerance,** expect recall and precision of at least 80% on
  records the judge wasn't tuned on before it gates anything, and closer to the
  reviewers' agreement with each other when you know it.
- **Small samples decide little.** With 10 labeled failures, one miss moves recall by
  10 points. Fewer than about 30 labeled records of each class supports "promising"
  or "not ready", not "trustworthy". Say how many more labels would settle it.
- **People disagree too.** When two reviewers labeled the same records, their
  agreement is the ceiling for the judge. Prefer adjudicated labels for records they
  split on.
- **Label a fair sample.** Records chosen because they looked suspicious overstate
  how common failures are and flatter precision. Sample at random, or stratify with
  known weights and reweight when estimating rates.
- **"Not yet" is a valid answer.** A judge that misses many failures or flags many
  good records shouldn't gate releases or page anyone. It can still sort records for
  human review.
- **Revalidate** after any change to the judge's prompt, model (including a switch to
  a cheaper one), or criteria.

With known recall and false-positive rate, you can estimate the true failure rate
behind the judge's observed rate; the formula is in the agreement references.
