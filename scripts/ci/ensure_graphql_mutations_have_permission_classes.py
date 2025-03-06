#!/usr/bin/env python3
"""
Strawberry Mutation Permission Checker

This script checks Python files for Strawberry GraphQL mutations that are missing
permission_classes with IsNotReadOnly. It helps enforce security practices by ensuring
all mutations have proper permission checks.

Usage:
    python ensure_graphql_mutations_have_permission_classes.py [directory]
"""

import argparse
import ast
import sys
from pathlib import Path
from typing import List, Tuple, Union

# Define a type alias for a violation record (file path, line number, function name)
Violation = Tuple[Path, int, str]


class StrawberryMutationVisitor(ast.NodeVisitor):
    """
    AST visitor that finds Strawberry mutations without proper permission classes.
    """

    def __init__(self, current_file: Path) -> None:
        """
        Initialize the visitor with the current file being processed.

        Args:
            current_file: Path to the file being analyzed.
        """
        super().__init__()
        self.violations: List[Violation] = []
        self.current_file: Path = current_file
        self.mutations_found: int = 0  # Track total number of mutations found

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """
        Visit asynchronous function definitions to check their decorators.

        Args:
            node: The AsyncFunctionDef node being visited.
        """
        self._check_function_decorators(node)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """
        Visit synchronous function definitions to check their decorators.

        Args:
            node: The FunctionDef node being visited.
        """
        self._check_function_decorators(node)
        self.generic_visit(node)

    def _check_function_decorators(
        self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef]
    ) -> None:
        """
        Check if a function has a strawberry.mutation decorator without permission_classes.

        Args:
            node: The function definition node to check.
        """
        for decorator in node.decorator_list:
            if self._is_strawberry_mutation(decorator):
                self.mutations_found += 1  # Increment counter for each mutation found
                if not self._has_permission_classes(decorator):
                    self.violations.append((self.current_file, node.lineno, node.name))

    def _is_strawberry_mutation(self, decorator: ast.expr) -> bool:
        """
        Determine if the decorator represents a strawberry.mutation.

        Supports different styles:
            - strawberry.mutation()
            - mutation() (when imported directly)
            - strawberry.mutation
            - mutation

        Args:
            decorator: The decorator AST node to check.

        Returns:
            True if the decorator is recognized as strawberry.mutation; otherwise False.
        """
        # Case 1: strawberry.mutation() call
        if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
            if (
                isinstance(decorator.func.value, ast.Name)
                and decorator.func.value.id == "strawberry"
                and decorator.func.attr == "mutation"
            ):
                return True

        # Case 2: mutation() call (imported directly)
        if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name):
            if decorator.func.id == "mutation":
                return True

        # Case 3: strawberry.mutation attribute
        if isinstance(decorator, ast.Attribute):
            if (
                isinstance(decorator.value, ast.Name)
                and decorator.value.id == "strawberry"
                and decorator.attr == "mutation"
            ):
                return True

        # Case 4: mutation attribute (imported directly)
        if isinstance(decorator, ast.Name):
            if decorator.id == "mutation":
                return True

        return False

    def _has_permission_classes(self, decorator: ast.expr) -> bool:
        """
        Check if the decorator includes permission_classes with IsNotReadOnly.

        Args:
            decorator: The decorator AST node to check.

        Returns:
            True if permission_classes is set with IsNotReadOnly; otherwise False.
        """
        if not isinstance(decorator, ast.Call):
            return False

        for keyword in decorator.keywords:
            if keyword.arg == "permission_classes":
                if isinstance(keyword.value, ast.List):
                    for elt in keyword.value.elts:
                        if isinstance(elt, ast.Name) and elt.id == "IsNotReadOnly":
                            return True
        return False


def check_files(directory: Path) -> Tuple[List[Violation], int]:
    """
    Recursively check all Python files in the specified directory for violations.

    Args:
        directory: The directory to search for Python files.

    Returns:
        A tuple containing:
            - A list of violations as tuples: (file_path, line_number, function_name)
            - Total number of mutations found across all files
    """
    violations: List[Violation] = []
    total_mutations_found: int = 0
    files_checked: int = 0

    for py_file in directory.glob("**/*.py"):
        files_checked += 1
        print(f"Checking {py_file}")
        try:
            with py_file.open("r", encoding="utf-8") as f:
                file_contents: str = f.read()
            tree = ast.parse(file_contents, filename=str(py_file))
            visitor = StrawberryMutationVisitor(py_file)
            visitor.visit(tree)
            violations.extend(visitor.violations)
            total_mutations_found += visitor.mutations_found
        except SyntaxError:
            print(f"Syntax error in {py_file}, skipping", file=sys.stderr)
        except Exception as e:
            print(f"Error processing {py_file}: {e}", file=sys.stderr)

    print(f"Checked {files_checked} Python files")
    return violations, total_mutations_found


def format_violations(violations: List[Violation], total_mutations: int) -> None:
    """
    Print formatted violation messages.

    Args:
        violations: List of violations to print.
        total_mutations: Total number of mutations found.
    """
    if total_mutations == 0:
        print("No mutations found! This might indicate you're checking the wrong directory.")
        return

    if not violations:
        print(f"No violations found! All {total_mutations} mutations have permission_classes.")
        return

    print(f"\nFound {len(violations)} violation(s) out of {total_mutations} total mutations:")
    for file_path, line_number, func_name in violations:
        print(
            f"{file_path}:{line_number} - Missing permission_classes in @strawberry.mutation for "
            f"function '{func_name}'"
        )


def main() -> int:
    """
    Main entry point for the script.

    Returns:
        0 if no violations found and mutations exist,
        1 if violations found,
        2 for invalid directory,
        3 if no mutations found (likely wrong directory).
    """
    parser = argparse.ArgumentParser(
        description="Check for Strawberry mutations without permission_classes"
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="Directory to search for Python files (default: current directory)",
    )
    args = parser.parse_args()

    directory = Path(args.directory)
    if not directory.exists() or not directory.is_dir():
        print(f"Error: {directory} is not a valid directory", file=sys.stderr)
        return 2

    violations, total_mutations = check_files(directory)
    format_violations(violations, total_mutations)

    # Return appropriate exit code based on findings
    if total_mutations == 0:
        print(
            "ERROR: No mutations found in any files. Are you checking the correct directory?",
            file=sys.stderr,
        )
        return 3
    elif violations:
        return 1
    else:
        return 0


if __name__ == "__main__":
    sys.exit(main())
