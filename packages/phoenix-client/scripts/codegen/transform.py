import ast


class SwapListAnnotated(ast.NodeTransformer):
    """
    Converts Annotated[list[...], Field(...)] to list[Annotated[..., Field(...)]]
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
            and node.annotation.slice.elts[0].value.id == "list"
        ):
            return ast.AnnAssign(
                target=node.target,
                annotation=ast.Subscript(
                    value=ast.Name(id="list"),
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
    file_path = "v1/__init__.py"
    with open(file_path, "r") as file:
        code = file.read()
    parsed = ast.parse(code)
    transformed = SwapListAnnotated().visit(parsed)
    unparsed = ast.unparse(transformed)
    with open(file_path, "w") as file:
        file.write('"""Do not edit"""\n\n')
        file.write(unparsed)
