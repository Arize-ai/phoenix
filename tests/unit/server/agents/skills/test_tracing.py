from __future__ import annotations

import pytest
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes

from phoenix.server.agents.capabilities.skills import ContentSkillResource
from phoenix.server.agents.skills import build_skills
from phoenix.server.agents.skills.tracing import TRACING_SKILL

_EXPECTED_RESOURCES = (
    "span-kinds",
    "semantic-conventions",
    "token-cost-and-context",
    "annotations-and-notes",
)


def _resource_text() -> str:
    """The SKILL.md body plus every resource, concatenated for substring checks."""
    parts = [TRACING_SKILL.content]
    for resource in TRACING_SKILL.resources:
        assert isinstance(resource, ContentSkillResource)
        parts.append(resource.content)
    return "\n".join(parts)


def test_skill_loads_with_expected_shape() -> None:
    assert TRACING_SKILL.name == "tracing"
    assert TRACING_SKILL.summary.strip()
    assert TRACING_SKILL.content.strip()
    assert tuple(r.name for r in TRACING_SKILL.resources) == _EXPECTED_RESOURCES


def test_skill_is_registered_as_a_base_skill() -> None:
    """The tracing skill must be available unconditionally (no context gating)."""
    names = {skill.name for skill in build_skills()}
    assert "tracing" in names


def test_span_kinds_reference_matches_openinference() -> None:
    """Anti-rot: the span-kinds table stays in sync with the OpenInference enum.

    If a kind is added to or removed from the package, this fails so the reference
    is updated instead of silently rotting.
    """
    span_kinds = next(r for r in TRACING_SKILL.resources if r.name == "span-kinds")
    assert isinstance(span_kinds, ContentSkillResource)
    text = span_kinds.content

    package_kinds = {k.value for k in OpenInferenceSpanKindValues}
    for kind in package_kinds:
        assert f"`{kind}`" in text, f"span kind {kind!r} is not documented in span-kinds.md"

    # The body claims a specific count; keep it honest against the package.
    assert f"There are **{len(package_kinds)}**" in text


# Load-bearing attribute constants the references quote verbatim. Sourcing the
# expected strings from the package means a rename there breaks this test,
# prompting a doc update rather than letting the reference drift.
_REFERENCED_ATTRIBUTES = (
    "OPENINFERENCE_SPAN_KIND",
    "LLM_MODEL_NAME",
    "LLM_PROVIDER",
    "LLM_INPUT_MESSAGES",
    "LLM_OUTPUT_MESSAGES",
    "LLM_INVOCATION_PARAMETERS",
    "LLM_TOKEN_COUNT_PROMPT",
    "LLM_TOKEN_COUNT_COMPLETION",
    "LLM_TOKEN_COUNT_TOTAL",
    "LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ",
    "LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE",
    "LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING",
    "LLM_COST_PROMPT",
    "LLM_COST_COMPLETION",
    "LLM_COST_TOTAL",
    "RETRIEVAL_DOCUMENTS",
    "EMBEDDING_MODEL_NAME",
    "TOOL_NAME",
    "TOOL_DESCRIPTION",
    "SESSION_ID",
)


@pytest.mark.parametrize("attr_name", _REFERENCED_ATTRIBUTES)
def test_referenced_attributes_exist_in_openinference(attr_name: str) -> None:
    key = getattr(SpanAttributes, attr_name)
    assert key in _resource_text(), (
        f"attribute {key!r} ({attr_name}) is referenced by the tracing skill but "
        "no longer appears in its resources — update the reference"
    )
