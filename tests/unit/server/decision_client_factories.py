"""Test helpers for constructing built-in decision client factories."""

from typing import Any

from pydantic import SecretStr

from phoenix.db.types import model_provider as mp
from phoenix.server.api.helpers.builtin_providers import resolve_builtin_config
from phoenix.server.api.helpers.decision_clients import DecisionClient
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.types import DbSessionFactory


def built_in_factory(
    client_class: type[DecisionClient], *, api_key: str, base_url: str | None
) -> mp.ClientFactory[Any]:
    auth = mp.AuthenticationMethodApiKey(api_key=api_key)
    # Azure is a resource URL, not a BuiltInEndpoint, so it never reads that attribute.
    if client_class.provider_key is GenerativeProviderKey.AZURE_OPENAI:
        if base_url is None:
            raise ValueError("Azure OpenAI decision clients require an endpoint.")
        return mp.AzureOpenAICustomProviderConfig(
            azure_openai_authentication_method=auth,
            azure_openai_client_kwargs=mp.AzureOpenAIClientKwargs(azure_endpoint=base_url),
        ).get_client_factory()
    config: mp.OpenAICustomProviderConfig | mp.TypeSafeCustomProviderConfig
    if client_class.built_in_endpoint.sdk == "openai":
        config = mp.OpenAICustomProviderConfig(
            openai_authentication_method=auth,
            openai_client_kwargs=mp.OpenAIClientKwargs(base_url=base_url),
        )
    else:
        config = mp.TypeSafeCustomProviderConfig(
            typesafe_authentication_method=auth,
            typesafe_client_kwargs=mp.TypeSafeClientKwargs(base_url=base_url),
        )
    return config.get_client_factory()


async def resolved_base_url(
    db: DbSessionFactory,
    client_class: type[DecisionClient],
    *,
    base_url: str | None = None,
    api_key: str | None = "test-key",
) -> str | None:
    if client_class.provider_key is GenerativeProviderKey.AZURE_OPENAI:
        credentials = (
            [
                GenerativeCredentialInput(
                    env_var_name="AZURE_OPENAI_API_KEY", value=SecretStr(api_key)
                )
            ]
            if api_key
            else None
        )
        async with db() as session:
            config = await client_class.resolve_config(
                base_url=base_url,
                credentials=credentials,
                session=session,
                decrypt=lambda value: value,
            )
        assert isinstance(config, mp.AzureOpenAICustomProviderConfig)
        return config.azure_openai_client_kwargs.azure_endpoint
    credentials = (
        [
            GenerativeCredentialInput(env_var_name=name, value=SecretStr(api_key))
            for name in client_class.built_in_endpoint.api_key_env_vars
        ]
        if api_key
        else None
    )
    async with db() as session:
        config = await resolve_builtin_config(
            client_class.built_in_endpoint,
            base_url=base_url,
            credentials=credentials,
            session=session,
            decrypt=lambda value: value,
        )
    if isinstance(config, mp.TypeSafeCustomProviderConfig):
        return config.typesafe_client_kwargs.base_url if config.typesafe_client_kwargs else None
    assert isinstance(config, mp.OpenAICustomProviderConfig)
    return config.openai_client_kwargs.base_url if config.openai_client_kwargs else None
