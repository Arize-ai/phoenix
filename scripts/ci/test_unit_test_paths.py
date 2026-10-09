"""
Guard that unit tests only read files the Unit Tests CI jobs check out.

The Unit Tests jobs in ``python-CI.yml`` and ``python-all-platforms.yml`` use a cone-mode
sparse checkout, so a test that reaches into the repository by path (for example
``Path(__file__).parents[4] / ".github" / ...``) passes in a full local checkout and fails in
CI. This module:

- requires both workflows to check out the same paths for unit tests, and
- statically resolves every repository path built from ``__file__`` under ``tests/unit/``
  (``Path(__file__)``, ``.parent``, ``.parents[N]``, ``/ "literal"``, ``.with_name()``,
  ``.joinpath()``, ``os.path.dirname/join``, and names bound to such expressions) plus the
  ``{toxinidir}`` paths the ``unit_tests`` tox env installs, and requires each to be inside
  that checkout.

Run with ``make check-unit-test-paths``.
"""

import ast
import configparser
import re
from collections.abc import Iterator, Sequence
from pathlib import Path, PurePosixPath
from typing import Any, Optional

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
UNIT_TESTS_DIR = REPO_ROOT / "tests" / "unit"
UNIT_TEST_WORKFLOWS = (
    REPO_ROOT / ".github" / "workflows" / "python-CI.yml",
    REPO_ROOT / ".github" / "workflows" / "python-all-platforms.yml",
)
UNIT_TESTS_JOB = "unit-tests"
TOX_ENV = "testenv:unit_tests"


def _sparse_checkout(workflow: Path) -> frozenset[PurePosixPath]:
    jobs = yaml.safe_load(workflow.read_text())["jobs"]
    for step in jobs[UNIT_TESTS_JOB]["steps"]:
        if str(step.get("uses", "")).startswith("actions/checkout@"):
            entries = step.get("with", {}).get("sparse-checkout", "")
            return frozenset(PurePosixPath(line.strip()) for line in entries.split() if line)
    raise AssertionError(f"No checkout step in the {UNIT_TESTS_JOB} job of {workflow}")


def _is_checked_out(path: PurePosixPath, cone: frozenset[PurePosixPath]) -> bool:
    """
    Whether a cone-mode sparse checkout of ``cone`` materializes ``path``.

    Cone mode includes everything under each entry, plus the files directly inside each of
    an entry's ancestors (which is why root-level files such as ``pyproject.toml`` are always
    present). Ancestor directories themselves exist, so resolving one is fine.
    """
    for entry in cone:
        if path == entry or entry in path.parents:
            return True  # under the entry
        if path in entry.parents:
            return True  # an ancestor directory of the entry
        if path.parent in entry.parents:
            return True  # a file directly inside an ancestor of the entry
    return False


class _RepoPathResolver:
    """Resolves expressions that build a path from ``__file__`` to repo-relative paths."""

    def __init__(self, module_path: Path) -> None:
        self._file = PurePosixPath(module_path.relative_to(REPO_ROOT).as_posix())
        self._names: dict[str, PurePosixPath] = {}

    def bind(self, tree: ast.Module) -> None:
        # Bind module- and function-level names in source order; good enough for the
        # ``ROOT = Path(__file__).parents[N]`` / ``DATA = ROOT / "x"`` idiom.
        for node in ast.walk(tree):
            targets: Sequence[ast.expr] = ()
            if isinstance(node, ast.Assign):
                targets, value = node.targets, node.value
            elif isinstance(node, ast.AnnAssign) and node.value is not None:
                targets, value = [node.target], node.value
            else:
                continue
            resolved = self.resolve(value)
            if resolved is None:
                continue
            for target in targets:
                if isinstance(target, ast.Name):
                    self._names[target.id] = resolved

    def resolve(self, node: ast.AST) -> Optional[PurePosixPath]:
        if isinstance(node, ast.Name):
            if node.id == "__file__":
                return self._file
            return self._names.get(node.id)
        if isinstance(node, ast.Call):
            return self._resolve_call(node)
        if isinstance(node, ast.Attribute) and node.attr == "parent":
            base = self.resolve(node.value)
            return None if base is None else base.parent
        if (
            isinstance(node, ast.Subscript)
            and isinstance(node.value, ast.Attribute)
            and node.value.attr == "parents"
            and isinstance(node.slice, ast.Constant)
            and isinstance(node.slice.value, int)
        ):
            base = self.resolve(node.value.value)
            return None if base is None else _up(base, node.slice.value + 1)
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
            base = self.resolve(node.left)
            part = _literal(node.right)
            return None if base is None or part is None else _join(base, part)
        return None

    def _resolve_call(self, node: ast.Call) -> Optional[PurePosixPath]:
        func = node.func
        name = _dotted(func)
        args = node.args
        if name in {"Path", "pathlib.Path", "PurePath", "PurePosixPath"} and len(args) == 1:
            return self.resolve(args[0])
        if name in {"os.path.abspath", "os.path.realpath", "os.path.normpath"} and args:
            return self.resolve(args[0])
        if name == "os.path.dirname" and args:
            base = self.resolve(args[0])
            return None if base is None else base.parent
        if name == "os.path.join" and args:
            return self._join_literals(self.resolve(args[0]), args[1:])
        if isinstance(func, ast.Attribute):
            if func.attr in {"resolve", "absolute"} and not args:
                return self.resolve(func.value)
            if func.attr == "joinpath":
                return self._join_literals(self.resolve(func.value), args)
            if func.attr == "with_name" and len(args) == 1:
                base, part = self.resolve(func.value), _literal(args[0])
                return None if base is None or part is None else _join(base.parent, part)
        return None

    @staticmethod
    def _join_literals(
        base: Optional[PurePosixPath], parts: list[ast.expr]
    ) -> Optional[PurePosixPath]:
        for part in parts:
            literal = _literal(part)
            if base is None or literal is None:
                return None
            base = _join(base, literal)
        return base


