# Phoenix Methods Guide

This guide covers the essential Phoenix methods and how to use them for LLM evaluation and trace collection.

## Table of Contents

1. [Setup & Connection](#setup--connection)
2. [Trace Collection](#trace-collection)
3. [Data Export & Querying](#data-export--querying)
4. [Evaluation Methods](#evaluation-methods)
5. [Logging Results](#logging-results)
6. [Common Patterns](#common-patterns)

---

## Setup & Connection

### Environment Variables

```python
import os

# Required for Phoenix connection
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
os.environ["PHOENIX_API_KEY"] = "your-api-key-here"

# Optional: Set project name
os.environ["PHOENIX_PROJECT_NAME"] = "your-project-name"
```

### Basic Connection

```python
import phoenix as px

# Connect to Phoenix
client = px.Client()
```

---

## Trace Collection

### Using Phoenix OTEL

```python
from phoenix.otel import register

# Register tracer with Phoenix
tracer_provider = register(
    project_name="recipe-agent",
    batch=True,
    auto_instrument=True
)
tracer = tracer_provider.get_tracer(__name__)
```

### Creating Spans

#### Method 1: Context Manager

```python
from opentelemetry.trace import Status, StatusCode

with tracer.start_as_current_span(
    "Query_Information",
    openinference_span_kind="chain",
) as span:
    # Set span attributes
    span.set_input("user query")
    span.set_attribute("query", "user query")
    span.set_attribute("dietary_restriction", "vegan")
    
    # Your code here
    response = "recipe response"
    
    # Set output and status
    span.set_output(response)
    span.set_status(Status(StatusCode.OK))
```

#### Method 2: Decorator

```python
@tracer.chain
def my_function(input_text: str) -> str:
    # This entire function becomes a span
    return "output"
```

### Span Kinds

| Kind | Use Case |
|------|----------|
| `CHAIN` | General logic operations, functions |
| `LLM` | Making LLM calls |
| `TOOL` | Tool calls |
| `RETRIEVER` | Document retrieval |
| `AGENT` | Agent invocations |
| `EMBEDDING` | Generating embeddings |

---

## Data Export & Querying

### Basic Span Querying

```python
from phoenix.trace.dsl import SpanQuery

# Get all spans
all_spans = px.Client().get_spans_dataframe()

# Query specific spans
query = SpanQuery().where("span_kind == 'CHAIN'")
chain_spans = px.Client().query_spans(query, project_name='recipe-agent')
```

### Advanced Querying

#### Filtering by Attributes

```python
# Filter by span kind and attributes
query = SpanQuery().where(
    "span_kind == 'CHAIN' and 'vegan' in attributes.dietary_restriction"
)

# Filter by evaluation results
query = SpanQuery().where(
    "evals['correctness'].label == 'incorrect'"
)

# Filter spans without evaluations
query = SpanQuery().where(
    "evals['correctness'].label is None"
)
```

#### Selecting Specific Attributes

```python
# Select input and output values
query = SpanQuery().where("span_kind == 'LLM'").select(
    input="input.value",
    output="output.value"
)

# Rename columns
query = SpanQuery().select(
    user_query="input.value",
    bot_response="output.value"
)
```

#### Time-based Filtering

```python
from datetime import datetime, timedelta

# Get spans from last 7 days
start_time = datetime.now() - timedelta(days=7)
end_time = datetime.now()

spans = px.Client().query_spans(
    query,
    start_time=start_time,
    end_time=end_time
)
```

### Pre-defined Queries

```python
from phoenix.trace.dsl.helpers import get_called_tools
from phoenix.session.evaluation import get_retrieved_documents, get_qa_with_reference

# Get tool calls
tools_df = get_called_tools(client)

# Get retrieved documents
retrieved_docs = get_retrieved_documents(client)

# Get Q&A with reference data
qa_data = get_qa_with_reference(client)
```

---

## Evaluation Methods

### Categorical Evaluation (`llm_classify`)

```python
from phoenix.evals import llm_classify, OpenAIModel

# Define template
template = """
You are evaluating whether a recipe adheres to dietary restrictions.
Question: {query}
Dietary Restriction: {dietary_restriction}
Recipe Response: {output}

Return only: PASS or FAIL
"""

# Run evaluation
results = llm_classify(
    dataframe=your_dataframe,
    template=template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    rails=["PASS", "FAIL"]
)
```

### Numeric Evaluation (`llm_generate`)

```python
from phoenix.evals import llm_generate, OpenAIModel
import re

# Define template
template = """
Evaluate the quality of this recipe response on a scale of 1-10.
Question: {query}
Response: {output}

Return only: "score: X" where X is a number 1-10
"""

# Output parser function
def score_parser(output: str, row_index: int):
    pattern = r"score:\s*(\d+)"
    match = re.search(pattern, output, re.IGNORECASE)
    return {"score": int(match.group(1)) if match else None}

# Run evaluation
results = llm_generate(
    dataframe=your_dataframe,
    template=template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    output_parser=score_parser,
    include_prompt=True,
    include_response=True
)
```

### Complex Evaluation with Custom Parser

```python
def output_parser(output: str, row_index: int) -> Dict[str, Any]:
    """Parse LLM output to extract structured data."""
    label_pattern = r'"label":\s*"([^"]*)"'
    explanation_pattern = r'"explanation":\s*"([^"]*)"'
    
    label_match = re.search(label_pattern, output, re.IGNORECASE)
    explanation_match = re.search(explanation_pattern, output, re.IGNORECASE)
    
    return {
        "label": label_match.group(1) if label_match else None,
        "explanation": explanation_match.group(1) if explanation_match else None,
    }

# Use in evaluation
results = llm_generate(
    dataframe=df,
    template=your_template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    output_parser=output_parser,
    include_prompt=True,
    include_response=True
)
```

---

## Logging Results

### Logging Evaluations to Phoenix

```python
from phoenix.trace import SpanEvaluations

# Log evaluation results
px.Client().log_evaluations(
    SpanEvaluations(
        eval_name="LLM-as-Judge Evaluation", 
        dataframe=results
    )
)
```

### Merging Results with Original Data

```python
# Merge evaluation results with original traces
merged_results = pd.merge(results, original_traces, left_index=True, right_index=True)

# Rename columns to avoid conflicts
merged_results.rename(columns={
    "label": "llm_as_judge_label",
    "explanation": "llm_as_judge_explanation"
}, inplace=True)
```

---

## Common Patterns

### Complete Evaluation Pipeline

```python
import phoenix as px
from phoenix.evals import llm_generate, OpenAIModel
from phoenix.trace.dsl import SpanQuery
from phoenix.trace import SpanEvaluations
import pandas as pd
import os

# 1. Load traces from Phoenix
query = SpanQuery().where("span_kind == 'CHAIN'")
traces_df = px.Client().query_spans(query, project_name='recipe-agent')

# 2. Define evaluation template
template = """
Evaluate this recipe response for dietary adherence.
Query: {attributes.query}
Dietary Restriction: {attributes.dietary_restriction}
Response: {attributes.output.value}

Return: {"label": "PASS/FAIL", "explanation": "your reasoning"}
"""

# 3. Define output parser
def output_parser(output: str, row_index: int):
    import re
    label_pattern = r'"label":\s*"([^"]*)"'
    explanation_pattern = r'"explanation":\s*"([^"]*)"'
    
    label_match = re.search(label_pattern, output, re.IGNORECASE)
    explanation_match = re.search(explanation_pattern, output, re.IGNORECASE)
    
    return {
        "label": label_match.group(1) if label_match else None,
        "explanation": explanation_match.group(1) if explanation_match else None,
    }

# 4. Run evaluation
results = llm_generate(
    dataframe=traces_df,
    template=template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    output_parser=output_parser,
    include_prompt=True,
    include_response=True
)

# 5. Merge with original data
final_results = pd.merge(results, traces_df, left_index=True, right_index=True)

# 6. Log to Phoenix
px.Client().log_evaluations(
    SpanEvaluations(eval_name="Dietary Adherence Evaluation", dataframe=final_results)
)
```

### Error Handling

```python
def safe_query_spans(client, query, project_name='default'):
    """Safely query spans with error handling."""
    try:
        results = client.query_spans(query, project_name=project_name)
        if results.empty:
            print("No traces found in Phoenix!")
            return pd.DataFrame()
        return results
    except Exception as e:
        print(f"Error loading traces from Phoenix: {str(e)}")
        print("Please check your Phoenix configuration.")
        return pd.DataFrame()
```

### Data Validation

```python
def validate_traces_df(df):
    """Validate that traces dataframe has required columns."""
    required_columns = ['attributes.query', 'attributes.output.value']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        print(f"Missing required columns: {missing_columns}")
        return False
    
    if df.empty:
        print("DataFrame is empty!")
        return False
    
    return True
```

---

## Best Practices

### 1. **Always include error handling** when querying Phoenix
### 2. **Use output parsers** for structured LLM responses
### 3. **Merge results carefully** to avoid column name conflicts
### 4. **Log evaluations** to Phoenix for dashboard visibility
### 5. **Sample data appropriately** to manage API costs
### 6. **Use descriptive eval names** when logging to Phoenix
### 7. **Validate data** before running evaluations
### 8. **Use environment variables** for configuration

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `TypeError: Object of type int64 is not JSON serializable` | Cast numpy types to native Python: `int(len(df))`, `float(score)` |
| `AttributeError: 'list' object has no attribute 'iterrows'` | Ensure you're working with DataFrames, not lists |
| `ValueError: The truth value of a DataFrame is ambiguous` | Use `.empty` instead of boolean check: `if df.empty:` |
| Column name conflicts after merge | Rename columns explicitly: `df.rename(columns={...})` |

---

## Quick Reference

### Essential Imports
```python
import phoenix as px
from phoenix.evals import llm_generate, llm_classify, OpenAIModel
from phoenix.trace.dsl import SpanQuery
from phoenix.trace import SpanEvaluations
from phoenix.otel import register
```

### Key Methods
- `px.Client().query_spans(query)` - Query spans from Phoenix
- `llm_generate(dataframe, template, model, output_parser)` - Run LLM evaluation
- `llm_classify(dataframe, template, model, rails)` - Run classification evaluation
- `px.Client().log_evaluations(SpanEvaluations(...))` - Log results to Phoenix
- `register(project_name, batch=True)` - Set up Phoenix tracing

### Environment Variables
- `PHOENIX_COLLECTOR_ENDPOINT` - Phoenix server endpoint
- `PHOENIX_API_KEY` - Your API key
- `PHOENIX_PROJECT_NAME` - Project name (optional)
- `OPENAI_API_KEY` - OpenAI API key for evaluations 