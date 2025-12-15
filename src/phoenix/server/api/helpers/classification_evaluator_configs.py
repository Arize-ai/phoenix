import phoenix.__generated__.classification_evaluator_configs as configs_module
from phoenix.__generated__.classification_evaluator_configs import (
    ClassificationEvaluatorConfig as PydanticClassificationEvaluatorConfig,
)


def get_classification_evaluator_configs() -> list[PydanticClassificationEvaluatorConfig]:
    """
    Load all CLASSIFICATION_EVALUATOR_CONFIG objects from __generated__.
    Automatically discovers all configs by looking for attributes ending with
    '_CLASSIFICATION_EVALUATOR_CONFIG'.
    """
    configs = []
    for attr_name in dir(configs_module):
        if attr_name.endswith("_CLASSIFICATION_EVALUATOR_CONFIG"):
            config = getattr(configs_module, attr_name)
            if isinstance(config, PydanticClassificationEvaluatorConfig):
                configs.append(config)

    return configs
