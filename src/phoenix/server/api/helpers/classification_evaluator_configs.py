import phoenix.__generated__.classification_evaluator_configs as configs_module
from phoenix.__generated__.classification_evaluator_configs import (
    ClassificationEvaluatorConfig as PydanticClassificationEvaluatorConfig,
)
from phoenix.server.api.helpers.formatters import expand_config_templates, load_formatters


def get_classification_evaluator_configs() -> list[PydanticClassificationEvaluatorConfig]:
    """
    Load all CLASSIFICATION_EVALUATOR_CONFIG objects from __generated__.

    Automatically discovers all configs by looking for attributes ending with
    '_CLASSIFICATION_EVALUATOR_CONFIG'. For configs with a `formatters` mapping,
    expands simple placeholders into full Mustache blocks before returning.
    """
    configs = []
    formatters = load_formatters()

    for attr_name in dir(configs_module):
        if attr_name.endswith("_CLASSIFICATION_EVALUATOR_CONFIG"):
            config = getattr(configs_module, attr_name)
            if isinstance(config, PydanticClassificationEvaluatorConfig):
                # Expand formatters if the config has a formatters mapping
                if config.formatters:
                    config = expand_config_templates(config, formatters)
                configs.append(config)

    return configs
