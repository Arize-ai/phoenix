"""
End-to-end example: Log LLM spans, retrieve them, and create a dataset with span associations.

This example demonstrates the complete workflow of:
1. Setting up tracing with phoenix-otel
2. Logging LLM spans using OpenInference decorators
3. Querying spans back from Phoenix using get_spans_dataframe
4. Creating a dataset where each example is linked back to its originating span

Prerequisites:
    - Phoenix server running (default: http://localhost:6006)
    - Install dependencies:
        pip install phoenix-client arize-phoenix-otel pandas

Usage:
    python create_dataset_from_spans_example.py
"""

import json
import time
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from phoenix.client import Client
from phoenix.otel import register

# =============================================================================
# Configuration
# =============================================================================

PHOENIX_BASE_URL = "http://localhost:6006"
PROJECT_NAME = "llm-dataset-example"
DATASET_NAME = f"qa-from-spans-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

# =============================================================================
# Step 1: Set up Tracing with phoenix-otel
# =============================================================================

# Register phoenix-otel with simple configuration
# This automatically configures OpenTelemetry to send traces to Phoenix
tracer_provider = register(
    project_name=PROJECT_NAME,
    endpoint=f"{PHOENIX_BASE_URL}/v1/traces",
    protocol="http/protobuf",
)

# Get a tracer with OpenInference decorators
tracer = tracer_provider.get_tracer(__name__)

# =============================================================================
# Step 2: Simulate LLM Calls using OpenInference Decorators
# =============================================================================

# Sample Q&A data to simulate LLM interactions
QA_SAMPLES = [
    {
        "question": "What is machine learning?",
        "answer": "Machine learning is a subset of artificial intelligence that enables "
        "systems to learn and improve from experience without being explicitly programmed.",
        "model": "gpt-4",
        "tokens": 42,
    },
    {
        "question": "Explain the difference between supervised and unsupervised learning.",
        "answer": "Supervised learning uses labeled data to train models to predict outputs, "
        "while unsupervised learning finds patterns in unlabeled data without predefined outputs.",
        "model": "gpt-4",
        "tokens": 38,
    },
    {
        "question": "What is a neural network?",
        "answer": "A neural network is a computational model inspired by biological neurons, "
        "consisting of interconnected nodes organized in layers that process information.",
        "model": "gpt-4",
        "tokens": 35,
    },
    {
        "question": "How does gradient descent work?",
        "answer": "Gradient descent is an optimization algorithm that iteratively adjusts "
        "parameters by moving in the direction of steepest descent of the loss function.",
        "model": "gpt-4",
        "tokens": 33,
    },
    {
        "question": "What is overfitting in machine learning?",
        "answer": "Overfitting occurs when a model learns the training data too well, "
        "including noise, resulting in poor generalization to new, unseen data.",
        "model": "gpt-4",
        "tokens": 31,
    },
]


def simulate_llm_call(qa_sample: dict[str, Any]) -> str:
    """
    Simulate an LLM call using the tracer's context manager with OpenInference span kind.

    Returns the span_id for later reference.
    """
    # Use the tracer's context manager with openinference_span_kind="llm"
    with tracer.start_as_current_span(
        "llm_inference",
        openinference_span_kind="llm",
    ) as span:
        # Set input using the span helper method
        span.set_input({"question": qa_sample["question"]})

        # Set LLM-specific attributes
        span.set_attribute("llm.model_name", qa_sample["model"])
        span.set_attribute("llm.token_count.total", qa_sample["tokens"])

        # Simulate processing time
        time.sleep(0.1)

        # Set output using the span helper method
        span.set_output({"answer": qa_sample["answer"]})

        # Get the span context to retrieve the span_id
        span_context = span.get_span_context()
        span_id = format(span_context.span_id, "016x")

        return span_id


def log_llm_spans() -> None:
    """
    Log multiple LLM spans to Phoenix.
    """
    for qa_sample in QA_SAMPLES:
        span_id = simulate_llm_call(qa_sample)
        question = str(qa_sample["question"])
        print(f"  Logged span {span_id}: {question[:40]}...")


# =============================================================================
# Step 3: Query Spans from Phoenix using get_spans_dataframe
# =============================================================================


def query_spans_dataframe(client: Client) -> pd.DataFrame:
    """
    Query spans from Phoenix and return as a DataFrame.

    The DataFrame includes a 'context.span_id' column that can be used
    to link dataset examples back to their source spans.
    """
    # Query spans from the project using get_spans_dataframe
    # This returns a DataFrame with columns like:
    # - context.span_id, context.trace_id
    # - name, span_kind, status_code
    # - attributes (flattened, e.g., input.value, output.value, llm.model_name)
    spans_df = client.spans.get_spans_dataframe(
        project_identifier=PROJECT_NAME,
        start_time=datetime.now(timezone.utc).replace(hour=0, minute=0, second=0),
        limit=100,
    )

    print(f"\nQueried {len(spans_df)} spans from project '{PROJECT_NAME}'")
    print(f"DataFrame columns: {list(spans_df.columns)[:10]}...")

    return spans_df