def _dotted(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_dotted(node.value)}.{node.attr}"
    return ""


def _literal(node: ast.AST) -> Optional[str]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _up(path: PurePosixPath, levels: int) -> PurePosixPath:
    for _ in range(levels):
        if path == PurePosixPath("."):
            raise ValueError("path escapes the repository root")
        path = path.parent
    return path


def _join(base: PurePosixPath, part: str) -> PurePosixPath:
    # Normalize "..", which PurePosixPath keeps verbatim.
    path = base
    for segment in PurePosixPath(part).parts:
        path = _up(path, 1) if segment == ".." else path / segment
    return path


def _repo_paths_read_by_unit_tests() -> Iterator[tuple[str, PurePosixPath]]:
    for module_path in sorted(UNIT_TESTS_DIR.rglob("*.py")):
        tree = ast.parse(module_path.read_text(), filename=str(module_path))
        resolver = _RepoPathResolver(module_path)
        resolver.bind(tree)
        for node in ast.walk(tree):
            try:
                resolved = resolver.resolve(node)
            except ValueError:
                resolved = PurePosixPath("..")
            if resolved is not None:
                location = f"{module_path.relative_to(REPO_ROOT)}:{getattr(node, 'lineno', 0)}"
                yield location, resolved


def _tox_unit_tests_paths() -> Iterator[PurePosixPath]:
    tox = configparser.ConfigParser(interpolation=None)
    tox.read(REPO_ROOT / "tox.ini")
    section: Any = tox[TOX_ENV]
    for key in ("commands_pre", "commands"):
        for match in re.finditer(r"\{toxinidir\}(/[^\s]*)?", section.get(key, "")):
            yield (
                PurePosixPath(match.group(1).lstrip("/")) if match.group(1) else PurePosixPath(".")
            )


@pytest.fixture(scope="module")
def cone() -> frozenset[PurePosixPath]:
    return _sparse_checkout(UNIT_TEST_WORKFLOWS[0])


def test_unit_test_workflows_check_out_the_same_paths() -> None:
    cones = {workflow.name: _sparse_checkout(workflow) for workflow in UNIT_TEST_WORKFLOWS}
    first, *rest = cones.values()
    assert all(other == first for other in rest), (
        "The Unit Tests jobs check out different paths; keep their sparse-checkout lists in "
        f"sync: { ({name: sorted(map(str, paths)) for name, paths in cones.items()}) }"
    )


def test_unit_tests_only_read_checked_out_paths(cone: frozenset[PurePosixPath]) -> None:
    unreadable = {
        (location, path)
        for location, path in _repo_paths_read_by_unit_tests()
        if not _is_checked_out(path, cone)
    }
    # Report only the full path, not the intermediate directories built on the way to it.
    missing = sorted(
        f"{location} reads {path}"
        for location, path in unreadable
        if not any(loc == location and path in other.parents for loc, other in unreadable)
    )
    assert not missing, (
        "These unit tests read paths the Unit Tests CI sparse checkout leaves out, so they "
        "pass locally and fail in CI. Move what they need under a checked-out directory "
        "(or test it outside tests/unit/) rather than widening the checkout:\n  "
        + "\n  ".join(missing)
    )


def test_tox_unit_tests_env_only_installs_checked_out_paths(
    cone: frozenset[PurePosixPath],
) -> None:
    missing = sorted(
        str(path) for path in _tox_unit_tests_paths() if not _is_checked_out(path, cone)
    )
    assert not missing, f"tox's {TOX_ENV} env reads paths the sparse checkout omits: {missing}"


@pytest.mark.parametrize(
    "source, expected",
    [
        ('Path(__file__).resolve().parents[3] / ".github" / "x.py"', ".github/x.py"),
        ('Path(__file__).parent / "fixtures" / "a.json"', "tests/unit/pkg/fixtures/a.json"),
        ('Path(__file__).with_name("helper.py")', "tests/unit/pkg/helper.py"),
        ('ROOT = Path(__file__).parents[3]\nX = ROOT / "evals/pxi"', "evals/pxi"),
        ('os.path.join(os.path.dirname(__file__), "..", "data")', "tests/unit/data"),
        ('Path(module.__file__).parent / "x"', None),
    ],
)
def test_resolver(source: str, expected: Optional[str]) -> None:
    module_path = UNIT_TESTS_DIR / "pkg" / "test_mod.py"
    tree = ast.parse(source)
    resolver = _RepoPathResolver(module_path)
    resolver.bind(tree)
    last = tree.body[-1]
    assert isinstance(last, (ast.Expr, ast.Assign))
    resolved = resolver.resolve(last.value)
    assert (None if resolved is None else str(resolved)) == expected


@pytest.mark.parametrize(
    "path, expected",
    [
        ("src/phoenix/server/x.json", True),
        ("pyproject.toml", True),  # root files are always in a cone checkout
        ("tests/conftest.py", True),
        ("src/README.md", True),  # a file directly inside an ancestor of src/phoenix/
        ("src", True),
        (".", True),
        (".github/.scripts/sync_models.py", False),
        ("src/other/x.py", False),
        ("scripts/ci/x.py", False),
    ],
)
def test_is_checked_out(path: str, expected: bool) -> None:
    cone = frozenset({PurePosixPath("src/phoenix"), PurePosixPath("tests/unit")})
    assert _is_checked_out(PurePosixPath(path), cone) is expected
