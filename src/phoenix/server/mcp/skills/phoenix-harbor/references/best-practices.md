# Build and run Harbor tasks

Use this guide to design, review, or debug Harbor tasks whose results you record in Phoenix. Start with the user's evaluation question, existing tasks, and representative requests or traces. Choose cases that measure the capability of interest and reflect the agent's actual tools and environment.

For task scaffolding and configuration, use Harbor's `create-task` skill or [task documentation](https://docs.harborframework.com/tasks/overview). If you need Harbor's skills and they aren't installed, offer `npx skills add harbor-framework/harbor`. Write verifiers with plain code, [Phoenix Evals](phoenix-evals-verifier.md), or Harbor's [Rewardkit](https://docs.harborframework.com/rewardkit/quick-start), depending on the criteria.

## Task structure

A Harbor task packages a request, an execution environment, and a verifier. Create a task with `harbor task init ORG/TASK_NAME`. For a single-step task:

- `instruction.md` contains the request the agent receives.
- `task.toml` configures resources, timeouts, network access, artifacts, and verifier settings.
- `environment/` defines the sandbox and its initial files and data.
- `tests/test.sh` runs the verifier and writes rewards. Other files in `tests/` hold grading code and reference data.
- `solution/solve.sh` is an optional reference solution, run by Harbor's oracle agent.

A job selects tasks, agents, and run settings. A trial is one agent attempt at a task. Use Harbor's `create-task` skill for scaffolding and details such as multi-step tasks and separate verifier images.

## Define success

Decide which observable results establish success. A task can require several outcomes, accept alternative outcomes, or award partial credit. For example, a data-cleanup task might require both removing invalid records and preserving valid ones. A diagnosis task might accept either of two supported explanations.

Check the relevant evidence: service state, files, executable code, the agent's trajectory, or its final reply. A trajectory can show tool inputs, observations, and intermediate actions. Keep expected results independent of the agent's claims; a successful tool call alone does not establish that the requested change occurred.

Prefer checks that accept valid approaches across agents and implementations. Test a particular tool, sequence, or behavior when that is the capability being evaluated. Otherwise, report those observations separately from task success.

## Write a realistic instruction

Use language and detail that a user would plausibly provide. A script, database change, set of annotations, or Markdown review can be a natural deliverable. Asking for a JSON answer file solely to simplify grading often isn't. Choose the deliverable to fit the task; this is a design consideration, not a ban on structured output.

Include requirements that matter to the user's goal. Avoid adding formatting, rounding, units, or implementation steps only to satisfy a narrow verifier. Let the verifier accept equivalent representations and reasonable interpretations. If ambiguity makes success impossible to assess fairly, revise the task or its criteria.

Keep hidden answers and grading details out of `instruction.md`. For comparisons, use the same instruction and task data across conditions. Configure agent, model, skills, and tools in the job.

## Prepare the environment and expected results

Provide the data, services, and permissions the task needs. Harbor creates a fresh sandbox for each trial. Seed reproducible fixtures in the image or at startup. If a task uses shared external services, isolate its data across trials too.

Keep expected values and grading criteria under `tests/`, outside the agent's build context and workspace. Harbor supplies tests during verification, but copying them into the agent image would expose them earlier. In shared multi-step environments, also protect files left by previous verifier steps.

Derive expected results independently, for example with a reference solution using the same data and access available to the agent. Recompute them when fixtures change. If the data varies per trial, calculate the expected result from that trial's data during verification.

For a stored reference, set `[metadata.arize-phoenix] reference_output_path` in `task.toml`. Phoenix displays that JSON file as the dataset example output. This setting does not configure grading. See the [Add optional reference outputs section in this skill](../SKILL.md#add-optional-reference-outputs) for the format and path rules.

Keep generated jobs and reports outside task source. Task content changes can create a new Phoenix dataset version, which affects comparisons.

## Configure the sandbox and verifier

Use the project's supported Harbor version and check its CLI help and configuration schema. The plugin's minimum Harbor version does not guarantee that every newer task feature is available.

Choose a sandbox provider that supports the task's image, services, artifact transfer, and network requirements. Consult Harbor's [sandbox documentation](https://docs.harborframework.com/sandboxes/pre-integrated-sandboxes) and [network capability tables](https://docs.harborframework.com/tasks/network-policies) for the selected provider and version. Startup commands, multi-container support, and network enforcement vary by provider.

Prefer a separate verifier environment when grading needs only exported files or other artifacts. Declare the required artifacts explicitly; a separate verifier does not inherit the agent's filesystem. Use shared verification when the verifier needs live state that cannot be exported. In that case, restrict the agent's access to grading code and credentials. See [separate verification](https://docs.harborframework.com/tasks/separate-verifier).

Select network access for environment startup, agent execution, and verification. Install dependencies in images where practical. An allowlist must permit any remaining setup downloads and service calls. Phase overrides require support for changing network policy at runtime; separate environments can instead use different baseline policies. Provider-hosted browsing tools may fetch content outside sandbox network controls, so configure those tools too when outside access matters.

Supply judge credentials through verifier configuration, not the image or agent prompt. Check that required credentials and services work before starting a batch.

## Write and validate the verifier

Use deterministic checks for state and computation. Use an LLM judge for semantic criteria that code cannot reliably assess. Avoid keyword checks for free-text correctness; a wrong answer can mention the right words. For code and configuration, prefer parsing or executing the relevant behavior over matching incidental source text.

Write numeric scores to `/logs/verifier/reward.json`, or a single number to `/logs/verifier/reward.txt`. Use `reward` for the overall result and optional additional keys for individual criteria or measurements. For example:

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

For reply grading, check how the chosen agent records its final response and any trajectory continuations. Do not use an earlier reasoning message or a tool-call preamble as the final answer. Oracle and `nop` agents may provide no trajectory, so plan how to validate reply-based verifiers with representative saved trajectories.

## Test the task

Run the reference solution and the do-nothing agent through Harbor:

```bash
harbor run -p TASK_PATH -a oracle
harbor run -p TASK_PATH -a nop
```

The reference should receive the intended full reward. For a task that requires work, `nop` should receive zero without a verifier error. A `nop` pass indicates that the initial state already satisfies the checks or that the checks are insufficient. It does not prove the verifier accepts every answer.

Also test a valid alternative and a realistic incorrect result. For multiple criteria, test partial completion and the combinations that affect the aggregate. Check that verifier errors remain errors. Rerun affected cases after changes to the environment, fixtures, or verifier. Oracle and `nop` do not call an agent model, but an LLM verifier still incurs judge calls.

## Run a comparison

Start with a small pilot and inspect its configuration, outputs, and trajectories before increasing attempts or concurrency. Confirm the agent, model, tools, skills, and instructions match the intended condition. Repeat enough trials to assess variability; one run does not establish a regression. Keep oracle validation runs separate from agent comparisons.

Check these Harbor configuration details when a run differs from the job you intended:

- Put agent-specific constructor options, including supported version pins, under `kwargs`. Check the selected adapter's options.
- Give custom agents distinct names. A built-in name can take precedence over `import_path`.
- With `-c`, command-line agent selection can replace configured agents. Preserve their tools, environment, and skills when selecting a subset.
- `-k` controls attempts per task and agent; `--n-concurrent` controls concurrency.
- Check inherited environment variables, especially provider endpoints. They can change routing even when the job file is unchanged.
- Read trial results. A successful Harbor process exit does not mean every trial succeeded.

## Interpret results in Phoenix

Check `infra_ok`, reward coverage, and recorded errors before comparing task scores. Report execution failures separately rather than silently excluding them from the results. `infra_ok=1` means Harbor recorded no exception; it does not establish that the task or verifier is correct.

Inspect failed runs and unexpected passes using their trajectories, verifier logs, and final state. Distinguish an agent error from an unclear task, an incorrect setup, a grader error, or an execution failure. Fix evaluation defects before drawing conclusions about the agent. Preserve original scores when correcting a grader, and compare reruns under the same grading logic.

Compare configurations on the same tasks and dataset version. Change one factor at a time when you need to attribute a difference. Uniformly high or low scores can reflect task difficulty, weak checks, or similar agent performance; inspect the evidence before changing the benchmark.
