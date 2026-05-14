from __future__ import annotations

import strawberry
from starlette.requests import Request
from strawberry.types import Info

from phoenix.server.api.auth import (
    IsAdminIfAuthEnabled,
    IsLocked,
    IsNotReadOnly,
    IsNotViewer,
)
from phoenix.server.api.context import Context
from phoenix.server.api.queries import AgentAssistantEnabled, AgentTraceRecording
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.settings.registry import (
    AgentAssistantEnabledSetting,
    AgentTraceRecordingSetting,
)


def _viewer_user_id(info: Info[Context, None]) -> int | None:
    assert isinstance(request := info.context.request, Request)
    if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
        return int(user.identity)
    return None


@strawberry.input
class SetAgentAssistantEnabledInput:
    enabled: bool


@strawberry.input
class SetAgentTraceRecordingInput:
    allow_local_traces: bool
    allow_remote_export: bool


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
            user_id=_viewer_user_id(info),
        )
        s = info.context.settings.agent_assistant_enabled
        return AgentAssistantEnabled(enabled=s.enabled)

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
            user_id=_viewer_user_id(info),
        )
        recording = info.context.settings.agent_trace_recording
        return AgentTraceRecording(
            allow_local_traces=recording.allow_local_traces,
            allow_remote_export=recording.allow_remote_export,
        )
