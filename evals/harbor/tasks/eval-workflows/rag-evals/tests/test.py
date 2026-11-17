"""Grades `rag-evals`: document relevance, answer groundedness, and the diagnosis."""

from harbor_verifiers import grading, judge_prompts
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

# Inputs to the reported prompt_quality measure, which never changes the reward.
APP = "A policy assistant for an online store. It retrieves 4 policy passages for a customer's question and answers from them, saying it doesn't know when they don't cover the question."
CRITERIA = {
    "relevant": "The retrieved document contains the policy that answers the customer's question.",
    "grounded": "The answer states only what the retrieved passages say, or says it can't find the answer.",
}
EVIDENCE = {
    "relevant": "the customer's question and the document's text",
    "grounded": "the answer and the text of every retrieved passage",
}
DETERMINISTIC = ()

checks: dict[str, bool] = {}
details: dict = {}


def documents(labels: dict[str, bool]) -> dict[tuple[str, int], bool]:
    """Splits truth's `span_id:position` keys into (span ID, position) tuples."""
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
checks["bigger_problem"] = grading.check_report_claims(claims, expected, reply)["bigger_problem"]
details["reply"] = {"source": source, "claims": claims}
seen_spans = grading.project_spans(PROJECT)
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
# The nightly job's key can only call the pinned model, so the rerun refuses any other.
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_traces", TRUTH["unseen"])
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(seen_spans, TRUTH["unseen"]["spans"]),
)
grading.finish(checks, details, measures)
