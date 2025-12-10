#!/usr/bin/env python
"""
Simple script to test the chat completion GraphQL subscription.
"""

import asyncio
import json

from gql import Client, gql
from gql.transport.websockets import WebsocketsTransport

SUBSCRIPTION = gql("""
subscription PlaygroundOutputSubscription($input: ChatCompletionInput!) {
  chatCompletion(input: $input) {
    __typename
    repetitionNumber
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
        id
      }
    }
    ... on ChatCompletionSubscriptionError {
      message
    }
    ... on EvaluationChunk {
      spanEvaluation {
        id
        name
        label
        score
      }
      experimentRunEvaluation {
        name
        label
        score
        metadata
      }
    }
  }
}
""")


async def main() -> None:
    transport = WebsocketsTransport(
        url="ws://localhost:6006/graphql",
        subprotocols=["graphql-transport-ws"],
    )

    # The evaluator ID from test_create_llm_evaluator.py
    llm_evaluator_id = "RGF0YXNldEV2YWx1YXRvcjoxCg=="
    built_in_evaluator_id = "QnVpbHRJbkV2YWx1YXRvcjotMjAwNTY2NTgzMgo="

    evaluators = [
        {
            "id": llm_evaluator_id,
            "inputMapping": {
                "pathMapping": {
                    "input": "$.input",
                    "output": "$.output",
                },
            },
        },
        {
            "id": built_in_evaluator_id,
            "inputMapping": {
                "pathMapping": {
                    "text": "$.output",
                },
                "literalMapping": {
                    "words": "Warriors",
                    "case_sensitive": True,
                },
            },
        },
    ]

    variables = {
        "input": {
            "messages": [
                {"content": "You are a chatbot", "role": "SYSTEM"},
                {"content": "{{question}}", "role": "USER"},
            ],
            "model": {
                "builtin": {
                    "providerKey": "OPENAI",
                    "name": "gpt-4o-mini",
                }
            },
            "invocationParameters": [],
            "repetitions": 1,
            "template": {
                "variables": {"question": "who won the nba finals in 2015?"},
                "format": "MUSTACHE",
            },
            "evaluators": evaluators,
        }
    }

    async with Client(transport=transport, fetch_schema_from_transport=False) as session:
        async for result in session.subscribe(SUBSCRIPTION, variable_values=variables):
            payload = result["chatCompletion"]
            print(json.dumps(payload))


if __name__ == "__main__":
    asyncio.run(main())
