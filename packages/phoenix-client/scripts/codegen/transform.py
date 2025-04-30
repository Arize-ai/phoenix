import ast
import sys
from pathlib import Path
from typing import Callable, Literal, Mapping, Sequence


# =============================================================================
# AST Transformer to convert dataclass definitions to TypedDict definitions.
# =============================================================================
class ConvertDataClassToTypedDict(ast.NodeTransformer):
    def visit_ImportFrom(self, node: ast.ImportFrom) -> ast.AST:
        """
        Replace the dataclasses import with a TypedDict import from typing.
        """
        if node.module == "dataclasses":
            return ast.ImportFrom(
                module="typing",
                names=[ast.alias(name="TypedDict", asname=None)],
                level=0,
            )
        return node

    def visit_ClassDef(self, node: ast.ClassDef) -> ast.AST:
        """
        Convert a class definition into a TypedDict definition.
        Also reorders the "type" field (if present) to the top for readability.
        """
        # Visit and transform all statements in the class body.
        new_body = [self.visit(child) for child in node.body]

        # Look for a field named "type" defined as a Literal and move it to the front.
        for index, stmt in enumerate(new_body):
            if (
                isinstance(stmt, ast.AnnAssign)
                and isinstance(stmt.target, ast.Name)
                and stmt.target.id == "type"
                and isinstance(stmt.annotation, ast.Subscript)
                and isinstance(stmt.annotation.value, ast.Name)
                and stmt.annotation.value.id == "Literal"
                and isinstance(stmt.annotation.slice, ast.Constant)
            ):
                new_body = [new_body[index]] + new_body[:index] + new_body[index + 1 :]
                break

        # Redefine the class so that it inherits from TypedDict.
        return ast.ClassDef(
            name=node.name,
            bases=[ast.Name(id="TypedDict", ctx=ast.Load())],
            keywords=node.keywords,
            body=new_body,
            decorator_list=[],
        )

    def visit_AnnAssign(self, node: ast.AnnAssign) -> ast.AST:
        """
        Process annotated assignments:
          - Rename fields ending with "_" (like schema_ or json_) by stripping the underscore.
          - Convert default values on fields (when present) to a NotRequired[...] annotation.
          - Change `type: str = "xyz"` into `type: Literal["xyz"]`.
          - If a field is Optional[...] with a default value, remove the Optional.
        """
        # Rename fields ending with "_" to remove the trailing underscore.
        if isinstance(node.target, ast.Name) and node.target.id in ("schema_", "json_"):
            new_target = ast.Name(id=node.target.id.rstrip("_"), ctx=ast.Store())
            node = ast.AnnAssign(
                target=new_target,
                annotation=node.annotation,
                value=node.value,
                simple=node.simple,
            )

        # If there is a default value, perform further transformations.
        if isinstance(node.value, ast.Constant):
            # Convert `type: str = "xyz"` into `type: Literal["xyz"]`
            if (
                isinstance(node.target, ast.Name)
                and node.target.id == "type"
                and isinstance(node.annotation, ast.Name)
                and node.annotation.id == "str"
            ):
                return ast.AnnAssign(
                    target=node.target,
                    annotation=ast.Subscript(
                        value=ast.Name(id="Literal", ctx=ast.Load()),
                        slice=node.value,
                        ctx=ast.Load(),
                    ),
                    value=None,  # Remove default value
                    simple=node.simple,
                )
            # Convert an Optional annotation (with a default) to the inner type.
            if (
                isinstance(node.annotation, ast.Subscript)
                and isinstance(node.annotation.value, ast.Name)
                and node.annotation.value.id == "Optional"
            ):
                node = ast.AnnAssign(
                    target=node.target,
                    annotation=node.annotation.slice,
                    value=node.value,
                    simple=node.simple,
                )
            # Remove the default value and wrap the annotation in NotRequired.
            return ast.AnnAssign(
                target=node.target,
                annotation=ast.Subscript(
                    value=ast.Name(id="NotRequired", ctx=ast.Load()),
                    slice=node.annotation,
                    ctx=ast.Load(),
                ),
                value=None,  # Default value is removed
                simple=node.simple,
            )
        return node


