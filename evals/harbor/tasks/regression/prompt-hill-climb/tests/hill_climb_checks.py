from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, NamedTuple

from evals.harbor.verifiers import phoenix_api, verify

AGENT_LOGS_DIR = Path(os.environ.get("PHOENIX_EVAL_AGENT_LOGS_DIR", "/logs/agent"))
REWARD_PATH = Path(os.environ.get("PHOENIX_EVAL_REWARD_PATH", "/logs/verifier/reward.json"))
# Survives between steps because every step verifies inside the same container.
STATE_DIR = Path(os.environ.get("PHOENIX_EVAL_STATE_DIR", "/var/lib/phoenix-eval/state"))
JUDGE_MODEL = os.environ.get("PHOENIX_EVAL_JUDGE_MODEL", "claude-sonnet-5")
QUERIES_DIR = Path(__file__).with_name("queries")
DATASET_NAME = "banking_saas_dataset_clean"


def query(name: str) -> str:
    return (QUERIES_DIR / f"{name}.graphql").read_text()


def rowid(node_id: str) -> int:
    """The database row number inside a relay node id such as ``Experiment:12``."""
    return int(base64.b64decode(node_id).decode().rsplit(":", 1)[1])


# --- the agent's ATIF trajectory -------------------------------------------------

Trajectory = dict[str, Any]
ExampleNodeId = str


def load_trajectory() -> Trajectory:
    return verify.read_trajectory(AGENT_LOGS_DIR / "trajectory.json") or {}


def final_reply(trajectory: Trajectory) -> str:
    return verify.final_reply(trajectory)


def tool_call_count(trajectory: Trajectory) -> int:
    return sum(len(step.get("tool_calls") or []) for step in verify.agent_steps(trajectory))


# --- the dataset -------------------------------------------------------------------


@dataclass
class Example:
    node_id: str
    input: Any
    reference: Any
    metadata: Any

    @property
    def rowid(self) -> int:
        return rowid(self.node_id)

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


def fetch_dataset() -> tuple[str, list[Example]]:
    """The dataset's node id and its current examples."""
    dataset = phoenix_api.client().datasets.get_dataset(dataset=DATASET_NAME)
    examples = [
        Example(e["node_id"], e["input"], e["output"], e["metadata"]) for e in dataset.examples
    ]
    return dataset.id, examples


# --- evaluators and experiments -----------------------------------------------------


@dataclass
class BoundEvaluator:
    node_id: str
    name: str
    kind: str
    input_mapping: dict[str, Any]
    output_configs: list[dict[str, Any]]
    evaluator_name: str
    source_code: str | None = None
    language: str | None = None
    sandbox_config_id: str | None = None

    @property
    def builtin_key(self) -> str | None:
        return self.evaluator_name if self.kind == "BUILTIN" else None


@dataclass
class Experiment:
    node_id: str
    sequence_number: int
    name: str
    description: str | None
    metadata: dict[str, Any]
    created_at: str
    run_count: int
    error_count: int
    annotation_count: int
    scores: dict[ExampleNodeId, float | None]
    latency_ms: float | None
    cost: float | None

    @property
    def rowid(self) -> int:
        return rowid(self.node_id)

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


def _nodes(connection: dict[str, Any]) -> list[dict[str, Any]]:
    return [edge["node"] for edge in connection["edges"]]


def fetch_dataset_state(dataset_id: str) -> tuple[list[BoundEvaluator], list[Experiment]]:
    """The evaluators bound to the dataset and every experiment run on it, with each run
    scored by the latest annotation from one of those evaluators."""
    dataset = phoenix_api.graphql(query("dataset_state"), {"datasetId": dataset_id})["node"]
    evaluators = [
        BoundEvaluator(
            node_id=binding["evaluator"]["id"],
            name=binding["name"],
            kind=binding["evaluator"]["kind"],
            input_mapping=binding["inputMapping"],
            output_configs=binding["outputConfigs"]
            or binding["evaluator"].get("outputConfigs")
            or [],
            source_code=binding["evaluator"].get("sourceCode"),
            language=binding["evaluator"].get("language"),
            sandbox_config_id=(binding["evaluator"].get("sandboxConfig") or {}).get("id"),
            evaluator_name=binding["evaluator"]["name"],
        )
        for binding in _nodes(dataset["datasetEvaluators"])
    ]
    evaluator_names = {e.name for e in evaluators}
    experiments: list[Experiment] = []
    for node in _nodes(dataset["experiments"]):
        runs = [r for r in _nodes(node["runs"]) if r["repetitionNumber"] == 1]
        scores: dict[ExampleNodeId, float | None] = {}
        annotation_count = 0
        for run in runs:
            annotations = _nodes(run["annotations"])
            annotation_count += len(annotations)
            matching = [
                a["score"]
                for a in annotations
                if a["name"] in evaluator_names and a["score"] is not None
            ]
            scores[run["example"]["id"]] = float(matching[-1]) if matching else None
        total_cost = (node["costSummary"]["total"] or {}).get("cost")
        experiments.append(
            Experiment(
                node_id=node["id"],
                sequence_number=node["sequenceNumber"],
                name=node["name"],
                description=node["description"],
                metadata=node["metadata"] or {},
                created_at=node["createdAt"],
                run_count=len(runs),
                error_count=sum(1 for r in runs if r["error"]),
                annotation_count=annotation_count,
                scores=scores,
                latency_ms=node["averageRunLatencyMs"],
                cost=float(total_cost) if total_cost is not None else None,
            )
        )
    experiments.sort(key=lambda x: x.sequence_number)
    return evaluators, experiments


