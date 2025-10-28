from typing import cast
from unittest.mock import MagicMock, patch

import pytest

from phoenix.server.api.helpers.playground_clients import BedrockStreamingClient
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.input_types.GenerativeModelInput import GenerativeModelInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@pytest.mark.parametrize(
    "model_name, expected_model_name",
    (
        pytest.param(
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="unprefixed-passthrough",
        ),
        pytest.param(
            "eu.anthropic.claude-3-7-sonnet-20250219-v1:0",
            "eu.anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="prefixed-passthrough",
        ),
    ),
)
@patch("boto3.client")
def test_bedrock_client_model_name_passthrough(
    mock_boto_client: MagicMock, model_name: str, expected_model_name: str
) -> None:
    """Verify BedrockStreamingClient uses model name as-is without modification."""
    mock_boto_client.return_value = MagicMock()

    llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(GenerativeProviderKey.AWS, model_name)
    assert llm_client_class is not None, (
        "Expected to find a client for the given provider and model"
    )
    llm_client = cast(
        BedrockStreamingClient,
        llm_client_class(
            model=GenerativeModelInput(
                provider_key=GenerativeProviderKey.AWS, name=model_name, region="us-east-1"
            ),
            credentials=None,
        ),
    )

    assert llm_client.model_name == expected_model_name
