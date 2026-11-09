# Vignette: Setting Up Online Evaluation Load Testing

This vignette is for an agent whose user wants to load test online evaluations
in the devops stack. It explains which components to start, why each one is
needed, and in which order to configure them.

## The Agent's Role

The user runs the load test. The agent prepares the environment for the user,
explains what it prepared, and then helps when the user asks.

The agent's goal is to minimize the user's confusion and the work that the
user must do. Every rule below follows from this goal:

- **Do the work instead of describing it.** If a step can be done with the
  tools available, do it. Do not give the user instructions for a step that
  you can do yourself.
- **Choose sensible defaults instead of asking.** Ask the user only when a
  choice changes what they will measure and no default is reasonable. State
  each default in the handover, so that the user can change it later.
- **Do not keep the user waiting.** Once `./dev.sh up` completes and you confirm
  the fast stack checks (Toxiproxy wiring and control page URLs), delegate
  configuring the seeded custom providers, configuring/enabling the seeded
  online evaluators, and verifying the end-to-end pipeline cycle to parallel
  background subagents (`run_in_background: true`), and hand over to the user
  immediately.
- **Give the user what they need to act at once.** Give full, clickable URLs,
  the login method and credentials for each page that needs them, and the
  name of each thing you created or configured, so that the user can find it
  in the UI.
- **Prevent confusion before it occurs.** Call out only the non-obvious traps
  that can invalidate a measurement or surprise the user (for example, which
  Mock LLM sliders affect non-streaming evaluator requests, or that control
  page settings reset on container restart while database-backed evaluator
  settings persist).
- **Do not explain what the user already knows.** The user is a Phoenix
  developer who knows how online evaluations and `datagen` work. Do not
  lecture them on standard Phoenix concepts or what `datagen` seeds; state
  only the URLs, what you changed from the seeded defaults, and the traps
  above.

The agent's tasks:

- **Set up.** Start the components and configure Phoenix so that online
  evaluations run end to end.
- **Hand over.** Give the user the URLs, a brief summary of what you changed,
  and the non-obvious traps to watch for.
- **Assist on request.** Answer questions, interpret dashboards, change
  settings, or diagnose problems when the user asks.
