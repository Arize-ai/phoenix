# QUESTIONS-api: the HTTP-answered api-selection tasks

Draft for review, 2026-10-05. Tasks stamped by `generate.py` beside this file; every oracle was run
against a local Phoenix serving the scrubbed fixture on 2026-10-05 and matched its reference. A companion to the SQL-answered tasks in QUESTIONS-sql.md over the same `sql-benchmark`
fixture (the scrubbed `phoenix.db` dump, data through 2026-09-01). Where the SQL set asks for
aggregates that only `executeSql` answers well, this set asks for single-entity lookups that the
Phoenix REST API (`/v1/...`, surfaced as MCP tools such as `get-trace`, `get-dataset-examples`,
`get-prompt-version-by-tag`) or the GraphQL API (`node(id:)`, `getTraceByOtelId`,
`getProjectSessionById`, `getProjectByName`) answer in one call. None of the questions mention
an API, SQL, or a tool. Every reference below was read with `sqlite3` from
`evals/harbor/.cache/fixtures/sql-benchmark/phoenix.db` on 2026-10-05.

Why these should route away from SQL:

- **SQL-blind** entries need tables the `executeSql` allowlist does not expose: prompts, prompt
  versions, tags and labels, annotation configs, dataset splits, trace and session annotations,
  evaluators and dataset evaluators, experiment jobs and logs, users, retention policies, token
  prices, sandbox configs. An agent that tries SQL first gets a refusal and must fall back.
- **Point lookups** take a Phoenix node id, OTel trace or span id, or exact name and want one
  field. They are answerable through SQL, but the natural route is one REST call, and the
  `used_sql`/`used_graphql`/`used_rest` annotations from `verifiers/tool_usage.py` record which
  route each agent took. Keep both kinds so the comparison shows routing, not just capability.

Conventions pinned for every task:

- Phoenix node ids are base64 `Type:rowid` (`RXhwZXJpbWVudDoxMzY=` is `Experiment:136`). Trace
  and span ids are the OTel hex ids. The verifier should accept a prefix for hex ids.
- Times are UTC and the fixture is frozen; no relative windows.
- Hidden `Experiment-<hash>` projects: GraphQL `projects` and `projectCount` hide them, REST
  `GET /v1/projects` hides them unless `include_experiment_projects=true`. Questions that need
  them say so, as `empty-projects` in the SQL set now does.
- JSON answers (an example input, a template) are graded on the quoted substrings in the notes,
  not on byte equality.
- Each task is one `instruction.md`, `tests/expected.json` with `reference`, `notes`, `source`,
  graded by `api_selection_verifiers.verify`, and a `solution/solve.py` that recomputes the
  reference through `phoenix_api.client()` (REST) or `phoenix_api.graphql()`; the task image
  denies `/data` to the oracle, so no sqlite.

Legend per entry: **[blind]** SQL cannot answer; **[lookup]** SQL could, REST is the natural
route. The oracle column names the call the solve.py will make.

## Projects

- **project-description** [lookup] — What is the description of the project named
  `dataset-evaluator-a629a8ba9fc497a33297f9d8`? Reference: `Traces for dataset evaluator:
  safe_sql_exact_match on dataset: banking_saas_dataset_clean`. Oracle: GET
  /v1/projects/{name}.
- **project-node-id** [lookup] — What is the Phoenix id of the project `mobile-review-queue`?
  Reference: `UHJvamVjdDoxMjc=`. Notes: that is `Project:127`. Oracle: GraphQL
  `getProjectByName`.
- **project-by-id** [lookup] — Which project has the id `UHJvamVjdDoz`, and how many traces does it
  hold? Reference: `pxi_dev`, 1137 traces. Oracle: GraphQL `node(id:) { ... on Project { name
  traceCount } }`.
- **project-colors** [lookup] — What gradient start and end colours does the `playground` project
  use? Reference: `#5bdbff` and `#1c76fc` (the defaults; no project in the fixture overrides
  them). Oracle: GraphQL `getProjectByName`.
- **project-annotation-configs** [blind] — Which annotation configs are attached to the
  `mobile-review-queue` project? Reference: `user_feedback`, `response_quality`,
  `review_summary`, `px-mobile-verify-config`, `resolution_outcome` (five). Oracle: GET
  /v1/projects/{name}/annotation_configs.
- **project-single-config** [blind] — The `pxi_dev` project has exactly one annotation config
  attached. What is it called and which direction does it optimise? Reference: `Slow`,
  `MINIMIZE` (labels `fast` = 0, `slow` = 1). Oracle: GET /v1/projects/pxi_dev/annotation_configs.
- **project-retention-policy** [blind] — Which trace retention policy applies to `pxi_dev`, and
  what is its schedule? Reference: the `Default` policy, cron `0 0 * * 0`, rule max_days 0 (never
  deletes). Notes: no project in the fixture has its own policy; the default is the only one.
  Oracle: GraphQL `getProjectByName { traceRetentionPolicy { name cronExpression rule } }`.
- **project-session-count** [lookup] — How many sessions does `mobile-review-queue` have?
  Reference: 6. Oracle: GraphQL `getProjectByName { sessionCount }` or GET
  /v1/projects/{name}/sessions.
- **project-annotation-names** [lookup] — Which span annotation names exist in the project
  `openinference-tanstack-ai-verify-20260521`? Reference: `groundedness`, `quality`, `test`,
  `trace_quality`. Oracle: GraphQL `spanAnnotationNames`.
