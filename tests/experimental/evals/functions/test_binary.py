import numpy as np
import pandas as pd
import responses
from phoenix.experimental.evals import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    OpenAIModel,
    llm_eval_binary,
    run_relevance_eval,
)
from phoenix.experimental.evals.functions.binary import _snap_to_rail


@responses.activate
def test_llm_eval_binary(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {
                "query": "What is Python?",
                "reference": "Python is a programming language.",
            },
            {
                "query": "What is Python?",
                "reference": "Ruby is a programming language.",
            },
            {
                "query": "What is C++?",
                "reference": "C++ is a programming language.",
            },
            {
                "query": "What is C++?",
                "reference": "irrelevant",
            },
        ]
    )
    for message_content in [
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
    ]:
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "choices": [
                    {
                        "message": {
                            "content": message_content,
                        },
                    }
                ],
            },
            status=200,
        )
    relevance_classifications = llm_eval_binary(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
        model=OpenAIModel(),
        rails=["relevant", "irrelevant"],
    )
    assert relevance_classifications == ["relevant", "irrelevant", "relevant", NOT_PARSABLE]


@responses.activate
def test_run_relevance_eval(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-0123456789")
    dataframe = pd.DataFrame(
        [
            {
                "attributes.input.value": "What is Python?",
                "attributes.retrieval.documents": [
                    {"document.content": "Python is a programming language."},
                    {"document.content": "Ruby is a programming language."},
                ],
            },
            {
                "attributes.input.value": "What is Python?",
                "attributes.retrieval.documents": np.array(
                    [
                        {"document.content": "Python is a programming language."},
                        {"document.content": "Ruby is a programming language."},
                    ]
                ),
            },
            {
                "attributes.input.value": "What is Ruby?",
                "attributes.retrieval.documents": [
                    {"document.content": "Ruby is a programming language."},
                ],
            },
            {
                "attributes.input.value": "What is C++?",
                "attributes.retrieval.documents": [
                    {"document.content": "Ruby is a programming language."},
                    {"document.content": "C++ is a programming language."},
                ],
            },
            {
                "attributes.input.value": "What is C#?",
                "attributes.retrieval.documents": [],
            },
            {
                "attributes.input.value": "What is Golang?",
                "attributes.retrieval.documents": None,
            },
            {
                "attributes.input.value": None,
                "attributes.retrieval.documents": [
                    {"document.content": "Python is a programming language."},
                    {"document.content": "Ruby is a programming language."},
                ],
            },
            {
                "attributes.input.value": None,
                "attributes.retrieval.documents": None,
            },
        ]
    )
    for message_content in [
        "relevant",
        "irrelevant",
        "relevant",
        "irrelevant",
        "\nrelevant ",
        "unparsable",
        "relevant",
    ]:
        responses.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "choices": [
                    {
                        "message": {
                            "content": message_content,
                        },
                    }
                ],
            },
            status=200,
        )
    relevance_classifications = run_relevance_eval(dataframe)
    assert relevance_classifications == [
        [True, False],
        [True, False],
        [True],
        [None, True],
        None,
        None,
        None,
        None,
    ]


def test_overlapping_rails():
    assert _snap_to_rail("irrelevant", ["relevant", "irrelevant"]) == "irrelevant"
    assert _snap_to_rail("relevant", ["relevant", "irrelevant"]) == "relevant"
    assert _snap_to_rail("irrelevant...", ["irrelevant", "relevant"]) == "irrelevant"
    assert _snap_to_rail("...irrelevant", ["irrelevant", "relevant"]) == "irrelevant"
    # Both rails are present, cannot parse
    assert _snap_to_rail("relevant...irrelevant", ["irrelevant", "relevant"]) is NOT_PARSABLE
