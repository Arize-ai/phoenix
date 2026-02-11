import fnmatch
import os
from collections.abc import Iterator
from contextlib import contextmanager


@contextmanager
def without_env_vars(*patterns: str) -> Iterator[None]:
    """Context manager that temporarily removes environment variables.

    Environment variables are removed for the duration of the context and
    restored to their original values upon exit (unless modified within the
    context). Patterns that don't match any variables are silently ignored.

    Patterns use Unix shell-style wildcards (via ``fnmatch``):
        - ``*`` matches everything
        - ``?`` matches any single character
        - ``[seq]`` matches any character in seq
        - ``[!seq]`` matches any character not in seq

    Note:
        This function modifies global state (os.environ) and is not thread-safe.
        Do not use in multi-threaded code or with async code that may yield
        control to other coroutines.

    Args:
        *patterns (str): Patterns to match environment variable names.

    Yields:
        None: Control is yielded to the context block.

    Examples:
        >>> import os
        >>> os.environ["MY_VAR"] = "value"
        >>> with without_env_vars("MY_VAR"):
        ...     assert "MY_VAR" not in os.environ
        >>> assert os.environ["MY_VAR"] == "value"

        >>> os.environ["PREFIX_A"] = "a"
        >>> os.environ["PREFIX_B"] = "b"
        >>> with without_env_vars("PREFIX_*"):
        ...     assert "PREFIX_A" not in os.environ
        ...     assert "PREFIX_B" not in os.environ
    """
    original: dict[str, str] = {}
    remaining_keys = set(os.environ.keys())
    for pattern in patterns:
        matched = {k for k in remaining_keys if fnmatch.fnmatch(k, pattern)}
        for key in matched:
            original[key] = os.environ.pop(key)
        remaining_keys -= matched
    try:
        yield
    finally:
        for key, value in original.items():
            if key not in os.environ:
                os.environ[key] = value
