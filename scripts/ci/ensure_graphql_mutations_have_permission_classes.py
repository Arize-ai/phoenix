# ruff: noqa: E501
"""
Strawberry Mutation and Subscription Permission Checker

This script checks Python files for Strawberry GraphQL mutations and subscriptions that are missing
permission_classes with IsNotReadOnly and IsNotViewer. It helps enforce security practices by ensuring
all mutations and subscriptions have proper permission checks.

Usage:
    python ensure_graphql_mutations_have_permission_classes.py [directory]
"""

from __future__ import annotations

import argparse
import ast
import sys
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, NamedTuple

# Define issue type
IssueType = Literal[
    "no_permission_classes",
    "missing_is_not_read_only",
    "missing_is_not_viewer",
]

# Define issue descriptions
ISSUE_DESCRIPTIONS: dict[IssueType, str] = {
    "no_permission_classes": "Missing permission_classes keyword",
    "missing_is_not_read_only": "permission_classes exists but missing IsNotReadOnly",
    "missing_is_not_viewer": "permission_classes exists but missing IsNotViewer",
}

# Mutations and subscriptions that are allowed to skip IsNotViewer check
# patch_viewer allows viewers to update their own profile
# create_user_api_key and delete_user_api_key allow viewers to manage their own API keys
SKIP_IS_NOT_VIEWER_CHECK = frozenset(
    {
        "patch_viewer",
        "create_user_api_key",
        "delete_user_api_key",
    }
)


class PermissionCheck(NamedTuple):
    """Result of checking permissions on a mutation or subscription decorator."""

    has_permission_classes: bool
    has_is_not_read_only: bool
    has_is_not_viewer: bool


@dataclass
class Issue:
    """
    Represents a permission issue found in a Strawberry GraphQL mutation or subscription.
    """

    file_path: Path
    line_number: int
    function_name: str
    issue_type: IssueType
    decorator_type: Literal["mutation", "subscription"]

    def __str__(self) -> str:
        """Return a string representation of the issue for easy reporting."""
        return f"{self.file_path}:{self.line_number} - {self.decorator_type} '{self.function_name}'"


