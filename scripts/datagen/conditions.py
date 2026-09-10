"""Authored input conditions for trace corpus recorders."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from math import isfinite
from pathlib import Path
from types import MappingProxyType
from typing import TYPE_CHECKING, Any, Literal, cast

if TYPE_CHECKING or __package__:
    from scripts.datagen.fake_tools import (
        ToolError,
        ToolPatchOperation,
        ToolResultOverlay,
        load_fixture_sets,
        validate_result_overlays,
    )
    from scripts.datagen.recording import RecorderFixture, load_fixtures
else:
    from fake_tools import (
        ToolError,
        ToolPatchOperation,
        ToolResultOverlay,
        load_fixture_sets,
        validate_result_overlays,
    )
    from recording import RecorderFixture, load_fixtures

Strength = Literal["subtle", "moderate", "strong"]


class ConditionError(ValueError):
    """Raised when an authored condition cannot be materialized."""


@dataclass(frozen=True)
class ConditionedFixture:
    fixture: RecorderFixture
    tool_fixture_set: Mapping[str, Any] | None
    tool_result_overlays: tuple[ToolResultOverlay, ...]


@dataclass(frozen=True)
class _DocumentEdit:
    target: str
    document_id: str
    operation: str
    source: str | None = None
    replacement: str | None = None
    text: str | None = None


@dataclass(frozen=True)
class _InputReplacement:
    path: str
    value: Any


@dataclass(frozen=True)
class _Payload:
    input_replacements: tuple[_InputReplacement, ...]
    document_edits: tuple[_DocumentEdit, ...]
    tool_overlays: tuple[ToolResultOverlay, ...]


@dataclass(frozen=True)
class _Condition:
    condition_id: str
    fixture_id: str
    fragment_id: str
    intensity: float
    strengths: Mapping[Strength, _Payload]


def strength_for_intensity(intensity: float) -> Strength:
    """Map an authored intensity to its condition strength."""
    if isinstance(intensity, bool) or not isinstance(intensity, (int, float)):
        raise ConditionError("condition intensity must be a number between 0 and 1")
    numeric = float(intensity)
    if not isfinite(numeric) or not 0 <= numeric <= 1:
        raise ConditionError("condition intensity must be a number between 0 and 1")
    if numeric < 0.2:
        return "subtle"
    if numeric < 0.5:
        return "moderate"
    return "strong"


def materialize_condition(
    condition_id: str,
    path: Path | None = None,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
    fixture_sets: Mapping[str, Mapping[str, Any]] | None = None,
) -> ConditionedFixture:
    """Materialize one condition without changing its base fixture data."""
    source = path or Path(__file__).with_name("organic_conditions.json")
    conditions = _load_condition_file(source)
    available_fixtures = tuple(fixtures) if fixtures is not None else load_fixtures()
    fixture_by_id = {fixture.fragment_id: fixture for fixture in available_fixtures}
    if len(fixture_by_id) != len(available_fixtures):
        raise ConditionError("base recorder fixture IDs must be unique")
    available_fixture_sets = fixture_sets if fixture_sets is not None else load_fixture_sets()

    output_ids = [condition.fragment_id for condition in conditions]
    if len(set(output_ids)) != len(output_ids):
        raise ConditionError(f"condition fragment IDs in {source} must be unique")
    base_ids = set(fixture_by_id)
    if collisions := base_ids & set(output_ids):
        raise ConditionError(
            f"condition fragment IDs in {source} collide with base fixtures: {sorted(collisions)}"
        )

    selected: tuple[_Condition, RecorderFixture, _Payload] | None = None
    for condition in conditions:
        try:
            fixture = fixture_by_id[condition.fixture_id]
        except KeyError as error:
            raise ConditionError(
                f"condition {condition.condition_id!r} names unknown fixture "
                f"{condition.fixture_id!r}"
            ) from error
        for payload in condition.strengths.values():
            _materialize_payload(fixture, payload, available_fixture_sets)
        if condition.condition_id == condition_id:
            strength = strength_for_intensity(condition.intensity)
            selected = (condition, fixture, condition.strengths[strength])

    if selected is None:
        raise ConditionError(f"unknown condition {condition_id!r} in {source}")
    condition, fixture, payload = selected
    inputs, tool_fixture_set = _materialize_payload(fixture, payload, available_fixture_sets)
    conditioned = RecorderFixture(
        fragment_id=condition.fragment_id,
        archetype=fixture.archetype,
        domain=fixture.domain,
        inputs=inputs,
    )
    frozen_fixture_set = (
        cast(Mapping[str, Any], _freeze_json(tool_fixture_set))
        if tool_fixture_set is not None
        else None
    )
    return ConditionedFixture(conditioned, frozen_fixture_set, payload.tool_overlays)


def _load_condition_file(source: Path) -> tuple[_Condition, ...]:
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ConditionError(f"unable to load conditions from {source}: {error}") from error
    if not isinstance(value, list) or not value:
        raise ConditionError(f"conditions in {source} must be a non-empty array")
    conditions = tuple(_parse_condition(item, source) for item in value)
    ids = [condition.condition_id for condition in conditions]
    if len(set(ids)) != len(ids):
        raise ConditionError(f"condition IDs in {source} must be unique")
    return conditions


def _parse_condition(value: Any, source: Path) -> _Condition:
    raw = _object(value, "condition", source)
    _exact_fields(
        raw,
        {"condition_id", "fixture_id", "fragment_id", "intensity", "strengths"},
        "condition",
        source,
    )
    condition_id = _string(raw, "condition_id", "condition", source)
    fixture_id = _string(raw, "fixture_id", condition_id, source)
    fragment_id = _string(raw, "fragment_id", condition_id, source)
    intensity = raw["intensity"]
    strength_for_intensity(intensity)
    strengths = _object(raw["strengths"], f"condition {condition_id!r}.strengths", source)
    _exact_fields(
        strengths,
        {"subtle", "moderate", "strong"},
        f"condition {condition_id!r}.strengths",
        source,
    )
    payloads: dict[Strength, _Payload] = {
        strength: _parse_payload(
            strengths[strength], f"condition {condition_id!r}.{strength}", source
        )
        for strength in ("subtle", "moderate", "strong")
    }
    return _Condition(
        condition_id,
        fixture_id,
        fragment_id,
        float(intensity),
        MappingProxyType(payloads),
    )


def _parse_payload(value: Any, field: str, source: Path) -> _Payload:
    raw = _object(value, field, source)
    unknown = set(raw) - {"input_replacements", "document_edits", "tool_overlays"}
    if unknown:
        raise ConditionError(f"{field} in {source} has unknown fields: {sorted(unknown)}")
    replacements_value = raw.get("input_replacements", [])
    edits_value = raw.get("document_edits", [])
    overlays_value = raw.get("tool_overlays", [])
    if (
        not isinstance(replacements_value, list)
        or not isinstance(edits_value, list)
        or not isinstance(overlays_value, list)
    ):
        raise ConditionError(
            f"{field} in {source} replacements, edits, and overlays must be arrays"
        )
    replacements = tuple(
        _parse_input_replacement(item, f"{field}.input_replacements[{index}]", source)
        for index, item in enumerate(replacements_value)
    )
    edits = tuple(
        _parse_document_edit(item, f"{field}.document_edits[{index}]", source)
        for index, item in enumerate(edits_value)
    )
    overlays = tuple(
        _parse_tool_overlay(item, f"{field}.tool_overlays[{index}]", source)
        for index, item in enumerate(overlays_value)
    )
    if not replacements and not edits and not overlays:
        raise ConditionError(f"{field} in {source} must define a replacement, edit, or overlay")
    return _Payload(replacements, edits, overlays)


def _parse_input_replacement(value: Any, field: str, source: Path) -> _InputReplacement:
    raw = _object(value, field, source)
    _exact_fields(raw, {"path", "value"}, field, source)
    return _InputReplacement(_string(raw, "path", field, source), raw["value"])


def _parse_document_edit(value: Any, field: str, source: Path) -> _DocumentEdit:
    raw = _object(value, field, source)
    operation = raw.get("operation")
    if operation == "replace_once":
        expected = {"target", "document_id", "operation", "source", "replacement"}
        _exact_fields(raw, expected, field, source)
        return _DocumentEdit(
            _choice(raw, "target", {"fixture", "tool_corpus"}, field, source),
            _string(raw, "document_id", field, source),
            operation,
            source=_string(raw, "source", field, source),
            replacement=_string(raw, "replacement", field, source, allow_empty=True),
        )
    if operation == "append":
        expected = {"target", "document_id", "operation", "text"}
        _exact_fields(raw, expected, field, source)
        return _DocumentEdit(
            _choice(raw, "target", {"fixture", "tool_corpus"}, field, source),
            _string(raw, "document_id", field, source),
            operation,
            text=_string(raw, "text", field, source),
        )
    raise ConditionError(f"{field}.operation in {source} must be replace_once or append")


def _parse_tool_overlay(value: Any, field: str, source: Path) -> ToolResultOverlay:
    raw = _object(value, field, source)
    _exact_fields(raw, {"tool_name", "match_arguments", "operations"}, field, source)
    match_arguments = _object(raw["match_arguments"], f"{field}.match_arguments", source)
    operations_value = raw["operations"]
    if not isinstance(operations_value, list) or not operations_value:
        raise ConditionError(f"{field}.operations in {source} must be a non-empty array")
    try:
        operations = tuple(
            _parse_tool_operation(item, f"{field}.operations[{index}]", source)
            for index, item in enumerate(operations_value)
        )
        return ToolResultOverlay(
            _string(raw, "tool_name", field, source), match_arguments, operations
        )
    except ToolError as error:
        raise ConditionError(f"invalid {field} in {source}: {error}") from error


def _parse_tool_operation(value: Any, field: str, source: Path) -> ToolPatchOperation:
    raw = _object(value, field, source)
    operation = raw.get("operation")
    expected = {"operation", "path"} if operation == "remove" else {"operation", "path", "value"}
    _exact_fields(raw, expected, field, source)
    if operation not in {"add", "replace", "remove"}:
        raise ConditionError(f"{field}.operation in {source} must be add, replace, or remove")
    path = _string(raw, "path", field, source)
    if operation == "remove":
        return ToolPatchOperation(operation, path)
    return ToolPatchOperation(operation, path, raw["value"])


def _materialize_payload(
    fixture: RecorderFixture,
    payload: _Payload,
    fixture_sets: Mapping[str, Mapping[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    inputs = cast(dict[str, Any], _json_copy(dict(fixture.inputs)))
    base_tool_fixture_set = fixture_sets.get(fixture.domain)
    tool_fixture_set = (
        cast(dict[str, Any], _json_copy(base_tool_fixture_set))
        if base_tool_fixture_set is not None
        else None
    )
    for replacement in payload.input_replacements:
        _apply_input_replacement(inputs, replacement)
    for edit in payload.document_edits:
        if edit.target == "fixture":
            documents = inputs.get("documents")
        else:
            documents = tool_fixture_set.get("documents") if tool_fixture_set is not None else None
        if not isinstance(documents, list):
            raise ConditionError(f"fixture {fixture.fragment_id!r} has no {edit.target} documents")
        _apply_document_edit(documents, edit)
    if payload.tool_overlays:
        if tool_fixture_set is None:
            raise ConditionError(f"fixture {fixture.fragment_id!r} has no local tool fixture set")
        try:
            validate_result_overlays(tool_fixture_set, payload.tool_overlays)
        except ToolError as error:
            raise ConditionError(
                f"fixture {fixture.fragment_id!r} has invalid tool overlays: {error}"
            ) from error
    return inputs, tool_fixture_set


def _apply_input_replacement(inputs: dict[str, Any], replacement: _InputReplacement) -> None:
    if not replacement.path.startswith("/"):
        raise ConditionError(f"input replacement path {replacement.path!r} must start with '/'")
    parts = tuple(
        part.replace("~1", "/").replace("~0", "~")
        for part in replacement.path.removeprefix("/").split("/")
    )
    current: Any = inputs
    for part in parts[:-1]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdecimal() and int(part) < len(current):
            current = current[int(part)]
        else:
            raise ConditionError(f"input replacement path {replacement.path!r} does not exist")
    leaf = parts[-1]
    if isinstance(current, dict) and leaf in current:
        current[leaf] = _replacement_value(current[leaf], replacement)
    elif isinstance(current, list) and leaf.isdecimal() and int(leaf) < len(current):
        index = int(leaf)
        current[index] = _replacement_value(current[index], replacement)
    else:
        raise ConditionError(f"input replacement path {replacement.path!r} does not exist")


def _replacement_value(current: Any, replacement: _InputReplacement) -> Any:
    if isinstance(current, (dict, list)) or isinstance(replacement.value, (dict, list)):
        raise ConditionError(
            f"input replacement path {replacement.path!r} must replace a scalar value"
        )
    return _json_copy(replacement.value)


def _apply_document_edit(documents: list[Any], edit: _DocumentEdit) -> None:
    matches = [
        document
        for document in documents
        if isinstance(document, dict)
        and edit.document_id in (document.get("id"), document.get("source"), document.get("name"))
    ]
    if len(matches) != 1:
        raise ConditionError(
            f"document {edit.document_id!r} in {edit.target} matched {len(matches)} times"
        )
    document = matches[0]
    content = document.get("text")
    if not isinstance(content, str):
        raise ConditionError(f"document {edit.document_id!r} must contain text")
    if edit.operation == "append":
        document["text"] = content + cast(str, edit.text)
        return
    source = cast(str, edit.source)
    count = content.count(source)
    if count != 1:
        raise ConditionError(
            f"replace_once source for document {edit.document_id!r} matched {count} times"
        )
    document["text"] = content.replace(source, cast(str, edit.replacement), 1)


def _object(value: Any, field: str, source: Path) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConditionError(f"{field} in {source} must be an object")
    return value


def _exact_fields(value: Mapping[str, Any], expected: set[str], field: str, source: Path) -> None:
    if set(value) != expected:
        raise ConditionError(f"{field} in {source} must define exactly {sorted(expected)}")


def _string(
    value: Mapping[str, Any],
    name: str,
    field: str,
    source: Path,
    *,
    allow_empty: bool = False,
) -> str:
    item = value.get(name)
    if not isinstance(item, str) or (not allow_empty and not item):
        qualifier = "a string" if allow_empty else "a non-empty string"
        raise ConditionError(f"{field}.{name} in {source} must be {qualifier}")
    return item


def _choice(
    value: Mapping[str, Any],
    name: str,
    choices: set[str],
    field: str,
    source: Path,
) -> str:
    item = value.get(name)
    if item not in choices:
        raise ConditionError(f"{field}.{name} in {source} must be one of {sorted(choices)}")
    return cast(str, item)


def _json_copy(value: Any) -> Any:
    return json.loads(json.dumps(_plain_json(value)))


def _freeze_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): _freeze_json(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_json(item) for item in value)
    return value


def _plain_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _plain_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain_json(item) for item in value]
    return value
