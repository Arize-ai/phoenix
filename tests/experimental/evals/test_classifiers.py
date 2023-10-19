import pytest
import responses
from llama_index.llms import OpenAI
from phoenix.experimental.evals import PromptTemplate
from phoenix.experimental.evals.classifiers import LLMFunctionCallingClassifier
from phoenix.experimental.evals.models import OpenAIModel


@responses.activate
def test_llm_function_calling_classifier_produces_expected_output_rail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = OpenAIModel(model_name="gpt-4")
    template = PromptTemplate(
        text=("Query: {query}\nReference: {reference}"),
    )
    function_name = "record_relevance"
    clf = LLMFunctionCallingClassifier(
        model=model,
        template=template,
        rails=["relevant", "irrelevant"],
        function_name=function_name,
        function_description=(
            "A function that records the relevance of a retrieved "
            "document to the corresponding query."
        ),
        argument_name="relevance",
        argument_description="The relevance of the query to the reference.",
        system_message=(
            "You are an assistant whose purpose is to determine and record "
            "the relevance of reference text to a query."
        ),
    )
    responses.post(
        url="https://api.openai.com/v1/chat/completions",
        json={
            "id": "chatcmpl-85eqK3CCNTHQcTN0ZoWqL5B0OO5ip",
            "object": "chat.completion",
            "created": 1696359332,
            "model": "gpt-4-0613",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "function_call": {
                            "name": function_name,
                            "arguments": '{\n  "relevance": "relevant"\n}',
                        },
                    },
                    "finish_reason": "function_call",
                }
            ],
            "usage": {"prompt_tokens": 84, "completion_tokens": 18, "total_tokens": 102},
        },
        status=200,
    )
    prediction = clf.predict(
        record={
            "query": "What is Python?",
            "reference": "Python is a programming language created by Guido van Rossum in 1991.",
        }
    )
    assert prediction.output_rail == "relevant"
    assert prediction.explanation is None


@responses.activate
def test_llm_function_calling_classifier_produces_expected_output_rail_and_explanation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = OpenAIModel(model_name="gpt-4")
    template = PromptTemplate(
        text=("Query: {query}\nReference: {reference}"),
    )
    function_name = "record_relevance"
    clf = LLMFunctionCallingClassifier(
        model=model,
        template=template,
        rails=["relevant", "irrelevant"],
        function_name=function_name,
        function_description=(
            "A function that records the relevance of a retrieved "
            "document to the corresponding query."
        ),
        argument_name="relevance",
        argument_description="The relevance of the query to the reference.",
        system_message=(
            "You are an assistant whose purpose is to determine and record "
            "the relevance of reference text to a query."
        ),
        provide_explanation=True,
    )
    responses.post(
        url="https://api.openai.com/v1/chat/completions",
        json={
            "id": "chatcmpl-85eqK3CCNTHQcTN0ZoWqL5B0OO5ip",
            "object": "chat.completion",
            "created": 1696359332,
            "model": "gpt-4-0613",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "function_call": {
                            "name": function_name,
                            "arguments": (
                                '{\n    "relevance": "relevant",\n    '
                                '"explanation": "example-explanation"\n}'
                            ),
                        },
                    },
                    "finish_reason": "function_call",
                }
            ],
            "usage": {"prompt_tokens": 84, "completion_tokens": 18, "total_tokens": 102},
        },
        status=200,
    )
    prediction = clf.predict(
        record={
            "query": "What is Python?",
            "reference": "Python is a programming language created by Guido van Rossum in 1991.",
        }
    )
    assert prediction.output_rail == "relevant"
    assert prediction.explanation == "example-explanation"


@responses.activate
def test_llm_function_calling_classifier_raises_value_error_for_non_openai_model() -> None:
    with pytest.raises(
        ValueError, match="Model must be an instance of 'OpenAIModel', but has type 'OpenAI'."
    ):
        LLMFunctionCallingClassifier(
            model=OpenAI(),
            template=PromptTemplate(
                text=("Query: {query}\nReference: {reference}"),
            ),
            rails=["relevant", "irrelevant"],
            function_name="record_relevance",
            function_description=(
                "A function that records the relevance of a retrieved "
                "document to the corresponding query."
            ),
            argument_name="relevance",
            argument_description="The relevance of the query to the reference.",
            system_message=(
                "You are an assistant whose purpose is to determine and record "
                "the relevance of reference text to a query."
            ),
            provide_explanation=True,
        )
