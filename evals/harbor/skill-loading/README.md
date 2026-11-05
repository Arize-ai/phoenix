# Skill loading evals

A loading eval checks which skills an agent loads for one request. Each case is a Harbor
task. The agent gets the request, the trial stops soon after the agent decides which skills
to load, and the verifier records every skill it loaded.

## Write a loading case

These rules apply to any Harbor loading eval.

- **One request per task.** Write it the way a user would type it. Name the skill or the
  product only if a user would.
- **Label every skill the request should load.** List them in `skills_expected`. A request
  can need more than one skill. For a request that another skill covers, list that skill.
  For a request that needs none, leave the list empty.
- **Label the skills that must not load.** For a should-not-load case, list the skill under
  test in `skills_unexpected`. Without it, an empty `skills_expected` passes every trial.
- **Balance the cases.** Write as many should-load cases as should-not-load cases. Include
  requests that a sibling skill covers, and requests that share words with the skill but
  need no skill.
- **Add files only when the request needs them.** A request such as "add tracing to this
  app" needs the app in the working directory.
- **Tag cases if it helps you group results.** Tags are documentation. Nothing scores them.
- **Stop the trial early.** Loading is decided before the agent does the task, so a full
  run spends most of its cost after the answer is known. End the session at the agent's
  first action that isn't a skill load, and keep a short agent timeout as a fallback.
- **Grade only what loaded.** Don't grade the reply. The trial stops before there is one.
- **Run each case several times.** Report each case's load rate, such as 2/3, instead of a
  pass or fail.
- **Pin the agent versions.** A new agent version can change which skills it loads. Bump the
  pin on purpose and compare the results.
- **Have a person review each case.** Check that the request is one a user would send, and
  that the labels match what a maintainer would expect.

## Phoenix layout

The Phoenix loading evals live in this folder, outside `evals/harbor/tasks/` so that
`make harbor-stage` doesn't stage them. Run them by hand. They don't run on
pull requests.

```text
evals/harbor/skill-loading/
  build_image.sh                    builds phoenix-skill-loading:local
  image/                            the base image: agents, stop scripts, verifier
  job.yaml                          the agents, their stop settings, and the attempts
  tasks/SKILL_NAME/CASE_ID/
    instruction.md                  the request
    task.toml                       name, skill, optional tags, timeouts
    environment/Dockerfile          FROM phoenix-skill-loading:local
    environment/FILE                optional fixture, copied into /app
    tests/expected.json             the labels
    tests/test.sh                   identical in every task
```

Each skill has at least 5 should-load cases and 5 should-not-load cases. Tags are loose
labels such as `sibling`, `near-miss`, and `plugin-eval` (a case ported from the
`claude plugin eval` suite in `plugins/claude/arize-phoenix/evals/`).

### Add a skill

