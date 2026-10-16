import importlib
import sys
import warnings


def _clear_modules(prefix: str) -> None:
    for name in list(sys.modules):
        if name == prefix or name.startswith(f"{prefix}."):
            sys.modules.pop(name, None)


def test_importing_phoenix_evals_does_not_warn_about_deprecated_templating() -> None:
    _clear_modules("phoenix.evals")

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        importlib.import_module("phoenix.evals")

    assert not any(
        "phoenix.evals.templating module is deprecated" in str(w.message) for w in caught
    )


def test_accessing_templating_still_warns_and_returns_module() -> None:
    _clear_modules("phoenix.evals")
    module = importlib.import_module("phoenix.evals")

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        templating = module.templating

    assert any("phoenix.evals.templating module is deprecated" in str(w.message) for w in caught)
    assert templating.Template is not None


def test_importing_phoenix_evals_llm_does_not_warn_about_deprecated_wrapper() -> None:
    _clear_modules("phoenix.evals")

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        importlib.import_module("phoenix.evals.llm")

    assert not any(
        "phoenix.evals.llm.wrapper module is deprecated" in str(w.message) for w in caught
    )


def test_importing_wrapper_directly_warns_and_reexports() -> None:
    _clear_modules("phoenix.evals.llm.wrapper")

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        wrapper = importlib.import_module("phoenix.evals.llm.wrapper")

    assert any("phoenix.evals.llm.wrapper module is deprecated" in str(w.message) for w in caught)
    assert wrapper.LLM is not None
