import pytest
from vertexai.generative_models import GenerationResponse

from phoenix.evals.models.vertex import GeminiModel


class TestParseOutput:
    def test_parse_output_with_text_content(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Mocking the VertexAI initialization since we're testing _parse_output
        monkeypatch.setattr("vertexai.init", lambda **kwargs: None)
        monkeypatch.setattr(
            "vertexai.preview.language_models.TextGenerationModel.from_pretrained",
            lambda model_name: None,
        )

        model = GeminiModel(project="test-project")
        response = GenerationResponse.from_dict(
            dict(
                candidates=[
                    dict(
                        index=0,
                        content=dict(parts=[dict(text="Hello, this is a response from VertexAI!")]),
                    )
                ],
                usage_metadata=dict(
                    prompt_token_count=12,
                    candidates_token_count=8,
                    total_token_count=20,
                ),
            )
        )

        text, usage = model._parse_output(response)

        assert text == "Hello, this is a response from VertexAI!"
        assert usage.prompt_tokens == 12
        assert usage.completion_tokens == 8
        assert usage.total_tokens == 20
