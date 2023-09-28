import pandas as pd
import responses

from phoenix.experimental.evals import OpenAIModel, llm_generate


@responses.activate
def test_llm_generate(monkeypatch):
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
        "it's a dialect of french",
        "it's a music notation",
        "It's a crazy language",
        "it's a programming language",
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
    template = (
        "Given {query} and a golden answer {reference}, generate an answer that is incorrect."
    )
    generated = llm_generate(
        dataframe=dataframe,
        template=template,
        model=OpenAIModel(),
    )
    assert generated == [
        "it's a dialect of french",
        "it's a music notation",
        "It's a crazy language",
        "it's a programming language",
    ]
