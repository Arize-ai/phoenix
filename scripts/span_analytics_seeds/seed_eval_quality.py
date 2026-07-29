"""Seed a deterministic quality-regression narrative into a Phoenix database.

Generates two projects of synthetic assistant traces whose *eval scores*,
not their error rates, are the measured quantity:

- ``assistant-quality`` — 24 hours of traces split by a prompt-version cut
  from ``pv-14`` to ``pv-15`` at the midpoint, every trace carrying a root
  span scored under the ``correctness`` annotation name.
- ``assistant-quality-dev`` — a decoy project with the same annotation
  names and different values, for verifying project isolation on the
  annotations grain.

**What the fixture engineers, said out loud.** The naive average of
``correctness`` drops about twelve points across the cut. Most of that drop
is not a quality change: it is a change in *who was measuring*. The LLM
judge scores every trace in both versions; the human reviewers scored a
tenth of ``pv-14`` and three quarters of ``pv-15``, concentrating on the
traces the judge scored lowest. Humans are harsher than the judge by
construction, so raising their share drags the blended mean down on its
own. Within each annotator kind the drop is four points — a real but modest
regression.

The two score populations are authored directly rather than simulated:
each kind's scores in each version cycle through a fixed symmetric offset
pattern around a target mean, so the per-kind means are exact. Which spans
the humans reviewed is what the version cut changes, and the answer key
prints the realized values computed from the generated records, special
rows included.

Also present, for semantics that only annotations can exercise:

- one trace whose root span carries three annotators in strong
  disagreement (0.92, 0.55, 0.15), one with an explanation long enough to
  be clipped to a preview;
- a ``tone`` annotation carrying labels and no scores at all, so
  ``avg(score)`` over it is NULL everywhere rather than zero;
- ``resolution`` annotations on traces and ``relevance`` annotations on
  retrieval documents, so ``target`` is a real dimension with more than one
  value.

LLM spans carry OpenInference input/output values and token counts; no cost
records are generated (the incident fixture covers cost).

The generator is a pure function of ``(--now, --seed)``: two runs produce
byte-identical data.

Usage:
    python scripts/span_analytics_seeds/seed_eval_quality.py --now 2026-07-29T12:00:00Z \
        [--seed 11] [--database-url sqlite:///path/to/phoenix.db] \
        [--migrate] [--replace] [--answer-key] [--dry-run]

Without ``--database-url`` the standard Phoenix environment configuration
is used. The target database is normally a running Phoenix's (no migration
attempted); ``--migrate`` initializes an empty database instead. Re-runs
require ``--replace``, which deletes and re-seeds this script's projects.
"""

from __future__ import annotations

import argparse
import asyncio
import random
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

MAIN_PROJECT_NAME = "assistant-quality"
DECOY_PROJECT_NAME = "assistant-quality-dev"

DEFAULT_SEED = 11

#: Hours per prompt version; the cut sits at ``--now`` minus this many.
HOURS_PER_VERSION = 12
TRACES_PER_HOUR = 20

OLD_VERSION = "pv-14"
NEW_VERSION = "pv-15"

TENANTS = ("northwind", "contoso", "fabrikam", "tailspin")
MODELS = ("gpt-4o", "claude-sonnet")

ROOT_SPAN_NAME = "answer_question"
LLM_SPAN_NAME = "generate_answer"
RETRIEVER_SPAN_NAME = "search_knowledge_base"

ANNOTATION_NAME = "correctness"
TONE_ANNOTATION_NAME = "tone"
TRACE_ANNOTATION_NAME = "resolution"
DOCUMENT_ANNOTATION_NAME = "relevance"

JUDGE_IDENTIFIER = "llm-judge"
HUMAN_IDENTIFIER = "human-reviewer"

#: Target mean of each annotator kind's scores, per version. The per-kind
#: regression is four points in both kinds; everything larger that shows up
#: in a blended average is composition, not quality.
JUDGE_MEANS = {OLD_VERSION: 0.80, NEW_VERSION: 0.76}
HUMAN_MEANS = {OLD_VERSION: 0.56, NEW_VERSION: 0.52}

#: Symmetric offsets applied around each target mean, cycled in order.
#: They sum to zero, so any population whose size is a multiple of four
#: realizes its target mean exactly.
SCORE_OFFSETS = (-0.20, -0.08, 0.08, 0.20)

