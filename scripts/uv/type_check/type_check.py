"""Run ty check and verify only expected modules have errors."""

import re
import subprocess
import sys
from pathlib import Path


def main() -> int:
    script_dir = Path(__file__).parent
    expected_errors_file = script_dir / "modules_with_type_errors.txt"

    with open(expected_errors_file) as f:
        expected_error_files = {line.strip() for line in f if line.strip()}

    print(f"Loaded {len(expected_error_files)} expected error files", file=sys.stderr)

    print("Running ty check...", file=sys.stderr)
    result = subprocess.run(
        ["uv", "run", "ty", "check", "--output-format", "concise", "src/"],
        capture_output=True,
        text=True,
    )
    ty_output = result.stdout + result.stderr

    error_pattern = re.compile(r"^(src/[^:]+):\d+:\d+: (error|warning)\[([^\]]+)\]", re.MULTILINE)
    files_with_errors: set[str] = set()

    for match in error_pattern.finditer(ty_output):
        file_path = match.group(1)
        level = match.group(2)  # error or warning

        # Only track errors, not warnings
        if level == "error":
            files_with_errors.add(file_path)

    print(f"Found {len(files_with_errors)} files with errors", file=sys.stderr)

    # Find unexpected errors
    unexpected_errors = files_with_errors - expected_error_files

    if unexpected_errors:
        print("\n❌ UNEXPECTED TYPE ERRORS FOUND:", file=sys.stderr)
        print(
            f"\nThe following {len(unexpected_errors)} file(s) have "
            "type errors that are not in the expected list:\n",
            file=sys.stderr,
        )
        for file_path in sorted(unexpected_errors):
            print(f"  - {file_path}", file=sys.stderr)
        print(
            f"\nPlease fix these errors or add them to {expected_errors_file.name}",
            file=sys.stderr,
        )
        return 1

    # Check if we have fewer errors than expected (good news!)
    missing_errors = expected_error_files - files_with_errors
    if missing_errors:
        print("\n✅ GOOD NEWS: Some expected errors have been fixed!", file=sys.stderr)
        print(
            f"\nThe following {len(missing_errors)} file(s) no longer have errors:\n",
            file=sys.stderr,
        )
        for file_path in sorted(missing_errors):
            print(f"  - {file_path}", file=sys.stderr)
        print(
            f"\nConsider updating {expected_errors_file.name} to remove these files.",
            file=sys.stderr,
        )

    print("\n✅ All type errors are in expected modules", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
