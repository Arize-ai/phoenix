import pandas as pd
from phoenix.experimental.evals.functions import llm_classify
from phoenix.experimental.evals.models.vertex import GeminiModel
from phoenix.experimental.evals.templates.default_templates import (
    RAG_RELEVANCY_PROMPT_TEMPLATE,
)


def test_multiple_classify_calls():
    dataframe = pd.DataFrame(
        [
            {
                "input": "What is Python?",
                "reference": "Python is a programming language.",
            },
        ]
    )

    model = GeminiModel(max_retries=0)
    llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "irrelevant"],
    )
    llm_classify(
        dataframe=dataframe,
        template=RAG_RELEVANCY_PROMPT_TEMPLATE,
        model=model,
        rails=["relevant", "irrelevant"],
    )


if __name__ == "__main__":
    test_multiple_classify_calls()
