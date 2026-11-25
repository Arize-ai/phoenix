import pytest

from phoenix.db.types.experiment_config import OpenAIConnectionConfig
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.playground_clients import (
    OPENAI_CHAT_COMPLETIONS_MODELS,
    OpenAIChatCompletionsClient,
    get_playground_client,
)
from phoenix.server.api.input_types.ConnectionConfigInput import (
    ConnectionConfigInput,
    to_connection_config,
)
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.types import DbSessionFactory

# A model that is not on OPENAI_CHAT_COMPLETIONS_MODELS, so its unconfigured default
# is the Responses API.
OFF_LIST_MODEL = "gpt-5"


def test_explicit_chat_completions_without_base_url_is_kept() -> None:
    assert OFF_LIST_MODEL not in OPENAI_CHAT_COMPLETIONS_MODELS
    config = to_connection_config(
        ModelProvider.OPENAI,
        ConnectionConfigInput(openai_api_type=OpenAIApiType.CHAT_COMPLETIONS),
    )
    assert isinstance(config, OpenAIConnectionConfig)
    assert config.openai_api_type == "chat_completions"


async def test_explicit_chat_completions_without_base_url_selects_chat_completions_client(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    assert OFF_LIST_MODEL not in OPENAI_CHAT_COMPLETIONS_MODELS
    connection = to_connection_config(
        ModelProvider.OPENAI,
        ConnectionConfigInput(base_url=None, openai_api_type=OpenAIApiType.CHAT_COMPLETIONS),
    )
    async with db() as session:
        client = await get_playground_client(
            model_provider=ModelProvider.OPENAI,
            model_name=OFF_LIST_MODEL,
            session=session,
            decrypt=lambda value: value,
            connection=connection,
        )
    assert type(client) is OpenAIChatCompletionsClient
