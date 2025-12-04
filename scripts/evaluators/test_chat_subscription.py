#!/usr/bin/env python
"""
Simple script to test the chat completion GraphQL subscription.
"""

import asyncio

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
      }
    }
  }
}
""")


async def main():
    transport = WebsocketsTransport(
        url="ws://localhost:6006/graphql",
        subprotocols=["graphql-transport-ws"],
    )

    async with Client(transport=transport, fetch_schema_from_transport=False) as session:
        # The evaluator ID from test_create_llm_evaluator.py
        evaluator_id = "TExNRXZhbHVhdG9yOjE="

        evaluators = [
            {
                "id": evaluator_id,
                "inputMapping": {
                    "pathMapping": {
                        "input": "$.input",
                        "output": "$.output",
                    },
                },
            }
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
                    "variables": {"question": "who won the nba finals last year?"},
                    "format": "MUSTACHE",
                },
                "evaluators": evaluators,
            }
        }

        print(f"Evaluators: {evaluators}")
        print("Starting subscription...")
        async for result in session.subscribe(SUBSCRIPTION, variable_values=variables):
            payload = result["chatCompletion"]
            typename = payload["__typename"]

            if typename == "TextChunk":
                print(payload["content"], end="", flush=True)
            elif typename == "ToolCallChunk":
                func = payload["function"]
                print(f"\n[Tool Call] {func['name']}: {func['arguments']}")
            elif typename == "ChatCompletionSubscriptionResult":
                print(f"\n\n✅ Complete! Span ID: {payload['span']['id']}")
            elif typename == "ChatCompletionSubscriptionError":
                print(f"\n❌ Error: {payload['message']}")
            elif typename == "EvaluationChunk":
                eval_data = payload.get("spanEvaluation") or payload.get("experimentRunEvaluation")
                if eval_data:
                    name = eval_data["name"]
                    label = eval_data["label"]
                    score = eval_data["score"]
                    print(f"\n📊 Evaluation: {name} = {label} (score: {score})")
            else:
                print(f"\n[{typename}] {payload}")


if __name__ == "__main__":
    asyncio.run(main())
