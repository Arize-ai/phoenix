import numpy as np
import pandas as pd
import responses
from phoenix.experimental.evals import run_relevance_eval


@responses.activate
def test_run_relevance_eval_when_valid_dataframe_should_return_relevant_classification(monkeypatch):
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