def _parse_json_value(value: Any) -> Any:
    """Parse a JSON string, returning the parsed value or original if not JSON."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def prepare_dataset_from_spans_df(spans_df: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare a dataset DataFrame from the spans DataFrame.

    Extracts the relevant columns and renames them for the dataset.

    Note: get_spans_dataframe returns a DataFrame where:
    - context.span_id is typically the INDEX (not a column)
    - Attributes are prefixed with 'attributes.' (e.g., attributes.input.value)
    - input.value and output.value are JSON strings that need to be parsed
    """
    # Work with a copy to avoid mutating the original
    df = spans_df.copy()

    # Get span_id - it may be the index or a column
    if df.index.name == "context.span_id" and "context.span_id" not in df.columns:
        df = df.reset_index()

    # Parse the JSON strings in input.value and output.value
    # The values are stored as JSON strings like '{"question": "What is ML?"}'
    # We want to extract just the inner value (e.g., "What is ML?")
    inputs = df["attributes.input.value"].apply(_parse_json_value)
    outputs = df["attributes.output.value"].apply(_parse_json_value)

    # Extract the actual question/answer from the parsed dicts
    # Our spans have structure: {"question": "..."} and {"answer": "..."}
    questions = inputs.apply(lambda x: x.get("question", x) if isinstance(x, dict) else x)
    answers = outputs.apply(lambda x: x.get("answer", x) if isinstance(x, dict) else x)

    # Build the dataset DataFrame
    dataset_df = df[["context.span_id"]].copy()
    dataset_df["question"] = questions
    dataset_df["answer"] = answers
    dataset_df["model"] = df["attributes.llm.model_name"]

    if "attributes.llm.token_count.total" in df.columns:
        dataset_df["tokens"] = df["attributes.llm.token_count.total"]

    return dataset_df


# =============================================================================
# Step 4: Create Dataset with Span Associations
# =============================================================================


def create_dataset_from_spans_df(client: Client, dataset_df: pd.DataFrame) -> None:
    """
    Create a dataset from the prepared DataFrame with span_id associations.

    Uses 'context.span_id' column to link each example back to its source span.
    """
    if dataset_df.empty:
        print("No data to create dataset from.")
        return

    # Verify required columns exist
    required_cols = ["context.span_id", "question", "answer"]
    missing_cols = [col for col in required_cols if col not in dataset_df.columns]
    if missing_cols:
        print(f"Missing required columns: {missing_cols}")
        print(f"Available columns: {list(dataset_df.columns)}")
        print("Cannot create dataset without question/answer columns.")
        return

    print("\nPrepared DataFrame for dataset:")
    print(dataset_df.head().to_string())
    print()

    # Build metadata_keys based on available columns
    metadata_keys = []
    if "model" in dataset_df.columns:
        metadata_keys.append("model")
    if "tokens" in dataset_df.columns:
        metadata_keys.append("tokens")

    # Create the dataset with span_id_key to link examples to spans
    # The key 'context.span_id' matches the column name from get_spans_dataframe
    dataset = client.datasets.create_dataset(
        name=DATASET_NAME,
        dataframe=dataset_df,
        input_keys=["question"],
        output_keys=["answer"],
        metadata_keys=metadata_keys,
        span_id_key="context.span_id",  # Links examples back to their source spans
        dataset_description="Q&A dataset created from LLM spans with trace associations",
    )

    print(f"Created dataset: {dataset.name}")
    print(f"  Dataset ID: {dataset.id}")
    print(f"  Version ID: {dataset.version_id}")
    print(f"  Example count: {len(dataset)}")

    # Display first few examples
    print("\nDataset examples (linked to spans):")
    examples = list(dataset.examples)[:3]
    for i, example in enumerate(examples):
        print(f"\n  Example {i + 1}:")
        print(f"    ID: {example['id']}")
        input_str = str(example["input"])[:60]
        print(f"    Input: {input_str}...")
        output_str = str(example["output"])[:60]
        print(f"    Output: {output_str}...")

    print("\n  [Span associations are visible in the Phoenix UI]")


# =============================================================================
# Main Execution
# =============================================================================


def main() -> None:
    print("=" * 60)
    print("Phoenix Dataset from Spans - End-to-End Example")
    print("=" * 60)
    print("\nUsing phoenix-otel for simplified tracing setup")

    # Initialize Phoenix client
    client = Client(base_url=PHOENIX_BASE_URL)
    print(f"Connected to Phoenix at {PHOENIX_BASE_URL}")

    # Tracer is already set up at module level via register()
    print(f"Tracing configured for project: {PROJECT_NAME}")

    # Step 1: Log LLM spans using OpenInference decorators/context managers
    print("\n[Step 1] Logging LLM spans with OpenInference semantics...")
    log_llm_spans()

    # Give Phoenix time to process the spans
    print("\nWaiting for spans to be processed...")
    time.sleep(2)

    # Step 2: Query spans back from Phoenix using get_spans_dataframe
    print("\n[Step 2] Querying spans from Phoenix using get_spans_dataframe...")
    spans_df = query_spans_dataframe(client)

    # Step 3: Prepare the DataFrame for dataset creation
    print("\n[Step 3] Preparing dataset from spans DataFrame...")
    dataset_df = prepare_dataset_from_spans_df(spans_df)

    # Step 4: Create dataset with span associations
    print("\n[Step 4] Creating dataset with span associations...")
    create_dataset_from_spans_df(client, dataset_df)

    print("\n" + "=" * 60)
    print("Example complete!")
    print(f"View your datasets at: {PHOENIX_BASE_URL}/datasets")
    print(f"  (Look for dataset: '{DATASET_NAME}')")
    print(f"View your traces at: {PHOENIX_BASE_URL}/projects")
    print(f"  (Look for project: '{PROJECT_NAME}')")
    print("=" * 60)


if __name__ == "__main__":
    main()
