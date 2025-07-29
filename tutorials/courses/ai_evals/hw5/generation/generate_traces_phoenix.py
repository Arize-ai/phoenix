#!/usr/bin/env python3
"""Phoenix Instrumented Trace Generator for HW5

This script generates synthetic conversation traces with detailed Phoenix spans
for the Recipe-Chatbot homework 5. Each trace intentionally fails at a randomly-sampled
pipeline state and creates granular spans for each step.

The script creates detailed spans for each of the 10 canonical states:
1. ParseRequest - LLM interprets user message
2. PlanToolCalls - LLM decides which tools to invoke
3. GenCustomerArgs - LLM constructs arguments for customer DB
4. GetCustomerProfile - Executes customer-profile tool
5. GenRecipeArgs - LLM constructs arguments for recipe DB
6. GetRecipes - Executes recipe-search tool
7. GenWebArgs - LLM constructs arguments for web search
8. GetWebInfo - Executes web-search tool
9. ComposeResponse - LLM drafts final answer
10. DeliverResponse - Agent sends the answer

Each span follows OpenInference semantic conventions for proper attribute naming.
"""

from __future__ import annotations

import json
import random
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Tuple

import litellm
from dotenv import load_dotenv

# Import semantic conventions
from openinference.semconv.trace import (
    OpenInferenceLLMProviderValues,
    OpenInferenceMimeTypeValues,
    SpanAttributes,
)
from opentelemetry.trace import Status, StatusCode
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
    "GenCustomerArgs",
    "GetCustomerProfile",
    "GenRecipeArgs",
    "GetRecipes",
    "GenWebArgs",
    "GetWebInfo",
    "ComposeResponse",
    "DeliverResponse",
]
STATE_INDEX = {s: i for i, s in enumerate(PIPELINE_STATES)}

# Non-uniform sampling weights for FIRST failure state
FAILURE_WEIGHTS: List[int] = [
    6,  # ParseRequest
    5,  # PlanToolCalls
    10,  # GenCustomerArgs
    12,  # GetCustomerProfile
    15,  # GenRecipeArgs
    30,  # GetRecipes
    7,  # GenWebArgs
    9,  # GetWebInfo
    5,  # ComposeResponse
    1,  # DeliverResponse
]

assert len(FAILURE_WEIGHTS) == len(PIPELINE_STATES)

N_TRACES_DEFAULT = 100
MODEL = "gpt-4o-mini"  # Using a more accessible model

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# -------------------------------------------------------------
# Phoenix Setup
# -------------------------------------------------------------

# Register Phoenix tracer
tracer_provider = register(
    project_name="recipe-agent-hw5",
    batch=True,
    auto_instrument=False,
)
tracer = tracer_provider.get_tracer(__name__)

# -------------------------------------------------------------
# LLM helper via litellm
# -------------------------------------------------------------


def chat_completion(
    messages: List[Dict[str, str]], *, max_tokens: int = 256, temperature: float = 0.7, **kwargs
) -> str:
    """Wrapper around litellm.completion returning content string."""
    resp = litellm.completion(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        **kwargs,
    )
    return resp.choices[0].message.content.strip()


# -------------------------------------------------------------
# State sampling helpers
# -------------------------------------------------------------


def pick_first_failure_state() -> str:
    """Sample a first failure state using weighted distribution."""
    return random.choices(PIPELINE_STATES, weights=FAILURE_WEIGHTS)[0]


def select_last_success_state(first_failure_state: str) -> str:
    """Select a plausible last success state that precedes the failure."""
    failure_idx = STATE_INDEX[first_failure_state]

    # Can't succeed after failing
    available_states = PIPELINE_STATES[:failure_idx]

    if not available_states:
        # If failure is at the very beginning, just use the first state
        return PIPELINE_STATES[0]

    # Prefer states closer to the failure for more realistic scenarios
    weights = list(range(1, len(available_states) + 1))
    return random.choices(available_states, weights=weights)[0]


# -------------------------------------------------------------
# Span creation helpers
# -------------------------------------------------------------


