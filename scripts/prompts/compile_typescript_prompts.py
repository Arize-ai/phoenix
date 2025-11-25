"""
Compiles YAML prompts into TypeScript code.
"""

import argparse
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
"""

INDEX_TEMPLATE = """\
// This file is generated. Do not edit by hand.

{% for template_name, choices_name, file_name in exports -%}
export { {{ template_name }}, {{ choices_name }} } from "./{{ file_name }}";
{% endfor -%}
"""


def snake_to_camel(snake_str: str) -> str:
    """
    Convert snake_case string to camelCase.
    e.g., "document_text" -> "documentText"
    """
    components = snake_str.split("_")
    # Keep the first component lowercase, capitalize the rest
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

    # Match mustache variables like {{variable_name}}
    return re.sub(r"\{\{(\w+)\}\}", replace_var, content)


def get_template_name(yaml_file_stem: str) -> str:
    """
    Converts YAML filename to TypeScript template name.
    e.g., "HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG" -> "HALLUCINATION_TEMPLATE"
    """
    base = yaml_file_stem.replace("_CLASSIFICATION_EVALUATOR_CONFIG", "")
    return f"{base}_TEMPLATE"


def get_choices_name(template_name: str) -> str:
    """
    Gets the choices constant name from template name.
    e.g., "HALLUCINATION_TEMPLATE" -> "HALLUCINATION_CHOICES"
    """
    return template_name.replace("_TEMPLATE", "_CHOICES")


def get_template_file_contents(config: ClassificationEvaluatorConfig, yaml_file_stem: str) -> str:
    """
    Gets the TypeScript code contents for a classification evaluator template.
    """
    template = Template(TEMPLATE_FILE_TEMPLATE)
    template_name = get_template_name(yaml_file_stem)
    choices_name = get_choices_name(template_name)

    # Convert choices to integers for TypeScript
    choices = {label: int(score) for label, score in config.choices.items()}

    # Format choices as JSON with 2-space indent
    import json

    choices_json = json.dumps(choices, indent=2)

    # Convert mustache variables from snake_case to camelCase for TypeScript
    template_content = convert_mustache_variables_to_camel_case(config.messages[0].content.strip())

    content = template.render(
        template_name=template_name,
        role=config.messages[0].role,
        content=template_content,
        choices_name=choices_name,
        choices_json=choices_json,
    )
    return content


def get_index_file_contents(yaml_file_stems: list[str]) -> str:
    """
    Gets the index.ts file contents with exports for all templates.
    """
    template = Template(INDEX_TEMPLATE)
    exports = []
    for stem in yaml_file_stems:
        template_name = get_template_name(stem)
        choices_name = get_choices_name(template_name)
        file_name = template_name.lower()
        exports.append((template_name, choices_name, file_name))

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
    yaml_file_stems = []

    for yaml_file in sorted(yaml_files):
        # Read and validate YAML
        with open(yaml_file, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
        config = ClassificationEvaluatorConfig.model_validate(raw_config)

        # Generate TypeScript code using YAML filename
        yaml_stem = yaml_file.stem
        content = get_template_file_contents(config, yaml_stem)
        yaml_file_stems.append(yaml_stem)

        # Write to file
        template_name = get_template_name(yaml_stem)
        output_path = output_dir / f"{template_name.lower()}.ts"
        output_path.write_text(content, encoding="utf-8")

    # Generate the index.ts file
    index_content = get_index_file_contents(yaml_file_stems)
    index_path = output_dir / "index.ts"
    index_path.write_text(index_content, encoding="utf-8")
