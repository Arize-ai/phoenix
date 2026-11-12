"""Grades `rag-evals`: document relevance, answer groundedness, and the diagnosis.

1. The `relevant` annotation must cover at least 95% of the retrieved documents in the
   54 production traces and catch at least 85% of relevant and of irrelevant documents.
   The `grounded` annotation must cover at least 95% of the traces and catch at least
   80% of grounded and of ungrounded answers.
2. The reply must name retrieval as the bigger problem.
3. The verifier adds 24 new traces the agent never saw, runs the agent's nightly entry
   point, and applies the bars in step 1 to the new traces.
"""

from harbor_verifiers import grading
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
MIN_RECALL = {"relevant": 0.85, "grounded": 0.8}
MIN_COVERAGE = 0.95
RERUN = "python evals/rag_evals.py"
DIAGNOSIS = {
    "bigger_problem": (
        "Which part of the policy assistant the reply says is the bigger problem right now: "
        "'retrieval' (the retriever doesn't return the policy that answers the question) or "
        "'generation' (the answer doesn't stick to the retrieved policies). Use exactly "
        "'retrieval' or 'generation'."
    )
}

checks: dict[str, bool] = {}
details: dict = {}


def documents(labels: dict[str, bool]) -> dict[tuple[str, int], bool]:
    """Maps `span_id:position` keys to the (span ID, position) keys the reader returns."""
    return {(key.split(":")[0], int(key.split(":")[1])): value for key, value in labels.items()}


def grade(cohort: str, labels: dict) -> None:
    results = {
        "relevant": grading.agreement(
            grading.document_predictions(PROJECT, "relevant"), documents(labels["relevant"])
        ),
        "grounded": grading.agreement(
            grading.trace_predictions(PROJECT, "grounded"), labels["grounded"]
        ),
    }
    for name, result in results.items():
        checks[f"{cohort}.{name}"] = result.passes(MIN_RECALL[name], MIN_COVERAGE)
        details[f"{cohort}.{name}"] = result.as_dict()


grade("production", TRUTH["visible"])
reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
claims = grading.extract_report_claims(reply, DIAGNOSIS) if reply.strip() else {}
expected = {"bigger_problem": TRUTH["bigger_problem"]}
checks["reply.bigger_problem"] = grading.check_report_claims(claims, expected, reply)[
    "bigger_problem"
]
details["reply"] = {"source": source, "claims": claims}
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
details["rerun"] = grading.run_as_agent(RERUN, timeout=900).as_dict()
grade("new_traces", TRUTH["unseen"])
grading.finish(checks, details)
