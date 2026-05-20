"""
Central authority for sandbox session lifecycle.

Tracks idle TTL and in-flight refcounts; evicts unused sessions in a
background sweeper. Stateless backends bypass tracking — ``acquire``
returns a handle whose ``execute`` calls the backend directly.

Tracked entries are keyed on ``f"{session_key}#{config_fingerprint()}"``
so a mid-iteration config change under the same logical key fragments
into a fresh remote session.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from asyncio import Event, Lock, Task, sleep
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from time import monotonic
from typing import AsyncIterator, Optional

from phoenix.server.sandbox.types import (
    BaseNoSessionBackend,
    ExecutionResult,
    SandboxBackend,
)
from phoenix.server.types import DaemonTask

logger = logging.getLogger(__name__)


_DEFAULT_IDLE_TTL_SECONDS = 300.0
_DEFAULT_SWEEP_INTERVAL_SECONDS = 30.0
_DEFAULT_EVICTION_GRACE_SECONDS = 5.0
_DEFAULT_MAX_SESSIONS_PER_PROVIDER = 32


class SessionLimitExceeded(Exception):
    """``acquire`` refused: per-provider cap reached. Raised before any backend call."""

    MESSAGE = "session_limit_exceeded"

    def __init__(self, message: str = MESSAGE) -> None:
        super().__init__(message)


class SessionInvalidated(Exception):
    """``acquire`` refused: the tracked entry is draining for eviction."""

    MESSAGE = "session_invalidated"

    def __init__(self, message: str = MESSAGE) -> None:
        super().__init__(message)


@dataclass
class _TrackedSession:
    backend: SandboxBackend
    composite_key: str
    provider: str
    #: Opaque remote handle from ``find_or_create_session``; ``None`` between
    #: reservation and the leader's first successful create.
    handle: object = None
    in_flight_count: int = 0
    last_used: float = field(default_factory=monotonic)
    marked_for_eviction: bool = False
    #: Leader sets this after ``find_or_create_session`` resolves so followers
    #: block until the remote session actually exists.
    start_ready: Event = field(default_factory=Event)
    start_error: Optional[BaseException] = None
    rebind_count: int = 0


class SandboxSession:
    """Handle yielded by ``SandboxSessionManager.acquire``.

    ``execute`` runs against the bound remote handle. On a classified
    session-gone failure, the session-capable path asks the manager to
    rebind the handle and retries once. Stateless backends leave the
    manager/lock fields ``None``.
    """

    def __init__(
        self,
        backend: SandboxBackend,
        session_key: str,
        handle: object,
        manager: "Optional[SandboxSessionManager]" = None,
        composite_key: Optional[str] = None,
        key_lock: Optional[Lock] = None,
    ) -> None:
        self._backend = backend
        self._session_key = session_key
        self._handle = handle
        self._manager = manager
        self._composite_key = composite_key
        self._key_lock = key_lock

    @property
    def session_key(self) -> str:
        return self._session_key

    async def execute(
        self,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            return await self._backend.execute_in_session(self._handle, code, timeout=timeout)
        except Exception as exc:
            if (
                self._manager is None
                or self._composite_key is None
                or self._key_lock is None
                or not self._backend.is_session_gone(exc)
            ):
                raise
            new_handle = await self._manager.rebind_handle(self._composite_key, self._key_lock)
            self._handle = new_handle
            try:
                return await self._backend.execute_in_session(self._handle, code, timeout=timeout)
            except Exception as retry_exc:
                # Wrap the second-attempt failure: backends re-raise classified
                # session-gone exceptions rather than wrapping them.
                return ExecutionResult(stdout="", stderr=str(retry_exc), error=str(retry_exc))


class SandboxSessionManager(DaemonTask):
    """Central session lifecycle authority for sandbox backends.

    Public surface:

    - ``acquire(backend, session_key)`` — async context manager yielding a
      ``SandboxSession``. Enforces ``max_sessions_per_provider``.
    - ``evict_for_provider(provider)`` — drop every entry for a provider.
    - ``schedule_eviction(session_key, backend)`` — fire-and-forget drop of
      one tracked entry; retained on the manager so shutdown awaits it.
    - Background sweeper (``_run``) evicts idle entries past the TTL.

    Concurrency: one ``asyncio.Lock`` per composite key in ``_key_locks``;
    dict mutations on ``_tracked`` / ``_key_locks`` run in sync critical
    sections that don't yield, so CPython's GIL makes them atomic against
    other coroutines. The per-key lock serializes the awaits
    (``find_or_create_session``, ``close_session``) on the same key.

    Invariant: ``_key_locks[K]`` is never popped — keeping it preserves
    "``_tracked[K]`` exists ⇒ ``_key_locks[K]`` exists and is the lock all
    coroutines for K serialize on." Growth is bounded by the count of
    distinct composite keys.
    """

    def __init__(
        self,
        *,
        idle_ttl_seconds: Optional[float] = None,
        sweep_interval_seconds: Optional[float] = None,
        eviction_grace_seconds: Optional[float] = None,
        max_sessions_per_provider: Optional[int] = None,
        replica_id: Optional[str] = None,
    ) -> None:
        super().__init__()
        # Per-process id. Callers fold this into long-lived ``session_key``s so
        # two replicas don't converge on the same provider sandbox via
        # list-by-metadata; local in_flight tracking would otherwise be unsafe.
        self._replica_id: str = replica_id if replica_id is not None else uuid.uuid4().hex
        self._idle_ttl_seconds: float = (
            idle_ttl_seconds if idle_ttl_seconds is not None else _DEFAULT_IDLE_TTL_SECONDS
        )
        self._sweep_interval_seconds: float = (
            sweep_interval_seconds
            if sweep_interval_seconds is not None
            else _DEFAULT_SWEEP_INTERVAL_SECONDS
        )
        # Public so tests can compress shutdown/invalidation timing.
        self.eviction_grace_seconds: float = (
            eviction_grace_seconds
            if eviction_grace_seconds is not None
            else _DEFAULT_EVICTION_GRACE_SECONDS
        )
        self._max_sessions_per_provider: int = (
            max_sessions_per_provider
            if max_sessions_per_provider is not None
            else _DEFAULT_MAX_SESSIONS_PER_PROVIDER
        )

        self._key_locks: dict[str, Lock] = {}
        self._tracked: dict[str, _TrackedSession] = {}
        # Fire-and-forget eviction tasks. Held separately from self._tasks
        # (the daemon body, cancelled by DaemonTask.stop) so shutdown can
        # *await* these to completion instead of cancelling mid-close.
        self._pending_tasks: Optional[set[Task[None]]] = None

    @property
    def replica_id(self) -> str:
        """Per-process id; fold into long-lived ``session_key``s for replica isolation."""
        return self._replica_id

    # ------------------------------------------------------------------
    # Public surface
    # ------------------------------------------------------------------

    @asynccontextmanager
    async def acquire(
        self,
        backend: SandboxBackend,
        session_key: str,
    ) -> AsyncIterator[SandboxSession]:
        """Yield a ``SandboxSession`` bound to ``session_key``.

        Session-capable backends: leader binds the remote session under the
        per-key lock; followers reuse the same handle. Refcount updates on
        enter/exit, close-on-release if the entry was marked for eviction.
        Stateless backends short-circuit without locking or tracking.
        """
        if isinstance(backend, BaseNoSessionBackend):
            sentinel = await backend.find_or_create_session(session_key)
            yield SandboxSession(backend, session_key, sentinel)
            return

        composite_key = self._composite_key(session_key, backend)
        key_lock = self._get_or_create_key_lock(composite_key)

        async with key_lock:
            tracked, is_new = self._get_or_reserve(backend, composite_key, key_lock)
            if is_new:
                try:
                    handle = await backend.find_or_create_session(composite_key)
                except BaseException as exc:
                    # Drop the reservation; wake followers so they re-raise.
                    # ``_key_locks`` is left in place (see class docstring).
                    tracked.start_error = exc
                    self._tracked.pop(composite_key, None)
                    tracked.start_ready.set()
                    raise
                tracked.handle = handle
                tracked.start_ready.set()

            # Followers block until the leader's create resolves; on failure
            # re-raise the leader's exception rather than yielding a session
            # bound to a remote that does not exist.
            await tracked.start_ready.wait()
            if tracked.start_error is not None:
                raise tracked.start_error
            tracked.in_flight_count += 1
            tracked.last_used = monotonic()
            session_handle = tracked.handle

        try:
            yield SandboxSession(
                backend,
                session_key,
                session_handle,
                manager=self,
                composite_key=composite_key,
                key_lock=key_lock,
            )
        finally:
            await self._release(composite_key, key_lock)

    async def evict_for_provider(self, provider: str) -> None:
        """Evict every tracked session for ``provider``; in-use entries are
        marked for close-on-release.
        """
        targets = [k for k, t in self._tracked.items() if t.provider == provider]
        await self._evict_targets(targets)

    def schedule_eviction(self, session_key: str, backend: SandboxBackend) -> None:
        """Fire-and-forget eviction of one tracked entry.

        Used by callers that can't await inline (e.g. per-execute timeout
        teardown). The task is retained on the manager so shutdown awaits
        the underlying ``close_session`` instead of cancelling it.
        """
        if self._pending_tasks is None:
            self._pending_tasks = set()
        composite_key = self._composite_key(session_key, backend)
        task: Task[None] = asyncio.create_task(self._evict_targets([composite_key]))
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)

    async def wait_for_drain(
        self,
        session_key: str,
        backend: SandboxBackend,
        timeout: Optional[float] = None,
    ) -> None:
        """Wait until the tracked entry for ``(session_key, backend)`` is gone.

        For callers that hit ``SessionInvalidated`` and want to retry ``acquire``
        after the drain. Defaults to ``eviction_grace_seconds * 2``.
        Raises ``asyncio.TimeoutError`` on timeout.
        """
        composite_key = self._composite_key(session_key, backend)
        if timeout is None:
            timeout = self.eviction_grace_seconds * 2
        deadline = monotonic() + max(timeout, 0.0)
        poll = min(0.05, max(0.005, timeout / 20.0))
        while True:
            if self._tracked.get(composite_key) is None:
                return
            if monotonic() >= deadline:
                raise asyncio.TimeoutError(
                    f"wait_for_drain timed out after {timeout:.3f}s: "
                    f"composite_key={composite_key!r} still tracked"
                )
            await sleep(poll)

    async def rebind_handle(self, composite_key: str, key_lock: Lock) -> object:
        """Bind a fresh remote handle for an existing tracked entry.

        Called by ``SandboxSession.execute`` on a classified session-gone
        failure to set up a retry. Raises ``SessionInvalidated`` if the
        entry is draining or gone.
        """
        async with key_lock:
            tracked = self._tracked.get(composite_key)
            if tracked is None or tracked.marked_for_eviction:
                raise SessionInvalidated()
            backend = tracked.backend
            new_handle = await backend.find_or_create_session(composite_key)
            tracked.handle = new_handle
            tracked.rebind_count += 1
            logger.warning(
                "Sandbox session rebound: composite_key=%r provider=%r rebind_count=%d",
                composite_key,
                tracked.provider,
                tracked.rebind_count,
            )
            return new_handle

    # ------------------------------------------------------------------
    # DaemonTask body
    # ------------------------------------------------------------------

    async def _run(self) -> None:
        while self._running:
            try:
                await self._sweep_idle()
            except Exception:
                logger.exception("Sandbox session manager sweep failed")
            await sleep(self._sweep_interval_seconds)

    async def stop(self) -> None:
        """Drain in-flight sessions, then cancel the sweeper.

        Three phases under DaemonTask.stop's 10s ceiling: (1) await
        ``_pending_tasks`` so scheduled close_session calls complete;
        (2) ``_evict_targets`` over every tracked key; (3) cancel sweeper.
        """
        pending = self._pending_tasks
        if pending:
            # asyncio.wait leaves still-pending tasks running (not cancelled)
            # so a slow close_session past the grace window completes.
            _, still_pending = await asyncio.wait(pending, timeout=self.eviction_grace_seconds)
            if still_pending:
                logger.warning(
                    "Pending sandbox eviction tasks did not drain within %.2fs",
                    self.eviction_grace_seconds,
                )
        tracked_keys = list(self._tracked.keys())
        if tracked_keys:
            try:
                await self._evict_targets(tracked_keys)
            except Exception:
                logger.exception("Failed to drain tracked sandbox sessions during shutdown")
        await super().stop()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _get_or_create_key_lock(self, composite_key: str) -> Lock:
        return self._key_locks.setdefault(composite_key, Lock())

    def _composite_key(self, session_key: str, backend: SandboxBackend) -> str:
        return f"{session_key}#{backend.config_fingerprint()}"

    def _get_or_reserve(
        self,
        backend: SandboxBackend,
        composite_key: str,
        key_lock: Lock,
    ) -> tuple[_TrackedSession, bool]:
        """Return ``(tracked, is_new)``; ``is_new`` ⇒ caller is the leader
        and must call ``find_or_create_session`` then flip ``start_ready``.

        Sync (not async): existence/capacity/insert run as one GIL-atomic
        Python step, replacing an explicit state lock.
        """
        existing = self._tracked.get(composite_key)
        if existing is not None:
            if existing.marked_for_eviction:
                raise SessionInvalidated()
            return existing, False
        provider = backend.provider or type(backend).__name__
        count = sum(1 for t in self._tracked.values() if t.provider == provider)
        if count >= self._max_sessions_per_provider:
            raise SessionLimitExceeded()
        tracked = _TrackedSession(
            backend=backend,
            composite_key=composite_key,
            provider=provider,
        )
        self._tracked[composite_key] = tracked
        self._key_locks.setdefault(composite_key, key_lock)
        return tracked, True

    async def _release(self, composite_key: str, key_lock: Lock) -> None:
        """Decrement in-flight count; close-on-zero if marked for eviction.

        ``close_session`` runs outside the per-key lock so concurrent
        same-key acquires don't block on it.
        """
        close_backend: Optional[SandboxBackend] = None
        close_key: Optional[str] = None
        async with key_lock:
            tracked = self._tracked.get(composite_key)
            if tracked is None:
                return
            tracked.in_flight_count = max(0, tracked.in_flight_count - 1)
            tracked.last_used = monotonic()
            if tracked.marked_for_eviction and tracked.in_flight_count == 0:
                close_backend = tracked.backend
                close_key = tracked.composite_key
                self._tracked.pop(composite_key, None)
        if close_backend is not None and close_key is not None:
            try:
                await close_backend.close_session(close_key)
            except Exception:
                logger.exception(
                    "Failed to close sandbox session on release: backend=%r key=%r",
                    type(close_backend).__name__,
                    close_key,
                )

    async def _evict_targets(self, targets: list[str]) -> None:
        """Close idle entries; mark in-flight ones; poll up to
        ``eviction_grace_seconds`` for marked entries to drain.

        Best-effort: a marked entry that doesn't drain in time stays marked
        and is closed on its next release. ``targets`` may include
        already-removed keys (silently skipped).
        """
        # Pass 1: classify under each per-key lock.
        idle_closes: list[tuple[SandboxBackend, str]] = []
        marked: list[tuple[str, _TrackedSession]] = []
        for composite_key in targets:
            key_lock = self._key_locks.get(composite_key)
            if key_lock is None:
                continue
            async with key_lock:
                tracked = self._tracked.get(composite_key)
                if tracked is None:
                    continue
                if tracked.in_flight_count == 0:
                    idle_closes.append((tracked.backend, tracked.composite_key))
                    self._tracked.pop(composite_key, None)
                else:
                    tracked.marked_for_eviction = True
                    marked.append((composite_key, tracked))
        # Pass 2: close idle entries outside the locks.
        for backend, key in idle_closes:
            try:
                await backend.close_session(key)
            except Exception:
                logger.exception(
                    "Failed to close sandbox session during eviction: backend=%r key=%r",
                    type(backend).__name__,
                    key,
                )
        # Pass 3: wait for in-flight marked entries to drain via _release.
        if not marked:
            return
        deadline = monotonic() + self.eviction_grace_seconds
        poll_interval = min(0.05, max(0.005, self.eviction_grace_seconds / 20.0))
        while marked and monotonic() < deadline:
            await sleep(poll_interval)
            # Identity check: a same-key re-acquire would insert a new instance;
            # only the original instance still under the key is what we marked.
            marked = [(k, t) for (k, t) in marked if self._tracked.get(k) is t]

    async def _sweep_idle(self) -> None:
        now = monotonic()
        ttl = self._idle_ttl_seconds
        candidates = [
            k
            for k, t in self._tracked.items()
            if t.in_flight_count == 0 and now - t.last_used > ttl
        ]
        # Classify under per-key locks first; dispatch close_session after,
        # so a slow close doesn't block the rest of the scan.
        idle_closes: list[tuple[SandboxBackend, str]] = []
        for composite_key in candidates:
            key_lock = self._key_locks.get(composite_key)
            if key_lock is None:
                continue
            async with key_lock:
                tracked = self._tracked.get(composite_key)
                if tracked is None:
                    continue
                if tracked.in_flight_count != 0:
                    continue
                if monotonic() - tracked.last_used <= ttl:
                    continue
                idle_closes.append((tracked.backend, tracked.composite_key))
                self._tracked.pop(composite_key, None)
        for backend, key in idle_closes:
            try:
                await backend.close_session(key)
            except Exception:
                logger.exception(
                    "Failed to close idle sandbox session: backend=%r key=%r",
                    type(backend).__name__,
                    key,
                )