#: How many of each version's traces the humans reviewed. The shift from a
#: tenth to three quarters is the artifact the demo exists to expose.
HUMAN_REVIEW_COUNTS = {OLD_VERSION: 24, NEW_VERSION: 180}

#: Score at or above which an annotation is labeled 'correct'.
CORRECT_THRESHOLD = 0.5

#: Every nth trace gets a retriever span with two documents.
RETRIEVER_EVERY = 40
DOCUMENTS_PER_RETRIEVER = 2

#: Every nth root span carries a label-only 'tone' annotation.
TONE_EVERY = 12

#: Every nth trace carries a trace-level 'resolution' annotation.
TRACE_ANNOTATION_EVERY = 16

LONG_EXPLANATION_CHARS = 1_200

QUESTIONS = (
    "How do I change the billing address on my account?",
    "Why was my subscription downgraded last night?",
    "Can you explain the difference between the team and business plans?",
    "My export finished but the file is empty — what happened?",
    "How long does a refund take to appear on the statement?",
)


@dataclass
class SpanRecord:
    span_id: str
    trace_id: str
    parent_id: Optional[str]
    name: str
    span_kind: str
    start_time: datetime
    end_time: datetime
    attributes: dict[str, Any]
    status_code: str

    @property
    def latency_ms(self) -> float:
        return (self.end_time - self.start_time).total_seconds() * 1000


@dataclass
class TraceRecord:
    trace_id: str
    start_time: datetime
    end_time: datetime
    prompt_version: str


@dataclass
class AnnotationRecord:
    """One annotation, on whichever target it belongs to.

    ``target`` is 'span', 'trace', or 'document'; ``target_key`` is the
    span id or trace id it attaches to, and ``document_position`` is set
    only for document annotations.
    """

    target: str
    target_key: str
    name: str
    score: Optional[float]
    label: Optional[str]
    explanation: Optional[str]
    annotator_kind: str
    identifier: str
    document_position: Optional[int] = None


@dataclass
class ProjectData:
    name: str
    traces: list[TraceRecord] = field(default_factory=list)
    spans: list[SpanRecord] = field(default_factory=list)
    annotations: list[AnnotationRecord] = field(default_factory=list)


@dataclass
class EvalQuality:
    now: datetime
    seed: int
    main: ProjectData
    decoy: ProjectData
    cut: datetime


def _label(score: Optional[float]) -> Optional[str]:
    if score is None:
        return None
    return "correct" if score >= CORRECT_THRESHOLD else "incorrect"


def _scores_around(mean: float, count: int) -> list[float]:
    """``count`` scores cycling the symmetric offsets around ``mean``.

    Rounded to two decimals, which the offsets preserve exactly; for counts
    that are a multiple of the offset cycle the realized mean is the target.
    """
    return [round(mean + SCORE_OFFSETS[index % len(SCORE_OFFSETS)], 2) for index in range(count)]


