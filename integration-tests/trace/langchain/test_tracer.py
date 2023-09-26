import json
import os
import urllib.request
from pathlib import Path
from typing import Type

import pytest
from langchain import GoogleSearchAPIWrapper, LLMChain, PromptTemplate
from langchain.agents import (
    AgentExecutor,
    AgentType,
    create_sql_agent,
    initialize_agent,
)
from langchain.agents.agent_toolkits import SQLDatabaseToolkit
from langchain.chains.openai_functions import create_openai_fn_chain
from langchain.chat_models import ChatOpenAI
from langchain.llms import BaseLLM, OpenAI
from langchain.sql_database import SQLDatabase
from langchain.tools import GoogleSearchRun, PythonREPLTool, tool
from phoenix.trace.exporter import NoOpExporter
from phoenix.trace.langchain import OpenInferenceTracer
from phoenix.trace.schemas import SpanKind
from phoenix.trace.semantic_conventions import (
    LLM_FUNCTION_CALL,
    LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS,
    LLM_MODEL_NAME,
    LLM_OUTPUT_MESSAGES,
    LLM_PROMPTS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
    MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_ROLE,
    TOOL_DESCRIPTION,
    TOOL_NAME,
)
from pydantic import BaseModel, Field

DB_FILE_PATH = Path("chinook.db")


@pytest.fixture
def tracer() -> OpenInferenceTracer:
    """An OpenInference tracer"""
    return OpenInferenceTracer(exporter=NoOpExporter())


@pytest.fixture(scope="session")
def chinook_database_file() -> Path:
    """
    Downloads and saves a binary .db file an SQLite database containing the Chinook dataset.

    https://github.com/lerocha/chinook-database/tree/master
    """
    urllib.request.urlretrieve(
        "http://storage.googleapis.com/arize-assets/phoenix/traces/chinook.db", DB_FILE_PATH
    )
    yield DB_FILE_PATH
    _remove_file(DB_FILE_PATH)


@pytest.mark.parametrize(
    "llm_class,model_name",
    [
        pytest.param(OpenAI, "text-davinci-003", id="openai-llm"),
        pytest.param(ChatOpenAI, "gpt-3.5-turbo", id="openai-chat-model"),
    ],
)
def test_tracer_records_common_llm_attributes_for_llm_chain(
    llm_class: Type[BaseLLM], model_name: str, tracer: OpenInferenceTracer
) -> None:
    temperature = 0.75
    llm = llm_class()
    llm = llm_class(model_name=model_name, temperature=temperature)
    prompt_template_string = "What is the complementary color of {color}?"
    color = "blue"
    prompt_template = PromptTemplate.from_template(prompt_template_string)
    chain = LLMChain(prompt=prompt_template, llm=llm)
    response = chain.run({"color": color}, callbacks=[tracer])

    span = next(span for span in tracer.span_buffer if span.span_kind == SpanKind.LLM)
    attributes = span.attributes
    prompts = attributes[LLM_PROMPTS]
    invocation_parameters = json.loads(attributes[LLM_INVOCATION_PARAMETERS])
    formatted_query = prompt_template.format(color=color)

    assert "orange" in response.lower()
    assert attributes[LLM_MODEL_NAME] == model_name
    assert len(prompts) == 1
    assert formatted_query in prompts[0]
    assert invocation_parameters["temperature"] == temperature
    assert isinstance(attributes[LLM_TOKEN_COUNT_PROMPT], int)
    assert isinstance(attributes[LLM_TOKEN_COUNT_COMPLETION], int)
    assert isinstance(attributes[LLM_TOKEN_COUNT_TOTAL], int)


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
        llm = ChatOpenAI(model_name="gpt-4-0613", n=2, temperature=0.0)
        chain = create_openai_fn_chain(functions=functions, llm=llm, prompt=prompt_template)
        chain.run("the capital city of England", callbacks=[tracer])
        spans = {span.name: span for span in tracer.get_spans()}
        span = spans["ChatOpenAI"]
        function_call_attributes = json.loads(span.attributes[LLM_FUNCTION_CALL])
        assert function_call_attributes["name"] == "get_current_weather"
        assert function_call_attributes["arguments"]["city"] == "London"
        assert span.attributes.get(LLM_INPUT_MESSAGES) == [
            {
                MESSAGE_CONTENT: "What is the current weather in the capital city of England?",
                MESSAGE_ROLE: "user",
            }
        ]
        assert span.attributes.get(LLM_OUTPUT_MESSAGES) == [
            {
                MESSAGE_ROLE: "assistant",
                MESSAGE_FUNCTION_CALL_NAME: "get_current_weather",
                MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: '{\n  "city": "London"\n}',
            },
            {
                MESSAGE_ROLE: "assistant",
                MESSAGE_FUNCTION_CALL_NAME: "get_current_weather",
                MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: '{\n  "city": "London"\n}',
            },
        ]

    def test_tracer_records_function_call_attributes_when_openai_function_agent_uses_tool(
        self, agent: AgentExecutor, tracer: OpenInferenceTracer
    ) -> None:
        response = agent.run('How many characters are in the word "hello"?', callbacks=[tracer])

        span = next(span for span in tracer.span_buffer if span.name == "ChatOpenAI")
        attributes = span.attributes
        function_call_attributes = json.loads(attributes[LLM_FUNCTION_CALL])
        function_call_arguments = function_call_attributes["arguments"]

        assert "5" in response or "five" in response.lower()
        assert "count_letter" in json.dumps(function_call_arguments)
        assert "hello" in json.dumps(function_call_arguments)

        span = next(span for span in tracer.span_buffer if span.span_kind == SpanKind.TOOL)
        attributes = span.attributes

        assert TOOL_NAME in attributes
        assert TOOL_DESCRIPTION in attributes
        assert attributes[TOOL_NAME] == "count_letter"
        assert isinstance(attributes[TOOL_DESCRIPTION], str)

    def test_tracer_omits_function_call_attributes_when_openai_function_agent_skips_tool(
        self, agent: AgentExecutor, tracer: OpenInferenceTracer
    ) -> None:
        response = agent.run("Who won the World Cup in 2018?", callbacks=[tracer])

        span = next(span for span in tracer.span_buffer if span.name == "ChatOpenAI")
        attributes = span.attributes

        assert "France" in response or "French" in response
        assert LLM_FUNCTION_CALL not in attributes
        assert not any(span.span_kind == SpanKind.TOOL for span in tracer.span_buffer)

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


