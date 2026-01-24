#!/usr/bin/env python3
# ruff: noqa: E501
"""Phoenix Instrumented Trace Generator for HW5

This script generates synthetic conversation traces with detailed Phoenix spans
for the Recipe-Chatbot homework 5. Each trace intentionally fails at a randomly-sampled
pipeline state and creates granular spans for each step.

The script creates detailed spans for each of the 10 canonical states:
1. ParseRequest - LLM interprets user message
2. PlanToolCalls - LLM decides which tools to invoke
3. GenRecipeArgs - LLM constructs arguments for recipe DB
4. GetRecipes - Executes recipe-search tool
5. GenWebArgs - LLM constructs arguments for web search
6. GetWebInfo - Executes Tavily web-search tool
7. ComposeResponse - LLM drafts final answer

Each span follows OpenInference semantic conventions for proper attribute naming.
"""

from __future__ import annotations

import json
import os
import random
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List

import litellm
from dotenv import load_dotenv

# Import semantic conventions
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    SpanAttributes,
)
from tavily import TavilyClient
from tqdm import tqdm

# Phoenix instrumentation
from phoenix.otel import register

# Load environment variables
load_dotenv()

# -------------------------------------------------------------
# Configuration
# -------------------------------------------------------------

# Canonical pipeline states (10 total)
PIPELINE_STATES: List[str] = [
    "ParseRequest",
    "PlanToolCalls",
    "GenRecipeArgs",
    "GetRecipes",
    "GenWebArgs",
    "GetWebInfo",
    "ComposeResponse",
]
STATE_INDEX = {s: i for i, s in enumerate(PIPELINE_STATES)}

N_TRACES_DEFAULT = 100
MODEL = "gpt-4o-mini"  # Using a more accessible model

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

tracer_provider = register(
    project_name="recipe-agent-hw5",
    batch=True,
    auto_instrument=True,
)
tracer = tracer_provider.get_tracer(__name__)


def chat_completion(
    messages: List[Dict[str, str]],
    *,
    max_tokens: int = 256,
    temperature: float = 0.7,
    **kwargs: dict[str, Any],
) -> str:
    """Wrapper around litellm.completion returning content string."""
    resp = litellm.completion(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        **kwargs,
    )
    return str(resp.choices[0].message.content.strip())


# -----------------------------------------------------------------------------
# Pipeline state implementations
# -----------------------------------------------------------------------------


def parse_request(user_query: str, failure: int) -> str:
    """Simulate ParseRequest state - LLM interprets user message."""
    if failure != 1:
        prompt = f"""
        Analyze the user's query and extract key requirements.

        User query: "{user_query}"

        Return JSON with:
        "intent": brief text
        "dietary_constraints": list (e.g., ["gluten-free"])
        "servings": integer if mentioned, else null
        "other_requirements": list

        Keep it concise and accurate.
        """
    else:
        prompt = f"""
        Analyze the user's query and extract key requirements. Introduce exactly one harmless misinterpretation for testing purposes (no unsafe content).

        User query: "{user_query}"

        Choose one defect:

        Swap one dietary constraint with a similar but incorrect one (e.g., interpret "gluten-free" as "dairy-free")
        Underestimate or overestimate servings by 2
        Omit one secondary requirement

        Return JSON with:
        "intent": brief text
        "dietary_constraints": list (e.g., ["gluten-free"])
        "servings": integer if mentioned, else null
        """
    with tracer.start_as_current_span("ParseRequest", openinference_span_kind="llm") as span:
        span.set_attribute(SpanAttributes.INPUT_VALUE, user_query)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        response = chat_completion([{"role": "user", "content": prompt}])
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, response)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
    return response


def plan_tool_calls(parsed_request: str, failure: int) -> str:
    """Simulate PlanToolCalls state - LLM decides which tools to invoke."""
    if failure != 2:
        prompt = f"""
        Based on the parsed request, plan which tools to use and in what order.

        Parsed request: "{parsed_request}"
        Available tools: recipe_search, web_search

        Return JSON:
        "ordered_tools": e.g., ["customer_profile","recipe_search","web_search"]
        "rationale": short text
        """
    else:
        prompt = f"""
        Based on the parsed request, plan which tools to use and in what order, but introduce exactly one harmless defect for testing.

        Parsed request: "{parsed_request}"
        Available tools: recipe_search, web_search

        Do the following defect:
        Include one plausible but nonexistent tool name (e.g., "nutrition_facts")

        Return JSON:
        "ordered_tools": list of tools in intended order
        "rationale": short text
        """

    with tracer.start_as_current_span("PlanToolCalls", openinference_span_kind="llm") as span:
        span.set_attribute(SpanAttributes.INPUT_VALUE, parsed_request)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        response = chat_completion([{"role": "user", "content": prompt}])
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, response)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
    return response


