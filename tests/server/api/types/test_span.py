import phoenix.trace.semantic_conventions as sem_conv
from phoenix.server.api.types.Span import _nested_attributes


def test_nested_attributes() -> None:
    assert _nested_attributes(
        {getattr(sem_conv, v): ... for v in dir(sem_conv) if v.isupper()},
    ) == {
        "document": {
            "content": ...,
            "id": ...,
            "metadata": ...,
            "score": ...,
        },
        "message": {
            "content": ...,
            "role": ...,
        },
        "exception": {
            "escaped": ...,
            "message": ...,
            "stacktrace": ...,
            "type": ...,
        },
        "input": {
            "mime_type": ...,
            "value": ...,
        },
        "embedding": {
            "embeddings": ...,
            "vector": ...,
            "text": ...,
            "model_name": ...,
        },
        "llm": {
            "function_call": ...,
            "invocation_parameters": ...,
            "messages": ...,
            "model_name": ...,
            "prompt_template": {
                "template": ...,
                "variables": ...,
                "version": ...,
            },
            "token_count": {
                "completion": ...,
                "prompt": ...,
                "total": ...,
            },
        },
        "output": {
            "mime_type": ...,
            "value": ...,
        },
        "retrieval": {
            "documents": ...,
        },
        "tool": {
            "description": ...,
            "name": ...,
        },
    }
