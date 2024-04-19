from unittest.mock import patch

import pytest
from openai import AzureOpenAI, OpenAI
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME, OpenAIModel


def test_openai_model(monkeypatch):
    """
    Sanity check of the initialization of OpenAI wrapper
    NB: this is intentionally white-box testing since
    we have very little type safety in the OpenAI wrapper
    """
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(model="gpt-4-turbo-preview")

    assert model.model == "gpt-4-turbo-preview"
    assert isinstance(model._client, OpenAI)


def test_azure_openai_model(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(
            model="gpt-4-turbo-preview",
            api_version="2023-07-01-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )
    assert isinstance(model._client, AzureOpenAI)


def test_azure_openai_model_added_custom_header(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        header_key = "header"
        header_value = "my-example-header-value"
        default_headers = {header_key: header_value}
        model = OpenAIModel(
            model="gpt-4-turbo-preview",
            api_version="2023-07-01-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
            default_headers=default_headers,
        )

    assert isinstance(model._client, AzureOpenAI)
    # check if custom header is added to headers
    assert (
        header_key in model._client.default_headers
        and model._client.default_headers.get(header_key) == header_value
    )
    assert (
        header_key in model._async_client.default_headers
        and model._async_client.default_headers.get(header_key) == header_value
    )


def test_azure_fails_when_missing_options(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    # Test missing api_version
    with pytest.raises(
        ValueError, match="Option 'api_version' must be set when using Azure OpenAI"
    ):
        OpenAIModel(
            model="gpt-4-turbo-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )


def test_azure_supports_function_calling(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(
            model="gpt-4-turbo-preview",
            api_version="2023-07-01-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )
    assert isinstance(model._client, AzureOpenAI)
    assert model.supports_function_calling is True

    with patch.object(OpenAIModel, "_init_tiktoken", return_value=None):
        model = OpenAIModel(
            model="gpt-4-turbo-preview",
            api_version="2023-06-01-preview",
            azure_endpoint="https://example-endpoint.openai.azure.com",
        )
    assert isinstance(model._client, AzureOpenAI)
    assert model.supports_function_calling is False


def test_model_name_deprecation(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    with pytest.warns(DeprecationWarning, match="The `model_name` field is deprecated"):
        model = OpenAIModel(model_name="gpt-4-turbo-preview")
    assert model.model == "gpt-4-turbo-preview"
    assert model.model_name is None
