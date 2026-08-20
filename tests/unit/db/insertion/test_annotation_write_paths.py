import ast
from pathlib import Path

_SOURCE_ROOT = Path(__file__).parents[4] / "src" / "phoenix"
_ANNOTATION_MODELS = {"SpanAnnotation", "TraceAnnotation", "ProjectSessionAnnotation"}
_ANNOTATION_FIELDS = {
    "name",
    "label",
    "score",
    "explanation",
    "metadata_",
    "annotator_kind",
    "identifier",
    "source",
    "user_id",
}
_SHARED_MODULE = Path("db/insertion/annotation.py")
# The executor names the annotation table to pick a conflict target, then writes
# through the shared seam inside its fenced work-unit transition.
_SANCTIONED_CORE_WRITERS = frozenset({Path("server/online_eval/executor.py")})


def _references_annotation_model(node: ast.AST, bindings: frozenset[str] = frozenset()) -> bool:
    return any(
        (isinstance(descendant, ast.Attribute) and descendant.attr in _ANNOTATION_MODELS)
        or (isinstance(descendant, ast.Name) and descendant.id in bindings)
        for descendant in ast.walk(node)
    )


def _annotation_model_bindings(tree: ast.AST) -> frozenset[str]:
    bindings: set[str] = set()
    changed = True
    while changed:
        changed = False
        for node in ast.walk(tree):
            if not isinstance(node, (ast.Assign, ast.AnnAssign)) or node.value is None:
                continue
            if not _references_annotation_model(node.value, frozenset(bindings)):
                continue
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for target in targets:
                if isinstance(target, ast.Name) and target.id not in bindings:
                    bindings.add(target.id)
                    changed = True
    return frozenset(bindings)


def _direct_core_annotation_write_lines(tree: ast.AST) -> list[int]:
    bindings = _annotation_model_bindings(tree)
    violations: list[int] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function_name = (
            node.func.id
            if isinstance(node.func, ast.Name)
            else node.func.attr
            if isinstance(node.func, ast.Attribute)
            else ""
        )
        if function_name in {"insert", "insert_on_conflict"} and _references_annotation_model(
            node, bindings
        ):
            violations.append(node.lineno)
    return violations


def _annotation_named(node: ast.AST) -> bool:
    return any(
        isinstance(descendant, ast.Name)
        and ("annotation" in descendant.id or descendant.id == "anno")
        for descendant in ast.walk(node)
    )


def test_annotation_writes_use_the_shared_persistence_seam() -> None:
    violations: list[str] = []
    for path in _SOURCE_ROOT.rglob("*.py"):
        relative_path = path.relative_to(_SOURCE_ROOT)
        if relative_path == _SHARED_MODULE:
            continue
        source = path.read_text()
        tree = ast.parse(source)
        if relative_path not in _SANCTIONED_CORE_WRITERS:
            violations.extend(
                f"{relative_path}:{line}: direct Core annotation write"
                for line in _direct_core_annotation_write_lines(tree)
            )
        file_mentions_annotation_model = any(
            f"models.{model}" in source for model in _ANNOTATION_MODELS
        )
        mutates_annotation = False
        for node in ast.walk(tree):
            if isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if any(
                    isinstance(target, ast.Attribute)
                    and target.attr in _ANNOTATION_FIELDS
                    and _annotation_named(target.value)
                    for target in targets
                ):
                    mutates_annotation = True
            if not isinstance(node, ast.Call):
                continue
            function_name = (
                node.func.id
                if isinstance(node.func, ast.Name)
                else node.func.attr
                if isinstance(node.func, ast.Attribute)
                else ""
            )
            if (
                function_name in {"add", "add_all"}
                and file_mentions_annotation_model
                and _annotation_named(node)
            ):
                violations.append(f"{relative_path}:{node.lineno}: direct ORM annotation write")
        if (
            file_mentions_annotation_model
            and mutates_annotation
            and "update_annotations" not in source
        ):
            violations.append(f"{relative_path}: ORM annotation update without shared persistence")

    assert violations == []


def test_locally_bound_annotation_model_is_still_a_direct_core_write() -> None:
    tree = ast.parse(
        "from phoenix.db import models\n"
        "annotation_table = models.SpanAnnotation\n"
        "insert_on_conflict(table=annotation_table)\n"
    )

    assert _direct_core_annotation_write_lines(tree) == [3]

