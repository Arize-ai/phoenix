# Use Phoenix Evals in a verifier

This example uses a `phoenix-evals` LLM classifier to compare an agent's final reply with a reference answer and task-specific grading notes. The verifier writes the score to Harbor; the Phoenix plugin records it as an experiment evaluation.

Phoenix Evals also has code evaluators (`create_evaluator`), and you can run the same evaluators on traces and experiments outside Harbor. Plain code and Rewardkit work too. Use an LLM classifier, as here, only when code can't judge the criteria, such as whether free text means the same thing as a reference.

## Prepare the verifier

Install `arize-phoenix-evals` and `openai` in the verifier image. For a separate verifier, Harbor builds that image from `tests/Dockerfile` when the file exists, and otherwise reuses the task's environment image:

```dockerfile
FROM python:3.13-slim
RUN pip install --no-cache-dir arize-phoenix-evals openai
COPY . /tests/
```

Save your reference in `tests/expected.json` with a nonempty `reference` string and an optional `notes` string. Use notes for task-specific criteria and acceptable alternatives. Keep this file out of the agent image. To also display it in Phoenix, set `[metadata.arize-phoenix] reference_output_path = "tests/expected.json"`.

This example reads `/logs/agent/trajectory.json`. Choose an agent that records a final text reply before verification; some agents end with a completion tool call instead.

Add these settings to `task.toml`. Replace `JUDGE_MODEL_NAME` with the judge model, and keep your existing agent and environment settings. A `[verifier.environment]` table runs the verifier in its own container, which receives only the files listed in `artifacts`:

```toml
# Copy the agent's trajectory into the verifier container.
artifacts = ["/logs/agent/trajectory.json"]

[metadata.arize-phoenix]
reference_output_path = "tests/expected.json"

[verifier.environment]
network_mode = "allowlist"
allowed_hosts = ["api.openai.com"]

[verifier.env]
OPENAI_API_KEY = "${OPENAI_API_KEY}"
JUDGE_MODEL = "JUDGE_MODEL_NAME"
```

## Grade the reply

Save this as `tests/verify.py`. The reader handles a single ATIF file with a final text response, including structured text parts. For agents that split trajectories across continuations, adapt the reader to load the terminal continuation first.

```python
import json
import os
from pathlib import Path

from phoenix.evals import LLM, ClassificationEvaluator

PROMPT = """You are grading the final reply of an AI agent that was asked a question. You are given the reference answer.

Decide whether the reply's conclusion semantically matches the reference after applying the grading notes. Treat the grading notes as authoritative. Wording, formatting, explanations, units, extra correct context, and rounding to the reference's precision do not matter. A reply does not match when its conclusion differs, remains uncertain between incompatible candidates, answers a different question, or gives no answer. Mentioning the reference is insufficient if the reply rejects it or ultimately chooses another answer.
{{notes}}
[BEGIN REFERENCE ANSWER]
{{reference}}
[END REFERENCE ANSWER]

[BEGIN AGENT REPLY]
{{reply}}
[END AGENT REPLY]

Does the reply's conclusion semantically match the reference after applying the grading notes?"""


def final_reply(path: Path) -> str:
    trajectory = json.loads(path.read_text())
    if trajectory.get("continued_trajectory_ref"):
        raise ValueError("Load the terminal continuation before grading")
    step = trajectory["steps"][-1]
    if step["source"] != "agent" or step.get("tool_calls") or step.get("is_copied_context"):
        return ""
    message = step["message"]
    if isinstance(message, list):
        return "\n".join(part["text"] for part in message if part["type"] == "text")
    if not isinstance(message, str):
        raise ValueError("Invalid ATIF message")
    return message


def main() -> None:
    expected = json.loads(Path("/tests/expected.json").read_text())
    reference, notes = expected["reference"], expected.get("notes", "")
    if not isinstance(reference, str) or not reference.strip() or not isinstance(notes, str):
        raise ValueError("Expected a reference string and optional notes string")
    reply = final_reply(Path("/logs/agent/trajectory.json"))
    result: dict = {"score": 0.0, "explanation": "No final text reply"}
    if reply.strip():
        judge = ClassificationEvaluator(
            name="matches_reference",
            llm=LLM(provider="openai", model=os.environ["JUDGE_MODEL"]),
            prompt_template=PROMPT,
            choices={"match": 1.0, "mismatch": 0.0},
        )
        guidance = f"\nAuthoritative grading notes: {notes.strip()}\n" if notes.strip() else ""
        score = judge.evaluate({"reply": reply, "reference": reference, "notes": guidance})[0]
        if score.score not in (0.0, 1.0):
            raise ValueError("Judge returned no valid binary score")
        result = score.to_dict()

    output = Path("/logs/verifier")
    output.mkdir(parents=True, exist_ok=True)
    (output / "judge.json").write_text(json.dumps(result))
    (output / "reward.json").write_text(json.dumps({"reward": result["score"]}))


if __name__ == "__main__":
    main()
```

Call it from `tests/test.sh`:

```sh
#!/bin/sh
set -eu
exec python /tests/verify.py
```

A valid trajectory without a final reply receives zero. Missing or malformed input files and judge failures raise without writing a reward, so Harbor records a verification error. Oracle and `nop` agents might not produce trajectories; test this reader with saved ATIF fixtures instead of assuming those agents can validate reply grading.

Check a valid paraphrase, a wrong answer, a contradiction, an empty reply, and a judge failure. Inspect both `reward.json` and `judge.json`. Validate the judge against representative human labels before relying on its scores; the `phoenix-evals` skill covers judge validation.
