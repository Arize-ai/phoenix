from evals.mcp.scoring.answers import identity


def verify_top_error_category(answer, reference):
    """Return reward 1 when the answer names a most-common category, otherwise 0.

    Match the trusted labels counted from stored trail_error span annotations.
    Comparison ignores case and Markdown emphasis.
    """
    return {"reward": int(identity(answer, reference["winners"], all_winners=False))}