def gen_recipe_args(parsed_request: str, failure: int) -> str:
    """Simulate GenRecipeArgs state - LLM constructs arguments for recipe DB."""
    if failure != 3:
        prompt = f"""
        Based on the request, produce recipe_search arguments.

        Parsed request: "{parsed_request}"

        Return JSON:
        "query": short string
        "filters": {{"diet": list, "exclude_ingredients": list, "max_time_minutes": int|None}}
        "servings": int|None
        """
    else:
        prompt = f"""
        Based on the request, produce recipe_search arguments but introduce one harmless mismatch for testing.

        Parsed request: "{parsed_request}"
        Choose one defect:
        Completely change the query to not match the intent given in the parsed request
        Ignore diet constraints in dietary constraints
        If parsed request includes servings, change it to a different number

        Return JSON:
        "query": short string
        "diet": list,
        "servings": int|None
        """

    with tracer.start_as_current_span("GenRecipeArgs", openinference_span_kind="llm") as span:
        span.set_attribute(SpanAttributes.INPUT_VALUE, parsed_request)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        response = chat_completion([{"role": "user", "content": prompt}])
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, response)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)

    return response


def get_recipes(args: str, failure: int) -> str:
    """Simulate GetRecipes state - Executes recipe-search retriever."""
    with tracer.start_as_current_span(
        "GetRecipes",
        openinference_span_kind="retriever",
    ) as span:
        # Add realistic delay for retrieval operations (300-1200ms)
        time.sleep(random.uniform(0.3, 1.2))

        if failure != 4:
            prompt = f"""
                Simulate recipe search results for these arguments.

                Arguments: {args}

                Return JSON list of 2–3 documents, each with the following fields:
                {{
                    "recipe_name": string,
                    "recipe_description": string,
                    "recipe_ingredients": list,
                    "recipe_instructions": list
                }}
                """
        else:
            prompt = f"""
                Simulate recipe search results for these arguments, introducing a retrieval defect for testing.

                Arguments: {args}

                Include a recipe that clearly does not match the args given to you above.

                Return JSON list of 2–3 documents, each with the following fields:
                {{
                    "recipe_name": string,
                    "recipe_description": string,
                    "recipe_ingredients": list,
                    "recipe_instructions": list
                }}
                """

        response = chat_completion([{"role": "user", "content": prompt}])

        # Set input/output attributes
        span.set_attribute(SpanAttributes.INPUT_VALUE, args)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, response)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)

    return response


def gen_web_args(recipes: str, failure: int) -> str:
    """Simulate GenWebArgs state - LLM constructs arguments for web search."""
    if failure != 5:
        prompt = f"""
        Generate web_search arguments to find cooking tips based on these recipes.

        Recipes: {recipes}

        Return just the query, which is a string containing a web search query for additional information, cooking tips, special ingredients, etc.
        """
    else:
        prompt = f"""
        Generate web_search arguments to find cooking tips based on these recipes, but introduce harmless defects for testing.

        Recipes: {recipes}

        Do the following defects:
        Off topic query, unrelated to the recipes

        Return just the query, which is a string containing a web search query for additional information, cooking tips, special ingredients, etc.
        """

    with tracer.start_as_current_span("GenWebArgs", openinference_span_kind="llm") as span:
        span.set_attribute(SpanAttributes.INPUT_VALUE, recipes)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        response = chat_completion([{"role": "user", "content": prompt}])
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, response)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)

    return response


@tracer.tool(name="GetWebInfo", description="Search the web for recipe information and tips")
def get_web_info(search_query: str, failure: int) -> str:
    """GetWebInfo state - Executes Tavily web search for recipe information."""

    # Initialize Tavily client
    tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

    if failure != 6:
        # Normal search for recipe information
        response = tavily_client.search(search_query)
        return json.dumps(response)
    else:
        # Search for off-topic information for testing
        off_topic_query = "unrelated topic information"
        response = tavily_client.search(off_topic_query)
        return json.dumps(response)


