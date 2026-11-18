"""Lets the database sessions of one GraphQL query request share a few pooled connections.

Each field and loader of a GraphQL query opens a session of its own. Unshared, every
one of those sessions is its own turn at the connection pool: a page request waits in
the pool's queue a dozen times or more, and when the pool is busy any single wait can
time out and fail the whole response. Shared, a request waits for the pool once. Its
first session checks out a connection, later sessions take turns on it, and the
connection is returned to the pool once the request's last result has been produced.

Only query operations share, and only on PostgreSQL. Mutations and subscriptions keep
a session per use: a subscription can stay open for as long as a run takes, and
holding a connection for that long would take it from everyone else. SQLite is left
alone because its engines already serialize or never time out.

No lock is held across an ``await``, so cancellation at any point leaves nothing held.
Connections are returned to the pool by background tasks, so a cancelled caller cannot
stop a return halfway. No pool checkout is ever cancelled either: on Python 3.11 a
cancelled checkout can lose the connection the pool was handing over.
"""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from collections.abc import AsyncIterator, Callable, Generator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from contextvars import ContextVar
from typing import TYPE_CHECKING, Any, Optional, Union

from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession
from sqlalchemy.pool import QueuePool
from starlette.types import ASGIApp, Receive, Scope, Send
from strawberry.extensions import SchemaExtension
from strawberry.types.graphql import OperationType

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DbSessionFactory

if TYPE_CHECKING:
    from phoenix.server.mcp.sql.execute import StatementAdmissionController

logger = logging.getLogger(__name__)

MAX_CONNECTIONS_PER_REQUEST = 2
"""How many shared connections one request's sessions take turns on.

The first is waited for like any other checkout. Each further one is checked out only
while the pool has an idle connection, one that it has already opened and that nobody
is using, and no session waits on that checkout: if another request takes the idle
connection first, the checkout waits its turn in the pool, and a connection that
arrives once the request no longer needs it is returned at once. So under a busy pool
a request's sessions take turns on one connection, while on a quiet one its slow
parts can overlap. A pool that has only ever opened one connection has none idle, so
a fresh server's first requests take one.
"""

_DIRECT_CHECKOUT_AFTER_SECONDS = 1.0
"""How long a session waits for a shared connection, or half the pool's timeout if
that is shorter, before it also makes a direct checkout: a pool connection of its
own. It keeps its place in the request's line meanwhile, and uses whichever
connection comes first.

A session fails with the pool's timeout error once it has waited the pool's timeout,
counted from when it joined the line, while none of the request's shared connections
was released: nothing in the request is moving, so it may be waiting on itself. While
they are being released it keeps its place, however long the line."""

_request_factories: ContextVar[Optional[list[RequestDbSessionFactory]]] = ContextVar(
    "phoenix_request_factories", default=None
)
"""The session factories built during the current HTTP request, for the middleware to
close when the response ends."""

_entered_requests: ContextVar[frozenset[int]] = ContextVar(
    "phoenix_entered_requests", default=frozenset()
)
"""The requests whose shared sessions the running code is inside, by id. Tasks started
inside a session inherit it."""

_background_tasks: set[asyncio.Task[Any]] = set()
"""Returns to the pool and direct checkouts still running, kept so that none is
collected before it ends."""

_Acquired = Union[tuple[AsyncConnection, bool], None]
"""A connection and whether it is shared, or None when the caller should open a session
as usual."""


