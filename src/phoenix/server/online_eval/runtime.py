"""Composes the online-eval daemons into a single lifecycle the app can hold.

Construction follows the two enable flags: nothing is built while online evaluation is
off, and the session arm — its consumer, its sweeper, the signal drain, and the
annotation delta adapter — is built only while session evaluation is on as well. Those
are the same flags `request_evaluations` reads, so the drain can never be left asking a
runtime that refuses to answer.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import AsyncExitStack
from typing import Any, Callable, Optional

from phoenix.config import (
    get_env_online_eval_claim_batch_size,
    get_env_online_eval_consumer_tick_interval_seconds,
    get_env_online_eval_max_db_concurrency,
    get_env_online_eval_max_evaluator_concurrency,
    get_env_online_eval_max_outstanding,
    get_env_online_eval_max_sandbox_payload_bytes,
    get_env_online_eval_max_transcript_bytes,
    get_env_online_eval_pending_ttl_seconds,
)
from phoenix.server.dml_event import DmlEvent
from phoenix.server.online_eval.consumer import OnlineEvalConsumer
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.online_eval.session_sweeper import SessionEvalSweeper
from phoenix.server.online_eval.triggering.annotations_adapter import AnnotationDeltaAdapter
from phoenix.server.online_eval.triggering.drain import SignalDrain
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import CanPutItem, DaemonTask, DbSessionFactory
from phoenix.tracers import Tracer

logger = logging.getLogger(__name__)


class OnlineEvalRuntime:
    """Every online-eval daemon, constructed, started, and stopped together."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        decrypt: Callable[[bytes], bytes],
        sandbox_session_manager: Optional[SandboxSessionManager] = None,
        sandbox_runtime: Optional[SandboxRuntimeContext] = None,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
        tracer_factory: Optional[Callable[[], Tracer]] = None,
        read_only: bool = False,
    ) -> None:
        self.producer: Optional[OnlineEvalProducer] = None
        self.consumer: Optional[OnlineEvalConsumer] = None
        self.session_consumer: Optional[OnlineEvalConsumer] = None
        self.session_sweeper: Optional[SessionEvalSweeper] = None
        self.signal_drain: Optional[SignalDrain] = None
        self.annotation_adapter: Optional[AnnotationDeltaAdapter] = None
        self._stack: Optional[AsyncExitStack] = None
        if read_only:
            return
        claim_batch_size = get_env_online_eval_claim_batch_size()
        tick_interval_seconds = get_env_online_eval_consumer_tick_interval_seconds()
        _warn_if_pending_work_can_expire_under_backpressure(
            claim_batch_size=claim_batch_size,
            tick_interval_seconds=tick_interval_seconds,
        )
        # Read here so a malformed limit fails startup rather than the first evaluation
        # that needs it.
        get_env_online_eval_max_transcript_bytes()
        get_env_online_eval_max_sandbox_payload_bytes()
        evaluator_semaphore = asyncio.Semaphore(get_env_online_eval_max_evaluator_concurrency())
        db_semaphore = asyncio.Semaphore(get_env_online_eval_max_db_concurrency())
        self.producer = OnlineEvalProducer(db)
        self.consumer = OnlineEvalConsumer(
            db,
            decrypt=decrypt,
            sandbox_session_manager=sandbox_session_manager,
            sandbox_runtime=sandbox_runtime,
            event_queue=event_queue,
            tick_interval_seconds=tick_interval_seconds,
            claim_batch_size=claim_batch_size,
            evaluator_semaphore=evaluator_semaphore,
            db_semaphore=db_semaphore,
            tracer_factory=tracer_factory,
        )
        # The whole session arm sits behind the one flag: a consumer without its sweeper
        # claims from a table only the sweeper fills, and a drain without a session arm
        # writes requests nothing answers.
        self.session_consumer = OnlineEvalConsumer(
            db,
            decrypt=decrypt,
            sandbox_session_manager=sandbox_session_manager,
            sandbox_runtime=sandbox_runtime,
            event_queue=event_queue,
            evaluation_target="SESSION",
            tick_interval_seconds=tick_interval_seconds,
            claim_batch_size=claim_batch_size,
            evaluator_semaphore=evaluator_semaphore,
            db_semaphore=db_semaphore,
            tracer_factory=tracer_factory,
        )
        self.session_sweeper = SessionEvalSweeper(db)
        self.signal_drain = SignalDrain(db)
        self.annotation_adapter = AnnotationDeltaAdapter(db)

    @property
    def daemons(self) -> tuple[DaemonTask, ...]:
        """The constructed daemons in startup order.

        Each one starts after whatever consumes what it produces, so the reversed
        teardown stops the annotation scan before the drain, the drain before the
        sweeper, and every scheduler before the consumer it feeds.
        """
        ordered = (
            self.consumer,
            self.session_consumer,
            self.producer,
            self.session_sweeper,
            self.signal_drain,
            self.annotation_adapter,
        )
        return tuple(daemon for daemon in ordered if daemon is not None)

    async def start(self) -> None:
        """Start every constructed daemon, stopping the started ones if any fails."""
        if self._stack is not None:
            return
        stack = AsyncExitStack()
        try:
            for daemon in self.daemons:
                await stack.enter_async_context(daemon)
        except BaseException:
            await stack.aclose()
            raise
        self._stack = stack

    async def stop(self) -> None:
        """Stop every daemon this runtime started, waiting for their tasks."""
        if (stack := self._stack) is None:
            return
        self._stack = None
        await stack.aclose()

    async def __aenter__(self) -> "OnlineEvalRuntime":
        await self.start()
        return self

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        await self.stop()


def _warn_if_pending_work_can_expire_under_backpressure(
    *,
    claim_batch_size: int,
    tick_interval_seconds: float,
) -> None:
    pending_ttl_seconds = get_env_online_eval_pending_ttl_seconds()
    # Worst case, a full admission-gate backlog drains at claim_batch_size /
    # tick_interval per replica; a smaller TTL sheds work during routine backpressure
    # rather than only when consumers are down.
    min_safe_ttl_seconds = (
        get_env_online_eval_max_outstanding() * tick_interval_seconds / claim_batch_size
    )
    if 0 < pending_ttl_seconds < min_safe_ttl_seconds:
        logger.warning(
            "PHOENIX_ONLINE_EVAL_PENDING_TTL_SECONDS (%s) is below the time a full "
            "online-eval backlog needs to drain on one replica (%s seconds at %s claims "
            "per %s-second tick). Pending evaluations can expire unevaluated during "
            "normal backpressure; raise the TTL, the claim batch size, or the replica "
            "count, or set the TTL to 0 to disable shedding.",
            pending_ttl_seconds,
            round(min_safe_ttl_seconds),
            claim_batch_size,
            tick_interval_seconds,
        )
