# QUESTIONS-sql: the SQL-answered api-selection tasks

Status (2026-10-01): the task directories beside this file were generated from the entries
below, with every reference recomputed through the MCP `executeSql` tool against a local
Phoenix serving the dump. 100 tasks were written; 96 are listed here plus four zero-answer
controls. Entries not written, and why:

- The SQL tool's allowlist covers projects, traces, spans, span_annotations, span_costs,
  span_cost_details, generative_models, project_sessions, the dataset tables, experiments,
  experiment_runs, and experiment_run_annotations. Every question that needs trace or session
  annotations, annotation configs, dataset splits, evaluators, experiment jobs, prompts,
  prompt versions, PXI agent sessions, users, or token prices was dropped: annotation-counts,
  feedback-positive-rate, negative-feedback-by-project, out-of-bounds-scores,
  unconfigured-annotation-names, unused-project-configs, splits, refusal-split-detection,
  experiment-jobs, evaluator-usage, multi-version-evaluator, stale-prompt-tasks,
  unused-builtins, unused-priced-models, the whole "Prompts and playground" and "PXI agent
  sessions" sections, and the zero-answer controls on those tables.
- deepest-trace needs a recursive CTE, which the tool refuses.
- costliest-experiment was dropped as weak, as flagged below.
- References that changed when recomputed through the tool: median-session-duration (the
  tool's median averages the middle pair, giving 13.6 and 3.0 minutes for claude-code and pi)
  and spend-by-user (oncall@example.com has 8 traces costing $0.08; the earlier $1.25 double
  counted).
- The fixture is scrubbed by `environments/fixtures/sql-benchmark/scrub.py` (credentials,
  personal emails, home directories, password hashes, PXI chat history). All 100 references
  were re-verified against the scrubbed copy on 2026-10-02; only spend-by-user changed, because
  the developer's email is now the pseudonym user-7d7113@example.com.

- 2026-10-02, second pass: the claude-code and pi projects were removed from the fixture
  (their traces are recordings of developers' coding-agent sessions and held nearly all the
  sensitive text). 92 tasks remain. Retired because their answer vanished with those
  projects: pi-timeouts, subagent-types, permission-requests, case-variant-tools,
  gpt-5-6-sol-by-provider, spend-by-user, children-outliving-parents, bash-vs-edit-latency,
  mcp-execute-calls. Re-pointed at pxi_dev or the remaining data and renamed:
  claude-code-error-trace-share -> pxi-dev-error-trace-share, claude-code-first-tool ->
  pxi-dev-first-tool, claude-code-turns -> pxi-dev-llm-calls-per-session,
  costliest-claude-code-sessions -> costliest-pxi-dev-sessions, pi-timeouts ->
  approval-required-errors, fable-cost-by-token-type -> top-model-cost-by-token-type (gpt-5.6-sol),
  top-tools-case-merged -> top-tools. cache-hit-ratio-top-session, llm-vs-tool-time-share,
  tool-calls-per-trace, and cost-per-trace-by-project keep their names with pxi_dev and
  pxi_agent_tony as the subjects. Every other reference below that cites a claude-code or pi
  figure is superseded by the task's expected.json, which was recomputed on the new fixture.
- 2026-10-02, Daytona oracle run (`sql-benchmark-oracle-20261002`, scrubbed fixture from GCS):
  92 trials, no infrastructure errors, 91 graded 1.0. v3-v4-flips graded 0.0 because the
  notes required the reply to say "none regressed" while the oracle only listed the two flips;
  the oracle now prints `improved: ...; regressed: none.` and the reference matches that text.
- 2026-10-05, claude-code-mcp and PXI on five tasks each (busiest-day, cost-per-model,
  dataset-leaderboard, e2e-by-model, empty-projects): claude-code-mcp 5/5 through executeSql only;
  PXI 4/5, using executeSql on two tasks and phoenix-gql on three. Its miss was empty-projects,
  where GraphQL hides the Experiment- projects; the question now says to include them.

Draft for review. Each entry becomes one Harbor task in the shape of `trail-benchmark-dev`: a
one-line `instruction.md`, an `expected.json` with `reference`, `notes`, and `source`, graded by
`harbor_verifiers.verify`, plus a `solution/` that recomputes the reference. The fixture is
the full `~/data/phoenix.db` dump (2.4 GB, data through 2026-09-01). Every reference below was
computed with `sqlite3` directly against that file on 2026-10-01.

The questions are phrased the way a user would ask Claude over MCP or PXI. None of them mention
SQL. They are chosen because answering them through retrieval tools means paging through
thousands of spans, so an agent that routes them to `executeSql` should win on turns and cost.
The ATIF trajectory records which tools were called, so each task can carry a second reward key
for whether `executeSql` was used.

Conventions pinned for every task:

- Times are UTC. The fixture is frozen, so no question uses a relative window such as
  "last 30 days".
- Percentiles use nearest-rank.
- "Case-merged" tool names fold `Bash`/`bash`, `Read`/`read`, `Edit`/`edit`, `Write`/`write`.
- The 132 auto-created `Experiment-<hash>` projects are excluded wherever a question says
  "excluding experiment projects".
- Floats accept any rounding of the exact value, as in the TRAIL tasks.

Open questions for review:

- Fixture size. The TRAIL fixture is small; this one is 2.4 GB and the image copies it to `/data`.
  Decide whether to ship it whole, `VACUUM` it, or drop bulky tables the questions never touch.
- Some references name a `trace_id` or `session_id`. The verifier should accept a prefix.
- The oracle runs as the `agent` user and cannot read `/data`, so `solution/solve.py` must go
  through the Phoenix SQL tool over HTTP rather than `sqlite3`.

## Traces and spans

### project-trace-counts
**Ask:** Excluding experiment projects, which three projects have the most traces, and how many does each have?
**Reference:** pxi_dev 1,137; evaluators 536; dataset-evaluator-bf9a15956ceb82a3a9eb7abc 468.
**Notes:** Order matters. Accept the truncated project name `dataset-evaluator-bf9a…`.

### pxi-dev-duration-percentiles
**Ask:** What are the median and 95th percentile trace durations in the pxi_dev project, in seconds?
**Reference:** p50 4.1 s, p95 44.3 s, over 1,137 traces.
**Notes:** Accept ±0.5 s on each to allow interpolation differences. Each value must be attached to the right percentile.

### deepest-trace
**Ask:** Which trace in pxi_dev has the most deeply nested span tree, and how deep is it?
**Reference:** trace 33ea5a5264050d47881f64ba4c588d6f, depth 5 counting the root as level 1.
**Notes:** Accept depth 4 if the reply counts the root as level 0. Next deepest traces are depth 4, so the trace id must match.

### claude-code-error-trace-share
**Ask:** What fraction of traces in the claude-code project contain at least one errored span?
**Reference:** 53 of 204, 26.0%.

### top-error-signatures
**Ask:** Group every errored span by the first 40 characters of its status message. What are the three most common error signatures and their counts?
**Reference:** "VITE+ - The Unified Toolchain for the We" 32; "monty worker protocol error: invalid exc" 12; "ApprovalRequired: " 11.
**Notes:** Accept paraphrases that identify Vite build output, the monty worker protocol error, and ApprovalRequired, with counts.

### pi-timeouts
**Ask:** How many spans failed with "Command timed out after 60 seconds", and in which projects?
**Reference:** 7, all in the pi project.

### highest-error-rate-span-name
**Ask:** Among span names that occur at least 50 times, which has the highest error rate?
**Reference:** pxi.turn, 6 of 99 spans, 6.1%. Runner-up is "chat gpt-4o-mini" at 5.9%.

### pxi-dev-root-status
**Ask:** In pxi_dev, how many root spans ended OK, how many ERROR, and how many were left UNSET?
**Reference:** OK 1,084; ERROR 11; UNSET 33.

### swallowed-errors
**Ask:** How many traces have a root span with status OK but at least one descendant span with status ERROR?
**Reference:** 127.

### traces-over-100-spans
**Ask:** How many traces have more than 100 spans, and which trace has the most?
**Reference:** 38 traces; trace 104ca34f0fc8e68d323fcbc9b2a2a0e6 has 713 spans.

### exception-events
**Ask:** How many spans record an exception event?
**Reference:** 62.

### busiest-hour
**Ask:** Which hour of the day, in UTC, do the most traces start in, and how many start in that hour?
**Reference:** 13:00 to 14:00 UTC, 1,109 traces.

### pxi-dev-august
**Ask:** How many traces did pxi_dev receive in August 2026, and on how many days of that month did it receive none?
**Reference:** 47 traces; 23 days with none.

### children-outliving-parents
**Ask:** How many child spans end after their parent span ends?
**Reference:** 3,362.

### longest-span
**Ask:** What is the single longest span in the database, and how long did it run?
**Reference:** span named "Turn 3", kind LLM, about 441,273 seconds (122.6 hours).
**Notes:** Accept the duration in any unit within 1%.

### cumulative-errors-ok
**Ask:** How many spans report a nonzero cumulative error count while their own status is OK?
**Reference:** 241.

### orphan-spans
**Ask:** How many spans reference a parent span id that does not exist in the database?
**Reference:** 266.

### pxi-target-traces
**Ask:** PXI records the trace it was asked to debug in span metadata as targetTraceId. How many distinct target traces has it been asked about?
**Reference:** 3.

### llm-vs-tool-time-share
**Ask:** Summing span durations, what share of time goes to LLM spans and what share to tool spans in claude-code, pi, and pxi_dev?
**Reference:** claude-code LLM 84.0%, TOOL 2.5%; pi LLM 38.8%, TOOL 9.5%; pxi_dev LLM 37.0%, TOOL 11.9%.
**Notes:** Each pair must be attached to the right project.

### traces-ending-in-error
**Ask:** How many traces have an errored span as the last span to start?
**Reference:** 36.

### attributes-over-100kb
**Ask:** How many spans have more than 100 KB of attributes?
**Reference:** 4,493 with attributes longer than 102,400 bytes.
**Notes:** Accept answers within 2% to allow for 100,000 vs 102,400 byte thresholds.

### duplicate-trace-id-rejections
**Ask:** How many spans record a "UNIQUE constraint failed: traces.trace_id" error?
**Reference:** 2.

### busiest-day
**Ask:** Which calendar day has the most spans, and how many?
**Reference:** 2026-06-02, 4,880 spans.

## LLM usage, tokens and cost

### cost-per-model
**Ask:** What are the three most expensive models by total cost, and how much has each cost?
**Reference:** claude-fable-5 $1,431.54; gpt-5.6-sol $316.87; claude-opus-4-8 $71.87.

### fable-cost-by-token-type
**Ask:** For claude-fable-5, how does total cost split across cache read, cache write, input, output, and reasoning tokens?
**Reference:** cache_read $1,089.04 (76.1%); cache_write $202.46; output $130.13; reasoning $9.78; input $0.14.
**Notes:** Accept dollar amounts or percentages. Cache read must be identified as the dominant component.

### peak-daily-spend
**Ask:** Which project had the most expensive single day, which day was it, and what did it cost?
**Reference:** claude-code on 2026-08-12, $286.43.

### most-expensive-trace
**Ask:** Which trace cost the most, and how much?
**Reference:** trace 104ca34f0fc8e68d323fcbc9b2a2a0e6, $99.19.

### costliest-claude-code-sessions
**Ask:** What are the three most expensive sessions in claude-code?
**Reference:** 12f2fe8e-40c8-4520-a017-fa3923f7b211 $338.32; 26f9e9a7-b47c-424a-a438-35ba3ffd2a8d $309.10; afbea7fe-ea1e-40c1-b413-e2938c959156 $216.95.
**Notes:** Accept session id prefixes.

### avg-prompt-tokens-by-model
**Ask:** Among models with at least 100 LLM calls, which three have the largest average prompt size, and what is it?
**Reference:** claude-fable-5 288,275; gpt-5.6-sol 126,091; claude-opus-4-8 84,877 tokens per call.

### spans-over-200k-prompt
**Ask:** How many LLM calls had more than 200,000 prompt tokens?
**Reference:** 2,835.

### completion-prompt-ratio
**Ask:** Among models with more than one million prompt tokens, which has the highest ratio of completion tokens to prompt tokens?
**Reference:** claude-haiku-4-5-20251001 at 0.0195. Next is claude-opus-4-6 at 0.0156.

### gpt-5-6-sol-by-provider
**Ask:** gpt-5.6-sol appears under two providers. For each, how many LLM calls and how many prompt tokens?
**Reference:** openai 937 calls, 71,187,076 prompt tokens; openai-codex 1,747 calls, 266,989,708 prompt tokens.

### model-less-llm-spans
**Ask:** How many LLM spans have no model name recorded?
**Reference:** 1,324.

### unused-priced-models
**Ask:** How many models have token prices configured but have never matched a span?
**Reference:** 278.

### cache-hit-ratio-top-session
**Ask:** Which claude-code session had the highest prompt cache hit ratio, and what was it?
**Reference:** bcd2c700-5877-47d7-ab2f-860b4fcfc3bd at 99.3% of prompt tokens read from cache.
**Notes:** Two other sessions are at 99.0%, so the session id must match.

### finish-reasons
**Ask:** How are LLM calls distributed across finish reasons?
**Reference:** toolUse 2,707; stop 158; tool_calls 8; error 3; length 2; tool-calls 1; aborted 1.
**Notes:** The reply must list toolUse and stop with correct counts; the tail may be summarized.

### reasoning-token-spans
**Ask:** How many LLM calls used reasoning tokens, and what did reasoning cost in total?
**Reference:** 2,414 calls, $18.41.

### cost-per-trace-by-project
**Ask:** Which three projects cost the most per trace?
**Reference:** claude-code $7.50; pi $2.59; pxi_dev $0.19.

### gemini-spend
**Ask:** How much has been spent on Gemini models, and in which projects?
**Reference:** $0.75, all in pxi_dev.

### monthly-spend
**Ask:** What share of all-time spend happened in August 2026?
**Reference:** $1,623.55 of $1,922.17, 84.5%.

### spend-by-user
**Ask:** Which user ids appear on spans, how many sessions does each have, and what did those sessions cost?
**Reference:** user-7d7113@example.com (the scrub's pseudonym for the developer's address) 24 sessions, 204 traces, $1,312.70; oncall@example.com 1 session, 8 traces, $0.08.

### costliest-experiment
**Ask:** Of the experiments whose runs link to traces with recorded costs, which cost the most?
**Reference:** experiment 102 (playground-experiment on the phoenix-issue-reproduction prompt), $0.17.
**Notes:** Weak task: only the playground experiments link to costed traces. Consider dropping.

## Tools and agent behavior

### top-tools-case-merged
**Ask:** Treating Bash and bash as the same tool, and likewise for read, edit, and write, what are the three most-called tools?
**Reference:** bash 6,929; read 1,759; edit 1,538.

### tool-error-rate
**Ask:** Among tools called at least 100 times, which has the highest error rate?
**Reference:** safe_sql_exact_match, 5 of 118, 4.2%. bash follows at 3.7%.

### tool-calls-per-trace
**Ask:** How many tool calls does an average trace make in pi, claude-code, and pxi_dev?
**Reference:** pi 28.4; claude-code 19.7; pxi_dev 1.8.

### tool-loops
**Ask:** How many traces call the same tool more than ten times?
**Reference:** 184.

### bash-vs-edit-latency
**Ask:** What is the median latency of the bash tool compared with the edit tool, case-merged?
**Reference:** bash 0.14 s; edit 0.10 s.

### subagent-traces
**Ask:** How many traces spawn a subagent via call_subagent?
**Reference:** 47.

### subagent-types
**Ask:** Which subagent types appear on spans, and how often?
**Reference:** general-purpose 2; Explore 1.

### permission-requests
**Ask:** How many spans record a permission request, and for which tools?
**Reference:** 12: AskUserQuestion 11, ExitPlanMode 1.

### ask-user-by-project
**Ask:** How many times did agents ask the user a question (ask_user or AskUserQuestion), by project?
**Reference:** pxi_agent_tony 44; claude-code 12; pxi_dev 12.

### search-without-skill
**Ask:** In how many traces did the agent call search_phoenix without a later load_skill call in the same trace?
**Reference:** 79.

### mcp-execute-calls
**Ask:** How many times was the mcp__phoenix__execute tool called, and how many of those calls errored?
**Reference:** 35 calls, 8 errors.

### claude-code-turns
**Ask:** How many LLM turns does an average claude-code session contain?
**Reference:** 6.58 distinct turn ids per session.

### distinct-tools-per-project
**Ask:** Which two projects use the widest variety of tools, and how many distinct tool names does each have?
**Reference:** pxi_dev 56; claude-code 25.

### demo-tools
**Ask:** How many times were the weather, get_route_info, and searchProducts tools called, and in which projects?
**Reference:** weather 11 across the four openinference-vercel-* projects; get_route_info 9 in pxi_dev; searchProducts 8 in openinference-tanstack-ai-verify-20260521.

### workspace-write-blocks
**Ask:** How many tool calls were blocked for writing outside /home/user/workspace?
**Reference:** 3.

### claude-code-first-tool
**Ask:** In claude-code, which tool is called first in a trace most often, and how many traces start with it?
**Reference:** Bash, 113 traces. Read 20, Skill 9.

### case-variant-tools
**Ask:** Which tool names appear in more than one capitalization?
**Reference:** bash/Bash, edit/Edit, read/Read, write/Write.

## Sessions

### sessions-per-project
**Ask:** For the four projects with the most sessions, how many sessions and how many traces per session?
**Reference:** pxi_dev 167 sessions, 5.4 traces each; pi 50, 2.86; pxi_agent_tony 38, 10.66; claude-code 24, 8.5.

### tony-long-sessions
**Ask:** How many sessions in pxi_agent_tony have more than 20 traces?
**Reference:** 8.

### median-session-duration
**Ask:** For projects with at least 20 sessions, what is the median session duration?
**Reference:** claude-code 12.8 min; pi 2.7 min; pxi_agent_tony 1.0 min; pxi_dev 0.6 min.

### single-trace-sessions
**Ask:** How many sessions contain exactly one trace?
**Reference:** 116.

### multi-day-sessions
**Ask:** How many sessions start on one calendar day and end on another?
**Reference:** 12.

## Annotations

### annotation-counts
**Ask:** How many annotations exist on spans, on traces, and on sessions?
**Reference:** spans 66; traces 8; sessions 12.

### quality-human-vs-llm
**Ask:** For the quality annotation, how do human and LLM scores compare on average?
**Reference:** HUMAN mean 0.771 over 14; LLM mean 0.929 over 7.

### feedback-positive-rate
**Ask:** Counting user_feedback on spans, traces, and sessions together, what share is positive?
**Reference:** 8 of 19, 42.1%.

### negative-feedback-by-project
**Ask:** Which project has the highest share of negative user_feedback?
**Reference:** pxi_agent_tony, 8 of 8 negative. pxi_dev 2 of 7, mobile-review-queue 1 of 4.

### notes
**Ask:** How many freeform note annotations are there, and when was the most recent one created?
**Reference:** 22; 2026-08-30.

### out-of-bounds-scores
**Ask:** The response_quality config allows scores from 1 to 5. Which annotations violate that?
**Reference:** Two session annotations: id 4 with score 9.0 and id 100 with score 42.0.
**Notes:** Accept the two scores without ids.

### unconfigured-annotation-names
**Ask:** Which annotation names in use have no annotation config?
**Reference:** 14 names: groundedness, issue, latency_bottleneck, note, performance, pxi_quality, quality, test, test_2, test_3, test_4, test_5, test_6, trace_quality.
**Notes:** Accept "test through test_6" as a group. The count 14 and the non-test names must be present.

### unused-project-configs
**Ask:** Which annotation configs are attached to a project but have never been used in an annotation?
**Reference:** Slow, px-mobile-verify-config, review_summary.

### issue-major-kinds
**Ask:** The three spans annotated issue = major: what kinds of span are they?
**Reference:** One each: AGENT, LLM, TOOL.

### pxi-dev-annotation-coverage
**Ask:** What fraction of pxi_dev traces carry any annotation, on the trace or on any of its spans?
**Reference:** 19 of 1,137, 1.7%.

### busiest-annotation-day
**Ask:** On which day were the most annotations created, and how many?
**Reference:** 2026-05-28, 36.

## Datasets

### dataset-leaderboard
**Ask:** Which five datasets have the most experiments, and for each how many examples and versions?
**Reference:** PXI E2E Agent Tests 77 experiments, 7 examples, 7 versions; banking_saas_dataset 18, 28, 1; banking_saas_dataset_clean 5, 28, 1; github-support-triage-tool-routing 4, 12, 1; phoenix-issue-triage-initial-responses 4, 3, 1.

### splits
**Ask:** How are the examples of banking_saas_dataset_clean divided between the happy path and refusal splits?
**Reference:** happy path 15; refusal 13.

### multi-revision-examples
**Ask:** How many dataset examples have more than one revision?
**Reference:** 42.

### delete-revisions
**Ask:** How many examples have been deleted from datasets, and from which dataset?
**Reference:** 1, from banking_saas_dataset_auto_ids.

### e2e-runs-per-example
**Ask:** In PXI E2E Agent Tests, which example has been run the most times and which the fewest?
**Reference:** example 106 with 26 runs; example 112 with 1 run.

### outputs-without-reference
**Ask:** Which dataset has the most examples whose output has neither a reference nor an expected field?
**Reference:** set_spans_filter, all 48 examples.

### high-token-examples
**Ask:** In the High Token Count Spans dataset, how many examples exceed 25,000 total tokens?
**Reference:** 8 of 20.

### github-get-issue
**Ask:** How many github-support-triage-tool-routing examples expect get_github_issue as the first tool?
**Reference:** 8 of 12.

### balance-examples
**Ask:** Across all datasets, how many examples mention "balance" in their input, and in which datasets?
**Reference:** 24: six each in banking_saas_dataset, banking_saas_dataset_with_ids, banking_saas_dataset_auto_ids, banking_saas_dataset_clean.

### datasets-without-experiments
**Ask:** Which datasets have never had an experiment run against them?
**Reference:** 6: banking_saas_dataset_with_ids, banking_saas_dataset_auto_ids, High Token Count Spans (>20k), mobile-flagged-sessions, Dataset 2026-08-14T17:33:46.188Z, Dataset 2026-08-14T21:05:29.362Z.

### messages-per-input
**Ask:** Which dataset has the longest conversations in its inputs, measured as messages per example?
**Reference:** High Token Count Spans (>20k), 40.55 messages on average. The banking datasets average 1.0.

## Experiments

### safe-sql-means
**Ask:** For the five safe-sql experiments on banking_saas_dataset_clean, what is the mean safe_sql_exact_match score of each, in the order they were created?
**Reference:** v1 1.0 (6 runs); v1 rerun 0.429; v2 canonical 0.964; v3 authorization fix 0.929; v4 disambiguation 1.0.
**Notes:** The v1 experiment only ran 6 examples; the reply should not present it as a full pass.

### v3-v4-flips
**Ask:** Between safe-sql prompt v3 and v4, which examples changed their safe_sql_exact_match result, and in which direction?
**Reference:** Examples 126 and 144 went from fail to pass. Nothing regressed.

### repeat-failers
**Ask:** Across the four full safe-sql experiments (v1 rerun through v4), which examples failed safe_sql_exact_match more than once?
**Reference:** Examples 126 and 127, two failures each.

### refusal-disagreements
**Ask:** refusal_detection and refusal_detection_fixed scored the same 377 runs. How often do they disagree, and in which direction?
**Reference:** 180 disagreements: 178 where the fixed evaluator says refusal and the original says no_refusal, 2 the other way.

### refusal-split-detection
**Ask:** On the refusal-split examples of banking_saas_dataset, what fraction did refusal_detection_fixed flag as refusals in experiments 82 through 86?
**Reference:** 13 of 13 in each, 100%.
**Notes:** Weak task because the answer is a round 100%. Consider dropping.

### run-errors
**Ask:** Which experiments have runs that errored, and how many of their runs failed?
**Reference:** 90: 5 of 5; 91: 10 of 10; 101: 1 of 3; 133: 5 of 5; 134: 5 of 5.

### slowest-experiment
**Ask:** Which experiment has the slowest runs on average, and how long do they take?
**Reference:** experiment 102, 29.5 s per run.

### weakest-e2e-example
**Ask:** Which PXI E2E example has the lowest pxi_outcome pass rate across all experiments?
**Reference:** example 109, 7 of 12, 0.583.

### e2e-by-model
**Ask:** PXI E2E experiments record their assistant model in metadata. How does pxi_outcome compare across models?
**Reference:** gpt-4.1-mini 0.70 over 10 runs; gpt-5.4 0.866 over 67 runs.

### luna-failures
**Ask:** In the "Luna first-tool routing — validated evaluator" experiment, which examples failed first_tool_matches_expected?
**Reference:** Examples 256, 257, 258; 9 of 12 passed, 0.75.

### unscored-experiments
**Ask:** Which experiments have runs but no evaluation annotations at all?
**Reference:** 90, 91, 100, 133, 134.

### annotation-errors
**Ask:** How many experiment evaluation annotations recorded an error?
**Reference:** 11.

### token-heaviest-experiments
**Ask:** Which experiments consumed the most prompt tokens across their runs?
**Reference:** Experiments 82, 83, 84, each 42,375 prompt tokens.

### shared-dataset-version
**Ask:** Which dataset version has been used by the most experiments, and how many?
**Reference:** version 12, 46 experiments.

### git-sha-scores
**Ask:** Experiments record a git_sha in metadata. Which commit has the lowest correct_tools_called rate?
**Reference:** 7011be99bda5c27497fd481ed81dc7ee945681f2 at 0.952 over 21 runs; the other two commits score 1.0.
**Notes:** Accept a short sha prefix.

### limit-vs-correct
**Ask:** How many runs pass tool_call_count_within_limit but fail correct_tools_called, and how many the reverse?
**Reference:** 1 and 0.

### busiest-experiment-week
**Ask:** In which ISO week were the most experiments created, against which dataset, and how many?
**Reference:** Week 18 of 2026 (starting 2026-05-04), PXI E2E Agent Tests, 70 experiments.

### experiment-jobs
**Ask:** How many experiment jobs completed and how many errored? Which ones errored?
**Reference:** 25 completed, 6 errored: jobs 90, 91, 104, 133, 134, 135.

## Evaluators

### evaluator-usage
**Ask:** For each evaluator, how many datasets is it attached to and how many annotations has it produced?
**Reference:** The five builtins (contains, exact_match, regex, levenshtein_distance, json_distance): 0 and 0. refusal_detection, refusal_detection_fixed, no_sql_in_output: 1 dataset, 377 annotations each. safe_sql_exact_match: 1, 118. first_tool_matches_expected: 1, 18. initial_response_alignment: 1, 8.

### multi-version-evaluator
**Ask:** Which code evaluator has more than one code version?
**Reference:** safe_sql_exact_match, 2 versions.

### evaluator-latency
**Ask:** Which evaluator has the slowest 95th percentile execution time, and which the fastest?
**Reference:** initial_response_alignment 1.91 s; safe_sql_exact_match 0.05 s.

### evaluator-errors
**Ask:** Which evaluators have errored while running, and how many times?
**Reference:** first_tool_matches_expected 6; safe_sql_exact_match 5.

### stale-prompt-tasks
**Ask:** How many experiment prompt tasks point at a prompt version that is no longer the latest version of its prompt?
**Reference:** 6.

### unused-builtins
**Ask:** Which builtin evaluators have never produced an annotation?
**Reference:** All five: contains, exact_match, regex, levenshtein_distance, json_distance.

### evaluator-backends
**Ask:** How many evaluator executions ran on each sandbox backend?
**Reference:** WASMBackend 1,377; MontySandboxBackend 124.

## Prompts and playground

### multi-version-prompts
**Ask:** How many prompts have more than one version?
**Reference:** 6 of 10.

### staging-tag
**Ask:** Which prompt version is tagged staging, and how many experiments have used it?
**Reference:** Version 14 of initial_response_alignment-evaluator-2d262223; used by 0 experiments.

### unused-prompt-versions
**Ask:** How many prompt versions have never been used in an experiment?
**Reference:** 9 of 16.

### playground-project
**Ask:** How many traces are in the playground project, and what did they cost?
**Reference:** 4 traces, $0.0072.

### multi-model-prompts
**Ask:** Which prompts have versions on more than one model?
**Reference:** phoenix-issue-reproduction-and-triage-agent (gpt-4o-mini, gpt-5.6-sol) and github-support-ticket-triage-agent (gpt-4o-mini, gpt-5.6-luna).

### labeled-prompts
**Ask:** How many prompts have at least one label?
**Reference:** 1.

## PXI agent sessions

### agent-sessions-by-model
**Ask:** How many PXI agent sessions exist per model?
**Reference:** gpt-5.6-sol 7; gpt-5.5 2; gpt-5.4-mini 2; gemini-3.7-flash 2.

### agent-sessions-per-project
**Ask:** How many PXI agent sessions exist per project?
**Reference:** pxi_dev 11; assistant_agent 2.

## Housekeeping

### empty-projects
**Ask:** How many projects have no traces at all, counting the hidden per-experiment projects?
**Reference:** 79, all of them Experiment- projects. GraphQL hides those and shows 18 projects with traces, so PXI answered 0 on 2026-10-05 before the question named them.

## Zero-answer tasks

Deterministic, but the reference is zero or empty. Useful as controls against invented
findings; weak as capability tasks because "none" is a cheap guess. Include a few, not all.

| slug | Ask | Reference |
|---|---|---|
| uncosted-llm-spans | How many LLM spans have token counts but no cost record? | 0 |
| negative-feedback-error-sessions | How many sessions have both negative user_feedback and an errored span? | 0 |
| quality-disagreements | How many spans have both a human and an LLM quality score that differ by more than 0.3? | 0 (no span has both) |
| unsplit-examples | How many banking_saas_dataset_clean examples belong to no split? | 0 |
| cross-dataset-duplicates | How many example content hashes appear in more than one dataset? | 0 |
| unrun-e2e-examples | How many PXI E2E examples have never been run? | 0 |
| ephemeral-experiments | How many experiments are ephemeral? | 0 |
| orphan-experiment-projects | How many experiments name a project that does not exist? | 0 |
| runs-missing-traces | How many experiment runs reference a trace id not in the traces table? | 0 |
| orphan-experiment-project-rows | How many Experiment-* projects have no matching experiment? | 0 |
| inverted-sessions | How many sessions have a start time after their end time? | 0 |
| token-sum-mismatch | How many LLM spans report a total token count that is not prompt plus completion? | 0 |
| deleted-model-costs | How many cost records reference a soft-deleted model? | 0 |
| empty-dataset-versions | How many dataset versions have no revisions? | 0 |
| compacted-agent-sessions | How many PXI agent sessions have been compacted? | 0 |
| ephemeral-agent-sessions | How many PXI agent sessions are ephemeral? | 0 of 13 |
