# Homework 5 – Failure Analysis with Phoenix and LLM Evaluations

## Overview

Your cooking-assistant agent sometimes drops the spatula. In this assignment, you'll use **Phoenix** to collect detailed traces of a recipe chatbot pipeline and then use **LLM evaluations** to automatically detect and analyze failure patterns. You'll generate synthetic conversation traces with intentional failures, evaluate them using LLM-based failure detection, and analyze the distribution of failures across different pipeline states.

---

## Pipeline State Taxonomy

The agent's internal pipeline is abstracted to **7 canonical states**:

| #   | State             | Description                                                 |
| --- | ----------------- | ----------------------------------------------------------- |
| 1   | `ParseRequest`    | LLM interprets and analyzes the user's query                |
| 2   | `PlanToolCalls`   | LLM decides which tools to invoke and in what order         |
| 3   | `GenRecipeArgs`   | LLM constructs JSON arguments for recipe database search    |
| 4   | `GetRecipes`      | Executes the recipe-search tool to find relevant recipes    |
| 5   | `GenWebArgs`      | LLM constructs JSON arguments for web search                |
| 6   | `GetWebInfo`      | Executes the web-search tool to retrieve supplementary info |
| 7   | `ComposeResponse` | LLM drafts the final answer combining recipes and web info  |

Each trace contains one intentional failure at a randomly selected pipeline state.

---

## What you need to do

### Step 1: Set Up Phoenix and Generate Traces

**Phoenix Setup:**

1. Install Phoenix: `pip install arize-phoenix`
2. Boot up Phoenix locally: `phoenix serve`
3. Open Phoenix dashboard at http://localhost:6006

**Generate Synthetic Traces:**
The provided `generate_traces_phoenix.py` script creates synthetic conversation traces with intentional failures. You should:

- Run the trace generation script to create 100 synthetic conversation traces
- Verify that the script generates traces with intentional failures at random pipeline states
- Confirm that detailed Phoenix spans are created for each pipeline step
- Check that the traces use realistic timing and proper OpenTelemetry instrumentation

### Step 2: Load Traces from Phoenix

Load the generated traces from Phoenix for analysis. You should:

- Write code to connect to Phoenix and query the generated traces
- Filter for agent spans to get the main conversation traces
- Load the traces into a pandas DataFrame for analysis
- Verify that you can access the trace data with proper span attributes

### Step 3: Apply LLM-Based Failure Analysis

Use Phoenix's evaluation framework to automatically detect failures. You should:

- Load the evaluation prompt from the provided `eval.txt` file
- Set up an LLM evaluation model (e.g., GPT-4) with appropriate parameters
- Write a parser function to extract failure state and explanation from LLM responses
- Use Phoenix's `llm_generate` function to evaluate all traces
- Log the evaluation results back to Phoenix for visualization

### Step 4: Analyze Failure Patterns

Visualize the distribution of failures across pipeline states. You should:

- Create a bar chart showing the count of failures for each pipeline state
- Use matplotlib or another plotting library to visualize the failure distribution
- Include proper labels and title for the visualization
- Analyze which pipeline states have the most failures

### Step 5: Generate Detailed Failure Analysis

Use LLM to analyze failure patterns and propose fixes. You should:

- Create a prompt template for analyzing failures by pipeline state
- For each failure state, collect all the failure explanations
- Use an LLM to synthesize recurring failure patterns
- Generate concrete, testable fixes for each failure state
- Write validator rules that the pipeline can enforce
- Create 3-5 minimal unit tests for each failure state

### Step 6: Deliverables

1. **Failure Distribution Analysis**: Bar chart showing failures by pipeline state
2. **Detailed Failure Analysis**: LLM-generated analysis for each failure state including:
   - Recurring failure patterns
   - Proposed fixes
   - Validator rules
   - Unit tests
3. **Key Insights**: Summary of findings about where failures occur most and why

---

## File Structure

