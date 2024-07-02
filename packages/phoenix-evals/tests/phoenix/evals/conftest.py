import pytest
from phoenix.evals import OpenAIModel


@pytest.fixture
def openai_model(openai_api_key: str) -> OpenAIModel:
    return OpenAIModel(api_key=openai_api_key)


@pytest.fixture
def openai_api_key(monkeypatch: pytest.MonkeyPatch) -> str:
    api_key = "sk-0123456789"
    monkeypatch.setenv("OPENAI_API_KEY", api_key)
    return api_key
