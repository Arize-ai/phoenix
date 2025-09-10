import pytest
from vertexai.generative_models import GenerationResponse

from phoenix.evals.models.vertex import GeminiModel


class TestParseOutput:
    @pytest.fixture
    def model(self, monkeypatch: pytest.MonkeyPatch) -> GeminiModel:
        """Fixture to create a GeminiModel with mocked dependencies."""
        # Mock the VertexAI initialization and GenerativeModel
        monkeypatch.setattr("vertexai.init", lambda **kwargs: None)

        class MockGenerativeModel:
            def __init__(self, *args, **kwargs):
                pass

        monkeypatch.setattr(
            "vertexai.preview.generative_models.GenerativeModel",
            MockGenerativeModel,
        )

        return GeminiModel(project="test-project")

    def test_parse_output_with_text_content(self, model: GeminiModel) -> None:
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

        text, (usage, *_) = model._parse_output(response)

        assert text == "Hello, this is a response from VertexAI!"
        assert usage.prompt_tokens == 12
        assert usage.completion_tokens == 8
        assert usage.total_tokens == 20

    def test_parse_output_with_empty_text(self, model: GeminiModel) -> None:
        response = GenerationResponse.from_dict(
            dict(
                candidates=[
                    dict(
                        index=0,
                        content=dict(parts=[]),
                    )
                ],
                usage_metadata=dict(
                    prompt_token_count=5,
                    candidates_token_count=0,
                    total_token_count=5,
                ),
            )
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage.prompt_tokens == 5
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 5

    def test_parse_output_without_usage(self, model: GeminiModel) -> None:
        response = GenerationResponse.from_dict(
            dict(
                candidates=[
                    dict(
                        index=0,
                        content=dict(parts=[dict(text="Response without usage info")]),
                    )
                ],
            )
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Response without usage info"
        assert usage is None

    def test_parse_output_with_zero_usage(self, model: GeminiModel) -> None:
        response = GenerationResponse.from_dict(
            dict(
                candidates=[
                    dict(
                        index=0,
                        content=dict(parts=[dict(text="Zero usage response")]),
                    )
                ],
                usage_metadata=dict(
                    prompt_token_count=0,
                    candidates_token_count=0,
                    total_token_count=0,
                ),
            )
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Zero usage response"
        assert usage is None
