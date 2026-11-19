---
name: phoenix-evals
description: Write and run evaluators with the Phoenix evals library (arize-phoenix-evals in Python, @arizeai/phoenix-evals in TypeScript), code checks and LLM-as-a-judge classifiers, pre-built metrics such as faithfulness, correctness, and retrieval relevance, and score existing traces, spans, sessions, or retrieved documents and log the results back to Phoenix as annotations. Use for "write an eval for", "score these traces", "add an LLM judge", "check groundedness or relevance", "evaluate my RAG app", "annotate spans with eval results", "a script that scores new traces", "our eval numbers look wrong, fix the eval", "rescore after changing the judge", or code that uses llm_classify, run_evals, or OpenAIModel. For datasets and experiments use phoenix-experiments; for checking a judge against human labels use phoenix-judge-alignment; for finding failure modes first use phoenix-error-analysis.
license: Apache-2.0
compatibility: Requires a Phoenix server. Python needs arize-phoenix-evals and arize-phoenix-client plus your LLM provider's SDK. TypeScript needs @arizeai/phoenix-evals and @arizeai/phoenix-client, Node.js 22.12 or later, and an AI SDK v7 provider.
metadata:
  targets: "agents mcp"
  author: oss@arize.com
  version: "2.0.0"
  languages: "Python, TypeScript"
---

# Phoenix evals

An evaluator takes one record and returns a score, a label, and an explanation. A
record holds an input, an output, and whatever else the check needs. This skill
covers how to write evaluators with the Phoenix evals library and how to run them
over data that's already in Phoenix.

Related skills:

- **phoenix-experiments** runs evaluators against a dataset as an experiment, compares
  experiments, and gates CI.
- **phoenix-judge-alignment** measures whether an LLM judge agrees with human labels and
  improves it until it does.
- **phoenix-error-analysis** finds what's failing before you write any evaluator.
- **phoenix-cli** reads traces, spans, annotations, datasets, and experiments from the
  terminal.

## Choose the check

1. **Name one failure per evaluator.** "Cites a source that's in the retrieved
   documents" is checkable; "good answer" isn't. If you don't know the failures yet,
   do error analysis first.
2. **Use code when code can decide.** Format, JSON validity, a required field, a
   regex, an exact or set match against a reference, a tool that must or must not be
   called, a number within tolerance. Code is free, fast, and deterministic.
3. **Use an LLM judge only for judgment calls.** Groundedness, relevance, tone,
   whether a requirement in a spec was followed. Give the judge a binary label set
   (`pass`/`fail`, `grounded`/`ungrounded`), not a 1 to 10 scale.
4. **Start from a pre-built evaluator** when one matches the failure exactly. Read its
   inputs and direction in [pre-built](references/pre-built.md) first, because some
   score the bad outcome as 1.
5. **Check every LLM judge against human labels** before anyone acts on its numbers.
   See phoenix-judge-alignment.

## Score data in Phoenix

The usual job is "score what's in this project and write the results back":

1. Read the records at the level the check applies to: a span (one LLM call or one
   retrieval), a trace (one request, usually its root span), a session (a whole
   conversation), or a document (one retrieved chunk).
2. Build the evaluator's inputs from those records, with the evidence a reviewer
   would check: tool calls and results, retrieved documents, and earlier turns often
   live on child spans of the same trace. Read the real attribute values; don't
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

## Rules

- **One evaluator, one name, one annotation.** The annotation name is how people find
  the result in Phoenix. Reuse the name on every rerun so results line up.
- **Keep the score direction honest.** A higher score must mean better unless the
  evaluator says `direction="minimize"`. Read the `direction` before thresholding.
- **Report what the judge saw.** If a judge gets truncated text or the wrong field,
  its rate measures nothing. Print one rendered input before running a batch.
- **An app error isn't an eval error.** A trace whose app errored still produced
  something to judge. Score it on its evidence; don't skip it or fail it
  automatically.
- **Debug a misleading eval like code.** When an eval's numbers look wrong, check
  these before you touch the judge prompt: that it reads every record past paging
  and limits, the right field and level, label names and case, how errors count,
  and how IDs join.
- **Count failures, not just averages.** Report the number of records scored, the
  number that failed, and the number the evaluator couldn't score because of errors
  or missing fields. An eval that silently skips records overstates quality.
- **Don't let a judge grade itself.** Give it its own prompt. Using a different model
  from the app is optional.