def create_llm_span(
    span_name: str,
    input_text: str,
    output_text: str,
    model_name: str = MODEL,
    system: str = "openai",
) -> None:
    """Create an LLM span with proper semantic conventions."""
    with tracer.start_as_current_span(
        span_name,
        openinference_span_kind="llm",
    ) as span:
        # Set input/output attributes
        span.set_attribute(SpanAttributes.INPUT_VALUE, input_text)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, output_text)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)

        # Set LLM-specific attributes
        span.set_attribute(SpanAttributes.LLM_MODEL_NAME, model_name)
        span.set_attribute(SpanAttributes.LLM_PROVIDER, OpenInferenceLLMProviderValues.OPENAI.value)
        span.set_attribute(SpanAttributes.LLM_SYSTEM, system)

        # Set messages
        span.set_attribute(
            SpanAttributes.LLM_INPUT_MESSAGES, json.dumps([{"role": "user", "content": input_text}])
        )
        span.set_attribute(
            SpanAttributes.LLM_OUTPUT_MESSAGES,
            json.dumps([{"role": "assistant", "content": output_text}]),
        )

        span.set_status(Status(StatusCode.OK))


def create_tool_span(
    span_name: str,
    tool_name: str,
    tool_description: str,
    input_args: Dict[str, Any],
    output_result: str,
    success: bool = True,
) -> None:
    """Create a tool span with proper semantic conventions."""
    with tracer.start_as_current_span(
        span_name,
        openinference_span_kind="tool",
    ) as span:
        # Set input/output attributes
        span.set_attribute(SpanAttributes.INPUT_VALUE, json.dumps(input_args))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, output_result)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)

        # Set tool-specific attributes
        span.set_attribute(SpanAttributes.TOOL_NAME, tool_name)
        span.set_attribute(SpanAttributes.TOOL_DESCRIPTION, tool_description)
        span.set_attribute(SpanAttributes.TOOL_PARAMETERS, json.dumps(input_args))

        # Set status based on success
        if success:
            span.set_status(Status(StatusCode.OK))
        else:
            span.set_status(Status(StatusCode.ERROR))
            span.record_exception(Exception(output_result))


def create_retriever_span(
    span_name: str, query: str, documents: List[Dict[str, Any]], success: bool = True
) -> None:
    """Create a retriever span with proper semantic conventions."""
    with tracer.start_as_current_span(
        span_name,
        openinference_span_kind="retriever",
    ) as span:
        # Set input/output attributes
        span.set_attribute(SpanAttributes.INPUT_VALUE, query)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, json.dumps(documents))
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value)

        # Set retrieval-specific attributes
        span.set_attribute(SpanAttributes.RETRIEVAL_DOCUMENTS, json.dumps(documents))

        # Set status based on success
        if success:
            span.set_status(Status(StatusCode.OK))
        else:
            span.set_status(Status(StatusCode.ERROR))
            span.record_exception(Exception("Retrieval failed"))


def create_chain_span(
    span_name: str, input_text: str, output_text: str, success: bool = True
) -> None:
    """Create a chain span with proper semantic conventions."""
    with tracer.start_as_current_span(
        span_name,
        openinference_span_kind="chain",
    ) as span:
        # Set input/output attributes
        span.set_attribute(SpanAttributes.INPUT_VALUE, input_text)
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, output_text)
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value)

        # Set status based on success
        if success:
            span.set_status(Status(StatusCode.OK))
        else:
            span.set_status(Status(StatusCode.ERROR))
            span.record_exception(Exception("Chain execution failed"))


# -------------------------------------------------------------
# Pipeline state implementations
# -------------------------------------------------------------


def simulate_parse_request(user_query: str) -> str:
    """Simulate ParseRequest state - LLM interprets user message."""
    prompt = f"""
    Analyze this user query and extract the key requirements:
    Query: "{user_query}"

    Return a brief analysis of what the user is asking for.
    """

    response = chat_completion([{"role": "user", "content": prompt}])
    create_llm_span("ParseRequest", prompt, response)
    return response


def simulate_plan_tool_calls(parsed_request: str) -> str:
    """Simulate PlanToolCalls state - LLM decides which tools to invoke."""
    prompt = f"""
    Based on this parsed request, plan which tools to use:
    Parsed Request: "{parsed_request}"

    Available tools: customer_profile, recipe_search, web_search
    Return a brief plan of which tools to call and in what order.
    """

    response = chat_completion([{"role": "user", "content": prompt}])
    create_llm_span("PlanToolCalls", prompt, response)
    return response


def simulate_gen_customer_args(plan: str) -> Dict[str, Any]:
    """Simulate GenCustomerArgs state - LLM constructs arguments for customer DB."""
    prompt = f"""
    Based on this tool plan, generate arguments for the customer profile tool:
    Plan: "{plan}"

    Return JSON arguments for customer profile lookup.
    """

    response = chat_completion([{"role": "user", "content": prompt}])
    create_llm_span("GenCustomerArgs", prompt, response)

    args = json.loads(response)
    return args