def _build_project(
    rng: random.Random,
    name: str,
    now: datetime,
    id_prefix: str,
    versions: tuple[str, str],
    tenants: tuple[str, ...],
    models: tuple[str, ...],
    hours_per_version: int,
) -> ProjectData:
    """Build one project's traces and spans, oldest first."""
    project = ProjectData(name=name)
    total_hours = hours_per_version * 2
    counter = 0
    for hour_index in range(total_hours):
        hour_start = now - timedelta(hours=total_hours - hour_index)
        version = versions[0] if hour_index < hours_per_version else versions[1]
        for slot in range(TRACES_PER_HOUR):
            counter += 1
            trace_id = f"{id_prefix}t{counter:014x}"
            root_id = f"{id_prefix}{counter * 4:015x}"
            llm_id = f"{id_prefix}{counter * 4 + 1:015x}"
            start = hour_start + timedelta(seconds=slot * (3600 // TRACES_PER_HOUR))
            latency_ms = rng.randint(400, 2_600)
            end = start + timedelta(milliseconds=latency_ms)
            question = QUESTIONS[counter % len(QUESTIONS)]
            tenant = tenants[counter % len(tenants)]
            model = models[counter % len(models)]
            project.traces.append(
                TraceRecord(
                    trace_id=trace_id, start_time=start, end_time=end, prompt_version=version
                )
            )
            project.spans.append(
                SpanRecord(
                    span_id=root_id,
                    trace_id=trace_id,
                    parent_id=None,
                    name=ROOT_SPAN_NAME,
                    span_kind="AGENT",
                    start_time=start,
                    end_time=end,
                    attributes={
                        "input": {"value": question},
                        "output": {"value": f"Here is what I found about that ({version})."},
                        "metadata": {"prompt_version": version, "tenant": tenant},
                    },
                    status_code="OK",
                )
            )
            llm_start = start + timedelta(milliseconds=latency_ms // 4)
            project.spans.append(
                SpanRecord(
                    span_id=llm_id,
                    trace_id=trace_id,
                    parent_id=root_id,
                    name=LLM_SPAN_NAME,
                    span_kind="LLM",
                    start_time=llm_start,
                    end_time=end,
                    attributes={
                        "input": {"value": question},
                        "output": {"value": "Here is what I found about that."},
                        "llm": {
                            "model_name": model,
                            "token_count": {"total": rng.randint(300, 1_800)},
                        },
                        "metadata": {"prompt_version": version, "tenant": tenant},
                    },
                    status_code="OK",
                )
            )
            if counter % RETRIEVER_EVERY == 0:
                retriever_id = f"{id_prefix}{counter * 4 + 2:015x}"
                project.spans.append(
                    SpanRecord(
                        span_id=retriever_id,
                        trace_id=trace_id,
                        parent_id=root_id,
                        name=RETRIEVER_SPAN_NAME,
                        span_kind="RETRIEVER",
                        start_time=start,
                        end_time=llm_start,
                        attributes={
                            "input": {"value": question},
                            "retrieval": {
                                "documents": [
                                    {
                                        "document": {
                                            "id": f"doc-{counter}-{position}",
                                            "content": (
                                                f"Knowledge base article {counter}-{position}."
                                            ),
                                        }
                                    }
                                    for position in range(DOCUMENTS_PER_RETRIEVER)
                                ]
                            },
                            "metadata": {"prompt_version": version, "tenant": tenant},
                        },
                        status_code="OK",
                    )
                )
    return project


def _root_spans_by_version(project: ProjectData) -> dict[str, list[SpanRecord]]:
    version_by_trace = {trace.trace_id: trace.prompt_version for trace in project.traces}
    grouped: dict[str, list[SpanRecord]] = defaultdict(list)
    for span in project.spans:
        if span.name == ROOT_SPAN_NAME:
            grouped[version_by_trace[span.trace_id]].append(span)
    return grouped


def _build_correctness_annotations(project: ProjectData, versions: tuple[str, str]) -> None:
    """Score every root span with the judge, a subset with humans.

    The judge covers everything in both versions. The humans review a tenth
    of the old version and three quarters of the new one, chosen as the
    traces the judge scored lowest — the concentration on failures that
    makes the reviewer share move. Each kind's scores are authored around
    its own per-version target, so the human mean is a property of the
    fixture rather than of which spans were selected.
    """
    grouped = _root_spans_by_version(project)
    for version in versions:
        root_spans = grouped[version]
        judge_scores = _scores_around(JUDGE_MEANS[version], len(root_spans))
        for span, score in zip(root_spans, judge_scores):
            project.annotations.append(
                AnnotationRecord(
                    target="span",
                    target_key=span.span_id,
                    name=ANNOTATION_NAME,
                    score=score,
                    label=_label(score),
                    explanation=(
                        f"The answer under {version} addressed the question and cited the "
                        "right article."
                        if score >= CORRECT_THRESHOLD
                        else f"The answer under {version} missed the account context and "
                        "cited an unrelated article."
                    ),
                    annotator_kind="LLM",
                    identifier=JUDGE_IDENTIFIER,
                )
            )
        # Reviewers work the judge's worst traces first; ties break on span
        # id so the selection is deterministic on both backends.
        reviewed = sorted(
            zip(root_spans, judge_scores), key=lambda pair: (pair[1], pair[0].span_id)
        )[: HUMAN_REVIEW_COUNTS[version]]
        human_scores = _scores_around(HUMAN_MEANS[version], len(reviewed))
        for (span, _), score in zip(reviewed, human_scores):
            project.annotations.append(
                AnnotationRecord(
                    target="span",
                    target_key=span.span_id,
                    name=ANNOTATION_NAME,
                    score=score,
                    label=_label(score),
                    explanation=(
                        "Reviewed after the judge flagged it; the answer is usable but "
                        "vague about the billing cycle."
                    ),
                    annotator_kind="HUMAN",
                    identifier=HUMAN_IDENTIFIER,
                )
            )


def _apply_special_rows(project: ProjectData, now: datetime, versions: tuple[str, str]) -> None:
    """The rows that exercise semantics the bulk population cannot.

    They are added after the engineered populations, so the answer key's
    realized means differ slightly from the target means — deliberately:
    the key is computed from the records, never from the design intent.
    """
    grouped = _root_spans_by_version(project)

    # Three annotators, one span, strong disagreement — and an explanation
    # long enough that a row query clips it to a preview. The judge's row
    # comes from the bulk population above (uniqueness is name + span +
    # identifier, so a second judge row under the same identifier would be
    # rejected by the database, not merely redundant); these two reviewers
    # are what turn its score into a disagreement.
    disputed = grouped[versions[1]][-1]
    for identifier, kind, score, explanation in (
        (
            "human-reviewer-a",
            "HUMAN",
            0.15,
            "The answer is confidently wrong: it describes the legacy refund window, "
            "which changed two releases ago, and the customer would act on it. "
            + "Detail: "
            * (LONG_EXPLANATION_CHARS // 8),
        ),
        (
            "human-reviewer-b",
            "HUMAN",
            0.55,
            "Partially correct — right article, wrong emphasis.",
        ),
    ):
        project.annotations.append(
            AnnotationRecord(
                target="span",
                target_key=disputed.span_id,
                name=ANNOTATION_NAME,
                score=score,
                label=_label(score),
                explanation=explanation,
                annotator_kind=kind,
                identifier=identifier,
            )
        )

    # A label-only annotation: no scores anywhere under this name, so an
    # average over it is NULL rather than zero.
    for version in versions:
        for index, span in enumerate(grouped[version]):
            if index % TONE_EVERY:
                continue
            project.annotations.append(
                AnnotationRecord(
                    target="span",
                    target_key=span.span_id,
                    name=TONE_ANNOTATION_NAME,
                    score=None,
                    label="warm" if index % (TONE_EVERY * 2) == 0 else "curt",
                    explanation=None,
                    annotator_kind="CODE",
                    identifier="tone-classifier",
                )
            )

    # Trace- and document-target annotations, so `target` has more than one
    # value and the polymorphic grain is exercised by real rows.
    for index, trace in enumerate(project.traces):
        if index % TRACE_ANNOTATION_EVERY:
            continue
        score = 1.0 if index % (TRACE_ANNOTATION_EVERY * 2) == 0 else 0.0
        project.annotations.append(
            AnnotationRecord(
                target="trace",
                target_key=trace.trace_id,
                name=TRACE_ANNOTATION_NAME,
                score=score,
                label="resolved" if score else "unresolved",
                explanation=None,
                annotator_kind="CODE",
                identifier="resolution-checker",
            )
        )
    for span in project.spans:
        if span.name != RETRIEVER_SPAN_NAME:
            continue
        for position in range(DOCUMENTS_PER_RETRIEVER):
            score = 0.9 if position == 0 else 0.3
            project.annotations.append(
                AnnotationRecord(
                    target="document",
                    target_key=span.span_id,
                    name=DOCUMENT_ANNOTATION_NAME,
                    score=score,
                    label="relevant" if score >= CORRECT_THRESHOLD else "irrelevant",
                    explanation=None,
                    annotator_kind="LLM",
                    identifier="relevance-judge",
                    document_position=position,
                )
            )
    del now


def build_eval_quality(now: datetime, seed: int = DEFAULT_SEED) -> EvalQuality:
    """Build the full dataset. Pure function of (now, seed)."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)
    rng = random.Random(seed)
    versions = (OLD_VERSION, NEW_VERSION)
    main = _build_project(
        rng,
        name=MAIN_PROJECT_NAME,
        now=now,
        id_prefix="c",
        versions=versions,
        tenants=TENANTS,
        models=MODELS,
        hours_per_version=HOURS_PER_VERSION,
    )
    _build_correctness_annotations(main, versions)
    _apply_special_rows(main, now, versions)
    decoy = _build_project(
        rng,
        name=DECOY_PROJECT_NAME,
        now=now,
        id_prefix="d",
        versions=versions,
        tenants=("wayne", "tyrell"),
        models=("gpt-4o-mini",),
        hours_per_version=2,
    )
    # The decoy carries the same annotation name with unmistakably
    # different values, so a leak across projects shows up as a wrong
    # number rather than as an empty result.
    for span in decoy.spans:
        if span.name != ROOT_SPAN_NAME:
            continue
        decoy.annotations.append(
            AnnotationRecord(
                target="span",
                target_key=span.span_id,
                name=ANNOTATION_NAME,
                score=0.01,
                label="incorrect",
                explanation="Decoy project annotation.",
                annotator_kind="LLM",
                identifier="decoy-judge",
            )
        )
    return EvalQuality(
        now=now,
        seed=seed,
        main=main,
        decoy=decoy,
        cut=now - timedelta(hours=HOURS_PER_VERSION),
    )


def _mean(values: list[float]) -> Optional[float]:
    return sum(values) / len(values) if values else None


def correctness_ground_truth(data: EvalQuality) -> dict[str, dict[str, Any]]:
    """The three means of ``correctness``, per version, computed from records.

    They are three different questions, and they do not agree:

    - ``by_kind`` — the mean per annotator kind, the decomposed truth.
    - ``annotation_weighted`` — the mean over annotation rows, which is what
      the annotations grain computes and what the annotator mix moves.
    - ``span_reduced`` — the mean over spans of each span's own mean, which
      is what the spans grain's declared reduction computes.
    """
    version_by_trace = {trace.trace_id: trace.prompt_version for trace in data.main.traces}
    trace_by_span = {span.span_id: span.trace_id for span in data.main.spans}
    result: dict[str, dict[str, Any]] = {}
    for version in (OLD_VERSION, NEW_VERSION):
        scores_by_kind: dict[str, list[float]] = defaultdict(list)
        by_span: dict[str, list[float]] = defaultdict(list)
        for annotation in data.main.annotations:
            if annotation.target != "span" or annotation.name != ANNOTATION_NAME:
                continue
            if annotation.score is None:
                continue
            if version_by_trace[trace_by_span[annotation.target_key]] != version:
                continue
            scores_by_kind[annotation.annotator_kind].append(annotation.score)
            by_span[annotation.target_key].append(annotation.score)
        every = [score for scores in scores_by_kind.values() for score in scores]
        result[version] = {
            "annotations": len(every),
            "by_kind": {kind: _mean(scores) for kind, scores in sorted(scores_by_kind.items())},
            "counts_by_kind": {
                kind: len(scores) for kind, scores in sorted(scores_by_kind.items())
            },
            "annotation_weighted": _mean(every),
            "span_reduced": _mean([sum(s) / len(s) for s in by_span.values()]),
            "spans_scored": len(by_span),
        }
    return result


def render_ground_truth(data: EvalQuality) -> str:
    """The answer key: deterministic text derived from the generated records."""
    truth = correctness_ground_truth(data)
    old, new = truth[OLD_VERSION], truth[NEW_VERSION]
    lines = [
        "GROUND TRUTH — assistant-quality",
        f"cut at {data.cut.isoformat()} ({OLD_VERSION} before, {NEW_VERSION} after)",
        "",
        "correctness, three ways:",
    ]
    for label, key in (
        ("annotation-weighted (annotations grain)", "annotation_weighted"),
        ("span-reduced mean (spans grain)", "span_reduced"),
    ):
        delta = (new[key] - old[key]) * 100
        lines.append(f"  {label}: {old[key]:.4f} -> {new[key]:.4f}  ({delta:+.2f} points)")
    for kind in sorted(set(old["by_kind"]) | set(new["by_kind"])):
        old_value, new_value = old["by_kind"].get(kind), new["by_kind"].get(kind)
        if old_value is None or new_value is None:
            continue
        delta = (new_value - old_value) * 100
        lines.append(
            f"  kind {kind}: {old_value:.4f} -> {new_value:.4f}  ({delta:+.2f} points), "
            f"n {old['counts_by_kind'][kind]} -> {new['counts_by_kind'][kind]}"
        )
    lines += [
        "",
        f"scored spans: {old['spans_scored']} -> {new['spans_scored']}",
        f"scored annotations: {old['annotations']} -> {new['annotations']}",
        "",
    ]
    targets = Counter(annotation.target for annotation in data.main.annotations)
    names = Counter(annotation.name for annotation in data.main.annotations)
    lines.append(f"annotations by target: {dict(sorted(targets.items()))}")
    lines.append(f"annotations by name: {dict(sorted(names.items()))}")
    disputed = [
        annotation
        for annotation in data.main.annotations
        if annotation.name == ANNOTATION_NAME and annotation.identifier == "human-reviewer-b"
    ]
    if disputed:
        span_id = disputed[0].target_key
        scores = sorted(
            annotation.score
            for annotation in data.main.annotations
            if annotation.target_key == span_id
            and annotation.name == ANNOTATION_NAME
            and annotation.score is not None
        )
        lines.append(f"three-annotator disagreement on span {span_id}: scores {scores}")
    lines.append(
        f"label-only annotation name {TONE_ANNOTATION_NAME!r}: "
        f"{names[TONE_ANNOTATION_NAME]} rows, no scores"
    )
    return "\n".join(lines)


async def insert_eval_quality(session: Any, data: EvalQuality) -> None:
    """Insert both projects with plain ORM-table inserts.

    ``session`` is an ``AsyncSession`` bound to a migrated Phoenix
    database (either backend).
    """
    from sqlalchemy import insert, select

    from phoenix.db import models

    for project_data in (data.main, data.decoy):
        project_rowid = await session.scalar(
            insert(models.Project).values(name=project_data.name).returning(models.Project.id)
        )
        await session.execute(
            insert(models.Trace),
            [
                {
                    "project_rowid": project_rowid,
                    "trace_id": trace.trace_id,
                    "start_time": trace.start_time,
                    "end_time": trace.end_time,
                }
                for trace in project_data.traces
            ],
        )
        trace_rowids = dict(
            (
                await session.execute(
                    select(models.Trace.trace_id, models.Trace.id).where(
                        models.Trace.project_rowid == project_rowid
                    )
                )
            ).all()
        )
        await session.execute(
            insert(models.Span),
            [
                {
                    "span_id": span.span_id,
                    "trace_rowid": trace_rowids[span.trace_id],
                    "parent_id": span.parent_id,
                    "name": span.name,
                    "span_kind": span.span_kind,
                    "start_time": span.start_time,
                    "end_time": span.end_time,
                    "attributes": span.attributes,
                    "events": [],
                    "status_code": span.status_code,
                    "status_message": "",
                    "cumulative_error_count": 0,
                    "cumulative_llm_token_count_prompt": 0,
                    "cumulative_llm_token_count_completion": 0,
                }
                for span in project_data.spans
            ],
        )
        span_rowids = dict(
            (
                await session.execute(
                    select(models.Span.span_id, models.Span.id)
                    .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                    .where(models.Trace.project_rowid == project_rowid)
                )
            ).all()
        )
        common: dict[str, Any] = {"metadata_": {}, "source": "API", "user_id": None}
        span_annotations = [a for a in project_data.annotations if a.target == "span"]
        if span_annotations:
            await session.execute(
                insert(models.SpanAnnotation),
                [
                    {
                        "span_rowid": span_rowids[annotation.target_key],
                        "name": annotation.name,
                        "label": annotation.label,
                        "score": annotation.score,
                        "explanation": annotation.explanation,
                        "annotator_kind": annotation.annotator_kind,
                        "identifier": annotation.identifier,
                        **common,
                    }
                    for annotation in span_annotations
                ],
            )
        trace_annotations = [a for a in project_data.annotations if a.target == "trace"]
        if trace_annotations:
            await session.execute(
                insert(models.TraceAnnotation),
                [
                    {
                        "trace_rowid": trace_rowids[annotation.target_key],
                        "name": annotation.name,
                        "label": annotation.label,
                        "score": annotation.score,
                        "explanation": annotation.explanation,
                        "annotator_kind": annotation.annotator_kind,
                        "identifier": annotation.identifier,
                        **common,
                    }
                    for annotation in trace_annotations
                ],
            )
        document_annotations = [a for a in project_data.annotations if a.target == "document"]
        if document_annotations:
            await session.execute(
                insert(models.DocumentAnnotation),
                [
                    {
                        "span_rowid": span_rowids[annotation.target_key],
                        "document_position": annotation.document_position,
                        "name": annotation.name,
                        "label": annotation.label,
                        "score": annotation.score,
                        "explanation": annotation.explanation,
                        "annotator_kind": annotation.annotator_kind,
                        "identifier": annotation.identifier,
                        **common,
                    }
                    for annotation in document_annotations
                ],
            )


async def open_seed_engine(connection_str: str, migrate: bool) -> Any:
    """Open the target database, initializing the schema only on request.

    Running migrations unconditionally fails against a database a running
    Phoenix owns: SQLite holds a write lock, and the PostgreSQL migration
    path takes an advisory lock a live server can contend for. Seeding
    targets are usually live servers, so the default probes for an
    existing migrated schema (the ``alembic_version`` table) and skips
    migration entirely; ``--migrate`` opts in for an empty database.
    """
    import sqlalchemy

    from phoenix.db.engines import create_engine

    engine = create_engine(connection_str, migrate=False)
    async with engine.connect() as connection:
        tables = await connection.run_sync(
            lambda sync_connection: sqlalchemy.inspect(sync_connection).get_table_names()
        )
    if "alembic_version" in tables:
        return engine
    if not migrate:
        await engine.dispose()
        raise SystemExit(
            "The target database has no Phoenix schema. Start Phoenix against it "
            "first, or pass --migrate to initialize an empty database."
        )
    await engine.dispose()
    return create_engine(connection_str, migrate=True)


async def replace_or_reject_existing(session: Any, names: list[str], replace: bool) -> None:
    """Delete this script's projects when ``--replace`` is given; otherwise
    refuse to seed alongside an existing copy, which would silently double
    every count."""
    from sqlalchemy import delete, select

    from phoenix.db import models

    existing = list(
        (
            await session.execute(select(models.Project.name).where(models.Project.name.in_(names)))
        ).scalars()
    )
    if not existing:
        return
    if not replace:
        raise SystemExit(
            f"Project(s) already exist: {', '.join(sorted(existing))}. "
            "Pass --replace to delete and re-seed them."
        )
    await session.execute(delete(models.Project).where(models.Project.name.in_(existing)))


def _print_confirmation(data: EvalQuality, wrote: bool) -> None:
    for project_data in (data.main, data.decoy):
        print(
            f'{"Seeded" if wrote else "Would seed"} project "{project_data.name}": '
            f"{len(project_data.spans)} spans, {len(project_data.traces)} traces, "
            f"{len(project_data.annotations)} annotations"
        )
    if wrote:
        print("Open the Phoenix UI and check that both projects appear.")


async def _main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--now",
        required=True,
        help="Anchor timestamp, ISO-8601 (e.g. 2026-07-29T12:00:00Z); naive means UTC.",
    )
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument(
        "--database-url",
        default=None,
        help="SQLAlchemy database URL; defaults to the Phoenix environment configuration.",
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help=(
            "Initialize the Phoenix schema if the database is empty. Off by default: "
            "seeding a running Phoenix must not attempt migrations against a "
            "database the server owns."
        ),
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete this script's projects (if present) and re-seed them.",
    )
    parser.add_argument(
        "--answer-key",
        action="store_true",
        help=(
            "Print the ground-truth answer key. Off by default: reading it before "
            "investigating the data spoils the exercise."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build the dataset and print the confirmation without writing anywhere.",
    )
    args = parser.parse_args()
    now = datetime.fromisoformat(str(args.now).replace("Z", "+00:00"))
    data = build_eval_quality(now, int(args.seed))

    if not args.dry_run:
        from sqlalchemy.ext.asyncio import AsyncSession

        from phoenix.config import get_env_database_connection_str

        connection_str = args.database_url or get_env_database_connection_str()
        engine = await open_seed_engine(connection_str, migrate=bool(args.migrate))
        async with AsyncSession(engine) as session:
            async with session.begin():
                await replace_or_reject_existing(
                    session,
                    [data.main.name, data.decoy.name],
                    replace=bool(args.replace),
                )
                await insert_eval_quality(session, data)
        await engine.dispose()

    _print_confirmation(data, wrote=not args.dry_run)
    if args.answer_key:
        print()
        print(render_ground_truth(data))


if __name__ == "__main__":
    asyncio.run(_main())
