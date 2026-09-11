import re

from grading import identity, plain


def grade(answer, reference):
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
