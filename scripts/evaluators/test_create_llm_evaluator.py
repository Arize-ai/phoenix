#!/usr/bin/env python
"""
Script to create an LLM evaluator via GraphQL mutation.
"""

import asyncio

from gql import Client, gql
from gql.transport.aiohttp import AIOHTTPTransport

MUTATION = gql("""
mutation CreateDatasetLLMEvaluator($input: CreateDatasetLLMEvaluatorInput!) {
  createDatasetLlmEvaluator(input: $input) {
    evaluator {
      id
      displayName
      evaluator {
        ... on LLMEvaluator {
          id
          name
          description
        }
      }
    }
    query {
      __typename
    }
  }
}
""")


DATASET_ID = "RGF0YXNldDozNA=="


async def main() -> None:
    transport = AIOHTTPTransport(url="http://localhost:6006/graphql")

    async with Client(transport=transport, fetch_schema_from_transport=False) as session:
        variables = {
            "input": {
                "datasetId": DATASET_ID,
                "name": "relevance-evaluator",
                "description": "Evaluates whether the output is relevant to the input",
                "promptVersion": {
                    "templateFormat": "MUSTACHE",
                    "template": {
                        "messages": [
                            {
                                "role": "SYSTEM",
                                "content": [
                                    {
                                        "text": {
                                            "text": (
                                                "You are an expert evaluator. "
                                                "Your task is to assess whether the assistant's "
                                                "response is relevant to the user's question. "
                                                "Use the provided tool to submit your evaluation."
                                            )
                                        }
                                    }
                                ],
                            },
                            {
                                "role": "USER",
                                "content": [
                                    {
                                        "text": {
                                            "text": """Given the following:

User Question: {{input}}

Assistant Response: {{output}}

Is the assistant's response relevant to the user's question?"""
                                        }
                                    }
                                ],
                            },
                        ]
                    },
                    "invocationParameters": {
                        "tool_choice": {
                            "type": "function",
                            "function": {"name": "relevance-evaluator"},
                        }
                    },
                    "tools": [
                        {
                            "definition": {
                                "type": "function",
                                "function": {
                                    "name": "relevance-evaluator",
                                    "description": (
                                        "Evaluates whether the output is relevant to the input"
                                    ),
                                    "parameters": {
                                        "type": "object",
                                        "properties": {
                                            "relevance": {
                                                "type": "string",
                                                "enum": [
                                                    "relevant",
                                                    "partially_relevant",
                                                    "not_relevant",
                                                ],
                                            }
                                        },
                                        "required": ["relevance"],
                                    },
                                },
                            }
                        }
                    ],
                    "modelProvider": "OPENAI",
                    "modelName": "gpt-4o-mini",
                },
                "outputConfig": {
                    "name": "relevance",
                    "description": "Measures how relevant the response is to the input",
                    "optimizationDirection": "MAXIMIZE",
                    "values": [
                        {"label": "relevant", "score": 1.0},
                        {"label": "partially_relevant", "score": 0.5},
                        {"label": "not_relevant", "score": 0.0},
                    ],
                },
            }
        }

        print("Creating LLM evaluator...")
        result = await session.execute(MUTATION, variable_values=variables)
        dataset_evaluator = result["createDatasetLlmEvaluator"]["evaluator"]
        llm_evaluator = dataset_evaluator["evaluator"]
        print("✅ Created evaluator!")
        print(f"   DatasetEvaluator ID: {dataset_evaluator['id']}")
        print(f"   Display Name: {dataset_evaluator['displayName']}")
        print(f"   LLMEvaluator ID: {llm_evaluator['id']}")
        print(f"   LLMEvaluator Name: {llm_evaluator['name']}")
        print(f"   LLMEvaluator Description: {llm_evaluator['description']}")


if __name__ == "__main__":
    asyncio.run(main())