- **Do not run the test unless the user asks.** Do not raise the load, inject
  failures, add latency, or change the evaluators on your own initiative after
  the setup is confirmed. These actions change what the user is measuring. If
  the user asks you to run the test, see [If the User Asks You to Run the
  Test](#if-the-user-asks-you-to-run-the-test).

This vignette deliberately does not give exact commands, queries, or field
names for Phoenix's APIs, because those change. Where a step depends on an
API, the vignette says what to find out and where to look.

Read [the devops README](../README.md) first. It describes the profiles, the
URLs, and the commands of `dev.sh`.

## What the User Is Testing

Online evaluations run evaluators automatically on new spans, traces, and
sessions. The pipeline has these parts:

- The **span producer** scans new spans and queues one work item for each span
  that an enabled span evaluator selects, after its filter and sampling.
- The **trace and session producers** sweep for traces and sessions that are
  ready to evaluate, and queue work for trace and session evaluators.
- A **consumer** claims queued work, loads the inputs from the database, calls
  the evaluator (for an LLM or decision evaluator, the model provider), and
  writes the result as an annotation.

A load test usually asks these questions:

- How fast does the queue grow, and does it drain when the load stops?
- How long does a work item wait in the queue, and how long does it run?
- Does span ingest slow down or reject spans while evaluations run?
- Does Phoenix stay within its memory limit?

Knowing these questions helps you explain the setup and the dashboards to the
user.

## Components and Why Each Is Needed

| Component | Profile | Why the test needs it |
| --- | --- | --- |
| Phoenix and PostgreSQL | (always) | The system under test. Use PostgreSQL, not SQLite, unless the user wants to test SQLite. |
| Mock LLM server | `mock-llm` | LLM and decision evaluators call a provider. A real provider costs money, applies its own rate limits, and has latency that the user cannot control. The mock answers like a real provider, and its dashboard controls latency, rate limiting, and error injection. |
| Datagen | `datagen` | Supplies a continuous stream of realistic traces. Without new spans, the producers have nothing to queue. |
| Grafana and Prometheus | `grafana` | Records the measurements over time. |
| Toxiproxy | `toxiproxy` | Adds network latency between Phoenix and PostgreSQL. Without it, each database round trip takes much less than a millisecond, and the test underestimates the cost of the pipeline's database work. The results then do not apply to a production deployment. |

All five components are required. Start all of them. If the user explicitly
asks to leave one out, explain what the test loses without it, then do what
the user decides. Leave Toxiproxy at its default scenario, which approximates
a database in the same cloud region; the user can change the scenario on its
control page.

The start command combines the profiles:

```bash
./dev.sh up --profiles mock-llm,datagen,grafana,toxiproxy
```

Run `./dev.sh status` with the same profiles to get the URL of each control
page and dashboard.

## Setup Steps

`./dev.sh up` with the `datagen` profile waits until Phoenix is healthy and
datagen has finished seeding its datasets, custom providers, and disabled
online evaluators. Do these steps once `./dev.sh up` completes.

The GraphQL schema (`js/app/schema.graphql`, or introspection against the
running server) tells you how to call the API. Where the schema file and the
running server disagree, the running server is correct.

### 1. Authenticate and Check the Stack Synchronously

Do these fast checks in the foreground right after `./dev.sh up`:

- **Admin bearer token:** Datagen authenticates to Phoenix with
  `Authorization: Bearer <PHOENIX_ADMIN_SECRET>`, which you can read from
  `./dev.sh env` (with the profiles passed) or `docker-compose.yml`. Pass this
  token to the background subagents for API calls. Do not create users or keys
  unless the user asks for them.
- **Toxiproxy wiring:** Confirm that Phoenix's database URL (`./dev.sh env`)
  names `toxiproxy`, not `db`, and that the Toxiproxy control page shows the
  default latency. If Phoenix was already running without the `toxiproxy`
  profile, start the stack again with all the profiles.
- **Control page URLs:** Confirm that each control page loads at its URL. In
  the default OIDC configuration (`docker-compose.yml`), Phoenix and Grafana
  auto-login through the dev OIDC server as `TestUser` (`testuser@arize.com`;
  if the OIDC user-selector page appears, click the user card). The Datagen,
  Mock LLM, Toxiproxy, and Prometheus pages require no login.

### 2. Launch Parallel Background Subagents for Provider & Evaluator Setup

Because `datagen` has already seeded both the custom providers and the online
evaluators before `./dev.sh up` returns—and because linking a decision version
to a custom provider checks only the provider's SDK, not its `baseUrl`—patching
the custom providers and enabling the online evaluators have no ordering
dependency. Launch **two parallel background subagents** (`run_in_background:
true`) in a single turn, then hand over to the user immediately without polling
or sleeping in the foreground:

#### Background Subagent A: Point the Seeded Custom Providers at the Mock LLM

Do not create new custom providers unless the user asks. Datagen seeds custom
providers for OpenAI, Anthropic, Google GenAI (Gemini), and TypeSafe with fake
credentials (`fake`) and blank base URLs. Have Subagent A query Phoenix to find
them, patch each one with its mock LLM base URL, and verify them:

- **Host and path:** the SDKs differ in whether they append `/v1` to the base
  URL. See the mock LLM README (`http://mock-llm:57593/v1` for OpenAI;
  `http://mock-llm:57593` for Anthropic, Gemini, and TypeSafe). `localhost`
  inside the Phoenix container is Phoenix itself, not the host.
- **Full config replacement:** patching a custom provider's `clientConfig`
  replaces the stored config object in full, so include the API key (`fake` or
  the redacted value from the server) alongside the base URL.
- **Verify each provider** with the credential-test mutation in the GraphQL
  schema.

#### Background Subagent B: Enable the Seeded Online Evaluators and Verify One Pipeline Cycle

Do not create new evaluators unless the user asks. Have Subagent B find the
online project evaluators that datagen seeded (leaving any dataset evaluators
untouched), point their underlying evaluator at the matching custom provider,
enable them, and then wait for one complete pipeline cycle:

- **Updating the provider.** Each custom provider's `modelTypes` field in
  GraphQL reports which evaluator kinds its SDK supports (`OPENAI` serves
  `LLM` and `DECISION`; `ANTHROPIC` and `GOOGLE_GENAI` serve `LLM`; `TYPESAFE`
  serves `DECISION`). Several project bindings can share one underlying
  evaluator definition, and a decision evaluator runs the decision version
  that its version tag points to. When saving a new decision version that sets
  the custom provider, make sure the evaluator's version tag moves to the new
  version (for example, by updating the evaluator or project binding, not only
  adding a version to the decision).
- **Whether the mock's responses are accepted.** For decision evaluators, the
  mock LLM's decision endpoints return valid answers out of the box. (If the
  user asks for an LLM evaluator instead, constrain its prompt tool's `label`
  `enum` to the allowed labels in `outputConfigs`, so that the mock's schema
  faker always returns a valid label.)
- **Timing, filter, and sampling on each binding.** For an interactive test,
  lower the quiet period (`evaluationDelaySeconds`) on trace and session
  bindings to `10` seconds (the API minimum), raise sampling to `1.0` for full
  sampling, and enable the bindings.
- **Verify one complete pipeline cycle** at the default datagen rate (without
  raising the rate):
  - Wait for the fixed `60`s visibility lag (producers read only rows at
    least this old, so late commits are seen; it is not configurable) plus
    the `10`s trace/session quiet period (`evaluationDelaySeconds`) after the
    evaluated project receives traces.
  - Confirm that requests arrive at the mock LLM server, valid evaluation
    annotations (with `0` errors) are written for `SPAN`, `TRACE`, and
    `SESSION`, and Prometheus/Grafana online evaluation metrics show work
    queued and completed.
  - If no requests arrive or evaluations fail after the waits, inspect the
    provider config and Phoenix logs to diagnose and fix the issue.

