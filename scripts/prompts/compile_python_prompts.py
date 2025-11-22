"""
Compiles YAML prompts into Python code.
"""

import argparse
import inspect
from pathlib import Path
from typing import Literal

import yaml
from jinja2 import Template
from pydantic import BaseModel


# Based message class copied into the compiled module.
class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


# Base classification evaluator config class copied into the compiled module.
class ClassificationEvaluatorConfig(BaseModel):
    name: str
    description: str
    messages: list[PromptMessage]
    choices: dict[str, float]


MODELS_TEMPLATE = """\
# This file is generated. Do not edit by hand.

from typing import Literal

from pydantic import BaseModel


{{ prompt_message_source }}

{{ classification_evaluator_config_source }}
"""

CLASSIFICATION_EVALUATOR_CONFIG_TEMPLATE = """\
# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

{{ classification_evaluator_config_name }} = {{ classification_evaluator_config_definition }}
"""

INIT_TEMPLATE = """\
# This file is generated. Do not edit by hand.

from ._models import ClassificationEvaluatorConfig, PromptMessage
{% for name in prompt_names -%}
from ._{{ name }} import {{ name }}
{% endfor %}

__all__ = [
    "ClassificationEvaluatorConfig",
    "PromptMessage",
    {{ prompt_names|map('tojson')|join(', ') }}
]
"""


def generate_models_file(output_path: Path) -> None:
    """
    Generate the _models.py file with Pydantic model definitions.
    """
    template = Template(MODELS_TEMPLATE)
    prompt_message_source = inspect.getsource(PromptMessage).strip()
    classification_evaluator_config_source = inspect.getsource(
        ClassificationEvaluatorConfig
    ).strip()
    content = template.render(
        prompt_message_source=prompt_message_source,
        classification_evaluator_config_source=classification_evaluator_config_source,
    )
    output_path.write_text(content, encoding="utf-8")


def compile_prompt(yaml_path: Path, output_dir: Path) -> str:
    """
    Compile a single YAML prompt file to Python.
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        raw_config = yaml.safe_load(f)
    config = ClassificationEvaluatorConfig.model_validate(raw_config)
    name = config.name
    template = Template(CLASSIFICATION_EVALUATOR_CONFIG_TEMPLATE)
    content = template.render(
        classification_evaluator_config_name=name,
        classification_evaluator_config_definition=repr(config),
    )
    output_path = output_dir / f"_{name}.py"
    output_path.write_text(content, encoding="utf-8")
    return name


def compile_all_prompts(prompts_dir: Path, output_dir: Path) -> None:
    """
    Compile all YAML prompt files in the prompts directory.
    """

    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all YAML files
    yaml_files = list(prompts_dir.glob("*.yaml"))
    prompt_names = []
    for yaml_file in sorted(yaml_files):
        name = compile_prompt(yaml_file, output_dir)
        prompt_names.append(name)

    # Generate the __init__.py file
    template = Template(INIT_TEMPLATE)
    content = template.render(prompt_names=prompt_names)

    init_path = output_dir / "__init__.py"
    init_path.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compile YAML prompts to Python code")
    parser.add_argument(
        "compiled_module_path",
        type=Path,
        help="Path to the compiled module",
    )

    args = parser.parse_args()

    output_dir = args.compiled_module_path
    prompts_dir = Path("prompts/classification_evaluator_configs")

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate the _models.py file first
    models_path = output_dir / "_models.py"
    generate_models_file(models_path)

    # Then compile all prompts
    compile_all_prompts(prompts_dir, output_dir)
