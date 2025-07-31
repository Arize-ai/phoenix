import pytest
from google import genai

from phoenix.evals.models.google_genai import GoogleGenAIModel


def test_instantiation_by_positional_args_is_not_allowed():
    with pytest.raises(AssertionError, match="positional arguments"):
        GoogleGenAIModel("gemini-2.5-flash")


def test_google_model(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "fake-google-api-key")
    model = GoogleGenAIModel()

    assert model.model == "gemini-2.5-flash"
    assert isinstance(model._client, genai.Client)
