from __future__ import annotations

import base64
import inspect
import json
import os
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.environ.get("PHOENIX_EVAL_DATA_DIR", "/data"))
AGENT_LOGS_DIR = Path(os.environ.get("PHOENIX_EVAL_AGENT_LOGS_DIR", "/logs/agent"))
REWARD_PATH = Path(os.environ.get("PHOENIX_EVAL_REWARD_PATH", "/logs/verifier/reward.json"))
# Survives between steps because every step verifies inside the same container.
STATE_DIR = Path(os.environ.get("PHOENIX_EVAL_STATE_DIR", "/var/lib/phoenix-eval/state"))
JUDGE_MODEL = os.environ.get("PHOENIX_EVAL_JUDGE_MODEL", "claude-sonnet-5")
DATASET_NAME = "banking_saas_dataset_clean"


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(f"file:{DATA_DIR / 'phoenix.db'}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def global_id(type_name: str, rowid: int) -> str:
    return base64.b64encode(f"{type_name}:{rowid}".encode()).decode()


def loads(value: Any) -> Any:
    if isinstance(value, (bytes, str)):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


# --- the agent's ATIF trajectory -------------------------------------------------

Trajectory = dict[str, Any]


def load_trajectory() -> Trajectory:
    path = AGENT_LOGS_DIR / "trajectory.json"
    if not path.exists():
        return {}
    loaded = json.loads(path.read_text())
    return loaded if isinstance(loaded, dict) else {}


def agent_steps(trajectory: Trajectory) -> list[dict[str, Any]]:
    return [s for s in trajectory.get("steps") or [] if s.get("source") == "agent"]


def final_reply(trajectory: Trajectory) -> str:
    for step in reversed(agent_steps(trajectory)):
        message = step.get("message")
        if isinstance(message, str) and message:
            return message
        if isinstance(message, list):
            text = "".join(str(p.get("text", "")) for p in message if p.get("type") == "text")
            if text:
                return text
    return ""


def tool_call_count(trajectory: Trajectory) -> int:
    return sum(len(step.get("tool_calls") or []) for step in agent_steps(trajectory))


# --- the dataset -------------------------------------------------------------------


@dataclass
class Example:
    rowid: int
    input: Any
    reference: Any
    metadata: Any

    @property
    def node_id(self) -> str:
        return global_id("DatasetExample", self.rowid)

    @property
    def reference_text(self) -> str:
        if isinstance(self.reference, dict):
            return str(self.reference.get("reference", ""))
        return str(self.reference)

    @property
    def question(self) -> str:
        if isinstance(self.input, dict):
            messages = self.input.get("messages") or []
            if messages:
                return str(messages[-1].get("content", ""))
        return str(self.input)


def dataset_rowid(connection: sqlite3.Connection) -> int:
    row = connection.execute("SELECT id FROM datasets WHERE name = ?", (DATASET_NAME,)).fetchone()
    if row is None:
        raise SystemExit(f"dataset {DATASET_NAME!r} is missing from the fixture")
    return int(row["id"])


def fetch_examples(connection: sqlite3.Connection, dataset_id: int) -> list[Example]:
    rows = connection.execute(
        "SELECT e.id, r.input, r.output, r.metadata FROM dataset_examples e"
        " JOIN dataset_example_revisions r ON r.dataset_example_id = e.id"
        " WHERE e.dataset_id = ? AND r.id = ("
        "   SELECT max(id) FROM dataset_example_revisions WHERE dataset_example_id = e.id)"
        " AND r.revision_kind != 'DELETE' ORDER BY e.id",
        (dataset_id,),
    )
    return [
        Example(r["id"], loads(r["input"]), loads(r["output"]), loads(r["metadata"])) for r in rows
    ]


# --- evaluators ---------------------------------------------------------------------


@dataclass
class BoundEvaluator:
    rowid: int
    name: str
    kind: str
    input_mapping: dict[str, Any]
    source_code: str | None
    builtin_key: str | None


def fetch_bound_evaluators(connection: sqlite3.Connection, dataset_id: int) -> list[BoundEvaluator]:
    rows = connection.execute(
        "SELECT d.evaluator_id, d.name, e.kind, d.input_mapping, b.key AS builtin_key,"
        " (SELECT source_code FROM code_evaluator_code_versions v"
        "   WHERE v.code_evaluator_id = e.id ORDER BY v.id DESC LIMIT 1) AS source_code"
        " FROM dataset_evaluators d JOIN evaluators e ON e.id = d.evaluator_id"
        " LEFT JOIN builtin_evaluators b ON b.id = e.id"
        " WHERE d.dataset_id = ? ORDER BY d.id",
        (dataset_id,),
    )
    return [
        BoundEvaluator(
            r["evaluator_id"],
            r["name"],
            r["kind"],
            loads(r["input_mapping"]) or {},
            r["source_code"],
            r["builtin_key"],
        )
        for r in rows
    ]


def probe_cases(example: Example) -> list[tuple[str, str, bool]]:
    """``(label, output text, should pass)`` for one example's reference."""
    reference = example.reference_text
    altered = (
        reference.replace("user_id", "userid", 1)
        if "user_id" in reference
        else reference[:-1] + "X"
    )
    return [
        ("identical", reference, True),
        ("fenced", f"```sql\n{reference}\n```", True),
        ("padded", f"  {reference}\n\n", True),
        ("one_token_changed", altered, False),
        ("empty", "", False),
    ]


def _apply_input_mapping(mapping: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    from jsonpath_ng import parse as parse_jsonpath

    result: dict[str, Any] = {}
    for key, path in (mapping.get("path_mapping") or {}).items():
        matches = parse_jsonpath(path).find(context)
        if len(matches) == 1:
            result[key] = matches[0].value
        elif matches:
            result[key] = [m.value for m in matches]
    result.update(mapping.get("literal_mapping") or {})
    return result


def _call_code_evaluator(source: str, mapping: dict[str, Any], context: dict[str, Any]) -> float:
    namespace: dict[str, Any] = {}
    exec(source, namespace)  # noqa: S102 - the agent's own evaluator, run as Phoenix would
    evaluate = namespace.get("evaluate")
    if not callable(evaluate):
        raise ValueError("no top-level evaluate() function")
    available = {**context, **_apply_input_mapping(mapping, context)}
    parameters = inspect.signature(evaluate).parameters
    kwargs = {name: available[name] for name in parameters if name in available}
    result = evaluate(**kwargs)
    if inspect.isawaitable(result):
        import asyncio

        result = asyncio.run(result)
    return _as_score(result)


def _as_score(result: Any) -> float:
    if isinstance(result, bool):
        return float(result)
    if isinstance(result, (int, float)):
        return float(result)
    if isinstance(result, dict):
        if isinstance(result.get("score"), (int, float)):
            return float(result["score"])
        label = str(result.get("label", "")).lower()
        if label in {"pass", "true", "correct", "match", "yes"}:
            return 1.0
        if label in {"fail", "false", "incorrect", "mismatch", "no"}:
            return 0.0
    raise ValueError(f"unrecognized evaluator result {result!r}")


def _builtin_exact_match(mapping: dict[str, Any], context: dict[str, Any]) -> float:
    inputs = _apply_input_mapping(mapping, context)
    expected, actual = str(inputs.get("expected", "")), str(inputs.get("actual", ""))
    return float(bool(expected) and expected == actual)


def probe_evaluator(
    evaluator: BoundEvaluator, examples: list[Example]
) -> tuple[bool, dict[str, Any]]:
    """Run the evaluator the way the experiment runner would, over two output shapes: a
    bare string (SDK tasks) and a chat-messages dict (playground runs). It passes when
    every probe agrees with expectation under at least one shape."""
    if evaluator.kind == "LLM":
        return False, {"reason": "an LLM judge is not an exact-match check"}
    shapes = {
        "text": lambda text: text,
        "messages": lambda text: {"messages": [{"role": "assistant", "content": text}]},
    }
    detail: dict[str, Any] = {}
    for shape_name, shape in shapes.items():
        failures: list[str] = []
        for example in examples:
            for label, text, expected in probe_cases(example):
                context = {
                    "input": example.input,
                    "reference": example.reference,
                    "output": shape(text),
                    "metadata": example.metadata,
                }
                try:
                    if evaluator.kind == "CODE":
                        score = _call_code_evaluator(
                            evaluator.source_code or "", evaluator.input_mapping, context
                        )
                    elif evaluator.builtin_key == "exact_match":
                        score = _builtin_exact_match(evaluator.input_mapping, context)
                    else:
                        return False, {
                            "reason": f"builtin {evaluator.builtin_key!r} cannot check exact match"
                        }
                except Exception as exc:  # noqa: BLE001
                    failures.append(f"{example.rowid}/{label}: {type(exc).__name__}: {exc}")
                    continue
                if (score >= 0.5) != expected:
                    failures.append(f"{example.rowid}/{label}: score {score}")
        detail[shape_name] = failures[:10]
        if not failures:
            return True, {"shape": shape_name}
    return False, detail


# --- experiments --------------------------------------------------------------------


@dataclass
class Experiment:
    rowid: int
    name: str
    description: str | None
    metadata: dict[str, Any]
    created_at: str
    run_count: int
    error_count: int
    scores: dict[int, float | None]  # dataset_example_id -> evaluator score
    latency_ms: float | None
    tokens: int | None

    @property
    def node_id(self) -> str:
        return global_id("Experiment", self.rowid)

    @property
    def scored_count(self) -> int:
        return sum(1 for s in self.scores.values() if s is not None)

    @property
    def pass_count(self) -> int:
        return sum(1 for s in self.scores.values() if s is not None and s >= 0.5)

    @property
    def mean_score(self) -> float:
        scored = [s for s in self.scores.values() if s is not None]
        return sum(scored) / len(scored) if scored else 0.0


def fetch_experiments(
    connection: sqlite3.Connection, dataset_id: int, evaluator_names: set[str]
) -> list[Experiment]:
    experiments: list[Experiment] = []
    for r in connection.execute(
        "SELECT id, name, description, metadata, created_at FROM experiments"
        " WHERE dataset_id = ? ORDER BY id",
        (dataset_id,),
    ):
        runs = connection.execute(
            "SELECT id, dataset_example_id, error, start_time, end_time,"
            " prompt_token_count, completion_token_count FROM experiment_runs"
            " WHERE experiment_id = ? AND repetition_number = 1",
            (r["id"],),
        ).fetchall()
        scores: dict[int, float | None] = {}
        for run in runs:
            score = (
                connection.execute(
                    "SELECT score FROM experiment_run_annotations WHERE experiment_run_id = ?"
                    " AND name IN (%s) AND score IS NOT NULL ORDER BY id DESC LIMIT 1"
                    % ",".join("?" * len(evaluator_names)),
                    (run["id"], *evaluator_names),
                ).fetchone()
                if evaluator_names
                else None
            )
            scores[run["dataset_example_id"]] = float(score["score"]) if score else None
        latency = connection.execute(
            "SELECT avg((julianday(end_time) - julianday(start_time)) * 86400000) AS ms"
            " FROM experiment_runs WHERE experiment_id = ?",
            (r["id"],),
        ).fetchone()["ms"]
        tokens = connection.execute(
            "SELECT sum(coalesce(prompt_token_count, 0) + coalesce(completion_token_count, 0)) AS n"
            " FROM experiment_runs WHERE experiment_id = ?",
            (r["id"],),
        ).fetchone()["n"]
        experiments.append(
            Experiment(
                r["id"],
                r["name"],
                r["description"],
                loads(r["metadata"]) or {},
                str(r["created_at"]),
                len(runs),
                sum(1 for run in runs if run["error"]),
                scores,
                float(latency) if latency is not None else None,
                int(tokens) if tokens is not None else None,
            )
        )
    return experiments


def annotation_count(connection: sqlite3.Connection, dataset_id: int) -> int:
    return int(
        connection.execute(
            "SELECT count(*) FROM experiment_run_annotations a"
            " JOIN experiment_runs r ON r.id = a.experiment_run_id"
            " JOIN experiments x ON x.id = r.experiment_id WHERE x.dataset_id = ?",
            (dataset_id,),
        ).fetchone()[0]
    )


def moved_examples(
    first: Experiment, last: Experiment
) -> dict[int, tuple[float | None, float | None]]:
    return {
        example_id: (first.scores.get(example_id), last.scores.get(example_id))
        for example_id in set(first.scores) | set(last.scores)
        if first.scores.get(example_id) != last.scores.get(example_id)
    }


# --- cross-step state -----------------------------------------------------------------


def save_state(name: str, state: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / f"{name}.json").write_text(json.dumps(state, indent=2, default=str))


def load_state(name: str) -> dict[str, Any] | None:
    path = STATE_DIR / f"{name}.json"
    return json.loads(path.read_text()) if path.exists() else None


def metadata_preserved(before: dict[str, Any], after: dict[str, Any]) -> bool:
    """Every key the experiment carried before is still there with the same value, except
    a list the agent appended to, which may have grown."""
    for key, old in before.items():
        new = after.get(key)
        if isinstance(old, list) and isinstance(new, list):
            if new[: len(old)] != old:
                return False
        elif new != old:
            return False
    return True


def metadata_additions(before: dict[str, Any], after: dict[str, Any]) -> str:
    added: dict[str, Any] = {}
    for key, new in after.items():
        old = before.get(key)
        if isinstance(old, list) and isinstance(new, list):
            if len(new) > len(old):
                added[key] = new[len(old) :]
        elif new != old:
            added[key] = new
    return json.dumps(added, default=str)


_TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}")


def has_timestamp(text: str) -> bool:
    return bool(_TIMESTAMP.search(text))


_COMPARE_LINK = re.compile(r"/datasets/([A-Za-z0-9=_-]+)/compare\?([^\s)\]>\"']*)")


def compare_links(text: str) -> list[tuple[str, set[str]]]:
    links: list[tuple[str, set[str]]] = []
    for dataset_id, query in _COMPARE_LINK.findall(text):
        links.append((dataset_id, set(re.findall(r"experimentId=([A-Za-z0-9=_-]+)", query))))
    return links


# --- LLM judge --------------------------------------------------------------------

_JUDGE_ATTEMPTS = 3
_JUDGE_MAX_TOKENS = 8000  # the judge model may think before it answers


def judge(system: str, user: str) -> dict[str, Any] | None:
    """Ask the judge model for a JSON verdict; ``None`` when no judge is available."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    import anthropic

    client = anthropic.Anthropic()
    text = ""
    for _attempt in range(_JUDGE_ATTEMPTS):
        response = client.messages.create(
            model=JUDGE_MODEL,
            max_tokens=_JUDGE_MAX_TOKENS,
            system=system + "\n\nRespond with a single JSON object and nothing else.",
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(
            block.text for block in response.content if isinstance(block, anthropic.types.TextBlock)
        )
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                verdict: dict[str, Any] = json.loads(match.group(0))
                return verdict
            except json.JSONDecodeError:
                continue
    return {
        "error": f"judge returned no usable JSON after {_JUDGE_ATTEMPTS} attempts",
        "raw": text[:500],
    }


def write_reward(reward: float, details: dict[str, Any] | None = None, **components: Any) -> None:
    """Harbor's reward file accepts numbers only, and it averages every key into its
    summary, so only 0-to-1 scores go there; counts and diagnostics go to ``details.json``."""
    REWARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    rewards: dict[str, float] = {"reward": float(reward)}
    details = dict(details or {})
    for key, value in components.items():
        if isinstance(value, bool):
            rewards[key] = float(value)
        elif isinstance(value, (int, float)):
            rewards[key] = float(value)
        else:
            details[key] = value
    REWARD_PATH.write_text(json.dumps(rewards, indent=2) + "\n")
    REWARD_PATH.with_name("details.json").write_text(
        json.dumps(details, indent=2, default=str) + "\n"
    )
    print(json.dumps({**rewards, **details}, indent=2, default=str))