def moved_examples(
    first: Experiment, last: Experiment
) -> dict[ExampleNodeId, tuple[float | None, float | None]]:
    return {
        example_id: (first.scores.get(example_id), last.scores.get(example_id))
        for example_id in set(first.scores) | set(last.scores)
        if first.scores.get(example_id) != last.scores.get(example_id)
    }


# --- the evaluator probe -------------------------------------------------------------


class ProbeCase(NamedTuple):
    label: str
    output: str
    should_pass: bool


def probe_cases(example: Example) -> list[ProbeCase]:
    reference = example.reference_text
    altered = (
        reference.replace("user_id", "userid", 1)
        if "user_id" in reference
        else reference[:-1] + "X"
    )
    return [
        ProbeCase("identical", reference, True),
        ProbeCase("fenced", f"```sql\n{reference}\n```", True),
        ProbeCase("padded", f"  {reference}\n\n", True),
        ProbeCase("one_token_changed", altered, False),
        ProbeCase("empty", "", False),
    ]


def _config_input(config: dict[str, Any]) -> dict[str, Any]:
    kind = config["__typename"]
    fields = {k: v for k, v in config.items() if k != "__typename"}
    if kind == "CategoricalAnnotationConfig":
        return {"categorical": fields}
    if kind == "ContinuousAnnotationConfig":
        return {"continuous": fields}
    return {"freeform": fields}


def _preview_ref(evaluator: BoundEvaluator) -> dict[str, Any]:
    """Phoenix stores a code evaluator's output configs as annotation configs, and every
    GraphQL surface, including the by-id preview, filters those out as the wrong type. So
    the saved source and sandbox are sent inline, with the saved configs when the binding
    exposes them and otherwise a freeform config, under which Phoenix passes the label and
    score through unchanged."""
    if evaluator.kind == "CODE":
        if evaluator.sandbox_config_id is None:
            raise ValueError("code evaluator has no sandbox configuration")
        configs = [_config_input(c) for c in evaluator.output_configs] or [
            {"freeform": {"name": evaluator.name}}
        ]
        return {
            "inlineCodeEvaluator": {
                "name": evaluator.name,
                "language": evaluator.language or "PYTHON",
                "sourceCode": evaluator.source_code or "",
                "sandboxConfigId": evaluator.sandbox_config_id,
                "outputConfigs": configs,
            }
        }
    if evaluator.kind == "BUILTIN":
        return {"builtInEvaluatorId": evaluator.node_id}
    raise ValueError(f"cannot preview a {evaluator.kind} evaluator")


def preview_scores(evaluator: BoundEvaluator, contexts: list[dict[str, Any]]) -> list[float]:
    """Score each context with the evaluator through Phoenix, on its own sandbox and with
    its own input mapping, exactly as an experiment run would."""
    previews = [
        {
            "evaluator": _preview_ref(evaluator),
            "context": context,
            "inputMapping": evaluator.input_mapping,
        }
        for context in contexts
    ]
    results = phoenix_api.graphql(
        query("evaluator_previews"), {"input": {"previews": previews}}, timeout=300.0
    )
    scores = [_as_score(r) for r in results["evaluatorPreviews"]["results"]]
    if len(scores) != len(contexts):
        raise ValueError(f"{len(contexts)} contexts produced {len(scores)} results")
    return scores


def _as_score(result: dict[str, Any]) -> float:
    if result.get("error"):
        raise ValueError(result["error"])
    annotation = result.get("annotation") or {}
    if isinstance(annotation.get("score"), (int, float)):
        return float(annotation["score"])
    label = str(annotation.get("label") or "").lower()
    if label in {"pass", "true", "correct", "match", "yes"}:
        return 1.0
    if label in {"fail", "false", "incorrect", "mismatch", "no"}:
        return 0.0
    raise ValueError(f"unrecognized evaluator result {result!r}")


def probe_evaluator(
    evaluator: BoundEvaluator, examples: list[Example]
) -> tuple[bool, dict[str, Any]]:
    """Passes when every probe agrees with expectation under at least one output shape: a
    bare string, as SDK tasks return, or a chat-messages dict, as playground runs store."""
    if evaluator.kind not in {"CODE", "BUILTIN"}:
        return False, {"reason": f"a {evaluator.kind} evaluator is not an exact-match check"}
    if evaluator.kind == "BUILTIN" and evaluator.builtin_key != "exact_match":
        return False, {"reason": f"builtin {evaluator.builtin_key!r} cannot check exact match"}
    shapes: dict[str, Callable[[str], Any]] = {
        "text": lambda text: text,
        "messages": lambda text: {"messages": [{"role": "assistant", "content": text}]},
    }
    detail: dict[str, Any] = {}
    for shape_name, shape in shapes.items():
        failures: list[str] = []
        for example in examples:
            cases = probe_cases(example)
            contexts = [
                {
                    "input": example.input,
                    "reference": example.reference,
                    "output": shape(case.output),
                    "metadata": example.metadata,
                }
                for case in cases
            ]
            try:
                scores = preview_scores(evaluator, contexts)
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{example.rowid}: {type(exc).__name__}: {str(exc)[:200]}")
                continue
            for case, score in zip(cases, scores):
                if (score >= 0.5) != case.should_pass:
                    failures.append(f"{example.rowid}/{case.label}: score {score}")
        detail[shape_name] = failures[:10]
        if not failures:
            return True, {"shape": shape_name}
    return False, detail


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
    for dataset_id, query_string in _COMPARE_LINK.findall(text):
        links.append((dataset_id, set(re.findall(r"experimentId=([A-Za-z0-9=_-]+)", query_string))))
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
