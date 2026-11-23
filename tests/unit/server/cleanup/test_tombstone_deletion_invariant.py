"""Only the cleanup coordinator may hard-delete rows that carry a ``deleted_at`` tombstone."""

from __future__ import annotations

import ast
import re
from pathlib import Path

import phoenix

_TOMBSTONED_MODEL_NAMES = frozenset({"Project", "ProjectEvaluator", "DatasetEvaluators"})
_RAW_DELETE_PATTERN = re.compile(
    r"\bDELETE\s+FROM\s+(projects|project_evaluators|dataset_evaluators)\b", re.IGNORECASE
)
_SOURCE_ROOT = Path(phoenix.__file__).parent
_ALLOWED_PATHS = frozenset({_SOURCE_ROOT / "server" / "cleanup" / "coordinator.py"})
_MIGRATIONS_ROOT = _SOURCE_ROOT / "db" / "migrations"


def _referenced_model_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _is_delete_call_on_tombstoned_model(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call) or not node.args:
        return False
    called = node.func
    called_name = called.id if isinstance(called, ast.Name) else _referenced_model_name(called)
    return called_name == "delete" and _referenced_model_name(node.args[0]) in (
        _TOMBSTONED_MODEL_NAMES
    )


def _find_hard_deletes_of_tombstoned_rows() -> list[str]:
    offenders: list[str] = []
    for path in sorted(_SOURCE_ROOT.rglob("*.py")):
        if path in _ALLOWED_PATHS or _MIGRATIONS_ROOT in path.parents:
            continue
        source = path.read_text()
        relative_path = path.relative_to(_SOURCE_ROOT)
        for node in ast.walk(ast.parse(source)):
            if _is_delete_call_on_tombstoned_model(node):
                offenders.append(f"{relative_path}:{getattr(node, 'lineno', 0)}")
        for match in _RAW_DELETE_PATTERN.finditer(source):
            offenders.append(f"{relative_path}: {match.group(0)}")
    return offenders


def test_only_cleanup_hard_deletes_tombstoned_rows() -> None:
    assert _find_hard_deletes_of_tombstoned_rows() == []


def test_guard_flags_tombstoned_models_and_ignores_others() -> None:
    def parse_call(source: str) -> ast.AST:
        statement = ast.parse(source).body[0]
        assert isinstance(statement, ast.Expr)
        return statement.value

    assert _is_delete_call_on_tombstoned_model(parse_call("delete(models.Project)"))
    assert _is_delete_call_on_tombstoned_model(parse_call("sa.delete(models.DatasetEvaluators)"))
    assert _is_delete_call_on_tombstoned_model(parse_call("delete(ProjectEvaluator)"))
    assert not _is_delete_call_on_tombstoned_model(parse_call("delete(models.ProjectSession)"))
    assert not _is_delete_call_on_tombstoned_model(parse_call("session.get(models.Project, 1)"))
