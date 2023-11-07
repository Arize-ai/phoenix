from phoenix.experimental.evals.models.openai import OpenAIModel


def test_openai_model():
    """
    Sanity check of the initialization of OpenAI wrapper
    NB: this is intentionally white-box testing since
    we cannot rely on the OpenAI API to be stable and don't
    """
    model = OpenAIModel("gpt-4-1106-preview")
    assert model.model_name == "gpt-4-1106-preview"
