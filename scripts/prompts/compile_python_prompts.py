import inspect
from pathlib import Path
from typing import Literal

import yaml
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


def generate_models_file(output_path: Path) -> None:
    """Generate the _models.py file with Pydantic model definitions."""
    lines: list[str] = []
    lines.append("# This file is generated. Do not edit by hand.")
    lines.append("from typing import Literal")
    lines.append("from pydantic import BaseModel")
    prompt_message_source = inspect.getsource(PromptMessage)
    lines.append(prompt_message_source.rstrip())
    config_source = inspect.getsource(ClassificationEvaluatorConfig)
    lines.append(config_source.rstrip())

    output_path.write_text("\n".join(lines), encoding="utf-8")


def compile_prompt(yaml_path: Path, output_dir: Path) -> str:
    """Compile a single YAML prompt file to Python."""
    with open(yaml_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    config = ClassificationEvaluatorConfig.model_validate(raw)
    name = config.name
    lines: list[str] = []
    lines.append("# This file is generated. Do not edit by hand.")
    lines.append("# ruff: noqa: E501")
    lines.append(
        "from phoenix.prompts.__generated__._models import ClassificationEvaluatorConfig, PromptMessage"  # noqa: E501
    )
    lines.append(f"{name} = {repr(config)}")

    output_path = output_dir / f"_{name}.py"
    output_path.write_text("\n".join(lines), encoding="utf-8")

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
    init_path = output_dir / "__init__.py"
    init_lines: list[str] = []
    init_lines.append("# This file is generated. Do not edit by hand.\n")

    # Import all prompts with fully qualified imports
    for name in prompt_names:
        init_lines.append(f"from phoenix.prompts.__generated__._{name} import {name}\n")

    # Export all prompts
    all_exports = ", ".join([f'"{name}"' for name in prompt_names])
    init_lines.append(f"\n__all__ = [{all_exports}]\n")

    init_path.write_text("\n".join(init_lines), encoding="utf-8")


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
