#!/usr/bin/env python
"""
Script to create an LLM evaluator via GraphQL mutation.
"""

import asyncio

from gql import Client, gql
from gql.transport.aiohttp import AIOHTTPTransport

MUTATION = gql("""
mutation CreateLLMEvaluator($input: CreateLLMEvaluatorInput!) {
  createLlmEvaluator(input: $input) {
    evaluator {
      id
      name
      description
    }
    query {
      __typename
    }
  }
}
""")


async def main():
    transport = AIOHTTPTransport(url="http://localhost:6006/graphql")

    async with Client(transport=transport, fetch_schema_from_transport=False) as session:
        variables = {
            "input": {
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
        evaluator = result["createLlmEvaluator"]["evaluator"]
        print("✅ Created evaluator!")
        print(f"   ID: {evaluator['id']}")
        print(f"   Name: {evaluator['name']}")
        print(f"   Description: {evaluator['description']}")


if __name__ == "__main__":
    asyncio.run(main())
