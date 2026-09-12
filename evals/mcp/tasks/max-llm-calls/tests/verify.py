from evals.mcp.scoring.answers import exact_integer


def verify_answer(answer, reference):
    """Return reward 1 for the exact maximum LLM-call count, otherwise 0.

    Compare an unambiguous integer or call-count statement with the largest
    number of LLM spans in a single seeded trace.
    """
    return {"reward": int(exact_integer(answer, reference.get("value"), "(?:LLM )?calls?"))}
