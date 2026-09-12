from evals.mcp.scoring.answers import numeric


def verify_answer(answer, reference):
    """Return reward 1 for a supported top-decile cost share, otherwise 0.

    Compare the stated percentage to the trusted floor or ceiling selection
    of 10 percent of traces, rounded to one decimal place. The source prompt
    leaves the trace-count rounding unspecified.
    """
    values = reference.get("values", [reference.get("value")])
    if not values:
        raise ValueError("Missing trusted cost shares")
    return {
        "reward": int(any(numeric(answer, value, kind="percent", places=1) for value in values))
    }
