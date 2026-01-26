import re
from collections.abc import Sequence
from datetime import datetime, timezone

import pytest
from openinference.semconv.trace import SpanAttributes
from opentelemetry.trace import Status, StatusCode
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from phoenix.db import models
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer


class TestTracer:
    @pytest.fixture
    async def project(self, db: DbSessionFactory) -> models.Project:
        project = models.Project(name="test-project")
        async with db() as session:
            session.add(project)
        return project

    @pytest.fixture
    async def gpt_4o_mini_generative_model(self, db: DbSessionFactory) -> models.GenerativeModel:
        model = models.GenerativeModel(
            name="gpt-4o-mini",
            provider="openai",
            start_time=datetime(2024, 1, 1, tzinfo=timezone.utc),
            name_pattern=re.compile("gpt-4o-mini.*"),
            is_built_in=True,
            token_prices=[
                models.TokenPrice(
                    token_type="input",
                    is_prompt=True,
                    base_rate=0.15 / 1_000_000,  # $0.15 per million tokens
                    customization=None,
                ),
                models.TokenPrice(
                    token_type="output",
                    is_prompt=False,
                    base_rate=0.60 / 1_000_000,  # $0.60 per million tokens
                    customization=None,
                ),
            ],
        )
        async with db() as session:
            session.add(model)

        return model

    @pytest.fixture
    async def generative_model_store(
        self,
        db: DbSessionFactory,
        gpt_4o_mini_generative_model: models.GenerativeModel,
    ) -> GenerativeModelStore:
        store = GenerativeModelStore(db=db)
        await store._fetch_models()
        return store

    @pytest.fixture
    def span_cost_calculator(
        self,
        db: DbSessionFactory,
        generative_model_store: GenerativeModelStore,
    ) -> SpanCostCalculator:
        return SpanCostCalculator(db=db, model_store=generative_model_store)

    @pytest.fixture
    def tracer(self, span_cost_calculator: SpanCostCalculator) -> Tracer:
        return Tracer(span_cost_calculator=span_cost_calculator)

    @pytest.mark.asyncio
    async def test_save_db_traces_persists_nested_spans(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        with tracer.start_as_current_span(
            "parent",
            attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
        ) as parent_span:
            parent_span.set_attribute("custom_attr", "parent_value")
            with tracer.start_as_current_span(
                "child",
                attributes={OPENINFERENCE_SPAN_KIND: "LLM"},
            ) as child_span:
                child_span.set_attribute("custom_attr", "child_value")
                child_span.add_event("test_event", {"event_key": "event_value"})
                child_span.set_status(Status(StatusCode.OK))
            parent_span.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_traces = (
                (
                    await session.execute(
                        select(models.Trace).options(joinedload(models.Trace.spans))
                    )
                )
                .scalars()
                .unique()
                .all()
            )

        assert len(returned_traces) == 1
        assert len(fetched_traces) == 1

        returned_trace = returned_traces[0]
        fetched_trace = fetched_traces[0]
        assert returned_trace == fetched_trace
        assert returned_trace.project_rowid == project.id
        returned_spans = returned_trace.spans
        fetched_spans = fetched_trace.spans
        assert len(returned_spans) == 2
        assert len(fetched_spans) == 2
        parent_returned_span = next(s for s in returned_spans if s.name == "parent")
        child_returned_span = next(s for s in returned_spans if s.name == "child")
        parent_db_span = next(s for s in fetched_spans if s.name == "parent")
        child_db_span = next(s for s in fetched_spans if s.name == "child")
        assert parent_returned_span == parent_db_span
        assert child_returned_span == child_db_span

        # spans have the correct trace ID
        for returned_span in returned_spans:
            assert returned_span.trace_rowid == returned_trace.id

        # check parent span
        assert parent_db_span.parent_id is None
        assert parent_db_span.name == "parent"
        assert parent_db_span.span_kind == "CHAIN"
        assert parent_db_span.start_time <= parent_db_span.end_time
        assert parent_db_span.status_code == "OK"
        assert parent_db_span.status_message == ""
        assert not parent_db_span.events
        assert parent_db_span.cumulative_error_count == 0
        assert parent_db_span.cumulative_llm_token_count_prompt == 0
        assert parent_db_span.cumulative_llm_token_count_completion == 0
        assert parent_db_span.llm_token_count_prompt is None
        assert parent_db_span.llm_token_count_completion is None
        assert parent_db_span.attributes == {
            "openinference": {
                "span": {
                    "kind": "CHAIN",
                }
            },
            "custom_attr": "parent_value",
        }

        # check child span
        assert child_db_span.parent_id == parent_db_span.span_id
        assert child_db_span.name == "child"
        assert child_db_span.span_kind == "LLM"
        assert child_db_span.start_time <= child_db_span.end_time
        assert child_db_span.status_code == "OK"
        assert child_db_span.status_message == ""
        assert len(child_db_span.events) == 1
        event = child_db_span.events[0]

        event = child_db_span.events[0]
        assert event.pop("name") == "test_event"
        timestamp = event.pop("timestamp")
        assert isinstance(timestamp, str)
        try:
            datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            pytest.fail(f"timestamp {timestamp!r} is not a valid ISO 8601 string")
        assert event.pop("attributes") == {"event_key": "event_value"}
        assert not event
        assert child_db_span.cumulative_error_count == 0
        assert child_db_span.cumulative_llm_token_count_prompt == 0
        assert child_db_span.cumulative_llm_token_count_completion == 0
        assert child_db_span.llm_token_count_prompt is None
        assert child_db_span.llm_token_count_completion is None
        assert child_db_span.attributes == {
            "openinference": {
                "span": {
                    "kind": "LLM",
                }
            },
            "custom_attr": "child_value",
        }

    @pytest.mark.asyncio
    async def test_save_db_traces_handles_multiple_traces(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        with tracer.start_as_current_span(
            "trace1_span",
            attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
        ) as span1:
            span1.set_status(Status(StatusCode.OK))

        with tracer.start_as_current_span(
            "trace2_span",
            attributes={OPENINFERENCE_SPAN_KIND: "LLM"},
        ) as span2:
            span2.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_traces = (
                (
                    await session.execute(
                        select(models.Trace).options(joinedload(models.Trace.spans))
                    )
                )
                .scalars()
                .unique()
                .all()
            )

        assert len(returned_traces) == 2
        assert len(fetched_traces) == 2

        returned_spans = [span for trace in returned_traces for span in trace.spans]
        fetched_spans = [span for trace in fetched_traces for span in trace.spans]
        assert len(returned_spans) == 2
        assert len(fetched_spans) == 2

        # returned and fetched traces match
        assert set(returned_traces) == set(fetched_traces)
        assert len(returned_traces) == 2

        # all traces have correct project
        for trace in returned_traces:
            assert trace.project_rowid == project.id

        # returned and fetched spans match
        span1_returned = next(s for s in returned_spans if s.name == "trace1_span")
        span2_returned = next(s for s in returned_spans if s.name == "trace2_span")
        span1_fetched = next(s for s in fetched_spans if s.name == "trace1_span")
        span2_fetched = next(s for s in fetched_spans if s.name == "trace2_span")
        assert span1_returned == span1_fetched
        assert span2_returned == span2_fetched

        # each span belongs to a different trace
        assert span1_fetched.trace_rowid != span2_fetched.trace_rowid

        # verify span1 is associated with trace1
        trace1 = next(t for t in fetched_traces if t.id == span1_fetched.trace_rowid)
        trace2 = next(t for t in fetched_traces if t.id == span2_fetched.trace_rowid)
        assert trace1.trace_id != trace2.trace_id

        # check span1
        assert span1_fetched.parent_id is None
        assert span1_fetched.span_kind == "CHAIN"
        assert span1_fetched.status_code == "OK"

        # check span2
        assert span2_fetched.parent_id is None
        assert span2_fetched.span_kind == "LLM"
        assert span2_fetched.status_code == "OK"

    @pytest.mark.asyncio
    async def test_save_db_traces_does_not_clear_buffer(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        with tracer.start_as_current_span(
            "span",
            attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
        ):
            pass

        assert len(tracer._self_exporter.get_finished_spans()) == 1

        async with db() as session:
            await tracer.save_db_traces(session=session, project_id=project.id)

        assert len(tracer._self_exporter.get_finished_spans()) == 1  # buffer should not be cleared

    def test_clear_removes_captured_spans(self, tracer: Tracer) -> None:
        with tracer.start_as_current_span(
            "span1",
            attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
        ):
            pass

        with tracer.start_as_current_span(
            "span2",
            attributes={OPENINFERENCE_SPAN_KIND: "LLM"},
        ):
            pass

        assert len(tracer._self_exporter.get_finished_spans()) == 2

        tracer.clear()

        assert len(tracer._self_exporter.get_finished_spans()) == 0

    @pytest.mark.asyncio
    async def test_save_db_traces_persists_events_and_exceptions(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        with pytest.raises(ValueError, match="Test error message"):
            with tracer.start_as_current_span(
                "span",
                attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
            ):
                raise ValueError("Test error message")

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            db_spans = (await session.execute(select(models.Span))).scalars().all()

        returned_spans = returned_traces[0].spans
        assert len(returned_spans) == 1
        assert len(db_spans) == 1
        returned_span = returned_spans[0]
        db_span = db_spans[0]
        assert returned_span == db_span

        # check span fields
        assert returned_span.parent_id is None
        assert returned_span.name == "span"
        assert returned_span.span_kind == "CHAIN"
        assert returned_span.start_time <= returned_span.end_time
        assert returned_span.status_code == "ERROR"
        assert returned_span.status_message == "ValueError: Test error message"
        assert returned_span.cumulative_error_count == 1
        assert returned_span.cumulative_llm_token_count_prompt == 0
        assert returned_span.cumulative_llm_token_count_completion == 0
        assert returned_span.llm_token_count_prompt is None
        assert returned_span.llm_token_count_completion is None
        assert returned_span.attributes == {
            "openinference": {
                "span": {
                    "kind": "CHAIN",
                }
            },
        }

        # check events
        events = returned_span.events
        assert len(events) == 1
        event = dict(events[0])
        assert event.pop("name") == "exception"
        timestamp = event.pop("timestamp")
        try:
            datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            pytest.fail(f"timestamp {timestamp!r} is not a valid ISO 8601 string")
        event_attributes = event.pop("attributes")
        assert event_attributes.pop("exception.type") == "ValueError"
        assert event_attributes.pop("exception.message") == "Test error message"
        assert "Traceback" in event_attributes.pop("exception.stacktrace")
        assert event_attributes.pop("exception.escaped") == "False"
        assert not event_attributes
        assert not event

    @pytest.mark.asyncio
    async def test_save_db_traces_populates_llm_token_count_fields(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        prompt_tokens = 150
        completion_tokens = 75

        with tracer.start_as_current_span(
            "llm_call",
            attributes={
                OPENINFERENCE_SPAN_KIND: "LLM",
                LLM_TOKEN_COUNT_PROMPT: prompt_tokens,
                LLM_TOKEN_COUNT_COMPLETION: completion_tokens,
            },
        ) as span:
            span.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

        returned_spans = returned_traces[0].spans
        assert len(returned_spans) == 1
        assert len(fetched_spans) == 1

        returned_span = returned_spans[0]
        fetched_span = fetched_spans[0]
        assert returned_span == fetched_span

        # Verify token count fields
        assert fetched_span.llm_token_count_prompt == prompt_tokens
        assert fetched_span.llm_token_count_completion == completion_tokens
        assert fetched_span.llm_token_count_total == prompt_tokens + completion_tokens
        assert fetched_span.cumulative_llm_token_count_prompt == prompt_tokens
        assert fetched_span.cumulative_llm_token_count_completion == completion_tokens
        assert fetched_span.cumulative_llm_token_count_total == prompt_tokens + completion_tokens

    @pytest.mark.asyncio
    async def test_save_db_traces_handles_llm_spans_without_token_counts(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        with tracer.start_as_current_span(
            "llm_call_no_tokens",
            attributes={
                OPENINFERENCE_SPAN_KIND: "LLM",
            },
        ) as span:
            span.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

        returned_spans = returned_traces[0].spans
        assert len(returned_spans) == 1
        fetched_span = fetched_spans[0]

        assert fetched_span.llm_token_count_prompt is None
        assert fetched_span.llm_token_count_completion is None
        assert fetched_span.cumulative_llm_token_count_prompt == 0
        assert fetched_span.cumulative_llm_token_count_completion == 0
        assert fetched_span.llm_token_count_total == 0
        assert fetched_span.cumulative_llm_token_count_total == 0

    @pytest.mark.asyncio
    async def test_save_db_traces_correctly_computes_cumulative_counts(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        # Create a hierarchy:
        #   parent (no tokens, OK)
        #   ├── child1 (100 prompt + 50 completion, ERROR)
        #   └── child2 (no tokens, OK)
        #       └── grandchild (200 prompt + 75 completion, ERROR)
        #
        # --- Expected cumulative prompt token counts ---
        #   parent:     300 (sum of all descendants)
        #   child1:     100 (own tokens only)
        #   child2:     200 (grandchild's tokens)
        #   grandchild: 200 (own tokens only)
        #
        # --- Expected cumulative completion token counts ---
        #   parent:     125 (sum of all descendants)
        #   child1:     50  (own tokens only)
        #   child2:     75  (grandchild's tokens)
        #   grandchild: 75  (own tokens only)
        #
        # Expected cumulative error counts:
        #   parent: 2 errors (child1 + grandchild)
        #   child1: 1 error (own error)
        #   child2: 1 error (grandchild's error)
        #   grandchild: 1 error (own error)

        with tracer.start_as_current_span(
            "parent",
            attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
        ) as parent:
            with tracer.start_as_current_span(
                "child1",
                attributes={
                    OPENINFERENCE_SPAN_KIND: "LLM",
                    LLM_TOKEN_COUNT_PROMPT: 100,
                    LLM_TOKEN_COUNT_COMPLETION: 50,
                },
            ) as child1:
                child1.set_status(Status(StatusCode.ERROR, "child1 failed"))

            with tracer.start_as_current_span(
                "child2",
                attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
            ) as child2:
                with tracer.start_as_current_span(
                    "grandchild",
                    attributes={
                        OPENINFERENCE_SPAN_KIND: "LLM",
                        LLM_TOKEN_COUNT_PROMPT: 200,
                        LLM_TOKEN_COUNT_COMPLETION: 75,
                    },
                ) as grandchild:
                    grandchild.set_status(Status(StatusCode.ERROR, "grandchild failed"))
                child2.set_status(Status(StatusCode.OK))

            parent.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

        returned_spans = returned_traces[0].spans
        assert len(returned_spans) == 4
        assert len(fetched_spans) == 4

        # Get spans by name
        parent_span = next(s for s in fetched_spans if s.name == "parent")
        child1_span = next(s for s in fetched_spans if s.name == "child1")
        child2_span = next(s for s in fetched_spans if s.name == "child2")
        grandchild_span = next(s for s in fetched_spans if s.name == "grandchild")

        # Verify parent cumulative includes all descendants
        assert parent_span.cumulative_error_count == 2
        assert parent_span.cumulative_llm_token_count_prompt == 300
        assert parent_span.cumulative_llm_token_count_completion == 125
        assert parent_span.cumulative_llm_token_count_total == 425
        assert parent_span.llm_token_count_prompt is None
        assert parent_span.llm_token_count_completion is None

        # Verify child1 has only its own counts
        assert child1_span.cumulative_error_count == 1
        assert child1_span.cumulative_llm_token_count_prompt == 100
        assert child1_span.cumulative_llm_token_count_completion == 50
        assert child1_span.cumulative_llm_token_count_total == 150
        assert child1_span.llm_token_count_prompt == 100
        assert child1_span.llm_token_count_completion == 50

        # Verify child2 cumulative includes grandchild
        assert child2_span.cumulative_error_count == 1
        assert child2_span.cumulative_llm_token_count_prompt == 200
        assert child2_span.cumulative_llm_token_count_completion == 75
        assert child2_span.cumulative_llm_token_count_total == 275
        assert child2_span.llm_token_count_prompt is None
        assert child2_span.llm_token_count_completion is None

        # Verify grandchild has only its own counts
        assert grandchild_span.cumulative_error_count == 1
        assert grandchild_span.cumulative_llm_token_count_prompt == 200
        assert grandchild_span.cumulative_llm_token_count_completion == 75
        assert grandchild_span.cumulative_llm_token_count_total == 275
        assert grandchild_span.llm_token_count_prompt == 200
        assert grandchild_span.llm_token_count_completion == 75

    @pytest.mark.asyncio
    async def test_save_db_traces_calculates_costs_for_llm_spans(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        gpt_4o_mini_generative_model: models.GenerativeModel,
    ) -> None:
        prompt_tokens = 1000
        completion_tokens = 500

        with tracer.start_as_current_span(
            "llm_call",
            attributes={
                OPENINFERENCE_SPAN_KIND: "LLM",
                LLM_MODEL_NAME: "gpt-4o-mini",
                LLM_PROVIDER: "openai",
                LLM_TOKEN_COUNT_PROMPT: prompt_tokens,
                LLM_TOKEN_COUNT_COMPLETION: completion_tokens,
            },
        ) as span:
            span.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_traces: Sequence[models.Trace] = (
                (
                    await session.scalars(
                        select(models.Trace).options(
                            joinedload(models.Trace.spans)
                            .joinedload(models.Span.span_cost)
                            .joinedload(models.SpanCost.span_cost_details)
                        )
                    )
                )
                .unique()
                .all()
            )

        # Ensure:
        # (1) orm relationships are properly set
        # (2) returned and fetched orms match
        assert len(returned_traces) == 1
        assert len(fetched_traces) == 1
        returned_trace = returned_traces[0]
        fetched_trace = fetched_traces[0]
        assert returned_trace == fetched_trace
        returned_spans = returned_trace.spans
        fetched_spans = fetched_trace.spans
        assert len(returned_spans) == 1
        assert len(fetched_spans) == 1
        returned_span = returned_spans[0]
        fetched_span = fetched_spans[0]
        assert returned_span == fetched_span
        returned_span_cost = returned_span.span_cost
        fetched_span_cost = fetched_span.span_cost
        assert returned_span_cost is not None
        assert fetched_span_cost is not None
        assert returned_span_cost == fetched_span_cost
        returned_span_cost_details = returned_span_cost.span_cost_details
        fetched_span_cost_details = fetched_span_cost.span_cost_details
        assert len(returned_span_cost_details) == 2
        assert len(fetched_span_cost_details) == 2
        returned_input_detail = next(d for d in returned_span_cost_details if d.is_prompt)
        returned_output_detail = next(d for d in returned_span_cost_details if not d.is_prompt)
        fetched_input_detail = next(d for d in fetched_span_cost_details if d.is_prompt)
        fetched_output_detail = next(d for d in fetched_span_cost_details if not d.is_prompt)
        assert returned_input_detail is not None
        assert fetched_input_detail is not None
        assert returned_output_detail is not None
        assert fetched_output_detail is not None
        assert returned_input_detail == fetched_input_detail
        assert returned_output_detail == fetched_output_detail

        # Verify span costs
        assert returned_span_cost.span_rowid == returned_span.id
        assert returned_span_cost.trace_rowid == returned_span.trace_rowid
        assert returned_span_cost.model_id == gpt_4o_mini_generative_model.id
        assert returned_span_cost.span_start_time == returned_span.start_time
        prompt_token_prices = next(
            p for p in gpt_4o_mini_generative_model.token_prices if p.is_prompt
        )
        completion_token_prices = next(
            p for p in gpt_4o_mini_generative_model.token_prices if not p.is_prompt
        )
        prompt_base_rate = prompt_token_prices.base_rate
        completion_base_rate = completion_token_prices.base_rate
        expected_prompt_cost = prompt_tokens * prompt_base_rate
        expected_completion_cost = completion_tokens * completion_base_rate
        expected_total_cost = expected_prompt_cost + expected_completion_cost
        assert expected_prompt_cost == pytest.approx(0.00015)  # (1000 * $0.15/1M) = $0.00015
        assert expected_completion_cost == pytest.approx(0.0003)  # (500 * $0.60/1M) = $0.0003
        assert expected_total_cost == pytest.approx(0.00045)  # $0.00015 + $0.0003 = $0.00045
        assert returned_span_cost.total_cost == pytest.approx(expected_total_cost)
        assert returned_span_cost.total_tokens == prompt_tokens + completion_tokens
        assert returned_span_cost.prompt_tokens == prompt_tokens
        assert returned_span_cost.prompt_cost == pytest.approx(expected_prompt_cost)
        assert returned_span_cost.completion_tokens == completion_tokens
        assert returned_span_cost.completion_cost == pytest.approx(expected_completion_cost)

        # Verify span cost details

        assert returned_input_detail.span_cost_id == returned_span_cost.id
        assert returned_input_detail.token_type == "input"
        assert returned_input_detail.is_prompt is True
        assert returned_input_detail.tokens == prompt_tokens
        assert returned_input_detail.cost == pytest.approx(expected_prompt_cost)
        assert returned_input_detail.cost_per_token == prompt_base_rate

        assert returned_output_detail.span_cost_id == returned_span_cost.id
        assert returned_output_detail.token_type == "output"
        assert returned_output_detail.is_prompt is False
        assert returned_output_detail.tokens == completion_tokens
        assert returned_output_detail.cost == pytest.approx(expected_completion_cost)
        assert returned_output_detail.cost_per_token == completion_base_rate

    @pytest.mark.asyncio
    async def test_save_db_traces_skips_costs_for_non_llm_spans(
        self,
        db: DbSessionFactory,
        project: models.Project,
        tracer: Tracer,
        gpt_4o_mini_generative_model: models.GenerativeModel,
    ) -> None:
        with tracer.start_as_current_span(
            "chain_call",
            attributes={
                OPENINFERENCE_SPAN_KIND: "CHAIN",
            },
        ) as span:
            span.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_traces = (
                (
                    await session.execute(
                        select(models.Trace).options(
                            joinedload(models.Trace.spans)
                            .joinedload(models.Span.span_cost)
                            .joinedload(models.SpanCost.span_cost_details)
                        )
                    )
                )
                .scalars()
                .unique()
                .all()
            )

        # Ensure:
        # (1) orm relationships are properly set
        # (2) returned and fetched orms match
        assert len(returned_traces) == 1
        assert len(fetched_traces) == 1
        returned_trace = returned_traces[0]
        fetched_trace = fetched_traces[0]
        assert returned_trace == fetched_trace
        returned_spans = returned_trace.spans
        fetched_spans = fetched_trace.spans
        assert len(returned_spans) == 1
        assert len(fetched_spans) == 1
        returned_span = returned_spans[0]
        fetched_span = fetched_spans[0]
        assert returned_span == fetched_span
        returned_span_cost = returned_span.span_cost
        fetched_span_cost = fetched_span.span_cost
        assert returned_span_cost is None
        assert fetched_span_cost is None

    @pytest.mark.asyncio
    async def test_save_db_traces_handles_missing_pricing_model(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        prompt_tokens = 100
        completion_tokens = 50

        with tracer.start_as_current_span(
            "llm_call",
            attributes={
                OPENINFERENCE_SPAN_KIND: "LLM",
                LLM_MODEL_NAME: "unknown-model",
                LLM_TOKEN_COUNT_PROMPT: prompt_tokens,
                LLM_TOKEN_COUNT_COMPLETION: completion_tokens,
            },
        ) as span:
            span.set_status(Status(StatusCode.OK))

        async with db() as session:
            returned_traces = await tracer.save_db_traces(session=session, project_id=project.id)
            fetched_traces = (
                (
                    await session.execute(
                        select(models.Trace).options(
                            joinedload(models.Trace.spans)
                            .joinedload(models.Span.span_cost)
                            .joinedload(models.SpanCost.span_cost_details)
                        )
                    )
                )
                .scalars()
                .unique()
                .all()
            )

        # Ensure:
        # (1) orm relationships are properly set
        # (2) returned and fetched orms match
        assert len(returned_traces) == 1
        assert len(fetched_traces) == 1
        returned_trace = returned_traces[0]
        fetched_trace = fetched_traces[0]
        assert returned_trace == fetched_trace
        returned_spans = returned_trace.spans
        fetched_spans = fetched_trace.spans
        assert len(returned_spans) == 1
        assert len(fetched_spans) == 1
        returned_span = returned_spans[0]
        fetched_span = fetched_spans[0]
        assert returned_span == fetched_span
        returned_span_cost = returned_span.span_cost
        fetched_span_cost = fetched_span.span_cost
        assert returned_span_cost is not None
        assert fetched_span_cost is not None
        assert returned_span_cost == fetched_span_cost
        returned_span_cost_details = returned_span_cost.span_cost_details
        fetched_span_cost_details = fetched_span_cost.span_cost_details
        assert len(returned_span_cost_details) == 2
        assert len(fetched_span_cost_details) == 2
        returned_input_detail = next(d for d in returned_span_cost_details if d.is_prompt)
        returned_output_detail = next(d for d in returned_span_cost_details if not d.is_prompt)
        fetched_input_detail = next(d for d in fetched_span_cost_details if d.is_prompt)
        fetched_output_detail = next(d for d in fetched_span_cost_details if not d.is_prompt)
        assert returned_input_detail is not None
        assert fetched_input_detail is not None
        assert returned_output_detail is not None
        assert fetched_output_detail is not None
        assert returned_input_detail == fetched_input_detail
        assert returned_output_detail == fetched_output_detail

        # Verify span costs
        assert returned_span_cost.span_rowid == returned_span.id
        assert returned_span_cost.trace_rowid == returned_span.trace_rowid
        assert returned_span_cost.model_id is None  # no pricing model found
        assert returned_span_cost.span_start_time == returned_span.start_time
        assert returned_span_cost.total_cost is None  # no pricing model found
        assert returned_span_cost.total_tokens == prompt_tokens + completion_tokens
        assert returned_span_cost.prompt_tokens == prompt_tokens
        assert returned_span_cost.prompt_cost is None  # no pricing model found
        assert returned_span_cost.completion_tokens == completion_tokens
        assert returned_span_cost.completion_cost is None  # no pricing model found

        # Verify span cost details
        assert returned_input_detail.span_cost_id == returned_span_cost.id
        assert returned_input_detail.token_type == "input"
        assert returned_input_detail.is_prompt is True
        assert returned_input_detail.tokens == prompt_tokens
        assert returned_input_detail.cost is None  # no pricing model found
        assert returned_input_detail.cost_per_token is None  # no pricing model found

        assert returned_output_detail.span_cost_id == returned_span_cost.id
        assert returned_output_detail.token_type == "output"
        assert returned_output_detail.is_prompt is False
        assert returned_output_detail.tokens == completion_tokens
        assert returned_output_detail.cost is None  # no pricing model found
        assert returned_output_detail.cost_per_token is None  # no pricing model found


# span attributes
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