def transform_dataclass(code: str) -> ast.AST:
    """
    Parse the provided code, insert an import for NotRequired, and transform
    dataclass definitions into TypedDict definitions.

    Args:
        code: A string of Python source code.

    Returns:
        The transformed AST.
    """
    parsed_ast: ast.Module = ast.parse(code)
    # Insert the import for NotRequired from typing_extensions before the first class.
    for index, node in enumerate(parsed_ast.body):
        if isinstance(node, ast.ClassDef):
            import_notrequired = ast.ImportFrom(
                module="typing_extensions",
                names=[ast.alias(name="NotRequired", asname=None)],
                level=0,
            )
            parsed_ast.body.insert(index, import_notrequired)
            break

    # Remove top-level Union type definitions
    parsed_ast.body = [
        node
        for node in parsed_ast.body
        if not (
            isinstance(node, ast.Assign)
            and isinstance(node.value, ast.Subscript)
            and isinstance(node.value.value, ast.Name)
            and node.value.value.id == "Union"
        )
    ]

    transformer = ConvertDataClassToTypedDict()
    transformed_ast = transformer.visit(parsed_ast)
    return transformed_ast


# =============================================================================
# Functions to adjust class definitions by removing inherited fields.
# =============================================================================

# Mapping from a class name to a list of its parent class names.
PARENTS: Mapping[str, Sequence[str]] = {
    "Prompt": ["PromptData"],
    "PromptVersion": ["PromptVersionData"],
    "SpanAnnotation": ["SpanAnnotationData"],
}


def get_ancestor_fields(
    class_name: str,
    class_nodes: Mapping[str, ast.ClassDef],
    parent_map: Mapping[str, Sequence[str]] = PARENTS,
) -> set[str]:
    """
    Recursively collects the field names defined in all ancestor classes.

    Args:
        class_name: The name of the class to inspect.
        class_nodes: Mapping of class names to their AST ClassDef nodes.
        parent_map: Mapping from a class name to a list of its parent class names.

    Returns:
        A set of field names from all ancestors.
    """
    if class_name not in parent_map:
        return set()

    fields: set[str] = set()
    for parent_name in parent_map[class_name]:
        parent_node: ast.ClassDef = class_nodes[parent_name]
        for stmt in parent_node.body:
            if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                fields.add(stmt.target.id)
        # Recursively add fields from higher ancestors.
        fields |= get_ancestor_fields(parent_name, class_nodes, parent_map)
    return fields


def remove_inherited_fields(
    class_nodes: Mapping[str, ast.ClassDef],
    parent_map: Mapping[str, Sequence[str]] = PARENTS,
) -> Mapping[str, ast.ClassDef]:
    """
    For each class that inherits from others, remove any field that is already
    defined in its ancestors to improve readability.

    Args:
        class_nodes: Mapping from class name to its AST ClassDef node.
        parent_map: Mapping from class name to a list of its parent class names.

    Returns:
        A new mapping from class name to a modified AST ClassDef node.
    """
    new_class_nodes: dict[str, ast.ClassDef] = {}
    for class_name, node in class_nodes.items():
        # If the class has no parents, leave it as-is.
        if class_name not in parent_map:
            new_class_nodes[class_name] = node
            continue

        # Create explicit bases for the class from its parent names.
        bases: list[ast.expr] = [
            ast.Name(id=parent, ctx=ast.Load()) for parent in parent_map[class_name]
        ]

        # Collect the field names defined in the class.
        child_field_names: set[str] = {
            stmt.target.id
            for stmt in node.body
            if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name)
        }
        # Ensure every statement in the body is an AnnAssign.
        assert len(child_field_names) == len(node.body), "Every field must be an AnnAssign"

        # Collect all ancestor field names.
        ancestor_field_names: set[str] = get_ancestor_fields(class_name, class_nodes, parent_map)
        assert (
            ancestor_field_names < child_field_names
        ), "Ancestor fields must be a subset of child fields"

        # Remove any inherited field from the class body.
        inherited_fields: set[str] = ancestor_field_names.intersection(child_field_names)
        new_body: list[ast.stmt] = [
            stmt
            for stmt in node.body
            if not (
                isinstance(stmt, ast.AnnAssign)
                and isinstance(stmt.target, ast.Name)
                and stmt.target.id in inherited_fields
            )
        ]
        new_class_nodes[class_name] = ast.ClassDef(
            name=node.name,
            bases=bases,
            keywords=node.keywords,
            body=new_body,
            decorator_list=node.decorator_list,
        )
    return new_class_nodes


