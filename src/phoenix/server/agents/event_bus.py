"""Per-process fan-out and database-visible state for agent-session turns."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import aclosing, asynccontextmanager
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import TYPE_CHECKING, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk

from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.agents.run_locks import (
    SessionRun,
    claim_run,
    delete_stale_runs,
    get_run,
    heartbeat_runs,
    release_run,
    request_stop,
    transition_run,
)
from phoenix.server.api.openapi.registry import register_openapi_schema
from phoenix.server.types import DaemonTask, DbSessionFactory

if TYPE_CHECKING:
    from phoenix.server.agents.turn_runner import TurnRunner


logger = logging.getLogger(__name__)

_INSTANCE_ID = uuid4().hex
_MAX_REPLAY_CHUNKS = 100_000
_HEARTBEAT_INTERVAL_SECONDS = 10
_STALE_AFTER_SECONDS = 30
_REMOTE_STATE_POLL_INTERVAL_SECONDS = 5
_KEEP_ALIVE_INTERVAL_SECONDS = 15


class SessionRunState(str, Enum):
    IDLE = "idle"
    STREAMING = "streaming"
    PERSISTING = "persisting"
    AWAITING_CLIENT_TOOL = "awaiting_client_tool"
    MUTATING = "mutating"


class _CamelDataModel(BaseModel):
    model_config = ConfigDict(alias_generator=lambda name: _to_camel(name), populate_by_name=True)


def _to_camel(name: str) -> str:
    first, *rest = name.split("_")
    return first + "".join(word.capitalize() for word in rest)


class SessionStateData(_CamelDataModel):
    state: SessionRunState
    turn_id: str | None = None
    assistant_message_id: str | None = None
    origin_client_id: str | None = None
    owned_by_this_instance: bool
    stream_available: bool


@register_openapi_schema
class SessionStateChunk(DataChunk):
    type: Literal["data-session-state"] = "data-session-state"
    data: SessionStateData
    transient: Literal[True] = True


class SessionTurnStartedData(_CamelDataModel):
    turn_id: str
    message: PhoenixUIMessage


@register_openapi_schema
class SessionTurnStartedChunk(DataChunk):
    type: Literal["data-turn-started"] = "data-turn-started"
    data: SessionTurnStartedData
    transient: Literal[True] = True


class BusyErrorData(_CamelDataModel):
    code: Literal["agent_session_busy"] = "agent_session_busy"
    state: SessionRunState
    turn_id: str
    assistant_message_id: str | None = None
    owned_by_this_instance: bool


@register_openapi_schema
class AgentSessionBusyErrorBody(BusyErrorData):
    pass


class SessionBusyError(Exception):
    def __init__(self, run: SessionRun, *, owned_by_this_instance: bool) -> None:
        super().__init__(f"Agent session is busy ({run.state})")
        self.run = run
        self.owned_by_this_instance = owned_by_this_instance

    @property
    def body(self) -> AgentSessionBusyErrorBody:
        return AgentSessionBusyErrorBody(
            state=SessionRunState(self.run.state),
            turn_id=self.run.turn_id,
            assistant_message_id=self.run.assistant_message_id,
            owned_by_this_instance=self.owned_by_this_instance,
        )


class TurnIdMismatchError(Exception):
    def __init__(self, run: SessionRun) -> None:
        super().__init__("The requested turn is no longer active")
        self.run = run


class _TurnEnded:
    def __init__(self, turn_id: str) -> None:
        self.turn_id = turn_id


_ChannelEvent = BaseChunk | _TurnEnded


class SessionChannel:
    def __init__(self, *, agent_session_id: int) -> None:
        self.agent_session_id = agent_session_id
        self.state = SessionRunState.IDLE
        self.turn_id: str | None = None
        self.assistant_message_id: str | None = None
        self.origin_client_id: str | None = None
        self.submitted_message: PhoenixUIMessage | None = None
        self.stream_available = True
        self.turn_log: list[BaseChunk] = []
        self.last_ended_turn_id: str | None = None
        self.subscribers: set[asyncio.Queue[_ChannelEvent]] = set()
        self.runner: TurnRunner | None = None
        self.runner_task: asyncio.Task[None] | None = None

    def state_chunk(self) -> SessionStateChunk:
        return SessionStateChunk(
            data=SessionStateData(
                state=self.state,
                turn_id=self.turn_id,
                assistant_message_id=self.assistant_message_id,
                origin_client_id=self.origin_client_id,
                owned_by_this_instance=True,
                stream_available=self.stream_available,
            )
        )

    def begin_turn(
        self,
        *,
        turn_id: str,
        assistant_message_id: str,
        origin_client_id: str | None,
        submitted_message: PhoenixUIMessage,
    ) -> None:
        self.state = SessionRunState.STREAMING
        self.turn_id = turn_id
        self.assistant_message_id = assistant_message_id
        self.origin_client_id = origin_client_id
        self.submitted_message = submitted_message
        self.stream_available = True
        self.turn_log = []
        self.last_ended_turn_id = None
        self._broadcast(self.state_chunk())
        self._broadcast(
            SessionTurnStartedChunk(
                data=SessionTurnStartedData(turn_id=turn_id, message=submitted_message)
            )
        )

    def set_state(self, state: SessionRunState) -> None:
        self.state = state
        self._broadcast(self.state_chunk())

    def publish(self, chunk: BaseChunk) -> None:
        # Deliberately synchronous: the turn runner's consume loop must have no
        # suspension points other than the stream's __anext__, so that a stop
        # cancellation is always delivered *inside* the stream generator (whose
        # except/finally blocks perform the partial persist and trace flush).
        if self.stream_available:
            if len(self.turn_log) < _MAX_REPLAY_CHUNKS:
                self.turn_log.append(chunk)
            else:
                self.turn_log.clear()
                self.stream_available = False
                self._broadcast(self.state_chunk())
        self._broadcast(chunk)

    def finish_turn(self, *, state: SessionRunState) -> None:
        ended_turn_id = self.turn_id
        self.set_state(state)
        if ended_turn_id is not None:
            self.last_ended_turn_id = ended_turn_id
            self._broadcast(_TurnEnded(ended_turn_id))
        self.runner = None
        self.runner_task = None
        if state is SessionRunState.IDLE:
            self.turn_id = None
            self.assistant_message_id = None
            self.origin_client_id = None
            self.submitted_message = None
            self.stream_available = True

    def request_stop(self) -> bool:
        if self.runner is None:
            return False
        self.runner.request_stop()
        return True

    def _broadcast(self, event: _ChannelEvent) -> None:
        for subscriber in tuple(self.subscribers):
            subscriber.put_nowait(event)

    async def subscribe_turn(self, *, turn_id: str) -> AsyncIterator[BaseChunk]:
        queue: asyncio.Queue[_ChannelEvent] = asyncio.Queue()
        self.subscribers.add(queue)
        replay = list(self.turn_log) if self.turn_id == turn_id and self.stream_available else []
        if self.last_ended_turn_id == turn_id and self.stream_available:
            replay = list(self.turn_log)
        try:
            for chunk in replay:
                yield chunk
            if self.last_ended_turn_id == turn_id:
                return
            while True:
                event = await queue.get()
                if isinstance(event, _TurnEnded) and event.turn_id == turn_id:
                    return
                if isinstance(event, (SessionStateChunk, SessionTurnStartedChunk, _TurnEnded)):
                    continue
                yield event
        finally:
            self.subscribers.discard(queue)

    async def subscribe_session(self) -> AsyncGenerator[BaseChunk | None, None]:
        queue: asyncio.Queue[_ChannelEvent] = asyncio.Queue()
        self.subscribers.add(queue)
        initial_events: list[BaseChunk] = [self.state_chunk()]
        if (
            self.turn_id is not None
            and self.submitted_message is not None
            and self.stream_available
        ):
            initial_events.append(
                SessionTurnStartedChunk(
                    data=SessionTurnStartedData(
                        turn_id=self.turn_id,
                        message=self.submitted_message,
                    )
                )
            )
            initial_events.extend(self.turn_log)
        try:
            for initial_event in initial_events:
                yield initial_event
            while True:
                try:
                    queued_event = await asyncio.wait_for(
                        queue.get(), timeout=_REMOTE_STATE_POLL_INTERVAL_SECONDS
                    )
                except asyncio.TimeoutError:
                    yield None
                    continue
                if isinstance(queued_event, _TurnEnded):
                    continue
                yield queued_event
        finally:
            self.subscribers.discard(queue)


class AgentSessionEventBus(DaemonTask):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db
        self._channels: dict[int, SessionChannel] = {}

    @property
    def instance_id(self) -> str:
        return _INSTANCE_ID

    async def begin_turn(
        self,
        *,
        agent_session_id: int,
        turn_id: str,
        assistant_message_id: str,
        origin_client_id: str | None,
        submitted_message: PhoenixUIMessage,
        is_continuation: bool,
    ) -> SessionChannel:
        async with self._db() as session:
            claimed = await claim_run(
                session,
                agent_session_id=agent_session_id,
                turn_id=turn_id,
                state=SessionRunState.STREAMING.value,
                assistant_message_id=assistant_message_id,
                origin_client_id=origin_client_id,
                instance_id=self.instance_id,
                allow_awaiting_continuation=is_continuation,
            )
            if claimed is None:
                existing = await get_run(session, agent_session_id=agent_session_id)
                if existing is None:
                    raise RuntimeError("Agent session lease disappeared during claim")
                raise SessionBusyError(
                    existing,
                    owned_by_this_instance=existing.instance_id == self.instance_id,
                )
        channel = self._channels.setdefault(
            agent_session_id, SessionChannel(agent_session_id=agent_session_id)
        )
        channel.begin_turn(
            turn_id=turn_id,
            assistant_message_id=assistant_message_id,
            origin_client_id=origin_client_id,
            submitted_message=submitted_message,
        )
        return channel

    def start_runner(self, channel: SessionChannel, runner: TurnRunner) -> None:
        channel.runner = runner
        task = asyncio.create_task(runner.run())
        channel.runner_task = task

    async def mark_persisting(self, *, agent_session_id: int, turn_id: str) -> None:
        async with self._db() as session:
            transitioned = await transition_run(
                session,
                agent_session_id=agent_session_id,
                instance_id=self.instance_id,
                turn_id=turn_id,
                state=SessionRunState.PERSISTING.value,
            )
        if transitioned is None:
            raise RuntimeError("Agent session lease was lost before persistence")
        if channel := self._channels.get(agent_session_id):
            channel.set_state(SessionRunState.PERSISTING)

    async def complete_turn(
        self,
        *,
        agent_session_id: int,
        turn_id: str,
        awaiting_client_tool: bool,
    ) -> None:
        next_state = (
            SessionRunState.AWAITING_CLIENT_TOOL if awaiting_client_tool else SessionRunState.IDLE
        )
        try:
            async with self._db() as session:
                if awaiting_client_tool:
                    await transition_run(
                        session,
                        agent_session_id=agent_session_id,
                        instance_id=self.instance_id,
                        turn_id=turn_id,
                        state=next_state.value,
                    )
                else:
                    await release_run(
                        session,
                        agent_session_id=agent_session_id,
                        instance_id=self.instance_id,
                        turn_id=turn_id,
                    )
        except Exception:
            # Always finish the channel locally so the session can't get stuck
            # busy in memory; the heartbeat reconciles the orphaned DB lease.
            logger.exception(
                "Failed to update the agent session lease at turn completion; "
                "the heartbeat will reconcile it"
            )
            next_state = SessionRunState.IDLE
        if channel := self._channels.get(agent_session_id):
            channel.finish_turn(state=next_state)
            self._discard_idle_channel(channel)

    @asynccontextmanager
    async def hold_mutation(self, *, agent_session_id: int) -> AsyncIterator[None]:
        turn_id = uuid4().hex
        async with self._db() as session:
            claimed = await claim_run(
                session,
                agent_session_id=agent_session_id,
                turn_id=turn_id,
                state=SessionRunState.MUTATING.value,
                assistant_message_id=None,
                origin_client_id=None,
                instance_id=self.instance_id,
            )
            if claimed is None:
                existing = await get_run(session, agent_session_id=agent_session_id)
                if existing is None:
                    raise RuntimeError("Agent session lease disappeared during claim")
                raise SessionBusyError(
                    existing,
                    owned_by_this_instance=existing.instance_id == self.instance_id,
                )
        channel = self._channels.setdefault(
            agent_session_id, SessionChannel(agent_session_id=agent_session_id)
        )
        channel.turn_id = turn_id
        channel.set_state(SessionRunState.MUTATING)
        try:
            yield
        finally:
            try:
                async with self._db() as session:
                    await release_run(
                        session,
                        agent_session_id=agent_session_id,
                        instance_id=self.instance_id,
                        turn_id=turn_id,
                    )
            except Exception:
                logger.exception(
                    "Failed to release the agent session mutation lease; "
                    "the heartbeat will reconcile it"
                )
            channel.finish_turn(state=SessionRunState.IDLE)
            self._discard_idle_channel(channel)

    async def get_run(self, *, agent_session_id: int) -> SessionRun | None:
        # Lease reads must hit the primary: stop/busy decisions acting on a
        # lagging read replica could miss or resurrect a lease.
        async with self._db() as session:
            return await get_run(session, agent_session_id=agent_session_id)

    async def request_stop(
        self,
        *,
        agent_session_id: int,
        turn_id: str | None,
    ) -> tuple[SessionRun | None, bool]:
        run = await self.get_run(agent_session_id=agent_session_id)
        if run is None:
            return None, False
        if turn_id is not None and run.turn_id != turn_id:
            raise TurnIdMismatchError(run)
        is_local = run.instance_id == self.instance_id
        if is_local:
            channel = self._channels.get(agent_session_id)
            if channel is not None and channel.request_stop():
                return run, True
        async with self._db() as session:
            updated = await request_stop(
                session,
                agent_session_id=agent_session_id,
                turn_id=run.turn_id,
            )
        return updated, is_local

    async def release_awaiting_turn(self, *, run: SessionRun) -> None:
        async with self._db() as session:
            await release_run(
                session,
                agent_session_id=run.agent_session_id,
                instance_id=run.instance_id,
                turn_id=run.turn_id,
            )
        if channel := self._channels.get(run.agent_session_id):
            channel.request_stop()
            channel.finish_turn(state=SessionRunState.IDLE)
            self._discard_idle_channel(channel)

    def _get_fresh_remote_run(self, run: SessionRun | None) -> SessionRun | None:
        """Return the run if it is live on another instance, else None."""
        if run is None or run.instance_id == self.instance_id:
            return None
        is_stale = run.heartbeat_at < datetime.now(timezone.utc) - timedelta(
            seconds=_STALE_AFTER_SECONDS
        )
        return None if is_stale else run

    async def session_events(self, *, agent_session_id: int) -> AsyncIterator[BaseChunk | None]:
        last_remote_state: SessionStateData | None = None
        while True:
            remote_run = self._get_fresh_remote_run(
                await self.get_run(agent_session_id=agent_session_id)
            )
            if remote_run is None:
                # This instance owns the session (or nobody does): subscribe to
                # the local channel, creating an idle one if needed so future
                # local turns surface. While idle, re-poll the lease so a turn
                # started on another instance still surfaces as a remote state
                # change.
                channel = self._channels.setdefault(
                    agent_session_id, SessionChannel(agent_session_id=agent_session_id)
                )
                keep_alive_elapsed_seconds = 0
                async with aclosing(channel.subscribe_session()) as subscription:
                    async for event in subscription:
                        if event is not None:
                            keep_alive_elapsed_seconds = 0
                            yield event
                            continue
                        if channel.state is SessionRunState.IDLE:
                            run = await self.get_run(agent_session_id=agent_session_id)
                            if self._get_fresh_remote_run(run) is not None:
                                break
                        keep_alive_elapsed_seconds += _REMOTE_STATE_POLL_INTERVAL_SECONDS
                        if keep_alive_elapsed_seconds >= _KEEP_ALIVE_INTERVAL_SECONDS:
                            keep_alive_elapsed_seconds = 0
                            yield None
                    else:
                        return
                self._discard_idle_channel(channel)
                continue
            remote_state = SessionStateData(
                state=SessionRunState(remote_run.state),
                turn_id=remote_run.turn_id,
                assistant_message_id=remote_run.assistant_message_id,
                origin_client_id=remote_run.origin_client_id,
                owned_by_this_instance=False,
                stream_available=False,
            )
            if remote_state != last_remote_state:
                yield SessionStateChunk(data=remote_state)
                last_remote_state = remote_state
            await asyncio.sleep(_REMOTE_STATE_POLL_INTERVAL_SECONDS)

    async def _run(self) -> None:
        while self._running:
            await asyncio.sleep(_HEARTBEAT_INTERVAL_SECONDS)
            try:
                await self._heartbeat_and_sweep()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Agent session event-bus heartbeat failed")

    async def _heartbeat_and_sweep(self) -> None:
        async with self._db() as session:
            owned_runs = await heartbeat_runs(session, instance_id=self.instance_id)
            await delete_stale_runs(session, instance_id=self.instance_id)
        owned_by_session_id = {run.agent_session_id: run for run in owned_runs}
        for agent_session_id, channel in tuple(self._channels.items()):
            if channel.state is SessionRunState.IDLE:
                self._discard_idle_channel(channel)
                continue
            run = owned_by_session_id.get(agent_session_id)
            if run is None:
                # The lease may have been claimed after the heartbeat UPDATE
                # snapshot (a turn that started mid-heartbeat); re-check before
                # declaring the lock lost, or a fresh turn gets killed.
                run = await self.get_run(agent_session_id=agent_session_id)
                if run is None or run.instance_id != self.instance_id:
                    channel.request_stop()
                    channel.finish_turn(state=SessionRunState.IDLE)
                    self._discard_idle_channel(channel)
                    continue
            if run.stop_requested_at is not None:
                channel.request_stop()
        # Release zombie leases: rows we own whose channel is gone or idle
        # (e.g. a turn whose completion-time DB update failed). Without this,
        # the heartbeat renews the row forever and the session stays locked.
        reconcile_before = datetime.now(timezone.utc) - timedelta(
            seconds=_HEARTBEAT_INTERVAL_SECONDS
        )
        for agent_session_id, run in owned_by_session_id.items():
            owned_channel = self._channels.get(agent_session_id)
            if owned_channel is not None and owned_channel.state is not SessionRunState.IDLE:
                continue
            if run.started_at > reconcile_before:
                # A lease claimed moments ago may not have its channel set up
                # yet (begin_turn suspends between the DB claim and the channel
                # transition); give it a full interval before reconciling.
                continue
            logger.warning(
                "Releasing orphaned agent session lease for session %d (state=%s)",
                agent_session_id,
                run.state,
            )
            try:
                async with self._db() as session:
                    await release_run(
                        session,
                        agent_session_id=agent_session_id,
                        instance_id=self.instance_id,
                        turn_id=run.turn_id,
                    )
            except Exception:
                logger.exception("Failed to release orphaned agent session lease")

    def _discard_idle_channel(self, channel: SessionChannel) -> None:
        if channel.state is SessionRunState.IDLE and not channel.subscribers:
            self._channels.pop(channel.agent_session_id, None)

    async def stop(self) -> None:
        await super().stop()
        tasks: list[asyncio.Task[None]] = []
        for channel in tuple(self._channels.values()):
            channel.request_stop()
            if channel.runner_task is not None:
                tasks.append(channel.runner_task)
        if tasks:
            try:
                await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30)
            except asyncio.TimeoutError:
                for task in tasks:
                    task.cancel()
        self._channels.clear()
