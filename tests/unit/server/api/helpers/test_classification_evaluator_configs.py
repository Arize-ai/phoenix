import pytest

import phoenix.__generated__.classification_evaluator_configs as configs_module
from phoenix.__generated__.classification_evaluator_configs import (
    ClassificationEvaluatorConfig,
    PromptMessage,
)
from phoenix.server.api.helpers.classification_evaluator_configs import (
    get_classification_evaluator_configs,
)


def test_gallery_returns_complete_configs_in_order_without_expanding_templates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def make_config(name: str, *, recommended: bool) -> ClassificationEvaluatorConfig:
        return ClassificationEvaluatorConfig.model_validate(
            {
                "name": name,
                "description": "Test evaluator",
                "optimization_direction": "maximize",
                "messages": [PromptMessage(role="user", content="{{available_tools}}")],
                "choices": {"yes": 1, "no": 0},
                "substitutions": {"available_tools": "available_tools_list"},
                "scope": "span",
                "recommended": recommended,
                "category": "agents",
                "details": "Test details",
                "inputs": {"available_tools": {"description": "Available tools"}},
            }
        )

    recommended = make_config("recommended", recommended=True)
    standard = make_config("standard", recommended=False)
    incomplete = standard.model_copy(update={"name": "incomplete", "inputs": None})
    monkeypatch.setattr(
        configs_module,
        "TEST_RECOMMENDED_CLASSIFICATION_EVALUATOR_CONFIG",
        recommended,
        raising=False,
    )
    monkeypatch.setattr(
        configs_module,
        "TEST_STANDARD_CLASSIFICATION_EVALUATOR_CONFIG",
        standard,
        raising=False,
    )
    monkeypatch.setattr(
        configs_module,
        "TEST_INCOMPLETE_CLASSIFICATION_EVALUATOR_CONFIG",
        incomplete,
        raising=False,
    )

    configs = [
        config
        for config in get_classification_evaluator_configs(gallery_ready=True)
        if config.name in {"recommended", "standard", "incomplete"}
    ]

    assert configs == [recommended, standard]
    assert standard.messages[0].content == "{{available_tools}}"
