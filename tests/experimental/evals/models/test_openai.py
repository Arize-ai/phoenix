from unittest.mock import patch

import pytest
from openai import AzureOpenAI, OpenAI
from phoenix.experimental.evals.models.openai import OpenAIModel


def test_openai_model():
    """
    Sanity check of the initialization of OpenAI wrapper
    NB: this is intentionally white-box testing since
    we have very little type safety in the OpenAI wrapper
    """
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(model_name="gpt-4-1106-preview")

    assert model.model_name == "gpt-4-1106-preview"
    assert isinstance(model._client, OpenAI)


def test_azure_openai_model():
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(
            model_name="gpt-4-1106-preview",
            api_version="2023-07-01-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )
    assert isinstance(model._client, AzureOpenAI)


def test_azure_fails_when_missing_options():
    # Test missing api_version
    with pytest.raises(
        ValueError, match="Option 'api_version' must be set when using Azure OpenAI"
    ):
        OpenAIModel(
            model_name="gpt-4-1106-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )


def test_azure_supports_function_calling():
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(
            model_name="gpt-4-1106-preview",
            api_version="2023-07-01-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )
    assert isinstance(model._client, AzureOpenAI)
    assert model.supports_function_calling is True

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(
            model_name="gpt-4-1106-preview",
            api_version="2023-06-01-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )
    assert isinstance(model._client, AzureOpenAI)
    assert model.supports_function_calling is False
