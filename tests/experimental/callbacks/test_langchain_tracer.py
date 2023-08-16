from json import loads
from typing import Type
from uuid import UUID

import numpy as np
import pytest
from langchain import LLMChain, PromptTemplate
from langchain.agents import AgentType, initialize_agent
from langchain.agents.agent import AgentExecutor
from langchain.chains import RetrievalQA
from langchain.chains.openai_functions import create_openai_fn_chain
from langchain.chains.retrieval_qa.prompt import PROMPT as RETRIEVAL_QA_PROMPT
from langchain.chat_models import ChatOpenAI
from langchain.embeddings.fake import FakeEmbeddings
from langchain.llms import BaseLLM, OpenAI
from langchain.llms.fake import FakeListLLM
from langchain.retrievers import KNNRetriever
from langchain.tools import tool
from phoenix.experimental.callbacks.langchain_tracer import OpenInferenceTracer
from phoenix.trace.schemas import SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPT_TEMPLATE_VERSION,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.span_json_decoder import json_string_to_span
from phoenix.trace.span_json_encoder import span_to_json
from pydantic import BaseModel, Field


def test_tracer_llm() -> None:
    question = "What are the colors in a rainbow?"
    answer = "ROYGBIV"
    retriever = KNNRetriever(
        index=np.ones((1, 7)),
        texts=["rainbow colors"],
        embeddings=FakeEmbeddings(size=7),
    )
    tracer = OpenInferenceTracer()
    RetrievalQA.from_chain_type(
        llm=FakeListLLM(responses=[answer]),
        retriever=retriever,
    ).run(question, callbacks=[tracer])

    spans = {span.name: span for span in tracer.span_buffer}

    trace_ids = set(span.context.trace_id for span in spans.values())
    assert len(trace_ids) == 1
    assert UUID(str(next(iter(trace_ids))))

    assert spans["RetrievalQA"].parent_id is None
    assert spans["Retriever"].parent_id is spans["RetrievalQA"].context.span_id
    assert spans["StuffDocumentsChain"].parent_id is spans["RetrievalQA"].context.span_id
    assert spans["LLMChain"].parent_id is spans["StuffDocumentsChain"].context.span_id
    assert spans["FakeListLLM"].parent_id is spans["LLMChain"].context.span_id

    assert spans["RetrievalQA"].span_kind is SpanKind.CHAIN
    assert spans["Retriever"].span_kind is SpanKind.RETRIEVER
    assert spans["StuffDocumentsChain"].span_kind is SpanKind.CHAIN
    assert spans["LLMChain"].span_kind is SpanKind.CHAIN
    assert spans["FakeListLLM"].span_kind is SpanKind.LLM

    assert spans["RetrievalQA"].status_code is SpanStatusCode.OK
    assert spans["Retriever"].status_code is SpanStatusCode.OK
    assert spans["StuffDocumentsChain"].status_code is SpanStatusCode.OK
    assert spans["LLMChain"].status_code is SpanStatusCode.OK
    assert spans["FakeListLLM"].status_code is SpanStatusCode.OK

    attributes = spans["RetrievalQA"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(INPUT_VALUE) is question
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["Retriever"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(INPUT_VALUE) is question
    assert loads(attributes.get(OUTPUT_VALUE))

    attributes = spans["StuffDocumentsChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["LLMChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer
    assert attributes.get(LLM_PROMPT_TEMPLATE) == RETRIEVAL_QA_PROMPT.template
    assert attributes.get(LLM_PROMPT_TEMPLATE_VARIABLES) == RETRIEVAL_QA_PROMPT.input_variables
    assert attributes.get(LLM_PROMPT_TEMPLATE_VERSION) == "unknown"

    attributes = spans["FakeListLLM"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON
    assert loads(attributes.get(INPUT_VALUE))
    assert loads(attributes.get(OUTPUT_VALUE))

    for span in spans.values():
        assert json_string_to_span(span_to_json(span)) == span


@pytest.fixture
def tracer() -> OpenInferenceTracer:
    """An OpenInference tracer"""
    return OpenInferenceTracer()


@pytest.mark.parametrize(
    "llm_class,model_name",
    [
        pytest.param(OpenAI, "gpt-3.5-turbo", id="openai-llm"),
        pytest.param(ChatOpenAI, "gpt-3.5-turbo", id="openai-chat-model"),
    ],
)
def test_tracer_records_common_llm_attributes_for_llm_chain(
    llm_class: Type[BaseLLM], model_name: str, tracer: OpenInferenceTracer
) -> None:
    temperature = 0.75
    llm = llm_class()
    llm = llm_class(model_name=model_name, temperature=temperature)
    prompt_template = PromptTemplate.from_template("What is the complementary color of {color}?")
    chain = LLMChain(prompt=prompt_template, llm=llm)
    response = chain.run({"color": "blue"}, callbacks=[tracer])

    assert "orange" in response.lower()
    span = next(span for span in tracer.span_buffer if span.span_kind == SpanKind.LLM)
    attributes = span.attributes
    assert attributes["llm.invocation_parameters.temperature"] == temperature
    assert attributes["llm.model_name"] == model_name
    assert isinstance(attributes["llm.prompt_tokens"], int)
    assert isinstance(attributes["llm.completion_tokens"], int)
    assert isinstance(attributes["llm.total_tokens"], int)


class TestTracerFunctionCallAttributes:
    def test_tracer_records_function_call_attributes_for_openai_function_chain(
        self, tracer: OpenInferenceTracer
    ) -> None:
        functions = [
            {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "The city name, e.g., San Francisco",
                        },
                    },
                    "required": ["city"],
                },
            },
            {
                "name": "get_current_time",
                "description": "Get the current time in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "The city name, e.g., San Francisco",
                        },
                    },
                    "required": ["city"],
                },
            },
        ]
        prompt_template = PromptTemplate.from_template("What is the current weather in {location}?")
        llm = ChatOpenAI(model_name="gpt-4-0613")
        chain = create_openai_fn_chain(functions=functions, llm=llm, prompt=prompt_template)
        tracer = OpenInferenceTracer()
        chain.run("the capital city of England", callbacks=[tracer])

        span = next(span for span in tracer.span_buffer if span.name == "ChatOpenAI")
        assert span.attributes["llm.function_call.get_current_weather"] == {"city": "London"}

    def test_tracer_records_function_call_attributes_when_openai_function_agent_uses_tool(
        self, agent: AgentExecutor, tracer: OpenInferenceTracer
    ) -> None:
        response = agent.run('How many characters are in the word "hello"?', callbacks=[tracer])

        assert "5" in response or "five" in response.lower()
        span = next(span for span in tracer.span_buffer if span.name == "ChatOpenAI")
        attributes = span.attributes
        assert "llm.function_call.tool_selection" in attributes

    def test_tracer_omits_function_call_attributes_when_openai_function_agent_skips_tool(
        self, agent: AgentExecutor, tracer: OpenInferenceTracer
    ) -> None:
        response = agent.run("Who won the World Cup in 2018?", callbacks=[tracer])

        assert "France" in response or "French" in response
        span = next(span for span in tracer.span_buffer if span.name == "ChatOpenAI")
        attributes = span.attributes
        assert "llm.function_call.tool_selection" not in attributes

    @pytest.fixture
    def agent(self) -> AgentExecutor:
        """Returns an OpenAI functions agent that uses a tool to count the letters in a word."""

        class CountCharactersToolArgumentSchema(BaseModel):
            """A schema for the arguments of the count_characters tool."""

            string: str = Field(description="input string whose characters will be counted")

        @tool("count_letter", args_schema=CountCharactersToolArgumentSchema)
        def count_characters(string: str) -> int:
            """A tool that counts the characters in an input string."""
            return len(string)

        return initialize_agent(
            tools=[count_characters],
            llm=ChatOpenAI(temperature=0, model="gpt-4-0613"),
            agent=AgentType.OPENAI_MULTI_FUNCTIONS,
        )
