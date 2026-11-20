import asyncio
import gc
import json
import time
import warnings
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from unittest.mock import AsyncMock, patch

import anyio
import httpx2
import pytest
from _pytest.fixtures import SubRequest
from sqlalchemy import event, select, text
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.types import ASGIApp, Message
from strawberry.relay import GlobalID

from phoenix.server.api import request_connections
from phoenix.server.api.helpers import evaluator_preview
from phoenix.server.api.request_connections import (
    MAX_CONNECTIONS_PER_REQUEST,
    RequestDbSessionFactory,
)
from phoenix.server.app import _db
from phoenix.server.evaluators.runtime.base import EvaluationResult
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from ..._helpers import _add_project, _add_span, _add_trace

_ACCEPT = "multipart/mixed; deferSpec=20220824, application/json"

_FIRST_PAGE = """
query ($id: ID!) {
  node(id: $id) {
    ... on Project {
      name
      spans(first: 10, filterCondition: "parent_id is None") {
        edges {
          span: node {
            name
            trace { traceId }
            spanAnnotations { name }
            costSummary { total { cost } }
          }
        }
      }
      ... @defer(label: "names") { spanAnnotationNames traceAnnotationNames }
    }
  }
}
"""

_ROWS_THEN_NAMES = """
query ($id: ID!) {
  node(id: $id) {
    ... on Project {
      name
      spans(first: 10) { edges { span: node { name } } }
      ... @defer(label: "names") { spanAnnotationNames }
    }
  }
}
"""

_ROWS_ONLY = """
query ($id: ID!) {
  node(id: $id) {
    ... on Project {
      name
      spans(first: 10) { edges { span: node { name trace { traceId } } } }
    }
  }
}
"""


@pytest.fixture(autouse=True)
def _no_connection_left_to_the_garbage_collector() -> Iterator[None]:
    """A connection dropped without being returned is reclaimed by the garbage
    collector with a warning; that is a leak. Earlier tests' garbage is collected
    first, so that it is not counted against this one."""
    gc.collect()
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        yield
        gc.collect()
    assert not [w for w in caught if "garbage collector is trying to clean up" in str(w.message)]


@pytest.fixture(autouse=True)
async def _let_checkouts_and_releases_finish() -> AsyncIterator[None]:
    """A pool checkout a session no longer wants finishes in the background; the test's
    event loop must not close under it."""
    yield
    deadline = time.perf_counter() + 10
    while pending := [task for task in request_connections._background_tasks if not task.done()]:
        await asyncio.wait(pending, timeout=max(0.0, deadline - time.perf_counter()))
        if time.perf_counter() >= deadline:
            break
        await asyncio.sleep(0)


@pytest.fixture
def pool(request: SubRequest) -> Optional[tuple[int, float, int]]:
    """A pool of this many connections that waits this many seconds for one and may
    open this many more, in place of the default pool."""
    return getattr(request, "param", None)


@pytest.fixture
def engine(
    request: SubRequest, dialect: str, pool: Optional[tuple[int, float, int]]
) -> AsyncEngine:
    if dialect != "postgresql":
        pytest.skip("requests share connections on PostgreSQL only")
    default: AsyncEngine = request.getfixturevalue("postgresql_engine")
    if pool is None:
        return default
    size, timeout, overflow = pool
    return create_async_engine(
        default.url,
        pool_size=size,
        max_overflow=overflow,
        pool_timeout=timeout,
        pool_pre_ping=True,
    )


@pytest.fixture
async def db(
    engine: AsyncEngine, pool: Optional[tuple[int, float, int]]
) -> AsyncIterator[DbSessionFactory]:
    yield DbSessionFactory(db=_db(engine), dialect="postgresql")
    if pool is not None:
        await engine.dispose()


async def _add_first_page(db: DbSessionFactory) -> str:
    now = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        for index in range(3):
            trace = await _add_trace(session, project, start_time=now - timedelta(minutes=index))
            root = await _add_span(session, trace=trace, start_time=trace.start_time)
            await _add_span(session, parent_span=root, start_time=trace.start_time)
    return str(GlobalID("Project", str(project.id)))


async def _warm(engine: AsyncEngine, connections: int) -> None:
    """Leaves this many idle connections in the pool."""
    opened = [await engine.connect() for _ in range(connections)]
    for connection in opened:
        await connection.close()


def _checked_out(engine: AsyncEngine) -> int:
    return int(engine.pool.checkedout())  # type: ignore[attr-defined]


async def _settle(engine: AsyncEngine, seconds: float = 2.0) -> int:
    """The pool's checked-out count once it reaches 0, or after this many seconds."""
    deadline = time.perf_counter() + seconds
    while _checked_out(engine) and time.perf_counter() < deadline:
        await asyncio.sleep(0.02)
    return _checked_out(engine)


class _Checkouts:
    def __init__(self) -> None:
        self.count = 0
        self.held = 0
        self.most_held = 0

    def checked_out(self, *_: Any) -> None:
        self.count += 1
        self.held += 1
        self.most_held = max(self.most_held, self.held)

    def checked_in(self, *_: Any) -> None:
        self.held -= 1


