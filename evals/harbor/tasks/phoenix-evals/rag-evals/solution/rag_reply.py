"""Write the reference reply for `rag-evals` from the eval script's summary.

Reads the output of `python evals/rag_evals.py` on stdin, echoes it, and turns the JSON
summary on its last line into the reply.
"""

from __future__ import annotations

import json
import sys

from harbor_verifiers.phoenix_api import write_answer


def main() -> None:
    output = sys.stdin.read()
    print(output, end="")
    summary = json.loads(output.strip().splitlines()[-1])
    traces = summary["traces_scored"]
    misses = summary["retrieval_misses"]
    hits = traces - misses
    ungrounded = summary["ungrounded"]
    after_miss = summary["ungrounded_after_miss"]
    after_hit = ungrounded - after_miss
    bigger = "Retrieval" if misses > after_hit else "Generation"
    write_answer(
        f"**{bigger} is the bigger problem right now.**\n\n"
        f"- Retrieval: in {misses} of {traces} traces ({misses / traces:.0%}), none of the "
        "4 retrieved passages answered the customer's question.\n"
        f"- Generation: when the right policy was retrieved, {after_hit} of {hits} answers "
        f"({after_hit / max(hits, 1):.0%}) still contradicted it or added claims it doesn't "
        "support.\n"
        f"- {after_miss} of the {ungrounded} ungrounded answers came after a retrieval miss, "
        "where the assistant made up a policy or answered from outside the retrieved "
        f"passages. The other {misses - after_miss} missed retrievals got an honest "
        '"I couldn\'t find that."\n\n'
        "Each retrieved document now has a `relevant` annotation and each answer a "
        "`grounded` annotation in the `policy-rag` project, and `python evals/rag_evals.py` "
        "scores new traces."
    )


if __name__ == "__main__":
    main()
