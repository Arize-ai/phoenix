import ast
import sys
from pathlib import Path
from typing import Callable


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


class PydanticModels(ast.NodeTransformer):
    def visit_ClassDef(self, node: ast.ClassDef) -> ast.ClassDef:
        # Recursively transform all child nodes in the class body.
        new_body = [self.visit(child) for child in node.body]

        # Check if the class inherits from BaseModel.
        # We look at the bases of the class, filtering out those that are simple names.
        base_names = [base.id for base in node.bases if isinstance(base, ast.Name)]
        if "BaseModel" not in base_names:
            # This class is not a Pydantic model; return it unchanged.
            return node

        # Check if a model_config assignment already exists in the class body.
        has_model_config = any(
            isinstance(stmt, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "model_config"
                for target in stmt.targets
            )
            for stmt in new_body
        )

        if not has_model_config:
            # Create an assignment:
            # model_config = ConfigDict(strict=True, validate_assignment=True)
            model_config_assign = ast.Assign(
                targets=[ast.Name(id="model_config", ctx=ast.Store())],
                value=ast.Call(
                    func=ast.Name(id="ConfigDict", ctx=ast.Load()),
                    args=[],
                    keywords=[
                        ast.keyword(arg="strict", value=ast.Constant(value=True)),
                        ast.keyword(arg="validate_assignment", value=ast.Constant(value=True)),
                    ],
                ),
            )
            # Insert the new assignment at the beginning of the class body.
            new_body.insert(0, model_config_assign)

        # Return a new ClassDef node with the updated body.
        # We preserve the original bases, keywords, and decorators.
        return ast.ClassDef(
            name=node.name,
            bases=node.bases,
            keywords=node.keywords,
            body=new_body,
            decorator_list=node.decorator_list,
        )

    def visit_Call(self, node) -> ast.Call:
        if isinstance(node.func, ast.Name) and node.func.id == "ConfigDict":
            kwargs = {kw.arg: kw for kw in node.keywords}
            kwargs["extra"] = ast.keyword(arg="extra", value=ast.Constant(value="forbid"))
            kwargs["strict"] = ast.keyword(arg="strict", value=ast.Constant(value=True))
            kwargs["validate_assignment"] = ast.keyword(
                arg="validate_assignment", value=ast.Constant(value=True)
            )
            return ast.Call(
                func=node.func,
                args=node.args,
                keywords=list(kwargs.values()),
            )
        return node

    def visit_AnnAssign(self, node: ast.AnnAssign) -> ast.AST:
        """
        Transform annotated assignments that use a Sequence with a discriminator.

        Specifically, convert annotations of the form:

            Annotated[Sequence[T], Field(discriminator="type", ...)]

        into:

            Annotated[
                Sequence[Annotated[T, Field(discriminator="type")]],
                Field(... without discriminator ...)
            ]

        This transformation is needed to avoid runtime errors with discriminated unions in Pydantic.

        Note: T is usually a Union[...], but being one isn't required.
        """
        # Check that the annotation is an Annotated[...] type.
        if not (
            isinstance(node.annotation, ast.Subscript)
            and isinstance(node.annotation.value, ast.Name)
            and node.annotation.value.id == "Annotated"
        ):
            return node

        # Ensure the Annotated[...] has at least two parts.
        if not (
            isinstance(node.annotation.slice, ast.Tuple) and len(node.annotation.slice.elts) >= 2
        ):
            return node

        # Unpack the two parts: the type part and the Field part.
        annotated_parts = node.annotation.slice.elts
        seq_annotation = annotated_parts[0]  # Expecting Sequence[T]
        field_call = annotated_parts[1]  # Expecting Field(...)

        # Check that the type part is Sequence[T].
        if not (
            isinstance(seq_annotation, ast.Subscript)
            and isinstance(seq_annotation.value, ast.Name)
            and seq_annotation.value.id == "Sequence"
        ):
            return node

        # Check that the second part is a Field(...) call.
        if not (
            isinstance(field_call, ast.Call)
            and isinstance(field_call.func, ast.Name)
            and field_call.func.id == "Field"
        ):
            return node

        # Verify that the Field call includes a discriminator with the value "type".
        has_discriminator = any(
            kw.arg == "discriminator"
            and isinstance(kw.value, ast.Constant)
            and kw.value.value == "type"
            for kw in field_call.keywords
        )
        if not has_discriminator:
            return node

        # --- Begin transformation ---

        # Extract the inner type T from Sequence[T].
        inner_type = seq_annotation.slice

        # Create a Field call for the inner Annotated with only the discriminator.
        inner_field = ast.Call(
            func=ast.Name(id="Field"),
            args=[],
            keywords=[ast.keyword(arg="discriminator", value=ast.Constant(value="type"))],
        )

        # Build the inner Annotated[T, Field(discriminator="type")].
        inner_annotated = ast.Subscript(
            value=ast.Name(id="Annotated"),
            slice=ast.Tuple(elts=[inner_type, inner_field]),
        )

        # Wrap the inner Annotated in a Sequence, i.e. Sequence[Annotated[T, Field(...)]]
        new_seq_annotation = ast.Subscript(
            value=ast.Name(id="Sequence"),
            slice=ast.Tuple(elts=[inner_annotated]),
        )

        # Prepare a new outer Field by copying all keywords except the discriminator.
        outer_field_keywords = [kw for kw in field_call.keywords if kw.arg != "discriminator"]

        # If there are extra keywords, create an outer Field call.
        if outer_field_keywords:
            outer_field = ast.Call(
                func=ast.Name(id="Field"),
                args=[],
                keywords=outer_field_keywords,
            )
            # Combine the new Sequence and the outer Field in a new Annotated.
            new_annotation = ast.Subscript(
                value=ast.Name(id="Annotated"),
                slice=ast.Tuple(elts=[new_seq_annotation, outer_field]),
            )
        else:
            # Otherwise, just use the new Sequence annotation.
            new_annotation = new_seq_annotation

        # Return a new annotated assignment with the transformed annotation.
        return ast.AnnAssign(
            target=node.target,
            annotation=new_annotation,
            value=node.value,
            simple=node.simple,
        )


def _transform_pydantic(code: str) -> ast.AST:
    parsed = ast.parse(code)
    transformed = PydanticModels().visit(parsed)
    return transformed


def _transform_dataclass(
    code: str,
) -> ast.AST:
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
    return transformed


def _rewrite(
    path: Path,
    in_file: str,
    out_file: str,
    transform: Callable[[str], ast.AST],
) -> None:
    with open(path / in_file, "r") as f:
        code = f.read()
    transformed = ast.fix_missing_locations(transform(code))
    unparsed = ast.unparse(transformed)
    with open(path / out_file, "w") as f:
        f.write('"""Do not edit"""\n\n')
        f.write(unparsed)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python transform.py <dir>")
        sys.exit(1)
    path = Path(sys.argv[1])
    _rewrite(path, ".pydantic.txt", "models.py", _transform_pydantic)
    _rewrite(path, ".dataclass.txt", "__init__.py", _transform_dataclass)
