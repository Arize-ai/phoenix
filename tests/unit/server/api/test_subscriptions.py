import json
import re
from datetime import datetime
from typing import Any, Awaitable, Callable, Mapping, Optional

from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.semconv.attributes.url_attributes import URL_FULL, URL_PATH
from sqlalchemy import select
from strawberry.relay.types import GlobalID
from vcr.request import Request as VCRRequest

from phoenix.db import models
from phoenix.server.api.evaluators import (
    TEMPLATE_FORMATTED_MESSAGES,
    TEMPLATE_LITERAL_MAPPING,
    TEMPLATE_MESSAGES,
    TEMPLATE_PATH_MAPPING,
    TEMPLATE_VARIABLES,
    _generate_builtin_evaluator_id,
)
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionExperiment,
    ChatCompletionSubscriptionResult,
    EvaluationChunk,
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Evaluator import BuiltInEvaluator, LLMEvaluator
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.api.types.node import from_global_id
from phoenix.server.experiments.utils import is_experiment_project_name
from phoenix.server.types import DbSessionFactory
from phoenix.trace.attributes import flatten, get_attribute_value
from tests.unit._helpers import verify_experiment_examples_junction_table
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.vcr import CustomVCR


def _assert_spans_equal(span: Mapping[str, Any], subscription_span: Mapping[str, Any]) -> None:
    """
    Compare two span dictionaries with relaxed floating-point comparison for latencyMs.
    SQLite's floating-point arithmetic produces slightly different results than Python.
    """
    # Check that both have the same keys
    assert span.keys() == subscription_span.keys(), (
        f"Span keys don't match: {span.keys()} vs {subscription_span.keys()}"
    )

    # Compare each field
    for key in span.keys():
        if key == "latencyMs":
            # Use relaxed comparison for latencyMs due to SQLite precision
            span_latency = span[key]
            subscription_latency = subscription_span[key]
            if span_latency is not None and subscription_latency is not None:
                assert abs(span_latency - subscription_latency) <= 2.0, (
                    f"latencyMs difference too large: {span_latency} vs {subscription_latency}"
                )
            else:
                assert span_latency == subscription_latency
        else:
            # Strict equality for all other fields
            assert span[key] == subscription_span[key], f"Mismatch in field '{key}'"


