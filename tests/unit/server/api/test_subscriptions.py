import json
from datetime import datetime
from pathlib import Path
from typing import Any

from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from vcr import use_cassette

from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionError,
    FinishedChatCompletion,
    TextChunk,
    ToolCallChunk,
)
from phoenix.trace.attributes import flatten


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
          ... on FinishedChatCompletion {
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
            with use_cassette(
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
        ] == FinishedChatCompletion.__name__
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
        assert attributes.pop(LLM_INVOCATION_PARAMETERS) == json.dumps({"temperature": 0.1})
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
            with use_cassette(
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
        ] == FinishedChatCompletion.__name__
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
            with use_cassette(
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
        ] == FinishedChatCompletion.__name__
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
            with use_cassette(
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
        ] == FinishedChatCompletion.__name__
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
        assert attributes.pop(LLM_INVOCATION_PARAMETERS) == json.dumps({})
        assert attributes.pop(LLM_TOKEN_COUNT_TOTAL) == token_count_total
        assert attributes.pop(LLM_TOKEN_COUNT_PROMPT) == token_count_prompt
        assert attributes.pop(LLM_TOKEN_COUNT_COMPLETION) == token_count_completion
        assert attributes.pop(INPUT_VALUE)
        assert attributes.pop(INPUT_MIME_TYPE) == JSON
        assert attributes.pop(OUTPUT_VALUE)
        assert attributes.pop(OUTPUT_MIME_TYPE) == JSON
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
            with use_cassette(
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
        ] == FinishedChatCompletion.__name__
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
        assert attributes.pop(LLM_MODEL_NAME) == "claude-3-5-sonnet-20240620"
        assert attributes.pop(LLM_INVOCATION_PARAMETERS) == json.dumps(
            {"temperature": 0.1, "max_tokens": 1024}
        )
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


LLM = OpenInferenceSpanKindValues.LLM.value
JSON = OpenInferenceMimeTypeValues.JSON.value

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
