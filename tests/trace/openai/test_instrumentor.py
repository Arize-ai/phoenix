import openai
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor
from phoenix.trace.schemas import SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import LLM_INPUT_MESSAGES, MESSAGE_CONTENT, MESSAGE_ROLE
from phoenix.trace.tracer import Tracer


def test_openai_instrumentor_includes_message_info_on_success() -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()
    model = "gpt-4"
    messages = [{"role": "user", "content": "Who won the World Cup in 2018?"}]
    temperature = 0.23
    response = openai.ChatCompletion.create(model=model, messages=messages, temperature=temperature)
    print(response)

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]

    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert span.attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "Who won the World Cup in 2018?"}
    ]
