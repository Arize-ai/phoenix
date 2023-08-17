import json
from typing import Type

import pytest
from langchain import LLMChain, PromptTemplate
from langchain.agents import AgentType, initialize_agent
from langchain.agents.agent import AgentExecutor
from langchain.chains.openai_functions import create_openai_fn_chain
from langchain.chat_models import ChatOpenAI
from langchain.llms import BaseLLM, OpenAI
from langchain.tools import tool
from phoenix.experimental.callbacks.langchain_tracer import OpenInferenceTracer
from phoenix.trace.schemas import SpanKind
from pydantic import BaseModel, Field


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

    span = next(span for span in tracer.span_buffer if span.span_kind == SpanKind.LLM)
    attributes = span.attributes
    invocation_parameters = json.loads(attributes["llm.invocation_parameters"])

    assert "orange" in response.lower()
    assert attributes["llm.model_name"] == model_name
    assert invocation_parameters["temperature"] == temperature
    assert isinstance(attributes["llm.token_count.prompt"], int)
    assert isinstance(attributes["llm.token_count.completion"], int)
    assert isinstance(attributes["llm.token_count.total"], int)


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
        function_call_attributes = json.loads(span.attributes["llm.function_call"])
        assert function_call_attributes["name"] == "get_current_weather"
        assert function_call_attributes["arguments"]["city"] == "London"

    def test_tracer_records_function_call_attributes_when_openai_function_agent_uses_tool(
        self, agent: AgentExecutor, tracer: OpenInferenceTracer
    ) -> None:
        response = agent.run('How many characters are in the word "hello"?', callbacks=[tracer])

        span = next(span for span in tracer.span_buffer if span.name == "ChatOpenAI")
        attributes = span.attributes
        function_call_attributes = json.loads(attributes["llm.function_call"])
        function_call_arguments = function_call_attributes["arguments"]

        assert "5" in response or "five" in response.lower()
        assert "count_letter" in json.dumps(function_call_arguments)
        assert "hello" in json.dumps(function_call_arguments)

    def test_tracer_omits_function_call_attributes_when_openai_function_agent_skips_tool(
        self, agent: AgentExecutor, tracer: OpenInferenceTracer
    ) -> None:
        response = agent.run("Who won the World Cup in 2018?", callbacks=[tracer])

        span = next(span for span in tracer.span_buffer if span.name == "ChatOpenAI")
        attributes = span.attributes

        assert "France" in response or "French" in response
        assert "llm.function_call" not in attributes

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
