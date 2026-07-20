import ast
import copy
import hashlib
import inspect
import json
from types import ModuleType
from typing import Any, cast

import pytest
from pydantic import ValidationError
from syrupy.assertion import SnapshotAssertion

from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    UIMessage,
    UIToolPart,
)
from phoenix.db.types.data_stream_protocol import _ui_messages as vendored_ui_messages

_PART_MODEL_NAMES = (
    "UITextPart",
    "UIReasoningPart",
    "UICustomPart",
    "UIToolInvocationPart",
    "UIStepStartPart",
    "UIToolApproval",
    "UIToolPart",
    "UIDynamicToolPart",
    "UIFilePart",
    "UIReasoningFilePart",
    "UISourceUrlPart",
    "UISourceDocumentPart",
    "UIDataPart",
)


class _VendoredPatchNormalizer(ast.NodeTransformer):
    """Remove only the documented Phoenix patches before comparing source ASTs."""

    def visit_Import(self, node: ast.Import) -> ast.Import | None:
        # Phoenix uses secrets for its local, Python 3.10-compatible message ID factory.
        return None if [alias.name for alias in node.names] == ["secrets"] else node

    def visit_ImportFrom(self, node: ast.ImportFrom) -> ast.ImportFrom | None:
        # Phoenix generates message IDs locally instead of importing the Python 3.12 SDK.
        if node.level == 3 and node.module == "types":
            return None
        return node

    def visit_FunctionDef(self, node: ast.FunctionDef) -> ast.FunctionDef | None:
        if node.name == "_generate_message_id":
            return None
        if node.name == "_parse_ui_part":
            node.returns = ast.Name(id="UIMessagePart")
            node.body = [ast.Pass()]
            return node
        if node.name == "parse_parts":
            node.body = [ast.Pass()]
            return node
        visited = self.generic_visit(node)
        assert isinstance(visited, ast.FunctionDef)
        return visited

    def visit_Assign(self, node: ast.Assign) -> ast.Assign:
        visited = self.generic_visit(node)
        assert isinstance(visited, ast.Assign)
        node = visited
        if any(
            isinstance(target, ast.Name) and target.id == "_UI_MODEL_CONFIG"
            for target in node.targets
        ):
            assert isinstance(node.value, ast.Call)
            for keyword in node.value.keywords:
                if keyword.arg == "extra":
                    keyword.value = ast.Constant(value="normalized-extra")
        return node

    def visit_ClassDef(self, node: ast.ClassDef) -> ast.ClassDef:
        visited = self.generic_visit(node)
        assert isinstance(visited, ast.ClassDef)
        node = visited
        for statement in node.body:
            if not isinstance(statement, ast.AnnAssign) or not isinstance(
                statement.target, ast.Name
            ):
                continue
            if node.name == "UIToolPart" and statement.target.id == "input":
                statement.annotation = ast.Name(id="NormalizedToolInput")
            if node.name == "UIMessage" and statement.target.id == "id":
                statement.value = ast.Constant(value="normalized-id-factory")
        return node


def _normalized_source_ast(module: ModuleType) -> str:
    tree = ast.parse(inspect.getsource(module))
    normalized = _VendoredPatchNormalizer().visit(tree)
    assert isinstance(normalized, ast.Module)
    return ast.dump(ast.fix_missing_locations(normalized), include_attributes=False)


def _upstream_ui_messages() -> ModuleType:
    return cast(ModuleType, pytest.importorskip("ai.ui.ai_sdk.ui_messages"))


def _normalize_schema(schema: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(schema)

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            value.pop("additionalProperties", None)
            if value.get("title") == "UIToolPart":
                properties = value.get("properties")
                if isinstance(properties, dict):
                    properties.pop("input", None)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(normalized)
    return normalized


def _schema_snapshot(schema: dict[str, Any]) -> dict[str, Any]:
    def summarize(model_schema: dict[str, Any]) -> dict[str, Any]:
        summary: dict[str, Any] = {
            "fields": sorted(model_schema.get("properties", {})),
            "required": model_schema.get("required", []),
        }
        if "additionalProperties" in model_schema:
            summary["additionalProperties"] = model_schema["additionalProperties"]
        if "discriminator" in model_schema:
            summary["discriminator"] = model_schema["discriminator"]
        return summary

    serialized = json.dumps(schema, sort_keys=True, separators=(",", ":"))
    definitions = schema.get("$defs", {})
    return {
        "sha256": hashlib.sha256(serialized.encode()).hexdigest(),
        "root": summarize(schema),
        "models": {
            name: summarize(model_schema) for name, model_schema in sorted(definitions.items())
        },
    }


def test_vendored_ui_messages_match_ai_source_modulo_documented_patches() -> None:
    upstream_ui_messages = _upstream_ui_messages()
    assert _normalized_source_ast(vendored_ui_messages) == _normalized_source_ast(
        upstream_ui_messages
    )


@pytest.mark.parametrize("model_name", _PART_MODEL_NAMES)
def test_vendored_part_schema_matches_ai_modulo_documented_patches(model_name: str) -> None:
    upstream_ui_messages = _upstream_ui_messages()
    vendored_model = getattr(vendored_ui_messages, model_name)
    upstream_model = getattr(upstream_ui_messages, model_name)
    assert _normalize_schema(vendored_model.model_json_schema()) == _normalize_schema(
        upstream_model.model_json_schema()
    )


def test_persisted_contract_schema(snapshot: SnapshotAssertion) -> None:
    snapshot.assert_match(
        {"PhoenixUIMessage": _schema_snapshot(PhoenixUIMessage.model_json_schema())}
    )


def test_unknown_message_fields_fail_closed() -> None:
    with pytest.raises(ValidationError):
        UIMessage.model_validate(
            {
                "id": "message-1",
                "role": "user",
                "parts": [{"type": "text", "text": "hello", "unexpected": True}],
            }
        )


def test_unknown_part_types_fail_closed() -> None:
    with pytest.raises(ValidationError, match="Unsupported UI part type"):
        UIMessage.model_validate(
            {
                "id": "message-1",
                "role": "assistant",
                "parts": [{"type": "future-part", "value": "do not drop me"}],
            }
        )


@pytest.mark.parametrize("tool_input", [42, ["non", "object"], True])
def test_tool_input_remains_backward_compatible_with_arbitrary_json(tool_input: Any) -> None:
    message = UIMessage.model_validate(
        {
            "id": "message-1",
            "role": "assistant",
            "parts": [
                {
                    "type": "tool-lookup",
                    "toolCallId": "call-1",
                    "state": "input-available",
                    "input": tool_input,
                }
            ],
        }
    )
    part = message.parts[0]
    assert isinstance(part, UIToolPart)
    assert part.input == tool_input
