# Common mistakes

Patterns that look right, often type-check, and produce wrong numbers.

## Both languages

- **Scoring the wrong field.** Span inputs and outputs are often JSON, such as message
  lists or framework objects. Print one rendered judge input before running a batch, and
  parse out the text the check is about.
- **Scoring the wrong level.** A per-request check belongs on the trace's root span
  or the trace, a retrieval check on retriever spans, a conversation check on the
  session. Annotating every span multiplies the count and buries the result.
- **Reading only the first page.** `get_spans_dataframe` returns at most `limit`
  rows (1,000 by default), `client.spans.get_spans` and `client.traces.get_traces`
  default to 100, and `getSpans` returns one page. Check the count against the
  project before reporting a rate.
- **Ignoring direction.** Some evaluators, including several pre-built ones, score the
  bad outcome as 1.0 and set `direction` to `minimize`. Read `direction` before you
  average or threshold.
- **A label the model can't return.** The judge picks only from `choices`. A
  "cannot evaluate" case written only into the prompt never comes back.
- **Counting errors as passes or dropping them.** Rows where the evaluator failed
  have no score. Report them separately.
- **Stale results after a change.** A rerun that skips every record with an existing
  annotation keeps the old evaluator's verdicts. Rescore after changing the
  evaluator, and rescore sessions that got new turns.
- **New names on every rerun.** Changing an annotation name between runs splits one
  metric into several. Keep names stable.

## Python

- **Averaging score dicts.** `results_df["x_score"]` holds dicts. Extract
  `s["score"]` or `s["label"]` first.
- **Short column names.** Spans dataframes use `attributes.input.value`, not
  `input.value`. Annotations read back from Phoenix use `result.label` and
  `result.score`; dataframes you log use `label` and `score`.
- **`Client(endpoint=...)` or `Client(url=...)`.** The argument is `base_url`.
- **Positional arguments.** `evaluate_dataframe`, `bind_evaluator`,
  `create_classifier`, and `to_annotation_dataframe` warn on positional arguments.
  Pass keywords.
- **Top-level imports of pre-built evaluators.** Import them from
  `phoenix.evals.metrics`, not `phoenix.evals`.
- **`@create_evaluator(kind="llm")` expecting a model call.** The decorator never
  calls a model. Use `ClassificationEvaluator`.
- **Legacy API.** `llm_classify`, `run_evals`, and `OpenAIModel` don't exist. See
  [legacy-python](legacy-python.md).

## TypeScript

- **`await createClassificationEvaluator(...)`.** It's synchronous. Await
  `evaluator.evaluate(...)` instead.
- **`{{input}}` on an object.** In experiments, `input` and `expected` are objects,
  and Mustache renders them as JSON. Use `{{input.question}}` or `inputMapping`.
- **Code metrics that don't exist.** `@arizeai/phoenix-evals/code` has precision,
  recall, and F-beta only. Write exact-match and regex checks with `createEvaluator`.
- **An old provider package.** `@arizeai/phoenix-evals` 2.x needs AI SDK v7
  providers. An older `@ai-sdk/*` package fails at the first call.