- **project-first-trace** [lookup] — When did the `pxi_agent_tony` project receive its first and
  last trace? Reference: `2026-04-06 20:15:34` and `2026-04-17 14:33:31` UTC. Oracle: GraphQL
  `getProjectByName { startTime endTime }`.
- **hidden-project-description** [lookup] — The hidden project `Experiment-e2b97126b637414e0545df8d`
  belongs to a playground experiment. What does its description say? Reference: `Traces from
  prompt playground`. Notes: GraphQL `projects` hides it; use `getProjectByName` or REST with
  `include_experiment_projects=true`. Oracle: GET /v1/projects/{name}.

## Traces

- **trace-root-input** [lookup] — What did the user ask in trace `53e43018f088a7d5242e29712b3e3351`?
  Reference: `how does tracing work` (project `pxi_agent_tony`, root span `pxiAgent Turn`).
  Oracle: GraphQL `getTraceByOtelId { rootSpan { input { value } } }`.
- **trace-span-count** [lookup] — How many spans does trace `90122be24041d5549b6d109614dd459f` have,
  and what is its root span called? Reference: 17 spans, root `IncidentCopilot`. Oracle: GraphQL
  `getTraceByOtelId { numSpans rootSpan { name } }`.
- **trace-tools-in-order** [lookup] — List the tools that trace `90122be24041d5549b6d109614dd459f`
  called, in order. Reference: `search_logs`, `get_metrics`, `get_metrics`, `get_config_diff`,
  `create_incident_action`, `get_metrics`. Notes: six TOOL spans, four distinct tools. Oracle:
  GET /v1/projects/incident-copilot/spans filtered by trace, sorted by start time.
- **trace-session** [lookup] — Which session does trace `9128cef0af42a378c2123858a6a1ce26` belong to?
  Reference: `c07e3780-9929-40ff-9465-9e8b30eb1656`. Oracle: GraphQL `getTraceByOtelId { session
  { sessionId } }`.
- **trace-status** [lookup] — Trace `914e1f100fba1951ff06323e13f514cb` failed. What was the status
  message and which model was being called? Reference: `model timeout`, `gpt-4o-mini`. Notes:
  root `handle_user_message` (CHAIN) and child `chat_completion` (LLM) both carry the ERROR
  status; the input was `Now do it in French.`. Oracle: GraphQL `getTraceByOtelId { spans {
  statusMessage attributes } }`.
- **trace-user** [lookup] — Which user id is recorded on trace `90122be24041d5549b6d109614dd459f`?
  Reference: `oncall@example.com`. Oracle: GraphQL `getTraceByOtelId { userId }`.
- **trace-latency** [lookup] — How long did trace `660d6a9fe57e74b3b64d7e075d20ec78` take end to
  end? Reference: 1.6 s (17:41:55.348 to 17:41:56.948 UTC). Oracle: GraphQL `latencyMs`.
- **trace-feedback** [blind] — What user feedback was left on trace
  `f5c12f6ca357b515bd3fa701306cb760`? Reference: `user_feedback` = `negative` (score 0), HUMAN,
  via API. Notes: the trace's answer was that the GraphQL API was returning a backend error.
  Oracle: GET /v1/projects/pxi_dev/trace_annotations.
- **trace-feedback-positive** [blind] — Which traces in `pxi_dev` carry a positive `user_feedback`
  trace annotation? Reference: `9128cef0af42a378c2123858a6a1ce26`,
  `c1aa1d2d47fd1f75747e4ad49806cb18`, `932f37bdd82dc95707c82a361910d6fc` (three; the fourth
  pxi_dev trace annotation, on `f5c12f6c...`, is negative). Oracle: GET
  /v1/projects/pxi_dev/trace_annotations.
- **trace-errors-by-type** [lookup] — Trace `176fcc3d88b18dabbf8db3449e53ebf2` has three failed tool
  calls. Which tools were they and what did the error say? Reference: `read_prompt_instance`,
  `read_prompt_tools`, `add_prompt_instance`, each `Unknown tool: <name>`. Oracle: GraphQL
  `getTraceByOtelId { errorsByType spans { name statusMessage } }`.
- **trace-exception** [lookup] — What exception is recorded on trace
  `72408774085db31572128f7e60b4f76d`? Reference: `pydantic_ai.exceptions.ModelHTTPError`, status
  400, `The requested model 'gpt-5.4-fast' does not exist` (on span `b3a8817291c015dc`,
  `pxiCompletion Turn`). Oracle: GraphQL `spans { events { name attributes } }`.
- **trace-root-output** [lookup] — What was the assistant's final answer in trace
  `8b3f5b1f7b0fac4b6a24eb131210b072`? Reference: begins `Q2 revenue grew 18% QoQ, driven by (1)
  enterprise expansion in EMEA, (2) the new usage-based pricing tier`. Oracle: GraphQL `rootSpan
  { output { value } }`.
- **traces-in-small-project** [lookup] — List the traces in project `assistant_agent` with the
  user's first message in each. Reference: `7cd98be451fa66759a18a1697aa597b4` (`test`) and
  `ff59da78f0cf706cd274464abcceab09` (`Explain what this span is doing.`). Oracle: GET
  /v1/projects/assistant_agent/traces.

## Spans

- **span-by-id** [lookup] — What is span `c131b0bee8049eb2` called, what kind is it, and which
  trace is it in? Reference: `execute_tool searchProducts`, TOOL, trace in project
  `openinference-tanstack-ai-verify-20260521`. Oracle: GraphQL `getSpanByOtelId`.
