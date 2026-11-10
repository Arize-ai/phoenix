# Build Harbor tasks you can trust

A Harbor score is only as good as the task and verifier behind it. Use this guide when you write or review a task, or when scores look wrong.

For the task layout, `task.toml` fields, and network settings, use Harbor's `create-task` skill. For reward criteria and judge files, use Harbor's `rewardkit` skill. If they aren't installed, offer to install them with `npx skills add harbor-framework/harbor`.

## Decide what proves success

Before you write any file, finish this sentence: "Pass if and only if OBSERVABLE_OUTCOME." Then grade what the agent produced:

- the state it left, such as files or records in a service;
- code it wrote, which the verifier runs;
- its final reply, read from the trajectory.

When the deliverable is a file or a change, name it in the instruction. When the deliverable is an answer, grade the final reply. Don't ask the agent to write an answer file so the verifier has something easy to parse. Users don't ask agents for one, so the task stops matching real use.

## Score the outcome, not the path

Make `reward` depend on what the agent achieved, not on how it got there:

- A verifier that ignores tool names, tool-call style, and which agent ran keeps working when you change the agent or compare agents.
- A verifier that doesn't expect one trajectory doesn't fail a valid path you didn't anticipate.

Record efficiency and behavior as separate keys that don't change `reward`, such as tool-call count, turn count, or whether a skill loaded. Add them after `reward` works. When the path is the thing you're testing, check the path; this is a design goal, not a rule.

## Write the instruction

- Write it the way a user would ask. State the end state, not the steps.
- Leave out hints about grading. Hints make the task easier than real use.
- Remove ambiguity, such as rounding, units, or whether to count spans or traces, instead of accepting several answers in the verifier.
- Keep it static. Put conditions such as the agent, model, skills, and MCP servers in the job file, so every condition sees the same task and Phoenix compares them on one dataset version.

## Store the expected answer with the verifier

Put expected values in `tests/`. Harbor uploads `tests/` only after the agent stops, so the agent can't read them. Derive the value with the reference solution, through the same interfaces the agent uses, and rerun it when the fixture changes. If the fixture changes often, compute the expected value in the verifier instead.

Point `reference_output_path` at the file, as described in "Add optional reference outputs" in `SKILL.md`. Phoenix then shows the expected answer beside each run.

## Build the environment

- Pin Harbor and agent versions. A new agent version can change results.
- Seed data offline and deterministically, once per build rather than once per trial. Plant the failures the task asks about, so the expected answer is computable.
- Use an allowlist network policy with only the hosts each phase needs. Install dependencies in the image, because downloads at install time fail under an allowlist.
- If the task forbids outside material, turn off the agent's hosted web and fetch tools in its config. A provider allowlist doesn't stop the provider from fetching URLs.

## Choose the verifier mode

Use a separate verifier environment by default. It keeps grading code, judge prompts, and keys away from the agent.

Use the shared mode when the verifier must read live services or state the agent changed. Then set `[agent] user` to an unprivileged user and keep hidden files unreadable to it. In a multi-step task, an agent can otherwise read files left by earlier steps' verifiers.

## Write the verifier

- Use code for facts, such as counts, IDs, file contents, and service state. Use an LLM judge only for meaning.
- Don't grade a free-text reply by keyword or substring, because it can't tell "X" from "not X". Substring checks are fine for code and config files.
- Expect judges to reject correct paraphrases. Put accepted aliases and task rules in per-task grading notes rather than a longer shared rubric. Don't tell the judge how the agent should produce the answer.
- Write one primary `reward`, pass or fail when you can. If you use partial credit, name the aggregate `reward` so Phoenix treats it as the primary score.
- Score missing or malformed agent output as 0. Let a failure in the verifier itself, such as a judge error or a missing fixture, raise. Harbor then records an error instead of a 0 that looks like an agent failure.
- In a multi-step task, emit the same reward keys at every step. Harbor counts a missing key as 0 when it averages steps.

Write verifiers with `phoenix-evals`, `rewardkit`, or plain code. With `phoenix-evals`, you can use the same evaluators on traces, experiments, and Harbor tasks; see [phoenix-evals-verifier.md](phoenix-evals-verifier.md) for a worked example. Whichever you use, validate an LLM judge against labeled examples before you trust it. The `phoenix-evals` skill covers how.

## Prove the task before you pay for a model

Run the reference solution and the do-nothing agent. Neither calls a model:

```bash
harbor run -p TASK_PATH -a oracle
harbor run -p TASK_PATH -a nop
```

- The oracle must score 1 and `nop` must score 0, both without errors. If `nop` passes, the verifier accepts anything.
- The oracle proves only that the reference passes. Also try a correct answer phrased differently and a realistic wrong answer.
- Rerun both after changing the image, fixture, network policy, or verifier.
- Keep oracle runs out of experiment comparisons. They test the task, not an agent.

## Run in stages

1. Run one attempt per task per condition.
2. Read one trajectory per condition to confirm the setup took effect: the agent version, its skills, and its prompt.
3. Repeat with at least 3 attempts (`-k 3`), and report rates instead of single results.

Stop trials once the answer is known, with an agent hook if you can and a short agent timeout as the fallback. An early stop can undercount cost and can count a late action as a miss.

Keep agent evals out of pull-request gates until you have pass-rate history. A gate that fails without a real regression teaches people to ignore it.

## Read the results

Filter on `infra_ok` first. A trial that never started can pass a should-not-happen check.

Read full trajectories, for failures and for surprising passes. Before you change anything, name the cause of each failure:

| Cause | What went wrong | Where to look in Harbor |
| --- | --- | --- |
| Agent | The agent had what it needed and still got it wrong. Keep the score. | Trajectory |
| Task | The instruction or data was missing information, was ambiguous, or exposed the answer. | `instruction.md`, environment |
| Setup | The agent's tools, prompts, runtime, or services didn't match real use. | Trajectory, `trial.log` |
| Grader | The verifier failed a valid result or passed a wrong one. | Verifier output in the trial's `verifier/` folder |
| Infrastructure | Something crashed, timed out, or lacked a credential. The run gets no score. | `infra_ok`, run error |

Then:

- Fix the eval before you trust its score. Only the agent cause is a result.
- Keep grader fixes separate from agent changes, and keep the original scores for comparison.
- If every agent scores 1 or every agent scores 0, check for leaks and defects before you change the task's difficulty.
- To measure a skill, run the same tasks with and without it on one dataset version, on more than one agent.
