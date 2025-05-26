"""
client.py

Guide Example: MCP instrumentation with context propagation

This client script demonstrates how to:
- Instrument a client using MCP and OpenTelemetry via OpenInference.
- Interact with a FastMCP server to simulate a code review workflow.
- Showcase context propagation through traced spans covering the entire client-server flow.
"""

import asyncio
import json
import logging
from typing import Literal

from dotenv import load_dotenv

# --- Setup Tracing and Instrumentation Early ---
load_dotenv()
from openinference.instrumentation.mcp import MCPInstrumentor
from openinference.instrumentation.openai import OpenAIInstrumentor

from phoenix.otel import register

tracer_provider = register(project_name="test_mcp_project")
MCPInstrumentor().instrument(tracer_provider=tracer_provider)
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

# Only now import the libraries that use MCP.
from fastmcp import Client
from openai import OpenAI
from pydantic import BaseModel, Field

# --- Logging config ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

client = Client("server.py")
openai_client = OpenAI()
tracer = tracer_provider.get_tracer("test_mcp_client")


# --- Pydantic models for structured outputs ---
class ReviewType(BaseModel):
    review_type: Literal["security", "performance", "junior"]


class PRComment(BaseModel):
    file_path: str
    line: int
    comment: str
    severity: Literal["low", "medium", "high"]


class Review(BaseModel):
    list_of_pr_comments: list[PRComment] = Field(
        description="List of comments strictly focused on what the template is checking. The comments should exclusively focus on the template nothing else."  # noqa: E501
    )
    checked_template: str = Field(
        description="The exact same template content but with checkboxes filled in that have already been checked through your comments."  # noqa: E501
    )


async def main():
    """
    Demonstrates a full client workflow:
    1. Requests files from the server for a PR.
    2. Requests a review type from OpenAI (security/performance/junior).
    3. Requests a review prompt template.
    4. Runs an AI review and posts comments.
    5. Shows a "checked" template with only agent reviewed checkboxes marked.
    """
    async with client:
        with tracer.start_as_current_span("agent_flow", openinference_span_kind="agent"):
            # --- Step 1: Fetch PR added files using the MCP server resources ---
            pr_id = input("Enter PR ID: ")
            added_files = await client.read_resource(f"pr://{pr_id}/files")
            added_files = json.loads(added_files[0].text)
            logging.info(f"Loaded files: {', '.join(f[:30] for f in added_files)}")

            print("\nFiles to review:")
            for idx, f in enumerate(added_files):
                print(f"\nFile {idx+1}:\n{f[:200]}...")

            # --- Step 2: Determine type of review using OpenAI chat completion ---
            review_request = input("\nInstructions for PR review: ")
            response = openai_client.responses.parse(
                model="gpt-4o-2024-08-06",
                input=[
                    {"role": "system", "content": "User requests a PR review."},
                    {"role": "user", "content": review_request},
                ],
                temperature=0.0,
                text_format=ReviewType,
            )
            review_type = response.output_parsed.review_type
            logging.info(f"Selected review type: {review_type}")

            # --- Step 3: Get template for this review type from the MCP server prompts ---
            review_prompts = {
                "security": "security_review",
                "performance": "performance_review",
                "junior": "junior_feedback",
            }
            prompt_name = review_prompts.get(review_type, "junior_feedback")
            review_template = await client.get_prompt(
                prompt_name, {"recommendations": review_request}
            )
            review_template_content = review_template.messages[0].content.text

            # --- Step 4: Run the AI review using OpenAI (simulate as if real comments are made) ---
            response = openai_client.responses.parse(
                model="gpt-4o-2024-08-06",
                input=[
                    {"role": "system", "content": f"Files: {added_files}"},
                    {"role": "user", "content": review_template_content},
                ],
                temperature=0.0,
                text_format=Review,
            )
            review = response.output_parsed
            logging.info(f"PR comments generated: {review.list_of_pr_comments}")

            # --- Step 5: Post PR comments using the MCP server tool, show checked template ---
            print("\nPR Comments created by agent:")
            for pr_comment in review.list_of_pr_comments:
                res = await client.call_tool("create_pr_comment", pr_comment.model_dump())
                print(f"Comment posted: {res[0].text}")

            print("\nChecked Review Template (only addressed checkboxes should be checked):\n")
            print(review.checked_template)


if __name__ == "__main__":
    asyncio.run(main())