- **span-parent** [lookup] — What is the parent of span `ff3951eaa75f533d`? Reference: span
  `6a41eb4766c2bb30`, `PXIAgent.iter` (AGENT), trace `7c01787fd51ef4dd971f2791d2122f57`. Oracle:
  GraphQL `getSpanByOtelId { parentId }`.
- **span-children** [lookup] — Which spans are direct children of `6a41eb4766c2bb30`? Reference:
  `ff3951eaa75f533d` (`bash`, TOOL) and `59d57ef5e5e67f05` (`gpt-5.4`, LLM). Oracle: GET
  /v1/projects/pxi_dev/spans filtered by parent, or GraphQL `descendants`.
- **span-tokens** [lookup] — How many prompt and completion tokens did span `24aed90fbeebb7c2` use,
  and which model? Reference: 26,179 prompt, 312 completion, `gpt-5.4-2026-03-05`. Oracle:
  GraphQL `getSpanByOtelId { tokenCountPrompt tokenCountCompletion attributes }`.
- **span-llm-tokens-small** [lookup] — What were the token counts on the LLM span in trace
  `660d6a9fe57e74b3b64d7e075d20ec78`? Reference: span `2087f6356fdb5a18`, 812 prompt, 96
  completion, 908 total, `gpt-4o-mini`. Oracle: GraphQL.
- **span-tool-command** [lookup] — What command did the `bash` span `0e5512ce48261dcc` try to run,
  and why did it fail? Reference: a `phoenix-gql` mutation patching project `UHJvamVjdDoxMjY=`
  with description `blah blah blah blah`; status `ApprovalRequired`. Oracle: GraphQL
  `getSpanByOtelId { statusMessage input { value } }`.
- **span-exception-event** [lookup] — What does the exception event on span `f8458c42e0719727` say?
  Reference: `Location 'Macomb, Michigan' not found` (type `Error`, span `execute_tool
  weatherTool`, project `default`). Oracle: GraphQL `events`.
- **span-annotations** [lookup] — Which annotations are on span `6a41eb4766c2bb30`, with labels and
  scores? Reference: `issue` = `major` (0.28), `quality` = `poor` (0.25), `test` = `test` (no
  score, explanation `Second test annotation added at user request.`). Oracle: GET
  /v1/projects/pxi_dev/span_annotations?span_ids=... (MCP `get-span-annotations`).
- **span-annotation-explanation** [lookup] — What explanation accompanies the `quality` annotation
  on span `c131b0bee8049eb2`? Reference: begins `Tool execution succeeded with very low latency
  and returned a relevant stationery result`; label `good`, score 0.9. Oracle: same.
- **span-notes** [blind] — What notes were left on the root span of trace
  `660d6a9fe57e74b3b64d7e075d20ec78`? Reference: span `049a7cfc0b438629` has one `note`
  beginning `The assistant gave a plausible billing explanation, but it did not answer the
  user's double-charge concern`. Oracle: GraphQL `spanNotes`.
- **span-in-dataset** [lookup] — Is span `1b91cd85d269b2b3` part of a dataset, and which one?
  Reference: yes, `High Token Count Spans (>20k)` (example `RGF0YXNldEV4YW1wbGU6ODY=`). Oracle:
  GraphQL `getSpanByOtelId { containedInDataset }` plus the example's dataset.
- **span-cumulative-tokens** [lookup] — What is the cumulative total token count on the root span
  of trace `ff59da78f0cf706cd274464abcceab09`? Reference: 104,529 (103,788 prompt + 741
  completion) on span `d5a108589e511382`; the trace has 16 spans. Oracle: GraphQL
  `cumulativeTokenCountTotal`.
- **span-status-propagated** [lookup] — Trace `914e1f100fba1951ff06323e13f514cb`: does the root
  span's own status or a child's status carry the error? Reference: both; root
  `328b89964b1a9bd4` and child `769e6730ffc47aa6` are ERROR with `model timeout`. Oracle: GraphQL
  `statusCode propagatedStatusCode`.

## Sessions

- **session-by-id** [lookup] — How many traces are in session `support-billing-0142`, and what
  was the first user input? Reference: 2 traces; `Why was I charged twice this month?`. Oracle:
  GET /v1/sessions/support-billing-0142 (MCP `get-session`).
- **session-last-output** [lookup] — What was the last assistant output in session
  `onboarding-walkthrough-77`? Reference: begins `That usually means the role lacks USAGE on the
  warehouse. Run: GRANT USAGE ON WAREHOUSE compute_wh TO ROLE readonly_role`; 3 traces. Oracle:
  GraphQL `getProjectSessionById { lastOutput }`.
- **session-cross-project** [lookup] — Session `incident-2026-08-06-checkout` spans two projects.
  Which, and how many traces in each? Reference: 8 traces: 4 in `takehome-fixture`, 4 in
  `incident-copilot`. Notes: the session row belongs to `takehome-fixture`; its traces include
  the incident-copilot ones. Oracle: GraphQL `getProjectSessionById { traces { project { name }
  } }`.
- **session-annotations** [blind] — What annotations does session `chaotic-eval-run-51` have?
  Reference: `response_quality` 9.0 and `response_quality` 4.0 (two rows with different
  identifiers), `user_feedback` = `positive` (1.0), `resolution_outcome` = `resolved` (1.0).
  Oracle: GET /v1/projects/mobile-review-queue/session_annotations.
- **session-note** [blind] — What note was left on session `fresh-unreviewed-session-x`?
  Reference: `Verified on Pixel 9 - answer matches beta docs.`. Oracle: same route, name `note`.
