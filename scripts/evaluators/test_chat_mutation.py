#!/usr/bin/env python
"""
Test script for chatCompletion GraphQL mutation.
"""

import asyncio
import json

from gql import Client, gql
from gql.transport.aiohttp import AIOHTTPTransport

MUTATION = gql("""
mutation ChatCompletionMutation($input: ChatCompletionInput!) {
  chatCompletion(input: $input) {
    repetitions {
      repetitionNumber
      content
      toolCalls {
        id
        function {
          name
          arguments
        }
      }
      span {
        id
      }
      errorMessage
      evaluations {
        name
        label
        score
        annotatorKind
        explanation
        metadata
      }
    }
  }
}
""")


async def main() -> None:
    transport = AIOHTTPTransport(url="http://localhost:6006/graphql")

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
                "variables": {"question": "What is the capital of France?"},
                "format": "MUSTACHE",
            },
            "evaluators": evaluators,
        }
    }

    async with Client(transport=transport, fetch_schema_from_transport=False) as session:
        result = await session.execute(MUTATION, variable_values=variables)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
