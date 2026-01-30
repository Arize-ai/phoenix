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
    ["uv", "run", "ty", "check", "--output-format", "concise", "src/"],
    capture_output=True,
    text=True,
)
ty_output = result.stdout + result.stderr

# Step 3: Parse ty output to find files with errors
print("Step 3: Parsing ty errors...", file=sys.stderr)
error_pattern = re.compile(r"^(src/[^:]+):\d+:\d+: (error|warning)\[([^\]]+)\]", re.MULTILINE)
files_with_errors: dict[str, list[str]] = {}

for match in error_pattern.finditer(ty_output):
    file_path = match.group(1)
    level = match.group(2)  # error or warning
    error_code = match.group(3)

    # Only track errors, not warnings
    if level == "error":
        if file_path not in files_with_errors:
            files_with_errors[file_path] = []
        if error_code not in files_with_errors[file_path]:
            files_with_errors[file_path].append(error_code)

print(f"  Found {len(files_with_errors)} files with errors", file=sys.stderr)

# Step 4: Order files by import order
print("\nStep 4: Ordering files by import order...", file=sys.stderr)
ordered_files_with_errors: list[str] = []

# Create a mapping of file paths to their import order index
import_order_map = {path: idx for idx, path in enumerate(import_order)}

# Add files that are in import order
for file_path in import_order:
    if file_path in files_with_errors:
        ordered_files_with_errors.append(file_path)

# Add remaining files (not in import order) at the end
for file_path in sorted(files_with_errors.keys()):
    if file_path not in ordered_files_with_errors:
        ordered_files_with_errors.append(file_path)

# Step 5: Write to file
script_dir = Path(__file__).parent
output_file = script_dir / "modules_with_type_errors.txt"
print(f"\nStep 5: Writing results to {output_file}...", file=sys.stderr)

with open(output_file, "w") as f:
    for file_path in ordered_files_with_errors:
        f.write(f"{file_path}\n")

print(
    f"\nDone! {len(ordered_files_with_errors)} files with errors written to {output_file}",
    file=sys.stderr,
)