```
homeworks/hw5/
├── generate_traces_phoenix.py  # Provided script to generate synthetic traces
├── eval.txt                    # Evaluation prompt for failure detection
├── hw5_walkthrough.ipynb       # Complete walkthrough of the assignment
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

---

## About generate_traces_phoenix.py

The `generate_traces_phoenix.py` script is provided code that generates synthetic conversation traces for analysis. It is **not part of the graded assignment** but is essential for creating the data you'll analyze.

### What the script does:

1. **Creates synthetic conversations**: Generates realistic user queries about recipes
2. **Simulates pipeline states**: Implements all 7 pipeline states with realistic LLM calls
3. **Introduces intentional failures**: Randomly fails at different pipeline states for testing
4. **Instruments with Phoenix**: Creates detailed spans with proper OpenTelemetry attributes
5. **Uses realistic timing**: Adds appropriate delays to simulate real-world performance

### Key features:

- **100 synthetic traces**: Each with one intentional failure
- **Realistic failure patterns**: Failures that could occur in real systems
- **Proper Phoenix instrumentation**: Follows OpenInference semantic conventions
- **Configurable parameters**: Can adjust number of traces, failure rates, etc.

### Pipeline states implemented:

- **ParseRequest**: LLM interprets user queries (can misinterpret dietary constraints)
- **PlanToolCalls**: LLM decides tool execution order (can choose wrong tools)
- **GenRecipeArgs**: LLM constructs recipe search arguments (can use wrong search parameters)
- **GetRecipes**: Executes recipe search (can return irrelevant results)
- **GenWebArgs**: LLM constructs web search arguments (can generate off-topic queries)
- **GetWebInfo**: Executes web search (can return irrelevant information)
- **ComposeResponse**: LLM drafts final answer (can create contradictory responses)

---

## Helpful Phoenix Code

The generation script uses Phoenix's OpenTelemetry integration:

```python
from phoenix.otel import register
from opentelemetry.trace import Status, StatusCode

# Register tracer with Phoenix
tracer_provider = register(
    project_name="recipe-agent-hw5",
    batch=True,
    auto_instrument=True,
)
tracer = tracer_provider.get_tracer(__name__)

# Create spans for each pipeline state
with tracer.start_as_current_span("ParseRequest", openinference_span_kind="llm") as span:
    # Simulate LLM call
    response = chat_completion([{"role": "user", "content": prompt}])

    # Set span attributes
    span.set_attribute(SpanAttributes.INPUT_VALUE, prompt)
    span.set_attribute(SpanAttributes.OUTPUT_VALUE, response)
```

### Loading and Analyzing Traces

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

def load_traces() -> pd.DataFrame:
    query = SpanQuery().where("span_kind == 'AGENT'")
    traces_df = px.Client().query_spans(query, project_name='recipe-agent-hw5')
    return traces_df
```

### LLM-Based Evaluation

```python
from phoenix.evals import llm_generate, OpenAIModel

def parser(response: str, row_index: int) -> dict:
    """Parse evaluation results"""
    failure_state = r'"failure_state":\s*"([^"]*)"'
    explanation = r'"explanation":\s*"([^"]*)"'
    failure_state_match = re.search(failure_state, response, re.IGNORECASE).group(1)
    explanation_match = re.search(explanation, response, re.IGNORECASE).group(1)
    return {
        "label": failure_state_match,
        "explanation": explanation_match
    }

# Generate evaluations
failure_analysis = llm_generate(
    dataframe=traces_df,
    template=eval_prompt,
    model=eval_model,
    output_parser=parser,
    concurrency=10,
)

# Log evaluations
from phoenix.client import AsyncClient

px_client = AsyncClient()
await px_client.spans.log_span_annotations_dataframe(
    dataframe=failure_analysis,
    annotation_name="Failure State with Explanation",
    annotator_kind="LLM",
)
```

---

## Key Learning Objectives

1. **Phoenix Observability**: Learn to use Phoenix for LLM application monitoring
2. **LLM Evaluations**: Understand how to use LLMs to automatically evaluate other LLMs
3. **Failure Analysis**: Develop skills in identifying and analyzing failure patterns
4. **Pipeline Debugging**: Learn to debug complex LLM pipelines systematically
5. **Synthetic Data Generation**: Understand how to create realistic test data for analysis

Happy debugging! 🛠️🍳