def compose_response(recipes: str, web_info: str, failure: int) -> str:
    """ComposeResponse state - LLM drafts the final answer."""
    if failure != 7:
        prompt = f"""
        Compose a helpful final answer based on these recipes and web information.

        Recipes: {recipes}
        Web Info: {web_info}

        Output a friendly response that:
        Summarizes one recommended recipe
        Provides clear numbered steps
        Includes relevant tips from web info
        Respects dietary constraints
        """
    else:
        prompt = f"""
        Compose a helpful final answer based on these recipes and web information, but introduce one harmless internal inconsistency for testing.

        Recipes: {recipes}
        Web Info: {web_info}

        Choose one defect:
        Contradictory steps (e.g., bake then say "do not use heat")
        Big/nonsensical unit mismatches
        Final answer is not helpful, does not match/contradicts recipes at all
        Final answer is not helpful, does not match web/contradicts info at all
        Simply nonsensical answer
        """
    with tracer.start_as_current_span("ComposeResponse", openinference_span_kind="llm") as span:
        span.set_attribute(SpanAttributes.INPUT_VALUE, recipes)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        response = chat_completion([{"role": "user", "content": prompt}])
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, response)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
    return response


def generate_single_trace_with_spans(failure: int) -> None:
    """Generate a single trace with detailed Phoenix spans."""

    conversation_id = str(uuid.uuid4())

    user_queries = [
        "I need a gluten-free dinner idea for four.",
        "Suggest a healthy breakfast using oatmeal.",
        "What vegetarian high-protein meal can I cook tonight?",
    ]
    user_query = random.choice(user_queries)

    with tracer.start_as_current_span(
        f"RecipeBot_request_{conversation_id}",
        openinference_span_kind="agent",
    ) as root_span:
        root_span.set_attribute(SpanAttributes.INPUT_VALUE, user_query)

        messages = [{"role": "user", "content": user_query}]
        parsed_request = parse_request(user_query, failure)
        messages.append({"role": "assistant", "content": f"Parsing request: {parsed_request}"})
        time.sleep(0.1)

        # 2. PlanToolCalls
        plan = plan_tool_calls(parsed_request, failure)
        messages.append({"role": "assistant", "content": f"Planning tools: {plan}"})
        time.sleep(0.1)

        # 3. GenRecipeArgs
        recipe_args = gen_recipe_args(parsed_request, failure)
        messages.append(
            {
                "role": "assistant",
                "content": f"Generating recipe args: {recipe_args}",
            }
        )

        # 4. GetRecipes
        recipes_str = get_recipes(recipe_args, failure)
        messages.append({"role": "assistant", "content": f"Found recipes: {recipes_str}"})

        time.sleep(0.1)

        # 5. GenWebArgs
        search_query = gen_web_args(recipes_str, failure)
        messages.append(
            {
                "role": "assistant",
                "content": f"Generated web search query: {search_query}",
            }
        )

        # 6. GetWebInfo
        web_info = get_web_info(search_query, failure)
        messages.append({"role": "assistant", "content": f"Found web resources: {web_info}"})

        time.sleep(0.1)

        # 7. ComposeResponse
        final_response = compose_response(recipes_str, web_info, failure)
        messages.append({"role": "assistant", "content": final_response})

        time.sleep(0.1)

        root_span.set_attribute(SpanAttributes.OUTPUT_VALUE, json.dumps(messages))


def generate_traces_phoenix(
    n_traces: int = N_TRACES_DEFAULT,
    seed: int | None = None,
    max_workers: int = 32,
) -> None:
    """Generate traces with Phoenix instrumentation."""

    if seed is not None:
        random.seed(seed)

    def make_trace(_: int) -> None:
        """Generate a single trace with retry logic."""
        failure = random.randint(1, 10)
        generate_single_trace_with_spans(failure)

    # Generate traces in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(make_trace, i) for i in range(n_traces)]

        for future in tqdm(as_completed(futures), total=n_traces, desc="Generating traces"):
            future.result()


# -------------------------------------------------------------
# Main execution
# -------------------------------------------------------------


def main() -> None:
    """Main function to generate traces with Phoenix instrumentation."""
    print("Phoenix Instrumented Trace Generator")
    print("=" * 50)

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Generate traces
    print(f"Generating {N_TRACES_DEFAULT} traces with Phoenix instrumentation...")
    generate_traces_phoenix(N_TRACES_DEFAULT, seed=42)

    print("Trace generation completed!")
    print("Check Phoenix dashboard to view the detailed spans!")


if __name__ == "__main__":
    main()
