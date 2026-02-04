import phoenix.__generated__.classification_evaluator_configs as configs_module
from phoenix.__generated__.classification_evaluator_configs import (
    ClassificationEvaluatorConfig as PydanticClassificationEvaluatorConfig,
)
from phoenix.server.api.helpers.substitutions import (
    expand_config_templates,
    load_substitutions,
)


def get_classification_evaluator_configs() -> list[PydanticClassificationEvaluatorConfig]:
    """
    Load all CLASSIFICATION_EVALUATOR_CONFIG objects from __generated__.

    Automatically discovers all configs by looking for attributes ending with
    '_CLASSIFICATION_EVALUATOR_CONFIG'. For configs with a `substitutions` mapping,
    expands simple placeholders into full Mustache blocks before returning.
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

    return configs
