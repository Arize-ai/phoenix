# Harbor Exec Examples

Use these as starting points. Confirm exact flags with the installed `harbor exec --help` when needed. Keep model names current with the latest broadly available provider releases.

## Simple One-Off Run

```bash
harbor exec \
  -p ./reports/customer-a \
  -i "Read the copied report files and write /app/summary.md." \
  -f /app/summary.md \
  -e modal \
  -a codex \
  -m openai/gpt-5.5
```

Show the final command to the user before launch. Use `modal`, `daytona`, or `e2b` for cloud sandboxing unless the user explicitly wants local `docker`.

## Fan Out A Glob Into One Task Per Match

```bash
harbor exec \
  -p './inputs/*.json' \
  --scan \
  --limit 25 \
  -i "Process this input and write /app/result.json." \
  -f /app/result.json \
  -e daytona \
  -a codex \
  -m openai/gpt-5.5 \
  -n 4
```

Use `--scan` explicitly when each match should become a separate task. Use `--no-scan` when one task should receive the whole path set.

## Use An Instruction File

```bash
harbor exec \
  -p ./workspace \
  --instruction-path ./prompts/review.md \
  -f /app/review.json \
  -e e2b \
  -a codex \
  -m openai/gpt-5.5
```

Artifact auto-inference does not inspect instruction files. Pass `-f/--artifact` explicitly.

## Reduce With A Custom Reducer Agent

```bash
harbor exec \
  -p './reports/*' \
  --scan \
  -i "Summarize this report into /app/summary.md." \
  -f /app/summary.md \
  -e modal \
  -a codex \
  -m openai/gpt-5.5 \
  --reduce-instruction "Read staged map outputs under artifacts/ and write /app/rollup.md." \
  --reduce-artifact /app/rollup.md \
  --reduce-agent claude-code \
  --reduce-model anthropic/claude-fable-5
```

The map phase uses `codex` with `openai/gpt-5.5`; the reduce phase overrides that with `claude-code` and `anthropic/claude-fable-5`.

## Minimal ExecConfig YAML

In config files, `output_dir` is the nested compiled-task directory field. In flags mode, use `--tasks-dir` for the same task-writing path and `--jobs-dir` for job results.

```yaml
schema_version: "1.0"
map:
  compile:
    instructions:
      - text: "Read the copied report files and write /app/summary.md."
    artifacts:
      - /app/summary.md
    environments:
      - paths:
          - ./reports/customer-a
        docker_image: ubuntu:latest
        workdir: /app
    verifiers:
      - auto_verifier:
          required_artifacts:
            - /app/summary.md
  job:
    job_name: customer-a-summary-map
    n_attempts: 1
    n_concurrent_trials: 4
    environment:
      type: daytona
    agents:
      - name: codex
        model_name: openai/gpt-5.5
```

Run it with:

```bash
harbor exec --config exec.yaml
```

Do not add flags mode options when `--config` is present. Use `--print-config` only when debugging config resolution.

## Map-Reduce ExecConfig YAML

```yaml
schema_version: "1.0"
map:
  compile:
    instructions:
      - text: "Summarize this input into /app/summary.md."
    artifacts:
      - /app/summary.md
    environments:
      - paths:
          - ./reports/customer-a
        docker_image: ubuntu:latest
        workdir: /app
      - paths:
          - ./reports/customer-b
        docker_image: ubuntu:latest
        workdir: /app
    verifiers:
      - auto_verifier:
          required_artifacts:
            - /app/summary.md
  job:
    job_name: report-rollup-map
    n_attempts: 1
    n_concurrent_trials: 2
    environment:
      type: e2b
    agents:
      - name: codex
        model_name: openai/gpt-5.5
reduce:
  task:
    instruction:
      text: "Read staged map outputs under artifacts/ and write /app/rollup.md."
    artifacts:
      - /app/rollup.md
    environment:
      docker_image: ubuntu:latest
      workdir: /app
    verifier:
      auto_verifier:
        required_artifacts:
          - /app/rollup.md
  job:
    job_name: report-rollup-reduce
    n_attempts: 1
    n_concurrent_trials: 1
    environment:
      type: e2b
    agents:
      - name: codex
        model_name: openai/gpt-5.5
```

The reducer task receives map trial artifacts at `environment/artifacts` before execution. The instruction should tell the reducer where to read them.

## Debugging Checklist

- If no instruction is present, pass `--instruction`, `--instruction-path`, or a task template containing `instruction.md`.
- If `--limit` fails, confirm scanned mode is active.
- If reduce fails early, confirm the map phase produced trial artifacts and `map.compile.artifacts` is non-empty.
- If compiled tasks need to be inspected or reused, rerun with `--tasks-dir <path>`.
