import pytest
from phoenix.experimental.evals import OpenAIModel


@pytest.fixture
def openai_model(openai_api_key: str) -> OpenAIModel:
    return OpenAIModel(api_key=openai_api_key)
