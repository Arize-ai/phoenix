from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field


class AgentCapabilities(BaseModel):
    """Runtime capability state sent by the browser for a chat turn."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    bash_retain_inactive_sessions: bool = Field(
        default=False,
        alias="bash.retainInactiveSessions",
    )
    graphql_mutations: bool = Field(default=False, alias="graphql.mutations")


@dataclass(frozen=True)
class _CapabilityPromptRule:
    field_name: str
    build_line: Callable[[AgentCapabilities], str | None]


def _graphql_mutations_prompt_line(capabilities: AgentCapabilities) -> str:
    if capabilities.graphql_mutations:
        return (
            "GraphQL mutations are enabled for phoenix-gql. Mutation operations may be "
            "executed when they are necessary and appropriate."
        )
    return (
        "GraphQL mutations are disabled for phoenix-gql. Only read-only GraphQL "
        "queries are permitted."
    )


_CAPABILITY_PROMPT_RULES = (
    _CapabilityPromptRule(
        field_name="bash_retain_inactive_sessions",
        # This capability affects browser runtime lifecycle only; it should not
        # change model instructions, but it must be listed so new capabilities
        # cannot bypass the prompt decision point by omission.
        build_line=lambda _: None,
    ),
    _CapabilityPromptRule(
        field_name="graphql_mutations",
        build_line=_graphql_mutations_prompt_line,
    ),
)


def _assert_exhaustive_prompt_rules() -> None:
    # Keep prompt-affecting behavior explicit: each capability either emits
    # model guidance or intentionally no-ops via a rule above.
    model_fields = set(AgentCapabilities.model_fields)
    rule_fields = {rule.field_name for rule in _CAPABILITY_PROMPT_RULES}
    if model_fields != rule_fields:
        missing = sorted(model_fields - rule_fields)
        extra = sorted(rule_fields - model_fields)
        raise RuntimeError(
            "Agent capability prompt rules must cover every capability field; "
            f"missing={missing}, extra={extra}"
        )


def build_capability_system_prompt(capabilities: AgentCapabilities) -> str:
    """Render server-owned model guidance for runtime capability state."""
    _assert_exhaustive_prompt_rules()
    capability_lines = [
        line
        for rule in _CAPABILITY_PROMPT_RULES
        if (line := rule.build_line(capabilities)) is not None
    ]

    if not capability_lines:
        return ""

    return "\n".join(
        [
            "Runtime capability state for this conversation:",
            *[f"- {line}" for line in capability_lines],
        ]
    )


def append_capability_system_prompt(
    system_prompt: str | None,
    capabilities: AgentCapabilities,
) -> str | None:
    """Append server-owned capability guidance to the user-configured prompt."""
    capability_prompt = build_capability_system_prompt(capabilities)
    if not capability_prompt:
        return system_prompt
    if not system_prompt:
        return capability_prompt
    return f"{system_prompt}\n\n{capability_prompt}"
