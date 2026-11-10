# Harbor gotchas

Configuration mistakes that fail silently or cost money. Check the installed Harbor version's help and source when a behavior matters, because Harbor changes often.

## Agents and jobs

- A custom agent named like a Harbor built-in, such as `codex` or `claude-code`, runs the built-in agent and ignores `import_path`. Give custom agents their own names.
- Agent entries have no `version` field. Pin a version with `kwargs.version`.
- Harbor drops agent constructor arguments that aren't under `kwargs`, without an error.
- With a job file (`-c`), `harbor run -a NAME` replaces the job's agents and drops their MCP servers, environment, and skills. `-a oracle` with a task path (`-p`) is fine. To run part of a job, write a smaller job file.
- Extra prompt guidance goes in the job's `extra_instructions`. Placed under an agent's options, it never reaches the model.
- To confirm what ran, read the trajectory and `trial.log`, not the job config.
- `-k` sets attempts per trial. Parallelism is `--n-concurrent`.
- Harbor can exit 0 while trials fail. Read per-trial results.
- Environment variables in the shell that launches Harbor can leak into agents. An inherited `ANTHROPIC_BASE_URL`, for example, breaks Claude Code trials.
- Preflight every credential the job needs, including the judge's. A missing judge key wastes the whole run.

## Network

- With an allowlist, a wrong version pin fails at setup and costs nothing. Without one, Harbor can silently install the latest agent version instead.
- An allowlist blocks downloads during agent install and service startup. Install them in the image.
- `rewardkit`'s `test.sh` downloads `harbor-rewardkit` with `uvx` during verification. Under an allowlist, install it in the image or allow PyPI for the verifier.
- Some environments can't change network policy after start, such as Daytona with a Compose file. There, every phase uses the same policy, so a host only the verifier needs goes in the `[environment]` baseline or in a separate verifier environment.
- Docker enforces an allowlist only when the host supports Harbor's egress control. Harbor refuses the run if it can't enforce it.

## Environment

- Daytona doesn't run image entrypoints. Start services in `[environment.healthcheck]`.
- Rebuild or restage after changing anything the image copies. A stale image runs old code without warning.
- Files under `environment/`, `tests/`, and `solution/` are part of the task's content hash. A generated file there creates a new Phoenix dataset version. List generated files in a `.gitignore` inside the task.
- On Daytona, warm a new image with one trial before you raise concurrency. Many simultaneous uploads of a new build context can time out.

## Verifiers

- A verifier that exits without writing `reward.txt` or `reward.json` produces a trial error, not a reward of 0.
- When steps are averaged, Harbor counts a reward key missing from one step as 0.
- A `nop` or oracle run writes no agent trajectory. A verifier that grades the trajectory needs a fallback for those runs; see [phoenix-evals-verifier.md](phoenix-evals-verifier.md).
