from unittest import mock

import pytest
from openai import AzureOpenAI, OpenAI
from phoenix.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME, OpenAIModel


def test_openai_model(monkeypatch):
    """
    Sanity check of the initialization of OpenAI wrapper
    NB: this is intentionally white-box testing since
    we have very little type safety in the OpenAI wrapper
    """
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model = OpenAIModel(model="gpt-4-turbo-preview")

    assert model.model == "gpt-4-turbo-preview"
    assert isinstance(model._client, OpenAI)


def test_azure_openai_model(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model = OpenAIModel(
        model="gpt-4-turbo-preview",
        api_version="2023-07-01-preview",
        azure_endpoint="https://example-endpoint.openai.azure.com",
    )
    assert isinstance(model._client, AzureOpenAI)


def test_azure_openai_model_added_custom_header(monkeypatch):
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
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
    model = OpenAIModel(
        model="gpt-4-turbo-preview",
        api_version="2023-07-01-preview",
        azure_endpoint="https://example-endpoint.openai.azure.com",
    )
    assert isinstance(model._client, AzureOpenAI)
    assert model.supports_function_calling is True

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


@mock.patch("openai.resources.chat.completions.Completions.create")
def test_selfhosted(completions_create):
    mock_completion = mock.Mock()
    mock_completion.model_dump.return_value = {
        "choices": [{"message": {"function_call": False, "content": "42 per tail"}}]
    }

    completions_create.return_value = mock_completion
    model = OpenAIModel(
        model="monstral", base_url="http://hosted.openai.me:8000/v1", api_key="bogus"
    )
    result = model("How much is the fish?")

    assert result == "42 per tail"
    assert "http://hosted.openai.me:8000/v1" in str(model._client.base_url)
    assert model._client.api_key == "bogus"
    call_args = completions_create.call_args[1]
    assert call_args["model"] == "monstral"
    assert call_args["messages"][0]["content"] == "How much is the fish?"
