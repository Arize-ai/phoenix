from typing import Optional

import phoenix.__generated__.classification_evaluator_configs as configs_module
from phoenix.__generated__.classification_evaluator_configs import (
    ClassificationEvaluatorConfig as PydanticClassificationEvaluatorConfig,
)
from phoenix.server.api.helpers.substitutions import (
    expand_config_templates,
    load_substitutions,
)


def get_classification_evaluator_configs(
    labels: Optional[list[str]] = None,
    *,
    gallery_ready: bool = False,
) -> list[PydanticClassificationEvaluatorConfig]:
    """
    Load all CLASSIFICATION_EVALUATOR_CONFIG objects from __generated__.

    Automatically discovers all configs by looking for attributes ending with
    '_CLASSIFICATION_EVALUATOR_CONFIG'. For configs with a `substitutions` mapping,
    expands simple placeholders into full Mustache blocks before returning.

    If `gallery_ready` is true, only complete gallery configs are returned,
    ordered by recommendation, category, and name. Otherwise, `labels` optionally
    filters configs with at least one matching label while preserving discovery order.
    """
    configs = []
    substitutions = load_substitutions()

    for attr_name in dir(configs_module):
        if attr_name.endswith("_CLASSIFICATION_EVALUATOR_CONFIG"):
            config = getattr(configs_module, attr_name)
            if isinstance(config, PydanticClassificationEvaluatorConfig):
                # Expand substitutions if the config has a substitutions mapping
                if getattr(config, "substitutions", None):
                    config = expand_config_templates(config, substitutions)
                configs.append(config)

    if gallery_ready:
        return sorted(
            (config for config in configs if is_gallery_ready(config)),
            key=lambda config: (
                not config.recommended,
                config.category.value if config.category else "",
                config.name,
            ),
        )

    if labels:
        requested_labels = set(labels)
        configs = [
            config
            for config in configs
            if any(config_label in requested_labels for config_label in config.labels)
        ]

    return configs


def is_gallery_ready(config: PydanticClassificationEvaluatorConfig) -> bool:
    return bool(config.scope and config.category and config.details is not None and config.inputs)
