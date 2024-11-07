import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pytest
import pytz
import vcr
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    ChatCompletionSubscriptionExperiment,
    ChatCompletionSubscriptionSpan,
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.api.types.node import from_global_id
from phoenix.server.types import DbSessionFactory
from phoenix.trace.attributes import flatten, get_attribute_value


def remove_all_vcr_request_headers(request: Any) -> Any:
    """
    Removes all request headers.

    Example:
    ```
    @pytest.mark.vcr(
        before_record_response=remove_all_vcr_request_headers
    )
    def test_openai() -> None:
        # make request to OpenAI
    """
    request.headers.clear()
    return request


def remove_all_vcr_response_headers(response: dict[str, Any]) -> dict[str, Any]:
    """
    Removes all response headers.

    Example:
    ```
    @pytest.mark.vcr(
        before_record_response=remove_all_vcr_response_headers
    )
    def test_openai() -> None:
        # make request to OpenAI
    """
    response["headers"] = {}
    return response


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
          ... on ChatCompletionSubscriptionSpan {
            span {
              ...SpanFragment
            }
          }
          ... on ChatCompletionSubscriptionError {
            message
          }
        }
      }

      query SpanQuery($spanId: GlobalID!) {
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
        gql_client: Any,
        openai_api_key: str,
    ) -> None:
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "Who won the World Cup in 2018? Answer in one word",
                    }
                ],
                "model": {"name": "gpt-4", "providerKey": "OPENAI"},
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.1},
                ],
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with vcr.use_cassette(
                Path(__file__).parent / "cassettes/test_subscriptions/"
                "TestChatCompletionSubscription.test_openai_text_response_emits_expected_payloads_and_records_expected_span[sqlite].yaml",
                decode_compressed_response=True,
                before_record_request=remove_all_vcr_request_headers,
                before_record_response=remove_all_vcr_response_headers,
            ):
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionSpan.__name__
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
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        assert span == subscription_span

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
        assert span.pop("numDocuments") is None
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
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), int
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), int
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), int
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
        assert not attributes

    async def test_openai_emits_expected_payloads_and_records_expected_span_on_error(
        self,
        gql_client: Any,
        openai_api_key: str,
    ) -> None:
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "Who won the World Cup in 2018? Answer in one word",
                    }
                ],
                "model": {"name": "gpt-4", "providerKey": "OPENAI"},
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.1},
                ],
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with vcr.use_cassette(
                Path(__file__).parent / "cassettes/test_subscriptions/"
                "TestChatCompletionSubscription.test_openai_emits_expected_payloads_and_records_expected_span_on_error[sqlite].yaml",
                decode_compressed_response=True,
                before_record_request=remove_all_vcr_request_headers,
                before_record_response=remove_all_vcr_response_headers,
            ):
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
        ] == ChatCompletionSubscriptionSpan.__name__
        subscription_span = last_payload["chatCompletion"]["span"]
        span_id = subscription_span["id"]

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        assert span == subscription_span

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
        assert span.pop("numDocuments") is None
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
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), int
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), int
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), int
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
        assert not attributes

    async def test_openai_tool_call_response_emits_expected_payloads_and_records_expected_span(
        self,
        gql_client: Any,
        openai_api_key: str,
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
                "model": {"name": "gpt-4", "providerKey": "OPENAI"},
                "tools": [get_current_weather_tool_schema],
                "invocationParameters": [
                    {"invocationName": "tool_choice", "valueJson": "auto"},
                ],
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with vcr.use_cassette(
                Path(__file__).parent / "cassettes/test_subscriptions/"
                "TestChatCompletionSubscription.test_openai_tool_call_response_emits_expected_payloads_and_records_expected_span[sqlite].yaml",
                decode_compressed_response=True,
                before_record_request=remove_all_vcr_request_headers,
                before_record_response=remove_all_vcr_response_headers,
            ):
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionSpan.__name__
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
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        assert span == subscription_span

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
        assert span.pop("numDocuments") is None
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
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), int
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), int
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), int
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
        assert not attributes

    async def test_openai_tool_call_messages_emits_expected_payloads_and_records_expected_span(
        self,
        gql_client: Any,
        openai_api_key: str,
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
                "model": {"name": "gpt-4", "providerKey": "OPENAI"},
            }
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with vcr.use_cassette(
                Path(__file__).parent / "cassettes/test_subscriptions/"
                "TestChatCompletionSubscription.test_openai_tool_call_messages_emits_expected_payloads_and_records_expected_span[sqlite].yaml",
                decode_compressed_response=True,
                before_record_request=remove_all_vcr_request_headers,
                before_record_response=remove_all_vcr_response_headers,
            ):
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionSpan.__name__
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
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        assert span == subscription_span

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
        assert span.pop("numDocuments") is None
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
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), int
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), int
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), int
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
                    "function": {
                        "name": "get_weather",
                        "arguments": '"{\\n    \\"city\\": \\"San Francisco\\"\\n}"',
                    }
                }
            }
        ]
        llm_input_message = llm_input_messages[2]["message"]
        assert llm_input_message == {"content": "sunny", "role": "tool"}
        assert attributes.pop(LLM_OUTPUT_MESSAGES) == [
            {
                "message": {
                    "role": "assistant",
                    "content": response_text,
                }
            }
        ]
        assert not attributes

    async def test_anthropic_text_response_emits_expected_payloads_and_records_expected_span(
        self,
        gql_client: Any,
        anthropic_api_key: str,
    ) -> None:
        variables = {
            "input": {
                "messages": [
                    {
                        "role": "USER",
                        "content": "Who won the World Cup in 2018? Answer in one word",
                    }
                ],
                "model": {"name": "claude-3-5-sonnet-20240620", "providerKey": "ANTHROPIC"},
                "invocationParameters": [
                    {"invocationName": "temperature", "valueFloat": 0.1},
                    {"invocationName": "max_tokens", "valueInt": 1024},
                ],
            },
        }
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionSubscription",
        ) as subscription:
            with vcr.use_cassette(
                Path(__file__).parent / "cassettes/test_subscriptions/"
                "TestChatCompletionSubscription.test_anthropic_text_response_emits_expected_payloads_and_records_expected_span[sqlite].yaml",
                decode_compressed_response=True,
                before_record_request=remove_all_vcr_request_headers,
                before_record_response=remove_all_vcr_response_headers,
            ):
                payloads = [payload async for payload in subscription.stream()]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["chatCompletion"][
            "__typename"
        ] == ChatCompletionSubscriptionSpan.__name__
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
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        assert span == subscription_span

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
        assert span.pop("numDocuments") is None
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
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), int
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), int
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), int
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
        assert not attributes