@contextmanager
def _count_checkouts(engine: AsyncEngine) -> Iterator[_Checkouts]:
    checkouts = _Checkouts()
    event.listen(engine.sync_engine, "checkout", checkouts.checked_out)
    event.listen(engine.sync_engine, "checkin", checkouts.checked_in)
    try:
        yield checkouts
    finally:
        event.remove(engine.sync_engine, "checkout", checkouts.checked_out)
        event.remove(engine.sync_engine, "checkin", checkouts.checked_in)


@asynccontextmanager
async def _locked(engine: AsyncEngine, table: str) -> AsyncIterator[Callable[[], None]]:
    """Locks a table from outside the pool until the returned function is called or the
    block ends, so that statements reading it wait."""
    outside = create_async_engine(engine.url, poolclass=NullPool)
    unlock = asyncio.Event()
    locked = asyncio.Event()

    async def hold() -> None:
        async with outside.connect() as connection:
            await connection.execute(text(f"LOCK TABLE {table} IN ACCESS EXCLUSIVE MODE"))
            locked.set()
            await unlock.wait()
            await connection.rollback()

    holder = asyncio.create_task(hold())
    await locked.wait()
    try:
        yield unlock.set
    finally:
        unlock.set()
        await holder
        await outside.dispose()


@contextmanager
def _taking_what_the_page_gives_back(
    engine: AsyncEngine, holders: list["asyncio.Task[None]"], seconds: float = 1.5
) -> Iterator[Callable[[float], Awaitable[None]]]:
    """Whenever the page gives a connection back, another request takes it and holds it
    for longer than the pool waits."""
    held_by_holders: set[int] = set()

    async def hold(seconds: float, ready: Optional[asyncio.Event] = None) -> None:
        try:
            async with engine.connect():
                if ready is not None:
                    ready.set()
                await asyncio.sleep(seconds)
        except Exception:
            pass

    async def hold_first(seconds: float) -> None:
        ready = asyncio.Event()
        holders.append(asyncio.create_task(hold(seconds, ready)))
        await ready.wait()

    def note_a_holder_s_checkout(_: Any, record: Any, __: Any) -> None:
        if asyncio.current_task() in holders:
            held_by_holders.add(id(record))

    def take_what_the_page_gives_back(_: Any, record: Any) -> None:
        if id(record) in held_by_holders:
            held_by_holders.discard(id(record))
        else:
            holders.append(asyncio.get_running_loop().create_task(hold(seconds)))

    event.listen(engine.sync_engine, "checkout", note_a_holder_s_checkout)
    event.listen(engine.sync_engine, "checkin", take_what_the_page_gives_back)
    try:
        yield hold_first
    finally:
        event.remove(engine.sync_engine, "checkout", note_a_holder_s_checkout)
        event.remove(engine.sync_engine, "checkin", take_what_the_page_gives_back)


def _parts(response: httpx2.Response) -> list[dict[str, Any]]:
    if not response.headers["content-type"].startswith("multipart/"):
        return [response.json()]
    parts = []
    for segment in ("\r\n" + response.text).split("\r\n---")[1:]:
        _, _, payload = segment.partition("\r\n\r\n")
        if payload.strip():
            parts.append(json.loads(payload))
    return parts


async def _post(
    httpx_client: httpx2.AsyncClient, project_id: str, query: str = _FIRST_PAGE
) -> list[dict[str, Any]]:
    response = await httpx_client.post(
        "/graphql",
        json={"query": query, "variables": {"id": project_id}},
        headers={"accept": _ACCEPT},
    )
    assert response.status_code == 200
    return _parts(response)


def _http_scope() -> dict[str, Any]:
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/graphql",
        "raw_path": b"/graphql",
        "query_string": b"",
        "root_path": "",
        "headers": [(b"content-type", b"application/json"), (b"accept", _ACCEPT.encode())],
        "server": ("test", 80),
        "client": ("test", 1234),
    }


def _sharing_factory(db: DbSessionFactory) -> RequestDbSessionFactory:
    factory = RequestDbSessionFactory(db)
    factory.share_connections()
    return factory


async def test_a_first_page_on_a_pool_with_idle_connections_takes_two_connections(
    db: DbSessionFactory, engine: AsyncEngine, httpx_client: httpx2.AsyncClient
) -> None:
    project_id = await _add_first_page(db)
    await _warm(engine, 4)

    with _count_checkouts(engine) as checkouts:
        initial, *_ = await _post(httpx_client, project_id)

    assert "errors" not in initial
    assert len(initial["data"]["node"]["spans"]["edges"]) == 3
    assert MAX_CONNECTIONS_PER_REQUEST == 2
    assert (checkouts.count, checkouts.most_held) == (2, 2)


