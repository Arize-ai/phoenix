import ast
import sys


class ConvertDataClassToTypedDict(ast.NodeTransformer):
    def visit_ImportFrom(self, node: ast.ImportFrom) -> ast.ImportFrom:
        if node.module == "dataclasses":
            # Replace `from dataclasses import dataclass` with
            # `from typing import TypedDict`
            return ast.ImportFrom(
                module="typing",
                names=[ast.alias(name="TypedDict", asname=None)],
                level=0,
            )
        return node

    def visit_ClassDef(self, node: ast.ClassDef) -> ast.ClassDef:
        # Redefine all classes as TypedDict
        return ast.ClassDef(
            name=node.name,
            bases=[ast.Name(id="TypedDict", ctx=ast.Load())],
            keywords=node.keywords,
            body=[self.visit(child) for child in node.body],
            decorator_list=[],
        )

    def visit_AnnAssign(self, node: ast.AnnAssign) -> ast.AnnAssign:
        if isinstance(node.target, ast.Name) and node.target.id in ("schema_", "json_"):
            # Convert `schema_: xyz` to `schema: xyz`
            target = ast.Name(id=node.target.id.rstrip("_"), ctx=ast.Store())
            node = ast.AnnAssign(
                target=target,
                annotation=node.annotation,
                value=node.value,
                simple=node.simple,
            )
        if isinstance(node.value, ast.Constant):
            if (
                isinstance(node.target, ast.Name)
                and node.target.id == "type"
                and isinstance(node.annotation, ast.Name)
                and node.annotation.id == "str"
            ):
                # Convert `type: str = "xyz"` to `type: Literal["xyz"]`
                return ast.AnnAssign(
                    target=node.target,
                    annotation=ast.Subscript(
                        value=ast.Name(id="Literal", ctx=ast.Load()),
                        slice=node.value,
                        ctx=ast.Load(),
                    ),
                    simple=node.simple,
                )
            if (
                isinstance(node.annotation, ast.Subscript)
                and isinstance(node.annotation.value, ast.Name)
                and node.annotation.value.id == "Optional"
            ):
                # Convert `abc: Optional[xyz]` to `abc: xyz`
                node = ast.AnnAssign(
                    target=node.target,
                    annotation=node.annotation.slice,
                    value=node.value,
                    simple=node.simple,
                )
            # Remove default value, e.g.
            # convert `abc: xyz = 123` to `abc: NotRequired[xyz]`
            return ast.AnnAssign(
                target=node.target,
                annotation=ast.Subscript(
                    value=ast.Name(id="NotRequired", ctx=ast.Load()),
                    slice=node.annotation,
                    ctx=ast.Load(),
                ),
                simple=node.simple,
            )
        return node


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python transform.py <file_path>")
        sys.exit(1)
    file_path = sys.argv[1]
    with open(file_path, "r") as file:
        code = file.read()
    parsed = ast.parse(code)
    for i, node in enumerate(parsed.body):
        if isinstance(node, ast.ClassDef):
            parsed.body = (
                parsed.body[:i]
                + [
                    # Add `from typing_extensions import NotRequired`
                    ast.ImportFrom(
                        module="typing_extensions",
                        names=[ast.alias(name="NotRequired")],
                        level=0,
                    )
                ]
                + parsed.body[i:]
            )
            break
    transformed = ConvertDataClassToTypedDict().visit(parsed)
    unparsed = ast.unparse(transformed)
    with open(file_path, "w") as file:
        file.write("# pyright: reportUnusedImport=false\n")
        file.write('"""Do not edit"""\n\n')
        file.write(unparsed)