class RequestConnections:
    """The shared connections of one request, each used by one session at a time."""

    def __init__(
        self, open_read_session: Callable[[], AbstractAsyncContextManager[AsyncSession]]
    ) -> None:
        self._open_read_session = open_read_session
        self._engine: Optional[AsyncEngine] = None
        self._shared_count = 0
        self._idle: list[AsyncConnection] = []
        self._waiters: deque[asyncio.Future[Optional[AsyncConnection]]] = deque()
        self._pending_checkout: Optional[asyncio.Task[None]] = None
        self._another_checkout_failed = False
        self._release_count = 0
        self._first_connection: Optional[asyncio.Future[None]] = None
        self._closed = False
        self._return_tasks: set[asyncio.Task[None]] = set()

    @property
    def is_closed(self) -> bool:
        return self._closed

    @asynccontextmanager
    async def session(self) -> AsyncIterator[Optional[AsyncSession]]:
        """A session on a shared connection, or on a direct checkout after a long wait.

        None when the caller should open a session as usual: once the request has
        ended, and for a session opened inside another of the same request's sessions
        while no shared connection is idle, since waiting in line would then mean
        waiting on itself.
        """
        entered = _entered_requests.get()
        if id(self) in entered and not self._idle:
            yield None
            return
        acquired = await self._acquire()
        if acquired is None:
            yield None
            return
        connection, shared = acquired
        token = _entered_requests.set(entered | {id(self)})
        try:
            async with AsyncSession(bind=connection, expire_on_commit=False) as session:
                async with session.begin():
                    yield session
        finally:
            try:
                _entered_requests.reset(token)
            except ValueError:
                pass
            if shared:
                self._release(connection)
            else:
                self._return_to_pool(connection)

    def close(self) -> None:
        """Ends sharing: idle connections start returning to the pool, connections in
        use return when their sessions end, and waiting sessions open sessions as usual."""
        if self._closed:
            return
        self._closed = True
        self._dismiss_waiters()
        idle, self._idle = self._idle, []
        self._shared_count -= len(idle)
        for connection in idle:
            self._return_to_pool(connection)

    async def wait_returned(self) -> None:
        """Waits until the connections being returned have reached the pool; the
        returns carry on if this wait is cancelled."""
        pending = [task for task in self._return_tasks if not task.done()]
        if pending:
            await asyncio.shield(asyncio.gather(*pending, return_exceptions=True))

    async def _acquire(self) -> _Acquired:
        if self._closed:
            return None
        if self._idle:
            return self._idle.pop(), True
        loop = asyncio.get_running_loop()
        waiter: asyncio.Future[Optional[AsyncConnection]] = loop.create_future()
        self._waiters.append(waiter)
        self._check_out_if_needed()
        joined, release_count = loop.time(), self._release_count
        direct: Optional[asyncio.Task[Optional[AsyncConnection]]] = None
        try:
            while not waiter.done() and self._shared_count == 0:
                first: set[asyncio.Future[Any]] = {waiter, self._first_connection_ready()}
                await asyncio.wait(first, return_when=asyncio.FIRST_COMPLETED)
            if not waiter.done():
                assert self._engine is not None
                pool_timeout = _pool_timeout(self._engine)
                direct_after = _DIRECT_CHECKOUT_AFTER_SECONDS
                if pool_timeout is not None:
                    direct_after = min(direct_after, pool_timeout / 2)
                await asyncio.wait({waiter}, timeout=max(0.0, joined + direct_after - loop.time()))
                if not waiter.done():
                    direct = asyncio.ensure_future(_direct_checkout(self._engine))
                    _background_tasks.add(direct)
                    direct.add_done_callback(_background_tasks.discard)
                    await self._wait_for_shared_or_direct(
                        waiter, direct, joined, release_count, pool_timeout
                    )
            if waiter.done():
                connection = waiter.result()
                return None if connection is None else (connection, True)
            assert direct is not None and direct.done()
            checked_out, direct = direct.result(), None
            assert checked_out is not None
            self._leave_line(waiter)
            return checked_out, False
        except BaseException:
            self._leave_line(waiter)
            raise
        finally:
            if direct is not None:
                direct.add_done_callback(self._return_unused_direct)

    async def _wait_for_shared_or_direct(
        self,
        waiter: asyncio.Future[Optional[AsyncConnection]],
        direct: asyncio.Task[Optional[AsyncConnection]],
        joined: float,
        release_count: int,
        pool_timeout: Optional[float],
    ) -> None:
        """Waits for the session's turn at a shared connection or its direct checkout;
        raises the pool's timeout error once it has waited the pool's timeout while no
        shared connection was released."""
        loop = asyncio.get_running_loop()
        deadline = None if pool_timeout is None else joined + pool_timeout
        while True:
            racers: set[asyncio.Future[Any]] = {waiter} if direct.done() else {waiter, direct}
            remaining = None if deadline is None else max(0.0, deadline - loop.time())
            await asyncio.wait(racers, timeout=remaining, return_when=asyncio.FIRST_COMPLETED)
            if waiter.done() or _direct_checkout_succeeded(direct):
                return
            if deadline is None or loop.time() < deadline:
                continue
            assert pool_timeout is not None and self._engine is not None
            if self._release_count == release_count:
                raise _pool_timeout_error(self._engine, pool_timeout)
            release_count = self._release_count
            deadline = loop.time() + pool_timeout

    def _first_connection_ready(self) -> asyncio.Future[None]:
        """Resolved once the request holds a shared connection."""
        if self._first_connection is None or (
            self._first_connection.done() and self._shared_count == 0
        ):
            self._first_connection = asyncio.get_running_loop().create_future()
        return self._first_connection

    def _check_out_if_needed(self) -> None:
        if self._closed or self._pending_checkout is not None:
            return
        if not any(not waiter.done() for waiter in self._waiters):
            return
        if self._shared_count == 0:
            self._pending_checkout = asyncio.create_task(self._check_out_first())
        elif (
            self._shared_count < MAX_CONNECTIONS_PER_REQUEST
            and not self._another_checkout_failed
            and self._engine is not None
            and _has_idle_connection(self._engine)
        ):
            self._pending_checkout = asyncio.create_task(self._check_out_another())

    async def _check_out_first(self) -> None:
        try:
            engine = self._engine or await _read_engine(self._open_read_session)
            if engine is None:
                self._pending_checkout = None
                self._closed = True
                self._dismiss_waiters()
                return
            self._engine = engine
            connection = await engine.connect()
        except Exception as error:
            self._pending_checkout = None
            self._fail_waiters(error)
            return
        except BaseException:
            self._pending_checkout = None
            raise
        self._pending_checkout = None
        self._add_shared(connection)

    async def _check_out_another(self) -> None:
        assert self._engine is not None
        connection: Optional[AsyncConnection] = None
        try:
            connection = await self._engine.connect()
        except Exception:
            self._another_checkout_failed = True
        finally:
            self._pending_checkout = None
        if connection is not None:
            self._add_shared(connection)

    def _add_shared(self, connection: AsyncConnection) -> None:
        if self._closed or self._shared_count >= MAX_CONNECTIONS_PER_REQUEST:
            self._return_to_pool(connection)
            return
        self._shared_count += 1
        if self._first_connection is not None and not self._first_connection.done():
            self._first_connection.set_result(None)
        self._release(connection)

    def _release(self, connection: AsyncConnection) -> None:
        """Passes a shared connection to the next waiting session, or keeps it idle; once
        the request has ended or the connection is broken, returns it to the pool
        instead. A session still using a connection when the request ends returns it
        here."""
        if (
            self._closed
            or connection.closed
            or connection.invalidated
            or connection.in_transaction()
        ):
            self._shared_count -= 1
            self._return_to_pool(connection)
            self._check_out_if_needed()
            return
        self._release_count += 1
        while self._waiters:
            waiter = self._waiters.popleft()
            if not waiter.done():
                waiter.set_result(connection)
                self._check_out_if_needed()
                return
        self._idle.append(connection)

    def _leave_line(self, waiter: asyncio.Future[Optional[AsyncConnection]]) -> None:
        """Takes a waiting session out of the line, releasing a shared connection it was
        passed but will not use."""
        if not waiter.done():
            waiter.cancel()
            return
        if waiter.cancelled() or waiter.exception() is not None:
            return
        if (connection := waiter.result()) is not None:
            self._release(connection)

    def _return_unused_direct(self, direct: asyncio.Task[Optional[AsyncConnection]]) -> None:
        if _direct_checkout_succeeded(direct) and (unused := direct.result()) is not None:
            self._return_to_pool(unused)

    def _fail_waiters(self, error: BaseException) -> None:
        while self._waiters:
            waiter = self._waiters.popleft()
            if not waiter.done():
                waiter.set_exception(error)

    def _dismiss_waiters(self) -> None:
        """Tells every waiting session to open a session as usual."""
        while self._waiters:
            waiter = self._waiters.popleft()
            if not waiter.done():
                waiter.set_result(None)

    def _return_to_pool(self, connection: AsyncConnection) -> None:
        task = asyncio.ensure_future(_close_connection(connection))
        self._return_tasks.add(task)
        _background_tasks.add(task)
        task.add_done_callback(self._return_tasks.discard)
        task.add_done_callback(_background_tasks.discard)


