import sys
from pathlib import Path

import yaml

# Add src to path to import models directly
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from phoenix.prompts._models import _BuiltInLLMEvaluatorConfig


def compile_prompt(yaml_path: Path, output_dir: Path) -> str:
    """Compile a single YAML prompt file to Python."""
    with open(yaml_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    # Validate & coerce via Pydantic
    config = _BuiltInLLMEvaluatorConfig.model_validate(raw)

    # Use the name field to determine the variable name and filename
    name = config.name

    # Generate the Python file
    lines: list[str] = []
    lines.append("# This file is generated. Do not edit by hand.\n")
    lines.append("# ruff: noqa: E501\n")
    lines.append("from .._models import _BuiltInLLMEvaluatorConfig, _PromptMessage\n")
    lines.append(f"\n{name} = {repr(config)}\n")

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
    prompts_dir = Path("prompts")
    output_dir = Path("src/phoenix/prompts/__generated__")
    compile_all_prompts(prompts_dir, output_dir)
