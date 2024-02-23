try:
    # Attempt to import the actual phoenix.evals package/module
    from phoenix.evals import *  # noqa: F403
except ImportError:
    raise ImportError(
        "The optional `phoenix.evals` package is not installed. Please install `phoenix` with the "
        "`evals` extra: `pip install phoenix[evals]`."
    )
