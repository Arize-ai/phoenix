import json

from scripts.datagen.model_backend import ModelRequest, OpenAIResponsesBackend


def test_openai_backend_returns_structured_contract() -> None:
    def create_response(**kwargs: object) -> dict[str, object]:
        assert kwargs["text"] == {
            "format": {
                "type": "json_schema",
                "name": "datagen_result",
                "strict": True,
                "schema": {"type": "object"},
            }
        }
        return {
            "id": "resp_1",
            "output_text": json.dumps({"answer": "ok"}),
            "usage": {"input_tokens": 4, "output_tokens": 2},
        }

    result = OpenAIResponsesBackend(create_response).generate(_request())

    assert result.provider == "openai_api"
    assert result.output == {"answer": "ok"}
    assert result.usage is not None and result.usage.output_tokens == 2
    assert result.provider_run_id == "resp_1"


def _request() -> ModelRequest:
    return ModelRequest("request-1", "generation", "model-exact", "Return JSON.", {"type": "object"}, 100)
