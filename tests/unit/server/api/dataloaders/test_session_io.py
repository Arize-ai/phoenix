from datetime import datetime, timedelta

from phoenix.db.session_aggregates import root_span_io_value_by_session
from phoenix.server.api.dataloaders.session_io import SessionIODataLoader
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace


async def test_displayed_session_io_and_the_filter_term_select_the_same_root_span(
    db: DbSessionFactory,
) -> None:
    """`first_input` filters on the span the sessions table displays, not a sibling of it.

    One trace can carry more than one root span, and the two orderings only separate there:
    if they drifted, the table would show one span's value while the filter evaluated another.
    """
    base_time = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project, start_time=base_time)
        earliest_trace = await _add_trace(session, project, project_session, start_time=base_time)
        # Two root spans on the earliest trace: same trace start time and trace id, so only
        # the span-id tie-break can pick between them.
        first_root_span = await _add_span(
            session,
            earliest_trace,
            attributes={"input": {"value": "first root span"}},
            start_time=base_time,
        )
        await _add_span(
            session,
            earliest_trace,
            attributes={"input": {"value": "second root span"}},
            start_time=base_time,
        )
        # A later trace, so neither ordering can be satisfied by having one trace only.
        later_trace = await _add_trace(
            session, project, project_session, start_time=base_time + timedelta(seconds=30)
        )
        await _add_span(
            session,
            later_trace,
            attributes={"input": {"value": "later trace"}},
            start_time=base_time + timedelta(seconds=30),
        )
        await session.flush()
        project_session_id = project_session.id
        first_root_span_id = first_root_span.id

    displayed = await SessionIODataLoader(db, "first_input").load(project_session_id)
    async with db() as session:
        filtered = (
            await session.execute(
                root_span_io_value_by_session("first_input", keys=[project_session_id])
            )
        ).all()

    assert displayed is not None
    assert displayed.span_rowid == first_root_span_id
    assert displayed.truncated_value == "first root span"
    assert filtered == [(project_session_id, "first root span")]
