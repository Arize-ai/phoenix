import re

from evals.mcp.scoring.answers import numeric, plain


def verify_answer(answer, reference):
    """Return reward 1 when both labeled error percentages match, otherwise 0.

    Extract percentages labeled short and long. Compare each with the trusted
    ERROR-span share of that group, rounded to one decimal place.
    """
    text = plain(answer)
    rates = {}
    for group in ("short", "long"):
        if reference.get(group) is None:
            raise ValueError("Missing trusted group denominator")
        # Labels bind each percentage to its requested denominator, in either order.
        matches = re.findall(r"\b" + group + r"(?:er)?\b[^%;\n]*?-?\d+(?:\.\d+)?\s*%", text, re.I)
        rates[group] = bool(matches) and all(
            numeric(value, reference[group], kind="percent", places=1) for value in matches
        )
    return {"reward": int(all(rates.values()))}
