# Session-Level Evaluations

## When To Use Session-Level Evaluations

Session-level evaluations assess the effectiveness and correctness of AI agent interactions across an entire conversation or session, rather than individual traces or interactions. A session consists of multiple traces (individual interactions) between a user and your AI system.

Session-level evaluations are crucial for assessing:

* **Coherence across multiple interactions** - Whether the agent maintains logical flow throughout the conversation
* **Context retention between interactions** - How well the agent remembers and builds upon previous exchanges  
* **Overall goal achievement** - Whether the session successfully accomplishes the user's objectives
* **Conversational progression** - How appropriately the agent guides users through complex multi-step tasks

{% hint style="info" %}
Session-level evaluations require your traces to be instrumented with `session.id` attributes to group interactions into sessions. See the [Sessions documentation](../../../tracing/features-tracing/sessions.md) for instructions on adding session and user IDs to your spans.
{% endhint %}

## Prerequisites

Before running session-level evaluations, ensure you have:

1. **Instrumented traces with session IDs** - Your application traces must include `session.id` attributes
2. **Multiple interactions per session** - Sessions should contain multiple related traces to evaluate conversational flow
3. **Required dependencies** - Install the necessary Python packages:

```bash
pip install -qq arize-phoenix "arize-phoenix[evals]>=8.8.0" "openai>=1" nest_asyncio pandas
```

## Session Evaluation Template

The session evaluation uses an LLM-as-a-judge approach to assess conversational effectiveness. Here's the evaluation prompt template:

```python
SESSION_CORRECTNESS_PROMPT = """
You are a helpful AI bot that evaluates the effectiveness and correctness of an AI agent's session.

A session consists of multiple traces (interactions) between a user and an AI system. I will provide you with:
1. The user inputs that initiated each trace in the session, in chronological order
2. The AI's output messages for each trace in the session, in chronological order
3. The total number of traces in this session

An effective and correct session:
- Shows consistent understanding of user intentions across traces
- Maintains context and coherence between interactions
- Successfully achieves the overall user goals
- Builds upon previous interactions in the conversation
- Avoids unnecessary repetition or confusion

##

User Inputs:
{user_inputs}

Output Messages:
{output_messages}

##

Evaluate the session based on the given criteria:
- Assess whether the agent maintains coherence throughout the session
- Analyze if the session progresses logically toward resolving user requests
- Check if the agent effectively uses context from previous interactions

Your response must be a single string, either `correct` or `incorrect`, and must not include any additional text.

- Respond with `correct` if the session effectively accomplishes user goals with appropriate responses and coherence.
- Respond with `incorrect` if the session shows confusion, inappropriate responses, or fails to accomplish user goals.
"""
```

## How To Run Session-Level Evaluations

### Step 1: Configure API Keys and Load Data

```python
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import nest_asyncio
import pandas as pd

import phoenix as px
from phoenix.evals import OpenAIModel, llm_classify
from phoenix.trace import SpanEvaluations

# Enable phoenix.evals concurrency inside Jupyter Notebooks
nest_asyncio.apply()

# Configure API keys
os.environ["OPENAI_API_KEY"] = "your-openai-api-key-here"
os.environ["PHOENIX_API_KEY"] = "your-phoenix-api-key-here" #For phoenix Cloud

# Configuration parameters
MODEL_NAME = "gpt-4o-mini"
PROJECT_NAME = "your-project-name"

# Set Phoenix endpoint
# For local Phoenix: "http://localhost:6006"
# For hosted Phoenix: "https://app.phoenix.arize.com"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"

# Set API key as header (required for Phoenix Cloud instances created before June 24th, 2025)
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={os.getenv('PHOENIX_API_KEY')}"
```

### Step 2: Load Session Data from Phoenix

```python
client = px.Client()

# Pull spans for the last X days to avoid gigantic dataframes. Adjust as needed.
START_TIME = datetime.now() - timedelta(days=7)
END_TIME = datetime.now()

print(f"📊 Loading session data from project: {PROJECT_NAME}")
primary_df = client.query_spans(start_time=START_TIME, end_time=END_TIME, project_name=PROJECT_NAME)

print(f"   → Retrieved {len(primary_df):,} spans")
```

