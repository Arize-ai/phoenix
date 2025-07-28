import pytest
from google import genai

from phoenix.evals.models.google_gemini import GoogleAIModel


def test_instantiation_by_positional_args_is_not_allowed():
    with pytest.raises(AssertionError, match="positional arguments"):
        GoogleAIModel("gemini-2.5-flash")


def test_google_model(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "fake-google-api-key")
    model = GoogleAIModel()

    assert model.model == "gemini-2.5-flash"
    assert isinstance(model._client, genai.Client)
