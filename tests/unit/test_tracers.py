from datetime import datetime

import pytest
from openinference.semconv.trace import SpanAttributes
from opentelemetry.trace import Status, StatusCode
from sqlalchemy import select

from phoenix.db import models
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
    def tracer(self) -> Tracer:
        return Tracer()

    @pytest.mark.asyncio
    async def test_save_db_models_persists_nested_spans(
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
            returned_traces, returned_spans = await tracer.save_db_models(
                session=session, project_id=project.id
            )
            fetched_traces = (await session.execute(select(models.Trace))).scalars().all()
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

        assert len(returned_traces) == 1
        assert len(fetched_traces) == 1
        assert len(returned_spans) == 2
        assert len(fetched_spans) == 2

        # returned and fetched traces match
        returned_trace = returned_traces[0]
        fetched_trace = fetched_traces[0]
        assert returned_trace == fetched_trace
        assert returned_trace.project_rowid == project.id

        # returned and fetched spans match
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
    async def test_save_db_models_handles_multiple_traces(
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
            returned_traces, returned_spans = await tracer.save_db_models(
                session=session, project_id=project.id
            )
            fetched_traces = (await session.execute(select(models.Trace))).scalars().all()
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

        assert len(returned_traces) == 2
        assert len(fetched_traces) == 2
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
    async def test_save_db_models_does_not_clear_buffer(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        with tracer.start_as_current_span(
            "span",
            attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
        ):
            pass

        assert len(tracer._self_exporter.get_finished_spans()) == 1

        async with db() as session:
            await tracer.save_db_models(session=session, project_id=project.id)

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
    async def test_save_db_models_persists_events_and_exceptions(
        self, db: DbSessionFactory, project: models.Project, tracer: Tracer
    ) -> None:
        with pytest.raises(ValueError, match="Test error message"):
            with tracer.start_as_current_span(
                "span",
                attributes={OPENINFERENCE_SPAN_KIND: "CHAIN"},
            ):
                raise ValueError("Test error message")

        async with db() as session:
            _, returned_spans = await tracer.save_db_models(session=session, project_id=project.id)
            db_spans = (await session.execute(select(models.Span))).scalars().all()

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
    async def test_save_db_models_populates_llm_token_count_fields(
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
            _, returned_spans = await tracer.save_db_models(session=session, project_id=project.id)
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

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
    async def test_save_db_models_handles_llm_spans_without_token_counts(
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
            _, returned_spans = await tracer.save_db_models(session=session, project_id=project.id)
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

        assert len(returned_spans) == 1
        fetched_span = fetched_spans[0]

        assert fetched_span.llm_token_count_prompt is None
        assert fetched_span.llm_token_count_completion is None
        assert fetched_span.cumulative_llm_token_count_prompt == 0
        assert fetched_span.cumulative_llm_token_count_completion == 0
        assert fetched_span.llm_token_count_total == 0
        assert fetched_span.cumulative_llm_token_count_total == 0

    @pytest.mark.asyncio
    async def test_save_db_models_correctly_computes_cumulative_counts(
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
            _, returned_spans = await tracer.save_db_models(session=session, project_id=project.id)
            fetched_spans = (await session.execute(select(models.Span))).scalars().all()

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


OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
