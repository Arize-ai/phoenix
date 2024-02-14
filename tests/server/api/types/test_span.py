from phoenix.server.api.types.Span import _nested_attributes


def test_nested_attributes() -> None:
    assert _nested_attributes(
        {
            "llm.model_name": ...,
            "llm.prompt_template.variables": ...,
        },
    ) == {
        "llm": {
            "model_name": ...,
            "prompt_template": {
                "variables": ...,
            },
        },
    }
