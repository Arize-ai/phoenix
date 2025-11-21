import sys
from pathlib import Path

import yaml

# Add src to path to import models directly
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from phoenix.prompts._models import User


def generate_instances(
    yaml_path: str,
    output_path: str,
) -> None:
    with open(yaml_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    instances = raw.get("instances", {})
    instance_names = list(instances.keys())

    # Generate the _hallucination_prompts.py file
    lines: list[str] = []
    lines.append("# This file is generated. Do not edit by hand.\n")
    lines.append("from ._models import User\n")

    for name, data in instances.items():
        # validate & coerce via Pydantic
        user = User.model_validate(data)

        # repr(user) is "User(id=..., name=..., ...)" which is valid Python
        lines.append(f"{name} = {repr(user)}\n")

    Path(output_path).write_text("\n".join(lines), encoding="utf-8")

    # Generate the __init__.py file
    output_dir = Path(output_path).parent
    init_path = output_dir / "__init__.py"

    module_name = Path(output_path).stem  # e.g., "_hallucination_prompts"

    init_lines: list[str] = []
    init_lines.append("# This file is generated. Do not edit by hand.\n")

    # Import all instances
    imports = ", ".join(instance_names)
    init_lines.append(f"from .{module_name} import {imports}\n")

    # Export all instances
    all_exports = ", ".join([f'"{name}"' for name in instance_names])
    init_lines.append(f"__all__ = [{all_exports}]\n")

    init_path.write_text("\n".join(init_lines), encoding="utf-8")


if __name__ == "__main__":
    generate_instances(
        "prompts/hallucination.yaml", "src/phoenix/prompts/_hallucination_prompts.py"
    )
