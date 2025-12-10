#!/usr/bin/env python
"""
Test script for chatCompletionOverDataset GraphQL mutation.
"""

import asyncio
import json

from gql import Client, gql
from gql.transport.aiohttp import AIOHTTPTransport

MUTATION = gql("""
mutation ChatCompletionOverDatasetMutation($input: ChatCompletionOverDatasetInput!) {
  chatCompletionOverDataset(input: $input) {
    datasetId
    datasetVersionId
    experimentId
    examples {
      datasetExampleId
      repetitionNumber
      experimentRunId
      repetition {
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
}
""")


async def main() -> None:
    transport = AIOHTTPTransport(url="http://localhost:6006/graphql")

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
                    "words": "Paul Graham",
                    "case_sensitive": True,
                },
            },
        },
    ]

    # Dataset ID - update this to match your dataset
    dataset_id = "RGF0YXNldDozNA=="

    variables = {
        "input": {
            "messages": [
                {"content": "You are a helpful assistant.", "role": "SYSTEM"},
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
            "templateFormat": "MUSTACHE",
            "datasetId": dataset_id,
            "splitIds": None,
            "evaluators": evaluators,
        }
    }

    async with Client(transport=transport, fetch_schema_from_transport=False) as session:
        result = await session.execute(MUTATION, variable_values=variables)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
