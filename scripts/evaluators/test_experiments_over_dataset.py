"""
Test script for the experimentsOverDataset GraphQL subscription: one prompt task over a dataset.
"""

import asyncio
import base64
import json

from gql import Client, gql
from gql.transport.websockets import WebsocketsTransport

SUBSCRIPTION = gql("""
subscription ExperimentsOverDatasetSubscription(
  $input: ExperimentsOverDatasetInput!
) {
  experimentsOverDataset(input: $input) {
    __typename
    experimentId
    ... on TextChunk {
      content
      datasetExampleId
      repetitionNumber
    }
    ... on ToolCallChunk {
      id
      datasetExampleId
      repetitionNumber
      function {
        name
        arguments
      }
    }
    ... on ChatCompletionSubscriptionExperiment {
      experiment {
        id
      }
    }
    ... on ChatCompletionSubscriptionResult {
      datasetExampleId
      repetitionNumber
      span {
        id
        tokenCountTotal
        latencyMs
        project {
          id
        }
        context {
          traceId
        }
      }
      experimentRun {
        id
      }
    }
    ... on ChatCompletionSubscriptionError {
      datasetExampleId
      repetitionNumber
      message
    }
    ... on EvaluationChunk {
      datasetExampleId
      repetitionNumber
      experimentRunEvaluation {
        id
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
    transport = WebsocketsTransport(
        url="ws://localhost:6006/graphql",
        subprotocols=["graphql-transport-ws"],
    )

    llm_evaluator_id = base64.b64encode(b"LLMEvaluator:1").decode("utf-8")
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

    dataset_id = "RGF0YXNldDozNA=="

    # Build promptVersion (model identity + template); clientOptions optional.
    messages = [
        {"content": "You are a helpful assistant.", "role": "SYSTEM"},
        {"content": "{{question}}", "role": "USER"},
    ]
    prompt_version = {
        "templateFormat": "MUSTACHE",
        "template": {
            "messages": [
                {
                    "role": m["role"],
                    "content": [{"text": {"text": m["content"]}}],
                }
                for m in messages
            ]
        },
        "modelProvider": "OPENAI",
        "modelName": "gpt-4o-mini",
        "invocationParameters": {},
        "tools": None,
        "responseFormat": None,
    }

    variables = {
        "input": {
            "datasetId": dataset_id,
            "splitIds": None,
            "repetitions": 1,
            "tasks": [{"prompt": {"promptVersion": prompt_version, "evaluators": evaluators}}],
        }
    }

    async with Client(transport=transport, fetch_schema_from_transport=False) as session:
        async for result in session.subscribe(SUBSCRIPTION, variable_values=variables):
            payload = result["experimentsOverDataset"]
            print(json.dumps(payload))


if __name__ == "__main__":
    asyncio.run(main())
