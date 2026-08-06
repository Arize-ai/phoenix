import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.exceptions import ProviderNotFoundError
from phoenix.server.agents.model_selection import (
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.api.helpers.agent_sessions import (
    get_agent_session_model,
    resolve_model_routing,
    set_session_model,
)
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory


async def _add_custom_provider(
    db: DbSessionFactory,
) -> tuple[int, str]:
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name="Custom OpenAI",
            provider="openai",
            sdk="openai",
            config=EncryptionService().encrypt(b"{}"),
        )
        session.add(provider)
        await session.flush()
        return provider.id, str(
            GlobalID(models.GenerativeModelCustomProvider.__name__, str(provider.id))
        )


async def _add_builtin_session(db: DbSessionFactory) -> int:
    async with db() as session:
        agent_session = models.AgentSession(
            project_name="assistant_agent",
            title="Model persistence",
            model_provider=ModelProvider.ANTHROPIC,
            model_name="claude-opus-4-6",
        )
        session.add(agent_session)
        await session.flush()
        return agent_session.id


async def test_resolve_model_routing_maps_each_selection_variant(
    db: DbSessionFactory,
) -> None:
    provider_id, provider_gid = await _add_custom_provider(db)

    async with db() as session:
        custom_routing = await resolve_model_routing(
            session,
            CustomProviderModelSelection(
                provider_type="custom",
                provider_id=provider_gid,
                model_name="custom-model",
            ),
        )
        assert custom_routing.model_provider is ModelProvider.OPENAI
        assert custom_routing.model_name == "custom-model"
        assert custom_routing.custom_provider_id == provider_id

        builtin_routing = await resolve_model_routing(
            session,
            BuiltInProviderModelSelection(
                provider_type="builtin",
                provider=ModelProvider.AZURE_OPENAI,
                model_name="gpt-5.5",
            ),
        )
        assert builtin_routing.model_provider is ModelProvider.AZURE_OPENAI
        assert builtin_routing.model_name == "gpt-5.5"
        assert builtin_routing.custom_provider_id is None


async def test_resolve_model_routing_rejects_nonexistent_custom_provider(
    db: DbSessionFactory,
) -> None:
    missing_gid = str(GlobalID(models.GenerativeModelCustomProvider.__name__, "999"))
    async with db() as session:
        with pytest.raises(ProviderNotFoundError):
            await resolve_model_routing(
                session,
                CustomProviderModelSelection(
                    provider_type="custom",
                    provider_id=missing_gid,
                    model_name="custom-model",
                ),
            )


async def test_set_session_model_transitions_between_routing_modes(
    db: DbSessionFactory,
) -> None:
    provider_id, provider_gid = await _add_custom_provider(db)
    agent_session_id = await _add_builtin_session(db)

    async with db() as session:
        agent_session = await session.get(models.AgentSession, agent_session_id)
        assert agent_session is not None
        effective = await set_session_model(
            session,
            agent_session=agent_session,
            model=CustomProviderModelSelection(
                provider_type="custom",
                provider_id=provider_gid,
                model_name="custom-model",
            ),
        )
        await session.flush()
        assert agent_session.model_provider is ModelProvider.OPENAI
        assert agent_session.model_name == "custom-model"
        assert agent_session.custom_provider_id == provider_id
        assert effective == CustomProviderModelSelection(
            provider_type="custom",
            provider_id=provider_gid,
            model_name="custom-model",
        )

        effective = await set_session_model(
            session,
            agent_session=agent_session,
            model=BuiltInProviderModelSelection(
                provider_type="builtin",
                provider=ModelProvider.AZURE_OPENAI,
                model_name="gpt-5.5",
            ),
        )
        await session.flush()
        assert agent_session.model_provider.value == "AZURE_OPENAI"
        assert agent_session.model_name == "gpt-5.5"
        assert agent_session.custom_provider_id is None
        assert effective == BuiltInProviderModelSelection(
            provider_type="builtin",
            provider=ModelProvider.AZURE_OPENAI,
            model_name="gpt-5.5",
        )


async def test_set_session_model_rejects_a_deleted_custom_provider(
    db: DbSessionFactory,
) -> None:
    provider_id, provider_gid = await _add_custom_provider(db)
    agent_session_id = await _add_builtin_session(db)

    async with db() as session:
        agent_session = await session.get(models.AgentSession, agent_session_id)
        assert agent_session is not None
        await set_session_model(
            session,
            agent_session=agent_session,
            model=CustomProviderModelSelection(
                provider_type="custom",
                provider_id=provider_gid,
                model_name="custom-model",
            ),
        )
        await session.flush()
        provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
        assert provider is not None
        await session.delete(provider)
        await session.flush()
        await session.refresh(agent_session)

        # An explicit model change naming a provider that no longer exists is
        # an error rather than a silent fallback: the caller asked for a
        # specific model and did not get it.
        with pytest.raises(ProviderNotFoundError):
            await set_session_model(
                session,
                agent_session=agent_session,
                model=CustomProviderModelSelection(
                    provider_type="custom",
                    provider_id=provider_gid,
                    model_name="custom-model",
                ),
            )


async def test_deleted_custom_provider_reads_as_builtin_fallback(
    db: DbSessionFactory,
) -> None:
    provider_id, provider_gid = await _add_custom_provider(db)
    agent_session_id = await _add_builtin_session(db)

    async with db() as session:
        agent_session = await session.get(models.AgentSession, agent_session_id)
        assert agent_session is not None
        await set_session_model(
            session,
            agent_session=agent_session,
            model=CustomProviderModelSelection(
                provider_type="custom",
                provider_id=provider_gid,
                model_name="custom-model",
            ),
        )
        await session.flush()
        provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
        assert provider is not None
        await session.delete(provider)
        await session.flush()
        await session.refresh(agent_session)

        assert get_agent_session_model(agent_session) == BuiltInProviderModelSelection(
            provider_type="builtin",
            provider=ModelProvider.OPENAI,
            model_name="custom-model",
        )