class TestChatCompletionOverDatasetSubscription:
    QUERY = """
      subscription ChatCompletionOverDatasetSubscription($input: ChatCompletionOverDatasetInput!) {
        chatCompletionOverDataset(input: $input) {
          __typename
          datasetExampleId
          ... on TextChunk {
            content
          }
          ... on ChatCompletionSubscriptionSpan {
            span {
              ...SpanFragment
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
        }
      }

      query SpanQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          ... on Span {
            ...SpanFragment
          }
        }
      }

      query ExperimentQuery($experimentId: GlobalID!) {
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
                  }
                }
              }
            }
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
        gql_client: Any,
        openai_api_key: str,
        playground_dataset_with_patch_revision: None,
    ) -> None:
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        variables = {
            "input": {
                "model": {"providerKey": "OPENAI", "name": "gpt-4"},
                "datasetId": dataset_id,
                "datasetVersionId": version_id,
                "messages": [
                    {
                        "role": "USER",
                        "content": "What country is {city} in? Answer in one word, no punctuation.",
                    }
                ],
                "templateLanguage": "F_STRING",
            }
        }
        payloads: dict[Optional[str], list[Any]] = {}
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            custom_vcr = vcr.VCR()
            custom_vcr.register_matcher(
                _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
            )  # a custom request matcher is needed since the requests are concurrent
            with custom_vcr.use_cassette(
                Path(__file__).parent / "cassettes/test_subscriptions/"
                "TestChatCompletionOverDatasetSubscription.test_emits_expected_payloads_and_records_expected_spans_and_experiment[sqlite].yaml",
                decode_compressed_response=True,
                before_record_request=remove_all_vcr_request_headers,
                before_record_response=remove_all_vcr_response_headers,
                match_on=[_request_bodies_contain_same_city.__name__],
            ):
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
        example_id_1, example_id_2, example_id_3 = [
            str(GlobalID(type_name=DatasetExample.__name__, node_id=str(index)))
            for index in range(1, 4)
        ]
        assert set(payloads.keys()) == {example_id_1, example_id_2, example_id_3, None}

        # check example 1 payloads
        assert (last_example_1_payload := payloads[example_id_1].pop())[
            "chatCompletionOverDataset"
        ]["__typename"] == ChatCompletionSubscriptionSpan.__name__
        assert all(
            payload["chatCompletionOverDataset"]["__typename"] == TextChunk.__name__
            for payload in payloads[example_id_1]
        )
        example_1_response_text = "".join(
            payload["chatCompletionOverDataset"]["content"] for payload in payloads[example_id_1]
        )
        assert example_1_response_text == "France"
        example_1_subscription_span = last_example_1_payload["chatCompletionOverDataset"]["span"]
        example_1_span_id = example_1_subscription_span["id"]

        # check example 2 payloads
        assert (last_example_2_payload := payloads[example_id_2].pop())[
            "chatCompletionOverDataset"
        ]["__typename"] == ChatCompletionSubscriptionSpan.__name__
        assert all(
            payload["chatCompletionOverDataset"]["__typename"] == TextChunk.__name__
            for payload in payloads[example_id_2]
        )
        example_2_response_text = "".join(
            payload["chatCompletionOverDataset"]["content"] for payload in payloads[example_id_2]
        )
        assert example_2_response_text == "Japan"
        example_2_subscription_span = last_example_2_payload["chatCompletionOverDataset"]["span"]
        example_2_span_id = example_2_subscription_span["id"]

        # check example 3 payloads
        assert len(payloads[example_id_3]) == 1
        assert (error_payload := payloads[example_id_3].pop()["chatCompletionOverDataset"])[
            "__typename"
        ] == ChatCompletionSubscriptionError.__name__
        assert error_payload["message"] == "Missing template variable(s): city"

        # check result payload
        assert len(payloads[None]) == 1
        assert (result_payload := payloads[None].pop()["chatCompletionOverDataset"])[
            "__typename"
        ] == ChatCompletionSubscriptionExperiment.__name__
        experiment = result_payload["experiment"]
        assert (experiment_id := experiment.pop("id"))

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription

        # check example 1 span
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": example_1_span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            example_1_subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        assert span == example_1_subscription_span

        # check example 1 span attributes
        assert span.pop("id") == example_1_span_id
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
        assert span.pop("numDocuments") is None
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
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), int
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), int
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), int
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
        assert not attributes

        # check example 2 span
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": example_2_span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert json.loads(attributes := span.pop("attributes")) == json.loads(
            example_2_subscription_span.pop("attributes")
        )
        attributes = dict(flatten(json.loads(attributes)))
        assert span == example_2_subscription_span

        # check example 2 span attributes
        assert span.pop("id") == example_2_span_id
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
        assert span.pop("numDocuments") is None
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
            cumulative_token_count_total := span.pop("cumulativeTokenCountTotal"), int
        )
        assert isinstance(
            cumulative_token_count_prompt := span.pop("cumulativeTokenCountPrompt"), int
        )
        assert isinstance(
            cumulative_token_count_completion := span.pop("cumulativeTokenCountCompletion"), int
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
        assert not attributes

        # check experiment
        data = await gql_client.execute(
            query=self.QUERY,
            variables={"experimentId": experiment_id},
            operation_name="ExperimentQuery",
        )
        experiment = data["experiment"]
        assert experiment.pop("id") == experiment_id
        type_name, _ = from_global_id(GlobalID.from_id(experiment_id))
        assert type_name == Experiment.__name__
        assert experiment.pop("name") == "playground-experiment"
        assert isinstance(experiment_description := experiment.pop("description"), str)
        assert "dataset-name" in experiment_description
        assert experiment.pop("metadata") == {
            "dataset_name": "dataset-name",
            "dataset_id": str(dataset_id),
            "dataset_version_id": str(version_id),
        }
        assert experiment.pop("projectName") == "playground"
        assert isinstance(created_at := experiment.pop("createdAt"), str)
        assert isinstance(updated_at := experiment.pop("updatedAt"), str)
        assert created_at == updated_at
        runs = [run["run"] for run in experiment.pop("runs")["edges"]]
        assert len(runs) == 2

        # check run 1
        run = runs.pop(0)
        assert run.pop("id")
        assert isinstance(experiment_id := run.pop("experimentId"), str)
        type_name, _ = from_global_id(GlobalID.from_id(experiment_id))
        assert type_name == Experiment.__name__
        assert datetime.fromisoformat(run.pop("startTime")) < datetime.fromisoformat(
            run.pop("endTime")
        )
        assert run.pop("error") is None
        assert isinstance(run_1_output := run.pop("output"), list)
        assert len(run_1_output) == 1
        assert (trace_id := run.pop("traceId")) is not None
        trace = run.pop("trace")
        assert trace.pop("id")
        assert trace.pop("traceId") == trace_id
        assert not trace
        assert not run

        # check run 2
        run = runs.pop()
        assert run.pop("id")
        assert isinstance(experiment_id := run.pop("experimentId"), str)
        type_name, _ = from_global_id(GlobalID.from_id(experiment_id))
        assert type_name == Experiment.__name__
        assert datetime.fromisoformat(run.pop("startTime")) < datetime.fromisoformat(
            run.pop("endTime")
        )
        assert run.pop("error") is None
        assert isinstance(run_2_output := run.pop("output"), list)
        assert len(run_2_output) == 1
        assert (trace_id := run.pop("traceId")) is not None
        trace = run.pop("trace")
        assert trace.pop("id")
        assert trace.pop("traceId") == trace_id
        assert not trace
        assert not run
        assert not runs
        assert not experiment

        # check run outputs
        assert (run_1_output_message := run_1_output[0]["message"])["role"] == "assistant"
        assert (run_2_output_message := run_2_output[0]["message"])["role"] == "assistant"
        assert {run_1_output_message["content"], run_2_output_message["content"]} == {
            "France",
            "Japan",
        }

    async def test_all_spans_yielded_when_number_of_examples_exceeds_batch_size(
        self,
        gql_client: Any,
        openai_api_key: str,
        cities_and_countries: list[tuple[str, str]],
        playground_city_and_country_dataset: None,
    ) -> None:
        dataset_id = str(GlobalID(type_name=Dataset.__name__, node_id=str(1)))
        version_id = str(GlobalID(type_name=DatasetVersion.__name__, node_id=str(1)))
        variables = {
            "input": {
                "model": {"providerKey": "OPENAI", "name": "gpt-4"},
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
                "templateLanguage": "F_STRING",
            }
        }
        payloads: dict[Optional[str], list[Any]] = {}
        async with gql_client.subscription(
            query=self.QUERY,
            variables=variables,
            operation_name="ChatCompletionOverDatasetSubscription",
        ) as subscription:
            custom_vcr = vcr.VCR()
            custom_vcr.register_matcher(
                _request_bodies_contain_same_city.__name__, _request_bodies_contain_same_city
            )  # a custom request matcher is needed since the requests are concurrent
            with custom_vcr.use_cassette(
                Path(__file__).parent / "cassettes/test_subscriptions/"
                "TestChatCompletionOverDatasetSubscription.test_all_spans_yielded_when_number_of_examples_exceeds_batch_size[sqlite].yaml",
                decode_compressed_response=True,
                before_record_request=remove_all_vcr_request_headers,
                before_record_response=remove_all_vcr_response_headers,
                match_on=[_request_bodies_contain_same_city.__name__],
            ):
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
            ] == ChatCompletionSubscriptionSpan.__name__
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
        assert isinstance(experiment["id"], str)


def _request_bodies_contain_same_city(
    request1: vcr.request.Request, request2: vcr.request.Request
) -> None:
    assert _extract_city(request1.body.decode()) == _extract_city(request2.body.decode())


def _extract_city(body: str) -> str:
    if match := re.search(r"What country is (\w+) in\?", body):
        return match.group(1)
    raise ValueError(f"Could not extract city from body: {body}")


@pytest.fixture
async def playground_dataset_with_patch_revision(db: DbSessionFactory) -> None:
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    patched.
    """
    dataset = models.Dataset(
        id=1,
        name="dataset-name",
        metadata_={},
    )
    versions = [
        models.DatasetVersion(
            id=1,
            dataset_id=dataset.id,
            metadata_={},
        ),
        models.DatasetVersion(
            id=2,
            dataset_id=dataset.id,
            metadata_={},
        ),
    ]
    examples = [
        models.DatasetExample(
            id=1,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        ),
        models.DatasetExample(
            id=2,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=2, day=2, hour=0, minute=0, tzinfo=pytz.utc),
        ),
        models.DatasetExample(
            id=3,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=2, day=3, hour=0, minute=0, tzinfo=pytz.utc),
        ),
    ]
    revisions = [
        models.DatasetExampleRevision(
            dataset_example_id=examples[0].id,
            dataset_version_id=versions[0].id,
            input={"city": "Paris"},
            output={},
            metadata_={},
            revision_kind="CREATE",
        ),
        models.DatasetExampleRevision(
            dataset_example_id=examples[1].id,
            dataset_version_id=versions[0].id,
            input={"city": "Tokyo"},
            output={},
            metadata_={},
            revision_kind="CREATE",
        ),
        models.DatasetExampleRevision(
            dataset_example_id=examples[0].id,
            dataset_version_id=versions[1].id,
            input={"city": "Cairo"},
            output={},
            metadata_={},
            revision_kind="CREATE",
        ),
        models.DatasetExampleRevision(
            dataset_example_id=examples[2].id,
            dataset_version_id=versions[0].id,
            input={"cities": "Madrid"},
            output={},
            metadata_={},
            revision_kind="PATCH",
        ),
    ]
    async with db() as session:
        session.add(dataset)
        await session.flush()
        session.add_all(versions)
        await session.flush()
        session.add_all(examples)
        await session.flush()
        session.add_all(revisions)
        await session.flush()


