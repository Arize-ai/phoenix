"""Phoenix tokens are encoded and decoded only in JwtStore."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[3]
_SOURCE = _ROOT / "src" / "phoenix"
_JWT_STORE = Path("src/phoenix/server/jwt_store.py")
_ENCODE_DECODE = frozenset({"encode", "decode"})


class _JoseJwtVisitor(ast.NodeVisitor):
    """Records imports of ``joserfc.jwt`` and calls to its encode/decode."""

    def __init__(self) -> None:
        self.hits: list[tuple[int, str]] = []
        self._modules: set[str] = set()
        self._functions: dict[str, str] = {}
        self._packages: set[str] = set()

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.name == "joserfc.jwt" or alias.name.startswith("joserfc.jwt."):
                self.hits.append((node.lineno, f"imports {alias.name}"))
                self._modules.add(alias.asname or alias.name)
            elif alias.name == "joserfc":
                self._packages.add(alias.asname or alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        module = node.module or ""
        if module == "joserfc.jwt" or module.startswith("joserfc.jwt."):
            self.hits.append((node.lineno, f"imports from {module}"))
            for alias in node.names:
                if alias.name in _ENCODE_DECODE:
                    self._functions[alias.asname or alias.name] = alias.name
                elif alias.name == "*":
                    self._functions.update({name: name for name in _ENCODE_DECODE})
        elif module == "joserfc":
            for alias in node.names:
                if alias.name == "jwt":
                    self.hits.append((node.lineno, "imports joserfc.jwt"))
                    self._modules.add(alias.asname or alias.name)
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if (
            node.attr == "jwt"
            and isinstance(node.value, ast.Name)
            and node.value.id in self._packages
        ):
            self.hits.append((node.lineno, f"accesses {node.value.id}.jwt"))
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        called = _called_encode_or_decode(func, self._modules, self._functions, self._packages)
        if called is not None:
            self.hits.append((node.lineno, f"calls jwt.{called}"))
        self.generic_visit(node)


def _called_encode_or_decode(
    func: ast.expr,
    modules: set[str],
    functions: dict[str, str],
    packages: set[str],
) -> str | None:
    if isinstance(func, ast.Name):
        return functions.get(func.id)
    if not isinstance(func, ast.Attribute) or func.attr not in _ENCODE_DECODE:
        return None
    value = func.value
    if isinstance(value, ast.Name) and value.id in modules:
        return func.attr
    if (
        isinstance(value, ast.Attribute)
        and value.attr == "jwt"
        and isinstance(value.value, ast.Name)
        and value.value.id in packages
    ):
        return func.attr
    return None


def _scan_source(source: str) -> list[tuple[int, str]]:
    visitor = _JoseJwtVisitor()
    visitor.visit(ast.parse(source))
    return visitor.hits


def _scan() -> dict[Path, list[tuple[int, str]]]:
    found: dict[Path, list[tuple[int, str]]] = {}
    for path in sorted(_SOURCE.rglob("*.py")):
        hits = _scan_source(path.read_text(encoding="utf-8"))
        if hits:
            found[path.relative_to(_ROOT)] = hits
    return found


def test_phoenix_tokens_are_encoded_and_decoded_only_in_jwt_store() -> None:
    found = _scan()
    assert found.get(_JWT_STORE), "scanner failed to notice JwtStore's joserfc.jwt usage"
    others = {path: hits for path, hits in found.items() if path != _JWT_STORE}
    details = [
        f"{path}:{lineno}: {reason}" for path, hits in others.items() for lineno, reason in hits
    ]
    assert not details, (
        "Phoenix tokens must be encoded and decoded through JwtStore, "
        "which applies the stored-hash check:\n" + "\n".join(details)
    )


@pytest.mark.parametrize(
    "source",
    [
        pytest.param("import joserfc.jwt\njoserfc.jwt.decode(token, key)\n", id="direct_import"),
        pytest.param("from joserfc.jwt import decode\n", id="from_joserfc_jwt"),
        pytest.param("from joserfc import jwt as x\nx.decode(token, key)\n", id="jwt_alias"),
        pytest.param(
            "import joserfc as jose\njose.jwt.decode(token, key)\n",
            id="package_alias_call",
        ),
        pytest.param(
            "import joserfc as jose\ndecode = jose.jwt.decode\n",
            id="assigned_attribute",
        ),
    ],
)
def test_scanner_detects_joserfc_jwt_use(source: str) -> None:
    assert _scan_source(source)


def test_scanner_ignores_an_unrelated_jwt_name() -> None:
    assert _scan_source("import jwt\njwt.decode(token, key)\n") == []
