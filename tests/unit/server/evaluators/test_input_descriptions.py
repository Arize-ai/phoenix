from types import SimpleNamespace
from typing import Any

import pytest
from strawberry import UNSET

from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptMessage,
    PromptTemplateFormat,
)
from phoenix.server.evaluators.input_descriptions import (
    apply_llm_input_schema,
    described_llm_input_schema,
    input_descriptions,
    parse_input_schema,
    resolve_input_descriptions,
    stored_input_schema,
    with_input_descriptions,
)

_INFERRED: dict[str, Any] = {
    "type": "object",
    "properties": {"input": {"type": "string"}, "context": {}},
    "required": ["context", "input"],
}


def test_input_descriptions_reads_non_empty_strings_by_name() -> None:
    assert input_descriptions(
        {
            "properties": {
                "input": {"type": "string", "description": "The question."},
                "context": {},
                "blank": {"description": "  "},
                "wrong": {"description": 3},
                "broken": "not an object",
            }
        }
    ) == {"input": "The question."}
    assert input_descriptions(None) == {}
    assert input_descriptions({"properties": []}) == {}


@pytest.mark.parametrize(
    "value",
    [
        pytest.param(["input"], id="not-an-object"),
        pytest.param({"properties": "input"}, id="properties-not-an-object"),
        pytest.param({"properties": {"": {"description": "x"}}}, id="blank-name"),
        pytest.param({"properties": {"input": "x"}}, id="property-not-an-object"),
        pytest.param({"properties": {"input": {"description": 1}}}, id="description-not-a-string"),
    ],
)
def test_parse_input_schema_rejects_malformed_schemas(value: Any) -> None:
    with pytest.raises(ValueError):
        parse_input_schema(value)


def test_parse_input_schema_keeps_only_descriptions() -> None:
    assert parse_input_schema(
        {
            "type": "object",
            "properties": {
                "input": {"type": "number", "description": "The question."},
                "context": {"description": ""},
                "extra": {},
            },
            "required": ["input"],
        }
    ) == {"input": "The question."}
    assert parse_input_schema({}) == {}


def test_with_input_descriptions_overlays_and_drops_stale_text() -> None:
    assert with_input_descriptions(
        {
            **_INFERRED,
            "properties": {"input": {"type": "string", "description": "stale"}, "context": {}},
        },
        {"context": "Retrieved documents."},
    ) == {
        "type": "object",
        "properties": {
            "input": {"type": "string"},
            "context": {"description": "Retrieved documents."},
        },
        "required": ["context", "input"],
    }


def test_stored_input_schema_is_null_without_descriptions_and_refuses_unknown_inputs() -> None:
    assert stored_input_schema(_INFERRED, {}) is None
    assert stored_input_schema(_INFERRED, {"input": "The question."}) == {
        "type": "object",
        "properties": {"input": {"type": "string", "description": "The question."}, "context": {}},
        "required": ["context", "input"],
    }
    with pytest.raises(ValueError, match="does not declare: removed"):
        stored_input_schema(_INFERRED, {"input": "x", "removed": "y"})


def test_resolve_input_descriptions_keeps_clears_or_replaces() -> None:
    previous = {
        "properties": {
            "input": {"description": "The question."},
            "removed": {"description": "No longer declared."},
        }
    }
    declared: dict[str, Any] = _INFERRED["properties"]
    # Omitted: the stored descriptions of the inputs still declared.
    assert resolve_input_descriptions(UNSET, previous=previous, declared=declared) == {
        "input": "The question."
    }
    assert resolve_input_descriptions(None, previous=previous, declared=declared) == {}
    # Submitted: taken as given, so an undeclared name reaches stored_input_schema.
    assert resolve_input_descriptions(
        {"properties": {"other": {"description": "Docs."}}}, previous=previous, declared=declared
    ) == {"other": "Docs."}


def _prompt_version(text: str) -> Any:
    return SimpleNamespace(
        template=PromptChatTemplate(
            type="chat", messages=[PromptMessage(role="user", content=text)]
        ),
        template_format=PromptTemplateFormat.MUSTACHE,
    )


_STORED = {"type": "object", "properties": {"output": {"description": "The answer."}}}


def test_unparseable_template_reads_as_none() -> None:
    assert described_llm_input_schema(_prompt_version("Judge {{#ctx}}"), _STORED) is None
    assert described_llm_input_schema(_prompt_version("Judge {{output}}"), _STORED) == {
        "type": "object",
        "properties": {"output": {"type": "string", "description": "The answer."}},
        "required": ["output"],
    }


def test_unparseable_template_keeps_or_clears_but_never_sets_descriptions() -> None:
    broken = _prompt_version("Judge {{#ctx}}")
    evaluator: Any = SimpleNamespace(input_schema=_STORED)
    assert apply_llm_input_schema(evaluator, broken) is False
    assert evaluator.input_schema == _STORED
    assert apply_llm_input_schema(evaluator, broken, {"properties": {"output": {}}}) is False
    assert evaluator.input_schema == _STORED
    with pytest.raises(ValueError, match="could not be parsed"):
        apply_llm_input_schema(
            evaluator, broken, {"properties": {"output": {"description": "New."}}}
        )
    assert apply_llm_input_schema(evaluator, broken, None) is True
    assert evaluator.input_schema is None