class TestChatCompletionSubscription:
    QUERY = """
      subscription ChatCompletionSubscription($input: ChatCompletionInput!) {
        chatCompletion(input: $input) {
          __typename
          ... on TextChunk {
            content
          }
          ... on ToolCallChunk {
            id
            function {
              name
              arguments
            }
          }
          ... on ChatCompletionSubscriptionResult {
            span {
              ...SpanFragment
            }
          }
          ... on ChatCompletionSubscriptionError {
            message
          }
          ... on EvaluationChunk {
            experimentRunEvaluation {
              name
              label
              score
              explanation
              annotatorKind
            }
          }
        }
      }

      query SpanQuery($spanId: ID!) {
        span: node(id: $spanId) {
          ... on Span {
            ...SpanFragment
          }
        }
      }

      fragment SpanFragment on Span {
        id
        name
        statusCode
        statusMessage
        startTime
        endTime
        latencyMs
        parentId
        spanKind
        context {
          spanId
          traceId
        }
        attributes
        metadata
        numDocuments
        tokenCountTotal
        tokenCountPrompt
        tokenCountCompletion
        input {
          mimeType
          value
        }
        output {
          mimeType
          value
        }
        events {
          name
          message
          timestamp
        }
        cumulativeTokenCountTotal
        cumulativeTokenCountPrompt
        cumulativeTokenCountCompletion
        propagatedStatusCode
      }
    """

    async def test_openai_text_response_emits_expected_payloads_and_records_expected_span(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "Who won the World Cup in 2018? Answer in one word",
                    }
                ],
                "model": {"builtin": {"name": "gpt-4", "providerKey": "OPENAI"}},
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.1},
                ],
                "repetitions": 1,
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionResult.__name__
        assert all(
            payload["chatCompletion"]["__typename"] == TextChunk.__name__ for payload in payloads
        )
        response_text = "".join(payload["chatCompletion"]["content"] for payload in payloads)
        assert "france" in response_text.lower()
        subscription_span = last_payload["chatCompletion"]["span"]
        span_id = subscription_span["id"]

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription
        response = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        assert (data := response.data) is not None
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        _assert_spans_equal(span, subscription_span)

        # check attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "ChatCompletion"
        assert span.pop("statusCode") == "OK"
        assert not span.pop("statusMessage")
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert context.pop("traceId")
        assert not context
        assert span.pop("metadata") is None
        assert span.pop("numDocuments") == 0
        assert isinstance(token_count_total := span.pop("tokenCountTotal"), int)
        assert isinstance(token_count_prompt := span.pop("tokenCountPrompt"), int)
        assert isinstance(token_count_completion := span.pop("tokenCountCompletion"), int)
        assert token_count_prompt > 0
        assert token_count_completion > 0
        assert token_count_total == token_count_prompt + token_count_completion
        assert (input := span.pop("input")).pop("mimeType") == "json"
        assert (input_value := input.pop("value"))
        assert not input
        assert "api_key" not in input_value
        assert "apiKey" not in input_value
        assert (output := span.pop("output")).pop("mimeType") == "text"
        assert output.pop("value")
        assert not output
        assert not span.pop("events")
        assert isinstance(
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), float
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), float
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), float
        )
        assert cumulative_token_count_total == token_count_total
        assert cumulative_token_count_prompt == token_count_prompt
        assert cumulative_token_count_completion == token_count_completion
        assert span.pop("propagatedStatusCode") == "OK"
        assert not span

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
        assert attributes.pop(LLM_INVOCATION_PARAMETERS) == json.dumps({"temperature": 0.1})
        assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == token_count_total
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT) == token_count_prompt
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION) == token_count_completion
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ) == 0
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING) == 0
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
        assert attributes.pop(LLM_INPUT_MESSAGES) == [
            {
                "message": {
                    "role": "user",
                    "content": "Who won the World Cup in 2018? Answer in one word",
                }
            }
        ]
        assert attributes.pop(LLM_OUTPUT_MESSAGES) == [
            {
                "message": {
                    "role": "assistant",
                    "content": response_text,
                }
            }
        ]
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert not attributes

    async def test_openai_emits_expected_payloads_and_records_expected_span_on_error(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "Who won the World Cup in 2018? Answer in one word",
                    }
                ],
                "model": {"builtin": {"name": "gpt-4", "providerKey": "OPENAI"}},
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.1},
                ],
                "repetitions": 1,
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert len(payloads) == 2
        assert (error_payload := payloads[0])["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionError.__name__
        assert "401" in (status_message := error_payload["chatCompletion"]["message"])
        assert "api key" in status_message.lower()
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionResult.__name__
        subscription_span = last_payload["chatCompletion"]["span"]
        span_id = subscription_span["id"]

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription
        response = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        assert (data := response.data) is not None
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        _assert_spans_equal(span, subscription_span)

        # check attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "ChatCompletion"
        assert span.pop("statusCode") == "ERROR"
        assert span.pop("statusMessage") == status_message
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert context.pop("traceId")
        assert not context
        assert span.pop("metadata") is None
        assert span.pop("numDocuments") == 0
        assert isinstance(token_count_total := span.pop("tokenCountTotal"), int)
        assert isinstance(token_count_prompt := span.pop("tokenCountPrompt"), int)
        assert isinstance(token_count_completion := span.pop("tokenCountCompletion"), int)
        assert token_count_prompt == 0
        assert token_count_completion == 0
        assert token_count_total == token_count_prompt + token_count_completion
        assert (input := span.pop("input")).pop("mimeType") == "json"
        assert (input_value := input.pop("value"))
        assert not input
        assert "api_key" not in input_value
        assert "apiKey" not in input_value
        assert span.pop("output") is None
        assert (events := span.pop("events"))
        assert len(events) == 1
        assert (event := events[0])
        assert event.pop("name") == "exception"
        assert event.pop("message") == status_message
        assert datetime.fromisoformat(event.pop("timestamp"))
        assert not event
        assert isinstance(
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), float
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), float
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), float
        )
        assert cumulative_token_count_total == token_count_total
        assert cumulative_token_count_prompt == token_count_prompt
        assert cumulative_token_count_completion == token_count_completion
        assert span.pop("propagatedStatusCode") == "ERROR"
        assert not span

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
        assert attributes.pop(LLM_INVOCATION_PARAMETERS) == json.dumps({"temperature": 0.1})
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(LLM_INPUT_MESSAGES) == [
            {
                "message": {
                    "role": "user",
                    "content": "Who won the World Cup in 2018? Answer in one word",
                }
            }
        ]
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert not attributes

    async def test_openai_tool_call_response_emits_expected_payloads_and_records_expected_span(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        get_current_weather_tool_schema = {
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city name, e.g. San Francisco",
                        },
                    },
                    "required": ["location"],
                },
            },
        }
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "How's the weather in San Francisco?",
                    }
                ],
                "model": {"builtin": {"name": "gpt-4", "providerKey": "OPENAI"}},
                "tools": [get_current_weather_tool_schema],
                "invocationParameters": [
                    {"invocationName": "tool_choice", "valueJson": "auto"},
                ],
                "repetitions": 1,
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionResult.__name__
        assert all(
            payload["chatCompletion"]["__typename"] == ToolCallChunk.__name__
            for payload in payloads
        )
        json.loads(
            "".join(payload["chatCompletion"]["function"]["arguments"] for payload in payloads)
        ) == {"location": "San Francisco"}
        subscription_span = last_payload["chatCompletion"]["span"]
        span_id = subscription_span["id"]

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription
        response = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        assert (data := response.data) is not None
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        _assert_spans_equal(span, subscription_span)

        # check attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "ChatCompletion"
        assert span.pop("statusCode") == "OK"
        assert not span.pop("statusMessage")
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert context.pop("traceId")
        assert not context
        assert span.pop("metadata") is None
        assert span.pop("numDocuments") == 0
        assert isinstance(token_count_total := span.pop("tokenCountTotal"), int)
        assert isinstance(token_count_prompt := span.pop("tokenCountPrompt"), int)
        assert isinstance(token_count_completion := span.pop("tokenCountCompletion"), int)
        assert token_count_prompt > 0
        assert token_count_completion > 0
        assert token_count_total == token_count_prompt + token_count_completion
        assert (input := span.pop("input")).pop("mimeType") == "json"
        assert (input_value := input.pop("value"))
        assert not input
        assert "api_key" not in input_value
        assert "apiKey" not in input_value
        assert (output := span.pop("output")).pop("mimeType") == "json"
        assert output.pop("value")
        assert not output
        assert not span.pop("events")
        assert isinstance(
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), float
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), float
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), float
        )
        assert cumulative_token_count_total == token_count_total
        assert cumulative_token_count_prompt == token_count_prompt
        assert cumulative_token_count_completion == token_count_completion
        assert span.pop("propagatedStatusCode") == "OK"
        assert not span

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
        assert attributes.pop(LLM_INVOCATION_PARAMETERS) == json.dumps({"tool_choice": "auto"})
        assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == token_count_total
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT) == token_count_prompt
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION) == token_count_completion
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ) == 0
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING) == 0
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == JSON
        assert attributes.pop(LLM_INPUT_MESSAGES) == [
            {
                "message": {
                    "role": "user",
                    "content": "How's the weather in San Francisco?",
                }
            }
        ]
        assert (output_messages := attributes.pop(LLM_OUTPUT_MESSAGES))
        assert len(output_messages) == 1
        assert (output_message := output_messages[0]["message"])["role"] == "assistant"
        assert "content" not in output_message
        assert (tool_calls := output_message["tool_calls"])
        assert len(tool_calls) == 1
        assert (tool_call := tool_calls[0]["tool_call"])
        assert (function := tool_call["function"])
        assert function["name"] == "get_current_weather"
        assert json.loads(function["arguments"]) == {"location": "San Francisco"}
        assert (llm_tools := attributes.pop(LLM_TOOLS))
        assert llm_tools == [{"tool": {"json_schema": json.dumps(get_current_weather_tool_schema)}}]
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert not attributes

    async def test_openai_tool_call_messages_emits_expected_payloads_and_records_expected_span(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        tool_call_id = "call_zz1hkqH3IakqnHfVhrrUemlQ"
        tool_calls = [
            {
                "id": tool_call_id,
                "function": {
                    "arguments": json.dumps({"city": "San Francisco"}, indent=4),
                    "name": "get_weather",
                },
                "type": "function",
            }
        ]
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "How's the weather in San Francisco?",
                    },
                    {
                        "role": "AI",
                        "toolCalls": tool_calls,
                    },
                    {
                        "content": "sunny",
                        "role": "TOOL",
                        "toolCallId": tool_call_id,
                    },
                ],
                "model": {"builtin": {"name": "gpt-4", "providerKey": "OPENAI"}},
                "repetitions": 1,
            }
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionResult.__name__
        assert all(
            payload["chatCompletion"]["__typename"] == TextChunk.__name__ for payload in payloads
        )
        response_text = "".join(payload["chatCompletion"]["content"] for payload in payloads)
        assert "sunny" in response_text.lower()
        subscription_span = last_payload["chatCompletion"]["span"]
        span_id = subscription_span["id"]

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription
        response = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        assert (data := response.data) is not None
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        _assert_spans_equal(span, subscription_span)

        # check attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "ChatCompletion"
        assert span.pop("statusCode") == "OK"
        assert not span.pop("statusMessage")
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert context.pop("traceId")
        assert not context
        assert span.pop("metadata") is None
        assert span.pop("numDocuments") == 0
        assert isinstance(token_count_total := span.pop("tokenCountTotal"), int)
        assert isinstance(token_count_prompt := span.pop("tokenCountPrompt"), int)
        assert isinstance(token_count_completion := span.pop("tokenCountCompletion"), int)
        assert token_count_prompt > 0
        assert token_count_completion > 0
        assert token_count_total == token_count_prompt + token_count_completion
        assert (input := span.pop("input")).pop("mimeType") == "json"
        assert (input_value := input.pop("value"))
        assert not input
        assert "api_key" not in input_value
        assert "apiKey" not in input_value
        assert (output := span.pop("output")).pop("mimeType") == "text"
        assert output.pop("value")
        assert not output
        assert not span.pop("events")
        assert isinstance(
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), float
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), float
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), float
        )
        assert cumulative_token_count_total == token_count_total
        assert cumulative_token_count_prompt == token_count_prompt
        assert cumulative_token_count_completion == token_count_completion
        assert span.pop("propagatedStatusCode") == "OK"
        assert not span

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
        assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == token_count_total
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT) == token_count_prompt
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION) == token_count_completion
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ) == 0
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING) == 0
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
        assert (llm_input_messages := attributes.pop(LLM_INPUT_MESSAGES))
        assert len(llm_input_messages) == 3
        llm_input_message = llm_input_messages[0]["message"]
        assert llm_input_message == {
            "content": "How's the weather in San Francisco?",
            "role": "user",
        }
        llm_input_message = llm_input_messages[1]["message"]
        assert llm_input_message["content"] == ""
        assert llm_input_message["role"] == "ai"
        assert llm_input_message["tool_calls"] == [
            {
                "tool_call": {
                    "id": tool_call_id,
                    "function": {
                        "name": "get_weather",
                        "arguments": '"{\\n    \\"city\\": \\"San Francisco\\"\\n}"',
                    },
                }
            }
        ]
        llm_input_message = llm_input_messages[2]["message"]
        assert llm_input_message == {
            "content": "sunny",
            "role": "tool",
            "tool_call_id": tool_call_id,
        }
        assert attributes.pop(LLM_OUTPUT_MESSAGES) == [
            {
                "message": {
                    "role": "assistant",
                    "content": response_text,
                }
            }
        ]
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert not attributes

    async def test_anthropic_text_response_emits_expected_payloads_and_records_expected_span(
        self,
        gql_client: AsyncGraphQLClient,
        anthropic_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "Who won the World Cup in 2018? Answer in one word",
                    }
                ],
                "model": {
                    "builtin": {"name": "claude-3-5-sonnet-20240620", "providerKey": "ANTHROPIC"}
                },
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.1},
                    {"invocationName": "max_tokens", "valueInt": 1024},
                ],
                "repetitions": 1,
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionResult.__name__
        assert all(
            payload["chatCompletion"]["__typename"] == TextChunk.__name__ for payload in payloads
        )
        response_text = "".join(payload["chatCompletion"]["content"] for payload in payloads)
        assert "france" in response_text.lower()
        subscription_span = last_payload["chatCompletion"]["span"]
        span_id = subscription_span["id"]

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription
        response = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        assert (data := response.data) is not None
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        _assert_spans_equal(span, subscription_span)

        # check attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "ChatCompletion"
        assert span.pop("statusCode") == "OK"
        assert not span.pop("statusMessage")
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert context.pop("traceId")
        assert not context
        assert span.pop("metadata") is None
        assert span.pop("numDocuments") == 0
        assert isinstance(token_count_total := span.pop("tokenCountTotal"), int)
        assert isinstance(token_count_prompt := span.pop("tokenCountPrompt"), int)
        assert isinstance(token_count_completion := span.pop("tokenCountCompletion"), int)
        assert token_count_prompt > 0
        assert token_count_completion > 0
        assert token_count_total == token_count_prompt + token_count_completion
        assert (input := span.pop("input")).pop("mimeType") == "json"
        assert (input_value := input.pop("value"))
        assert not input
        assert "api_key" not in input_value
        assert "apiKey" not in input_value
        assert (output := span.pop("output")).pop("mimeType") == "text"
        assert output.pop("value")
        assert not output
        assert not span.pop("events")
        assert isinstance(
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), float
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), float
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), float
        )
        assert cumulative_token_count_total == token_count_total
        assert cumulative_token_count_prompt == token_count_prompt
        assert cumulative_token_count_completion == token_count_completion
        assert span.pop("propagatedStatusCode") == "OK"
        assert not span

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "claude-3-5-sonnet-20240620"
        assert attributes.pop(LLM_INVOCATION_PARAMETERS) == json.dumps(
            {"temperature": 0.1, "max_tokens": 1024}
        )
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT) == token_count_prompt
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION) == token_count_completion
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
        assert attributes.pop(LLM_INPUT_MESSAGES) == [
            {
                "message": {
                    "role": "user",
                    "content": "Who won the World Cup in 2018? Answer in one word",
                }
            }
        ]
        assert attributes.pop(LLM_OUTPUT_MESSAGES) == [
            {
                "message": {
                    "role": "assistant",
                    "content": response_text,
                }
            }
        ]
        assert attributes.pop(LLM_PROVIDER) == "anthropic"
        assert attributes.pop(LLM_SYSTEM) == "anthropic"
        assert attributes.pop(URL_FULL) == "https://api.anthropic.com/v1/messages"
        assert attributes.pop(URL_PATH) == "v1/messages"
        assert not attributes

    async def test_evaluator_emits_evaluation_chunk(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        correctness_llm_evaluator: models.LLMEvaluator,
        custom_vcr: CustomVCR,
    ) -> None:
        llm_evaluator_gid = str(
            GlobalID(type_name=LLMEvaluator.__name__, node_id=str(correctness_llm_evaluator.id))
        )
        contains_id = _generate_builtin_evaluator_id("Contains")
        builtin_evaluator_gid = str(
            GlobalID(type_name=BuiltInEvaluator.__name__, node_id=str(contains_id))
        )
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "What is 2 + 2? Answer with just the number.",
                    }
                ],
                "model": {"builtin": {"name": "gpt-4o-mini", "providerKey": "OPENAI"}},
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.0},
                ],
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": llm_evaluator_gid,
                        "name": "correctness",
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    },
                    {
                        "id": builtin_evaluator_gid,
                        "name": "contains-four",
                        "inputMapping": {
                            "literalMapping": {"words": "4"},
                            "pathMapping": {"text": "$.output"},
                        },
                    },
                ],
            },
        }

        text_chunks: list[dict[str, Any]] = []
        evaluation_chunks: list[dict[str, Any]] = []
        result_chunk: dict[str, Any] = {}

        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                async for payload in subscription.stream():
                    typename = payload["chatCompletion"]["__typename"]
                    if typename == TextChunk.__name__:
                        text_chunks.append(payload["chatCompletion"])
                    elif typename == EvaluationChunk.__name__:
                        evaluation_chunks.append(payload["chatCompletion"])
                    elif typename == ChatCompletionSubscriptionResult.__name__:
                        result_chunk = payload["chatCompletion"]

        # Verify we got text chunks with content
        assert len(text_chunks) >= 1
        response_text = "".join(chunk["content"] for chunk in text_chunks)
        assert "4" in response_text

        # Verify we got a result chunk with a span
        assert result_chunk["span"]["id"]

        assert len(evaluation_chunks) == 2
        llm_chunk = next(
            chunk
            for chunk in evaluation_chunks
            if chunk["experimentRunEvaluation"]["name"] == "correctness"
        )
        llm_annotation = llm_chunk["experimentRunEvaluation"]
        assert llm_annotation["annotatorKind"] == "LLM"
        assert llm_annotation["label"] == "correct"
        builtin_chunk = next(
            chunk
            for chunk in evaluation_chunks
            if chunk["experimentRunEvaluation"]["name"] == "contains-four"
        )
        builtin_annotation = builtin_chunk["experimentRunEvaluation"]
        assert builtin_annotation["annotatorKind"] == "CODE"
        assert builtin_annotation["label"] == "true"

    async def test_evaluator_not_emitted_when_task_errors(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        correctness_llm_evaluator: models.LLMEvaluator,
        custom_vcr: CustomVCR,
    ) -> None:
        """Test that no evaluation chunks are emitted when the chat completion errors out."""
        evaluator_gid = str(
            GlobalID(type_name=LLMEvaluator.__name__, node_id=str(correctness_llm_evaluator.id))
        )
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "What is 2 + 2? Answer with just the number.",
                    }
                ],
                "model": {
                    "builtin": {
                        "name": "gpt-nonexistent-model",  # non-existent model triggers an error
                        "providerKey": "OPENAI",
                    }
                },
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "name": "correctness",
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    }
                ],
            },
        }

        error_chunks: list[dict[str, Any]] = []
        evaluation_chunks: list[dict[str, Any]] = []
        result_chunk: dict[str, Any] = {}

        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                async for payload in subscription.stream():
                    typename = payload["chatCompletion"]["__typename"]
                    if typename == ChatCompletionSubscriptionError.__name__:
                        error_chunks.append(payload["chatCompletion"])
                    elif typename == EvaluationChunk.__name__:
                        evaluation_chunks.append(payload["chatCompletion"])
                    elif typename == ChatCompletionSubscriptionResult.__name__:
                        result_chunk = payload["chatCompletion"]

        # Verify we got an error chunk
        assert len(error_chunks) == 1
        assert "model" in error_chunks[0]["message"].lower()

        # Verify we got a result chunk with a span (span is still recorded on error)
        assert result_chunk["span"]["id"]

        # Verify NO evaluation chunks were emitted
        assert len(evaluation_chunks) == 0

    async def test_builtin_evaluator_uses_name(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        """Test that builtin evaluators use name for annotation names."""
        exact_match_id = _generate_builtin_evaluator_id("ExactMatch")
        evaluator_gid = str(
            GlobalID(type_name=BuiltInEvaluator.__name__, node_id=str(exact_match_id))
        )
        custom_name = "my-custom-exact-match"
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "Say hello",
                    }
                ],
                "model": {"builtin": {"name": "gpt-4o-mini", "providerKey": "OPENAI"}},
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.0},
                ],
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "name": custom_name,
                        "inputMapping": {
                            "literalMapping": {
                                "expected": "hello",
                                "actual": "hello",
                            },
                        },
                    }
                ],
            },
        }

        evaluation_chunks: list[dict[str, Any]] = []
        result_chunk: dict[str, Any] = {}

        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                async for payload in subscription.stream():
                    typename = payload["chatCompletion"]["__typename"]
                    if typename == EvaluationChunk.__name__:
                        evaluation_chunks.append(payload["chatCompletion"])
                    elif typename == ChatCompletionSubscriptionResult.__name__:
                        result_chunk = payload["chatCompletion"]

        # Verify we got a result chunk with a span
        assert result_chunk["span"]["id"]

        # Verify we got exactly 1 evaluation chunk with the custom display name
        assert len(evaluation_chunks) == 1
        eval_chunk = evaluation_chunks[0]
        eval_annotation = eval_chunk["experimentRunEvaluation"]
        assert eval_annotation["name"] == custom_name
        assert eval_annotation["annotatorKind"] == "CODE"


