from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
from pydantic import ValidationError


@pytest.fixture(params=["compile_python_prompts", "compile_typescript_prompts"])
def compiler_module(request: pytest.FixtureRequest) -> ModuleType:
    module_path = Path(__file__).parents[4] / "scripts" / "prompts" / f"{request.param}.py"
    spec = spec_from_file_location(request.param, module_path)
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


def test_gallery_metadata_contract(compiler_module: ModuleType) -> None:
    model = compiler_module.ClassificationEvaluatorConfig.model_validate(
        _config(
            scope="trace",
            recommended=True,
            category="response_quality",
            kind="CODE",
            details="Detailed guidance.",
            substitutions={"unused_placeholder": "available_tools_list"},
            inputs={"input": {"description": "The user request.", "format": "text"}},
        )
    )

    assert model.model_dump(mode="json", exclude_defaults=True) == {
        **_config(),
        "scope": "trace",
        "recommended": True,
        "category": "response_quality",
        "kind": "CODE",
        "details": "Detailed guidance.",
        "substitutions": {"unused_placeholder": "available_tools_list"},
        "inputs": {"input": {"description": "The user request.", "format": "text"}},
    }


@pytest.mark.parametrize(
    "content",
    ["{{input}} {{nested.value}}", "{input} {nested.value}"],
)
def test_input_variables_match_template_format(
    compiler_module: ModuleType,
    content: str,
) -> None:
    inputs = {
        "input": {"description": "Input"},
        "nested": {"description": "Nested input"},
    }
    compiler_module.ClassificationEvaluatorConfig.model_validate(
        _config(messages=[{"role": "user", "content": content}], inputs=inputs)
    )

    with pytest.raises(ValidationError, match="unused inputs"):
        compiler_module.ClassificationEvaluatorConfig.model_validate(
            _config(
                messages=[{"role": "user", "content": content}],
                inputs={**inputs, "unused": {"description": "Unused"}},
            )
        )


def test_python_generator_emits_gallery_metadata() -> None:
    module_path = Path(__file__).parents[4] / "scripts" / "prompts" / "compile_python_prompts.py"
    spec = spec_from_file_location("compile_python_prompts_generation", module_path)
    assert spec and spec.loader
    compiler_module = module_from_spec(spec)
    spec.loader.exec_module(compiler_module)
    config = compiler_module.ClassificationEvaluatorConfig.model_validate(
        _config(
            scope="span",
            recommended=True,
            category="response_quality",
            kind="CODE",
            details="Detailed guidance.",
            inputs={"input": {"description": "Input", "format": "text"}},
        )
    )

    source = compiler_module.get_prompt_file_contents(config, "TEST_CONFIG")

    assert "scope=EvaluatorScope.SPAN" in source
    assert "recommended=True" in source
    assert "category=EvaluatorCategory.RESPONSE_QUALITY" in source
    assert "kind=EvaluatorKind.CODE" in source
    assert "details='Detailed guidance.'" in source
    assert "inputs={'input': EvaluatorInput(description='Input', format='text')}" in source