def test_tracer_records_tool_attributes_for_sql_database_agent(
    chinook_database_file: Path, tracer: OpenInferenceTracer
) -> None:
    sql_query = (
        "SELECT Country, SUM(Total) AS TotalSales FROM Invoice "
        "INNER JOIN Customer ON Invoice.CustomerId = Customer.CustomerId "
        "GROUP BY Country ORDER BY TotalSales DESC LIMIT 10"
    )
    natural_language_query = (
        "List the total sales per country. Which country's customers spent the most?"
    )
    database = SQLDatabase.from_uri(f"sqlite:///{chinook_database_file.as_posix()}")
    sql_query_output = eval(database.run(sql_query))
    country, _ = sql_query_output[0]
    assert country == "USA"

    llm = OpenAI(model_name="gpt-4", temperature=0)
    agent = create_sql_agent(
        llm=llm,
        toolkit=SQLDatabaseToolkit(db=database, llm=llm),
        agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    )
    response = agent.run(natural_language_query, callbacks=[tracer])

    tool_spans = [span for span in tracer.span_buffer if span.span_kind == SpanKind.TOOL]
    assert tool_spans
    assert all(TOOL_NAME in span.attributes for span in tool_spans)
    assert all("sql" in span.attributes[TOOL_NAME] for span in tool_spans)
    assert all(TOOL_DESCRIPTION in span.attributes for span in tool_spans)
    assert all(isinstance(span.attributes[TOOL_DESCRIPTION], str) for span in tool_spans)
    assert (
        "us" in response.lower()
        or "u.s." in response.lower()
        or "united states" in response.lower()
    )


@pytest.mark.parametrize(
    "query,agent,tool_name",
    [
        pytest.param(
            "Compute the largest prime number less than 100.",
            initialize_agent(
                llm=ChatOpenAI(model_name="gpt-4-0613"),
                tools=[PythonREPLTool()],
                agent=AgentType.OPENAI_FUNCTIONS,
            ),
            "Python_REPL",
            id="python-repl-agent",
        ),
        pytest.param(
            "Who the 2023 Cincinnati Master's Finals?",
            initialize_agent(
                llm=ChatOpenAI(model_name="gpt-4-0613"),
                tools=[GoogleSearchRun(api_wrapper=GoogleSearchAPIWrapper())],
                agent=AgentType.OPENAI_FUNCTIONS,
            ),
            "google_search",
            id="google-search-agent",
        ),
    ],
)
def test_tracer_records_tool_attributes_for_agents(
    query: str, agent: AgentExecutor, tool_name: str
) -> None:
    tracer = OpenInferenceTracer()
    agent.run(query, callbacks=[tracer])

    span = next(span for span in tracer.span_buffer if span.span_kind == SpanKind.TOOL)
    assert span.attributes[TOOL_NAME] == tool_name
    assert isinstance(span.attributes[TOOL_DESCRIPTION], str)


def _remove_file(path: str) -> None:
    """Removes a file if it exists. Does not raise an exception if the file does not exist.

    Args:
        path (str): The path to the file to remove.
    """
    try:
        os.remove(path)
    except OSError:
        pass
