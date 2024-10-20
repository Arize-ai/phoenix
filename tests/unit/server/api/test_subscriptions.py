import json
from typing import Any, Dict

import pytest
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
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


def remove_all_vcr_response_headers(response: Dict[str, Any]) -> Dict[str, Any]:
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

    @pytest.mark.vcr(
        decode_compressed_response=True,
        before_record_request=remove_all_vcr_request_headers,
        before_record_response=remove_all_vcr_response_headers,
        ignore_hosts=["test"],
    )
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
                "invocationParameters": {
                    "temperature": 0.1,
                },
            },
        }
        payloads = [
            payload["chatCompletion"]
            async for payload in gql_client.subscribe(
                query=self.QUERY, variables=variables, operation_name="ChatCompletionSubscription"
            )
        ]

        # check subscription payloads
        assert payloads
        assert (last_payload := payloads.pop())["__typename"] == "FinishedChatCompletion"
        assert all(payload["__typename"] == "TextChunk" for payload in payloads)
        response_text = "".join(payload["content"] for payload in payloads)
        assert "france" in response_text.lower()
        subscription_span = last_payload["span"]
        span_id = subscription_span["id"]

        # query for the span via the node interface to ensure that the span
        # recorded in the db contains identical information as the span emitted
        # by the subscription
        data = await gql_client.execute(
            query=self.QUERY, variables={"spanId": span_id}, operation_name="SpanQuery"
        )
        span = data["span"]
        assert span == subscription_span

        # check attributes
        assert span.pop("id") == span_id
        assert span.pop("name") == "Chat Completion"
        assert span.pop("statusCode") == "OK"
        assert not span.pop("statusMessage")
        assert span.pop("startTime")
        assert span.pop("endTime")
        assert isinstance(span.pop("latencyMs"), float)
        assert span.pop("parentId") is None
        assert span.pop("spanKind") == "llm"
        assert (context := span.pop("context")).pop("spanId")
        assert (attributes := dict(flatten(json.loads(span.pop("attributes")))))
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
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
