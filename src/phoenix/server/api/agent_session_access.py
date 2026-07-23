from typing import Optional

from sqlalchemy import ColumnElement

from phoenix.db import models
from phoenix.server.api.context import Context


def can_access_agent_session(context: Context, owner_id: Optional[int]) -> bool:
    viewer_id = context.user_id
    return viewer_id is None or context.user.is_admin or owner_id == viewer_id


def get_agent_session_owner_filter(context: Context) -> Optional[ColumnElement[bool]]:
    viewer_id = context.user_id
    if viewer_id is None or context.user.is_admin:
        return None
    return models.AgentSession.user_id == viewer_id
