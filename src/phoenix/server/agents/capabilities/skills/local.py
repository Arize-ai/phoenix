"""Filesystem-based skill resources.

This module provides:
- FileBasedSkillResource: File-based skill resource implementation
- Factory functions for creating file-based resources
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from phoenix.server.agents.capabilities.skills.types import SkillResource


@dataclass
class FileBasedSkillResource(SkillResource):
    """A file-based skill resource that loads content from disk.

    This subclass extends SkillResource to add filesystem support.
    The uri attribute points to the file location and serves as the unique identifier.
    """

    async def load(self, ctx: Any, args: dict[str, Any] | None = None) -> Any:
        """Load resource content from file.

        JSON and YAML files are parsed; falls back to text if parsing fails.
        Other file types are returned as UTF-8 text.

        Args:
            ctx: RunContext for accessing dependencies (unused for file-based resources).
            args: Named arguments (unused for file-based resources).

        Returns:
            Parsed dict (JSON/YAML) or UTF-8 text string.

        Raises:
            ValueError: If the resource has no URI configured.
            OSError: If the file cannot be read. The original ``OSError`` subclass
                (``FileNotFoundError``, ``PermissionError``, etc.) is preserved
                along with ``errno``/``filename`` so callers can branch on the
                error kind.
        """
        if not self.uri:
            raise ValueError(f"Resource '{self.name}' has no URI")

        resource_path = Path(self.uri)
        content = resource_path.read_text(encoding="utf-8")

        file_extension = Path(self.name).suffix.lower()

        if file_extension == ".json":
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return content

        elif file_extension in (".yaml", ".yml"):
            try:
                return yaml.safe_load(content)
            except yaml.YAMLError:
                return content

        return content


def create_file_based_resource(
    name: str,
    uri: str,
    description: str | None = None,
) -> FileBasedSkillResource:
    """Create a file-based resource.

    Args:
        name: Resource name (e.g., "FORMS.md", "data.json").
        uri: Path to the resource file.
        description: Optional resource description.

    Returns:
        FileBasedSkillResource instance.
    """
    return FileBasedSkillResource(
        name=name,
        uri=uri,
        description=description,
    )