### Step 3: Filter and Prepare Session Data

The helper functions below process and filter session data for evaluation:

```python
def _apply_filter(df: pd.DataFrame, column: str, operator: str, value: Any):
    """Lightweight filter helper supporting the ops used in this script."""
    if operator == "==":
        return df[df[column] == value]
    if operator == "!=":
        return df[df[column] != value]
    if operator == "contains":
        return df[df[column].astype(str).str.contains(str(value), case=False, na=False)]
    if operator == "isna":
        return df[df[column].isna()]
    if operator == "notna":
        return df[df[column].notna()]
    raise ValueError(f"Unsupported operator: {operator}")


def filter_sessions_by_trace_criteria(
    df: pd.DataFrame,
    trace_filters: Optional[Dict[str, Dict[str, Any]]] = None,
    span_filters: Optional[Dict[str, Dict[str, Any]]] = None,
) -> pd.DataFrame:
    """Return the *full* set of spans for any session that matches the filter.

    This mirrors the behaviour of the Arize exporter version but operates on
    a Phoenix span dataframe instead.
    """

    trace_filters = trace_filters or {}
    span_filters = span_filters or {}

    filtered_df = df.copy()

    # Apply trace-level filters first
    for column, criteria in trace_filters.items():
        for op, val in criteria.items():
            filtered_df = _apply_filter(filtered_df, column, op, val)

    # Apply span-level filters next
    for column, criteria in span_filters.items():
        for op, val in criteria.items():
            filtered_df = _apply_filter(filtered_df, column, op, val)

    # Guard – ensure session column exists (using the actual Phoenix column name)
    if "attributes.session.id" not in filtered_df.columns:
        raise ValueError(
            "Phoenix dataframe missing 'attributes.session.id' column – ensure your traces are session-aware."
        )

    matching_session_ids = filtered_df["attributes.session.id"].unique().tolist()
    print(f"🔍  Found {len(matching_session_ids)} matching sessions")

    # Return *all* spans for those sessions so we have full context
    return df[df["attributes.session.id"].isin(matching_session_ids)].copy()


def prepare_session_data_for_evaluation(
    df: pd.DataFrame,
    extract_cols: Optional[Dict[str, str]] = None,
) -> pd.DataFrame:
    """Group spans by session & trace chronology → tidy df for evaluation."""

    extract_cols = extract_cols or {
        "user_inputs": "attributes.input.value",
        "output_messages": "attributes.output.value",
    }

    required_cols = {"attributes.session.id", "context.trace_id", "start_time"}
    if not required_cols.issubset(df.columns):
        missing = required_cols - set(df.columns)
        raise ValueError(f"Missing required columns: {missing}")

    # Group spans by session (using the actual Phoenix column name)
    sessions = []
    for session_id, session_df in df.groupby("attributes.session.id"):
        trace_ids = session_df["context.trace_id"].unique().tolist()
        # Order traces chronologically
        trace_ids.sort(
            key=lambda tid: session_df.loc[
                session_df["context.trace_id"] == tid, "start_time"
            ].min()
        )

        session_dict: Dict[str, Any] = {
            "session.id": session_id,
            "trace_count": len(trace_ids),
        }

        for key, source_col in extract_cols.items():
            trace_data = []
            for idx, tid in enumerate(trace_ids, start=1):
                values = (
                    session_df.loc[session_df["context.trace_id"] == tid, source_col]
                    .dropna()
                    .tolist()
                )
                if values:
                    trace_data.append({str(idx): values})
            session_dict[key] = trace_data

        sessions.append(session_dict)

    return pd.DataFrame(sessions)
```

### Step 4: Filter Sessions and Build Evaluation Dataset