@pytest.mark.parametrize("pool", [(3, 5.0, 3)], indirect=True)
async def test_a_request_takes_a_second_shared_connection_only_when_the_pool_has_one_idle(
    db: DbSessionFactory, engine: AsyncEngine, httpx_client: httpx2.AsyncClient
) -> None:
    """With all three pooled connections in use elsewhere the pool could still open
    three more, but the page takes one; once they are idle, it takes two."""
    project_id = await _add_first_page(db)
    elsewhere = [await engine.connect() for _ in range(3)]
    try:
        with _count_checkouts(engine) as busy:
            await _post(httpx_client, project_id)
    finally:
        for connection in elsewhere:
            await connection.close()
    with _count_checkouts(engine) as idle:
        await _post(httpx_client, project_id)

    assert busy.count == 1
    assert idle.count == 2


@pytest.mark.parametrize("pool", [(1, 0.5, 0)], indirect=True)
async def test_a_first_page_returns_rows_once_a_connection_frees_up(
    db: DbSessionFactory, engine: AsyncEngine, httpx_client: httpx2.AsyncClient
) -> None:
    """Another request holds the pool's one connection when the page asks, and
    whenever the page gives a connection back, another request takes it and holds
    it for longer than the pool waits."""
    project_id = await _add_first_page(db)
    holders: list[asyncio.Task[None]] = []
    with _taking_what_the_page_gives_back(engine, holders) as hold_first:
        try:
            await hold_first(0.3)
            initial, *_ = await _post(httpx_client, project_id)
        finally:
            await asyncio.gather(*holders)

    assert "errors" not in initial
    assert len(initial["data"]["node"]["spans"]["edges"]) == 3


@pytest.mark.parametrize("pool", [(1, 5.0, 0)], indirect=True)
async def test_a_first_page_returns_rows_behind_a_list_statement_that_takes_seconds(
    db: DbSessionFactory, engine: AsyncEngine, httpx_client: httpx2.AsyncClient
) -> None:
    """As above with a 5 s pool timeout, the other request holding each connection for
    5.5 s, and the list of spans, which is read as a stream, waiting three seconds on a
    locked table while the page's other sessions wait their turn."""
    project_id = await _add_first_page(db)
    holders: list[asyncio.Task[None]] = []
    async with _locked(engine, "spans") as unlock:
        asyncio.get_running_loop().call_later(3.0, unlock)
        with _taking_what_the_page_gives_back(engine, holders, seconds=5.5) as hold_first:
            try:
                await hold_first(0.3)
                started = time.perf_counter()
                initial, *_ = await _post(httpx_client, project_id)
                waited = time.perf_counter() - started
            finally:
                await asyncio.gather(*holders)

    assert "errors" not in initial
    assert len(initial["data"]["node"]["spans"]["edges"]) == 3
    assert waited >= 2.5


@pytest.mark.parametrize("pool", [(1, 5.0, 0)], indirect=True)
async def test_a_session_waits_its_turn_behind_a_streamed_statement_that_takes_over_a_second(
    db: DbSessionFactory,
) -> None:
    factory = _sharing_factory(db)

    async def slow() -> None:
        async with factory.read() as session:
            [row async for row in await session.stream(text("select pg_sleep(1.6), 1"))]

    async def after() -> int:
        await asyncio.sleep(0.1)
        async with factory.read() as session:
            return int(await session.scalar(select(1)) or 0)

    try:
        _, value = await asyncio.wait_for(asyncio.gather(slow(), after()), timeout=10)
    finally:
        await factory.end_request()

    assert value == 1


@pytest.mark.parametrize("pool", [(1, 5.0, 0)], indirect=True)
async def test_sessions_waiting_their_turn_get_the_connection_as_it_is_released(
    db: DbSessionFactory,
) -> None:
    factory = _sharing_factory(db)

    async def read() -> int:
        async with factory.read() as session:
            return int(await session.scalar(select(1)) or 0)

    try:
        await read()
        started = time.perf_counter()
        values = await asyncio.gather(*(read() for _ in range(8)))
        elapsed = time.perf_counter() - started
    finally:
        await factory.end_request()

    assert values == [1] * 8
    assert elapsed < 0.5


@pytest.mark.parametrize("pool", [(1, 2.0, 0)], indirect=True)
async def test_a_deferred_part_arrives_after_the_first_part_on_the_request_s_shared_connection(
    db: DbSessionFactory, engine: AsyncEngine, httpx_client: httpx2.AsyncClient
) -> None:
    project_id = await _add_first_page(db)

    with _count_checkouts(engine) as checkouts:
        initial, *subsequent = await _post(httpx_client, project_id)

    assert "errors" not in initial
    assert initial["hasNext"] is True
    assert len(initial["data"]["node"]["spans"]["edges"]) == 3
    (deferred,) = [
        entry for part in subsequent for entry in part.get("incremental", []) if "data" in entry
    ]
    assert not deferred.get("errors")
    assert set(deferred["data"]) == {"spanAnnotationNames", "traceAnnotationNames"}
    assert subsequent[-1]["hasNext"] is False
    assert checkouts.count == 1


