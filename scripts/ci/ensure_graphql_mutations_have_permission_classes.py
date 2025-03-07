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
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Literal, Set, Tuple, Union

# Define issue type
IssueType = Literal["no_permission_classes", "missing_is_not_read_only"]

# Define issue descriptions
ISSUE_DESCRIPTIONS: Dict[IssueType, str] = {
    "no_permission_classes": "Missing permission_classes keyword",
    "missing_is_not_read_only": "permission_classes exists but missing IsNotReadOnly",
}


@dataclass
class Issue:
    """
    Represents a permission issue found in a Strawberry GraphQL mutation.
    """

    file_path: Path
    line_number: int
    function_name: str
    issue_type: IssueType

    def __str__(self) -> str:
        """Return a string representation of the issue for easy reporting."""
        return f"{self.file_path}:{self.line_number} - function '{self.function_name}'"


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
        self.issues: List[Issue] = []
        self.current_file: Path = current_file
        self.mutations_found: int = 0  # Track total number of mutations found
        # Keep track of imported names to better detect strawberry mutations
        self.imported_names: Set[str] = set()

    def visit_Import(self, node: ast.Import) -> None:
        """Track imported modules."""
        for name in node.names:
            if name.name == "strawberry":
                self.imported_names.add("strawberry")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """Track imports from specific modules."""
        if node.module == "strawberry":
            for name in node.names:
                if name.name == "mutation":
                    self.imported_names.add("mutation")
        self.generic_visit(node)

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
        Check if a function has a strawberry.mutation decorator without proper permission classes.

        Args:
            node: The function definition node to check.
        """
        for decorator in node.decorator_list:
            if self._is_strawberry_mutation(decorator):
                self.mutations_found += 1  # Increment counter for each mutation found

                has_permission_classes, has_is_not_read_only = self._check_permissions(decorator)

                if not has_permission_classes:
                    # Issue: No permission_classes keyword found
                    self.issues.append(
                        Issue(
                            file_path=self.current_file,
                            line_number=node.lineno,
                            function_name=node.name,
                            issue_type="no_permission_classes",
                        )
                    )
                elif not has_is_not_read_only:
                    # Issue: permission_classes exists but missing IsNotReadOnly
                    self.issues.append(
                        Issue(
                            file_path=self.current_file,
                            line_number=node.lineno,
                            function_name=node.name,
                            issue_type="missing_is_not_read_only",
                        )
                    )

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
            if decorator.func.id == "mutation" and "mutation" in self.imported_names:
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
            if decorator.id == "mutation" and "mutation" in self.imported_names:
                return True

        return False

    def _check_permissions(self, decorator: ast.expr) -> Tuple[bool, bool]:
        """
        Check if the decorator includes permission_classes and if it includes IsNotReadOnly.

        Args:
            decorator: The decorator AST node to check.

        Returns:
            A tuple with two booleans:
            - First boolean indicates if permission_classes is present
            - Second boolean indicates if IsNotReadOnly is found in permission_classes
        """
        # If not a call, we can't have permission_classes
        if not isinstance(decorator, ast.Call):
            return False, False

        has_permission_classes = False
        has_is_not_read_only = False

        for keyword in decorator.keywords:
            if keyword.arg == "permission_classes":
                has_permission_classes = True

                # Check for IsNotReadOnly in the list
                if isinstance(keyword.value, ast.List):
                    for elt in keyword.value.elts:
                        if isinstance(elt, ast.Name) and elt.id == "IsNotReadOnly":
                            has_is_not_read_only = True
                            break
                # Also support imported permissions from a module
                elif isinstance(keyword.value, ast.Attribute):
                    # Check for cases like permissions.IsNotReadOnly
                    if keyword.value.attr == "IsNotReadOnly":
                        has_is_not_read_only = True

        return has_permission_classes, has_is_not_read_only


def check_files(directory: Path) -> Tuple[List[Issue], int]:
    """
    Recursively check all Python files in the specified directory for issues.

    Args:
        directory: The directory to search for Python files.

    Returns:
        A tuple containing:
            - A list of issues
            - Total number of mutations found across all files
    """
    issues: List[Issue] = []
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
            issues.extend(visitor.issues)
            total_mutations_found += visitor.mutations_found
        except SyntaxError:
            print(f"Syntax error in {py_file}, skipping", file=sys.stderr)
        except Exception as e:
            print(f"Error processing {py_file}: {e}", file=sys.stderr)

    print(f"Checked {files_checked} Python files")
    return issues, total_mutations_found


def format_issues(issues: List[Issue], total_mutations: int) -> None:
    """
    Print formatted issue messages.

    Args:
        issues: List of issues to print.
        total_mutations: Total number of mutations found.
    """
    if total_mutations == 0:
        print("No mutations found! This might indicate you're checking the wrong directory.")
        return

    if not issues:
        print(f"No issues found! All {total_mutations} mutations have proper permission_classes.")
        return

    # Group issues by issue type
    by_issue_type: Dict[IssueType, List[Issue]] = {
        "no_permission_classes": [],
        "missing_is_not_read_only": [],
    }

    for issue in issues:
        by_issue_type[issue.issue_type].append(issue)

    print(f"\nFound {len(issues)} issue(s) out of {total_mutations} total mutations:")

    # Print each issue type separately
    for issue_type, type_issues in by_issue_type.items():
        if type_issues:
            print(f"\n{ISSUE_DESCRIPTIONS[issue_type]} ({len(type_issues)} occurrences):")
            for issue in type_issues:
                print(f"  - {issue}")


def main() -> int:
    """
    Main entry point for the script.

    Returns:
        0 if no issues found and mutations exist,
        1 if issues found,
        2 for invalid directory,
        3 if no mutations found (likely wrong directory).
    """
    parser = argparse.ArgumentParser(
        description="Check for Strawberry mutations without proper permission_classes"
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

    issues, total_mutations = check_files(directory)
    format_issues(issues, total_mutations)

    # Return appropriate exit code based on findings
    if total_mutations == 0:
        print(
            "ERROR: No mutations found in any files. Are you checking the correct directory?",
            file=sys.stderr,
        )
        return 3
    if issues:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
