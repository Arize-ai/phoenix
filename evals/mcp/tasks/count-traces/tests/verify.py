from evals.mcp.scoring.answers import exact_integer


def verify_count_traces(answer, reference):
    """Return reward 1 for the exact trace count in the final answer, otherwise 0.

    Compare an unambiguous integer or trace-count statement with the trusted
    number of distinct trace IDs. A span count alone does not answer this task.
    """
    return {"reward": int(exact_integer(answer, reference.get("value"), "traces?"))}