## Handing Over to the User

Immediately after launching the two background subagents, give the user a
concise handover that contains:

1. **The URLs** from `./dev.sh status` (Phoenix, Grafana `Phoenix Simple
   Monitoring` dashboard, Datagen controls, Mock LLM dashboard, Toxiproxy
   controls, and Prometheus) and how to log in to Phoenix and Grafana.
2. **What the background subagents are configuring** (the mock LLM base URLs on
   the seeded custom providers, pointing the seeded online evaluators at the
   custom provider, enabling the bindings with `evaluationDelaySeconds: 10` and
   `samplingRate: 1.0`, and verifying the first evaluation cycle).
3. **The non-obvious traps** that affect measurements or operations:
   - **Mock LLM controls:** online evaluators make non-streaming requests
     (`stream_model_output=False`), so only **Response Delay** (and the **Slow
     Response** failure mode) adds latency to evaluator calls; the streaming
     sliders (**Initial Delay**, **Chunk Delay**, **Jitter**, **Chunk Size**)
     and **Stream Interrupt Rate** have no effect.
   - **Memory limit:** the `phoenix` container has a memory limit (see
     `docker-compose.yml`), exits with code `137` (`OOMKilled`) if overloaded,
     and does not auto-restart.
   - **Persistence:** Datagen, Mock LLM, and Toxiproxy control settings are
     held in memory and reset on container restart, whereas enabled evaluators
     and custom provider URLs are stored in PostgreSQL and persist across
     restarts until disabled or wiped with `./dev.sh destroy`.

Keep the summary short enough to read in one pass. Put the URLs first, then
wait for the user.

## Assisting the User

When the user asks for help, these points are useful:

- **Interpreting results.** Before you explain a panel, check the metric
  definitions in `src/phoenix/server/prometheus.py` rather than inferring from
  the panel's title:
  - `Online Eval Evaluator Duration` (`phoenix_online_eval_evaluator_duration_seconds`)
    measures only the evaluator call itself, excluding database claim,
    hydration, and publish phases.
  - `Online Eval Evaluator Slots In Use` (`phoenix_online_eval_running_work_units`)
    counts `RUNNING` work units from claim through published result, which
    includes both database phases and the evaluator call.
  - Transient provider failures (HTTP 408/429/5xx, timeouts, connection
    errors) transition the work unit to `ERROR` with a `60`s cooldown
    (without counting toward `MAX_ATTEMPTS = 3`) and **release** the evaluator
    slot while waiting (`phoenix_online_eval_retryable_error_work_units`).
- **Attributing an effect.** Suggest that the user change one condition at a
  time and let the system settle between changes.
- **Settings.** The online evaluation settings that Phoenix exposes are in
  `src/phoenix/config.py`. Search it for the online evaluation environment
  variables. To change one, set it on the `phoenix` service and run
  `./dev.sh up`. Tell the user that this restarts Phoenix.
- **Changes on the user's behalf.** When the user asks you to change a
  condition, change only what they asked for, verify that the change took
  effect, and say what you changed.
- **Questions you can answer by looking.** When the user asks why something
  happens, look at the logs, the metrics, or the code before you answer. Do
  not ask the user to collect the evidence.

## If the User Asks You to Run the Test

Agree the plan with the user first: which conditions to change, in which
order, and when to stop. Change one condition at a time. Record for each step
the input (rate, latency, evaluator count), the queue size and oldest pending
age over time, the evaluator timing metrics, the ingest rate and rejections, and
Phoenix's memory usage. Report each run's configuration and the measured
values with their units and time windows, and separate what you measured from
what you inferred.

## Known Hazards

- **Memory limit.** The `phoenix` container has a memory limit (see
  `docker-compose.yml`). When ingest is overloaded, Phoenix can exceed it and
  the kernel stops the process. The container then exits with code 137, and
  `docker inspect` shows `OOMKilled`. Tell the user to watch the memory panel.
- **Phoenix does not restart by itself.** After a crash, run `./dev.sh up`
  with the same profiles.
- **Control settings are not persistent.** The datagen, mock LLM, and
  Toxiproxy settings are held in memory, and reset when their containers
  restart. If Toxiproxy restarts, it also loses the proxy itself, and Phoenix
  cannot reach the database until `./dev.sh up` runs `toxiproxy-init` again.
- **Image freshness.** Datagen runs the image that the `phoenix` service
  builds. After code changes, run `./dev.sh up` so that both run the code under
  test. `./dev.sh doctor` reports images that are older than their source.
- **Toxiproxy covers only Phoenix.** Grafana's PostgreSQL panels and direct
  connections to `localhost:5433` bypass the delay.
- **Cleanup.** When the user is done, the evaluators can be disabled or
  removed. Otherwise they keep calling the mock LLM and filling the queue the
  next time datagen runs, because datagen preserves their enabled state and
  custom provider across restarts. `./dev.sh destroy` removes all data,
  including the evaluators and the providers. Ask the user before you remove
  anything.
