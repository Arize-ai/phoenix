"""GraphQL access controls and query helpers for agent sessions."""

from asyncio import gather
from typing import Any, Optional

from sqlalchemy import ColumnElement
from strawberry.permission import BasePermission
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound


class CanAccessAgentSession(BasePermission):
    """Restrict agent-session fields to active sessions visible to the viewer."""

    async def has_permission(
        self,
        source: Any,
        info: Info[Context, None],
        **kwargs: Any,
    ) -> bool:
        context = info.context
        if not context.settings.agent_assistant_enabled.enabled:
            raise _agent_session_not_found(source.id)
        if source.db_record:
            agent_session_id = source.db_record.id
            owner_id = source.db_record.user_id
        else:
            fields = context.data_loaders.agent_session_fields
            agent_session_id, owner_id = await gather(
                fields.load((source.id, models.AgentSession.id)),
                fields.load((source.id, models.AgentSession.user_id)),
            )
        viewer_id = context.user_id
        session_exists = agent_session_id is not None
        auth_is_enforced = viewer_id is not None and not context.user.is_admin
        viewer_owns_session = owner_id == viewer_id
        if not session_exists or (auth_is_enforced and not viewer_owns_session):
            raise _agent_session_not_found(source.id)
        return True


def get_agent_session_owner_filter(
    context: Context,
    *,
    viewer_only: bool = False,
) -> Optional[ColumnElement[bool]]:
    viewer_id = context.user_id
    is_authentication_disabled = viewer_id is None
    if is_authentication_disabled:
        return None
    is_admin_viewing_all_sessions = context.user.is_admin and not viewer_only
    if is_admin_viewing_all_sessions:
        return None
    return models.AgentSession.user_id == viewer_id


def _agent_session_not_found(agent_session_id: int) -> NotFound:
    global_id = GlobalID(models.AgentSession.__name__, str(agent_session_id))
    return NotFound(f"Unknown agent session: {global_id}")
