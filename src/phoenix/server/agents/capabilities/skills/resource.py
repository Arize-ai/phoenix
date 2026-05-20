from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from pydantic_ai import _function_schema


@dataclass
class SkillResource:
    """A skill resource: static content, callable, or file URI.

    Attributes:
        name: Resource name (e.g., "FORMS.md" or "get_samples").
        description: Description of what the resource provides.
        content: Static content string.
        function: Callable that generates content dynamically.
        takes_ctx: Whether the function takes RunContext as first argument.
        function_schema: Function schema for callable resources (auto-generated).
        uri: Optional URI string pointing to a file on disk.
    """

    name: str
    description: str | None = None
    content: str | None = None
    function: Callable[..., Any | Awaitable[Any]] | None = None
    takes_ctx: bool = False
    function_schema: _function_schema.FunctionSchema | None = None
    uri: str | None = None

    def __post_init__(self) -> None:
        if self.content is None and self.function is None and self.uri is None:
            raise ValueError(f"Resource '{self.name}' must have either content, function, or uri")
        if self.function is not None and self.function_schema is None:
            raise ValueError(f"Resource '{self.name}' with function must have function_schema")

    async def load(self, ctx: Any, args: dict[str, Any] | None = None) -> Any:
        """Load resource content.

        Dispatches based on which source is configured:
        - function: invoked with ``args`` and ``ctx``
        - content: returned verbatim
        - uri: file is read from disk; ``.json`` / ``.yaml`` / ``.yml`` are parsed
          (falling back to raw text on parse error), all other extensions return UTF-8 text.

        Args:
            ctx: RunContext for accessing dependencies (unused for file/static resources).
            args: Named arguments for callable resources.

        Returns:
            Resource content (any type).

        Raises:
            ValueError: If resource has no content, function, or uri.
            OSError: If a file-based resource cannot be read. The original ``OSError``
                subclass (``FileNotFoundError``, ``PermissionError``, etc.) is preserved.
        """
        if self.function and self.function_schema:
            return await self.function_schema.call(args or {}, ctx)
        if self.content:
            return self.content
        if self.uri:
            content = Path(self.uri).read_text(encoding="utf-8")
            file_extension = Path(self.name).suffix.lower()
            if file_extension == ".json":
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    return content
            if file_extension in (".yaml", ".yml"):
                try:
                    return yaml.safe_load(content)
                except yaml.YAMLError:
                    return content
            return content
        raise ValueError(f"Resource '{self.name}' has no content, function, or uri")
