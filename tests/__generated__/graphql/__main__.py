import ast
from pathlib import Path


class ConvertDataClassToTypedDict(ast.NodeTransformer):
    def __init__(
        self,
        aliases: dict[str, ast.AST],
        literals: dict[str, ast.Subscript],
    ) -> None:
        self._literals = literals
        self._aliases = aliases

    def visit_ImportFrom(self, node: ast.ImportFrom) -> ast.ImportFrom:
        if node.module == "typing":
            names = [a for a in node.names if a.name != "TypeAlias"]
            if "Any" not in [a.name for a in names]:
                names.append(ast.alias(name="Any", asname=None))
            return ast.ImportFrom(
                module=node.module,
                names=names,
                level=node.level,
            )
        return node

    def visit_ClassDef(self, node: ast.ClassDef) -> ast.ClassDef:
        body = []
        for b in node.body:
            if not isinstance(b, (ast.Assign, ast.AnnAssign)):
                continue
            if (
                isinstance(b, ast.AnnAssign)
                and isinstance(b.target, ast.Name)
                and (
                    b.target.id == "typename__"
                    or (
                        b.target.id == "query"
                        and isinstance(b.annotation, ast.Name)
                        and b.annotation.id == "Query"
                    )
                )
            ):
                continue
            body.append(self.visit(b))
        return ast.ClassDef(
            name=node.name,
            bases=node.bases,
            keywords=node.keywords,
            body=body,
            decorator_list=[],
        )

    def visit_Name(self, node: ast.Name) -> ast.AST:
        # Handle the specific case of UMAPPoints_aliased forward reference bug
        if node.id == "UMAPPoints_aliased":
            return ast.Name(id="UMAPPoints", ctx=node.ctx)
        if node.id in self._aliases:
            return self._aliases[node.id]
        if node.id in self._literals:
            return self._literals[node.id]
        return node

    def visit_Call(self, node: ast.Call) -> ast.Call:
        if isinstance(node.func, ast.Name) and node.func.id == "Field":
            keywords = [
                kw
                for kw in node.keywords
                if isinstance(kw, ast.keyword) and kw.arg != "description"
            ]
            return ast.Call(func=node.func, args=node.args, keywords=keywords)

        return node


if __name__ == "__main__":
    file_path = Path(__file__).parent / "__init__.py"
    with open(file_path, "r") as file:
        code = file.read()
    parsed = ast.parse(code)
    aliases: dict[str, ast.AST] = {}
    literals: dict[str, ast.Subscript] = {}
    body = []
    for i, node in enumerate(parsed.body):
        if (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Constant)
            and isinstance(node.value.value, str)
        ):
            continue
        if isinstance(node, ast.ImportFrom) and node.module == "enum":
            continue
        if isinstance(node, ast.ClassDef) and "Enum" in [
            b.id for b in node.bases if isinstance(b, ast.Name)
        ]:
            elts: list[ast.expr] = [
                x.value
                for x in node.body
                if isinstance(x, ast.Assign) and isinstance(x.value, ast.Constant)
            ]
            literals[node.name] = ast.Subscript(
                value=ast.Name(id="Literal", ctx=ast.Load()),
                slice=ast.Tuple(elts=elts, ctx=ast.Load()),
                ctx=ast.Load(),
            )
            continue
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value:
            aliases[node.target.id] = node.value
            continue
        body.append(node)
    parsed.body = body
    if "JSON" in aliases:
        aliases["JSON"] = ast.Subscript(
            value=ast.Name(id="dict", ctx=ast.Load()),
            slice=ast.Tuple(
                elts=[
                    ast.Name(id="str", ctx=ast.Load()),
                    ast.Name(id="Any", ctx=ast.Load()),
                ],
                ctx=ast.Load(),
            ),
            ctx=ast.Load(),
        )
    transformed = ConvertDataClassToTypedDict(
        aliases=aliases,
        literals=literals,
    ).visit(parsed)
    unparsed = ast.unparse(transformed)
    with open(file_path, "w") as file:
        file.write('"""Do not edit"""\n\n')
        file.write(unparsed)