def topologically_sort_classes(
    class_nodes: Mapping[str, ast.ClassDef],
    parent_map: Mapping[str, Sequence[str]] = PARENTS,
) -> list[ast.ClassDef]:
    """
    Sort class definitions so that each parent class appears before its children.

    Args:
        class_nodes: Mapping from class name to its AST ClassDef node.
        parent_map: Mapping from class name to a list of its parent class names.

    Returns:
        A list of AST ClassDef nodes in topological order.

    Raises:
        ValueError: If a cycle is detected in the inheritance hierarchy.
    """
    sorted_classes: list[ast.ClassDef] = []
    visit_state: dict[str, Literal["visiting", "visited"]] = {}

    def visit(node: ast.ClassDef) -> None:
        class_name: str = node.name
        if class_name in visit_state:
            if visit_state[class_name] == "visiting":
                raise ValueError(f"Cycle detected at class: {class_name}")
            return  # Already visited

        visit_state[class_name] = "visiting"
        for parent_name in parent_map.get(class_name, []):
            visit(class_nodes[parent_name])
        visit_state[class_name] = "visited"
        sorted_classes.append(node)

    for node in class_nodes.values():
        visit(node)
    return sorted_classes


# =============================================================================
# File rewriting logic.
# =============================================================================
def rewrite_file(
    directory: Path,
    input_filename: str,
    output_filename: str,
    transform: Callable[[str], ast.AST],
) -> None:
    """
    Reads a Python file, applies the AST transformation and class adjustments,
    then writes the updated code to an output file.

    Args:
        directory: The directory containing the input file.
        input_filename: The name of the input file.
        output_filename: The name of the output file.
        transform: A function that converts a code string to an AST.
    """
    file_path: Path = directory / input_filename
    with open(file_path, "r") as file:
        code: str = file.read()

    transformed_ast: ast.AST = transform(code)
    assert isinstance(transformed_ast, ast.Module), "The transformed AST must be a module."

    # Extract all class definitions from the AST.
    class_nodes: dict[str, ast.ClassDef] = {
        node.name: node for node in transformed_ast.body if isinstance(node, ast.ClassDef)
    }

    # Remove inherited fields from subclasses.
    cleaned_classes: Mapping[str, ast.ClassDef] = remove_inherited_fields(class_nodes)
    # Topologically sort classes so that parent classes come first.
    sorted_classes: list[ast.ClassDef] = topologically_sort_classes(cleaned_classes)

    # Preserve non-class statements and then append the sorted class definitions.
    non_class_statements: list[ast.stmt] = [
        stmt for stmt in transformed_ast.body if not isinstance(stmt, ast.ClassDef)
    ]
    new_body: list[ast.stmt] = non_class_statements + sorted_classes

    new_module: ast.Module = ast.Module(body=new_body, type_ignores=[])
    new_module = ast.fix_missing_locations(new_module)

    output_code: str = ast.unparse(new_module)
    with open(directory / output_filename, "w") as file:
        file.write('"""Do not edit"""\n\n')
        file.write(output_code)


# =============================================================================
# Main entry point.
# =============================================================================
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python transform.py <directory>")
        sys.exit(1)
    directory: Path = Path(sys.argv[1])
    rewrite_file(
        directory,
        ".dataclass.py",
        "__init__.py",
        transform_dataclass,
    )