- **session-out-of-bounds-score** [blind] — The `response_quality` config allows 1 to 5. Which
  session in `mobile-review-queue` has a `response_quality` score outside that range, and what
  is it? Reference: `rag-quarterly-report-3`, 42.0. Notes: `chaotic-eval-run-51` also has a 9.0;
  accept either as long as 42 on rag-quarterly-report-3 is named. Oracle: session annotations
  plus GET /v1/annotation_configs/response_quality.
- **session-error-count** [lookup] — How many traces in session `chaotic-eval-run-51` ended in
  error? Reference: 1 of 2 (`914e1f100fba1951ff06323e13f514cb`). Oracle: GraphQL
  `numTracesWithError`.
- **session-list-for-project** [lookup] — List the session ids in `mobile-review-queue` in
  chronological order. Reference: `support-billing-0142`, `onboarding-walkthrough-77`,
  `agent-refund-flow-9`, `rag-quarterly-report-3`, `chaotic-eval-run-51`,
  `fresh-unreviewed-session-x`. Oracle: GET /v1/projects/mobile-review-queue/sessions.
- **session-pxi-length** [lookup] — How many traces does the pxi_dev session
  `c07e3780-9929-40ff-9465-9e8b30eb1656` contain, and when did it start and end? Reference: 20
  traces, 2026-04-17 19:53:21 to 2026-04-20 19:06:26 UTC (last input `summarize`). Oracle: GraphQL
  `getProjectSessionById`.
- **session-user** [lookup] — Which user id is attached to session `incident-2026-08-06-checkout`?
  Reference: `oncall@example.com`. Oracle: GraphQL `userId`.

## Annotation configs

- **config-type** [blind] — What type is the `review_summary` annotation config, and what is its
  description? Reference: `FREEFORM`, `Free-text reviewer summary of the session.`. Oracle: GET
  /v1/annotation_configs/review_summary.
- **config-bounds** [blind] — What are the bounds and optimisation direction of `response_quality`?
  Reference: CONTINUOUS, 1.0 to 5.0, MAXIMIZE. Oracle: same.
- **config-values** [blind] — What labels and scores does `px-mobile-verify-config` define?
  Reference: `pass` = 1.0, `fail` = 0.0; CATEGORICAL, MAXIMIZE; description `verification
  config`. Oracle: same.
- **config-count** [blind] — How many annotation configs exist, and which one has no description?
  Reference: 6; `Slow`. Oracle: GET /v1/annotation_configs (MCP `list-annotation-configs`).
- **config-unattached** [blind] — Is every annotation config attached to at least one project?
  Reference: yes; the five mobile-review-queue configs plus `Slow` on pxi_dev cover all six.
  Oracle: configs plus per-project config lists.

## Datasets

- **dataset-by-name** [lookup] — What is the description and Phoenix id of the dataset
  `github-support-triage-tool-routing`? Reference: `Hand-authored golden routing cases for the
  first tool selected by the GitHub support-ticket triage agent.`; `RGF0YXNldDoyMA==`. Oracle:
  GET /v1/datasets (MCP `list-datasets`) then `get-dataset`.
- **dataset-example-count** [lookup] — How many examples are in `set_spans_filter`? Reference:
  48. Oracle: GET /v1/datasets/{id}/examples or GraphQL `exampleCount`.
- **dataset-versions** [lookup] — How many versions does `PXI E2E Agent Tests` have? Reference:
  7 (ids 8 to 14). Oracle: GET /v1/datasets/{id}/versions.
- **dataset-version-description** [lookup] — What does the second version of `High Token Count
  Spans (>20k)` say it changed? Reference: `Patched: output = token counts (total, prompt,
  completion)`. Notes: version 6 was `Spans with >20k total tokens`. Oracle: GET
  /v1/datasets/{id}/versions.
- **dataset-example-by-index** [lookup] — In `phoenix-issue-triage-initial-responses`, what is the
  `case` metadata and `should_ask_question` flag of the example whose issue is a bare GitHub URL?
  Reference: `url_without_access`, `true` (example `RGF0YXNldEV4YW1wbGU6MTEz`). Oracle: GET
  /v1/datasets/{id}/examples.
- **dataset-example-output** [lookup] — What is the expected output for the
  `github-support-triage-tool-routing` example about issue `acme/widget#2128`? Reference:
  `{"expected_tool": "apply_github_triage"}`; scenario `apply_confirmed_duplicate`. Oracle: same.
- **dataset-example-splits** [blind] — Which split is the `banking_saas_dataset_clean` example
  `Show me John Smith's recent transactions` in? Reference: `refusal` (example
  `RGF0YXNldEV4YW1wbGU6MTQ1`). Oracle: GraphQL `DatasetExample { datasetSplits { name } }`.
- **dataset-split-sizes** [blind] — How many examples of `banking_saas_dataset_clean` are in each
  split? Reference: `happy path` 15, `refusal` 13. Oracle: GET /v1/datasets/{id}/splits.
- **split-definition** [blind] — What colour and description does the `refusal` split have, and how
  many examples does it hold across all datasets? Reference: `#808080`, no description, 52
  examples (13 in each of four banking datasets). Oracle: GraphQL `datasetSplits`.
- **dataset-deleted-example** [lookup] — `banking_saas_dataset_auto_ids` has 29 example rows but 28
  live examples. Which version deleted one, and what did the same version add? Reference:
  version 4 deleted example `RGF0YXNldEV4YW1wbGU6NTc=` and created `Show me my current account
  balance!`; version 5 then patched it to `Show me my current account balance!!!!!`. Oracle:
  GraphQL examples at each `datasetVersionId`.
