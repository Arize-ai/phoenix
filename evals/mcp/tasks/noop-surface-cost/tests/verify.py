def verify_answer(answer, reference):
    """Return reward 1 for exactly ok after trimming whitespace, otherwise 0."""
    return {"reward": int(isinstance(answer, str) and answer.strip() == "ok")}
