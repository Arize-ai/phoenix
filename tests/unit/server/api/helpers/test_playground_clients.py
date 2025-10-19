import json
from unittest.mock import MagicMock, patch

import pytest

from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.input_types.GenerativeModelInput import GenerativeModelInput
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@pytest.mark.parametrize(
    "base_model_name, region, expected_model_inference",
    (
        pytest.param(
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            "eu-central-1",
            "eu.anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="claude-3-7-sonnet-eu-central-1",
        ),
        pytest.param(
            "anthropic.claude-3-5-haiku-20241022-v1:0",
            "us-east-1",
            "us.anthropic.claude-3-5-haiku-20241022-v1:0",
            id="claude-3-5-haiku-us-east-1",
        ),
        pytest.param(
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            "ap-southeast-2",
            "apac.anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="claude-3-7-sonnet-ap-southeast-2",
        ),
        pytest.param(
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            "",
            "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="claude-3-7-sonnet-no-region",
        ),
    ),
)
@patch("boto3.client")
async def test_aws_bedrock_converse_api(
    mock_boto_client: MagicMock, base_model_name: str, region: str, expected_model_inference: str
) -> None:
    # setup mock
    mock_bedrock_client = MagicMock()
    mock_boto_client.return_value = mock_bedrock_client

    llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(
        GenerativeProviderKey.AWS, base_model_name
    )
    llm_client = llm_client_class(
        model=GenerativeModelInput(
            provider_key=GenerativeProviderKey.AWS, name=base_model_name, region=region
        ),
        credentials=None,
    )

    invocation_parameters = {"temperature": 1.0, "top_p": 1.0, "max_tokens": 1024}
    async for _ in llm_client.chat_completion_create(
        messages=[
            (ChatCompletionMessageRole.SYSTEM, "You are a chatbot", None, None),
            (ChatCompletionMessageRole.USER, "", None, None),
        ],
        tools=[],
        **invocation_parameters,
    ):
        pass

    mock_bedrock_client.converse_stream.assert_called_once_with(
        modelId=expected_model_inference,
        messages=[{"role": "user", "content": [{"text": ""}]}],
        inferenceConfig={
            "maxTokens": invocation_parameters["max_tokens"],
            "temperature": invocation_parameters["temperature"],
            "topP": invocation_parameters["top_p"],
        },
        system=[{"text": "You are a chatbot"}],
    )


@pytest.mark.parametrize(
    "base_model_name, region, expected_model_inference",
    (
        pytest.param(
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            "eu-central-1",
            "eu.anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="claude-3-7-sonnet-eu-central-1",
        ),
        pytest.param(
            "anthropic.claude-3-5-haiku-20241022-v1:0",
            "us-east-1",
            "us.anthropic.claude-3-5-haiku-20241022-v1:0",
            id="claude-3-5-haiku-us-east-1",
        ),
        pytest.param(
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            "ap-southeast-2",
            "apac.anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="claude-3-7-sonnet-ap-southeast-2",
        ),
        pytest.param(
            "anthropic.claude-3-7-sonnet-20250219-v1:0",
            "",
            "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            id="claude-3-7-sonnet-no-region",
        ),
    ),
)
@patch("boto3.client")
async def test_aws_bedrock_invoke_api(
    mock_boto_client: MagicMock, base_model_name: str, region: str, expected_model_inference: str
) -> None:
    # setup mock
    mock_bedrock_client = MagicMock()
    mock_boto_client.return_value = mock_bedrock_client

    llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(
        GenerativeProviderKey.AWS, base_model_name
    )
    llm_client = llm_client_class(
        model=GenerativeModelInput(
            provider_key=GenerativeProviderKey.AWS, name=base_model_name, region=region
        ),
        credentials=None,
    )
    llm_client.api = "invoke"

    invocation_parameters = {"temperature": 1.0, "top_p": 1.0, "max_tokens": 1024}
    async for _ in llm_client.chat_completion_create(
        messages=[
            (ChatCompletionMessageRole.SYSTEM, "You are a chatbot", None, None),
            (ChatCompletionMessageRole.USER, "", None, None),
        ],
        tools=[],
        **invocation_parameters,
    ):
        pass

    bedrock_params = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": invocation_parameters["max_tokens"],
        "messages": [{"role": "user", "content": ""}],
        "system": "You are a chatbot\n",
        "temperature": invocation_parameters["temperature"],
        "top_p": invocation_parameters["top_p"],
        "tools": [],
    }

    mock_bedrock_client.invoke_model_with_response_stream.assert_called_once_with(
        modelId=expected_model_inference,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(bedrock_params),
        trace="ENABLED_FULL",
    )
