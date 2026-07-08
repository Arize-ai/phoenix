from datetime import datetime

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models


@strawberry.type
class AgentSession(Node):
    id: NodeID[int]
    session_id: str = strawberry.field(
        description="The client-generated session ID.",
    )
    title: str = strawberry.field(
        description=("The title of the session."),
    )
    created_at: datetime
    updated_at: datetime


def to_gql_agent_session(agent_session: models.AgentSession) -> AgentSession:
    return AgentSession(
        id=agent_session.id,
        session_id=agent_session.session_uuid,
        title=agent_session.title,
        created_at=agent_session.created_at,
        updated_at=agent_session.updated_at,
    )
