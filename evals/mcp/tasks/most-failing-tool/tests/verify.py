from evals.mcp.scoring.answers import identity


def verify_answer(answer, reference):
    """Return reward 1 when the answer names a most-failing tool, otherwise 0.

    Match the trusted winners using their span-name or tool-name aliases.
    Winners have the greatest number of TOOL spans with ERROR status.
    """
    return {"reward": int(identity(answer, reference["winners"], all_winners=False))}