@pytest.mark.parametrize("query", [_FIRST_PAGE, _ROWS_ONLY], ids=["deferred", "single"])
async def test_a_request_returns_its_connections_before_its_last_part_is_read(
    db: DbSessionFactory, engine: AsyncEngine, asgi_app: ASGIApp, query: str
) -> None:
    """The client stops reading at the response's last part; the connections are
    already back."""
    project_id = await _add_first_page(db)
    await _warm(engine, 4)
    body = json.dumps({"query": query, "variables": {"id": project_id}}).encode()
    request_sent = False
    response_done = asyncio.Event()
    held_at_last_part: list[int] = []
    last_part_read = asyncio.Event()

    async def receive() -> Message:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        await response_done.wait()
        return {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        if message["type"] != "http.response.body":
            return
        chunk = message.get("body", b"")
        is_last = b'"hasNext": false' in chunk or b'"hasNext":false' in chunk
        if is_last or (b'"data"' in chunk and b"hasNext" not in chunk):
            held_at_last_part.append(_checked_out(engine))
            await last_part_read.wait()

    with _count_checkouts(engine) as checkouts:
        app: asyncio.Future[None] = asyncio.ensure_future(asgi_app(_http_scope(), receive, send))
        while not held_at_last_part and not app.done():
            await asyncio.sleep(0.01)
        last_part_read.set()
        await app
        response_done.set()

    assert checkouts.count >= 1
    assert held_at_last_part == [0]


async def test_a_client_slow_to_read_the_first_part_holds_no_connection(
    db: DbSessionFactory, engine: AsyncEngine, asgi_app: ASGIApp
) -> None:
    """The client has not read the first part of a deferred response for two seconds;
    the request's connections are back in the pool meanwhile."""
    project_id = await _add_first_page(db)
    await _warm(engine, 4)
    body = json.dumps({"query": _FIRST_PAGE, "variables": {"id": project_id}}).encode()
    request_sent = False
    response_done = asyncio.Event()
    first_part_sent = asyncio.Event()
    first_part_read = asyncio.Event()
    bodies = 0

    async def receive() -> Message:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        await response_done.wait()
        return {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        nonlocal bodies
        if message["type"] != "http.response.body" or not message.get("body"):
            return
        bodies += 1
        if bodies == 1:
            first_part_sent.set()
            await first_part_read.wait()

    app: asyncio.Future[None] = asyncio.ensure_future(asgi_app(_http_scope(), receive, send))
    await asyncio.wait_for(first_part_sent.wait(), 10)
    held = []
    for _ in range(4):
        await asyncio.sleep(0.5)
        held.append(_checked_out(engine))
    first_part_read.set()
    await app
    response_done.set()

    assert held == [0, 0, 0, 0]
    assert await _settle(engine) == 0


async def test_a_request_whose_field_fails_returns_its_connections(
    db: DbSessionFactory, engine: AsyncEngine, httpx_client: httpx2.AsyncClient
) -> None:
    project_id = await _add_first_page(db)
    await _warm(engine, 4)
    failing = """
    query ($id: ID!) {
      node(id: $id) {
        ... on Project {
          name
          spanAnnotationNames
          spans(first: 1, filterCondition: "this is ( not valid") { edges { node { name } } }
        }
      }
    }
    """

    (result,) = await _post(httpx_client, project_id, failing)

    assert result["errors"]
    assert await _settle(engine) == 0


async def test_a_cancelled_request_returns_its_connections(
    db: DbSessionFactory, engine: AsyncEngine, asgi_app: ASGIApp
) -> None:
    """The request is cancelled while its list waits on a locked table."""
    project_id = await _add_first_page(db)
    await _warm(engine, 4)
    body = json.dumps({"query": _ROWS_ONLY, "variables": {"id": project_id}}).encode()
    request_sent = False

    async def receive() -> Message:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        await asyncio.Event().wait()
        raise AssertionError("unreachable")

    async def send(_: Message) -> None:
        pass

    async with _locked(engine, "spans"):
        app = asyncio.ensure_future(asgi_app(_http_scope(), receive, send))
        while _checked_out(engine) == 0:
            await asyncio.sleep(0.01)
        await asyncio.sleep(0.2)
        app.cancel()
        with pytest.raises(asyncio.CancelledError):
            await app

    assert await _settle(engine) == 0


async def test_a_client_that_hangs_up_before_a_deferred_part_leaves_no_connection_out(
    db: DbSessionFactory, engine: AsyncEngine, asgi_app: ASGIApp
) -> None:
    """The client reads the first part and hangs up while the deferred part waits on a
    locked table; the deferred part is never read."""
    project_id = await _add_first_page(db)
    await _warm(engine, 4)
    body = json.dumps({"query": _ROWS_THEN_NAMES, "variables": {"id": project_id}}).encode()
    request_sent = False
    first_part = asyncio.Event()

    async def receive() -> Message:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        await first_part.wait()
        return {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        if message["type"] == "http.response.body" and b'"data"' in message.get("body", b""):
            first_part.set()

    async with _locked(engine, "span_annotations"):
        await asyncio.wait_for(asgi_app(_http_scope(), receive, send), timeout=10)

    assert first_part.is_set()
    assert await _settle(engine) == 0


@pytest.mark.parametrize("cancels", [1, 2])
@pytest.mark.parametrize("pool", [(1, 0.5, 0)], indirect=True)
async def test_sessions_cancelled_while_they_wait_for_the_first_connection(
    db: DbSessionFactory, engine: AsyncEngine, cancels: int
) -> None:
    """The pool is empty, so the request's first checkout times out. Six sessions wait for
    it; when the first fails, the others are cancelled once or twice in a row, as a
    failing field's siblings are, and then again by each enclosing level."""
    factory = _sharing_factory(db)
    holder = await engine.connect()

    async def read() -> None:
        async with factory.read() as session:
            await session.scalar(select(1))

    try:
        tasks = [asyncio.create_task(read()) for _ in range(6)]
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
        for _ in range(cancels):
            for task in pending:
                task.cancel()
            await asyncio.sleep(0)
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.wait_for(factory.end_request(), timeout=3)
    finally:
        await holder.close()

    assert await _settle(engine) == 0


@pytest.mark.parametrize("cancels", [1, 2])
@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_sessions_cancelled_while_they_wait_for_a_connection_in_use(
    db: DbSessionFactory, engine: AsyncEngine, cancels: int
) -> None:
    """One session holds the request's connection while five more wait their turn and are
    cancelled, once or twice in a row; then the first gives the connection back."""
    factory = _sharing_factory(db)
    first_holds = asyncio.Event()
    first_may_end = asyncio.Event()

    async def first_session() -> None:
        async with factory.read() as first:
            await first.scalar(select(1))
            first_holds.set()
            await first_may_end.wait()

    async def read() -> int:
        async with factory.read() as session:
            return int(await session.scalar(select(1)) or 0)

    first = asyncio.create_task(first_session())
    await first_holds.wait()
    waiting = [asyncio.create_task(read()) for _ in range(5)]
    await asyncio.sleep(0.1)
    for _ in range(cancels):
        for task in waiting:
            task.cancel()
        await asyncio.sleep(0)
    await asyncio.gather(*waiting, return_exceptions=True)
    first_may_end.set()
    await asyncio.wait_for(first, timeout=5)
    started = time.perf_counter()
    assert await asyncio.wait_for(read(), timeout=5) == 1
    next_read = time.perf_counter() - started
    await asyncio.wait_for(factory.end_request(), timeout=3)

    assert next_read < 0.5
    assert await _settle(engine) == 0


@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_a_connection_passed_to_a_session_cancelled_before_it_runs_goes_to_the_next(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    factory = _sharing_factory(db)
    first_holds = asyncio.Event()
    first_may_end = asyncio.Event()

    async def read() -> int:
        async with factory.read() as session:
            return int(await session.scalar(select(1)) or 0)

    waiting: list[asyncio.Task[int]] = []

    async def first_session() -> None:
        async with factory.read() as first:
            await first.scalar(select(1))
            first_holds.set()
            await first_may_end.wait()
        waiting[0].cancel()

    first = asyncio.create_task(first_session())
    await first_holds.wait()
    waiting.append(asyncio.create_task(read()))
    await asyncio.sleep(0.1)
    first_may_end.set()
    await first
    with pytest.raises(asyncio.CancelledError):
        await waiting[0]
    started = time.perf_counter()
    assert await asyncio.wait_for(read(), timeout=5) == 1
    next_read = time.perf_counter() - started
    await factory.end_request()

    assert next_read < 0.5
    assert await _settle(engine) == 0


@pytest.mark.parametrize("pool", [(1, 0.5, 0)], indirect=True)
async def test_a_session_keeps_its_place_past_the_pool_s_timeout_while_its_line_moves(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    """Twelve sessions of 0.1 s take turns on the request's one connection; the last waits
    over twice the pool's timeout and still reads, because the line kept moving."""
    factory = _sharing_factory(db)

    async def read() -> float:
        started = time.perf_counter()
        async with factory.read() as session:
            await session.execute(text("select pg_sleep(0.1)"))
        return time.perf_counter() - started

    try:
        waits = await asyncio.wait_for(asyncio.gather(*(read() for _ in range(12))), 10)
    finally:
        await factory.end_request()

    assert max(waits) > 1.0
    assert await _settle(engine) == 0


@pytest.mark.parametrize(
    "requests, size, expected",
    [
        (1, 1, ["timed out"]),
        (1, 2, ["answered"]),
        (2, 2, ["timed out", "timed out"]),
    ],
    ids=["one-request-pool-of-one", "one-request-pool-of-two", "two-requests-pool-of-two"],
)
async def test_a_session_waited_on_by_another_task_of_its_request_fails_on_the_pool_s_timeout(
    engine: AsyncEngine, requests: int, size: int, expected: list[str]
) -> None:
    """A session holds its request's connection and waits for work that another task of the
    same request does in a session of its own, a direct checkout; that task was not started inside the
    session, as with a loader batch another field asked for first. Unshared, the inner
    session fails on the pool's 0.5 s timeout whenever the pool has nothing; shared, it
    must fail no later and the same way, and answer whenever the pool has a connection."""
    small = create_async_engine(
        engine.url, pool_size=size, max_overflow=0, pool_timeout=0.5, pool_pre_ping=True
    )
    try:
        factories = [
            _sharing_factory(DbSessionFactory(db=_db(small), dialect="postgresql"))
            for _ in range(requests)
        ]

        async def one_request(factory: RequestDbSessionFactory) -> str:
            holding = asyncio.Event()

            async def inner() -> int:
                await holding.wait()
                async with factory.read() as session:
                    return int(await session.scalar(select(1)) or 0)

            work = asyncio.create_task(inner())
            try:
                async with factory.read() as session:
                    await session.scalar(select(1))
                    holding.set()
                    await work
                return "answered"
            except PoolTimeoutError:
                return "timed out"
            finally:
                await factory.end_request()

        started = time.perf_counter()
        outcomes = await asyncio.wait_for(
            asyncio.gather(*(one_request(factory) for factory in factories)), timeout=5
        )
        elapsed = time.perf_counter() - started
        left = await _settle(small)
    finally:
        await small.dispose()

    assert sorted(outcomes) == expected
    assert elapsed < 1.5
    assert left == 0


@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_a_direct_checkout_that_is_not_needed_returns_to_the_pool(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    """A session waits over a second and asks the pool, then gets its request's connection
    first; the pool connection it asked for arrives later and goes back."""
    factory = _sharing_factory(db)
    other = await engine.connect()

    async def first() -> None:
        async with factory.read() as session:
            await session.execute(text("select pg_sleep(1.5)"))

    async def second() -> int:
        await asyncio.sleep(0.1)
        async with factory.read() as session:
            return int(await session.scalar(text("select 2")) or 0)

    try:
        _, value = await asyncio.gather(first(), second())
    finally:
        await other.close()
    await asyncio.sleep(0.5)
    held_by_the_request = _checked_out(engine)
    await factory.end_request()

    assert value == 2
    assert held_by_the_request == 1
    assert await _settle(engine) == 0


@pytest.mark.parametrize("pool", [(2, 0.3, 0)], indirect=True)
async def test_a_second_shared_connection_that_failed_is_not_checked_out_again(
    db: DbSessionFactory, engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The pool looks as if it had an idle connection but has none, so the request's second
    checkout times out; once the pool really has one idle, the request stays on one."""
    factory = _sharing_factory(db)

    async def read(seconds: float) -> None:
        async with factory.read() as session:
            await session.execute(text(f"select pg_sleep({seconds})"))

    other = await engine.connect()
    monkeypatch.setattr(request_connections, "_has_idle_connection", lambda engine: True)
    try:
        await asyncio.gather(read(0.2), read(0.01))
        await asyncio.sleep(0.4)
    finally:
        monkeypatch.undo()
        await other.close()
    with _count_checkouts(engine) as checkouts:
        await asyncio.gather(read(0.05), read(0.05), read(0.05))
    await factory.end_request()

    assert checkouts.count == 0
    assert await _settle(engine) == 0


async def test_ending_a_request_inside_a_cancelled_scope_still_returns_its_connections(
    engine: AsyncEngine,
) -> None:
    """The request holds two connections that the pool will close when they come back,
    and the request is ended inside a cancelled scope, as when a client hangs up on a
    response behind a BaseHTTPMiddleware."""
    small = create_async_engine(engine.url, pool_size=2, max_overflow=4, pool_pre_ping=True)
    try:
        factory = _sharing_factory(DbSessionFactory(db=_db(small), dialect="postgresql"))
        await _warm(small, 3)

        async def read() -> None:
            async with factory.read() as session:
                await session.execute(text("select pg_sleep(0.2)"))

        await asyncio.gather(read(), read())
        assert _checked_out(small) == 2
        await _warm(small, 2)
        with anyio.CancelScope() as scope:
            scope.cancel()
            await factory.end_request()
        ended_again: Optional[BaseException] = None
        try:
            await factory.end_request()
        except BaseException as error:
            ended_again = error
        left = await _settle(small)
    finally:
        await small.dispose()

    assert ended_again is None
    assert left == 0


@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_a_session_still_in_use_when_the_request_ends_returns_its_connection(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    factory = _sharing_factory(db)
    async with factory.read() as session:
        await session.scalar(select(1))
        await factory.end_request()
        assert _checked_out(engine) == 1
        assert await session.scalar(text("select 2")) == 2

    assert await _settle(engine) == 0


@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_a_factory_used_after_its_request_ended_opens_sessions_as_usual(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    factory = _sharing_factory(db)
    async with factory.read() as session:
        await session.scalar(select(1))
    await factory.end_request()
    assert await _settle(engine) == 0

    async with factory.read() as session:
        assert await session.scalar(select(1)) == 1
    async with factory() as session:
        assert await session.scalar(text("select 2")) == 2

    assert await _settle(engine) == 0


@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_a_broken_connection_is_not_passed_to_the_next_session(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    factory = _sharing_factory(db)
    try:
        with pytest.raises(Exception):
            async with factory.read() as session:
                connection = await session.connection()
                await connection.invalidate()
        async with factory.read() as session:
            assert await session.scalar(select(1)) == 1
    finally:
        await factory.end_request()

    assert await _settle(engine) == 0


@pytest.mark.parametrize("pool", [(1, 0.5, 0)], indirect=True)
async def test_a_first_checkout_that_times_out_fails_its_waiters_and_the_next_session_tries_again(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    factory = _sharing_factory(db)

    async def read() -> int:
        async with factory.read() as session:
            return int(await session.scalar(select(1)) or 0)

    holder = await engine.connect()
    try:
        outcomes = await asyncio.wait_for(
            asyncio.gather(*(read() for _ in range(3)), return_exceptions=True), timeout=5
        )
    finally:
        await holder.close()
    try:
        later = await asyncio.wait_for(read(), timeout=5)
    finally:
        await factory.end_request()

    assert all(isinstance(outcome, PoolTimeoutError) for outcome in outcomes)
    assert later == 1


@pytest.mark.parametrize("pool", [(1, 1.0, 0)], indirect=True)
async def test_a_subscription_does_not_pin_a_connection(
    db: DbSessionFactory, httpx_client: httpx2.AsyncClient, gql_client: AsyncGraphQLClient
) -> None:
    """While a preview streams, a query still gets the pool's one connection."""
    project_id = await _add_first_page(db)
    slow_subject_started = asyncio.Event()
    finish_slow_subject = asyncio.Event()

    async def evaluate(**kwargs: Any) -> list[EvaluationResult]:
        if kwargs["context"]["output"] == "slow":
            slow_subject_started.set()
            await finish_slow_subject.wait()
        now = datetime.now(timezone.utc)
        return [
            EvaluationResult(
                name="fake",
                annotator_kind="CODE",
                label=None,
                score=1.0,
                explanation=None,
                metadata={},
                error=None,
                trace_id=None,
                start_time=now,
                end_time=now,
            )
        ]

    class FakeEvaluator:
        name = "fake"
        output_configs: list[Any] = []

        def __init__(self) -> None:
            self.evaluate = evaluate

    async def preview() -> list[dict[str, Any]]:
        return [
            payload
            async for payload in gql_client.subscription(
                """
                subscription($input: EvaluatorPreviewInput!) {
                  evaluatorPreview(input: $input) { key error }
                }
                """,
                {
                    "input": {
                        "evaluator": {"builtInEvaluatorId": str(GlobalID("BuiltInEvaluator", "1"))},
                        "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                        "subjects": [
                            {"key": "fast", "context": {"output": "fast"}},
                            {"key": "slow", "context": {"output": "slow"}},
                        ],
                    }
                },
            )
        ]

    with patch.object(
        evaluator_preview,
        "build_evaluator_from_definition",
        AsyncMock(return_value=FakeEvaluator()),
    ):
        streaming = asyncio.create_task(preview())
        await asyncio.wait_for(slow_subject_started.wait(), timeout=10)
        try:
            initial, *_ = await _post(httpx_client, project_id)
        finally:
            finish_slow_subject.set()
        results = await streaming

    assert "errors" not in initial
    assert len(initial["data"]["node"]["spans"]["edges"]) == 3
    assert sorted(payload["evaluatorPreview"]["key"] for payload in results) == ["fast", "slow"]


@pytest.mark.parametrize("pool", [(1, 1.0, 0)], indirect=True)
async def test_a_mutation_does_not_wait_on_a_connection_its_request_holds(
    gql_client: AsyncGraphQLClient,
) -> None:
    result = await gql_client.execute(
        """
        mutation ($input: CreateProjectInput!) {
          createProject(input: $input) {
            project { name spanAnnotationNames traceAnnotationNames }
          }
        }
        """,
        {"input": {"name": "made-under-a-one-connection-pool"}},
    )

    assert not result.errors
    assert result.data is not None
    assert result.data["createProject"]["project"]["name"] == "made-under-a-one-connection-pool"


@pytest.mark.parametrize("pool", [(1, 1.0, 0)], indirect=True)
async def test_a_query_that_opens_a_write_session_does_not_wait_on_its_shared_connection(
    gql_client: AsyncGraphQLClient,
) -> None:
    """The providers are read first; each provider's configs are then loaded through
    a write session."""
    result = await gql_client.execute("query { sandboxProviders { backendType configs { id } } }")

    assert not result.errors
    assert result.data is not None
    assert result.data["sandboxProviders"]


@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_a_session_opened_inside_another_of_its_request_makes_a_direct_checkout(
    db: DbSessionFactory,
) -> None:
    """The outer session waits on the inner one, here in a task of its own."""
    factory = _sharing_factory(db)

    async def inner_read() -> int:
        async with factory.read() as session:
            return int(await session.scalar(select(1)) or 0)

    try:
        async with factory.read() as outer:
            assert await outer.scalar(select(1)) == 1
            started = time.perf_counter()
            assert await asyncio.wait_for(asyncio.create_task(inner_read()), timeout=5) == 1
            elapsed = time.perf_counter() - started
    finally:
        await factory.end_request()

    assert elapsed < 0.5


@pytest.mark.parametrize("pool", [(1, 0.5, 0)], indirect=True)
async def test_a_session_opened_inside_another_when_the_pool_has_nothing_fails_on_the_pool(
    db: DbSessionFactory,
) -> None:
    """With the request holding the pool's only connection, a session opened inside
    another fails after the pool's wait, as it does without sharing, instead of
    waiting on itself."""
    factory = _sharing_factory(db)
    try:
        async with factory.read() as outer:
            assert await outer.scalar(select(1)) == 1
            with pytest.raises(PoolTimeoutError):
                async with asyncio.timeout(5):
                    async with factory.read() as inner:
                        await inner.scalar(select(1))
    finally:
        await factory.end_request()


def test_only_postgresql_requests_share() -> None:
    def no_sessions() -> Any:
        raise AssertionError("no session is opened")

    sqlite = DbSessionFactory(db=no_sessions, dialect="sqlite")
    postgresql = DbSessionFactory(db=no_sessions, dialect="postgresql")
    token = request_connections._request_factories.set([])
    try:
        assert request_connections.for_request(sqlite) is sqlite
        assert isinstance(request_connections.for_request(postgresql), RequestDbSessionFactory)
    finally:
        request_connections._request_factories.reset(token)
    assert request_connections.for_request(postgresql) is postgresql


async def test_with_a_read_replica_a_request_s_write_sessions_do_not_share(
    engine: AsyncEngine,
) -> None:
    """Reads and writes come from different session factories, as with a replica; the
    writes take connections of their own."""
    replica = DbSessionFactory(db=_db(engine), dialect="postgresql", read_db=_db(engine))
    factory = _sharing_factory(replica)
    await _warm(engine, 4)
    try:
        with _count_checkouts(engine) as checkouts:
            for _ in range(2):
                async with factory.read() as session:
                    await session.scalar(select(1))
            for _ in range(2):
                async with factory() as session:
                    await session.scalar(select(1))
    finally:
        await factory.end_request()

    assert checkouts.count == 3


@pytest.mark.parametrize("pool", [(2, 5.0, 0)], indirect=True)
async def test_a_session_kept_waiting_makes_a_direct_checkout_and_returns_it(
    db: DbSessionFactory, engine: AsyncEngine
) -> None:
    """The request's one connection runs a 2 s statement; the pool can still open
    another, so the waiting session takes that after a second."""
    factory = _sharing_factory(db)

    async def slow() -> None:
        async with factory.read() as session:
            await session.execute(text("select pg_sleep(2)"))

    async def waiting() -> float:
        await asyncio.sleep(0.1)
        started = time.perf_counter()
        async with factory.read() as session:
            await session.scalar(select(1))
        return time.perf_counter() - started

    try:
        _, waited = await asyncio.gather(slow(), waiting())
    finally:
        await factory.end_request()

    assert 0.9 < waited < 1.7
    assert await _settle(engine) == 0


async def test_a_session_that_joined_before_its_request_had_a_connection_is_bounded_too(
    engine: AsyncEngine,
) -> None:
    """As above on a pool of one, with both sessions asking before the request has any
    connection: the one that gets it waits on the other, which must still fail on the
    pool's timeout."""
    small = create_async_engine(
        engine.url, pool_size=1, max_overflow=0, pool_timeout=0.5, pool_pre_ping=True
    )
    try:
        factory = _sharing_factory(DbSessionFactory(db=_db(small), dialect="postgresql"))
        outer_holds = asyncio.Event()
        inner_read = asyncio.Event()

        async def outer() -> None:
            async with factory.read() as session:
                await session.scalar(select(1))
                outer_holds.set()
                await inner_read.wait()

        async def inner() -> None:
            async with factory.read() as session:
                await session.scalar(select(1))
            inner_read.set()

        started = time.perf_counter()
        outer_task = asyncio.create_task(outer())
        inner_task = asyncio.create_task(inner())
        with pytest.raises(PoolTimeoutError):
            await asyncio.wait_for(inner_task, timeout=5)
        elapsed = time.perf_counter() - started
        inner_read.set()
        await asyncio.wait_for(outer_task, timeout=5)
        await factory.end_request()
        left = await _settle(small)
    finally:
        await small.dispose()

    assert outer_holds.is_set()
    assert elapsed < 1.5
    assert left == 0