```python
ROOT_SPAN_FILTER = {"parent_id": {"isna": True}}

print("🧹  Filtering to root spans and building evaluation dataset …")
root_df = filter_sessions_by_trace_criteria(
    df=primary_df,
    span_filters=ROOT_SPAN_FILTER,
)

sessions_df = prepare_session_data_for_evaluation(
    df=root_df,
    extract_cols={
        "user_inputs": "attributes.input.value",
        "output_messages": "attributes.output.value",
    },
)

print(f"   → Prepared {len(sessions_df):,} sessions for evaluation")
```

### Step 5: Run LLM-Based Session Evaluation

```python
SESSION_CORRECTNESS_PROMPT = """
You are a helpful AI bot that evaluates the effectiveness and correctness of an AI agent's session.

A session consists of multiple traces (interactions) between a user and an AI system. I will provide you with:
1. The user inputs that initiated each trace in the session, in chronological order
2. The AI's output messages for each trace in the session, in chronological order
3. The total number of traces in this session

An effective and correct session:
- Shows consistent understanding of user intentions across traces
- Maintains context and coherence between interactions
- Successfully achieves the overall user goals
- Builds upon previous interactions in the conversation
- Avoids unnecessary repetition or confusion

##

User Inputs:
{user_inputs}

Output Messages:
{output_messages}

##

Evaluate the session based on the given criteria:
- Assess whether the agent maintains coherence throughout the session
- Analyze if the session progresses logically toward resolving user requests
- Check if the agent effectively uses context from previous interactions

Your response must be a single string, either `correct` or `incorrect`, and must not include any additional text.

- Respond with `correct` if the session effectively accomplishes user goals with appropriate responses and coherence.
- Respond with `incorrect` if the session shows confusion, inappropriate responses, or fails to accomplish user goals.
"""

print("🤖  Running LLM evaluations … (this may take a while)")

# Set up the evaluation model
openai_model = OpenAIModel(model=MODEL_NAME, api_key=os.getenv("OPENAI_API_KEY"))
rails = ["correct", "incorrect"]

# Run the evaluation (using updated parameter name)
results_df = llm_classify(
    data=sessions_df,
    template=SESSION_CORRECTNESS_PROMPT,
    model=openai_model,
    rails=rails,
    provide_explanation=True,
    concurrency=20,
)

print("✅  LLM evaluation complete")
```

### Step 6: Log Results Back to Phoenix

```python
# Prepare data for Phoenix logging
root_spans = (
    primary_df.loc[primary_df["parent_id"].isna(), ["attributes.session.id", "context.span_id"]]
    .drop_duplicates(subset=["attributes.session.id"], keep="first")
    .rename(columns={"context.span_id": "span_id_root", "attributes.session.id": "session.id"})
)

final_df = sessions_df.join(results_df).merge(
    root_spans, left_on="session.id", right_on="session.id", how="left"
)

# Prepare dataframe for Phoenix ingestion – Phoenix expects context.span_id index
ingest_df = final_df.set_index("span_id_root")[["label", "explanation"]]
# Phoenix expects the index to be named 'context.span_id'
ingest_df.index.name = "context.span_id"

# Log evaluations back to Phoenix
if ingest_df.index.notna().all() and len(ingest_df):
    print("\n🚀  Logging evaluations back to Phoenix …")
    client.log_evaluations(
        SpanEvaluations(
            dataframe=ingest_df,
            eval_name="Session Correctness",
        )
    )
    print("🎉  Evaluations logged! View them in the Phoenix UI → Evaluations tab.")
else:
    print("\n⚠️  Not logging to Phoenix – span_id mapping incomplete.")
```

### Step 7: Visualize your data in the Dashboard

![Session Evaluation Example](https://storage.googleapis.com/arize-phoenix-assets/assets/images/session-evals.png)

## Related Documentation

* [Session Evaluation Notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_session.ipynb)
* [Sessions Documentation](../../../tracing/features-tracing/sessions.md) - Learn how to instrument your traces with session IDs
* [LLM as a Judge](../../concepts-evals/llm-as-a-judge.md) - Understand the evaluation methodology
* [Agent Evaluation](../../llm-evals/agent-evaluation.md) - Related evaluation patterns for agent systems 