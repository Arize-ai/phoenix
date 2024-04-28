from mistralai.client import MistralClient
from phoenix.evals.models.mistralai import MistralAIModel


def test_mistral_model(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "fake-mistral-key")
    model = MistralAIModel(model="mistral-large-latest")

    assert model.model == "mistral-large-latest"
    assert isinstance(model._client, MistralClient)
