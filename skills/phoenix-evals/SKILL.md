---
name: phoenix-evals
description: Write and run evaluators with the Phoenix evals library (arize-phoenix-evals in Python, @arizeai/phoenix-evals in TypeScript), including code checks, LLM-as-a-judge and decision-model classifiers, and pre-built metrics such as faithfulness and retrieval relevance. Use when the user wants to score LLM or agent output, such as traces, spans, sessions, retrieved documents, or a dataframe of records, log the scores to Phoenix as annotations, write or fix a judge prompt, or find out why eval numbers look wrong. Also use for code that calls llm_classify, run_evals, or OpenAIModel.
license: Apache-2.0
compatibility: Python needs arize-phoenix-evals and the SDK for your model provider. TypeScript needs @arizeai/phoenix-evals, Node.js 22.12 or later, and an AI SDK v7 provider. Reading or annotating data in Phoenix also needs a Phoenix server and arize-phoenix-client or @arizeai/phoenix-client; the current TypeScript client needs Node.js 22.15 or later.
metadata:
  targets: "agents mcp"
  author: oss@arize.com
  version: "2.0.0"
  languages: "Python, TypeScript"
---

# Phoenix evals

The Phoenix evals library scores any data. Each evaluator declares the inputs it
reads, and an input mapping adapts whatever records you have to those inputs, so one
evaluator runs on a dataframe, in an experiment, or over traces without changing its
prompt or your data. Evaluators work with any supported model provider and run with
or without a Phoenix server. With a server, the evaluators' own runs are traced, and
you can log scores back onto spans, traces, sessions, and documents as annotations.

Other Phoenix skills cover the neighboring jobs:

- **phoenix-experiments** runs evaluators on a dataset as an experiment, compares
  experiments, and gates CI.
- **phoenix-judge-alignment** measures how well an LLM judge agrees with human labels
  and improves it.
- **phoenix-error-analysis** finds what's failing before you write any evaluator.
- **phoenix-cli** reads traces, spans, annotations, datasets, and experiments from the
  terminal.

## Workflows

### Write an evaluator

1. **Prefer one failure per evaluator.** "Cites a source that's in the retrieved
   documents" is checkable, and "good answer" isn't. A multi-score evaluator can
   make sense when its scores share inputs or computation. If you don't know the
   failures yet, start with error analysis.
2. **Use code when code can decide.** Format, JSON validity, a required field, a
   regex, an exact or set match against a reference, a tool that must or must not be
   called, or a number within tolerance. Code is usually cheaper, faster, and more
   reproducible than a model call.
3. **Use a model for judgment calls,** such as groundedness, relevance, tone, or
   whether a reply followed a spec. An LLM judge returns a label and an explanation. A
   decision model returns a label and its probability, with no explanation, and can
   cost less. Either one picks from named labels: two (`pass`/`fail`) or several
   (`positive`/`neutral`/`negative`). Prefer labels with a meaning over a numeric
   scale.
4. **Start from a pre-built evaluator** when one is close to the failure you care
   about. Use it as is, or copy its prompt and adapt the definitions, labels, and
   inputs. Check its inputs and direction first, because some score the bad outcome
   as 1. See [pre-built](references/pre-built.md).
5. **Check a judge before people act on its numbers.** Human labels are the strongest
   check (see phoenix-judge-alignment). When there are none yet, a small labeled set of
   common and edge cases that you write yourself can be enough to start.

### Score data in Phoenix

The usual job is "score what's in this project and write the results back":

1. Read the records at the level the check applies to: a span (one LLM call or one
   retrieval), a trace (one request, usually its root span), a session (a whole
   conversation), or a document (one retrieved chunk).
2. Build the evaluator's inputs from those records, with the evidence a reviewer
   would check. Tool calls and results, retrieved documents, and earlier turns often
   live on child spans of the same trace. Read the real attribute values, and don't
   assume `output.value` is plain text.
3. Run the evaluators.
4. Log one annotation per record, with the name and labels the user asked for, on
   the same level you read: span, trace, session, or document annotations. Leave out
   records the evaluator failed on, and count them.
5. Read a few results with their explanations before reporting a rate.

When the user wants this to keep running, write a script that skips a record only
when its annotation came from the current evaluator version and is newer than the
record's last activity, so a session that got new turns gets rescored. After you
change an evaluator, rescore everything it covers.

| Task | Python | TypeScript |
| ---- | ------ | ---------- |
| Install and configure a judge model | [setup](references/setup.md) | [setup](references/setup.md) |
| Write code and LLM evaluators | [evaluators-python](references/evaluators-python.md) | [evaluators-typescript](references/evaluators-typescript.md) |
| Use a pre-built evaluator | [pre-built](references/pre-built.md) | [pre-built](references/pre-built.md) |
| Write a judge prompt | [judge-prompts](references/judge-prompts.md) | [judge-prompts](references/judge-prompts.md) |
| Score spans, traces, or sessions and log annotations | [score-traces-python](references/score-traces-python.md) | [score-traces-typescript](references/score-traces-typescript.md) |
| Evaluate retrieval and generation separately | [rag](references/rag.md) | [rag](references/rag.md) |
| Replace `llm_classify`, `run_evals`, `OpenAIModel` | [legacy-python](references/legacy-python.md) | none |
| Avoid known mistakes | [common-mistakes](references/common-mistakes.md) | [common-mistakes](references/common-mistakes.md) |

The [Phoenix evals docs](https://arize.com/docs/phoenix/evaluation/llm-evals) have the
full API and more examples. These references cover the choices and mistakes that
matter most when you write evaluators.

## Rules

- **Keep names stable while the meaning stays stable.** People find results in
  Phoenix by annotation name. Reuse a name for reruns of the same check. If the
  check's meaning changes, use a new name or record an evaluator version in metadata
  and rescore the records you compare.
- **Check the direction.** A higher score means better unless the evaluator sets
  `direction="minimize"`. Read it before you average or threshold scores.
- **Print what the judge sees.** Render one input before you run a batch. A judge that
  gets truncated text or the wrong field produces a rate that means nothing.
- **Decide how to treat records where the app errored.** It depends on the check. If
  the user still got something, such as a partial reply or an error message, score
  it. If there's no output to judge, skip the record. Say which rule you used and how
  many records it affected.
- **Debug a wrong-looking eval like code.** Before you change the judge prompt, check
  that the eval reads every record past paging limits, reads the right field at the
  right level, matches label names and case, counts errors correctly, and joins on
  the right IDs.
- **Report counts, not only rates.** Give the number of records scored, the number
  that failed the check, and the number the evaluator couldn't score. An eval that
  skips records without saying so looks better than it is.
- **Don't let a judge grade itself.** Give the judge its own prompt, separate from the
  app's. Using a different model from the app is optional.
