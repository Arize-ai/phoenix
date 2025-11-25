"""
Compiles YAML prompts into TypeScript code.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Literal

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


TEMPLATE_FILE_TEMPLATE = """\
// This file is generated. Do not edit by hand.

import type { PromptTemplate } from "../../types/templating";

export const {{ template_name }}: PromptTemplate = [
  {
    role: "{{ role }}",
    content: `
{{ content }}`,
  },
];

export const {{ choices_name }} = {{ choices_json }};

export const {{ optimization_direction_name }} = "{{ optimization_direction }}";
"""

INDEX_TEMPLATE = """\
// This file is generated. Do not edit by hand.

{% for template_name, choices_name, optimization_direction_name, file_name in exports -%}
export { {{ template_name }}, {{ choices_name }}, {{ optimization_direction_name }} } from "./{{ file_name }}";
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


def get_template_file_contents(config: ClassificationEvaluatorConfig) -> str:
    """
    Gets the TypeScript code contents for a classification evaluator template.
    """
    template = Template(TEMPLATE_FILE_TEMPLATE)
    evaluator_name = config.name.upper()
    template_name = f"{evaluator_name}_TEMPLATE"
    choices_name = f"{evaluator_name}_CHOICES"
    optimization_direction_name = f"{evaluator_name}_OPTIMIZATION_DIRECTION"

    choices = {label: int(score) for label, score in config.choices.items()}

    choices_json = json.dumps(choices, indent=2)
    template_content = convert_mustache_variables_to_camel_case(config.messages[0].content.strip())
    optimization_direction = config.optimization_direction.upper()

    content = template.render(
        template_name=template_name,
        role=config.messages[0].role,
        content=template_content,
        choices_name=choices_name,
        choices_json=choices_json,
        optimization_direction_name=optimization_direction_name,
        optimization_direction=optimization_direction,
    )
    return content


def get_index_file_contents(configs: list[ClassificationEvaluatorConfig]) -> str:
    """
    Gets the index.ts file contents with exports for all templates.
    """
    template = Template(INDEX_TEMPLATE)
    exports = []
    for config in configs:
        evaluator_name = config.name.upper()
        template_name = f"{evaluator_name}_TEMPLATE"
        choices_name = f"{evaluator_name}_CHOICES"
        optimization_direction_name = f"{evaluator_name}_OPTIMIZATION_DIRECTION"
        file_name = template_name.lower()
        exports.append((template_name, choices_name, optimization_direction_name, file_name))

    content = template.render(exports=exports)
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
    configs = []

    for yaml_file in sorted(yaml_files):
        # Read and validate YAML
        with open(yaml_file, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
        config = ClassificationEvaluatorConfig.model_validate(raw_config)

        # Generate TypeScript code using config name
        content = get_template_file_contents(config)
        configs.append(config)

        # Write to file
        evaluator_name = config.name.upper()
        template_name = f"{evaluator_name}_TEMPLATE"
        output_path = output_dir / f"{template_name.lower()}.ts"
        output_path.write_text(content, encoding="utf-8")

    # Generate the index.ts file
    index_content = get_index_file_contents(configs)
    index_path = output_dir / "index.ts"
    index_path.write_text(index_content, encoding="utf-8")
