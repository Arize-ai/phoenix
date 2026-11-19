from typing import Literal

import pytest

from phoenix.db.types.experiment_config import OpenAIConnectionConfig
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.input_types.ConnectionConfigInput import (
    ConnectionConfigInput,
    to_connection_config,
)
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType


class TestToConnectionConfig:
    def test_openai_without_overrides_stores_no_connection(self) -> None:
        assert to_connection_config(ModelProvider.OPENAI, ConnectionConfigInput()) is None

    @pytest.mark.parametrize(
        ("openai_api_type", "expected_api_type"),
        [
            pytest.param(OpenAIApiType.CHAT_COMPLETIONS, "chat_completions", id="chat_completions"),
            pytest.param(OpenAIApiType.RESPONSES, "responses", id="responses"),
        ],
    )
    def test_openai_keeps_an_explicit_api_type_without_a_base_url(
        self,
        openai_api_type: OpenAIApiType,
        expected_api_type: Literal["chat_completions", "responses"],
    ) -> None:
        connection = to_connection_config(
            ModelProvider.OPENAI,
            ConnectionConfigInput(openai_api_type=openai_api_type),
        )
        assert isinstance(connection, OpenAIConnectionConfig)
        assert connection.openai_api_type == expected_api_type
        assert connection.base_url is None
