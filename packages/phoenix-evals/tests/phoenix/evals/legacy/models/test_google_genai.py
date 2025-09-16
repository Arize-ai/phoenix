import pytest
from google import genai
from google.genai.types import (
    Candidate,
    Content,
    FunctionCall,
    GenerateContentResponse,
    GenerateContentResponseUsageMetadata,
    Part,
)

from phoenix.evals.models.google_genai import GoogleGenAIModel


def test_instantiation_by_positional_args_is_not_allowed() -> None:
    with pytest.raises(AssertionError, match="positional arguments"):
        GoogleGenAIModel("gemini-2.5-flash")


def test_google_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "fake-google-api-key")
    model = GoogleGenAIModel()

    assert model.model == "gemini-2.5-flash"
    assert isinstance(model._client, genai.Client)


class TestParseOutput:
    @pytest.fixture
    def model(self, monkeypatch: pytest.MonkeyPatch) -> GoogleGenAIModel:
        """Fixture to create a GoogleGenAIModel."""
        monkeypatch.setenv("GEMINI_API_KEY", "fake-gemini-api-key")
        return GoogleGenAIModel()

    def test_parse_output_with_text_content(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            usage_metadata=GenerateContentResponseUsageMetadata(
                prompt_token_count=10,
                candidates_token_count=15,
                thoughts_token_count=5,
                total_token_count=30,
            ),
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[Part(text="This is a test response")],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "This is a test response"
        assert usage.prompt_tokens == 10
        assert usage.completion_tokens == 20
        assert usage.total_tokens == 30

    def test_parse_output_without_usage(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            usage_metadata=None,
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[Part(text="Text without usage")],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Text without usage"
        assert usage is None

    def test_parse_output_with_empty_text(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            usage_metadata=GenerateContentResponseUsageMetadata(
                prompt_token_count=3,
                candidates_token_count=0,
                thoughts_token_count=0,
                total_token_count=3,
            ),
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage.prompt_tokens == 3
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 3

    def test_parse_output_with_function_call_with_args(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            usage_metadata=GenerateContentResponseUsageMetadata(
                prompt_token_count=8,
                candidates_token_count=12,
                thoughts_token_count=3,
                total_token_count=23,
            ),
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[
                            Part(text="Original text"),
                            Part(
                                function_call=FunctionCall(
                                    args={"action": "search", "query": "test query"}
                                )
                            ),
                        ],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"action": "search", "query": "test query"}'
        assert usage.prompt_tokens == 8
        assert usage.completion_tokens == 15
        assert usage.total_tokens == 23

    def test_parse_output_with_function_call_no_args(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            usage_metadata=GenerateContentResponseUsageMetadata(
                prompt_token_count=5,
                candidates_token_count=8,
                thoughts_token_count=2,
                total_token_count=15,
            ),
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[
                            Part(text="Fallback text"),
                            Part(function_call=FunctionCall(args=None)),
                        ],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Fallback text"
        assert usage.prompt_tokens == 5
        assert usage.completion_tokens == 10
        assert usage.total_tokens == 15

    def test_parse_output_with_multiple_function_calls(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            usage_metadata=GenerateContentResponseUsageMetadata(
                prompt_token_count=12,
                candidates_token_count=18,
                thoughts_token_count=7,
                total_token_count=37,
            ),
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[
                            Part(text="Original text"),
                            Part(function_call=FunctionCall(args=None)),
                            Part(
                                function_call=FunctionCall(
                                    args={"result": "success", "data": [1, 2, 3]}
                                )
                            ),
                        ],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"result": "success", "data": [1, 2, 3]}'
        assert usage.prompt_tokens == 12
        assert usage.completion_tokens == 25
        assert usage.total_tokens == 37

    def test_parse_output_with_simple_function_args(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[Part(function_call=FunctionCall(args={"simple": "value"}))],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"simple": "value"}'
        assert usage is None

    def test_parse_output_with_nested_function_args(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[Part(function_call=FunctionCall(args={"nested": {"key": "value"}}))],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"nested": {"key": "value"}}'
        assert usage is None

    def test_parse_output_with_list_function_args(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[Part(function_call=FunctionCall(args={"list": [1, 2, 3]}))],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"list": [1, 2, 3]}'
        assert usage is None

    def test_parse_output_with_unicode_function_args(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[Part(function_call=FunctionCall(args={"unicode": "测试"}))],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == '{"unicode": "测试"}'
        assert usage is None

    def test_parse_output_with_zero_usage(self, model: GoogleGenAIModel) -> None:
        response = GenerateContentResponse(
            usage_metadata=GenerateContentResponseUsageMetadata(
                prompt_token_count=0,
                candidates_token_count=0,
                thoughts_token_count=0,
                total_token_count=0,
            ),
            candidates=[
                Candidate(
                    content=Content(
                        role="model",
                        parts=[Part(text="Zero usage response")],
                    )
                ),
            ],
        )

        text, (usage, *_) = model._parse_output(response)

        assert text == "Zero usage response"
        assert usage.prompt_tokens == 0
        assert usage.completion_tokens == 0
        assert usage.total_tokens == 0