@pytest.fixture
def cities_and_countries() -> list[tuple[str, str]]:
    return [
        ("Toronto", "Canada"),
        ("Vancouver", "Canada"),
        ("Paris", "France"),
        ("Lyon", "France"),
        ("Berlin", "Germany"),
        ("Munich", "Germany"),
        ("Tokyo", "Japan"),
        ("Osaka", "Japan"),
        ("Sydney", "Australia"),
        ("Melbourne", "Australia"),
        ("Guadalajara", "Mexico"),
        ("Moscow", "Russia"),
        ("Beijing", "China"),
        ("Shanghai", "China"),
        ("Mumbai", "India"),
        ("Delhi", "India"),
        ("Seoul", "South Korea"),
        ("Busan", "South Korea"),
    ]


@pytest.fixture
async def playground_city_and_country_dataset(
    cities_and_countries: list[tuple[str, str]], db: DbSessionFactory
) -> None:
    """
    A dataset with many example.
    """
    dataset = models.Dataset(
        id=1,
        name="dataset-name",
        metadata_={},
    )
    version = models.DatasetVersion(
        id=1,
        dataset_id=dataset.id,
        metadata_={},
    )
    examples = [
        models.DatasetExample(
            id=example_id,
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        for example_id in range(1, len(cities_and_countries) + 1)
    ]
    revisions = [
        models.DatasetExampleRevision(
            dataset_example_id=example.id,
            dataset_version_id=version.id,
            input={"city": city},
            output={"country": country},
            metadata_={},
            revision_kind="CREATE",
        )
        for example, (city, country) in zip(examples, cities_and_countries)
    ]
    async with db() as session:
        session.add(dataset)
        await session.flush()
        session.add(version)
        await session.flush()
        session.add_all(examples)
        await session.flush()
        session.add_all(revisions)
        await session.flush()


LLM = OpenInferenceSpanKindValues.LLM.value
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_INVOCATION_PARAMETERS = SpanAttributes.LLM_INVOCATION_PARAMETERS
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_TOOLS = SpanAttributes.LLM_TOOLS
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
