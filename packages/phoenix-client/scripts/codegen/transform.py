import ast
import sys


class SwapSequenceAnnotated(ast.NodeTransformer):
    """
    Converts `Annotated[Sequence[...], Field(...)]` to `Sequence[Annotated[..., Field(...)]]`,
    because the former is invalid for a discriminated union, resulting in runtime error.
    """

    def visit_AnnAssign(self, node: ast.AnnAssign) -> ast.AnnAssign:
        if (
            isinstance(node.annotation, ast.Subscript)
            and isinstance(node.annotation.value, ast.Name)
            and node.annotation.value.id == "Annotated"
            and isinstance(node.annotation.slice, ast.Tuple)
            and node.annotation.slice.elts
            and isinstance(node.annotation.slice.elts[0], ast.Subscript)
            and isinstance(node.annotation.slice.elts[0].value, ast.Name)
            and node.annotation.slice.elts[0].value.id == "Sequence"
        ):
            return ast.AnnAssign(
                target=node.target,
                annotation=ast.Subscript(
                    value=ast.Name(id="Sequence"),
                    slice=ast.Subscript(
                        value=ast.Name(id="Annotated"),
                        slice=ast.Tuple(
                            elts=[
                                node.annotation.slice.elts[0].slice,
                                *node.annotation.slice.elts[1:],
                            ]
                        ),
                    ),
                ),
                value=node.value,
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
    transformed = SwapSequenceAnnotated().visit(parsed)
    unparsed = ast.unparse(transformed)
    with open(file_path, "w") as file:
        file.write('"""Do not edit"""\n\n')
        file.write(unparsed)
