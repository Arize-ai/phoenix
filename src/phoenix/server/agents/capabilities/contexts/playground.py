from __future__ import annotations

from dataclasses import dataclass
from string import ascii_uppercase
from typing import Any

from jinja2 import Template
from markupsafe import escape
from pydantic_ai import RunContext
from pydantic_ai.tools import SystemPromptFunc

from phoenix.server.agents.capabilities.base import AbstractDynamicCapability
from phoenix.server.agents.context import (
    PlaygroundBuiltinModelContext,
    PlaygroundContext,
    PlaygroundCustomProviderModelContext,
    PlaygroundInstanceContext,
    sanitize_untrusted_value,
)
from phoenix.server.agents.types import AgentDependencies


def _sanitize_playground_value(value: str | None) -> str:
    if value is None:
        return ""
    sanitized = sanitize_untrusted_value(
        value,
        enclosing_tag="phoenix_playground_context",
        max_chars=200,
    )
    # Playground values are rendered in XML attributes, so also escape quotes
    # and angle brackets after applying the standard prompt-context sanitizer.
    return str(escape(sanitized))


def _serialize_instance(
    instance: PlaygroundInstanceContext,
    *,
    index: int,
) -> dict[str, Any]:
    return {
        "label": ascii_uppercase[index],
        "instance_id": instance.instance_id,
        "provider": _sanitize_playground_value(instance.provider),
        "model_name": _sanitize_playground_value(instance.model_name),
        "custom_provider_id": _sanitize_playground_value(instance.custom_provider_id),
        "custom_provider_name": _sanitize_playground_value(instance.custom_provider_name),
    }


def _serialize_builtin_model(model: PlaygroundBuiltinModelContext) -> dict[str, str]:
    return {
        "provider": _sanitize_playground_value(model.provider),
        "model_name": _sanitize_playground_value(model.model_name),
    }


def _serialize_custom_model(model: PlaygroundCustomProviderModelContext) -> dict[str, str]:
    return {
        "custom_provider_id": _sanitize_playground_value(model.custom_provider_id),
        "custom_provider_name": _sanitize_playground_value(model.custom_provider_name),
        "provider": _sanitize_playground_value(model.provider),
        "model_name": _sanitize_playground_value(model.model_name),
    }


def _serialize_playground(playground: PlaygroundContext) -> dict[str, Any]:
    return {
        "instances": [
            _serialize_instance(instance, index=index)
            for index, instance in enumerate(playground.instances)
        ],
        "available_builtin_models": [
            _serialize_builtin_model(model) for model in playground.available_builtin_models
        ],
        "available_custom_models": [
            _serialize_custom_model(model) for model in playground.available_custom_models
        ],
    }


@dataclass
class PlaygroundContextCapability(AbstractDynamicCapability[AgentDependencies]):
    instructions: Template

    def get_dynamic_instructions(self) -> SystemPromptFunc[AgentDependencies]:
        instructions = self.instructions

        def _instructions(ctx: RunContext[AgentDependencies]) -> str | None:
            playground = ctx.deps.contexts.playground
            if playground is None:
                return None
            return instructions.render(
                playground=_serialize_playground(playground),
                dataset=ctx.deps.contexts.dataset,
            )

        return _instructions

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
