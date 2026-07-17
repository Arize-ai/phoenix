"""Generate a maximalist single-project fixture for the metrics page.

Set ``PHOENIX_URL`` or ``PHOENIX_PROJECT_NAME`` to override the defaults. The
script recreates one project containing four weeks of varied traces and a dense
matrix of span, trace, and session annotations. It intentionally exercises
score-only, label-only, mixed, sparse, multi-reviewer, high-cardinality, and
non-unit-score evaluation series so the project metrics page has to render its
full range of chart states.
"""

from __future__ import annotations

import json
import math
import os
import random
import time
import uuid
from collections.abc import Iterable, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any, TypeVar

import httpx
from phoenix.client import Client

DEFAULT_PHOENIX_URL = "http://localhost:6006"
DEFAULT_PROJECT_NAME = "evaluation-metrics-maximalist"
DEFAULT_RANDOM_SEED = 20260714
DAY_COUNT = 28
SESSIONS_PER_DAY = 4
TRACES_PER_SESSION = 2
# Four common languages account for most responses; the long tail ensures the
# chart must apply its 12-label cap without looking artificially uniform.
RESPONSE_LANGUAGE_DISTRIBUTION = (
    ("English",) * 45
    + ("Spanish",) * 20
    + ("French",) * 10
    + ("German",) * 5
    + (
        "Japanese",
        "Portuguese",
        "Korean",
        "Arabic",
        "Hindi",
        "Italian",
        "Dutch",
        "Polish",
        "Swedish",
        "Turkish",
        "Vietnamese",
        "Thai",
        "Indonesian",
        "Hebrew",
        "Ukrainian",
        "Other",
    )
)

PHOENIX_URL = os.getenv("PHOENIX_URL", DEFAULT_PHOENIX_URL).rstrip("/")
PROJECT_NAME = os.getenv("PHOENIX_PROJECT_NAME", DEFAULT_PROJECT_NAME)

T = TypeVar("T")


def chunked(values: Sequence[T], size: int) -> Iterable[Sequence[T]]:
    for start_index in range(0, len(values), size):
        yield values[start_index : start_index + size]


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def label_from_thresholds(
    value: float,
    thresholds: Sequence[tuple[float, str]],
) -> str:
    for threshold, label in thresholds:
        if value >= threshold:
            return label
    return thresholds[-1][1]


