"""Analyze ty errors and order them by import order."""

import re
import subprocess
import sys
from pathlib import Path
from typing import Any

# Track import order (file paths)
import_order: list[str] = []
seen_modules: set[str] = set()
repo_root = Path.cwd()
original_import = __builtins__.__import__


def trace_import(
    name: str,
    globals: dict[str, Any] | None = None,
    locals: dict[str, Any] | None = None,
    fromlist: tuple[str, ...] = (),
    level: int = 0,
) -> Any:
    """Trace imports and record phoenix-related module file paths."""
    result = original_import(name, globals, locals, fromlist, level)

    # Only track phoenix-related imports
    is_phoenix_import = name.startswith("phoenix")
    is_relative_phoenix = level > 0 and globals and "phoenix" in globals.get("__name__", "")

    if is_phoenix_import or is_relative_phoenix:
        # Get the module from sys.modules
        if name in sys.modules and name not in seen_modules:
            module = sys.modules[name]
            if hasattr(module, "__file__") and module.__file__:
                file_path = Path(module.__file__).resolve()
                # Make it relative to repo root
                try:
                    rel_path = file_path.relative_to(repo_root)
                    path_str = str(rel_path)
                    if path_str not in import_order:
                        import_order.append(path_str)
                    seen_modules.add(name)
                except ValueError:
                    # File is outside repo, skip it
                    pass

    return result


# Install the import hook
__builtins__.__import__ = trace_import

# Step 1: Import phoenix to trace import order
print("Step 1: Tracing import order...", file=sys.stderr)
import phoenix  # noqa: E402, F401

print(f"  Found {len(import_order)} modules", file=sys.stderr)

# Step 2: Run ty check
print("\nStep 2: Running ty check...", file=sys.stderr)
result = subprocess.run(
    ["ty", "check", "--output-format", "concise", "src/"],
    capture_output=True,
    text=True,
)
ty_output = result.stdout + result.stderr

# Step 3: Parse ty output to find files with errors and warnings
print("Step 3: Parsing ty errors and warnings...", file=sys.stderr)
diagnostic_pattern = re.compile(r"^(src/[^:]+):\d+:\d+: (error|warning)\[([^\]]+)\]", re.MULTILINE)
files_with_errors: dict[str, list[str]] = {}
files_with_warnings: dict[str, list[str]] = {}

for match in diagnostic_pattern.finditer(ty_output):
    file_path = match.group(1)
    level = match.group(2)
    code = match.group(3)

    target = files_with_errors if level == "error" else files_with_warnings
    if file_path not in target:
        target[file_path] = []
    if code not in target[file_path]:
        target[file_path].append(code)

print(f"  Found {len(files_with_errors)} files with errors", file=sys.stderr)
print(f"  Found {len(files_with_warnings)} files with warnings", file=sys.stderr)


def order_by_import_order(file_set: dict[str, list[str]]) -> list[str]:
    """Return file paths ordered by import order, with remaining files sorted at the end."""
    ordered: list[str] = []
    for file_path in import_order:
        if file_path in file_set:
            ordered.append(file_path)
    for file_path in sorted(file_set.keys()):
        if file_path not in ordered:
            ordered.append(file_path)
    return ordered


# Step 4: Order files by import order
print("\nStep 4: Ordering files by import order...", file=sys.stderr)
ordered_files_with_errors = order_by_import_order(files_with_errors)
ordered_files_with_warnings = order_by_import_order(files_with_warnings)

# Step 5: Write to files
script_dir = Path(__file__).parent
errors_output_file = script_dir / "modules_with_type_errors.txt"
warnings_output_file = script_dir / "modules_with_type_warnings.txt"
print("\nStep 5: Writing results...", file=sys.stderr)

with open(errors_output_file, "w") as f:
    for file_path in ordered_files_with_errors:
        f.write(f"{file_path}\n")

with open(warnings_output_file, "w") as f:
    for file_path in ordered_files_with_warnings:
        f.write(f"{file_path}\n")

print(
    f"\nDone! {len(ordered_files_with_errors)} files with errors written to {errors_output_file}",
    file=sys.stderr,
)
print(
    f"      {len(ordered_files_with_warnings)} files with warnings written to"
    f" {warnings_output_file}",
    file=sys.stderr,
)
