"""Tests for phoenix.evals package initialization behavior."""

import subprocess
import sys


def test_importing_phoenix_evals_does_not_emit_templating_deprecation_warning():
    """Importing ``phoenix.evals`` must not trigger the templating deprecation warning.

    The ``templating`` submodule is deprecated and emits a ``DeprecationWarning``
    when imported.  Previously, ``phoenix/evals/__init__.py`` imported it eagerly,
    which meant every ``import phoenix.evals`` triggered the warning — even for
    callers that never use ``templating``.

    The fix uses module ``__getattr__`` to defer the import until the caller
    explicitly accesses ``phoenix.evals.templating``.

    Regression test for https://github.com/Arize-ai/phoenix/issues/12872.
    """
    # Run in a subprocess so the module is freshly imported with no caching.
    code = (
        "import warnings; "
        "warnings.simplefilter('error', DeprecationWarning); "
        "import phoenix.evals"
    )
    result = subprocess.run(
        [sys.executable, "-W", "error::DeprecationWarning", "-c", code],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Importing phoenix.evals raised a DeprecationWarning:\n"
        f"stdout: {result.stdout}\n"
        f"stderr: {result.stderr}"
    )


def test_accessing_templating_submodule_emits_deprecation_warning():
    """Accessing ``phoenix.evals.templating`` must still emit a ``DeprecationWarning``.

    Even though the import is now lazy, the warning must fire when a caller
    actually accesses the deprecated submodule so that users are informed to
    migrate to ``phoenix.evals.llm.prompts``.
    """
    import warnings

    import phoenix.evals

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        _ = phoenix.evals.templating  # noqa: F841 — access triggers lazy import

    deprecation_warnings = [
        w for w in caught if issubclass(w.category, DeprecationWarning) and "templating" in str(w.message)
    ]
    assert deprecation_warnings, (
        "Expected a DeprecationWarning mentioning 'templating' when accessing "
        "phoenix.evals.templating, but none was raised."
    )
