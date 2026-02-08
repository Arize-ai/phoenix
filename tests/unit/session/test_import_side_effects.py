"""
Tests to ensure that importing phoenix does not have unwanted side effects.
"""

import sys
import subprocess
from pathlib import Path


def test_import_does_not_change_recursion_limit() -> None:
    """
    Test that importing phoenix does not silently change sys.setrecursionlimit.

    This test runs a subprocess to check the recursion limit before and after
    importing phoenix, to ensure the import doesn't trigger IPython's jedi
    which unconditionally calls sys.setrecursionlimit(3000).

    See: https://github.com/Arize-ai/phoenix/issues/11281
    """
    # Create a test script to check recursion limit before and after import
    test_script = """
import sys

# Get default recursion limit
default_limit = sys.getrecursionlimit()
print(f"BEFORE:{default_limit}")

# Import phoenix
import phoenix

# Get recursion limit after import
after_limit = sys.getrecursionlimit()
print(f"AFTER:{after_limit}")
"""

    # Run the test script in a subprocess to have a clean Python environment
    result = subprocess.run(
        [sys.executable, "-c", test_script],
        capture_output=True,
        text=True,
        timeout=10,
    )

    # Parse the output
    output_lines = result.stdout.strip().split("\n")
    before_line = [line for line in output_lines if line.startswith("BEFORE:")][0]
    after_line = [line for line in output_lines if line.startswith("AFTER:")][0]

    before_limit = int(before_line.split(":")[1])
    after_limit = int(after_line.split(":")[1])

    # The recursion limit should not change after importing phoenix
    assert before_limit == after_limit, (
        f"Importing phoenix changed sys.setrecursionlimit from {before_limit} to {after_limit}. "
        "This is unexpected side effect behavior that can mask infinite recursion bugs. "
        "See https://github.com/Arize-ai/phoenix/issues/11281"
    )


def test_view_method_lazy_imports_ipython() -> None:
    """
    Test that the view() method lazy-imports IPython only when called.

    This ensures IPython (and its jedi dependency) is not imported at module scope.
    """
    # Create a test script that imports phoenix but doesn't call view()
    test_script = """
import sys

# Import phoenix
import phoenix

# Check if IPython.display is loaded
ipython_loaded = any(
    mod_name.startswith("IPython.display")
    for mod_name in sys.modules.keys()
)
print(f"IPYTHON_LOADED:{ipython_loaded}")
"""

    result = subprocess.run(
        [sys.executable, "-c", test_script],
        capture_output=True,
        text=True,
        timeout=10,
    )

    # Parse the output
    output_lines = result.stdout.strip().split("\n")
    loaded_line = [line for line in output_lines if line.startswith("IPYTHON_LOADED:")][0]
    ipython_loaded = loaded_line.split(":")[1] == "True"

    # IPython.display should NOT be loaded just from importing phoenix
    assert not ipython_loaded, (
        "IPython.display was loaded when importing phoenix, "
        "which means it's not being lazy-imported. "
        "This can cause unwanted side effects like changing sys.setrecursionlimit."
    )
