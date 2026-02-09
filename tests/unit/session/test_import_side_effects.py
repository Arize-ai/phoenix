"""
Tests to ensure that importing phoenix does not have unwanted side effects.
"""

import sys

# Python's default recursion limit (CPython; not exposed in the stdlib).
# https://github.com/python/cpython/blob/432ddd99e2b06a75a4f47bd99c0fd0c911bdb19c/Include/internal/pycore_ceval.h#L43
DEFAULT_RECURSION_LIMIT = 1000


def test_recursion_limit_is_1000_after_importing_phoenix() -> None:
    """
    Test that after importing phoenix, the recursion limit is still the default.

    Importing phoenix must not pull in IPython/jedi, which would set it to 3000.
    See: https://github.com/Arize-ai/phoenix/issues/11281
    """
    import phoenix  # noqa: F401

    assert sys.getrecursionlimit() == DEFAULT_RECURSION_LIMIT, (
        f"Expected recursion limit {DEFAULT_RECURSION_LIMIT} after importing phoenix, "
        f"got {sys.getrecursionlimit()}. "
    )