- **dataset-example-revision-history** [lookup] — How many times has the docs-smoke example in
  `PXI E2E Agent Tests` been revised, and what is its current prompt? Reference: 4 revisions
  (versions 8, 9, 10, 11); current prompt `How do I change the default project name`, scenario
  `pxi-docs-smoke:tracing-project-env-var-v1`. Oracle: GraphQL `revision` at each version.
- **dataset-example-source-span** [lookup] — Which span was the first example of `High Token
  Count Spans (>20k)` created from? Reference: span `1b91cd85d269b2b3` (`pxiCompletion Turn`,
  trace `22c05aacaf5197b71e6affb69ca325d0`); its patched output records 27,703 total tokens.
  Oracle: GraphQL `DatasetExample { span { spanId } }`.
- **dataset-evaluators** [blind] — Which evaluators are attached to `banking_saas_dataset`?
  Reference: `refusal_detection`, `refusal_detection_fixed`, `no_sql_in_output`. Oracle: GraphQL
  `Dataset { datasetEvaluators { name } }`.
- **dataset-evaluator-project** [blind] — Which project collects the traces of the
  `safe_sql_exact_match` evaluator on `banking_saas_dataset_clean`? Reference:
  `dataset-evaluator-a629a8ba9fc497a33297f9d8` (118 traces). Oracle: GraphQL `datasetEvaluators
  { project { name } }`.
- **dataset-created-by** [blind] — Who created the dataset `banking_saas_dataset`, and is any other
  dataset attributed to a user? Reference: `admin`; no, it is the only dataset with a recorded
  creator. Notes: splits carry no creator in either API, so the question is about the dataset.
  Oracle: GraphQL `datasets { createdBy { username } }`.
- **dataset-unnamed** [lookup] — Two datasets have auto-generated timestamp names. What are they
  and how many examples does each hold? Reference: `Dataset 2026-08-14T17:33:46.188Z` and
  `Dataset 2026-08-14T21:05:29.362Z`, one example each. Oracle: `list-datasets`.
- **dataset-experiment-count** [lookup] — How many experiments have run on `PXI E2E Agent Tests`?
  Reference: 77. Oracle: GraphQL `experimentCount`.