async def _direct_checkout(engine: AsyncEngine) -> Optional[AsyncConnection]:
    """A pool connection, or None if the pool's timeout passes first."""
    try:
        return await engine.connect()
    except PoolTimeoutError:
        return None


def _direct_checkout_succeeded(direct: asyncio.Task[Optional[AsyncConnection]]) -> bool:
    return (
        direct.done()
        and not direct.cancelled()
        and direct.exception() is None
        and direct.result() is not None
    )


async def _close_connection(connection: AsyncConnection) -> None:
    """Closes a connection, which returns it to the pool; invalidates it if that fails."""
    try:
        await connection.close()
    except Exception:
        logger.exception("Failed to return a request's connection to the pool")
        try:
            await connection.invalidate()
        except Exception:
            pass


async def _read_engine(
    open_read_session: Callable[[], AbstractAsyncContextManager[AsyncSession]],
) -> Optional[AsyncEngine]:
    """The engine behind the read sessions. The session factory holds only its session
    makers, and opening a session without running a statement checks nothing out."""
    async with open_read_session() as session:
        bind = session.bind
    return bind if isinstance(bind, AsyncEngine) else None


def _pool_timeout(engine: AsyncEngine) -> Optional[float]:
    pool = engine.pool
    return pool.timeout() if isinstance(pool, QueuePool) else None


