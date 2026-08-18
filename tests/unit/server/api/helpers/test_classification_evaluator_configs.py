from collections.abc import Callable
from typing import Any

import pytest

import phoenix.__generated__.classification_evaluator_configs as configs_module
from phoenix.__generated__.classification_evaluator_configs import (
    ClassificationEvaluatorConfig,
    PromptMessage,
)
from phoenix.server.api.helpers.classification_evaluator_configs import (
    get_classification_evaluator_configs,
    get_evaluator_gallery_configs,
)


@pytest.fixture
def make_config(
    monkeypatch: pytest.MonkeyPatch,
) -> Callable[..., ClassificationEvaluatorConfig]:
    config_index = 0

    def _make_config(**overrides: Any) -> ClassificationEvaluatorConfig:
        nonlocal config_index
        config_index += 1
        values: dict[str, Any] = {
            "name": f"test_{config_index}",
            "description": "Test evaluator",
            "optimization_direction": "maximize",
            "messages": [PromptMessage(role="user", content="{{input}}")],
            "choices": {"yes": 1, "no": 0},
            "scope": "span",
            "category": "response_quality",
            "details": "Test details",
            "inputs": {"input": {"description": "Input"}},
        }
        values.update(overrides)
        config = ClassificationEvaluatorConfig.model_validate(values)
        attribute_name = f"TEST_{config_index}_CLASSIFICATION_EVALUATOR_CONFIG"
        monkeypatch.setattr(configs_module, attribute_name, config, raising=False)
        return config

    return _make_config


def test_gallery_includes_all_configs_and_uses_stable_order(
    make_config: Callable[..., ClassificationEvaluatorConfig],
) -> None:
    make_config(name="zeta", recommended=False, category="agents", labels=[])
    make_config(
        name="beta",
        recommended=True,
        category="response_quality",
        labels=["not_requested"],
    )
    make_config(name="alpha", recommended=True, category="agents", labels=[])
    make_config(name="partial", scope=None, labels=["requested"])

    gallery_configs = get_evaluator_gallery_configs()
    test_configs = [
        config for config in gallery_configs if config.name in {"alpha", "beta", "partial", "zeta"}
    ]

    assert [config.name for config in test_configs] == ["alpha", "beta", "zeta", "partial"]


def test_gallery_preserves_raw_templates(
    make_config: Callable[..., ClassificationEvaluatorConfig],
) -> None:
    make_config(
        name="tools",
        messages=[PromptMessage(role="user", content="{{available_tools}}")],
        substitutions={"available_tools": "available_tools_list"},
        inputs={"available_tools": {"description": "Available tools"}},
    )

    gallery_configs = get_evaluator_gallery_configs()
    tools_config = next(config for config in gallery_configs if config.name == "tools")

    assert tools_config.messages[0].content == "{{available_tools}}"


def test_legacy_filter_and_order_are_unchanged(
    make_config: Callable[..., ClassificationEvaluatorConfig],
) -> None:
    first = make_config(name="zeta", labels=["requested"])
    second = make_config(name="alpha", labels=["requested"])
    make_config(name="ignored", labels=[])

    configs = get_classification_evaluator_configs(labels=["requested"])

    assert [config.name for config in configs] == [first.name, second.name]
