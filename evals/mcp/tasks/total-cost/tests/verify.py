from evals.mcp.scoring.answers import numeric


def verify_answer(answer, reference):
    """Return reward 1 for the total application cost rounded to cents, otherwise 0.

    Compare a currency amount or a bare numeric answer with the trusted sum
    of seeded span costs. Token counts do not qualify as currency amounts.
    """
    return {"reward": int(numeric(answer, reference.get("value"), kind="cost", places=2))}