def _pool_timeout_error(engine: AsyncEngine, timeout: float) -> PoolTimeoutError:
    """The error a direct checkout would have raised after the same wait."""
    pool = engine.pool
    assert isinstance(pool, QueuePool)
    return PoolTimeoutError(
        f"QueuePool limit of size {pool.size()} reached while waiting for this request's "
        f"connection, connection timed out, timeout {timeout:.2f}",
        code="3o7r",
    )


def _has_idle_connection(engine: AsyncEngine) -> bool:
    pool = engine.pool
    return isinstance(pool, QueuePool) and pool.checkedin() > 0


class RequestDbSessionFactory(DbSessionFactory):
    """The session factory of one GraphQL request.

    Once the request turns out to be a query operation, its read sessions, and its
    write sessions when they go to the same database, use the request's shared
    connections. Until then, and for mutations and subscriptions, every session is
    opened as usual. Anything not defined here is forwarded to the app's session factory.
    """

    def __init__(self, app_db: DbSessionFactory) -> None:
        self._app_db = app_db
        self._connections: Optional[RequestConnections] = None

    def __getattr__(self, name: str) -> Any:
        return getattr(self._app_db, name)

    @property
    def should_not_insert_or_update(self) -> bool:
        return self._app_db.should_not_insert_or_update

    @should_not_insert_or_update.setter
    def should_not_insert_or_update(self, value: bool) -> None:
        self._app_db.should_not_insert_or_update = value

    @property
    def analytics_sql_admission(self) -> StatementAdmissionController:
        return self._app_db.analytics_sql_admission

    def share_connections(self) -> None:
        """Turns sharing on for the rest of the request."""
        if self._connections is None:
            self._connections = RequestConnections(self._app_db._read_db)

    def close_connections(self) -> None:
        """Ends sharing; later sessions are opened as usual."""
        if self._connections is not None:
            self._connections.close()

    async def end_request(self) -> None:
        """Ends sharing and waits until the shared connections have reached the pool."""
        if self._connections is not None:
            self._connections.close()
            await self._connections.wait_returned()

    def __call__(self) -> AbstractAsyncContextManager[AsyncSession]:
        if self._app_db._read_db is self._app_db._db:
            return self._session(self._app_db._db)
        return self._app_db()

    def read(self) -> AbstractAsyncContextManager[AsyncSession]:
        return self._session(self._app_db._read_db)

    @asynccontextmanager
    async def _session(
        self, open_session: Callable[[], AbstractAsyncContextManager[AsyncSession]]
    ) -> AsyncIterator[AsyncSession]:
        connections = self._connections
        if connections is not None and not connections.is_closed:
            async with connections.session() as session:
                if session is not None:
                    yield session
                    return
        async with open_session() as session:
            yield session


def for_request(db: DbSessionFactory) -> DbSessionFactory:
    """The session factory for one GraphQL request, or ``db`` itself where sharing does
    not apply."""
    factories = _request_factories.get()
    if factories is None or db.dialect is not SupportedSQLDialect.POSTGRESQL:
        return db
    factory = RequestDbSessionFactory(db)
    factories.append(factory)
    return factory


class ShareConnectionsForQueries(SchemaExtension):
    """Turns sharing on once an operation is known to be a query."""

    def on_execute(self) -> Generator[None, None, None]:
        db = getattr(self.execution_context.context, "db", None)
        if (
            isinstance(db, RequestDbSessionFactory)
            and self.execution_context.operation_type is OperationType.QUERY
        ):
            db.share_connections()
        yield


class RequestConnectionsMiddleware:
    """Returns any shared connection a request still holds once its response has ended,
    however it ended."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        factories: list[RequestDbSessionFactory] = []
        token = _request_factories.set(factories)
        try:
            await self.app(scope, receive, send)
        finally:
            _request_factories.reset(token)
            for factory in factories:
                factory.close_connections()
            for factory in factories:
                await factory.end_request()
