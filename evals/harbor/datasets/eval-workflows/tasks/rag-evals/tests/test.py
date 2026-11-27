"""Grades `rag-evals`: document relevance, answer groundedness, and the diagnosis."""

from harbor_verifiers import grading, judge_prompts
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply

EXPECTED = grading.load_test_json("expected.json")
GRADING = grading.load_test_json("grading_data.json")
PROJECT = GRADING["project"]
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
    """Rekeys `span_id:position` labels to the tuples `document_predictions` returns."""
    return {(key.split(":")[0], int(key.split(":")[1])): value for key, value in labels.items()}


def agrees(cohort: str) -> bool:
    """Checks whether the `relevant` and `grounded` annotations both meet the recall bars."""
    labels = GRADING[cohort]
    results = {
        "relevant": grading.agreement(
            grading.document_predictions(PROJECT, "relevant"), documents(labels["relevant"])
        ),
        "grounded": grading.agreement(
            grading.trace_predictions(PROJECT, "grounded"), labels["grounded"]
        ),
    }
    passed = {
        name: result.passes(EXPECTED["min_recall"][name], EXPECTED["min_coverage"])
        for name, result in results.items()
    }
    details[cohort] = {
        name: {**result.as_dict(), "passes": passed[name]} for name, result in results.items()
    }
    return all(passed.values())


checks["production_traces"] = agrees("production_traces")
reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
claims = grading.extract_report_claims(reply, DIAGNOSIS) if reply.strip() else {}
stage = grading.check_report_claims(claims, {"bigger_problem": EXPECTED["bigger_problem"]}, reply)
checks["names_right_stage"] = stage["bigger_problem"]
details["reply"] = {"source": source, "claims": claims}
seen_spans = grading.project_spans(PROJECT)
grading.inject_spans(PROJECT, GRADING["new_traces"]["spans"])
# The nightly job's key can only call the pinned model, so the rerun refuses any other.
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
checks["new_traces"] = agrees("new_traces")
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(seen_spans, GRADING["new_traces"]["spans"]),
)
grading.finish(checks, details, measures)
