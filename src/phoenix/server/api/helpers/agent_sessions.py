from datetime import datetime, timedelta
from typing import NamedTuple, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.models import GenerativeModelSDK
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.exceptions import ProviderNotFoundError
from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type

TURN_LOCK_STALENESS = timedelta(seconds=60)
"""How long after its last heartbeat a turn lock is considered abandoned."""


def get_otel_session_id(*, project_name: str, agent_session_rowid: int) -> str:
    agent_session_gid = GlobalID(type_name="AgentSession", node_id=str(agent_session_rowid))
    return f"{project_name}:{agent_session_gid}"


def is_turn_active(heartbeat_at: Optional[datetime], *, now: datetime) -> bool:
    """Whether a turn with a live (non-stale) heartbeat holds the session's lock.

    Shared by the REST session read and the GraphQL ``AgentSession`` type so
    every surface derives the busy state from one definition.
    """
    return heartbeat_at is not None and heartbeat_at >= now - TURN_LOCK_STALENESS


def model_provider_from_generative_model_sdk(
    sdk: GenerativeModelSDK,
) -> ModelProvider:
    if sdk == "openai":
        return ModelProvider.OPENAI
    if sdk == "azure_openai":
        return ModelProvider.AZURE_OPENAI
    if sdk == "anthropic":
        return ModelProvider.ANTHROPIC
    if sdk == "google_genai":
        return ModelProvider.GOOGLE
    if sdk == "aws_bedrock":
        return ModelProvider.AWS
    assert_never(sdk)


class AgentModelRouting(NamedTuple):
    """Values for the three model-routing columns on ``agent_sessions``."""

    model_provider: ModelProvider
    model_name: str
    custom_provider_id: Optional[int]


async def get_custom_provider(
    session: AsyncSession,
    provider_id: str,
) -> models.GenerativeModelCustomProvider:
    """Load the custom provider a selection references by its GlobalID string.

    Raises ``ProviderNotFoundError`` when the ID is malformed or no such
    provider exists.
    """
    try:
        provider_rowid = from_global_id_with_expected_type(
            GlobalID.from_id(provider_id),
            models.GenerativeModelCustomProvider.__name__,
        )
    except ValueError as exc:
        raise ProviderNotFoundError("Custom provider not found.") from exc
    provider = await session.get(models.GenerativeModelCustomProvider, provider_rowid)
    if provider is None:
        raise ProviderNotFoundError("Custom provider not found.")
    return provider


async def resolve_model_routing(
    session: AsyncSession,
    model: AgentModelSelection,
) -> AgentModelRouting:
    """Resolve a request's model selection into routing column values.

    Raises ``ProviderNotFoundError`` when a custom selection references a
    provider that does not exist.
    """
    if isinstance(model, CustomProviderModelSelection):
        provider = await get_custom_provider(session, model.provider_id)
        return AgentModelRouting(
            model_provider=model_provider_from_generative_model_sdk(provider.sdk),
            model_name=model.model_name,
            custom_provider_id=provider.id,
        )
    if isinstance(model, BuiltInProviderModelSelection):
        return AgentModelRouting(
            model_provider=model.provider,
            model_name=model.model_name,
            custom_provider_id=None,
        )
    assert_never(model)


async def set_session_model(
    session: AsyncSession,
    *,
    agent_session: models.AgentSession,
    model: AgentModelSelection,
) -> AgentModelSelection:
    """Persist a session's model selection and return the selection in effect.

    Raises ``ProviderNotFoundError`` when a custom selection references a
    provider that does not exist.
    """
    routing = await resolve_model_routing(session, model)
    agent_session.model_provider = routing.model_provider
    agent_session.model_name = routing.model_name
    agent_session.custom_provider_id = routing.custom_provider_id
    return get_agent_session_model(agent_session)


def model_selection_from_routing(routing: AgentModelRouting) -> AgentModelSelection:
    """Reconstruct the model selection encoded by the routing column values.

    A session is a custom-provider selection exactly when it references a live
    custom provider row. Deleting that row nulls the reference (``ON DELETE
    SET NULL``), so the session falls back to a builtin selection of the same
    provider and model name.
    """
    if routing.custom_provider_id is not None:
        return CustomProviderModelSelection(
            provider_type="custom",
            provider_id=str(
                GlobalID(
                    models.GenerativeModelCustomProvider.__name__,
                    str(routing.custom_provider_id),
                )
            ),
            model_name=routing.model_name,
        )
    return BuiltInProviderModelSelection(
        provider_type="builtin",
        provider=routing.model_provider,
        model_name=routing.model_name,
    )


def get_agent_session_model(
    agent_session: models.AgentSession,
) -> AgentModelSelection:
    """Return the model selection in effect for a session."""
    return model_selection_from_routing(
        AgentModelRouting(
            model_provider=agent_session.model_provider,
            model_name=agent_session.model_name,
            custom_provider_id=agent_session.custom_provider_id,
        )
    )
