import pandas as pd
import phoenix.trace.semantic_conventions as sem_conv
from phoenix.server.api.types.Span import SpanEvent, _nested_attributes


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
        "input": {
            "mime_type": ...,
            "value": ...,
        },
        "embedding": {
            "embeddings": ...,
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


def test_events() -> None:
    data = pd.DataFrame(
        {
            "events": [
                [
                    {
                        "name": "event_0",
                        "message": "message_0",
                        "timestamp": "2023-08-16T12:48:25.604239",
                    },
                    {
                        "name": "event_1",
                        "message": "message_1",
                        "timestamp": "2023-08-16T12:48:26.604239",
                    },
                    {
                        "name": "event_2",
                        "message": "message_2",
                        "timestamp": "2023-08-16T12:48:27.604239",
                    },
                    {
                        "name": "event_3",
                        "message": "message_3",
                        "timestamp": "2023-08-16T12:48:28.604239",
                    },
                ]  # noqa: E501
            ]
        }
    )
    events = list(map(SpanEvent.from_mapping, data.iloc[0]["events"]))
    assert len(events) == 4
    assert events[0].name == "event_0"