- **dataset-example-external-id** [lookup] — Which example in `experiment_observations` has the
  pytest node id ending `compare-only-no-patch`, and in which version was it added? Reference:
  example `RGF0YXNldEV4YW1wbGU6MTg2`, version 38 (the dataset's third). Oracle: GET
  /v1/datasets/{id}/examples.

## Experiments

- **experiment-by-id** [lookup] — What is experiment `RXhwZXJpbWVudDoxMzY=` called, and on which
  dataset did it run? Reference: `Luna first-tool routing — validated evaluator`,
  `github-support-triage-tool-routing`. Oracle: GET /v1/experiments/{id} (MCP
  `get-experiment-by-id`).
- **experiment-description** [lookup] — What is the description of `safe-sql prompt v3
  authorization fix`? Reference: `Adds one authorization clarification for the user's own
  external transfers.`. Oracle: `list-experiments-for-dataset`.
- **experiment-hypothesis** [lookup] — What hypothesis is recorded in the metadata of `safe-sql
  prompt v4 disambiguation`, and which experiment is its baseline? Reference: `Explicit override
  mappings for paycheck, external transfers, and system-wide balances will yield 28/28 exact
  matches.`; baseline `RXhwZXJpbWVudDoxMDc=` (v3). Oracle: GET /v1/experiments/{id} metadata.
- **experiment-observation** [lookup] — What observation did PXI append to the metadata of
  `safe-sql prompt v4 disambiguation`, and when? Reference: `2026-08-11T15:10:35-04:00`, by
  `pxi`, note beginning `Hypothesis confirmed: 28/28 examples passed safe_sql_exact_match with
  zero run or evaluator errors.`. Oracle: same.
- **experiment-baseline-chain** [lookup] — Follow the `baseline_experiment_id` links from the Luna
  validated-evaluator experiment back to the first run. Reference: `RXhwZXJpbWVudDoxMzY=` →
  `RXhwZXJpbWVudDoxMzU=` → `RXhwZXJpbWVudDoxMzQ=` → `RXhwZXJpbWVudDoxMzM=` (baseline, null).
  Oracle: four `get-experiment-by-id` calls.
- **experiment-project** [lookup] — Which project holds the traces of experiment
  `RXhwZXJpbWVudDoxMDg=`? Reference: `Experiment-e2b97126b637414e0545df8d`. Oracle: GET
  /v1/experiments/{id} `project_name`.
- **experiment-dataset-version** [lookup] — Which dataset version did `Luna first-tool routing
  baseline` run against, and what is that version's description? Reference: version
  `RGF0YXNldFZlcnNpb246NDU=`, `Added 12 example(s) via the assistant`. Oracle: GraphQL
  `datasetVersion`.
- **experiment-run-output** [lookup] — In `safe-sql prompt v3 authorization fix`, what did the model
  answer for `Did I receive my paycheck this week?`, and did it pass? Reference: `REFUSED: Query
  attempts to access other users' data.`; `fail` (0.0). Notes: the v4 run answered with the
  expected SELECT and passed. Oracle: GET /v1/experiments/{id}/runs plus example lookup.
- **experiment-run-explanation** [lookup] — Why did the Luna validated-evaluator run fail on the
  `Dark mode makes diff text unreadable` ticket? Reference: `Expected first tool
  search_github_issues, but observed get_github_issue.` (run `RXhwZXJpbWVudFJ1bjo4MDc=`).
  Oracle: GET /v1/experiments/{id}/runs with annotations, or GraphQL `runs { annotations }`.
- **experiment-failed-examples** [lookup] — Which scenarios failed `first_tool_matches_expected` in
  `Luna first-tool routing — validated evaluator`? Reference:
  `duplicate_search_visual_regression`, `apply_reviewed_docs_triage`,
  `apply_confirmed_duplicate` (3 of 12; the two `apply_github_triage` cases and one
  `search_github_issues` case). Oracle: runs plus examples.
- **experiment-run-trace** [lookup] — Which trace did the v4 run for `Did I receive my paycheck
  this week?` produce, and in which project? Reference: `8ff53c090a79d9b5bc27a381fd49a6c1` in
  `Experiment-e2b97126b637414e0545df8d`. Oracle: run `trace_id`.
- **experiment-run-error** [lookup] — What error did every run of `Luna first-tool routing baseline`
  hit? Reference: `Error code: 401 ... Incorrect API key provided: 1234` (5 runs, all errored).
  Oracle: GET /v1/experiments/{id}/runs `error`.
- **experiment-run-error-schema** [lookup] — What error stopped `Luna first-tool routing — corrected
  credentials`? Reference: `Error code: 400 ... Invalid schema for function
  'search_github_issues': ... 'required' is required to be supplied` (5 runs). Oracle: same.
- **experiment-llm-eval-explanation** [lookup] — In the first `phoenix-issue-reproduction-and-triage`
  playground experiment with evaluations (`RXhwZXJpbWVudDoxMDE=`), what did the
  `initial_response_alignment` judge say about the URL-only case? Reference: label `false`,
  explanation beginning `The assistant incorrectly claims it can retrieve details from the
  provided URL despite its inability to access external URLs`. Oracle: runs with annotations.
- **experiment-unannotated-run** [lookup] — In experiment `RXhwZXJpbWVudDoxMDE=`, which example's
  run has no evaluation? Reference: the `sufficient_python_report` case (`RGF0YXNldEV4YW1wbGU6MTE1`,
  trace `92e91e256d387a0a295bf9e8fb868f7e`). Notes: the experiment log records a `ReadTimeout`
  task error. Oracle: runs plus GraphQL `job { errors }`.
- **experiment-job-status** [blind] — What is the job status of experiment `RXhwZXJpbWVudDoxMzM=`
  and what was its last error? Reference: `ERROR`; `Circuit breaker tripped (task):
  AuthenticationError` (5 task errors). Oracle: GraphQL `Experiment { job { status lastError
  errors } }`.
- **experiment-job-model** [blind] — Which model and prompt version did the job for
  `RXhwZXJpbWVudDoxMzY=` run? Reference: `gpt-5.6-luna` (OPENAI), prompt version
  `UHJvbXB0VmVyc2lvbjoxNQ==` (the first version of `github-support-ticket-triage-agent`, not the
  fixed one saved afterwards). Oracle: GraphQL `job { taskConfig }`.
- **experiment-job-template-error** [blind] — Two `playground-experiment` runs on
  `banking_saas_dataset` ended in ERROR on 2026-06-02. What tripped them? Reference:
  experiments `RXhwZXJpbWVudDo5MA==` and `RXhwZXJpbWVudDo5MQ==`, `Circuit breaker tripped (task):
  TemplateFormatterError`. Oracle: GraphQL `Dataset { experimentJobs }`.
- **experiment-eval-error** [blind] — `safe-sql prompt v1` ran only 6 of 28 examples. Why did it
  stop? Reference: `Circuit breaker tripped (eval): Exception` after 5 evaluator errors; the
  rerun (`safe-sql prompt v1 rerun`) completed 28 and scored 12. Oracle: GraphQL `job`.
- **experiment-split** [blind] — Which dataset split did experiment `RXhwZXJpbWVudDo5Mw==` run on?
  Reference: `refusal`. Oracle: GraphQL `Experiment { datasetSplits { name } }`.
- **experiment-evaluators** [blind] — Which dataset evaluators were attached to experiment
  `RXhwZXJpbWVudDoxMDE=`? Reference: `initial_response_alignment` only. Oracle: GraphQL `job {
  datasetEvaluators }`.
- **experiment-e2e-metadata** [lookup] — Which assistant and judge models did the experiment
  `pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z` use? Reference: assistant `gpt-4.1-mini`, judge
  `gpt-4.1`, playwright project `chromium`. Oracle: experiment metadata.
- **experiment-e2e-outcome** [lookup] — What did the `pxi_outcome` judge say about the single run of
  `pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z`? Reference: `pass` (1.0), explanation beginning
  `The answer correctly identifies PHOENIX_PROJECT_NAME`. Oracle: runs with annotations.
- **experiment-regression-sha** [lookup] — Which git commit is recorded on the experiment
  `set_span-64502b8e`? Reference: `0dc26e61a087b221da2d825440da9602828d2642` (model `gpt-5.4`,
  48 runs). Oracle: metadata.
- **experiment-repetitions** [lookup] — How many repetitions did `safe-sql prompt v4
  disambiguation` use? Reference: 1. Oracle: `repetitions`.
- **experiment-by-name-id** [lookup] — What is the Phoenix id of the experiment named `safe-sql
  prompt v1 rerun`? Reference: `RXhwZXJpbWVudDoxMDU=`. Oracle: `list-experiments-for-dataset`.

## Evaluators

- **evaluator-kinds** [blind] — How many evaluators exist, by kind, counting the built-in ones?
  Reference: 11; 5 BUILTIN, 5 CODE, 1 LLM. Notes: the evaluators list and `evaluatorCount` cover
  only the 6 custom ones; the built-ins are listed separately. Oracle: GraphQL `evaluators` plus
  `builtInEvaluators`.
- **evaluator-builtins** [blind] — List the built-in evaluators. Reference: `contains`,
  `exact_match`, `regex`, `levenshtein_distance`, `json_distance`. Oracle: GraphQL
  `builtInEvaluators`.
- **evaluator-description** [blind] — What does `refusal_detection_fixed` detect that
  `refusal_detection` does not? Reference: its description names structured patterns such as
  `REFUSED:`, `unauthorized`, `permission denied` in addition to conversational phrases. Oracle:
  GraphQL `evaluators { description }`.
- **evaluator-language-sandbox** [blind] — Which language and sandbox does `safe_sql_exact_match`
  run in, and how many code versions does it have? Reference: PYTHON, `default-monty-python`
  (MONTY), 2 versions. Notes: the other four code evaluators use the `webassembly` (WASM) config
  and have one version. Oracle: GraphQL `CodeEvaluator { language sandboxConfig versionCount }`.
- **evaluator-llm-prompt** [blind] — Which prompt and tag does the `initial_response_alignment` LLM
  evaluator use? Reference: prompt `initial_response_alignment-evaluator-2d262223`
  (`UHJvbXB0Ojk=`), tag `initial_response_alignment-evaluator-b89a1ffc` on version
  `UHJvbXB0VmVyc2lvbjoxNA==`. Oracle: GraphQL `LLMEvaluator { prompt promptVersionTag }`.
- **evaluator-output-config** [blind] — What labels does `no_sql_in_output` emit, and which is
  better? Reference: `pass` = 1.0, `fail` = 0.0, MAXIMIZE. Notes: output configs live on the
  dataset attachment, not the code evaluator. Oracle: `CodeEvaluator { datasetEvaluators {
  outputConfigs } }`.
- **evaluator-direction-none** [blind] — Which dataset evaluators declare no optimisation direction?
  Reference: `refusal_detection` and `refusal_detection_fixed` on `banking_saas_dataset`
  (`optimization_direction` NONE). Oracle: `datasetEvaluators { outputConfigs }`.
- **evaluator-datasets** [blind] — Which datasets use the `first_tool_matches_expected` evaluator?
  Reference: `github-support-triage-tool-routing` only. Oracle: `CodeEvaluator { datasets }`.
- **evaluator-levenshtein-type** [blind] — Is `levenshtein_distance` categorical or continuous, and
  which direction is better? Reference: CONTINUOUS, MINIMIZE, lower bound 0. Oracle:
  `builtInEvaluators { outputConfigs }`.

## Prompts

- **prompt-count** [blind] — How many prompts are stored? Reference: 10. Oracle: GET /v1/prompts
  (MCP `list-prompts`).
- **prompt-latest-version** [blind] — What model does the latest version of `pxi-system-prompt`
  target, and what does its version note say? Reference: `gpt-4o` (OPENAI); `Improved version:
  added Tool Call Efficiency Rules section, consolidated sandbox docs, removed redundant prose`.
  Oracle: GET /v1/prompts/pxi-system-prompt/latest (MCP `get-latest-prompt`).
- **prompt-version-count** [blind] — How many versions does
  `secure-sql-generation-assistant-for-a-banking-saas-application-given-a-n_36` have, and what did
  the second change? Reference: 2; `Disambiguate refusal reasons: route PII about other
  people/customers ... Fixes SSN misclassification — 13/13 on the refusal split.`. Oracle: GET
  /v1/prompts/{name}/versions.
- **prompt-by-tag** [blind] — Which prompt version carries the `staging` tag, and which prompt is it
  on? Reference: `UHJvbXB0VmVyc2lvbjoxNA==` on `initial_response_alignment-evaluator-2d262223`;
  tag description `The version deployed to staging`. Oracle: GET /v1/prompts/{name}/tags/staging
  (MCP `get-prompt-version-by-tag`).
- **prompt-tags** [blind] — How many prompt version tags exist in total, and on which prompt?
  Reference: 2, both on `initial_response_alignment-evaluator-2d262223` version 14. Oracle: GET
  /v1/prompt_versions/{id}/tags.
- **prompt-tools** [blind] — Which tools does the latest version of
  `github-support-ticket-triage-agent` define? Reference: `get_github_issue`,
  `search_github_issues`, `apply_github_triage`. Oracle: `get-latest-prompt` tools.
- **prompt-tool-description** [blind] — How does the triage prompt describe `get_github_issue`?
  Reference: `Fetch a GitHub issue and its recent comments before classifying or changing it.`.
  Oracle: same.
- **prompt-model-change** [blind] — The prompt
  `phoenix-issue-reproduction-and-triage-agent-your-job-is-to-turn-an-unstr_4` changed model
  between versions. From what to what? Reference: `gpt-4o-mini` to `gpt-5.6-sol`; version note
  `update default model`. Oracle: `list-prompt-versions`.
- **prompt-template-format** [blind] — What template format does the `banking` prompt use, and what
  does its system message begin with? Reference: `MUSTACHE`, CHAT; `You are a chatbot that
  translates natural language queries in postgres sql queries for a single user of banking
  application.`. Oracle: `get-latest-prompt`.
- **prompt-labels** [blind] — Which prompt carries the `evaluator` label, and what colour is the
  label? Reference: `initial_response_alignment-evaluator-2d262223`; `#4ecf50`; description
  `Automatically assigned to prompts created for LLM evaluators`. Oracle: GraphQL `promptLabels`
  and `Prompt { labels }`.
- **prompt-metadata** [blind] — Which prompts have metadata, and what `source` do they record?
  Reference: `approximate-system-prompt-v1` and `approximate-system-prompt-v2`, source
  `PXI-generated` (types `system-prompt-approximation` and `system-prompt-improved`). Oracle:
  `list-prompts`.
- **prompt-luna-fix** [blind] — The latest `github-support-ticket-triage-agent` version says what
  about why it was saved? Reference: `Fix strict search tool schema validated by the completed
  Luna routing experiment.`; model `gpt-5.6-luna`. Oracle: `get-latest-prompt`.
- **prompt-created-order** [blind] — Which prompt was created most recently, and when? Reference:
  `github-support-ticket-triage-agent`, 2026-08-31 01:43:58 UTC. Oracle: `list-prompts`.

## Users, models, and settings

- **users-and-roles** [blind] — Which users exist, and what role does each have? Reference:
  `system` (SYSTEM), `admin` (ADMIN), `user-7d7113` (ADMIN); all LOCAL auth. Oracle: GET
  /v1/users or GraphQL `users`.
- **user-roles-available** [blind] — Which user roles can be assigned in this Phoenix? Reference:
  ADMIN, MEMBER, VIEWER. Notes: the SYSTEM role exists only for the built-in system user and is
  not offered by the API. Oracle: GraphQL `userRoles`.
- **model-price** [blind] — What are the input and output token prices for `gpt-5.6-sol`?
  Reference: $4.00 and $20.00 per million (4e-6 and 2e-5 per token); cache read 4e-7, cache
  write 5e-6. Oracle: GraphQL `generativeModels { tokenPrices }`.
- **model-price-cheaper** [blind] — Is `gpt-5.6-luna` cheaper than `gpt-4o-mini` on input tokens?
  Reference: no; luna is 2e-7 per token, 4o-mini is 1.5e-7. Oracle: same.
- **model-price-types** [blind] — Which token types are priced for `gpt-4o`? Reference: `input`,
  `output`, `cache_read` (no `cache_write`). Oracle: same.
- **model-count** [blind] — Are any of the registered generative models user-defined? Reference:
  no, all built-in (401 on this server). Notes: the dump holds 307 rows but the server registers
  its own built-in price table at startup, so only "none are custom" is graded. Oracle: GraphQL
  `generativeModels`.
- **model-pattern** [blind] — What name pattern matches the built-in model `gpt-5.4-2026-03-05`?
  Reference: `gpt-5\.4-2026-03-05`. Oracle: same.
- **default-retention-policy** [blind] — What is the default trace retention policy? Reference:
  `Default`, cron `0 0 * * 0`, `max_days` 0. Oracle: GraphQL `defaultProjectTraceRetentionPolicy`.
- **sandbox-providers** [blind] — Which sandbox providers are enabled, and which configs exist?
  Reference: 7 providers all enabled (WASM, E2B, DAYTONA, VERCEL, DENO, MODAL, MONTY); 3 configs:
  `webassembly` (WASM, PYTHON), `default-deno-typescript` (DENO, TYPESCRIPT),
  `default-monty-python` (MONTY, PYTHON), each with a 300 s timeout. Oracle: GraphQL
  `sandboxProviders`, `sandboxBackends`.
- **trace-recording-setting** [blind] — Does the assistant trace-recording setting allow remote
  export? Reference: yes; `allowLocalTraces` and `allowRemoteExport` are both true (system
  setting `agent.assistant.trace_recording`). Oracle: GraphQL `agentsConfig { allowLocalTraces
  allowRemoteExport }`.

## Zero-answer controls

- **no-such-trace** [lookup] — What is the root span of trace `00000000000000000000000000000000`?
  Reference: there is no such trace. Oracle: `getTraceByOtelId` returns null.
- **no-such-prompt** [blind] — What model does the prompt `customer-support-agent` use? Reference:
  no prompt with that name exists. Oracle: GET /v1/prompts/{name}/latest returns 404.
- **no-trace-annotations** [blind] — What trace annotations exist in `mobile-review-queue`?
  Reference: none; its feedback is recorded on sessions and spans, not traces. Oracle: GET
  /v1/projects/mobile-review-queue/trace_annotations is empty.
- **no-custom-providers** [blind] — Which custom model providers are configured? Reference: none.
  Oracle: GET /v1/custom_model_providers is empty.
- **no-dataset-labels** [blind] — Which labels does the dataset `save_prompt` carry? Reference:
  none; no dataset labels exist. Oracle: GET /v1/datasets/{id}/labels.

## Dropped or weak

- Anything that asks "how many spans/traces across the whole project" belongs to the SQL set.
- Agent sessions (`agentSessions`) are empty in the fixture because the scrub deletes them.
- Document annotations, experiment tags, dataset labels, API keys, and secrets have no rows;
  only the controls above touch them.
- The `Experiment-` project descriptions that embed dataset ids are machine text and make
  weak questions; `hidden-project-description` keeps one as a GraphQL-visibility probe.

## Open questions for review

- Whether to grade routing. `used_rest`/`used_graphql`/`used_sql` ride along as annotations
  today; a routing reward would penalise an agent that answers a [blind] question correctly by
  guessing, which never happens, and one that answers a [lookup] question through SQL, which is
  a judgment call.
- `trace-recording-setting` reads a system setting, so it depends on the task image not
  overriding `agent.assistant.trace_recording`; confirm on the first oracle run.
- Node ids assume the fixture's rowids survive the `VACUUM INTO`; they did for the SQL set.
