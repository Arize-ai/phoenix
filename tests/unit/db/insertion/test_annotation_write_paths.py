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


def _references_annotation_model(node: ast.AST) -> bool:
    return any(
        isinstance(descendant, ast.Attribute) and descendant.attr in _ANNOTATION_MODELS
        for descendant in ast.walk(node)
    )


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
            if function_name in {"insert", "insert_on_conflict"} and _references_annotation_model(
                node
            ):
                violations.append(f"{relative_path}:{node.lineno}: direct Core annotation write")
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

