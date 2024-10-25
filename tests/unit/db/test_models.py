from datetime import datetime, timezone
from typing import Any, Dict, Generic, Optional, Tuple, Type, TypeVar, cast

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.chat_message import Message, MessageEntry
from phoenix.server.types import DbSessionFactory

_RecordT = TypeVar("_RecordT", bound=models.Base)


class _TableTest(Generic[_RecordT]):
    table: Type[_RecordT]

    @classmethod
    async def get(cls, session: AsyncSession, id_: int) -> Optional[_RecordT]:
        return cast(Optional[_RecordT], await session.scalar(select(cls.table).filter_by(id=id_)))


class TestTrace(_TableTest[models.Trace]):
    table: Type[models.Trace] = models.Trace

    async def test_delete_cascade(self, db: DbSessionFactory) -> None:
        async with db() as session:
            _, trace, project = await _add_span(session)
            await session.delete(project)
            assert await self.get(session, trace.id) is None


class TestSpan(_TableTest[models.Span]):
    table: Type[models.Span] = models.Span

    @pytest.mark.parametrize("i", [0, 1])
    async def test_delete_cascade(self, i: int, db: DbSessionFactory) -> None:
        async with db() as session:
            span, trace, project = await _add_span(session)
            await session.delete([trace, project][i])
            assert await self.get(session, span.id) is None

    @pytest.mark.parametrize(
        "attributes,expected",
        [
            (
                {
                    "llm": {
                        "output_messages": [
                            {"message": {"role": "user", "content": "123"}},
                            {},
                            {"message": {"role": "user", "content": "321"}},
                        ]
                    }
                },
                MessageEntry(message=Message(role="user", content="123")),
            ),
            (
                {
                    "llm": {
                        "output_messages": [
                            {},
                            {"message": {"role": "user", "content": "123"}},
                            {"message": {"role": "user", "content": "321"}},
                        ]
                    }
                },
                None,
            ),
            ({}, None),
            ({"llm": {}}, None),
            ({"llm": {"output_messages": []}}, None),
            ({"llm": {"output_messages": [{}]}}, None),
            ({"llm": {"output_messages": [{"message": {}}]}}, None),
            ({"llm": {"output_messages": [{"role": "user", "content": "123"}]}}, None),
        ],
    )
    async def test_first_output_message(
        self,
        db: DbSessionFactory,
        attributes: Dict[str, Any],
        expected: Optional[MessageEntry],
    ) -> None:
        async with db() as session:
            span, *_ = await _add_span(session, attributes)
            assert span.first_output_message == expected
            assert await session.scalar(select(models.Span.first_output_message)) == expected

    @pytest.mark.parametrize(
        "attributes,expected",
        [
            (
                {
                    "llm": {
                        "input_messages": [
                            {"message": {"role": "user", "content": "123"}},
                            {},
                            {"message": {"role": "user", "content": "321"}},
                        ]
                    }
                },
                MessageEntry(message=Message(role="user", content="321")),
            ),
            (
                {
                    "llm": {
                        "input_messages": [
                            {"message": {"role": "user", "content": "123"}},
                            {"message": {"role": "user", "content": "321"}},
                            {},
                        ]
                    }
                },
                None,
            ),
            ({}, None),
            ({"llm": {}}, None),
            ({"llm": {"input_messages": []}}, None),
            ({"llm": {"input_messages": [{}]}}, None),
            ({"llm": {"input_messages": [{"message": {}}]}}, None),
            ({"llm": {"input_messages": [{"role": "user", "content": "xyz"}]}}, None),
        ],
    )
    async def test_last_input_message(
        self,
        db: DbSessionFactory,
        attributes: Dict[str, Any],
        expected: Optional[MessageEntry],
    ) -> None:
        async with db() as session:
            span, *_ = await _add_span(session, attributes)
            assert span.last_input_message == expected
            assert await session.scalar(select(models.Span.last_input_message)) == expected


