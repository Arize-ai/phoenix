"""The hallucination benchmark notebook's setup cells run against the workspace phoenix.evals.

Executes the import cell and the cells that only define things (the prompt print, the
experiment task, the accuracy evaluator and the judge models). The install, API-key,
dataset download, upload and experiment cells need a network or keys and are skipped.

Lives outside tests/ beside the notebook. Run with
``uv run pytest -q scripts/benchmarks/test_hallucination_eval_benchmark.py``.
"""

import ast
import json
from pathlib import Path
from typing import Any

from phoenix.evals.llm.registries import PROVIDER_REGISTRY

_NOTEBOOK_PATH = Path(__file__).with_name("hallucination_eval_benchmark.ipynb")


def _code_cells() -> list[str]:
    notebook = json.loads(_NOTEBOOK_PATH.read_text(encoding="utf-8"))
    return ["".join(c["source"]) for c in notebook["cells"] if c["cell_type"] == "code"]


def _cell(cells: list[str], marker: str) -> str:
    matches = [source for source in cells if marker in source]
    assert len(matches) == 1, f"expected one code cell containing {marker!r}"
    return matches[0]


def _run(source: str, namespace: dict[str, Any]) -> None:
    exec(compile(source, f"<{_NOTEBOOK_PATH.name}>", "exec"), namespace)


def _keys_passed_to_evaluator(task_source: str) -> set[str]:
    for node in ast.walk(ast.parse(task_source)):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in ("evaluate", "async_evaluate")
            and node.args
            and isinstance(node.args[0], ast.Dict)
        ):
            return {
                key.value
                for key in node.args[0].keys
                if isinstance(key, ast.Constant) and isinstance(key.value, str)
            }
    raise AssertionError("the task does not pass a dict literal to evaluate/async_evaluate")


def test_setup_cells_run_against_current_phoenix_evals() -> None:
    cells = _code_cells()
    namespace: dict[str, Any] = {}

    _run(_cell(cells, "from phoenix.evals import"), namespace)
    _run(_cell(cells, ".PROMPT"), namespace)
    task_source = _cell(cells, "async def async_classify")
    _run(task_source, namespace)
    _run(_cell(cells, "def accuracy"), namespace)
    _run(_cell(cells, "judge_models ="), namespace)

    schema = namespace["FaithfulnessEvaluator"].FaithfulnessInputSchema
    assert _keys_passed_to_evaluator(task_source) == set(schema.model_fields)

    judge_models = namespace["judge_models"]
    assert judge_models
    assert set(judge_models.values()) <= set(PROVIDER_REGISTRY.list_providers())
