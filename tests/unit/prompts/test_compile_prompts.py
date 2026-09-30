"""
Unit tests for the prompt compilers under ``scripts/prompts``.

These protect the code-generation path for the two ``choices`` forms:

- a label-to-score map (e.g. ``{"toxic": 1.0, "non-toxic": 0.0}``), and
- a bare list of labels (e.g. ``["english", "spanish"]``).

The ``codegen-prompts`` CI check only diffs the output produced from the
committed YAML prompts, all of which use score maps, so the list branch of each
compiler would otherwise never be exercised.

The compilers live in ``scripts/prompts`` with no package ``__init__``, so they
are loaded here directly from their file paths.
"""

import importlib.util
import json
from pathlib import Path
from types import ModuleType

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCRIPTS_DIR = _REPO_ROOT / "scripts" / "prompts"


def _load_module(name: str, filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, _SCRIPTS_DIR / filename)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ts_compiler = _load_module("compile_typescript_prompts", "compile_typescript_prompts.py")
py_compiler = _load_module("compile_python_prompts", "compile_python_prompts.py")


def _ts_config(choices: object) -> object:
    return ts_compiler.ClassificationEvaluatorConfig.model_validate(
        {
            "name": "language",
            "description": "Detect the language.",
            "optimization_direction": "neutral",
            "messages": [{"role": "user", "content": "Classify: {{text}}"}],
            "choices": choices,
        }
    )


def _py_config(choices: object) -> object:
    return py_compiler.ClassificationEvaluatorConfig.model_validate(
        {
            "name": "language",
            "description": "Detect the language.",
            "optimization_direction": "neutral",
            "messages": [{"role": "user", "content": "Classify: {{text}}"}],
            "choices": choices,
        }
    )


class TestCompileTypescriptPrompts:
    def test_list_choices_emit_label_array_unchanged(self) -> None:
        config = _ts_config(["english", "spanish", "other"])
        content = ts_compiler.get_template_file_contents("LANGUAGE", config)
        assert json.dumps(["english", "spanish", "other"], indent=2) in content

    def test_map_choices_emit_int_scores(self) -> None:
        config = _ts_config({"toxic": 1.0, "non-toxic": 0.0})
        content = ts_compiler.get_template_file_contents("TOXICITY", config)
        # Scores are coerced to ints in the generated TypeScript.
        assert json.dumps({"toxic": 1, "non-toxic": 0}, indent=2) in content


class TestCompilePythonPrompts:
    def test_list_choices_emit_label_array_unchanged(self) -> None:
        config = _py_config(["english", "spanish", "other"])
        content = py_compiler.get_prompt_file_contents(config, "LANGUAGE")
        assert "choices=['english', 'spanish', 'other']" in content

    def test_map_choices_preserve_score_map(self) -> None:
        config = _py_config({"toxic": 1.0, "non-toxic": 0.0})
        content = py_compiler.get_prompt_file_contents(config, "TOXICITY")
        assert "choices={'toxic': 1.0, 'non-toxic': 0.0}" in content
