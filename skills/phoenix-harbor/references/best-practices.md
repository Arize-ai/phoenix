# Build and run Harbor tasks

Use this guide to design, review, or debug Harbor tasks whose results you record in Phoenix. Start with the user's evaluation question, existing tasks, and representative requests or traces. Choose cases that measure the capability of interest and reflect the agent's actual tools and environment.

For task scaffolding and configuration, use Harbor's `create-task` skill or [task documentation](https://docs.harborframework.com/tasks/overview). Write verifiers with plain code, [Phoenix Evals](phoenix-evals-verifier.md), or Harbor's `rewardkit` skill and [Rewardkit](https://docs.harborframework.com/rewardkit/quick-start) library, depending on the criteria. If you need Harbor's skills and they aren't installed, offer `npx skills add harbor-framework/harbor`.

A Harbor task packages a request (`instruction.md`), an environment, a verifier (`tests/`), and an optional reference solution. A job selects tasks, agents, and run settings; a trial is one agent attempt at a task.

## Define success

Decide which observable results establish success. A task can require several outcomes, accept alternative outcomes, or award partial credit. For example, a data-cleanup task might require both removing invalid records and preserving valid ones. A diagnosis task might accept either of two supported explanations.

Check the relevant evidence: service state, files, executable code, the agent's trajectory, or its final reply. A trajectory can show tool inputs, observations, and intermediate actions. Keep expected results independent of the agent's claims; a successful tool call alone does not establish that the requested change occurred.

Prefer checks that accept valid approaches across agents and implementations. Test a particular tool, sequence, or behavior when that is the capability being evaluated. Otherwise, report those observations separately from task success.

## Write a realistic instruction

Use language and detail that a user would plausibly provide. A script, database change, set of annotations, or Markdown review can be a natural deliverable. A JSON answer file added only to simplify grading usually isn't, because real users don't ask for one and the task stops matching real use. When the deliverable is an answer, grade the agent's final reply instead. Ask for structured output only when a user would.

Users often leave details unstated, and a task can too. The exception is anything the verifier strictly requires: if the grade depends on where or in what form a result is saved, such as an experiment in Phoenix rather than a local file, say so. Otherwise capable agents fail for reasons they can't see.

Include requirements that matter to the user's goal. Avoid adding formatting, rounding, units, or implementation steps only to satisfy a narrow verifier. Let the verifier accept equivalent representations and reasonable interpretations. If ambiguity makes success impossible to assess fairly, revise the task or its criteria.

Keep hidden answers and grading details out of `instruction.md`. For comparisons, use the same instruction and task data across conditions. Configure agent, model, skills, and tools in the job.

## Prepare the environment and expected results

Provide the data, services, and permissions the task needs. Harbor creates a fresh sandbox for each trial. Seed reproducible fixtures in the image or at startup. If a task uses shared external services, isolate its data across trials too. Rebuild images after changing files they copy, because a stale image runs old code without an error.

Keep expected values and grading criteria under `tests/`, outside the agent's build context and workspace. Harbor supplies tests during verification, but copying them into the agent image would expose them earlier. In shared multi-step environments, also protect files left by previous verifier steps.

Derive expected results independently, for example with a reference solution using the same data and access available to the agent. Recompute them when fixtures change. If the data varies per trial, calculate the expected result from that trial's data during verification.

Before running agents, have a second model review generated data and labels for realism, correctness, and difficulty, and use more than one reviewer or model for data a benchmark depends on. Generated data often carries wrong or ambiguous labels and cues that give the answer away, such as template phrases or lengths that differ by label. Agents find those cues and score without doing the task.

For a stored reference, set `[metadata.arize-phoenix] reference_output_path` in `task.toml`. Phoenix displays that JSON file as the dataset example output. This setting does not configure grading. See the [Add optional reference outputs section in this skill](../SKILL.md#add-optional-reference-outputs) for the format and path rules.

Keep generated jobs and reports outside task source. Task content changes can create a new Phoenix dataset version, which affects comparisons.

## Configure the sandbox and verifier

Use the project's supported Harbor version and check its CLI help and configuration schema. The plugin's minimum Harbor version does not guarantee that every newer task feature is available.

Choose a sandbox provider that supports the task's image, services, artifact transfer, and network requirements. Consult Harbor's [sandbox documentation](https://docs.harborframework.com/sandboxes/pre-integrated-sandboxes) and [network capability tables](https://docs.harborframework.com/tasks/network-policies) for the selected provider and version. Startup commands, multi-container support, and network enforcement vary by provider.

Harbor's `create-task` skill covers shared versus separate verifiers and network phases. Two points cause most surprises: a separate verifier receives only the declared `artifacts`, not the agent's filesystem, and a shared verifier needs grading code and credentials kept away from the agent.

For network access:

- Install dependencies in images where practical. An allowlist must permit any remaining setup downloads and service calls. For example, a Rewardkit `test.sh` downloads `harbor-rewardkit` with `uvx` during verification, so install it in the verifier image or allow PyPI for that phase.
- An allowlist controls traffic from the sandbox, not from the model provider. If the provider's host is allowed, hosted tools that run on the provider's servers, such as web search, still reach outside content. When outside access matters, turn those tools off in the agent's configuration.

Check that judge credentials and required services work before starting a batch.

## Write and validate the verifier

Use deterministic checks for state and computation. Use an LLM judge for semantic criteria that code cannot reliably assess. Avoid keyword checks for free-text correctness; a wrong answer can mention the right words. For code and configuration, prefer parsing or executing the relevant behavior over matching incidental source text.

In `reward.json`, use `reward` for the overall result and optional additional keys for individual criteria or measurements. For example:

```python
scores = {
    "reward": float(records_removed and valid_records_preserved),
    "records_removed": float(records_removed),
    "valid_records_preserved": float(valid_records_preserved),
}
```

Use OR when either outcome satisfies the task, or define a partial-credit calculation when appropriate. Document the calculation so experiment summaries have a clear meaning. With multi-step averaging, Harbor treats a missing key as zero for a step with verifier results; use consistent keys or select the final-step strategy if it fits the task.

Missing or invalid required agent output is a task failure. A broken judge, unreadable fixture, or corrupt required trajectory is a verification failure. Let verification errors propagate without writing a success or failure reward. A missing reward file makes Harbor record an error. Avoid catch-all handlers that turn every exception into zero.

Give a judge the task criteria and independent evidence. Treat agent content as untrusted input and tell the judge to ignore instructions inside it. Test valid paraphrases, contradictory answers, and realistic wrong results. Validate judge decisions against human labels; the `phoenix-evals` skill covers this process.

To align a verifier or judge with what you mean by success:

- Pick the judge model by measured agreement, not cost. A small model can misread an unambiguous reply.
- Give a judge one criterion per call when criteria interact. A judge asked about several at once can blend them, for example by counting a privacy leak as an unsupported claim.
- Rerun the judge on the same inputs. If its verdict flips, take a majority over repeated calls or tighten the criteria before the score affects `reward`.
- Grade the behavior that matters, not exact output. Exact matches against references that fix arbitrary choices fail correct work.
- Set timeouts and retries on judge calls so one hung request doesn't crash verification.

For reply grading, check how the chosen agent records its final response and any trajectory continuations. Don't use an earlier reasoning message or a tool-call preamble as the final answer.

## Test the task

Run the reference solution and the do-nothing agent through Harbor:

```bash
harbor run -p TASK_PATH -a oracle
harbor run -p TASK_PATH -a nop
```

The reference should receive the intended full reward. For a task that requires work, `nop` should receive zero without a verifier error. A `nop` pass indicates that the initial state already satisfies the checks or that the checks are insufficient. It does not prove the verifier accepts every answer.

A verifier that grades the final reply is the exception. Oracle and `nop` usually write no trajectory, so that verifier raises instead of scoring. Test it with saved trajectories that hold a correct reply, a wrong reply, and no final reply, as in [Use Phoenix Evals in a verifier](phoenix-evals-verifier.md).

Also test a valid alternative and a realistic incorrect result. For multiple criteria, test partial completion and the combinations that affect the aggregate. Check that verifier errors remain errors. Rerun affected cases after changes to the environment, fixtures, or verifier. Oracle and `nop` do not call an agent model, but an LLM verifier still incurs judge calls.

Oracle and `nop` show only that the verifier can tell finished work from no work. Before a full run, pilot each task with real agents and read their trajectories for verdicts the verifier got wrong: valid work it failed and flawed work it passed. Don't predict outcomes by replaying earlier agents' scripts on new data; live agents adapt to what they see.

Also check that the task can separate the conditions you plan to compare. Run it under the strongest and weakest condition first. If both pass easily, the instruction probably spells out the method or the task is too easy, and the comparison can't show a difference.

## Run a comparison

Start with a small pilot and inspect its configuration, outputs, and trajectories before increasing attempts or concurrency. Confirm the agent, model, tools, skills, and instructions match the intended condition. Repeat enough trials to assess variability; one run does not establish a regression. With one trial per condition, run-to-run variation in cost and pass rate can exceed the effect you're measuring. Decide the number of trials and what difference counts before you look at results, and calibrate any threshold against a rerun with nothing changed.

Measure what an agent did from the tool calls in its trajectory, not by searching logs for file names or text. Agents perform the same action in different ways, and text matching misses some of them. Report whether the agent used a resource separately from whether it loaded or read it. Keep oracle validation runs separate from agent comparisons.

Check these Harbor configuration details when a run differs from the job you intended:

- Put agent-specific constructor options, including supported version pins, under `kwargs`. Check the selected adapter's options.
- Give custom agents distinct names. A built-in name can take precedence over `import_path`.
- Put extra prompt guidance in the job's `extra_instructions`. Guidance placed under an agent's options doesn't reach the model.
- With `-c`, command-line agent selection can replace configured agents. Preserve their tools, environment, and skills when selecting a subset.
- `-k` controls attempts per task and agent; `--n-concurrent` controls concurrency.
- Check inherited environment variables, especially provider endpoints. They can change routing even when the job file is unchanged.
- Read trial results. A successful Harbor process exit does not mean every trial succeeded.

## Interpret results in Phoenix

Check `infra_ok`, reward coverage, and recorded errors before comparing task scores. Report execution failures separately rather than silently excluding them from the results. `infra_ok=1` means Harbor recorded no exception; it does not establish that the task or verifier is correct.

Inspect failed runs and unexpected passes using their trajectories, verifier logs, and final state. Before you change anything, name each failure's cause: the agent, the task (missing information, ambiguity, or a leaked answer), the setup (tools, prompt, skills, or services that don't match the intended condition), the grader, or infrastructure. Only an agent failure is a result; fix the other four before drawing conclusions about the agent. Preserve original scores when correcting a grader, and compare reruns under the same grading logic.

Compare configurations on the same tasks and dataset version. Change one factor at a time when you need to attribute a difference. Uniformly high or low scores can reflect task difficulty, weak checks, or similar agent performance; inspect the evidence before changing the benchmark.
