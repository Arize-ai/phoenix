"""Standalone CI check: the YAML prompt compilers accept and emit the evaluator gallery metadata.

Exercises scripts/prompts/compile_{python,typescript}_prompts.py directly. It runs
as its own CI job because the Python unit test suite must never depend on
scripts/ sources.

Exits non-zero listing every failed check.
"""

import sys
from functools import partial
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import Any, Callable

from pydantic import ValidationError

PROMPT_SCRIPTS = Path(__file__).resolve().parents[1] / "prompts"
COMPILERS = ("compile_python_prompts", "compile_typescript_prompts")


def load_compiler(name: str) -> ModuleType:
    spec = spec_from_file_location(name, PROMPT_SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _config(**overrides: Any) -> dict[str, Any]:
    config: dict[str, Any] = {
        "name": "test_evaluator",
        "description": "Test evaluator",
        "optimization_direction": "maximize",
        "messages": [{"role": "user", "content": "Input: {{input}}"}],
        "choices": {"yes": 1, "no": 0},
    }
    config.update(overrides)
    return config


def check_gallery_metadata_contract(compiler: ModuleType) -> None:
    model = compiler.ClassificationEvaluatorConfig.model_validate(
        _config(
            scope="trace",
            recommended=True,
            category="response_quality",
            details="Detailed guidance.",
            substitutions={"unused_placeholder": "available_tools_list"},
            inputs={"input": {"description": "The user request."}},
        )
    )
    assert model.model_dump(mode="json", exclude_defaults=True) == {
        **_config(),
        "scope": "trace",
        "recommended": True,
        "category": "response_quality",
        "details": "Detailed guidance.",
        "substitutions": {"unused_placeholder": "available_tools_list"},
        "inputs": {"input": {"description": "The user request."}},
    }


def check_input_variables_match_template_format(compiler: ModuleType, content: str) -> None:
    inputs = {
        "input": {"description": "Input"},
        "nested": {"description": "Nested input"},
    }
    compiler.ClassificationEvaluatorConfig.model_validate(
        _config(messages=[{"role": "user", "content": content}], inputs=inputs)
    )
    try:
        compiler.ClassificationEvaluatorConfig.model_validate(
            _config(
                messages=[{"role": "user", "content": content}],
                inputs={**inputs, "unused": {"description": "Unused"}},
            )
        )
    except ValidationError as exc:
        assert "unused inputs" in str(exc), exc
    else:
        raise AssertionError("an input the template never references was accepted")


def check_python_generator_emits_gallery_metadata(compiler: ModuleType) -> None:
    config = compiler.ClassificationEvaluatorConfig.model_validate(
        _config(
            scope="span",
            recommended=True,
            category="response_quality",
            details="Detailed guidance.",
            inputs={"input": {"description": "Input"}},
        )
    )
    source = compiler.get_prompt_file_contents(config, "TEST_CONFIG")
    for expected in (
        "scope=EvaluatorScope.SPAN",
        "recommended=True",
        "category=EvaluatorCategory.RESPONSE_QUALITY",
        "details='Detailed guidance.'",
        "inputs={'input': EvaluatorInput(description='Input')}",
    ):
        assert expected in source, f"{expected!r} missing from the generated module"


def main() -> int:
    compilers = {name: load_compiler(name) for name in COMPILERS}
    checks: list[tuple[str, Callable[[], None]]] = []
    for name, compiler in compilers.items():
        checks.append(
            (f"{name}: gallery metadata", partial(check_gallery_metadata_contract, compiler))
        )
        for content in ("{{input}} {{nested.value}}", "{input} {nested.value}"):
            checks.append(
                (
                    f"{name}: input variables for {content!r}",
                    partial(check_input_variables_match_template_format, compiler, content),
                )
            )
    checks.append(
        (
            "compile_python_prompts: generated gallery metadata",
            partial(
                check_python_generator_emits_gallery_metadata, compilers["compile_python_prompts"]
            ),
        )
    )

    failures: list[tuple[str, str]] = []
    for label, check in checks:
        try:
            check()
        except Exception as exc:  # noqa: BLE001 — report every failure kind
            failures.append((label, f"{type(exc).__name__}: {exc}"))

    if failures:
        print(f"{len(failures)}/{len(checks)} prompt compiler checks failed:")
        for label, error in failures:
            print(f"  {label}: {error}")
        return 1

    print(f"All {len(checks)} prompt compiler checks pass.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
