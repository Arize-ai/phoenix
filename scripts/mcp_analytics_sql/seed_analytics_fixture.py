#!/usr/bin/env python3
"""Seed a database whose shape makes wrong analytics answers visibly wrong.

Why this exists
---------------
Real telemetry is accidental. Whatever happened to be traced is whatever you can
query, and that is a poor basis for judging whether an analytics surface works,
because a naive query and a correct query usually return the same thing. When
they agree by luck, a passing test proves nothing.

So this fixture is built backwards from the failure modes. Every trap the surface
is known to have gets data where **the naive answer and the correct answer differ
by an unmistakable margin**, and the script prints both. A harness can then assert
on the correct value and, more usefully, detect the specific wrong value that says
which trap was fallen into. A result that is merely "wrong" tells you little; a
result that is exactly the multi-counted total tells you the grain was misread.

Two consequences of that principle shape everything below.

Margins are large and non-overlapping. Where a trap inflates a number the
inflation is several-fold, not a few percent, so it cannot be mistaken for
rounding, sampling or a different-but-defensible interpretation.

Rankings flip, not just totals. Several traps -- the injected time window most of
all -- do not merely change a number, they change *which row wins*. A "which X is
biggest" question is where dropped rows reorder the answer instead of shrinking
it, and that is the failure a caller is least likely to notice. Wherever a trap
can be made to change the winner, it is.

What it does not do
-------------------
It does not attempt realism. Token counts, latencies and names are chosen to be
recognisable in a result set, not plausible. Anyone reading `999_000` in an
answer should immediately suspect the fixture rather than wonder about the data.

Usage
-----
    python scripts/mcp_analytics_sql/seed_analytics_fixture.py \\
        --url sqlite+aiosqlite:///./fixture.db --oracle oracle.json

    python scripts/mcp_analytics_sql/seed_analytics_fixture.py \\
        --url postgresql+asyncpg://user:pass@localhost/phoenix

Both backends are seeded through the ORM, so the same fixture and the same oracle
apply to each. That matters: a per-dialect fixture could not be used to check that
the two backends answer identically, which is one of the things worth checking.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker  # noqa: E402

from phoenix.db import models  # noqa: E402
from phoenix.db.engines import create_engine  # noqa: E402

# A fixed reference point rather than "now". Time-window behaviour is one of the
# things under test, so the data cannot drift relative to the boundary between
# runs -- an oracle that changes depending on when it was generated is not an
# oracle.
NOW = datetime(2026, 8, 1, 12, 0, 0, tzinfo=timezone.utc)

# The surface injects a seven-day window when the caller supplies none. Data is
# placed deliberately on both sides of it.
DEFAULT_WINDOW_START = NOW - timedelta(days=7)

INSIDE_WINDOW = NOW - timedelta(days=2)
OUTSIDE_WINDOW = NOW - timedelta(days=30)

# Fixed durations for the two workload span layers that are not drawn at random.
# They are named rather than written inline because the latency oracle has to
# cover exactly the spans a query would see: when these were literals, the oracle
# was computed over the sampled children alone and published a p95 that no query
# against the project could return.
ROOT_DURATION_MS = 900
GRANDCHILD_DURATION_MS = 30

PREFIX = "fixture"


def _name(*parts: str) -> str:
    return "-".join((PREFIX, *parts))


class Seeder:
    """Builds the fixture and records what each trap should and should not return."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.oracle: dict[str, Any] = {}

    async def run(self) -> dict[str, Any]:
        await self.purge()
        await self.seed_token_grain_trap()
        await self.seed_wide_date_range()
        await self.seed_promotion_gap_trap()
        await self.seed_attribute_shape_traps()
        await self.seed_orphan_span_trap()
        await self.seed_annotation_fanout_trap()
        await self.seed_model_soft_delete_trap()
        await self.seed_dataset_revision_trap()
        await self.seed_experiment_traps()
        await self.seed_workload_region()
        await self.seed_evaluation_region()
        await self.seed_root_cause_region()
        await self.seed_eval_lifecycle_region()
        await self.session.commit()
        return self.oracle

    async def purge(self) -> None:
        """Remove any previous fixture before rebuilding it.

        The database is shared -- concurrent probes read it while it exists, and
        a second seeding run would otherwise double every count and silently
        invalidate every oracle entry. Deleting by name prefix keeps the fixture
        re-runnable without disturbing real data alongside it.

        Deletion is explicit from the leaves upward rather than relying on
        cascade, even though the engine now enforces foreign keys. Two reasons:
        it behaves the same on both backends regardless of per-connection
        pragmas, and it fails loudly if a new child table is added without being
        handled here, where a cascade would silently do the right thing until the
        day it did not.
        """
        prefixed = f"{PREFIX}-%"
        project_ids = (
            (
                await self.session.execute(
                    select(models.Project.id).where(models.Project.name.like(prefixed))
                )
            )
            .scalars()
            .all()
        )
        if project_ids:
            trace_ids = (
                (
                    await self.session.execute(
                        select(models.Trace.id).where(models.Trace.project_rowid.in_(project_ids))
                    )
                )
                .scalars()
                .all()
            )
            if trace_ids:
                span_ids = (
                    (
                        await self.session.execute(
                            select(models.Span.id).where(models.Span.trace_rowid.in_(trace_ids))
                        )
                    )
                    .scalars()
                    .all()
                )
                if span_ids:
                    await self.session.execute(
                        delete(models.SpanAnnotation).where(
                            models.SpanAnnotation.span_rowid.in_(span_ids)
                        )
                    )
                    await self.session.execute(
                        delete(models.SpanCostDetail).where(
                            models.SpanCostDetail.span_cost_id.in_(
                                select(models.SpanCost.id).where(
                                    models.SpanCost.span_rowid.in_(span_ids)
                                )
                            )
                        )
                    )
                    await self.session.execute(
                        delete(models.SpanCost).where(models.SpanCost.span_rowid.in_(span_ids))
                    )
                    await self.session.execute(
                        delete(models.Span).where(models.Span.id.in_(span_ids))
                    )
            await self.session.execute(
                delete(models.Trace).where(models.Trace.project_rowid.in_(project_ids))
            )
            await self.session.execute(
                delete(models.ProjectSession).where(
                    models.ProjectSession.project_id.in_(project_ids)
                )
            )
            await self.session.execute(
                delete(models.Project).where(models.Project.id.in_(project_ids))
            )
        await self.session.execute(delete(models.Dataset).where(models.Dataset.name.like(prefixed)))
        await self.session.execute(
            delete(models.GenerativeModel).where(models.GenerativeModel.name.like(prefixed))
        )
        await self.session.flush()

    # -- helpers ---------------------------------------------------------

    async def _project(self, name: str) -> models.Project:
        project = models.Project(name=name)
        self.session.add(project)
        await self.session.flush()
        return project

    async def _trace(self, project: models.Project, trace_id: str, start: datetime) -> models.Trace:
        trace = models.Trace(
            project_rowid=project.id,
            trace_id=trace_id,
            start_time=start,
            end_time=start + timedelta(seconds=1),
        )
        self.session.add(trace)
        await self.session.flush()
        return trace

    async def _span(
        self,
        trace: models.Trace,
        span_id: str,
        *,
        name: str,
        kind: str = "LLM",
        start: Optional[datetime] = None,
        duration_ms: int = 100,
        parent_id: Optional[str] = None,
        prompt_tokens: Optional[int] = None,
        cumulative_prompt: int = 0,
        attributes: Optional[dict[str, Any]] = None,
    ) -> models.Span:
        begin = start or trace.start_time
        span = models.Span(
            trace_rowid=trace.id,
            span_id=span_id,
            parent_id=parent_id,
            name=name,
            span_kind=kind,
            start_time=begin,
            end_time=begin + timedelta(milliseconds=duration_ms),
            attributes=attributes or {},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=cumulative_prompt,
            cumulative_llm_token_count_completion=0,
            llm_token_count_prompt=prompt_tokens,
            llm_token_count_completion=None,
        )
        self.session.add(span)
        await self.session.flush()
        return span

    # -- traps -----------------------------------------------------------

    async def seed_token_grain_trap(self) -> None:
        """Summing subtree totals multi-counts at every ancestor.

        A root span with three children, each holding tokens. The cumulative
        columns on the root restate the whole subtree, so summing them across all
        spans counts the same tokens twice. The margin is deliberately 2x rather
        than a few percent, so an inflated total cannot be mistaken for a
        different-but-reasonable grain choice.
        """
        project = await self._project(_name("tokens"))
        trace = await self._trace(project, _name("trace", "grain"), INSIDE_WINDOW)

        leaf_total = 300
        await self._span(
            trace,
            "grain-root",
            name="root",
            kind="CHAIN",
            cumulative_prompt=leaf_total,
        )
        for i in range(3):
            await self._span(
                trace,
                f"grain-child-{i}",
                name=f"child-{i}",
                parent_id="grain-root",
                prompt_tokens=100,
                cumulative_prompt=100,
            )

        self.oracle["token_grain"] = {
            "question": "total prompt tokens for the project",
            "correct": leaf_total,
            "naive_sum_of_cumulative": leaf_total * 2,
            "why": "root cumulative restates the three children; summing all spans double counts",
            "project": project.name,
        }

    async def seed_wide_date_range(self) -> None:
        """Two projects far apart in time, one large and old, one small and recent.

        The surface imposes no window of its own, so a time restriction is a
        predicate the caller writes. This gives that predicate something to
        discriminate: the ranking by prompt tokens inverts depending on where
        the caller puts the boundary, so a wrong boundary produces a plausible
        number rather than an error.
        """
        big = await self._project(_name("window", "old-and-large"))
        small = await self._project(_name("window", "recent-and-small"))

        big_trace = await self._trace(big, _name("trace", "old"), OUTSIDE_WINDOW)
        await self._span(
            big_trace,
            "window-old",
            name="old",
            start=OUTSIDE_WINDOW,
            prompt_tokens=999_000,
            cumulative_prompt=999_000,
        )

        small_trace = await self._trace(small, _name("trace", "recent"), INSIDE_WINDOW)
        await self._span(
            small_trace,
            "window-recent",
            name="recent",
            start=INSIDE_WINDOW,
            prompt_tokens=7,
            cumulative_prompt=7,
        )

        self.oracle["wide_date_range"] = {
            "question": "which project used the most prompt tokens",
            "correct": {"project": big.name, "tokens": 999_000},
            "if_bounded_to_recent": {"project": small.name, "tokens": 7},
            "why": "the larger project is older, so a boundary drawn too late inverts the ranking",
            "boundary": OUTSIDE_WINDOW.isoformat(),
        }

    async def seed_promotion_gap_trap(self) -> None:
        """Token counts on non-LLM spans never reach the promoted column.

        Phoenix promotes `llm_token_count_*` only for `span_kind='LLM'`. Tokens
        recorded on a CHAIN span exist in `attributes` and nowhere else -- not in
        the promoted column, not in span_costs. Following the schema's own advice
        to prefer promoted columns therefore misses them entirely.
        """
        project = await self._project(_name("promotion"))
        trace = await self._trace(project, _name("trace", "promotion"), INSIDE_WINDOW)

        await self._span(
            trace,
            "promotion-chain",
            name="agent turn",
            kind="CHAIN",
            start=INSIDE_WINDOW,
            prompt_tokens=None,  # never promoted for this span kind
            attributes={"llm": {"token_count": {"prompt": 555_000}}},
        )
        await self._span(
            trace,
            "promotion-llm",
            name="llm call",
            kind="LLM",
            start=INSIDE_WINDOW,
            prompt_tokens=1_000,
            cumulative_prompt=1_000,
            attributes={"llm": {"token_count": {"prompt": 1_000}}},
        )

        self.oracle["promotion_gap"] = {
            "question": "total prompt tokens for the project",
            "correct": 556_000,
            "naive_promoted_column_only": 1_000,
            "why": "555,000 tokens sit on a CHAIN span, which is never promoted",
            "project": project.name,
        }

    async def seed_attribute_shape_traps(self) -> None:
        """Three JSON shapes that look alike and are addressed differently.

        Phoenix nests flattened attribute keys, so a pre-nested value arriving
        alongside a flattened one on the same prefix leaves a literal dotted key
        that `$.metadata.team` does not reach. Every wrong path returns NULL
        rather than erroring, so a miss is indistinguishable from absent data.

        Not seeded, but worth knowing: a numeric segment becomes an array index
        only when what follows it is a mapping. `retrieval.documents.0.document`
        yields a real array, while a numeric segment holding a scalar yields an
        object keyed by the string "0" -- addressed as `."0"` rather than `[0]`.
        The only convention that currently produces the second form is
        `tag.tags`, which is effectively unused, so seeding it would test a
        distinction no live data exhibits. Add a case here if that changes.
        """
        project = await self._project(_name("shapes"))
        trace = await self._trace(project, _name("trace", "shapes"), INSIDE_WINDOW)

        await self._span(
            trace,
            "shapes-span",
            name="shapes",
            start=INSIDE_WINDOW,
            attributes={
                # numeric segment followed by a mapping -> a real array
                "retrieval": {"documents": [{"document": {"content": "chunk"}}]},
                # pre-nested value plus a flattened key on the same prefix
                "metadata": {"env": "prod"},
                "metadata.team": "core",
            },
        )

        self.oracle["attribute_shapes"] = {
            "question": "read each attribute",
            "paths": {
                "$.retrieval.documents[0].document.content": "chunk",
                '$."metadata.team"': "core",
            },
            "wrong_paths_returning_null": [
                '$.retrieval.documents."0".document.content',
                "$.metadata.team",
            ],
            "why": "every wrong form returns NULL, so a miss looks like absent data",
            "project": project.name,
        }

    async def seed_orphan_span_trap(self) -> None:
        """`parent_id IS NULL` is not the same as Phoenix's notion of a root.

        A span whose parent is absent from the database is treated as a root by
        Phoenix, but has a non-null parent_id. Counting roots by the null test
        undercounts.
        """
        project = await self._project(_name("roots"))
        trace = await self._trace(project, _name("trace", "roots"), INSIDE_WINDOW)

        await self._span(trace, "root-true", name="true root", start=INSIDE_WINDOW)
        await self._span(
            trace,
            "root-orphan",
            name="orphan",
            start=INSIDE_WINDOW,
            parent_id="span-that-was-never-ingested",
        )

        self.oracle["orphan_roots"] = {
            "question": "how many root spans",
            "correct": 2,
            "naive_parent_id_is_null": 1,
            "why": "an orphan has a parent_id pointing at a span that does not exist",
            "project": project.name,
        }

    async def seed_annotation_fanout_trap(self) -> None:
        """Joining annotations multiplies span rows before aggregation.

        One span carrying three annotations under the same name. A join followed
        by an unguarded aggregate counts the span three times.
        """
        project = await self._project(_name("annotations"))
        trace = await self._trace(project, _name("trace", "annotations"), INSIDE_WINDOW)
        span = await self._span(
            trace,
            "fanout-span",
            name="annotated",
            start=INSIDE_WINDOW,
            prompt_tokens=100,
            cumulative_prompt=100,
        )
        for i, kind in enumerate(("HUMAN", "LLM", "CODE")):
            self.session.add(
                models.SpanAnnotation(
                    span_rowid=span.id,
                    name="quality",
                    label="good",
                    score=1.0,
                    metadata_={},
                    annotator_kind=kind,
                    source="APP",
                    identifier=f"annotator-{i}",
                )
            )
        await self.session.flush()

        self.oracle["annotation_fanout"] = {
            "question": "total prompt tokens for spans that have a quality annotation",
            "correct": 100,
            "naive_join_then_sum": 300,
            "why": "three annotations on one span triple the span's row before aggregation",
            "project": project.name,
        }

    async def seed_model_soft_delete_trap(self) -> None:
        """Soft-deleted models are still the correct attribution for past costs.

        Filtering `deleted_at IS NULL` to "clean up" a cost query silently drops
        history that was priced against a model since retired.
        """
        live = models.GenerativeModel(
            name=_name("model", "live"),
            provider="fixture",
            name_pattern=re.compile("fixture-live"),
            is_built_in=False,
        )
        retired = models.GenerativeModel(
            name=_name("model", "retired"),
            provider="fixture",
            name_pattern=re.compile("fixture-retired"),
            is_built_in=False,
            deleted_at=NOW - timedelta(days=1),
        )
        self.session.add_all([live, retired])
        await self.session.flush()
        # Reused by the workload region's cost rows, so the model dimension is
        # joined rather than left dangling.
        self._workload_model = live

        self.oracle["model_soft_delete"] = {
            "question": "how many models have priced cost history",
            "correct": 2,
            "naive_deleted_at_is_null": 1,
            "why": "a retired model still explains the costs recorded while it was live",
        }

    async def seed_dataset_revision_trap(self) -> None:
        """Counting examples means the latest revision per example, minus deletes.

        Three examples across two versions: one created then patched, one created
        then deleted, one created only. Counting revision rows, or counting
        examples without excluding deletes, both give the wrong number -- and
        they give *different* wrong numbers, so the oracle identifies which
        mistake was made.
        """
        dataset = models.Dataset(name=_name("dataset"), metadata_={})
        self.session.add(dataset)
        await self.session.flush()

        v1 = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        v2 = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        self.session.add_all([v1, v2])
        await self.session.flush()

        examples = [models.DatasetExample(dataset_id=dataset.id) for _ in range(3)]
        self.session.add_all(examples)
        await self.session.flush()

        def revision(example: Any, version: Any, kind: str) -> models.DatasetExampleRevision:
            return models.DatasetExampleRevision(
                dataset_example_id=example.id,
                dataset_version_id=version.id,
                input={},
                output={},
                metadata_={},
                revision_kind=kind,
            )

        self.session.add_all(
            [
                revision(examples[0], v1, "CREATE"),
                revision(examples[0], v2, "PATCH"),
                revision(examples[1], v1, "CREATE"),
                revision(examples[1], v2, "DELETE"),
                revision(examples[2], v1, "CREATE"),
            ]
        )
        await self.session.flush()

        self.oracle["dataset_revisions"] = {
            "question": "how many examples are in the dataset at its latest version",
            "correct": 2,
            "naive_count_revision_rows": 5,
            "naive_count_examples_ignoring_deletes": 3,
            "why": "one example was deleted at v2; another was patched, not added",
            "dataset": dataset.name,
        }
        self._dataset = dataset
        self._version = v2
        self._examples = examples

    async def seed_experiment_traps(self) -> None:
        """Ephemeral runs, and run-to-trace links that are null or dangling.

        Playground experiments are marked ephemeral and should not join a
        population of real ones. Separately, a run's trace_id carries no foreign
        key and its target can be removed by retention, so an inner join to traces
        silently drops rows rather than reporting them.
        """
        real = models.Experiment(
            dataset_id=self._dataset.id,
            dataset_version_id=self._version.id,
            name=_name("experiment", "real"),
            repetitions=1,
            metadata_={},
        )
        ephemeral = models.Experiment(
            dataset_id=self._dataset.id,
            dataset_version_id=self._version.id,
            name=_name("experiment", "ephemeral"),
            repetitions=1,
            metadata_={},
            project_name=_name("playground"),
        )
        # Only set when the column exists on this schema version.
        if hasattr(ephemeral, "is_ephemeral"):
            ephemeral.is_ephemeral = True
        self.session.add_all([real, ephemeral])
        await self.session.flush()

        project = await self._project(_name("experiments"))
        linked_trace = await self._trace(project, _name("trace", "linked"), INSIDE_WINDOW)
        # The linked trace carries real spans. An empty trace row would make
        # "the run has a trace" and "the run has a trace worth opening" two
        # different questions with two different answers, and the trap being
        # measured here is about the join, not about that distinction -- a probe
        # that stops to disambiguate has been defeated by the fixture rather
        # than tested by it.
        root = await self._span(
            linked_trace,
            _name("span", "linked", "root"),
            name="experiment-run",
            kind="CHAIN",
            duration_ms=900,
        )
        await self._span(
            linked_trace,
            _name("span", "linked", "llm"),
            name="answer",
            kind="LLM",
            parent_id=root.span_id,
            start=INSIDE_WINDOW + timedelta(milliseconds=50),
            duration_ms=700,
            prompt_tokens=120,
        )

        runs = [
            # links to a trace that exists
            models.ExperimentRun(
                experiment_id=real.id,
                dataset_example_id=self._examples[0].id,
                repetition_number=1,
                output={},
                start_time=INSIDE_WINDOW,
                end_time=INSIDE_WINDOW + timedelta(seconds=1),
                trace_id=linked_trace.trace_id,
            ),
            # names a trace that does not exist -- retention removed it
            models.ExperimentRun(
                experiment_id=real.id,
                dataset_example_id=self._examples[1].id,
                repetition_number=1,
                output={},
                start_time=INSIDE_WINDOW,
                end_time=INSIDE_WINDOW + timedelta(seconds=1),
                trace_id="trace-removed-by-retention",
            ),
            # never traced at all
            models.ExperimentRun(
                experiment_id=real.id,
                dataset_example_id=self._examples[2].id,
                repetition_number=1,
                output={},
                start_time=INSIDE_WINDOW,
                end_time=INSIDE_WINDOW + timedelta(seconds=1),
                trace_id=None,
            ),
        ]
        self.session.add_all(runs)
        await self.session.flush()

        self.oracle["experiment_trace_links"] = {
            "question": "how many runs the experiment has, and how many still have their trace",
            "correct": 3,
            "correct_with_surviving_trace": 1,
            "naive_inner_join_traces": 1,
            "why": (
                "one run's trace was deleted and one was never traced; both vanish on an "
                "inner join. The inner join reaches the right second number by the wrong "
                "route, so the two numbers together separate a correct answer from a lucky one"
            ),
            "experiment": real.name,
            "surviving_trace_span_count": 2,
        }
        self.oracle["ephemeral_experiments"] = {
            "question": "how many experiments exist for the dataset",
            "correct_excluding_ephemeral": 1,
            "naive_counting_all": 2,
            "why": "playground runs are ephemeral and rarely belong in a reported population",
            "dataset": self._dataset.name,
        }

    async def seed_workload_region(self) -> None:
        """A second region that is deliberately unremarkable.

        The trap region above is adversarial: every shape exists so that a wrong
        answer differs visibly from a right one. That makes it useless for the
        opposite question -- whether an advanced query is *possible* -- because
        nothing in it has a distribution, a time axis, or any depth.

        So this region is boring on purpose, and boring in the specific ways the
        harder question shapes require:

        A latency distribution that is skewed, so p50 and p95 are far apart and a
        percentile is not just the same number as the mean. A uniform fixture
        makes every percentile identical and silently passes a surface that
        computes them wrongly.

        Spans spread across three days at uneven intervals, so hourly bucketing
        produces a real series with a distinguishable busiest hour, rather than
        two spikes at the two instants the trap region uses.

        Trace trees three and four levels deep with mixed span kinds, because
        root-cause navigation means locating a span and then reading its parent,
        siblings and children -- and a two-span trace has nothing to navigate.

        Sessions grouping several traces each, so session-grain questions and the
        traces-to-sessions join have something to join.

        Cost rows with token-type breakdowns, so the cost area and the model
        dimension are populated rather than merely present.

        The oracle for this region is shaped differently too: stable reference
        values -- the p95, the busiest hour, the deepest trace -- rather than a
        naive/correct pair, because here there is no trap, only a capability that
        either works or does not.
        """
        rng = random.Random(20260801)
        project = await self._project(_name("workload"))

        span_kinds = ["CHAIN", "LLM", "RETRIEVER", "TOOL"]
        latencies: list[int] = []
        error_count = 0
        total_spans = 0
        per_hour: dict[str, int] = {}
        session_rows: list[models.ProjectSession] = []

        # Three days of traffic, unevenly distributed so one hour is clearly busiest.
        for day in range(3):
            day_start = NOW - timedelta(days=day + 1)
            session = models.ProjectSession(
                session_id=_name("session", str(day)),
                project_id=project.id,
                start_time=day_start,
                end_time=day_start + timedelta(hours=6),
            )
            self.session.add(session)
            await self.session.flush()
            session_rows.append(session)

            # Hour 3 is the busy hour every day, so the peak is the same hour of
            # the day whichever way the series is grouped. The most recent day
            # is busier still, so that grouping by absolute calendar hour also
            # has a single winner. Without that extra traffic the three days tie
            # exactly, "the busiest hour" has two defensible answers, and a
            # probe is being graded on which reading it guessed rather than on
            # whether it can build a time series at all.
            for hour in range(6):
                if hour != 3:
                    traces_this_hour = 2
                else:
                    traces_this_hour = 8 if day == 0 else 6
                for t in range(traces_this_hour):
                    begin = day_start + timedelta(hours=hour, minutes=rng.randint(0, 59))
                    bucket = begin.replace(minute=0, second=0, microsecond=0).isoformat()
                    trace = models.Trace(
                        project_rowid=project.id,
                        trace_id=_name("wtrace", f"{day}-{hour}-{t}"),
                        project_session_rowid=session.id,
                        start_time=begin,
                        end_time=begin + timedelta(seconds=2),
                    )
                    self.session.add(trace)
                    await self.session.flush()

                    # A root, two children, and a grandchild under the first child:
                    # deep enough that navigating up and sideways is a real step.
                    root = await self._span(
                        trace,
                        f"{trace.trace_id}-root",
                        name="agent turn",
                        kind="CHAIN",
                        start=begin,
                        duration_ms=ROOT_DURATION_MS,
                    )
                    total_spans += 1
                    latencies.append(ROOT_DURATION_MS)
                    per_hour[bucket] = per_hour.get(bucket, 0) + 1

                    for child_index in range(2):
                        # Skewed: most calls are quick, a few are very slow.
                        latency = rng.choice([40, 60, 80, 110, 140] * 4 + [900, 1500, 2600])
                        latencies.append(latency)
                        failed = rng.random() < 0.1
                        if failed:
                            error_count += 1
                        child = await self._span(
                            trace,
                            f"{trace.trace_id}-c{child_index}",
                            name="llm call" if child_index == 0 else "retrieve",
                            kind=span_kinds[1 + child_index],
                            start=begin + timedelta(milliseconds=50),
                            duration_ms=latency,
                            parent_id=root.span_id,
                            prompt_tokens=rng.randint(50, 400) if child_index == 0 else None,
                            cumulative_prompt=0,
                        )
                        child.status_code = "ERROR" if failed else "OK"
                        total_spans += 1
                        per_hour[bucket] = per_hour.get(bucket, 0) + 1

                        if child_index == 0:
                            await self._span(
                                trace,
                                f"{trace.trace_id}-g0",
                                name="tool call",
                                kind="TOOL",
                                start=begin + timedelta(milliseconds=80),
                                duration_ms=GRANDCHILD_DURATION_MS,
                                parent_id=child.span_id,
                            )
                            total_spans += 1
                            latencies.append(GRANDCHILD_DURATION_MS)
                            per_hour[bucket] = per_hour.get(bucket, 0) + 1
                            await self._cost_rows(child, trace, rng)

        latencies.sort()

        def _percentile(fraction: float) -> float:
            """Linear interpolation between ranks, matching what the surface offers.

            Both backends expose a continuous percentile -- percentile_cont on
            Postgres, percentile from the stats extension on SQLite -- and both
            interpolate. An oracle computed by picking the value at a truncated
            index answers a different question, and would mark a probe wrong for
            agreeing with the very function it was told to use.
            """
            position = (len(latencies) - 1) * fraction
            lower = int(position)
            upper = min(lower + 1, len(latencies) - 1)
            return latencies[lower] + (latencies[upper] - latencies[lower]) * (position - lower)

        p50 = _percentile(0.50)
        p95 = _percentile(0.95)
        busiest_hour, busiest_count = max(per_hour.items(), key=lambda kv: kv[1])
        # max() resolves a tie by returning whichever key it met first, which
        # would publish a single busiest hour for data that does not have one and
        # mark a correct probe wrong. The oracle has to fail loudly here instead.
        if sum(1 for count in per_hour.values() if count == busiest_count) != 1:
            raise AssertionError(
                f"busiest hour is not unique: {busiest_count} spans occur in "
                f"{sum(1 for c in per_hour.values() if c == busiest_count)} different hours"
            )
        # The peak must also survive being grouped by hour of day rather than by
        # absolute hour, since both are ordinary readings of the same question.
        per_hour_of_day: dict[str, int] = {}
        for bucket, count in per_hour.items():
            hour_of_day = bucket[11:13]
            per_hour_of_day[hour_of_day] = per_hour_of_day.get(hour_of_day, 0) + count
        busiest_of_day = max(per_hour_of_day.items(), key=lambda kv: kv[1])
        if busiest_of_day[0] != busiest_hour[11:13]:
            raise AssertionError(
                f"the two readings of 'busiest hour' disagree: absolute hour "
                f"{busiest_hour} versus hour of day {busiest_of_day[0]}"
            )

        self.oracle["workload"] = {
            "purpose": "capability, not traps: percentiles, time series, depth, sessions, cost",
            "project": project.name,
            "spans": total_spans,
            "sessions": len(session_rows),
            "max_trace_depth": 3,
            "latency_p50_ms": p50,
            "latency_p95_ms": p95,
            "error_spans": error_count,
            "busiest_hour": {
                "bucket": busiest_hour,
                "spans": busiest_count,
                "hour_of_day": busiest_hour[11:13],
                "spans_at_that_hour_of_day": busiest_of_day[1],
                "unique": True,
            },
            "note": (
                "p50 and p95 differ by design; a fixture with uniform latencies "
                "would pass a surface that computed percentiles incorrectly. The "
                "busiest hour is the same whether the series is grouped by "
                "absolute hour or by hour of day, so either reading is accepted"
            ),
        }

    async def _cost_rows(self, span: models.Span, trace: models.Trace, rng: random.Random) -> None:
        """Cost with a token-type breakdown, so the detail table is exercised."""
        prompt_tokens = float(span.llm_token_count_prompt or 0)
        completion_tokens = float(rng.randint(20, 200))
        prompt_cost = prompt_tokens * 0.000003
        completion_cost = completion_tokens * 0.000015
        cost = models.SpanCost(
            span_rowid=span.id,
            trace_rowid=trace.id,
            span_start_time=span.start_time,
            model_id=self._workload_model.id,
            total_cost=prompt_cost + completion_cost,
            total_tokens=prompt_tokens + completion_tokens,
            prompt_cost=prompt_cost,
            prompt_tokens=prompt_tokens,
            completion_cost=completion_cost,
            completion_tokens=completion_tokens,
        )
        self.session.add(cost)
        await self.session.flush()
        self.session.add_all(
            [
                models.SpanCostDetail(
                    span_cost_id=cost.id,
                    token_type="input",
                    is_prompt=True,
                    cost=prompt_cost,
                    tokens=prompt_tokens,
                    cost_per_token=0.000003,
                ),
                models.SpanCostDetail(
                    span_cost_id=cost.id,
                    token_type="output",
                    is_prompt=False,
                    cost=completion_cost,
                    tokens=completion_tokens,
                    cost_per_token=0.000015,
                ),
            ]
        )
        await self.session.flush()

    async def seed_evaluation_region(self) -> None:
        """Evaluation metrics spanning the full range of diagnostic usefulness.

        Borrowed from how Datadog's experiment analyzer triages before it
        analyses: classify every metric from summary statistics first, so the
        expensive work goes where the signal is. Its classes are

            always_zero  max == 0            feature disabled, no signal
            perfect      min == 1            always passes, no signal
            saturated    mean >= 0.99        rarely fails, low value
            interesting  0.70 <= mean < 0.99 partial failures
            struggling   mean < 0.70         the ones worth reading

        A fixture with one metric, or with metrics that all pass, cannot tell a
        surface that triages correctly from one that returns them in arbitrary
        order. So one metric of each class is seeded, and a harness can assert
        the classification rather than merely that rows came back.

        Two further shapes, both absent before and both required by questions
        that were written down as valuable:

        A **planted correlation**. The struggling metric fails far more often on
        examples marked hard than on easy ones. Segmenting by that dimension
        should surface a real driver -- without a planted signal, a segmentation
        query returns noise and cannot distinguish a working implementation from
        a broken one.

        **Annotator disagreement**. The existing fan-out trap seeds three
        annotator kinds that all score 1.0, so the gap between human and judge is
        uniformly zero and the disagreement query -- the highest-value quality
        case on the list -- has nothing to find. Here they diverge, by a known
        amount, on known rows.
        """
        rng = random.Random(20260802)

        dataset = models.Dataset(name=_name("evaldata"), metadata_={})
        self.session.add(dataset)
        await self.session.flush()
        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        self.session.add(version)
        await self.session.flush()

        # Which examples are hard is drawn once and shuffled, not taken from the
        # loop index. Alternating them makes difficulty perfectly collinear with
        # the example id, and an analyst who finds the segmentation then cannot
        # tell whether difficulty explains the failures or whether the fixture
        # simply labelled every other row -- the two partitions are identical, so
        # no query can separate them. Shuffling breaks that tie.
        difficulties = ["hard"] * 10 + ["easy"] * 10
        rng.shuffle(difficulties)

        QUESTIONS = {
            "easy": [
                "What is the refund window?",
                "How do I reset my password?",
                "Where can I find my invoice?",
                "Is there a free tier?",
                "How do I contact support?",
            ],
            "hard": [
                "Why does the retry budget interact with the idempotency key TTL?",
                "How does cursor pagination behave when a row is deleted mid-scan?",
                "What happens to in-flight webhooks during a region failover?",
                "How is clock skew reconciled across replicas for ordering?",
                "When does the cache admit a partially-written batch?",
            ],
        }

        examples: list[models.DatasetExample] = []
        example_difficulty: dict[int, str] = {}
        for index, difficulty in enumerate(difficulties):
            example = models.DatasetExample(dataset_id=dataset.id)
            self.session.add(example)
            await self.session.flush()
            question = QUESTIONS[difficulty][index % 5]
            # The question is recorded as well as the label. Without it the
            # examples carry nothing but the answer key, so a judge scoring them
            # has no visible input and the fixture cannot be read as an
            # evaluation at all.
            self.session.add(
                models.DatasetExampleRevision(
                    dataset_example_id=example.id,
                    dataset_version_id=version.id,
                    input={"question": question, "difficulty": difficulty},
                    output={"expected": "a grounded answer citing the docs"},
                    metadata_={"difficulty": difficulty},
                    revision_kind="CREATE",
                )
            )
            examples.append(example)
            example_difficulty[example.id] = difficulty
        await self.session.flush()

        # Runs link to real traces. Without this an experiment result cannot be
        # opened to see what the model actually did, which is the first thing
        # anyone asks after seeing a low score.
        run_project = await self._project(_name("evalruns"))

        # Two experiments over the same dataset, so "what changed" has a delta.
        sampled_scores: dict[str, list[float]] = {"hard": [], "easy": []}
        experiments = {}
        for label, lift in (("baseline", 0.0), ("candidate", 0.25)):
            experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name=_name("experiment", label),
                repetitions=1,
                metadata_={"variant": label},
            )
            self.session.add(experiment)
            await self.session.flush()
            experiments[label] = experiment

            for index, example in enumerate(examples):
                difficulty = example_difficulty[example.id]
                hard = difficulty == "hard"

                # Each run gets its own trace, so a score can be opened and read.
                run_trace = await self._trace(
                    run_project, _name("evalrun", label, str(index)), INSIDE_WINDOW
                )
                root = await self._span(
                    run_trace,
                    f"evalrun-{label}-{index}-root",
                    name="answer question",
                    kind="CHAIN",
                    duration_ms=rng.randint(200, 900),
                )
                await self._span(
                    run_trace,
                    f"evalrun-{label}-{index}-llm",
                    name="generate",
                    kind="LLM",
                    parent_id=root.span_id,
                    start=INSIDE_WINDOW + timedelta(milliseconds=20),
                    duration_ms=rng.randint(100, 600),
                    prompt_tokens=rng.randint(120, 900),
                )

                # Outputs differ per run. Identical text across every row lets an
                # analyst prove the judge cannot be reading the answer, which
                # makes any pattern in the scores an artifact of the fixture
                # rather than a finding about the model.
                verb = "Partially addressing" if hard else "Answering"
                tail = (
                    "the interaction is not fully documented"
                    if hard
                    else "see the linked doc section"
                )
                answer = f"{verb} example {index}: {tail}."
                run = models.ExperimentRun(
                    experiment_id=experiment.id,
                    dataset_example_id=example.id,
                    repetition_number=1,
                    output={"text": answer},
                    start_time=INSIDE_WINDOW,
                    end_time=INSIDE_WINDOW + timedelta(milliseconds=rng.randint(80, 400)),
                    trace_id=run_trace.trace_id,
                )
                self.session.add(run)
                await self.session.flush()

                # Scores are drawn around a per-class mean rather than set to it.
                # Two constants make the separation perfect, and a perfect
                # separation is indistinguishable from a lookup: the honest
                # reading of it is that the label was computed from the
                # difficulty field, which is exactly what an analyst concluded.
                # The spreads overlap slightly, so the difference between classes
                # is real but has to be established statistically.
                centre = (0.18 if hard else 0.72) + lift
                struggling = min(1.0, max(0.0, round(rng.gauss(centre, 0.09), 3)))
                if label == "baseline":
                    sampled_scores[difficulty].append(struggling)
                scores = {
                    "disabled_check": 0.0,
                    "format_valid": 1.0,
                    "no_crash": 0.0 if index == 0 else 1.0,
                    "helpfulness": round(min(1.0, max(0.0, rng.gauss(0.85, 0.05))), 3),
                    "answer_correct": struggling,
                }
                explanations = {
                    "answer_correct": (
                        "Claim is not supported by the retrieved passage."
                        if struggling < 0.5
                        else "Matches the cited passage."
                    ),
                    "helpfulness": "Addresses the question asked.",
                    "format_valid": "Well-formed response object.",
                    "no_crash": ("Run raised no exception." if index else "Run terminated early."),
                    "disabled_check": None,
                }
                for metric, score in scores.items():
                    self.session.add(
                        models.ExperimentRunAnnotation(
                            experiment_run_id=run.id,
                            name=metric,
                            label="pass" if score >= 0.5 else "fail",
                            score=score,
                            explanation=explanations[metric],
                            annotator_kind="LLM",
                            metadata_={"difficulty": difficulty},
                            start_time=INSIDE_WINDOW,
                            end_time=INSIDE_WINDOW + timedelta(milliseconds=50),
                        )
                    )
            await self.session.flush()

        # Human and judge scores that actually differ, on identified rows.
        project = await self._project(_name("disagreement"))
        trace = await self._trace(project, _name("trace", "disagree"), INSIDE_WINDOW)
        gaps = [0.0, 0.1, 0.4, 0.8]
        for index, gap in enumerate(gaps):
            span = await self._span(
                trace, f"disagree-{index}", name=f"answer-{index}", start=INSIDE_WINDOW
            )
            for kind, score in (("HUMAN", 1.0), ("LLM", round(1.0 - gap, 2))):
                self.session.add(
                    models.SpanAnnotation(
                        span_rowid=span.id,
                        name="correctness",
                        label="good" if score >= 0.5 else "bad",
                        score=score,
                        metadata_={},
                        annotator_kind=kind,
                        source="APP",
                        identifier=f"{kind.lower()}-{index}",
                    )
                )
        await self.session.flush()

        self.oracle["evaluation_metrics"] = {
            "purpose": "metric triage, segmentation, experiment comparison, annotator disagreement",
            "dataset": dataset.name,
            "metric_classes": {
                "disabled_check": "always_zero",
                "format_valid": "perfect",
                "no_crash": "saturated",
                "helpfulness": "interesting",
                "answer_correct": "struggling",
            },
            "planted_segment": {
                "dimension": "input difficulty (hard vs easy)",
                "metric": "answer_correct",
                # Measured from the scores actually written, not restated from
                # the constants they were drawn around. Publishing the design
                # intent instead describes a population no query returns, and
                # marks a correct answer wrong by whatever sampling shifted.
                "baseline_hard_mean": round(
                    sum(sampled_scores["hard"]) / len(sampled_scores["hard"]), 3
                ),
                "baseline_easy_mean": round(
                    sum(sampled_scores["easy"]) / len(sampled_scores["easy"]), 3
                ),
                "drawn_around": {"hard": 0.18, "easy": 0.72, "sigma": 0.09},
                "note": (
                    "segmenting by difficulty must surface this; "
                    "without a planted signal the query returns noise"
                ),
            },
            "experiment_delta": {
                "baseline": _name("experiment", "baseline"),
                "candidate": _name("experiment", "candidate"),
                "answer_correct_lift": 0.25,
            },
            "annotator_disagreement": {
                "project": project.name,
                "max_gap": 0.8,
                "spans_with_gap": 3,
                "note": "human scores 1.0 throughout; judge diverges by 0.0/0.1/0.4/0.8",
            },
        }

    async def seed_root_cause_region(self) -> None:
        """Traces where the flagged span is not the span that caused the problem.

        Root-cause analysis starts from a symptom: an evaluator marks one span as
        bad. The diagnosis is almost never there. It is in a sibling retriever
        that returned irrelevant context, a parent whose instructions were wrong,
        or a tool that quietly returned nothing -- and the flagged span, read
        alone, looks unremarkable.

        Every other trace in this fixture puts the problem exactly where the
        annotation is, which means a probe can appear to diagnose correctly by
        reading one span and stopping. That tests nothing. Here the flagged span
        is deliberately a **distractor**: its own content is fine, and the cause
        is one hop away in a direction that differs per failure mode.

        Three modes, several instances each, because grouping is the point.
        Open coding then axial coding is how these get triaged, and a fixture
        with three unique failures cannot distinguish a surface that clusters
        from one that lists. Each mode also carries judge **reasoning text** on
        the annotation, since that is the evidence the first pass actually reads
        -- and nothing in this fixture populated `explanation` before.

        One mode is a runtime failure and two are behavioural, because the first
        question in triage is which of those you are looking at, and a fixture
        with only one kind cannot pose it.
        """
        project = await self._project(_name("rootcause"))

        modes = [
            {
                "mode": "bad_retrieval",
                "cause_span": "retriever",
                "kind": "behavioural",
                "reason": (
                    "The answer contradicts the source material. The response asserts a "
                    "refund window of 90 days; no retrieved passage mentions 90 days."
                ),
            },
            {
                "mode": "wrong_system_prompt",
                "cause_span": "parent",
                "kind": "behavioural",
                "reason": (
                    "The answer is written for a developer audience although the question "
                    "came from an end user. Tone and terminology are inappropriate."
                ),
            },
            {
                "mode": "tool_timeout",
                "cause_span": "tool",
                "kind": "runtime",
                "reason": (
                    "The answer states that account details are unavailable. No account "
                    "data appears anywhere in the provided context."
                ),
            },
        ]

        seeded: dict[str, int] = {}
        for mode_index, mode in enumerate(modes):
            for instance in range(4):
                tag = f"{mode['mode']}-{instance}"
                trace = await self._trace(project, _name("rctrace", tag), INSIDE_WINDOW)

                # Parent carries the instructions. Wrong only in the prompt mode.
                parent_prompt = (
                    "You are a senior engineer. Use precise technical terminology."
                    if mode["cause_span"] == "parent"
                    else "You are a helpful support agent. Answer plainly."
                )
                parent = await self._span(
                    trace,
                    f"{tag}-parent",
                    name="agent turn",
                    kind="CHAIN",
                    start=INSIDE_WINDOW,
                    duration_ms=800,
                    attributes={
                        "llm": {
                            "input_messages": [
                                {"message": {"role": "system", "content": parent_prompt}}
                            ]
                        }
                    },
                )

                # Sibling retriever. Returns unrelated passages only in the retrieval mode.
                docs = (
                    [{"document": {"content": "Unrelated: office holiday schedule."}}]
                    if mode["cause_span"] == "retriever"
                    else [{"document": {"content": "Refunds are available within 30 days."}}]
                )
                await self._span(
                    trace,
                    f"{tag}-retriever",
                    name="retrieve",
                    kind="RETRIEVER",
                    start=INSIDE_WINDOW,
                    duration_ms=120,
                    parent_id=parent.span_id,
                    attributes={"retrieval": {"documents": docs}},
                )

                # Sibling tool. Errors and returns nothing only in the timeout mode.
                tool = await self._span(
                    trace,
                    f"{tag}-tool",
                    name="lookup_account",
                    kind="TOOL",
                    start=INSIDE_WINDOW,
                    duration_ms=30_000 if mode["cause_span"] == "tool" else 40,
                    parent_id=parent.span_id,
                    attributes={"output": {"value": ""}}
                    if mode["cause_span"] == "tool"
                    else {"output": {"value": "account in good standing"}},
                )
                if mode["cause_span"] == "tool":
                    tool.status_code = "ERROR"
                    tool.status_message = "upstream timeout after 30000ms"

                # The evaluated span. Unremarkable in isolation in every mode.
                flagged = await self._span(
                    trace,
                    f"{tag}-llm",
                    name="generate",
                    kind="LLM",
                    start=INSIDE_WINDOW,
                    duration_ms=600,
                    parent_id=parent.span_id,
                    prompt_tokens=120,
                    cumulative_prompt=120,
                    attributes={"llm": {"model_name": "fixture-model"}},
                )
                self.session.add(
                    models.SpanAnnotation(
                        span_rowid=flagged.id,
                        name="answer_correct",
                        label="fail",
                        score=0.0,
                        explanation=mode["reason"],
                        metadata_={"failure_mode": mode["mode"]},
                        annotator_kind="LLM",
                        source="API",
                        identifier=f"judge-{mode_index}-{instance}",
                    )
                )
                seeded[mode["mode"]] = seeded.get(mode["mode"], 0) + 1
        await self.session.flush()

        self.oracle["root_cause"] = {
            "purpose": (
                "the flagged span is never the cause; diagnosis requires navigating the trace"
            ),
            "project": project.name,
            "failure_modes": seeded,
            "cause_location": {m["mode"]: m["cause_span"] for m in modes},
            "runtime_vs_behavioural": {m["mode"]: m["kind"] for m in modes},
            "distractor": (
                "the evaluated LLM span reads normally in every mode; reading it alone "
                "cannot distinguish the three"
            ),
            "judge_reasoning": (
                "carried on span_annotations.explanation, the first evidence a triage pass reads"
            ),
        }

    async def seed_eval_lifecycle_region(self) -> None:
        """Two shapes from treating evaluation as a loop rather than a report.

        The pipeline that motivated this runs failures into a taxonomy and the
        taxonomy into *new evaluators*, then asks whether those evaluators hold
        up over time. That framing needs two things a snapshot fixture cannot
        provide.

        **A regression with a date.** An evaluator that has always scored 0.9
        tells you nothing; one that scored 0.95 until Tuesday and 0.55 after is
        the entire question. Every annotation elsewhere in this fixture shares a
        single timestamp, so no query can distinguish a surface that finds the
        change point from one that reports an average. Here one metric steps down
        sharply on a known day while a control metric stays flat -- the control
        matters, because a fixture where everything moves cannot show that the
        right thing was singled out.

        **A deliberate coverage gap.** The loop exists because production
        produces failures nothing evaluates. A fourth failure mode is seeded into
        the root-cause project carrying *no annotation at all*, so "what is
        failing that we do not measure" has a designed answer rather than an
        incidental one.

        A limit worth stating: `annotation_configs` is not in the manifest, so
        the coverage question is only expressible as "failures with no
        annotation", not as "modes with no configured evaluator". The second is
        the question people actually want.
        """
        project = await self._project(_name("evaltrend"))
        change_point = NOW - timedelta(days=4)

        for day_offset in range(8, 0, -1):
            day = NOW - timedelta(days=day_offset)
            regressed = day >= change_point
            trace = await self._trace(project, _name("trendtrace", str(day_offset)), day)
            for index in range(5):
                span = await self._span(
                    trace,
                    f"trend-{day_offset}-{index}",
                    name="generate",
                    kind="LLM",
                    start=day,
                    duration_ms=200,
                )
                # The metric under investigation steps down on the change date.
                self.session.add(
                    models.SpanAnnotation(
                        span_rowid=span.id,
                        name="groundedness",
                        label="fail" if (regressed and index < 3) else "pass",
                        score=0.0 if (regressed and index < 3) else 1.0,
                        explanation="Assertion not supported by retrieved context."
                        if (regressed and index < 3)
                        else "Supported by context.",
                        metadata_={},
                        annotator_kind="LLM",
                        source="API",
                        identifier=f"groundedness-{day_offset}-{index}",
                    )
                )
                # Control: flat throughout, so a query that flags everything is
                # distinguishable from one that isolates the real change.
                self.session.add(
                    models.SpanAnnotation(
                        span_rowid=span.id,
                        name="format_valid",
                        label="pass",
                        score=1.0,
                        metadata_={},
                        annotator_kind="LLM",
                        source="API",
                        identifier=f"format-{day_offset}-{index}",
                    )
                )
        await self.session.flush()

        # A failure mode nothing evaluates, in the same project as the diagnosed ones.
        rc_project = (
            await self.session.execute(
                select(models.Project).where(models.Project.name == _name("rootcause"))
            )
        ).scalar_one()
        for instance in range(4):
            trace = await self._trace(
                rc_project, _name("rctrace", f"unevaluated-{instance}"), INSIDE_WINDOW
            )
            parent = await self._span(
                trace,
                f"unevaluated-{instance}-parent",
                name="agent turn",
                kind="CHAIN",
                start=INSIDE_WINDOW,
                duration_ms=700,
            )
            await self._span(
                trace,
                f"unevaluated-{instance}-llm",
                name="generate",
                kind="LLM",
                start=INSIDE_WINDOW,
                duration_ms=500,
                parent_id=parent.span_id,
                attributes={"llm": {"model_name": "fixture-model"}},
            )
        await self.session.flush()

        self.oracle["eval_lifecycle"] = {
            "purpose": "evaluation as a loop: regression detection and coverage gaps",
            "regression": {
                "project": project.name,
                "metric": "groundedness",
                "control_metric": "format_valid",
                "change_point": change_point.isoformat(),
                "mean_before": 1.0,
                "mean_after": 0.4,
                "note": (
                    "the control stays flat; a query that flags both has not isolated anything"
                ),
            },
            "coverage_gap": {
                "project": rc_project.name,
                "unevaluated_traces": 4,
                "note": (
                    "a failure mode carrying no annotation at all; "
                    "annotation_configs is not queryable, so this is the closest "
                    "expressible form of 'what do we not measure'"
                ),
            },
        }


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="SQLAlchemy async URL for the target database")
    parser.add_argument("--oracle", help="write expected answers to this path as JSON")
    parser.add_argument(
        "--create-tables",
        action="store_true",
        help="run migrations first; for a scratch database rather than a live one",
    )
    args = parser.parse_args()

    # Phoenix's factory rather than a bare SQLAlchemy engine, because the
    # difference is not cosmetic. SQLite leaves foreign-key enforcement off
    # unless each connection turns it on, and Phoenix does that in a connect
    # listener; an engine built directly has ON DELETE CASCADE declared in the
    # schema and enforced by nothing, so deletes appear to succeed and quietly
    # leave orphans. The factory also picks the right driver per dialect and
    # applies WAL and the busy timeout on SQLite.
    #
    # `migrate` additionally runs the real migrations rather than
    # `metadata.create_all`, so a scratch database is versioned the way a real
    # one is instead of merely shaped like it.
    engine = create_engine(
        connection_str=args.url,
        migrate=args.create_tables,
        log_migrations=False,
    )
    try:
        maker = async_sessionmaker(engine, expire_on_commit=False)
        async with maker() as session:
            oracle = await Seeder(session).run()
    finally:
        await engine.dispose()

    payload = {
        "reference_now": NOW.isoformat(),
        "default_window_start": DEFAULT_WINDOW_START.isoformat(),
        "prefix": PREFIX,
        "traps": oracle,
    }
    text = json.dumps(payload, indent=2)
    if args.oracle:
        Path(args.oracle).write_text(text)
        print(f"seeded; oracle written to {args.oracle}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
