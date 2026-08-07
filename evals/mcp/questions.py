"""The observability question set.

Questions are grouped by ``shape`` — the structural work an answer requires —
because that, not the subject matter, is what separates the arms. A single
lookup needs one call and no computation; a cross-project sweep needs many
calls and a reduction over everything they return. The set deliberately spans
both ends so the report shows where each surface wins and where it loses.

``reference`` names the key in the ground-truth bundle (see ``ground_truth.py``)
that holds a deterministically computed answer for this question. Questions
without a mechanical answer leave it ``None`` and are judged on rubric alone.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

#: Phoenix dataset the pytest plugin records against. Every arm's session lands
#: as a fresh experiment on this one dataset, which is what makes successive
#: sessions comparable in the Phoenix UI.
DATASET_NAME = "mcp-surface-benchmark"

#: Projects the benchmark reads. Kept small and explicit so ground truth stays
#: cheap to compute and the question text can name projects concretely.
BENCHMARK_PROJECTS = ("support-agent", "live-view-demo", "llama_index_rag", "rosetta-agno-py")

#: Span sample size per project. Both the questions and the ground truth use
#: this bound, so an arm that pages differently is still measured fairly.
SPAN_SAMPLE_LIMIT = 100

#: Judge tolerance for the slowest-span latency. Interpolated into the rubric
#: below and enforced by the environment check (the seeded slowest span must
#: beat the runner-up by more than this, or the question has two answers).
SLOWEST_LATENCY_TOLERANCE = 0.05

#: LLM-span count under which a per-model trend is "inconclusive". Interpolated
#: into the prompt and rubric below; the environment check requires the recent
#: window to have at least one model on each side of this threshold so both
#: branches of the rubric are exercised.
MODEL_CONCLUSIVE_SPAN_COUNT = 10


@dataclass(frozen=True)
class Question:
    """One benchmark question.

    Attributes:
        id: Stable identifier; also the dataset example id.
        shape: Structural category, used to group the report.
        prompt: Sent to the agent verbatim.
        rubric: What a correct answer must contain, for the LLM judge.
        reference: Key into the ground-truth bundle, or ``None``.
    """

    id: str
    shape: str
    prompt: str
    rubric: str
    reference: Optional[str] = None


QUESTIONS: tuple[Question, ...] = (
    Question(
        id="project_count",
        shape="trivial_lookup",
        prompt=(
            "How many projects exist in this Phoenix instance? "
            "Answer with the number and nothing else."
        ),
        rubric="States the exact project count. No other content required.",
        reference="project_count",
    ),
    Question(
        id="span_kind_mix",
        shape="single_fetch",
        prompt=(
            f"In the Phoenix project `support-agent`, sample the most recent "
            f"{SPAN_SAMPLE_LIMIT} spans. What span kinds appear, and how many of each?"
        ),
        rubric=(
            "Lists each span kind present with its count. Counts must match the "
            "reference within +/-2 spans (sampling boundary tolerance)."
        ),
        reference="span_kind_mix",
    ),
    Question(
        id="llm_latency_percentiles",
        shape="aggregation",
        prompt=(
            f"In the Phoenix project `support-agent`, look at the most recent "
            f"{SPAN_SAMPLE_LIMIT} spans and report p50, p95, and max latency in "
            "milliseconds for LLM spans only. Include the sample count."
        ),
        rubric=(
            "Reports p50, p95, and max latency in ms for LLM spans plus the count. "
            "Percentiles must be within 15% of the reference; count within +/-2."
        ),
        reference="llm_latency",
    ),
    Question(
        id="error_themes",
        shape="error_theming",
        prompt=(
            "Characterize the failures across the *entire* Phoenix project "
            "`support-agent` — every span in the project, not a recent sample. "
            "How many error spans are there in total, and what are the distinct "
            "failure themes with a count for each?"
        ),
        rubric=(
            "States the total error span count across the whole project and groups "
            "them into themes with counts. The total must match the reference "
            "exactly; the dominant theme must match. An answer based on a partial "
            "sample, or one that reports a recent-window count as if it were the "
            "project total, is incorrect."
        ),
        reference="error_themes",
    ),
    Question(
        id="cross_project_health",
        shape="cross_project_sweep",
        prompt=(
            "Compare these Phoenix projects: "
            + ", ".join(f"`{p}`" for p in BENCHMARK_PROJECTS)
            + f". For each, sample up to {SPAN_SAMPLE_LIMIT} recent spans and report "
            "the span count, the span-kind mix, and the error rate. Then say which "
            "project looks least healthy and why."
        ),
        rubric=(
            "Covers all four projects with span counts, kind mixes, and error rates "
            "matching the reference. Names support-agent as least healthy (it is the "
            "only project with errors) with a reason grounded in its error rate."
        ),
        reference="cross_project_health",
    ),
    Question(
        id="slowest_span",
        shape="needle_in_haystack",
        prompt=(
            f"In the Phoenix project `support-agent`, among the most recent "
            f"{SPAN_SAMPLE_LIMIT} spans, find the single slowest span. Report its "
            "name, its span kind, and its latency in milliseconds."
        ),
        rubric=(
            "Identifies the slowest span by name, with its kind and latency in ms. "
            "Name and kind must match the reference exactly; latency within "
            f"{SLOWEST_LATENCY_TOLERANCE:.0%}."
        ),
        reference="slowest_span",
    ),
    Question(
        id="datasets_with_experiments",
        shape="cross_resource_join",
        prompt=(
            "Which Phoenix datasets have at least one experiment? "
            "List each such dataset with its experiment count."
        ),
        rubric=(
            "Lists dataset names that have experiments, each with a count. The set of "
            "dataset names must match the reference; counts must be exact."
        ),
        reference="datasets_with_experiments",
    ),
    Question(
        id="latency_by_model",
        shape="grouped_aggregation",
        prompt=(
            f"In the Phoenix project `support-agent`, take the most recent "
            f"{SPAN_SAMPLE_LIMIT} spans of *any* kind — do not filter to LLM spans "
            "when fetching — then, among only those spans, break LLM span latency "
            "down by model name. Report p50, p95, and the sample count per model. "
            f"Label any model with fewer than {MODEL_CONCLUSIVE_SPAN_COUNT} spans "
            "as inconclusive rather than reporting a trend."
        ),
        rubric=(
            "Groups LLM spans by model name with p50, p95, and counts per model. "
            "Model names and counts must match the reference exactly, and any model "
            f"under {MODEL_CONCLUSIVE_SPAN_COUNT} spans must be labelled inconclusive.\n"
            "Check percentiles within 15% ONLY for models at or above "
            f"{MODEL_CONCLUSIVE_SPAN_COUNT} spans. Do "
            "not grade percentile accuracy for a group the answer correctly called "
            "inconclusive — on a handful of samples the choice between nearest-rank "
            "and interpolated percentiles moves the number more than the tolerance "
            "allows, so penalizing it measures the convention, not the analysis."
        ),
        reference="latency_by_model",
    ),
)

QUESTIONS_BY_ID = {q.id: q for q in QUESTIONS}
