import re

from evals.mcp.scoring.answers import identity, plain


def verify_answer(answer, reference):
    """Return reward 1 for a most-repeated tool and its exact count, otherwise 0.

    Match a trusted tool-name alias and a count labeled calls or times.
    Any tied winner is accepted; every stated call count must agree.
    """
    count = reference.get("value")
    if type(count) is not int or count <= 0:
        raise ValueError("Missing trusted repetition count")
    text = plain(answer)
    counts = re.findall(r"(?<![-\w])(\d+)\s*(?:calls?|times)\b", text, re.I)
    correct = (
        identity(answer, reference["winners"], all_winners=False)
        and bool(counts)
        and all(int(n) == count for n in counts)
    )
    return {"reward": int(correct)}