1. Create `tasks/SKILL_NAME/` and write its cases as described in [Add a case](#add-a-case).
   Write 5 should-load cases and 5 should-not-load cases. Make at least 2 of the
   should-not-load cases requests that a sibling skill covers, and label that sibling in
   `skills_expected`.
2. Add `- path: evals/harbor/skill-loading/tasks/SKILL_NAME` under `datasets` in `job.yaml`,
   so that a plain `harbor run -c job.yaml` includes it.
3. If the skill isn't under `agents[].skills` in `job.yaml`, add `skills/SKILL_NAME` there.
   Every agent sees every listed skill, so a new skill can change what loads for other
   skills' cases.
4. Run the job, as described in [Run the evals](#run-the-evals), and read each new case's
   load rate before you rely on it.

To port a `claude plugin eval` case, copy the request from its `prompt.md` without the front
matter. Take the labels from its `skill-fired` or `skill-not-used` grader, and tag the case
`plugin-eval`. A loading task can't port the case's other graders, because the trial stops
before the agent answers.

### Add a case

1. Copy a case folder in `tasks/SKILL_NAME/` and rename it. Use a short, lowercase
   `CASE_ID` that describes the request.
2. Write the request in `instruction.md`.
3. In `task.toml`, set `[task].name` to `arize/skill-loading-SKILL_NAME-CASE_ID` and
   `description` to the request. Set `[metadata].tags` if you want them.
4. Set the labels in `tests/expected.json`. `skill` is the skill under test:

   ```json
   {"skill": "phoenix-tracing", "skills_expected": ["phoenix-tracing"]}
   {"skill": "phoenix-tracing", "skills_expected": ["phoenix-cli"], "skills_unexpected": ["phoenix-tracing"]}
   {"skill": "phoenix-tracing", "skills_expected": [], "skills_unexpected": ["phoenix-tracing"]}
   ```

5. For a fixture, put the file in `environment/` and add
   `COPY --chown=agent:agent FILE /app/FILE` to the task's Dockerfile. Give a Python fixture
   a file name that no other file under `evals/` uses, because `mypy` rejects duplicate
   module names.

### Scores

`tests/test.sh` scores the trial with `harbor_verifiers.skills`, and the Phoenix plugin
records each score as an evaluation.

| Score | 1 if |
| --- | --- |
| `skill_loaded` | The agent loaded `skill`. Its mean over attempts is the case's load rate. |
| `expected_skills_loaded` | The agent loaded every skill in `skills_expected`. |
| `no_unexpected_skills` | The agent loaded no skill in `skills_unexpected`. |
| `reward` | Every other score above is 1. |

`details.json` lists the loaded skills under `loaded_skills`. Filter out trials whose
`infra_ok` is 0: a trial that fails to start loads nothing, so it passes every
should-not-load case.

### How each agent stops

- **Claude Code** runs `image/stop_after_skill_load.py` as a `PreToolUse` hook, set
  through the agent's `config` in `job.yaml`. `max_turns` is a second limit.
- **Codex** runs hooks from its config only after you trust them, so the image replaces
  `codex` with `image/codex_wrapper.py`. When the job sets `SKILL_LOADING_STOP=1`, the
  wrapper reads `codex exec --json` events and stops Codex at its next model response
  after an action that isn't a skill load.
- `[agent].timeout_sec` in each `task.toml` is the fallback. Harbor doesn't retry an agent
  timeout, and it still scores the partial trajectory.

### Run the evals

1. Build the base image. Rebuild it after changing `image/` or `harbor_verifiers`:

   ```bash
   ./evals/harbor/skill-loading/build_image.sh
   ```

2. Build the client wheel that provides the Phoenix plugin:

   ```bash
   uv build --wheel packages/phoenix-client --out-dir dist/phoenix-client
   ```

3. To run one agent, write a subset of the job:

   ```bash
   uv run --script evals/harbor/scripts/subset_job.py evals/harbor/skill-loading/job.yaml \
     --agents codex-loading --out evals/harbor/.cache/skill-loading-codex.yaml
   ```

4. Run the job on local Docker for one skill and record it to phoenix-devs. The Phoenix
   plugin records one dataset per job, so `-p` selects the skill's tasks. Name the job after
   the commit so that experiments stay apart:

   ```bash
   PYTHONPATH=. SKILL=SKILL_NAME proj keys --env llm --env phoenix-railway -- sh -c \
     'PHOENIX_COLLECTOR_ENDPOINT="$PHOENIX_AGENTS_COLLECTOR_ENDPOINT" exec \
     uvx --python 3.13 --from "harbor[daytona]==0.21.0" --with "$(ls dist/phoenix-client/*.whl)" \
     harbor run -c evals/harbor/.cache/skill-loading-codex.yaml \
     -p "evals/harbor/skill-loading/tasks/$SKILL" \
     --job-name "skill-loading-$(git rev-parse --short HEAD)-codex-loading-$SKILL" \
     --plugin arize-phoenix --plugin-kwarg "dataset=skill-loading-$SKILL" --yes'
   ```

   Replace `SKILL_NAME` with a folder name in `tasks/`. Each example in the dataset has its
   tags in its metadata.

The Claude Code agent needs an `ANTHROPIC_API_KEY` that is scoped to a workspace.
