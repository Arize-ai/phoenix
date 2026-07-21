from __future__ import annotations

import strawberry
from pydantic import ValidationError
from strawberry.types import Info

from phoenix.server.api.auth import (
    IsAdminIfAuthEnabled,
    IsLocked,
    IsNotReadOnly,
    IsNotViewer,
)
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.settings.registry import (
    AgentAssistantEnabledSetting,
    AgentSessionRetentionSetting,
    AgentTraceRecordingSetting,
)


@strawberry.type
class AgentTraceRecording:
    allow_local_traces: bool
    allow_remote_export: bool


@strawberry.type
class AgentAssistantEnabled:
    enabled: bool


@strawberry.type
class AgentSessionRetention:
    max_idle_days: float
    max_count_per_user: int


@strawberry.input
class SetAgentAssistantEnabledInput:
    enabled: bool


@strawberry.input
class SetAgentTraceRecordingInput:
    allow_local_traces: bool
    allow_remote_export: bool


@strawberry.input
class SetAgentSessionRetentionInput:
    max_idle_days: float = strawberry.field(
        description="Delete persisted sessions idle longer than this many days. 0 disables.",
    )
    max_count_per_user: int = strawberry.field(
        description="Keep only the newest N persisted sessions per user. 0 disables.",
    )


@strawberry.type
class SystemSettingsMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsAdminIfAuthEnabled, IsNotReadOnly, IsNotViewer, IsLocked]
    )  # type: ignore
    async def set_agent_assistant_enabled(
        self,
        info: Info[Context, None],
        input: SetAgentAssistantEnabledInput,
    ) -> AgentAssistantEnabled:
        await info.context.settings.update_agent_assistant_enabled(
            AgentAssistantEnabledSetting(enabled=input.enabled),
            user_id=info.context.user_id,
        )
        setting = info.context.settings.agent_assistant_enabled
        return AgentAssistantEnabled(enabled=setting.enabled)

    @strawberry.mutation(
        permission_classes=[IsAdminIfAuthEnabled, IsNotReadOnly, IsNotViewer, IsLocked]
    )  # type: ignore
    async def set_agent_trace_recording(
        self,
        info: Info[Context, None],
        input: SetAgentTraceRecordingInput,
    ) -> AgentTraceRecording:
        await info.context.settings.update_agent_trace_recording(
            AgentTraceRecordingSetting(
                allow_local_traces=input.allow_local_traces,
                allow_remote_export=input.allow_remote_export,
            ),
            user_id=info.context.user_id,
        )
        recording = info.context.settings.agent_trace_recording
        return AgentTraceRecording(
            allow_local_traces=recording.allow_local_traces,
            allow_remote_export=recording.allow_remote_export,
        )

    @strawberry.mutation(
        permission_classes=[IsAdminIfAuthEnabled, IsNotReadOnly, IsNotViewer, IsLocked]
    )  # type: ignore
    async def set_agent_session_retention(
        self,
        info: Info[Context, None],
        input: SetAgentSessionRetentionInput,
    ) -> AgentSessionRetention:
        try:
            value = AgentSessionRetentionSetting(
                max_idle_days=input.max_idle_days,
                max_count_per_user=input.max_count_per_user,
            )
        except ValidationError as error:
            raise BadRequest(str(error)) from error
        await info.context.settings.update_agent_session_retention(
            value,
            user_id=info.context.user_id,
        )
        retention = info.context.settings.agent_session_retention
        return AgentSessionRetention(
            max_idle_days=retention.max_idle_days,
            max_count_per_user=retention.max_count_per_user,
        )