async def test_projects_with_session_injection(
    db: DbSessionFactory,
    project: Any,
) -> None:
    # this test demonstrates parametrizing the session fixture
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_projects_with_db_injection(
    db: DbSessionFactory,
    project: Any,
) -> None:
    # this test demonstrates mixing the db and model fixtures
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_empty_projects(
    db: DbSessionFactory,
) -> None:
    # shows that databases are reset between tests
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert not result


class TestChatSessionSpan(_TableTest[models.ChatSessionSpan]):
    table: Type[models.ChatSessionSpan] = models.ChatSessionSpan

    @pytest.mark.parametrize("i", [0, 1, 2])
    async def test_delete_cascade(self, i: int, db: DbSessionFactory) -> None:
        async with db() as session:
            chat_session_span, _, span, trace, project = await _add_chat_session_span(session)
            await session.delete([span, trace, project][i])
            assert await self.get(session, chat_session_span.id) is None


class TestProjectSession(_TableTest[models.ProjectSession]):
    table: Type[models.ProjectSession] = models.ProjectSession

    @pytest.mark.skip("TODO: work in progress")
    @pytest.mark.parametrize("i", [0, 1, 2])
    async def test_delete_trigger(self, i: int, db: DbSessionFactory) -> None:
        async with db() as session:
            _, project_session, span, trace, project = await _add_chat_session_span(session)
            await session.delete([span, trace, project][i])
            assert await self.get(session, project_session.id) is None


async def _add_span(
    session: AsyncSession,
    attributes: Optional[Dict[str, Any]] = None,
) -> Tuple[
    models.Span,
    models.Trace,
    models.Project,
]:
    project = models.Project(name="test_project")
    trace_id = "test_trace_id"
    trace = models.Trace(
        trace_id=trace_id,
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
    )
    span_id = "test_span_id"
    span = models.Span(
        name="test_span",
        span_id=span_id,
        parent_id=None,
        span_kind="test_span_kind",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        status_code="OK",
        status_message="test_status_message",
        cumulative_error_count=0,
        cumulative_llm_token_count_prompt=0,
        cumulative_llm_token_count_completion=0,
        attributes=attributes or {},
    )
    session.add(project)
    await session.flush()
    assert await session.scalar(select(models.Project.id).filter_by(id=project.id)) == project.id
    trace.project_rowid = project.id
    session.add(trace)
    await session.flush()
    assert isinstance(await TestTrace.get(session, trace.id), models.Trace)
    span.trace_rowid = trace.id
    session.add(span)
    await session.flush()
    assert isinstance(await TestSpan.get(session, span.id), models.Span)
    return (
        span,
        trace,
        project,
    )


async def _add_chat_session_span(
    session: AsyncSession,
) -> Tuple[
    models.ChatSessionSpan,
    models.ProjectSession,
    models.Span,
    models.Trace,
    models.Project,
]:
    span, trace, project = await _add_span(session)
    session_id = "test_session_id"
    session_user = "test_session_user"
    project_session = models.ProjectSession(
        session_id=session_id,
        session_user=session_user,
        project_id=span.trace.project_rowid,
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
    )
    session.add(project_session)
    await session.flush()
    assert isinstance(
        await TestProjectSession.get(session, project_session.id),
        models.ProjectSession,
    )
    chat_session_span = models.ChatSessionSpan(
        session_rowid=project_session.id,
        session_id=session_id,
        session_user=session_user,
        timestamp=datetime.now(timezone.utc),
        span_rowid=span.id,
        trace_rowid=span.trace.id,
        project_id=span.trace.project_rowid,
    )
    session.add(chat_session_span)
    await session.flush()
    assert isinstance(
        await TestChatSessionSpan.get(session, chat_session_span.id),
        models.ChatSessionSpan,
    )
    return (
        chat_session_span,
        project_session,
        span,
        trace,
        project,
    )