def make_annotation(
    *,
    name: str,
    target_key: str,
    target_id: str,
    annotator_kind: str,
    label: str | None = None,
    score: float | None = None,
    explanation: str | None = None,
    identifier: str = "maximalist-seed",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    result: dict[str, str | float] = {}
    if label is not None:
        result["label"] = label
    if score is not None:
        result["score"] = score
    if explanation is not None:
        result["explanation"] = explanation
    return {
        "name": name,
        target_key: target_id,
        "annotator_kind": annotator_kind,
        "identifier": identifier,
        "metadata": metadata or {},
        "result": result,
    }


def build_span_annotations(
    *,
    llm_span_id: str,
    tool_span_id: str,
    quality: float,
    latency_seconds: float,
    token_count: int,
    is_error: bool,
    day_index: int,
    trace_ordinal: int,
) -> list[dict[str, Any]]:
    common_metadata = {
        "fixture": "project-metrics-maximalist",
        "day": day_index + 1,
        "trace_ordinal": trace_ordinal,
    }
    quality_label = label_from_thresholds(
        quality,
        (
            (0.85, "excellent"),
            (0.7, "good"),
            (0.5, "acceptable"),
            (0.3, "poor"),
            (0.0, "critical"),
        ),
    )
    style_labels = (
        "concise",
        "conversational",
        "formal",
        "technical",
        "verbose",
        "fragmented",
    )
    safety_labels = ("safe", "safe_with_caveats", "needs_review", "blocked")
    latency_label = label_from_thresholds(
        -latency_seconds,
        ((-3.0, "fast"), (-6.0, "acceptable"), (-10.0, "slow"), (-100.0, "timeout")),
    )
    annotations = [
        make_annotation(
            name="response_quality",
            target_key="span_id",
            target_id=llm_span_id,
            annotator_kind="LLM",
            label=quality_label,
            score=quality,
            explanation="Rubric-based response quality covering accuracy, clarity, and usefulness.",
            metadata=common_metadata,
        ),
        make_annotation(
            name="hallucination_risk",
            target_key="span_id",
            target_id=llm_span_id,
            annotator_kind="LLM",
            score=clamp(1.05 - quality + 0.08 * math.sin(trace_ordinal)),
            explanation="Estimated likelihood that unsupported claims appear in the response.",
            metadata=common_metadata,
        ),
        make_annotation(
            name="style_profile",
            target_key="span_id",
            target_id=llm_span_id,
            annotator_kind="HUMAN",
            label=style_labels[trace_ordinal % len(style_labels)],
            explanation="Dominant writing style selected by a reviewer.",
            metadata=common_metadata,
        ),
        make_annotation(
            name="latency_grade",
            target_key="span_id",
            target_id=llm_span_id,
            annotator_kind="CODE",
            label=latency_label,
            score=latency_seconds,
            explanation="End-to-end latency in seconds; lower is better.",
            metadata=common_metadata,
        ),
        make_annotation(
            name="safety_verdict",
            target_key="span_id",
            target_id=llm_span_id,
            annotator_kind="CODE",
            label=safety_labels[(trace_ordinal + (1 if is_error else 0)) % len(safety_labels)],
            explanation="Rule-based safety policy outcome.",
            metadata=common_metadata,
        ),
        make_annotation(
            name="token_efficiency_percent",
            target_key="span_id",
            target_id=llm_span_id,
            annotator_kind="CODE",
            score=clamp(115 - token_count / 18, 0, 100),
            explanation="A synthetic efficiency score on a 0–100 scale.",
            metadata=common_metadata,
        ),
        make_annotation(
            name="tool_execution_quality",
            target_key="span_id",
            target_id=tool_span_id,
            annotator_kind="CODE",
            label="failed" if is_error else ("partial" if trace_ordinal % 5 == 0 else "successful"),
            score=0.0 if is_error else (0.55 if trace_ordinal % 5 == 0 else 1.0),
            explanation="Checks whether the tool returned a usable result.",
            metadata=common_metadata,
        ),
    ]

    reviewer_labels = ("strong_accept", "accept", "borderline", "reject", "strong_reject")
    reviewer_count = 3 if trace_ordinal % 4 == 0 else 1
    for reviewer_index in range(reviewer_count):
        reviewer_score = clamp(quality + (reviewer_index - 1) * 0.09)
        annotations.append(
            make_annotation(
                name="reviewer_consensus",
                target_key="span_id",
                target_id=llm_span_id,
                annotator_kind="HUMAN",
                label=reviewer_labels[min(len(reviewer_labels) - 1, int((1 - reviewer_score) * 5))],
                score=reviewer_score,
                explanation=f"Independent assessment from reviewer {reviewer_index + 1}.",
                identifier=f"reviewer-{reviewer_index + 1}",
                metadata={**common_metadata, "reviewer": reviewer_index + 1},
            )
        )

    if trace_ordinal % 7 == 0 or day_index in {4, 12, 20}:
        annotations.append(
            make_annotation(
                name="sparse_regression_signal",
                target_key="span_id",
                target_id=llm_span_id,
                annotator_kind="CODE",
                score=clamp((0.65 - quality) * 2),
                explanation="A deliberately sparse canary evaluation.",
                metadata=common_metadata,
            )
        )
    return annotations


def build_trace_annotations(
    *,
    trace_id: str,
    quality: float,
    is_error: bool,
    day_index: int,
    trace_ordinal: int,
) -> list[dict[str, Any]]:
    metadata = {"day": day_index + 1, "trace_ordinal": trace_ordinal}
    correctness_label = label_from_thresholds(
        quality,
        (
            (0.82, "fully_correct"),
            (0.62, "mostly_correct"),
            (0.4, "partially_correct"),
            (0.0, "incorrect"),
        ),
    )
    outcome_labels = ("resolved", "answered", "handoff", "abandoned", "system_error")
    escalation_labels = (
        "none",
        "billing",
        "technical_complexity",
        "policy_exception",
        "customer_request",
        "security_review",
        "insufficient_context",
    )
    annotations = [
        make_annotation(
            name="end_to_end_correctness",
            target_key="trace_id",
            target_id=trace_id,
            annotator_kind="LLM",
            label=correctness_label,
            score=quality,
            explanation="End-to-end factual and procedural correctness.",
            metadata=metadata,
        ),
        make_annotation(
            name="task_outcome",
            target_key="trace_id",
            target_id=trace_id,
            annotator_kind="CODE",
            label="system_error" if is_error else outcome_labels[trace_ordinal % 4],
            explanation="Terminal outcome for the user request.",
            metadata=metadata,
        ),
        make_annotation(
            name="user_effort_score",
            target_key="trace_id",
            target_id=trace_id,
            annotator_kind="HUMAN",
            score=clamp(7.5 - quality * 6 + (trace_ordinal % 3) * 0.35, 1, 7),
            explanation="Customer effort score from 1–7; lower is better.",
            metadata=metadata,
        ),
        make_annotation(
            name="policy_compliance",
            target_key="trace_id",
            target_id=trace_id,
            annotator_kind="LLM",
            label="compliant" if quality >= 0.55 and not is_error else "non_compliant",
            score=clamp(quality + (0.08 if not is_error else -0.25)),
            explanation="Checks the complete interaction against support policy.",
            metadata=metadata,
        ),
        make_annotation(
            name="escalation_reason",
            target_key="trace_id",
            target_id=trace_id,
            annotator_kind="HUMAN",
            label=escalation_labels[(trace_ordinal + day_index) % len(escalation_labels)],
            explanation="Primary reason an interaction did or did not escalate.",
            metadata=metadata,
        ),
        make_annotation(
            name="business_value_index",
            target_key="trace_id",
            target_id=trace_id,
            annotator_kind="CODE",
            score=round(-1.5 + quality * 12 + 1.8 * math.sin(trace_ordinal / 5), 3),
            explanation="Synthetic business-value score with a non-unit, partially negative range.",
            metadata=metadata,
        ),
        make_annotation(
            name="response_language",
            target_key="trace_id",
            target_id=trace_id,
            annotator_kind="CODE",
            label=RESPONSE_LANGUAGE_DISTRIBUTION[
                trace_ordinal % len(RESPONSE_LANGUAGE_DISTRIBUTION)
            ],
            explanation="Detected response language with intentionally high label cardinality.",
            metadata=metadata,
        ),
    ]
    if trace_ordinal % 9 == 0:
        annotations.append(
            make_annotation(
                name="trace_canary_sparse",
                target_key="trace_id",
                target_id=trace_id,
                annotator_kind="CODE",
                label="triggered" if quality < 0.6 else "clear",
                score=clamp(1 - quality),
                explanation="Sparse trace-level canary result.",
                metadata=metadata,
            )
        )
    return annotations


def build_session_annotations(
    *,
    session_id: str,
    mean_quality: float,
    day_index: int,
    session_index: int,
) -> list[dict[str, Any]]:
    metadata = {"day": day_index + 1, "session_index": session_index}
    satisfaction_label = label_from_thresholds(
        mean_quality,
        (
            (0.85, "very_satisfied"),
            (0.68, "satisfied"),
            (0.5, "neutral"),
            (0.3, "dissatisfied"),
            (0.0, "very_dissatisfied"),
        ),
    )
    resolution_labels = ("resolved", "partially_resolved", "escalated", "abandoned")
    quality_labels = ("excellent", "coherent", "uneven", "confusing")
    tier_labels = ("free", "standard", "professional", "enterprise", "strategic")
    channel_labels = ("web", "mobile", "email", "voice", "api", "multi_channel")
    churn_risk = clamp(1 - mean_quality + session_index * 0.04)
    return [
        make_annotation(
            name="session_satisfaction",
            target_key="session_id",
            target_id=session_id,
            annotator_kind="HUMAN",
            label=satisfaction_label,
            score=mean_quality,
            explanation="Overall satisfaction across the complete conversation.",
            metadata=metadata,
        ),
        make_annotation(
            name="resolution_status",
            target_key="session_id",
            target_id=session_id,
            annotator_kind="CODE",
            label=resolution_labels[(day_index + session_index) % len(resolution_labels)],
            explanation="Final resolution state for the session.",
            metadata=metadata,
        ),
        make_annotation(
            name="conversation_quality",
            target_key="session_id",
            target_id=session_id,
            annotator_kind="LLM",
            label=quality_labels[min(len(quality_labels) - 1, int((1 - mean_quality) * 4))],
            score=mean_quality,
            explanation="Conversation-level coherence and usefulness assessment.",
            metadata=metadata,
        ),
        make_annotation(
            name="turns_to_resolution",
            target_key="session_id",
            target_id=session_id,
            annotator_kind="CODE",
            score=float(2 + (day_index + session_index * 2) % 11),
            explanation="Number of conversational turns required to reach an outcome.",
            metadata=metadata,
        ),
        make_annotation(
            name="churn_risk",
            target_key="session_id",
            target_id=session_id,
            annotator_kind="LLM",
            label=label_from_thresholds(
                churn_risk,
                ((0.67, "high"), (0.34, "medium"), (0.0, "low")),
            ),
            score=churn_risk,
            explanation="Estimated risk that the user disengages after this session.",
            metadata=metadata,
        ),
        make_annotation(
            name="customer_tier",
            target_key="session_id",
            target_id=session_id,
            annotator_kind="HUMAN",
            label=tier_labels[(day_index + session_index) % len(tier_labels)],
            explanation="Customer segment associated with the session.",
            metadata=metadata,
        ),
        make_annotation(
            name="channel_mix",
            target_key="session_id",
            target_id=session_id,
            annotator_kind="CODE",
            label=channel_labels[(day_index * 2 + session_index) % len(channel_labels)],
            explanation="Primary interaction channel or channel combination.",
            metadata=metadata,
        ),
    ]


def build_project_fixture(
    *,
    now: datetime,
    random_generator: random.Random,
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    spans: list[dict[str, Any]] = []
    span_annotations: list[dict[str, Any]] = []
    trace_annotations: list[dict[str, Any]] = []
    session_annotations: list[dict[str, Any]] = []
    run_id = now.strftime("%Y%m%dT%H%M%SZ")
    completed_day = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    first_day = completed_day - timedelta(days=DAY_COUNT - 1)
    trace_ordinal = 0
    model_configs = (
        ("openai", "gpt-4o", 0.0000025, 0.00001),
        ("anthropic", "claude-3-5-sonnet", 0.000003, 0.000015),
        ("google", "gemini-2.5-pro", 0.00000125, 0.00001),
        ("openai", "gpt-4o-mini", 0.00000015, 0.0000006),
        ("mistralai", "mistral-large", 0.000002, 0.000006),
    )

    for day_index in range(DAY_COUNT):
        day_start = first_day + timedelta(days=day_index, hours=7)
        trend = day_index / (DAY_COUNT - 1)
        for session_index in range(SESSIONS_PER_DAY):
            session_id = f"maximalist-{run_id}-{day_index:02d}-{session_index:02d}"
            session_qualities: list[float] = []
            for turn_index in range(TRACES_PER_SESSION):
                trace_ordinal += 1
                trace_id = uuid.uuid4().hex
                root_span_id = uuid.uuid4().hex[:16]
                retriever_span_id = uuid.uuid4().hex[:16]
                guardrail_span_id = uuid.uuid4().hex[:16]
                tool_span_id = uuid.uuid4().hex[:16]
                llm_span_id = uuid.uuid4().hex[:16]
                start_time = day_start + timedelta(
                    hours=session_index * 3,
                    minutes=turn_index * 35 + (day_index * 7 + session_index * 11) % 25,
                )
                quality = clamp(
                    0.25
                    + trend * 0.58
                    + 0.11 * math.sin(day_index * 0.72 + session_index)
                    + random_generator.gauss(0, 0.1)
                )
                latency_seconds = max(
                    2.2,
                    8.8
                    - trend * 4.1
                    + 1.4 * math.sin(trace_ordinal / 6)
                    + random_generator.gauss(0, 0.65),
                )
                is_error = trace_ordinal % 17 == 0 or random_generator.random() < 0.055
                tool_is_error = trace_ordinal % 13 == 0
                llm_is_error = is_error and trace_ordinal % 2 == 0
                end_time = start_time + timedelta(seconds=latency_seconds)
                session_qualities.append(quality)

                provider, model_name, prompt_rate, completion_rate = model_configs[
                    trace_ordinal % len(model_configs)
                ]
                prompt_tokens = max(
                    180,
                    int(1100 - trend * 260 + 210 * math.sin(trace_ordinal / 8)),
                )
                completion_tokens = max(
                    80,
                    int(430 - trend * 90 + 85 * math.cos(trace_ordinal / 7)),
                )
                cache_read_tokens = int(prompt_tokens * (0.08 + (trace_ordinal % 4) * 0.07))
                cache_write_tokens = int(prompt_tokens * (0.04 + (trace_ordinal % 3) * 0.025))
                prompt_image_tokens = int(prompt_tokens * 0.12) if trace_ordinal % 5 == 0 else 0
                prompt_audio_tokens = int(prompt_tokens * 0.08) if trace_ordinal % 11 == 0 else 0
                reasoning_tokens = int(completion_tokens * 0.22) if trace_ordinal % 3 == 0 else 0
                prompt_cost = prompt_tokens * prompt_rate
                completion_cost = completion_tokens * completion_rate

                common_attributes = {
                    "session.id": session_id,
                    "user.id": f"user-{(day_index * 3 + session_index) % 37:02d}",
                    "metadata": json.dumps(
                        {
                            "fixture": "project-metrics-maximalist",
                            "day": day_index + 1,
                            "cohort": f"cohort-{session_index + 1}",
                        }
                    ),
                }
                root_attributes = {
                    **common_attributes,
                    "openinference.span.kind": "AGENT",
                    "input.value": (
                        f"Support request {trace_ordinal}: investigate the account issue"
                    ),
                    "input.mime_type": "text/plain",
                    "output.value": "A complete support response with evidence and next steps.",
                    "output.mime_type": "text/plain",
                }
                llm_attributes = {
                    **common_attributes,
                    "openinference.span.kind": "LLM",
                    "input.value": "Synthesize the retrieved evidence into a helpful answer.",
                    "output.value": "Here is the grounded answer and the recommended next action.",
                    "llm.provider": provider,
                    "llm.model_name": model_name,
                    "llm.token_count.prompt": prompt_tokens,
                    "llm.token_count.completion": completion_tokens,
                    "llm.token_count.total": prompt_tokens + completion_tokens,
                    "llm.token_count.prompt_details.cache_read": cache_read_tokens,
                    "llm.token_count.prompt_details.cache_write": cache_write_tokens,
                    "llm.token_count.prompt_details.image": prompt_image_tokens,
                    "llm.token_count.prompt_details.audio": prompt_audio_tokens,
                    "llm.token_count.completion_details.reasoning": reasoning_tokens,
                    "llm.cost.prompt": prompt_cost,
                    "llm.cost.completion": completion_cost,
                    "llm.cost.total": prompt_cost + completion_cost,
                }
                spans.extend(
                    [
                        {
                            "name": "support-agent",
                            "context": {"trace_id": trace_id, "span_id": root_span_id},
                            "span_kind": "AGENT",
                            "start_time": start_time.isoformat(),
                            "end_time": end_time.isoformat(),
                            "status_code": "ERROR" if is_error else "OK",
                            "status_message": "Synthetic upstream failure" if is_error else "",
                            "attributes": root_attributes,
                        },
                        {
                            "name": "retrieve-account-context",
                            "context": {"trace_id": trace_id, "span_id": retriever_span_id},
                            "parent_id": root_span_id,
                            "span_kind": "RETRIEVER",
                            "start_time": (start_time + timedelta(seconds=0.08)).isoformat(),
                            "end_time": (start_time + timedelta(seconds=0.46)).isoformat(),
                            "status_code": "OK",
                            "attributes": {
                                **common_attributes,
                                "openinference.span.kind": "RETRIEVER",
                                "input.value": "account policy product history",
                                "retrieval.documents.0.document.id": f"policy-{trace_ordinal % 12}",
                                "retrieval.documents.0.document.score": quality,
                                "retrieval.documents.1.document.id": (
                                    f"account-{trace_ordinal % 31}"
                                ),
                                "retrieval.documents.1.document.score": clamp(quality - 0.12),
                            },
                        },
                        {
                            "name": "check-response-policy",
                            "context": {"trace_id": trace_id, "span_id": guardrail_span_id},
                            "parent_id": root_span_id,
                            "span_kind": "GUARDRAIL",
                            "start_time": (start_time + timedelta(seconds=0.5)).isoformat(),
                            "end_time": (start_time + timedelta(seconds=0.68)).isoformat(),
                            "status_code": "OK",
                            "attributes": {
                                **common_attributes,
                                "openinference.span.kind": "GUARDRAIL",
                                "input.value": "candidate support response",
                                "output.value": "allow" if quality >= 0.35 else "review",
                            },
                        },
                        {
                            "name": (
                                "lookup-billing-record"
                                if trace_ordinal % 2
                                else "query-product-catalog"
                            ),
                            "context": {"trace_id": trace_id, "span_id": tool_span_id},
                            "parent_id": root_span_id,
                            "span_kind": "TOOL",
                            "start_time": (start_time + timedelta(seconds=0.72)).isoformat(),
                            "end_time": (start_time + timedelta(seconds=1.12)).isoformat(),
                            "status_code": "ERROR" if tool_is_error else "OK",
                            "status_message": "Synthetic tool timeout" if tool_is_error else "",
                            "attributes": {
                                **common_attributes,
                                "openinference.span.kind": "TOOL",
                                "tool.name": "billing_lookup"
                                if trace_ordinal % 2
                                else "catalog_query",
                                "tool.parameters": json.dumps({"account_id": trace_ordinal % 41}),
                                "input.value": json.dumps({"query": "current account state"}),
                                "output.value": json.dumps({"status": "found", "records": 3}),
                            },
                        },
                        {
                            "name": "generate-support-response",
                            "context": {"trace_id": trace_id, "span_id": llm_span_id},
                            "parent_id": root_span_id,
                            "span_kind": "LLM",
                            "start_time": (start_time + timedelta(seconds=1.18)).isoformat(),
                            "end_time": (end_time - timedelta(seconds=0.08)).isoformat(),
                            "status_code": "ERROR" if llm_is_error else "OK",
                            "status_message": "Synthetic model error" if llm_is_error else "",
                            "attributes": llm_attributes,
                        },
                    ]
                )
                span_annotations.extend(
                    build_span_annotations(
                        llm_span_id=llm_span_id,
                        tool_span_id=tool_span_id,
                        quality=quality,
                        latency_seconds=latency_seconds,
                        token_count=prompt_tokens + completion_tokens,
                        is_error=is_error or tool_is_error,
                        day_index=day_index,
                        trace_ordinal=trace_ordinal,
                    )
                )
                trace_annotations.extend(
                    build_trace_annotations(
                        trace_id=trace_id,
                        quality=quality,
                        is_error=is_error,
                        day_index=day_index,
                        trace_ordinal=trace_ordinal,
                    )
                )

            session_annotations.extend(
                build_session_annotations(
                    session_id=session_id,
                    mean_quality=sum(session_qualities) / len(session_qualities),
                    day_index=day_index,
                    session_index=session_index,
                )
            )

    return spans, span_annotations, trace_annotations, session_annotations


def wait_for_spans(
    *,
    phoenix_client: Client,
    trace_ids: Sequence[str],
    timeout_seconds: float = 60,
) -> None:
    expected_trace_ids = set(trace_ids)
    found_trace_ids: set[str] = set()
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        found_trace_ids.clear()
        for trace_id_chunk in chunked(trace_ids, 100):
            try:
                found_trace_ids.update(
                    span["context"]["trace_id"]
                    for span in phoenix_client.spans.get_spans(
                        project_identifier=PROJECT_NAME,
                        trace_ids=trace_id_chunk,
                        limit=len(trace_id_chunk) * 5,
                    )
                )
            except httpx.HTTPStatusError as error:
                if error.response.status_code != httpx.codes.NOT_FOUND:
                    raise
                break
        if found_trace_ids.issuperset(expected_trace_ids):
            return
        time.sleep(0.4)
    missing_count = len(expected_trace_ids - found_trace_ids)
    raise RuntimeError(f"Timed out waiting for {missing_count} traces to be inserted")


def delete_existing_project(phoenix_client: Client) -> None:
    try:
        phoenix_client.projects.get(project_name=PROJECT_NAME)
    except httpx.HTTPStatusError as error:
        if error.response.status_code == httpx.codes.NOT_FOUND:
            return
        raise
    print(f"Deleting existing project {PROJECT_NAME!r}...")
    phoenix_client.projects.delete(project_name=PROJECT_NAME)


def main() -> None:
    print(f"Generating maximalist project metrics fixture at {PHOENIX_URL}")
    phoenix_client = Client(base_url=PHOENIX_URL)
    delete_existing_project(phoenix_client)
    spans, span_annotations, trace_annotations, session_annotations = build_project_fixture(
        now=datetime.now(timezone.utc),
        random_generator=random.Random(DEFAULT_RANDOM_SEED),
    )
    trace_ids = list({span["context"]["trace_id"] for span in spans})

    print(f"Logging {len(spans)} spans across {len(trace_ids)} traces...")
    for span_chunk in chunked(spans, 100):
        phoenix_client.spans.log_spans(
            project_identifier=PROJECT_NAME,
            spans=span_chunk,
            timeout=30,
        )
    wait_for_spans(phoenix_client=phoenix_client, trace_ids=trace_ids)

    print(f"Logging {len(span_annotations)} span annotations...")
    for annotation_chunk in chunked(span_annotations, 500):
        phoenix_client.spans.log_span_annotations(
            span_annotations=annotation_chunk,
            sync=True,
        )
    print(f"Logging {len(trace_annotations)} trace annotations...")
    for annotation_chunk in chunked(trace_annotations, 500):
        phoenix_client.traces.log_trace_annotations(
            trace_annotations=annotation_chunk,
            sync=True,
        )
    print(f"Logging {len(session_annotations)} session annotations...")
    for annotation_chunk in chunked(session_annotations, 500):
        phoenix_client.sessions.log_session_annotations(
            session_annotations=annotation_chunk,
            sync=True,
        )

    project = phoenix_client.projects.get(project_name=PROJECT_NAME)
    print("\nMaximalist project metrics data ready:")
    print(f"project_name={PROJECT_NAME}")
    print(f"traces={len(trace_ids)}")
    print(f"spans={len(spans)}")
    print(f"span_annotations={len(span_annotations)}")
    print(f"trace_annotations={len(trace_annotations)}")
    print(f"session_annotations={len(session_annotations)}")
    print(f"metrics_url={PHOENIX_URL}/projects/{project['id']}/metrics")


if __name__ == "__main__":
    main()