def simulate_get_customer_profile(args: Dict[str, Any], success: bool = True) -> str:
    """Simulate GetCustomerProfile state - Executes customer-profile tool."""
    tool_name = "GetCustomerProfile"
    tool_description = "Retrieve customer profile and preferences"

    if success:
        result = "Customer profile retrieved: vegetarian, gluten-free, prefers quick meals"
    else:
        result = "Error: Database timeout (30s)"

    create_tool_span("GetCustomerProfile", tool_name, tool_description, args, result, success)
    return result


def simulate_gen_recipe_args(customer_profile: str) -> Dict[str, Any]:
    """Simulate GenRecipeArgs state - LLM constructs arguments for recipe DB."""
    prompt = f"""
    Based on this customer profile, generate search arguments for recipe database:
    Customer Profile: "{customer_profile}"

    Return JSON arguments for recipe search.
    """

    response = chat_completion([{"role": "user", "content": prompt}])
    create_llm_span("GenRecipeArgs", prompt, response)

    args = json.loads(response)
    return args


def simulate_get_recipes(args: Dict[str, Any], success: bool = True) -> List[Dict[str, Any]]:
    """Simulate GetRecipes state - Executes recipe-search tool."""

    if success:
        documents = [
            {
                "id": "recipe_1",
                "content": "Vegetarian pasta with chickpeas and spinach",
                "score": 0.95,
                "metadata": {"cooking_time": "30 minutes", "difficulty": "easy"},
            },
            {
                "id": "recipe_2",
                "content": "Quinoa bowl with roasted vegetables",
                "score": 0.88,
                "metadata": {"cooking_time": "25 minutes", "difficulty": "medium"},
            },
        ]
    else:
        documents = []

    create_retriever_span("GetRecipes", json.dumps(args), documents, success)
    return documents


