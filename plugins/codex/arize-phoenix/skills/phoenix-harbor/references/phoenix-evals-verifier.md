# A `phoenix-evals` judge as a Harbor verifier

This verifier grades the agent's final reply against an expected answer with a `phoenix-evals` LLM classifier. It also records tool-call and turn counts as secondary scores. Phoenix records tokens, cost, and latency from the trace, so the verifier doesn't.

## Task files

```text
my-task/
  task.toml
  instruction.md
  environment/Dockerfile
  solution/solve.sh
  tests/test.sh
  tests/verify.py
  tests/expected.json
```

`tests/expected.json` holds the reference answer and optional grading notes:

```json
{"reference": "117 traces", "notes": "Count traces, not spans."}
```

Install the library in the image, so verification needs no download. In `environment/Dockerfile`:

```dockerfile
RUN pip install --no-cache-dir arize-phoenix-evals openai
```

In `task.toml`, give the judge network access and its key during verification only, and show the expected answer in Phoenix:

```toml
[metadata.arize-phoenix]
reference_output_path = "tests/expected.json"

[environment]
network_mode = "allowlist"

[verifier]
network_mode = "allowlist"
allowed_hosts = ["api.openai.com"]

[verifier.env]
OPENAI_API_KEY = "${OPENAI_API_KEY}"
```

The `[verifier]` network setting changes the policy after the environment starts. If your environment can't do that, see the network section of [gotchas.md](gotchas.md).

`tests/test.sh`:

```sh
#!/bin/sh
set -eu
exec python /tests/verify.py
```

`solution/solve.sh` writes its answer to `/app/answer.txt`, because the oracle produces no trajectory:

```sh
#!/bin/sh
echo "There are 117 traces." > /app/answer.txt
```

In a real task, compute the answer instead of hard-coding it, so the oracle proves the answer is reachable.

## `tests/verify.py`

Replace `MODEL_NAME` with the judge model.

```python
"""Grade the agent's final reply against tests/expected.json and write reward.json."""

import json
from pathlib import Path

from phoenix.evals import LLM, ClassificationEvaluator

TRAJECTORY = Path("/logs/agent/trajectory.json")
ORACLE_ANSWER = Path("/app/answer.txt")
EXPECTED = Path("/tests/expected.json")
REWARD = Path("/logs/verifier/reward.json")

TEMPLATE = """You are grading the final reply of an AI agent. You are given the reference answer.

Decide whether the reply's conclusion semantically matches the reference after applying the grading notes. \
Treat the grading notes as authoritative. Wording, formatting, explanations, units, extra correct context, \
and rounding to the reference's precision do not matter. A reply does not match when its conclusion differs, \
remains uncertain between incompatible candidates, answers a different question, or gives no answer. \
Mentioning the reference is insufficient if the reply rejects it or ultimately chooses another answer.
{{notes}}
[BEGIN REFERENCE ANSWER]
{{reference}}
[END REFERENCE ANSWER]

[BEGIN AGENT REPLY]
{{reply}}
[END AGENT REPLY]

Does the reply's conclusion semantically match the reference after applying the grading notes?"""


def agent_steps(trajectory: dict) -> list[dict]:
    return [
        step
        for step in trajectory.get("steps", [])
        if step.get("source") == "agent" and not step.get("is_copied_context")
    ]


def final_reply(steps: list[dict]) -> str:
    for step in reversed(steps):
        message = step.get("message")
        if isinstance(message, list):
            message = "\n".join(p.get("text", "") for p in message if p.get("type") == "text")
        if isinstance(message, str) and message.strip():
            return message
    return ""


def main() -> None:
    try:
        steps = agent_steps(json.loads(TRAJECTORY.read_text()))
        reply = final_reply(steps)
    except (OSError, ValueError):
        # The oracle and nop agents write no trajectory.
        steps = []
        reply = ORACLE_ANSWER.read_text() if ORACLE_ANSWER.exists() else ""

    expected = json.loads(EXPECTED.read_text())
    notes = expected.get("notes", "")
    judge = ClassificationEvaluator(
        name="matches_reference",
        llm=LLM(provider="openai", model="MODEL_NAME"),
        prompt_template=TEMPLATE,
        choices={"match": 1.0, "mismatch": 0.0},
    )
    score = judge.evaluate(
        {
            "reply": reply or "(empty reply)",
            "reference": expected["reference"],
            "notes": f"\nAuthoritative grading notes: {notes}\n" if notes else "",
        }
    )[0]

    REWARD.parent.mkdir(parents=True, exist_ok=True)
    REWARD.write_text(
        json.dumps(
            {
                "reward": float(score.score or 0.0),
                "tool_call_count": float(sum(len(s.get("tool_calls") or []) for s in steps)),
                "turn_count": float(len(steps)),
            }
        )
    )


if __name__ == "__main__":
    main()
```

## How it behaves

| Run | Reply graded | Result |
| --- | --- | --- |
| Agent | The last agent message in the trajectory | `reward` from the judge, plus counts |
| Oracle | `/app/answer.txt` | `reward` 1 if the reference solution is right |
| `nop` | An empty reply | `reward` 0, no error |
| Judge or fixture failure | None | The script raises, writes no reward, and Harbor records an error instead of a 0 |

Before you trust the judge, check it against correct answers phrased differently and against realistic wrong answers. The `phoenix-evals` skill covers judge validation.
