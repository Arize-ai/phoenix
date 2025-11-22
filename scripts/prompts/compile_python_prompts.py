import inspect
from pathlib import Path
from typing import Literal

import yaml
from jinja2 import Template
from pydantic import BaseModel


# Define the models here - they will be generated into _models.py
class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class ClassificationEvaluatorConfig(BaseModel):
    name: str
    description: str
    messages: list[PromptMessage]
    choices: dict[str, float]


# Jinja2 templates defined inline
MODELS_TEMPLATE = """\
# This file is generated. Do not edit by hand.
from typing import Literal

from pydantic import BaseModel


{{ prompt_message_source }}

{{ config_source }}
"""

PROMPT_TEMPLATE = """\
# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from phoenix.prompts.__generated__._models import ClassificationEvaluatorConfig, PromptMessage

{{ name }} = {{ config_repr }}
"""

INIT_TEMPLATE = """\
# This file is generated. Do not edit by hand.
{% for name in prompt_names -%}
from phoenix.prompts.__generated__._{{ name }} import {{ name }}
{% endfor %}
__all__ = [{{ prompt_names|map('tojson')|join(', ') }}]
"""


def generate_models_file(output_path: Path) -> None:
    """Generate the _models.py file with Pydantic model definitions."""
    template = Template(MODELS_TEMPLATE)

    # Get source code for classes
    prompt_message_source = inspect.getsource(PromptMessage).rstrip()
    config_source = inspect.getsource(ClassificationEvaluatorConfig).rstrip()

    content = template.render(
        prompt_message_source=prompt_message_source,
        config_source=config_source,
    )

    output_path.write_text(content, encoding="utf-8")


def compile_prompt(yaml_path: Path, output_dir: Path) -> str:
    """Compile a single YAML prompt file to Python."""
    with open(yaml_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    config = ClassificationEvaluatorConfig.model_validate(raw)
    name = config.name

    template = Template(PROMPT_TEMPLATE)
    content = template.render(
        name=name,
        config_repr=repr(config),
    )

    output_path = output_dir / f"_{name}.py"
    output_path.write_text(content, encoding="utf-8")

    return name


def compile_all_prompts(prompts_dir: Path, output_dir: Path) -> None:
    """Compile all YAML prompt files in the prompts directory."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all YAML files
    yaml_files = list(prompts_dir.glob("*.yaml")) + list(prompts_dir.glob("*.yml"))

    # Compile each prompt file
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
    prompts_base_dir = Path("src/phoenix/prompts")
    prompts_dir = Path("prompts")
    output_dir = prompts_base_dir / "__generated__"

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate the _models.py file first in __generated__
    models_path = output_dir / "_models.py"
    generate_models_file(models_path)

    # Then compile all prompts
    compile_all_prompts(prompts_dir, output_dir)