def simulate_gen_web_args(recipes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Simulate GenWebArgs state - LLM constructs arguments for web search."""
    prompt = f"""
    Based on these recipes, generate search arguments for web search:
    Recipes: {json.dumps(recipes)}

    Return JSON arguments for web search to find additional cooking tips.
    """

    response = chat_completion([{"role": "user", "content": prompt}])
    create_llm_span("GenWebArgs", prompt, response)

    args = json.loads(response)
    return args


def simulate_get_web_info(args: Dict[str, Any], success: bool = True) -> List[Dict[str, Any]]:
    """Simulate GetWebInfo state - Executes web-search tool."""

    if success:
        documents = [
            {
                "id": "web_1",
                "content": "Top 10 vegetarian cooking tips for beginners",
                "score": 0.92,
                "metadata": {"source": "cooking-blog.com"},
            },
            {
                "id": "web_2",
                "content": "How to make perfect quinoa every time",
                "score": 0.87,
                "metadata": {"source": "food-network.com"},
            },
        ]
    else:
        documents = []

    create_retriever_span("GetWebInfo", json.dumps(args), documents, success)
    return documents


def simulate_compose_response(recipes: List[Dict[str, Any]], web_info: List[Dict[str, Any]]) -> str:
    """Simulate ComposeResponse state - LLM drafts the final answer."""
    prompt = f"""
    Compose a helpful response based on these recipes and web information:
    Recipes: {json.dumps(recipes)}
    Web Info: {json.dumps(web_info)}

    Provide a complete recipe suggestion with instructions.
    """

    response = chat_completion([{"role": "user", "content": prompt}])
    create_llm_span("ComposeResponse", prompt, response)
    return response


def simulate_deliver_response(final_response: str, success: bool = True) -> str:
    """Simulate DeliverResponse state - Agent sends the answer."""
    if success:
        result = final_response
    else:
        result = "Error: Unable to deliver the response due to a communication issue."

    create_chain_span("DeliverResponse", final_response, result, success)
    return result


# -------------------------------------------------------------
# Main trace generation
# -------------------------------------------------------------


def generate_single_trace_with_spans(
    last_success: str, first_failure: str
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Generate a single trace with detailed Phoenix spans."""

    # Generate conversation ID
    conversation_id = str(uuid.uuid4())

    # Sample user query
    user_queries = [
        "I need a gluten-free dinner idea for four.",
        "Suggest a healthy breakfast using oatmeal.",
        "What vegetarian high-protein meal can I cook tonight?",
    ]
    user_query = random.choice(user_queries)

    # Create root span for the entire conversation
    with tracer.start_as_current_span(
        f"RecipeBot_Conversation_{conversation_id}",
        openinference_span_kind="agent",
    ) as root_span:
        root_span.set_attribute(SpanAttributes.INPUT_VALUE, user_query)
        root_span.set_attribute(SpanAttributes.AGENT_NAME, "RecipeBot")

        root_span.set_attribute("last_success_state", last_success)
        root_span.set_attribute("first_failure_state", first_failure)

        messages = [{"role": "user", "content": user_query}]

        # Execute pipeline states
        try:
            # 1. ParseRequest
            parsed_request = simulate_parse_request(user_query)
            messages.append({"role": "assistant", "content": f"Parsing request: {parsed_request}"})

            # 2. PlanToolCalls
            if STATE_INDEX["PlanToolCalls"] <= STATE_INDEX[last_success]:
                plan = simulate_plan_tool_calls(parsed_request)
                messages.append({"role": "assistant", "content": f"Planning tools: {plan}"})

            # 3. GenCustomerArgs
            if STATE_INDEX["GenCustomerArgs"] <= STATE_INDEX[last_success]:
                customer_args = simulate_gen_customer_args(plan)
                messages.append(
                    {
                        "role": "assistant",
                        "content": f"Generating customer args: {json.dumps(customer_args)}",
                    }
                )
            elif STATE_INDEX["GenCustomerArgs"] == STATE_INDEX[first_failure]:
                # Simulate failure
                customer_args = {}
                create_llm_span(
                    "GenCustomerArgs",
                    "Generate customer args",
                    "Error: malformed customer ID parameter.",
                )
                messages.append(
                    {"role": "assistant", "content": "Error: malformed customer ID parameter."}
                )
            else:
                customer_args = {}
            # 4. GetCustomerProfile
            if STATE_INDEX["GetCustomerProfile"] <= STATE_INDEX[last_success]:
                success = STATE_INDEX["GetCustomerProfile"] < STATE_INDEX[first_failure]
                customer_profile = simulate_get_customer_profile(customer_args, success)
                messages.append(
                    {"role": "assistant", "content": f"Customer profile: {customer_profile}"}
                )
            elif STATE_INDEX["GetCustomerProfile"] == STATE_INDEX[first_failure]:
                # Simulate failure
                create_tool_span(
                    "GetCustomerProfile",
                    "GetCustomerProfile",
                    "Retrieve customer profile and preferences",
                    customer_args,
                    "Error: Database timeout (30s)",
                    False,
                )
                messages.append({"role": "assistant", "content": "Error: Database timeout (30s)"})
            else:
                customer_profile = {}
            # 5. GenRecipeArgs
            if STATE_INDEX["GenRecipeArgs"] <= STATE_INDEX[last_success]:
                recipe_args = simulate_gen_recipe_args(customer_profile)
                messages.append(
                    {
                        "role": "assistant",
                        "content": f"Generating recipe args: {json.dumps(recipe_args)}",
                    }
                )
            elif STATE_INDEX["GenRecipeArgs"] == STATE_INDEX[first_failure]:
                # Simulate failure
                recipe_args = {}
                create_llm_span(
                    "GenRecipeArgs",
                    "Generate recipe args",
                    "Error: token limit exceeded while building query",
                )
                messages.append(
                    {
                        "role": "assistant",
                        "content": "Error: Unable to generate recipe search parameters.",
                    }
                )
            else:
                recipe_args = {}
            # 6. GetRecipes
            if STATE_INDEX["GetRecipes"] <= STATE_INDEX[last_success]:
                recipes = simulate_get_recipes(recipe_args, True)
                messages.append({"role": "assistant", "content": f"Found {len(recipes)} recipes"})
            elif STATE_INDEX["GetRecipes"] == STATE_INDEX[first_failure]:
                # Simulate failure
                create_retriever_span("GetRecipes", json.dumps(recipe_args), [], False)
                messages.append(
                    {"role": "assistant", "content": "Error: no recipes found for given criteria."}
                )
            else:
                recipes = []
            # 7. GenWebArgs
            if STATE_INDEX["GenWebArgs"] <= STATE_INDEX[last_success]:
                web_args = simulate_gen_web_args(recipes)
                messages.append(
                    {"role": "assistant", "content": f"Generating web args: {json.dumps(web_args)}"}
                )
            elif STATE_INDEX["GenWebArgs"] == STATE_INDEX[first_failure]:
                # Simulate failure
                create_llm_span(
                    "GenWebArgs",
                    "Generate web args",
                    "Error: failed to construct valid search terms",
                )
                messages.append(
                    {
                        "role": "assistant",
                        "content": "Error: unable to generate web search parameters.",
                    }
                )
            else:
                web_args = {}
            # 8. GetWebInfo
            if STATE_INDEX["GetWebInfo"] <= STATE_INDEX[last_success]:
                web_info = simulate_get_web_info(web_args, True)
                messages.append(
                    {"role": "assistant", "content": f"Found {len(web_info)} web resources"}
                )
            elif STATE_INDEX["GetWebInfo"] == STATE_INDEX[first_failure]:
                # Simulate failure
                create_retriever_span("GetWebInfo", json.dumps(web_args), [], False)
                messages.append(
                    {"role": "assistant", "content": "Error: HTTP 503 – service unavailable."}
                )
            else:
                web_info = []
            # 9. ComposeResponse
            if STATE_INDEX["ComposeResponse"] <= STATE_INDEX[last_success]:
                final_response = simulate_compose_response(recipes, web_info)
                messages.append({"role": "assistant", "content": final_response})
            elif STATE_INDEX["ComposeResponse"] == STATE_INDEX[first_failure]:
                # Simulate failure
                create_llm_span(
                    "ComposeResponse",
                    "Compose response",
                    "Error: KeyError: 'proteinCount' during response assembly",
                )
                messages.append(
                    {
                        "role": "assistant",
                        "content": """Error: Unable to generate a response with the current
                        recipe and nutrition data.""",
                    }
                )
            else:
                final_response = ""
            # 10. DeliverResponse
            if STATE_INDEX["DeliverResponse"] <= STATE_INDEX[last_success]:
                delivered_response = simulate_deliver_response(final_response, True)
                messages.append({"role": "assistant", "content": delivered_response})
            elif STATE_INDEX["DeliverResponse"] == STATE_INDEX[first_failure]:
                # Simulate failure
                create_chain_span(
                    "DeliverResponse",
                    final_response,
                    "Error: Unable to deliver the response due to a communication issue.",
                    False,
                )
                messages.append(
                    {
                        "role": "assistant",
                        "content": """Error: Unable to deliver the response due
                        to a communication issue.""",
                    }
                )
            else:
                delivered_response = ""
            root_span.set_attribute(SpanAttributes.OUTPUT_VALUE, json.dumps(messages))
            root_span.set_status(Status(StatusCode.OK))

        except Exception as e:
            root_span.set_status(Status(StatusCode.ERROR))
            root_span.record_exception(e)
            messages.append({"role": "assistant", "content": f"Error: {str(e)}"})

    # Create trace objects
    raw_trace = {"conversation_id": conversation_id, "messages": messages}

    labeled_trace = {
        "conversation_id": conversation_id,
        "messages": messages,
        "last_success_state": last_success,
        "first_failure_state": first_failure,
    }

    return raw_trace, labeled_trace


def generate_traces_phoenix(
    n_traces: int = N_TRACES_DEFAULT,
    seed: int | None = None,
    max_workers: int = 32,
) -> None:
    """Generate traces with Phoenix instrumentation."""

    if seed is not None:
        random.seed(seed)

    def make_trace(_: int, retries: int = 3) -> Tuple[Dict, Dict]:
        """Generate a single trace with retry logic."""
        for attempt in range(retries):
            try:
                first_failure = pick_first_failure_state()
                last_success = select_last_success_state(first_failure)

                raw_trace, labeled_trace = generate_single_trace_with_spans(
                    last_success, first_failure
                )
                return raw_trace, labeled_trace

            except Exception as e:
                if attempt == retries - 1:
                    print(f"Failed to generate trace after {retries} attempts: {e}")
                    # Return a minimal trace
                    conversation_id = str(uuid.uuid4())
                    return (
                        {
                            "conversation_id": conversation_id,
                            "messages": [{"role": "user", "content": "test"}],
                        },
                        {
                            "conversation_id": conversation_id,
                            "messages": [{"role": "user", "content": "test"}],
                            "last_success_state": "ParseRequest",
                            "first_failure_state": "PlanToolCalls",
                        },
                    )

    # Generate traces in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(make_trace, i) for i in range(n_traces)]

        for future in tqdm(as_completed(futures), total=n_traces, desc="Generating traces"):
            future.result()


# -------------------------------------------------------------
# Main execution
# -------------------------------------------------------------


def main():
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
