"""
Compiles YAML prompts into TypeScript code.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Literal, Optional

import yaml
from jinja2 import Template
from pydantic import BaseModel


class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class ClassificationEvaluatorConfig(BaseModel):
    name: str
    description: str
    optimization_direction: Literal["minimize", "maximize"]
    messages: list[PromptMessage]
    choices: dict[str, float]
    formatters: Optional[dict[str, str]] = None  # placeholder -> formatter_name


CLASSIFICATION_EVALUATOR_CONFIG_FILE_TEMPLATE = """\
// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const {{ config_name }}: ClassificationEvaluatorConfig = {
  name: "{{ evaluator_name }}",
  description: "{{ description }}",
  optimizationDirection: "{{ optimization_direction }}",
  template: [
    {
      role: "{{ role }}",
      content: `
{{ content }}
`,
    },
  ],
  choices: {{ choices_json }},
};
"""

INDEX_TEMPLATE = """\
// This file is generated. Do not edit by hand.

{% for config_name in config_names -%}
export { {{ config_name }} } from "./{{ config_name }}";
{% endfor -%}
"""  # noqa: E501


def snake_to_camel(snake_str: str) -> str:
    """
    Convert snake_case string to camelCase.
    e.g., "document_text" -> "documentText"
    """
    components = snake_str.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def convert_mustache_variables_to_camel_case(content: str) -> str:
    """
    Convert all mustache variables from snake_case to camelCase.
    e.g., "{{document_text}}" -> "{{documentText}}"
    """

    def replace_var(match: re.Match[str]) -> str:
        var_name = match.group(1)
        camel_case = snake_to_camel(var_name)
        return f"{{{{{camel_case}}}}}"

    return re.sub(r"\{\{(\w+)\}\}", replace_var, content)


def get_template_file_contents(config_name: str, config: ClassificationEvaluatorConfig) -> str:
    """
    Gets the TypeScript code contents for a classification evaluator config.
    """
    template = Template(CLASSIFICATION_EVALUATOR_CONFIG_FILE_TEMPLATE)
    evaluator_name = config.name
    description = config.description
    choices = {label: int(score) for label, score in config.choices.items()}
    choices_json = json.dumps(choices, indent=2)
    template_content = convert_mustache_variables_to_camel_case(config.messages[0].content.strip())
    optimization_direction = config.optimization_direction.upper()
    content = template.render(
        config_name=config_name,
        evaluator_name=evaluator_name,
        description=description,
        role=config.messages[0].role,
        content=template_content,
        choices_json=choices_json,
        optimization_direction=optimization_direction,
    )
    return content


def get_index_file_contents(config_names: list[str]) -> str:
    """
    Gets the index.ts file contents with exports for all configs.
    """
    template = Template(INDEX_TEMPLATE)
    content = template.render(config_names=config_names)
    return content


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compile YAML prompts to TypeScript code")
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

    # Compile all YAML prompts to TypeScript
    yaml_files = list(prompts_dir.glob("*.yaml"))
    config_names = []

    for yaml_file in sorted(yaml_files):
        config_name = yaml_file.stem
        config_names.append(config_name)

        # Read and validate YAML
        with open(yaml_file, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
        config = ClassificationEvaluatorConfig.model_validate(raw_config)

        # Generate file for the config
        content = get_template_file_contents(config_name, config)
        output_path = output_dir / f"{config_name}.ts"
        output_path.write_text(content, encoding="utf-8")

    # Generate the index.ts file
    index_content = get_index_file_contents(config_names)
    index_path = output_dir / "index.ts"
    index_path.write_text(index_content, encoding="utf-8")
