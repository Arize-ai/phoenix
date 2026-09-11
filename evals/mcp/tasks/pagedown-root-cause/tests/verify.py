"""Check the signature mismatch diagnosis and one argument observed in the seed.

A generic TypeError or mention of keyword arguments is insufficient. The answer
must explain that the caller passes unsupported keywords to forward(), naming
an actual offending argument. This deterministic rubric needs no model call.
"""

import re

from evals.mcp.scoring.answers import plain


def verify_pagedown_root_cause(answer, reference):
    """Return reward 1 for a supported signature-mismatch diagnosis, otherwise 0.

    Require an explanation that forward receives an unsupported keyword and
    the name of an offending argument found in the seeded error messages.
    """
    signatures = reference.get("signatures", [])
    keywords = set(
        re.findall(r"unexpected keyword argument ['\"](.*?)['\"]", "\n".join(signatures), re.I)
    )
    if not keywords:
        raise ValueError("Seed lacks the expected signature error evidence")
    text = plain(answer).lower()
    mismatch = bool(
        re.search(
            r"unexpected|unsupported|does(?:n't| not) accept|not accept|"
            r"not in (?:its |the )?signature",
            text,
        )
    )
    call = "forward" in text and bool(re.search(r"argument|kwarg|keyword", text))
    detail = any(
        (
            k.lower() in text
            if k
            else bool(re.search(r"empty (?:string|keyword|argument)|['\"]{2}", text))
        )
        for k in keywords
    )
    return {"reward": int(mismatch and call and detail)}
