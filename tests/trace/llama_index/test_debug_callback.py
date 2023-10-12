from llama_index.callbacks.schema import CBEventType
from phoenix.trace.llama_index import DebugCallbackHandler


def test_callback_llm(capfd) -> None:
    callback_handler = DebugCallbackHandler()
    event_type = CBEventType.LLM
    payload = {
        "arbitrary": "payload contents are printed",
        "regardless": "of whether or not they are explicitly defined by LlamaIndex",
    }
    event_id = ""

    callback_handler.on_event_end(event_type, payload, event_id)
    stdout = capfd.readouterr().out
    assert "arbitrary" in stdout, "debug handler prints everything in event payload"
    assert (
        "payload contents are printed" in stdout
    ), "debug handler prints everything in event payload"
    assert "regardless" in stdout, "debug handler prints everything in event payload"
    assert (
        "of whether or not they are explicitly defined by LlamaIndex" in stdout
    ), "debug handler prints everything in event payload"
