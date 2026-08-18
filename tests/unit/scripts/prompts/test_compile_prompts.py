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


def test_gallery_metadata_survives_parsing(compiler_module: ModuleType) -> None:
    model = compiler_module.ClassificationEvaluatorConfig.model_validate(
        _config(
            scope="trace",
            recommended=True,
            category="response_quality",
            kind="CODE",
            details="Use this to judge a response.",
            inputs={"input": {"description": "The user request.", "format": "text"}},
            docs_link="https://example.com/evaluators/test",
        )
    )

    assert model.scope.value == "trace"
    assert model.recommended is True
    assert model.category.value == "response_quality"
    assert model.kind.value == "CODE"
    assert model.inputs["input"].description == "The user request."
    assert model.inputs["input"].format == "text"


@pytest.mark.parametrize(
    ("field", "value"),
    [("scope", "project"), ("category", "quality"), ("kind", "BUILTIN")],
)
def test_invalid_metadata_enum_fails(compiler_module: ModuleType, field: str, value: str) -> None:
    with pytest.raises(ValidationError):
        compiler_module.ClassificationEvaluatorConfig.model_validate(_config(**{field: value}))


def test_omitted_metadata_is_backward_compatible(compiler_module: ModuleType) -> None:
    model = compiler_module.ClassificationEvaluatorConfig.model_validate(_config())

    assert model.scope is None
    assert model.recommended is False
    assert model.category is None
    assert model.kind.value == "LLM"
    assert model.inputs is None


def test_python_generator_emits_only_supplied_metadata() -> None:
    module_path = Path(__file__).parents[4] / "scripts" / "prompts" / "compile_python_prompts.py"
    spec = spec_from_file_location("compile_python_prompts_generation", module_path)
    assert spec and spec.loader
    compiler_module = module_from_spec(spec)
    spec.loader.exec_module(compiler_module)

    legacy_config = compiler_module.ClassificationEvaluatorConfig.model_validate(_config())
    legacy_source = compiler_module.get_prompt_file_contents(legacy_config, "TEST_CONFIG")
    assert "scope=" not in legacy_source
    assert "recommended=" not in legacy_source

    gallery_config = compiler_module.ClassificationEvaluatorConfig.model_validate(
        _config(
            scope="span",
            category="response_quality",
            inputs={"input": {"description": "Input"}},
        )
    )
    gallery_source = compiler_module.get_prompt_file_contents(gallery_config, "TEST_CONFIG")
    assert "scope='span'" in gallery_source
    assert "category='response_quality'" in gallery_source
    assert "inputs={'input': {'description': 'Input'}}" in gallery_source
    assert "<Evaluator" not in gallery_source


def test_inputs_match_direct_variables_and_substitutions(compiler_module: ModuleType) -> None:
    model = compiler_module.ClassificationEvaluatorConfig.model_validate(
        _config(
            messages=[
                {
                    "role": "user",
                    "content": (
                        "{{input}} {{#items}}{{name}}{{/items}} {{^missing}}none{{/missing}} "
                        "{{! ignored }} {{{.}}} {{output.value}} {{available_tools}}"
                    ),
                }
            ],
            substitutions={"available_tools": "available_tools_list"},
            inputs={
                "input": {"description": "Input"},
                "available_tools": {"description": "Available tools"},
            },
        )
    )

    assert set(model.inputs) == {"input", "available_tools"}


@pytest.mark.parametrize(
    "inputs",
    [
        {"input": {"description": "Input"}, "unused": {"description": "Unused"}},
        {},
    ],
)
def test_inputs_must_exactly_match_source_variables(
    compiler_module: ModuleType, inputs: dict[str, dict[str, str]]
) -> None:
    with pytest.raises(ValidationError):
        compiler_module.ClassificationEvaluatorConfig.model_validate(_config(inputs=inputs))


@pytest.mark.parametrize(
    "inputs",
    [
        {"": {"description": "Input"}},
        {"input": {"description": "  "}},
    ],
)
def test_input_names_and_descriptions_must_not_be_empty(
    compiler_module: ModuleType, inputs: dict[str, dict[str, str]]
) -> None:
    with pytest.raises(ValidationError):
        compiler_module.ClassificationEvaluatorConfig.model_validate(_config(inputs=inputs))