class TestChatCompletionOverDatasetSubscription:
    QUERY = """
      subscription ChatCompletionOverDatasetSubscription($input: ChatCompletionOverDatasetInput!) {
        chatCompletionOverDataset(input: $input) {
          __typename
          datasetExampleId
          ... on TextChunk {
            content
          }
          ... on ChatCompletionSubscriptionResult {
            span {
              ...SpanFragment
            }
            experimentRun {
              ...ExperimentRunFragment
            }
          }
          ... on ChatCompletionSubscriptionError {
            message
          }
          ... on ChatCompletionSubscriptionExperiment {
            experiment {
              id
            }
          }
          ... on EvaluationChunk {
            experimentRunEvaluation {
              id
              name
              label
              score
              explanation
              annotatorKind
              traceId
            }
          }
        }
      }

      query SpanQuery($spanId: ID!) {
        span: node(id: $spanId) {
          ... on Span {
            ...SpanFragment
          }
        }
      }

      query ExperimentQuery($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          ... on Experiment {
            id
            name
            metadata
            projectName
            createdAt
            updatedAt
            description
            runs {
              edges {
                run: node {
                  ...ExperimentRunFragment
                }
              }
            }
          }
        }
      }

      fragment ExperimentRunFragment on ExperimentRun {
        id
        experimentId
        startTime
        endTime
        output
        error
        traceId
        trace {
          id
          traceId
          project {
            name
          }
        }
      }

      fragment SpanFragment on Span {
        id
        name
        statusCode
        statusMessage
        startTime
        endTime
        latencyMs
        parentId
        spanKind
        context {
          spanId
          traceId
        }
        attributes
        metadata
        numDocuments
        tokenCountTotal
        tokenCountPrompt
        tokenCountCompletion
        input {
          mimeType
          value
        }
        output {
          mimeType
          value
        }
        events {
          name
          message
          timestamp
        }
        cumulativeTokenCountTotal
        cumulativeTokenCountPrompt
        cumulativeTokenCountCompletion
        propagatedStatusCode
      }
    """

    async def test_emits_expected_payloads_and_records_expected_spans_and_experiment(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        playground_dataset_with_patch_revision: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
            }
        }
        payloads: dict[Optional[str], list[Any]] = {}
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            custom_vcr.register_matcher(
                _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
            )  # a custom request matcher is needed since the requests are concurrent
            with custom_vcr.use_cassette(match_on=[_request_bodies_contain_same_city.__name__]):
                async for payload in subscription.stream():
                    if (
                        dataset_example_id := payload["chatCompletionOverDataset"][
                            "datasetExampleId"
                        ]
                    ) not in payloads:
                        payloads[dataset_example_id] = []
                    payloads[dataset_example_id].append(payload)

        # check subscription payloads
        assert len(payloads) == 4
        example_ids = [
            str(GlobalID(type_name=DatasetExample.__name__, node_id=str(index)))
            for index in range(1, 4)
        ]
        assert set(payloads.keys()) == set(example_ids) | {None}

        # gather spans and experiment runs
        subscription_runs = {}
        subscription_spans = {}
        for example_id in example_ids:
            assert (result_payload := payloads[example_id].pop()["chatCompletionOverDataset"])
            assert result_payload.pop("__typename") == ChatCompletionSubscriptionResult.__name__
            assert result_payload.pop("datasetExampleId") == example_id
            subscription_runs[example_id] = result_payload.pop("experimentRun")
            subscription_spans[example_id] = result_payload.pop("span")
            assert not result_payload

        # check example 1 response text
        example_id = example_ids[0]
        assert all(
            payload["chatCompletionOverDataset"]["__typename"] == TextChunk.__name__
            for payload in payloads[example_id]
        )
        response_text = "".join(
            payload["chatCompletionOverDataset"]["content"] for payload in payloads[example_id]
        )
        assert response_text == "France"

        # check example 2 response text
        example_id = example_ids[1]
        assert all(
            payload["chatCompletionOverDataset"]["__typename"] == TextChunk.__name__
            for payload in payloads[example_id]
        )
        response_text = "".join(
            payload["chatCompletionOverDataset"]["content"] for payload in payloads[example_id]
        )
        assert response_text == "Japan"

        # check example 3 error message
        example_id = example_ids[2]
        assert (error_payload := payloads[example_id].pop()["chatCompletionOverDataset"])[
            "__typename"
        ] == ChatCompletionSubscriptionError.__name__
        assert error_payload["message"] == "Missing template variable(s): city"

        # check experiment payload
        assert len(payloads[None]) == 1
        assert (experiment_payload := payloads[None].pop()["chatCompletionOverDataset"])[
            "__typename"
        ] == ChatCompletionSubscriptionExperiment.__name__
        experiment = experiment_payload["experiment"]
        assert (experiment_id := experiment.pop("id"))

        async with db() as session:
            await verify_experiment_examples_junction_table(session, experiment_id)

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription

        # check example 1 span
        example_id = example_ids[0]
        span_id = subscription_spans[example_id]["id"]
        response = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        assert (data := response.data) is not None
        span = data["span"]
        subscription_span = subscription_spans[example_id]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        _assert_spans_equal(span, subscription_span)

        # check example 1 span attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "ChatCompletion"
        assert span.pop("statusCode") == "OK"
        assert not span.pop("statusMessage")
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert context.pop("traceId")
        assert not context
        assert span.pop("metadata") is None
        assert span.pop("numDocuments") == 0
        assert isinstance(token_count_total := span.pop("tokenCountTotal"), int)
        assert isinstance(token_count_prompt := span.pop("tokenCountPrompt"), int)
        assert isinstance(token_count_completion := span.pop("tokenCountCompletion"), int)
        assert token_count_prompt > 0
        assert token_count_completion > 0
        assert token_count_total == token_count_prompt + token_count_completion
        assert (input := span.pop("input")).pop("mimeType") == "json"
        assert (input_value := input.pop("value"))
        assert not input
        assert "api_key" not in input_value
        assert "apiKey" not in input_value
        assert (output := span.pop("output")).pop("mimeType") == "text"
        assert output.pop("value")
        assert not output
        assert not span.pop("events")
        assert isinstance(
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), float
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), float
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), float
        )
        assert cumulative_token_count_total == token_count_total
        assert cumulative_token_count_prompt == token_count_prompt
        assert cumulative_token_count_completion == token_count_completion
        assert span.pop("propagatedStatusCode") == "OK"
        assert not span

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
        assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == token_count_total
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT) == token_count_prompt
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION) == token_count_completion
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ) == 0
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING) == 0
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
        assert attributes.pop(LLM_INPUT_MESSAGES) == [
            {
                "message": {
                    "role": "user",
                    "content": "What country is Paris in? Answer in one word, no punctuation.",
                }
            }
        ]
        assert attributes.pop(LLM_OUTPUT_MESSAGES) == [
            {"message": {"role": "assistant", "content": "France"}}
        ]
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert attributes.pop(PROMPT_TEMPLATE_VARIABLES) == json.dumps({"city": "Paris"})
        assert not attributes

        # check example 2 span
        example_id = example_ids[1]
        span_id = subscription_spans[example_id]["id"]
        response = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        assert (data := response.data) is not None
        span = data["span"]
        subscription_span = subscription_spans[example_id]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        _assert_spans_equal(span, subscription_span)

        # check example 2 span attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "ChatCompletion"
        assert span.pop("statusCode") == "OK"
        assert not span.pop("statusMessage")
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert context.pop("traceId")
        assert not context
        assert span.pop("metadata") is None
        assert span.pop("numDocuments") == 0
        assert isinstance(token_count_total := span.pop("tokenCountTotal"), int)
        assert isinstance(token_count_prompt := span.pop("tokenCountPrompt"), int)
        assert isinstance(token_count_completion := span.pop("tokenCountCompletion"), int)
        assert token_count_prompt > 0
        assert token_count_completion > 0
        assert token_count_total == token_count_prompt + token_count_completion
        assert (input := span.pop("input")).pop("mimeType") == "json"
        assert (input_value := input.pop("value"))
        assert not input
        assert "api_key" not in input_value
        assert "apiKey" not in input_value
        assert (output := span.pop("output")).pop("mimeType") == "text"
        assert output.pop("value")
        assert not output
        assert not span.pop("events")
        assert isinstance(
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), float
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), float
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), float
        )
        assert cumulative_token_count_total == token_count_total
        assert cumulative_token_count_prompt == token_count_prompt
        assert cumulative_token_count_completion == token_count_completion
        assert span.pop("propagatedStatusCode") == "OK"
        assert not span

        assert attributes.pop(OPENINFERENCE_SPAN_KIND) == LLM
        assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
        assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == token_count_total
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT) == token_count_prompt
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION) == token_count_completion
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ) == 0
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING) == 0
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
        assert attributes.pop(LLM_INPUT_MESSAGES) == [
            {
                "message": {
                    "role": "user",
                    "content": "What country is Tokyo in? Answer in one word, no punctuation.",
                }
            }
        ]
        assert attributes.pop(LLM_OUTPUT_MESSAGES) == [
            {"message": {"role": "assistant", "content": "Japan"}}
        ]
        assert attributes.pop(LLM_PROVIDER) == "openai"
        assert attributes.pop(LLM_SYSTEM) == "openai"
        assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
        assert attributes.pop(URL_PATH) == "chat/completions"
        assert attributes.pop(PROMPT_TEMPLATE_VARIABLES) == json.dumps({"city": "Tokyo"})
        assert not attributes

        # check that example 3 has no span
        example_id = example_ids[2]
        assert subscription_spans[example_id] is None

        # check experiment
        response = await gql_client.execute(
            query=self.QUERY,
            variables={"experimentId": experiment_id},
            operation_name="ExperimentQuery",
        )
        assert (data := response.data) is not None
        experiment = data["experiment"]
        assert experiment.pop("id") == experiment_id
        type_name, _ = from_global_id(GlobalID.from_id(experiment_id))
        assert type_name == Experiment.__name__
        assert experiment.pop("name") == "playground-experiment"
        project_name = experiment.pop("projectName")
        assert is_experiment_project_name(project_name)
        assert experiment.pop("metadata") == {}
        assert isinstance(created_at := experiment.pop("createdAt"), str)
        assert isinstance(updated_at := experiment.pop("updatedAt"), str)
        experiment.pop("description")
        assert created_at == updated_at
        runs = {run["run"]["id"]: run["run"] for run in experiment.pop("runs")["edges"]}
        assert len(runs) == 3

        # check example 1 run
        example_id = example_ids[0]
        subscription_run = subscription_runs[example_id]
        run_id = subscription_run["id"]
        run = runs.pop(run_id)
        assert run == subscription_run
        assert run.pop("id") == run_id
        assert isinstance(experiment_id := run.pop("experimentId"), str)
        type_name, _ = from_global_id(GlobalID.from_id(experiment_id))
        assert type_name == Experiment.__name__
        assert datetime.fromisoformat(run.pop("startTime")) <= datetime.fromisoformat(
            run.pop("endTime")
        )
        assert run.pop("error") is None
        assert isinstance(run_output := run.pop("output"), dict)
        assert set(run_output.keys()) == {"messages", "available_tools"}
        assert (trace_id := run.pop("traceId")) is not None
        trace = run.pop("trace")
        assert trace.pop("id")
        assert trace.pop("traceId") == trace_id
        project = trace.pop("project")
        assert project["name"] == project_name
        assert not trace
        assert not run

        # check example 2 run
        example_id = example_ids[1]
        subscription_run = subscription_runs[example_id]
        run_id = subscription_run["id"]
        run = runs.pop(run_id)
        assert run == subscription_run
        assert run.pop("id") == run_id
        assert isinstance(experiment_id := run.pop("experimentId"), str)
        type_name, _ = from_global_id(GlobalID.from_id(experiment_id))
        assert type_name == Experiment.__name__
        assert datetime.fromisoformat(run.pop("startTime")) <= datetime.fromisoformat(
            run.pop("endTime")
        )
        assert run.pop("error") is None
        assert isinstance(run_output := run.pop("output"), dict)
        assert set(run_output.keys()) == {"messages", "available_tools"}
        assert (trace_id := run.pop("traceId")) is not None
        trace = run.pop("trace")
        assert trace.pop("id")
        assert trace.pop("traceId") == trace_id
        project = trace.pop("project")
        assert project["name"] == project_name
        assert not trace
        assert not run

        # check example 3 run
        example_id = example_ids[2]
        subscription_run = subscription_runs[example_id]
        run_id = subscription_run["id"]
        run = runs.pop(run_id)
        assert run == subscription_run
        assert run.pop("id") == run_id
        assert isinstance(experiment_id := run.pop("experimentId"), str)
        type_name, _ = from_global_id(GlobalID.from_id(experiment_id))
        assert type_name == Experiment.__name__
        assert datetime.fromisoformat(run.pop("startTime")) <= datetime.fromisoformat(
            run.pop("endTime")
        )
        assert run.pop("error") == "Missing template variable(s): city"
        assert run.pop("output") is None
        assert run.pop("traceId") is None
        assert run.pop("trace") is None
        assert not run
        assert not runs
        assert not experiment

    async def test_all_spans_yielded_when_number_of_examples_exceeds_batch_size(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        cities_and_countries: list[tuple[str, str]],
        playground_city_and_country_dataset: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": (
                            "What country is {city} in? "
                            "Answer with the country name only without punctuation."
                        ),
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
            }
        }
        payloads: dict[Optional[str], list[Any]] = {}
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            custom_vcr.register_matcher(
                _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
            )  # a custom request matcher is needed since the requests are concurrent
            with custom_vcr.use_cassette(match_on=[_request_bodies_contain_same_city.__name__]):
                async for payload in subscription.stream():
                    if (
                        dataset_example_id := payload["chatCompletionOverDataset"][
                            "datasetExampleId"
                        ]
                    ) not in payloads:
                        payloads[dataset_example_id] = []
                    payloads[dataset_example_id].append(payload)

        # check subscription payloads
        cities_to_countries = dict(cities_and_countries)
        num_examples = len(cities_to_countries)
        example_ids = [
            str(GlobalID(type_name=DatasetExample.__name__, node_id=str(index)))
            for index in range(1, num_examples + 1)
        ]
        assert set(payloads.keys()) == set(example_ids) | {None}

        # check span payloads
        for example_id in example_ids:
            assert (span_payload := payloads[example_id].pop()["chatCompletionOverDataset"])[
                "__typename"
            ] == ChatCompletionSubscriptionResult.__name__
            assert all(
                payload["chatCompletionOverDataset"]["__typename"] == TextChunk.__name__
                for payload in payloads[example_id]
            )
            assert (span := span_payload["span"])
            assert isinstance(span["attributes"], str)
            attributes = json.loads(span["attributes"])
            assert isinstance(
                input_messages := get_attribute_value(attributes, LLM_INPUT_MESSAGES),
                list,
            )
            assert len(input_messages) == 1
            assert isinstance(input_message_content := input_messages[0]["message"]["content"], str)
            assert (city := _extract_city(input_message_content)) in cities_to_countries
            assert isinstance(
                output_messages := get_attribute_value(attributes, LLM_OUTPUT_MESSAGES),
                list,
            )
            assert len(output_messages) == 1
            assert isinstance(
                output_message_content := output_messages[0]["message"]["content"], str
            )
            assert output_message_content == cities_to_countries[city]
            response_text = "".join(
                payload["chatCompletionOverDataset"]["content"] for payload in payloads[example_id]
            )
            assert response_text == output_message_content

        # check experiment payload
        assert len(payloads[None]) == 1
        assert (experiment := payloads[None].pop()["chatCompletionOverDataset"]["experiment"])
        experiment_id = experiment["id"]
        assert isinstance(experiment_id, str)

        async with db() as session:
            await verify_experiment_examples_junction_table(session, experiment_id)

    async def test_experiment_with_single_split_filters_examples(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        playground_dataset_with_splits: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that providing a single split ID filters examples correctly."""
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        train_split_id = str(GlobalID(type_name="DatasetSplit", node_id=str(1)))

        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                "splitIds": [train_split_id],  # Only train split
            }
        }

        payloads: dict[Optional[str], list[Any]] = {}
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            custom_vcr.register_matcher(
                _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
            )
            with custom_vcr.use_cassette(match_on=[_request_bodies_contain_same_city.__name__]):
                async for payload in subscription.stream():
                    if (
                        dataset_example_id := payload["chatCompletionOverDataset"][
                            "datasetExampleId"
                        ]
                    ) not in payloads:
                        payloads[dataset_example_id] = []
                    payloads[dataset_example_id].append(payload)

        # Should only have examples 1, 2, 3 (train split) + experiment payload
        # Examples 4 and 5 (test split) should NOT be present
        train_example_ids = [
            str(GlobalID(type_name=DatasetExample.__name__, node_id=str(i))) for i in range(1, 4)
        ]
        test_example_ids = [
            str(GlobalID(type_name=DatasetExample.__name__, node_id=str(i))) for i in range(4, 6)
        ]

        assert set(payloads.keys()) == set(train_example_ids) | {None}
        for test_id in test_example_ids:
            assert test_id not in payloads, f"Test example {test_id} should not be in results"

        # Verify experiment payload exists
        assert len(payloads[None]) == 1
        assert (experiment_payload := payloads[None][0]["chatCompletionOverDataset"])[
            "__typename"
        ] == ChatCompletionSubscriptionExperiment.__name__
        experiment_id = experiment_payload["experiment"]["id"]

        # Verify experiment has the correct split association in DB
        async with db() as session:
            _, exp_id = from_global_id(GlobalID.from_id(experiment_id))
            result = await session.execute(
                select(models.ExperimentDatasetSplit).where(
                    models.ExperimentDatasetSplit.experiment_id == exp_id
                )
            )
            split_links = result.scalars().all()
            assert len(split_links) == 1
            assert split_links[0].dataset_split_id == 1  # train split

    async def test_experiment_with_multiple_splits(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        playground_dataset_with_splits: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that providing multiple split IDs includes examples from all specified splits."""
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        train_split_id = str(GlobalID(type_name="DatasetSplit", node_id=str(1)))
        test_split_id = str(GlobalID(type_name="DatasetSplit", node_id=str(2)))

        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                "splitIds": [train_split_id, test_split_id],  # Both splits
            }
        }

        payloads: dict[Optional[str], list[Any]] = {}
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            custom_vcr.register_matcher(
                _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
            )
            with custom_vcr.use_cassette(match_on=[_request_bodies_contain_same_city.__name__]):
                async for payload in subscription.stream():
                    if (
                        dataset_example_id := payload["chatCompletionOverDataset"][
                            "datasetExampleId"
                        ]
                    ) not in payloads:
                        payloads[dataset_example_id] = []
                    payloads[dataset_example_id].append(payload)

        # Should have all examples 1-5 + experiment payload
        all_example_ids = [
            str(GlobalID(type_name=DatasetExample.__name__, node_id=str(i))) for i in range(1, 6)
        ]
        assert set(payloads.keys()) == set(all_example_ids) | {None}

        # Verify experiment has both split associations in DB
        assert len(payloads[None]) == 1
        experiment_id = payloads[None][0]["chatCompletionOverDataset"]["experiment"]["id"]

        async with db() as session:
            _, exp_id = from_global_id(GlobalID.from_id(experiment_id))
            result = await session.execute(
                select(models.ExperimentDatasetSplit)
                .where(models.ExperimentDatasetSplit.experiment_id == exp_id)
                .order_by(models.ExperimentDatasetSplit.dataset_split_id)
            )
            split_links = result.scalars().all()
            assert len(split_links) == 2
            assert split_links[0].dataset_split_id == 1  # train split
            assert split_links[1].dataset_split_id == 2  # test split

    async def test_experiment_without_splits_includes_all_examples(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        playground_dataset_with_splits: None,
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test backward compatibility: when no splits are specified, all examples are included."""
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))

        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_id,
                "datasetVersionId": version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                # No splitIds provided
            }
        }

        payloads: dict[Optional[str], list[Any]] = {}
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            custom_vcr.register_matcher(
                _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
            )
            with custom_vcr.use_cassette(match_on=[_request_bodies_contain_same_city.__name__]):
                async for payload in subscription.stream():
                    if (
                        dataset_example_id := payload["chatCompletionOverDataset"][
                            "datasetExampleId"
                        ]
                    ) not in payloads:
                        payloads[dataset_example_id] = []
                    payloads[dataset_example_id].append(payload)

        # Should have all examples 1-5 + experiment payload
        all_example_ids = [
            str(GlobalID(type_name=DatasetExample.__name__, node_id=str(i))) for i in range(1, 6)
        ]
        assert set(payloads.keys()) == set(all_example_ids) | {None}

        # Verify experiment has NO split associations in DB
        assert len(payloads[None]) == 1
        experiment_id = payloads[None][0]["chatCompletionOverDataset"]["experiment"]["id"]

        async with db() as session:
            _, exp_id = from_global_id(GlobalID.from_id(experiment_id))
            result = await session.execute(
                select(models.ExperimentDatasetSplit).where(
                    models.ExperimentDatasetSplit.experiment_id == exp_id
                )
            )
            split_links = result.scalars().all()
            assert len(split_links) == 0  # No splits associated

    async def test_evaluator_emits_evaluation_chunk_and_persists_annotation(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        assign_correctness_llm_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        assign_exact_match_builtin_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        llm_dataset_evaluator = await assign_correctness_llm_evaluator_to_dataset(
            single_example_dataset.id
        )
        llm_evaluator_gid = str(
            GlobalID(
                type_name=LLMEvaluator.__name__, node_id=str(llm_dataset_evaluator.evaluator_id)
            )
        )
        builtin_dataset_evaluator = await assign_exact_match_builtin_evaluator_to_dataset(
            single_example_dataset.id
        )
        builtin_evaluator_gid = str(
            GlobalID(
                type_name=BuiltInEvaluator.__name__,
                node_id=str(builtin_dataset_evaluator.builtin_evaluator_id),
            )
        )

        dataset_gid = str(
            GlobalID(type_name=Dataset.__name__, node_id=str(single_example_dataset.id))
        )
        version_gid = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_gid,
                "datasetVersionId": version_gid,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                "tracingEnabled": True,
                "evaluators": [
                    {
                        "id": llm_evaluator_gid,
                        "name": "correctness",
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    },
                    {
                        "id": builtin_evaluator_gid,
                        "name": "exact-match",
                        "inputMapping": {
                            "literalMapping": {"expected": "France"},
                            "pathMapping": {"actual": "$.output.messages[0].content"},
                        },
                    },
                ],
            }
        }

        payloads: dict[Optional[str], list[Any]] = {}
        evaluation_chunks: list[Any] = []

        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                async for payload in subscription.stream():
                    typename = payload["chatCompletionOverDataset"]["__typename"]
                    if typename == EvaluationChunk.__name__:
                        evaluation_chunks.append(payload["chatCompletionOverDataset"])
                    else:
                        dataset_example_id = payload["chatCompletionOverDataset"][
                            "datasetExampleId"
                        ]
                        if dataset_example_id not in payloads:
                            payloads[dataset_example_id] = []
                        payloads[dataset_example_id].append(payload)

        assert len(evaluation_chunks) == 2
        llm_chunk = next(
            chunk
            for chunk in evaluation_chunks
            if chunk["experimentRunEvaluation"]["name"] == "correctness"
        )
        assert llm_chunk["__typename"] == EvaluationChunk.__name__
        llm_annotation = llm_chunk["experimentRunEvaluation"]
        assert llm_annotation is not None
        assert llm_annotation["annotatorKind"] == "LLM"
        builtin_chunk = next(
            chunk
            for chunk in evaluation_chunks
            if chunk["experimentRunEvaluation"]["name"] == "exact-match"
        )
        assert builtin_chunk["__typename"] == EvaluationChunk.__name__
        builtin_annotation = builtin_chunk["experimentRunEvaluation"]
        assert builtin_annotation is not None
        assert builtin_annotation["annotatorKind"] == "CODE"

        async with db() as session:
            result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = result.scalars().all()
            assert len(annotations) == 2

            llm_annotation_orm = next(
                annotation for annotation in annotations if annotation.name == "correctness"
            )
            assert llm_annotation_orm.annotator_kind == "LLM"
            assert llm_annotation_orm.experiment_run_id is not None

            builtin_annotation_orm = next(
                annotation for annotation in annotations if annotation.name == "exact-match"
            )
            assert builtin_annotation_orm.annotator_kind == "CODE"
            assert builtin_annotation_orm.experiment_run_id is not None

            llm_traces_result = await session.scalars(
                select(models.Trace).where(
                    models.Trace.project_rowid == llm_dataset_evaluator.project_id,
                )
            )
            llm_traces = llm_traces_result.all()
            assert len(llm_traces) == 1
            llm_evaluator_trace = llm_traces[0]

            llm_spans_result = await session.execute(
                select(models.Span).where(
                    models.Span.trace_rowid == llm_evaluator_trace.id,
                )
            )
            llm_spans = llm_spans_result.scalars().all()
            assert len(llm_spans) == 4

            builtin_traces_result = await session.scalars(
                select(models.Trace).where(
                    models.Trace.project_rowid == builtin_dataset_evaluator.project_id,
                )
            )
            builtin_traces = builtin_traces_result.all()
            assert len(builtin_traces) == 1
            builtin_evaluator_trace = builtin_traces[0]

            builtin_spans_result = await session.execute(
                select(models.Span).where(
                    models.Span.trace_rowid == builtin_evaluator_trace.id,
                )
            )
            builtin_spans = builtin_spans_result.scalars().all()
            assert len(builtin_spans) == 4

            # Parse LLM evaluator spans
            llm_evaluator_span = None
            llm_template_span = None
            llm_llm_span = None
            llm_parse_span = None
            for span in llm_spans:
                if span.span_kind == "EVALUATOR":
                    llm_evaluator_span = span
                elif span.span_kind == "TEMPLATE":
                    llm_template_span = span
                elif span.span_kind == "LLM":
                    llm_llm_span = span
                elif span.span_kind == "CHAIN":
                    llm_parse_span = span

            assert llm_evaluator_span is not None
            assert llm_evaluator_span.parent_id is None
            assert llm_template_span is not None
            assert llm_template_span.parent_id == llm_evaluator_span.span_id
            assert llm_llm_span is not None
            assert llm_llm_span.parent_id == llm_evaluator_span.span_id
            assert llm_parse_span is not None
            assert llm_parse_span.parent_id == llm_evaluator_span.span_id

            # LLM evaluator span
            assert llm_evaluator_span.name == "Evaluation: correctness-evaluator"
            assert llm_evaluator_span.span_kind == "EVALUATOR"
            attributes = dict(flatten(llm_evaluator_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
            raw_input_value = attributes.pop(INPUT_VALUE)
            assert raw_input_value is not None
            input_value = json.loads(raw_input_value)
            assert set(input_value.keys()) == {"input", "output", "reference"}
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            raw_output_value = attributes.pop(OUTPUT_VALUE)
            assert raw_output_value is not None
            output_value = json.loads(raw_output_value)
            assert set(output_value.keys()) == {"score", "label", "explanation"}
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes
            assert not llm_evaluator_span.events
            assert llm_evaluator_span.status_code == "OK"
            assert not llm_evaluator_span.status_message

            # template span
            assert llm_template_span.name == "Apply template variables"
            assert llm_template_span.span_kind == "TEMPLATE"
            assert llm_template_span.status_code == "OK"
            assert not llm_template_span.status_message
            assert not llm_template_span.events
            attributes = dict(flatten(llm_template_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "TEMPLATE"
            assert attributes.pop(f"{TEMPLATE_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
            assert (
                attributes.pop(f"{TEMPLATE_MESSAGES}.0.{MESSAGE_CONTENT}")
                == "You are an evaluator that assesses the correctness of outputs."
            )
            assert attributes.pop(f"{TEMPLATE_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
            assert (
                attributes.pop(f"{TEMPLATE_MESSAGES}.1.{MESSAGE_CONTENT}")
                == "Input: {{input}}\n\nOutput: {{output}}\n\nIs this output correct?"
            )
            assert json.loads(attributes.pop(TEMPLATE_PATH_MAPPING)) == {
                "input": "$.input",
                "output": "$.output",
            }
            assert json.loads(attributes.pop(TEMPLATE_LITERAL_MAPPING)) == {}
            variables_value = json.loads(attributes.pop(TEMPLATE_VARIABLES))
            assert variables_value == {
                "input": {"city": "Paris"},
                "output": {
                    "available_tools": [],
                    "messages": [{"content": "France", "role": "assistant"}],
                },
                "reference": {"country": "France"},
            }
            assert attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
            assert (
                attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.0.{MESSAGE_CONTENT}")
                == "You are an evaluator that assesses the correctness of outputs."
            )
            assert attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
            assert attributes.pop(f"{TEMPLATE_FORMATTED_MESSAGES}.1.{MESSAGE_CONTENT}") == (
                "Input: {'city': 'Paris'}\n\n"
                "Output: {'messages': [{'role': 'assistant', 'content': 'France'}], 'available_tools': []}\n\n"
                "Is this output correct?"
            )
            input_value = json.loads(attributes.pop(INPUT_VALUE))
            assert input_value == {
                "variables": {
                    "input": {"city": "Paris"},
                    "output": {
                        "available_tools": [],
                        "messages": [{"content": "France", "role": "assistant"}],
                    },
                    "reference": {"country": "France"},
                },
                "input_mapping": {
                    "path_mapping": {"input": "$.input", "output": "$.output"},
                    "literal_mapping": {},
                },
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            output_value = json.loads(attributes.pop(OUTPUT_VALUE))
            assert output_value == {
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an evaluator that assesses the correctness of outputs.",
                    },
                    {
                        "role": "user",
                        "content": (
                            "Input: {'city': 'Paris'}\n\n"
                            "Output: {'messages': [{'role': 'assistant', 'content': 'France'}], "
                            "'available_tools': []}\n\n"
                            "Is this output correct?"
                        ),
                    },
                ]
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # llm span
            assert llm_llm_span.name == "gpt-4"
            assert llm_llm_span.span_kind == "LLM"
            assert llm_llm_span.status_code == "OK"
            assert not llm_llm_span.status_message
            assert llm_llm_span.llm_token_count_prompt is not None
            assert llm_llm_span.llm_token_count_prompt > 0
            assert llm_llm_span.llm_token_count_completion is not None
            assert llm_llm_span.llm_token_count_completion > 0
            assert llm_llm_span.cumulative_llm_token_count_prompt > 0
            assert llm_llm_span.cumulative_llm_token_count_completion > 0
            attributes = dict(flatten(llm_llm_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "LLM"
            assert attributes.pop(LLM_MODEL_NAME) == "gpt-4"
            assert attributes.pop(LLM_PROVIDER) == "openai"
            assert attributes.pop(LLM_SYSTEM) == "openai"
            assert attributes.pop(URL_FULL) == "https://api.openai.com/v1/chat/completions"
            assert attributes.pop(URL_PATH) == "chat/completions"
            assert attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "system"
            assert (
                "evaluator" in attributes.pop(f"{LLM_INPUT_MESSAGES}.0.{MESSAGE_CONTENT}").lower()
            )
            assert attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_ROLE}") == "user"
            assert "Paris" in attributes.pop(f"{LLM_INPUT_MESSAGES}.1.{MESSAGE_CONTENT}")
            token_count_attribute_keys = [
                attribute_key
                for attribute_key in attributes
                if attribute_key.startswith("llm.token_count.")
            ]
            for key in token_count_attribute_keys:
                assert isinstance(attributes.pop(key), int)
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            raw_output_value = attributes.pop(OUTPUT_VALUE)
            output_value = json.loads(raw_output_value)
            messages = output_value.pop("messages")
            assert not output_value
            assert messages is not None
            assert len(messages) == 1
            message = messages[0]
            assert message.pop("role") == "assistant"
            tool_calls = message.pop("tool_calls")
            assert not message
            assert len(tool_calls) == 1
            tool_call = tool_calls[0]
            assert tool_call.pop("id") == "call_aABUz9QoikDpYXHXhUkahsNF"
            function = tool_call.pop("function")
            assert not tool_call
            assert function.pop("name") == "evaluate_correctness"
            tool_call_arguments = function.pop("arguments")
            assert tool_call_arguments is not None
            assert json.loads(tool_call_arguments) == {
                "label": "incorrect",
            }
            assert not function
            assert attributes.pop(f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}") == "assistant"
            assert isinstance(
                attributes.pop(
                    f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_ID}"
                ),
                str,
            )
            assert (
                attributes.pop(
                    f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_NAME}"
                )
                == "evaluate_correctness"
            )
            arguments = attributes.pop(
                f"{LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_TOOL_CALLS}.0.{TOOL_CALL_FUNCTION_ARGUMENTS}"
            )
            assert arguments is not None
            assert json.loads(arguments) == {"label": "incorrect"}
            assert not attributes

            # span costs for evaluator trace
            span_costs_result = await session.execute(
                select(models.SpanCost).where(models.SpanCost.trace_rowid == llm_evaluator_trace.id)
            )
            span_costs = span_costs_result.scalars().all()
            assert len(span_costs) == 1
            span_cost = span_costs[0]
            assert span_cost.span_rowid == llm_llm_span.id
            assert span_cost.trace_rowid == llm_llm_span.trace_rowid
            assert span_cost.model_id is not None
            assert span_cost.span_start_time == llm_llm_span.start_time
            assert span_cost.total_cost is not None
            assert span_cost.total_cost > 0
            assert span_cost.total_tokens == (
                llm_llm_span.llm_token_count_prompt + llm_llm_span.llm_token_count_completion
            )
            assert span_cost.prompt_tokens == llm_llm_span.llm_token_count_prompt
            assert span_cost.prompt_cost is not None
            assert span_cost.prompt_cost > 0
            assert span_cost.completion_tokens == llm_llm_span.llm_token_count_completion
            assert span_cost.completion_cost is not None
            assert span_cost.completion_cost > 0

            # span cost details for evaluator trace
            span_cost_details_result = await session.execute(
                select(models.SpanCostDetail).where(
                    models.SpanCostDetail.span_cost_id == span_cost.id
                )
            )
            span_cost_details = span_cost_details_result.scalars().all()
            assert len(span_cost_details) >= 2
            input_detail = next(
                d for d in span_cost_details if d.is_prompt and d.token_type == "input"
            )
            output_detail = next(
                d for d in span_cost_details if not d.is_prompt and d.token_type == "output"
            )
            assert input_detail.span_cost_id == span_cost.id
            assert input_detail.token_type == "input"
            assert input_detail.is_prompt is True
            assert input_detail.tokens == llm_llm_span.llm_token_count_prompt
            assert input_detail.cost is not None
            assert input_detail.cost > 0
            assert input_detail.cost_per_token is not None
            assert output_detail.span_cost_id == span_cost.id
            assert output_detail.token_type == "output"
            assert output_detail.is_prompt is False
            assert output_detail.tokens == llm_llm_span.llm_token_count_completion
            assert output_detail.cost is not None
            assert output_detail.cost > 0
            assert output_detail.cost_per_token is not None

            # chain span
            assert llm_parse_span.name == "Parse eval result"
            assert llm_parse_span.span_kind == "CHAIN"
            assert llm_parse_span.status_code == "OK"
            assert not llm_parse_span.status_message
            assert not llm_parse_span.events
            attributes = dict(flatten(llm_parse_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
            input_value = json.loads(attributes.pop(INPUT_VALUE))
            assert set(input_value.keys()) == {"tool_calls", "output_config"}
            tool_calls = input_value["tool_calls"]
            assert len(tool_calls) == 1
            tool_call = next(iter(tool_calls.values()))
            assert tool_call["name"] == "evaluate_correctness"
            assert input_value["output_config"] == {
                "values": [
                    {"label": "correct", "score": 1.0},
                    {"label": "incorrect", "score": 0.0},
                ]
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            output_value = json.loads(attributes.pop(OUTPUT_VALUE))
            assert output_value == {"label": "incorrect", "score": 0.0, "explanation": None}
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # built-in evaluator spans
            builtin_evaluator_span = None
            builtin_template_span = None
            builtin_execution_span = None
            builtin_parse_span = None
            for span in builtin_spans:
                if span.span_kind == "EVALUATOR":
                    builtin_evaluator_span = span
                elif span.span_kind == "TEMPLATE":
                    builtin_template_span = span
                elif span.span_kind == "CHAIN":
                    if "Run" in span.name:
                        builtin_execution_span = span
                    elif "Parse" in span.name:
                        builtin_parse_span = span

            assert builtin_evaluator_span is not None
            assert builtin_template_span is not None
            assert builtin_execution_span is not None
            assert builtin_parse_span is not None

            # Verify span hierarchy
            assert builtin_evaluator_span.parent_id is None
            assert builtin_template_span.parent_id == builtin_evaluator_span.span_id
            assert builtin_execution_span.parent_id == builtin_evaluator_span.span_id
            assert builtin_parse_span.parent_id == builtin_evaluator_span.span_id

            # Built-in evaluator span
            assert builtin_evaluator_span.name == "Evaluation: ExactMatch"
            assert builtin_evaluator_span.span_kind == "EVALUATOR"
            assert builtin_evaluator_span.status_code == "OK"
            assert not builtin_evaluator_span.status_message
            assert not builtin_evaluator_span.events
            attributes = dict(flatten(builtin_evaluator_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "EVALUATOR"
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "input": {"city": "Paris"},
                "output": {
                    "messages": [{"role": "assistant", "content": "France"}],
                    "available_tools": [],
                },
                "reference": {"country": "France"},
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "label": "true",
                "score": 1.0,
                "explanation": "expected matches actual",
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # Built-in template span (Apply input mapping)
            assert builtin_template_span.name == "Apply input mapping"
            assert builtin_template_span.span_kind == "TEMPLATE"
            assert builtin_template_span.status_code == "OK"
            assert not builtin_template_span.status_message
            assert not builtin_template_span.events
            attributes = dict(flatten(builtin_template_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "TEMPLATE"
            assert json.loads(attributes.pop(TEMPLATE_PATH_MAPPING)) == {
                "actual": "$.output.messages[0].content",
            }
            assert json.loads(attributes.pop(TEMPLATE_LITERAL_MAPPING)) == {"expected": "France"}
            assert json.loads(attributes.pop(TEMPLATE_VARIABLES)) == {
                "input": {"city": "Paris"},
                "output": {
                    "messages": [{"role": "assistant", "content": "France"}],
                    "available_tools": [],
                },
                "reference": {"country": "France"},
            }
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "variables": {
                    "input": {"city": "Paris"},
                    "output": {
                        "messages": [{"role": "assistant", "content": "France"}],
                        "available_tools": [],
                    },
                    "reference": {"country": "France"},
                },
                "input_mapping": {
                    "path_mapping": {"actual": "$.output.messages[0].content"},
                    "literal_mapping": {"expected": "France"},
                },
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "inputs": {"expected": "France", "actual": "France"},
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # Built-in execution span (Run ExactMatch)
            assert builtin_execution_span.name == "Run ExactMatch"
            assert builtin_execution_span.span_kind == "CHAIN"
            assert builtin_execution_span.status_code == "OK"
            assert not builtin_execution_span.status_message
            assert not builtin_execution_span.events
            attributes = dict(flatten(builtin_execution_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "expected": "France",
                "actual": "France",
                "case_sensitive": True,
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {
                "matched": True,
                "explanation": "expected matches actual",
            }
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

            # Built-in parse span (Parse eval result)
            assert builtin_parse_span.name == "Parse eval result"
            assert builtin_parse_span.span_kind == "CHAIN"
            assert not builtin_parse_span.status_message
            assert not builtin_parse_span.events
            attributes = dict(flatten(builtin_parse_span.attributes, recurse_on_sequence=True))
            assert attributes.pop(OPENINFERENCE_SPAN_KIND) == "CHAIN"
            assert json.loads(attributes.pop(INPUT_VALUE)) == {
                "matched": True,
                "explanation": "expected matches actual",
            }
            assert attributes.pop(INPUT_MIME_TYPE) == "application/json"
            assert json.loads(attributes.pop(OUTPUT_VALUE)) == {"label": "true", "score": 1.0}
            assert attributes.pop(OUTPUT_MIME_TYPE) == "application/json"
            assert not attributes

    async def test_evaluator_not_emitted_when_task_errors(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        assign_correctness_llm_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        dataset_evaluator = await assign_correctness_llm_evaluator_to_dataset(
            single_example_dataset.id
        )
        evaluator_gid = str(
            GlobalID(type_name=LLMEvaluator.__name__, node_id=str(dataset_evaluator.evaluator_id))
        )
        dataset_gid = str(
            GlobalID(type_name=Dataset.__name__, node_id=str(single_example_dataset.id))
        )
        version_gid = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        variables = {
            "input": {
                "model": {
                    "builtin": {
                        "providerKey": "OPENAI",
                        "name": "gpt-nonexistent-model",  # non-existent model triggers an error
                    }
                },
                "datasetId": dataset_gid,
                "datasetVersionId": version_gid,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "name": "correctness",
                        "inputMapping": {
                            "pathMapping": {
                                "input": "$.input",
                                "output": "$.output",
                            },
                        },
                    }
                ],
            }
        }

        error_chunks: list[Any] = []
        evaluation_chunks: list[Any] = []

        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                async for payload in subscription.stream():
                    typename = payload["chatCompletionOverDataset"]["__typename"]
                    if typename == ChatCompletionSubscriptionError.__name__:
                        error_chunks.append(payload["chatCompletionOverDataset"])
                    elif typename == EvaluationChunk.__name__:
                        evaluation_chunks.append(payload["chatCompletionOverDataset"])

        # Verify we got an error chunk
        assert len(error_chunks) == 1
        assert "model" in error_chunks[0]["message"].lower()

        # Verify no evaluation chunks were emitted
        assert len(evaluation_chunks) == 0

        # Verify no experiment run annotations were persisted
        async with db() as session:
            result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = result.scalars().all()
            assert len(annotations) == 0

    async def test_builtin_evaluator_uses_name(
        self,
        gql_client: AsyncGraphQLClient,
        openai_api_key: str,
        single_example_dataset: models.Dataset,
        assign_exact_match_builtin_evaluator_to_dataset: Callable[
            [int], Awaitable[models.DatasetEvaluators]
        ],
        custom_vcr: CustomVCR,
        db: DbSessionFactory,
    ) -> None:
        """Test that builtin evaluators use name for annotation names in dataset runs."""
        builtin_dataset_evaluator = await assign_exact_match_builtin_evaluator_to_dataset(
            single_example_dataset.id
        )
        evaluator_gid = str(
            GlobalID(
                type_name=BuiltInEvaluator.__name__,
                node_id=str(builtin_dataset_evaluator.builtin_evaluator_id),
            )
        )
        custom_name = "my-dataset-exact-match"
        dataset_gid = str(
            GlobalID(type_name=Dataset.__name__, node_id=str(single_example_dataset.id))
        )
        version_gid = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        variables = {
            "input": {
                "model": {"builtin": {"providerKey": "OPENAI", "name": "gpt-4"}},
                "datasetId": dataset_gid,
                "datasetVersionId": version_gid,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateFormat": "F_STRING",
                "repetitions": 1,
                "evaluators": [
                    {
                        "id": evaluator_gid,
                        "name": custom_name,
                        "inputMapping": {
                            "literalMapping": {
                                "expected": "test",
                                "actual": "test",
                            },
                        },
                    }
                ],
            }
        }

        evaluation_chunks: list[Any] = []

        custom_vcr.register_matcher(
            _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
        )
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            with custom_vcr.use_cassette():
                async for payload in subscription.stream():
                    typename = payload["chatCompletionOverDataset"]["__typename"]
                    if typename == EvaluationChunk.__name__:
                        evaluation_chunks.append(payload["chatCompletionOverDataset"])

        # Verify we got exactly 1 evaluation chunk with custom display name
        assert len(evaluation_chunks) == 1
        eval_chunk = evaluation_chunks[0]
        eval_annotation = eval_chunk["experimentRunEvaluation"]
        assert eval_annotation["name"] == custom_name
        assert eval_annotation["annotatorKind"] == "CODE"

        # Verify experiment run annotation was persisted with name
        async with db() as session:
            result = await session.execute(select(models.ExperimentRunAnnotation))
            annotations = result.scalars().all()
            assert len(annotations) == 1

            annotation = annotations[0]
            assert annotation.name == custom_name
            assert annotation.annotator_kind == "CODE"


def _request_bodies_contain_same_city(request1: VCRRequest, request2: VCRRequest) -> None:
    assert _extract_city(request1.body.decode()) == _extract_city(request2.body.decode())


def _extract_city(body: str) -> str:
    if match := re.search(r"What country is (\w+) in\?", body):
        return match.group(1)
    raise ValueError(f"Could not extract city from body: {body}")


# span kind values
LLM = OpenInferenceSpanKindValues.LLM.value
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

# message attributes
MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE


# span attributes
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_SYSTEM = SpanAttributes.LLM_SYSTEM
LLM_INVOCATION_PARAMETERS = SpanAttributes.LLM_INVOCATION_PARAMETERS
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ = SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ
LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING = (
    SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING
)
LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO = SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO
LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_TOOLS = SpanAttributes.LLM_TOOLS
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES

# tool call attributes
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_ARGUMENTS = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