class StrawberryMutationVisitor(ast.NodeVisitor):
    """
    AST visitor that finds Strawberry mutations and subscriptions without proper permission classes.
    """

    def __init__(self, current_file: Path) -> None:
        """
        Initialize the visitor with the current file being processed.

        Args:
            current_file: Path to the file being analyzed.
        """
        super().__init__()
        self.issues: list[Issue] = []
        self.current_file: Path = current_file
        self.mutations_found: int = 0
        self.subscriptions_found: int = 0
        # Keep track of imported names to better detect strawberry mutations and subscriptions
        self.imported_names: set[str] = set()

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
                if name.name in ("mutation", "subscription"):
                    self.imported_names.add(name.name)
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

    def _check_function_decorators(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        """
        Check if a function has a strawberry.mutation or strawberry.subscription decorator
        without proper permission classes.

        Args:
            node: The function definition node to check.
        """
        for decorator in node.decorator_list:
            decorator_type = self._get_strawberry_decorator_type(decorator)
            if not decorator_type:
                continue

            if decorator_type == "mutation":
                self.mutations_found += 1
            elif decorator_type == "subscription":
                self.subscriptions_found += 1

            permissions = self._check_permissions(decorator)
            issue_type = self._determine_issue_type(permissions, node.name)

            # Print each mutation/subscription found
            status = "✓" if not issue_type else "✗"
            perm_info = []
            if permissions.has_permission_classes:
                if permissions.has_is_not_read_only:
                    perm_info.append("IsNotReadOnly")
                if permissions.has_is_not_viewer:
                    perm_info.append("IsNotViewer")
                perms_str = f" [{', '.join(perm_info)}]" if perm_info else " [no required perms]"
            else:
                perms_str = " [no permission_classes]"

            print(f"  {status} {decorator_type}: {node.name}{perms_str}")

            if issue_type:
                self.issues.append(
                    Issue(
                        file_path=self.current_file,
                        line_number=node.lineno,
                        function_name=node.name,
                        issue_type=issue_type,
                        decorator_type=decorator_type,
                    )
                )

    def _determine_issue_type(
        self, permissions: PermissionCheck, function_name: str
    ) -> IssueType | None:
        """
        Determine the issue type based on permission checks.

        Args:
            permissions: The permission check results.
            function_name: The name of the function being checked.

        Returns:
            The issue type if an issue is found, otherwise None.
        """
        if not permissions.has_permission_classes:
            return "no_permission_classes"
        if not permissions.has_is_not_read_only:
            return "missing_is_not_read_only"
        if not permissions.has_is_not_viewer and function_name not in SKIP_IS_NOT_VIEWER_CHECK:
            return "missing_is_not_viewer"
        return None

    def _get_strawberry_decorator_type(
        self, decorator: ast.expr
    ) -> Literal["mutation", "subscription"] | None:
        """
        Determine if the decorator represents a strawberry.mutation or strawberry.subscription.

        Supports: strawberry.mutation(), mutation(), strawberry.mutation, mutation
                  strawberry.subscription(), subscription(), strawberry.subscription, subscription

        Args:
            decorator: The decorator AST node to check.

        Returns:
            "mutation" or "subscription" if recognized; otherwise None.
        """
        # Extract the actual function/attribute from calls: @mutation() -> mutation
        func = decorator.func if isinstance(decorator, ast.Call) else decorator

        # Check for strawberry.mutation/subscription (attribute access)
        if isinstance(func, ast.Attribute):
            if isinstance(func.value, ast.Name) and func.value.id == "strawberry":
                if func.attr in ("mutation", "subscription"):
                    return func.attr  # type: ignore

        # Check for mutation/subscription (direct import)
        if isinstance(func, ast.Name):
            if func.id in ("mutation", "subscription") and func.id in self.imported_names:
                return func.id  # type: ignore

        return None

    def _check_permissions(self, decorator: ast.expr) -> PermissionCheck:
        """
        Check if the decorator includes permission_classes and required permissions.

        Args:
            decorator: The decorator AST node to check.

        Returns:
            PermissionCheck with flags for each required permission.
        """
        if not isinstance(decorator, ast.Call):
            return PermissionCheck(False, False, False)

        # Find the permission_classes keyword argument
        permission_classes = next(
            (kw.value for kw in decorator.keywords if kw.arg == "permission_classes"),
            None,
        )

        if permission_classes is None:
            return PermissionCheck(False, False, False)

        # Extract permission names from the list
        permission_names = self._extract_permission_names(permission_classes)

        return PermissionCheck(
            has_permission_classes=True,
            has_is_not_read_only="IsNotReadOnly" in permission_names,
            has_is_not_viewer="IsNotViewer" in permission_names,
        )

    def _extract_permission_names(self, permission_classes: ast.expr) -> set[str]:
        """
        Extract permission class names from the AST node.

        Args:
            permission_classes: The AST node containing permission classes.

        Returns:
            A set of permission class name strings.
        """
        if not isinstance(permission_classes, ast.List):
            return set()

        names = set()
        for elt in permission_classes.elts:
            if isinstance(elt, ast.Name):
                names.add(elt.id)
            elif isinstance(elt, ast.Attribute):
                names.add(elt.attr)
        return names


def check_files(directory: Path) -> tuple[list[Issue], int, int]:
    """
    Recursively check all Python files in the specified directory for issues.

    Args:
        directory: The directory to search for Python files.

    Returns:
        A tuple containing:
            - A list of issues
            - Total number of mutations found across all files
            - Total number of subscriptions found across all files
    """
    issues: list[Issue] = []
    total_mutations_found = 0
    total_subscriptions_found = 0

    py_files = list(directory.glob("**/*.py"))
    for py_file in py_files:
        print(f"Checking {py_file}")
        try:
            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
            visitor = StrawberryMutationVisitor(py_file)
            visitor.visit(tree)
            issues.extend(visitor.issues)
            total_mutations_found += visitor.mutations_found
            total_subscriptions_found += visitor.subscriptions_found
        except SyntaxError:
            print(f"Syntax error in {py_file}, skipping", file=sys.stderr)
        except Exception as e:
            print(f"Error processing {py_file}: {e}", file=sys.stderr)

    print(f"Checked {len(py_files)} Python files")
    return issues, total_mutations_found, total_subscriptions_found


def format_issues(issues: Sequence[Issue], total_mutations: int, total_subscriptions: int) -> None:
    """
    Print formatted issue messages.

    Args:
        issues: List of issues to print.
        total_mutations: Total number of mutations found.
        total_subscriptions: Total number of subscriptions found.
    """
    if total_mutations == 0 or total_subscriptions == 0:
        if total_mutations == 0 and total_subscriptions == 0:
            print(
                "No mutations or subscriptions found! This might indicate you're checking the wrong directory."
            )
        elif total_mutations == 0:
            print(
                f"No mutations found! Found {total_subscriptions} subscriptions but expected both."
            )
        else:
            print(f"No subscriptions found! Found {total_mutations} mutations but expected both.")
        return

    if not issues:
        print(
            f"No issues found! All {total_mutations} mutations and {total_subscriptions} subscriptions have proper permission_classes."
        )
        return

    print(
        f"\nFound {len(issues)} issue(s) out of {total_mutations} mutations and {total_subscriptions} subscriptions:"
    )

    # Group and print issues by issue type
    by_issue_type = defaultdict(list)
    for issue in issues:
        by_issue_type[issue.issue_type].append(issue)

    for issue_type, type_issues in by_issue_type.items():
        print(f"\n{ISSUE_DESCRIPTIONS[issue_type]} ({len(type_issues)} occurrences):")
        for issue in type_issues:
            print(f"  - {issue}")


def main() -> int:
    """
    Main entry point for the script.

    Returns:
        0 if no issues found and mutations/subscriptions exist,
        1 if issues found,
        2 for invalid directory,
        3 if no mutations/subscriptions found (likely wrong directory).
    """
    parser = argparse.ArgumentParser(
        description="Check for Strawberry mutations and subscriptions without proper permission_classes"
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

    issues, total_mutations, total_subscriptions = check_files(directory)
    format_issues(issues, total_mutations, total_subscriptions)

    # Return appropriate exit code based on findings
    if total_mutations == 0 or total_subscriptions == 0:
        if total_mutations == 0 and total_subscriptions == 0:
            print(
                "ERROR: No mutations or subscriptions found in any files. Are you checking the correct directory?",
                file=sys.stderr,
            )
        elif total_mutations == 0:
            print(
                f"ERROR: No mutations found! Found {total_subscriptions} subscriptions but expected both.",
                file=sys.stderr,
            )
        else:
            print(
                f"ERROR: No subscriptions found! Found {total_mutations} mutations but expected both.",
                file=sys.stderr,
            )
        return 3
    if issues:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
