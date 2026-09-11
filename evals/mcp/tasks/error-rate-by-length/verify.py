import re

from grading import numeric, plain


def grade(answer, reference):
    text = plain(answer)
    rates = {}
    for group in ("short", "long"):
        # Labels bind each percentage to its requested denominator, in either order.
        matches = re.findall(r"\b" + group + r"(?:er)?\b[^%;\n]*?(\d+(?:\.\d+)?)\s*%", text, re.I)
        rates[group] = bool(matches) and all(
            numeric(value, reference[group], kind="percent", places=1) for value in matches
        )
        if reference.get(group) is None:
            raise ValueError("Missing trusted group denominator")
    return {"reward": int(all(rates.values()))}
