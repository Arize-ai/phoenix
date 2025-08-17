# Homework 5 – Failure Analysis with Phoenix and LLM Evaluations

## Overview
Your cooking-assistant agent sometimes drops the spatula. In this assignment, you'll use **Phoenix** to collect detailed traces of a recipe chatbot pipeline and then use **LLM evaluations** to automatically detect and analyze failure patterns. You'll generate synthetic conversation traces with intentional failures, evaluate them using LLM-based failure detection, and analyze the distribution of failures across different pipeline states.

---
## Pipeline State Taxonomy
The agent's internal pipeline is abstracted to **9 canonical states**:

| # | State | Description |
|---|--------------------|-------------------------------------------|
| 1 | `ParseRequest`     | LLM interprets and analyzes the user's query |
| 2 | `PlanToolCalls`    | LLM decides which tools to invoke and in what order |
| 3 | `GenCustomerArgs`  | LLM constructs JSON arguments for customer profile DB |
| 4 | `GetCustomerProfile` | Executes the customer-profile tool to retrieve user preferences |
| 5 | `GenRecipeArgs`    | LLM constructs JSON arguments for recipe database search |
| 6 | `GetRecipes`       | Executes the recipe-search tool to find relevant recipes |
| 7 | `GenWebArgs`       | LLM constructs JSON arguments for web search |
| 8 | `GetWebInfo`       | Executes the web-search tool to retrieve supplementary info |
| 9 | `ComposeResponse`  | LLM drafts the final answer combining recipes and web info |

Each trace contains one intentional failure at a randomly selected pipeline state.

---
## What you need to do

### Step 1: Set Up Phoenix and Generate Traces

**Phoenix Setup:**
1. Install Phoenix: `pip install arize-phoenix`
2. Boot up Phoenix locally: `phoenix serve`
3. Open Phoenix dashboard at http://localhost:6006

**Generate Synthetic Traces:**
The provided `generate_traces_phoenix.py` script creates synthetic conversation traces with intentional failures:

```python
# Run the trace generation script
%run generate_traces_phoenix.py
```

This script:
- Generates 100 synthetic conversation traces
- Intentionally introduces failures at random pipeline states
- Creates detailed Phoenix spans for each pipeline step
- Uses realistic timing and proper OpenTelemetry instrumentation

### Step 2: Load Traces from Phoenix

Load the generated traces from Phoenix for analysis:

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

def load_traces() -> pd.DataFrame:
    query = SpanQuery().where("span_kind == 'AGENT'")
    traces_df = px.Client().query_spans(query, project_name='recipe-agent-hw5')
    return traces_df

# Load traces from Phoenix
traces_df = load_traces()
```

### Step 3: Apply LLM-Based Failure Analysis

Use Phoenix's evaluation framework to automatically detect failures:

```python
from phoenix.evals import llm_generate, OpenAIModel
from phoenix.trace import SpanEvaluations

# Load evaluation prompt
with open("eval.txt", "r") as f:
    eval_prompt = f.read()

# Set up evaluation model
eval_model = OpenAIModel(
    model="gpt-4o",
    model_kwargs={
        "response_format": {"type": "json_object"},
        "temperature": 0
    }
)

# Generate evaluations
failure_analysis = llm_generate(
    dataframe=traces_df,
    template=eval_prompt,
    model=eval_model,
    output_parser=parser,
    concurrency=10,
)

# Log evaluations to Phoenix
px.Client().log_evaluations(
    SpanEvaluations(eval_name="Failure State with Explanation", dataframe=failure_analysis)
)
```

### Step 4: Analyze Failure Patterns

Visualize the distribution of failures across pipeline states:

```python
import matplotlib.pyplot as plt

# Count failures by state
counts = failure_analysis["label"].value_counts()

plt.figure(figsize=(8, 6))
counts.plot(kind="bar")
plt.title("Failure Distribution by Pipeline State")
plt.xlabel("Pipeline State")
plt.ylabel("Number of Failures")
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()
```

### Step 5: Generate Detailed Failure Analysis

Use LLM to analyze failure patterns and propose fixes:

```python
from openai import OpenAI

PER_CLASS_PROMPT = """You are auditing failures for the state: {label}.

You will receive many short "explanations" describing material defects detected by an evaluator. Your tasks:
1) Synthesize recurring failure patterns without changing their meaning.
2) Propose concrete, testable fixes that reduce these failures at the source state.
3) Write validator rules the pipeline can enforce before leaving this state.
4) Provide 3–5 minimal unit tests that should fail now and pass after the fixes.

- Upstream context: {trace}
- Explanations (one per line):
{joined_explanations}
"""

client = OpenAI()
results = {}

for label, group in failure_analysis.groupby("label"):
    exps = group["explanation"].astype(str).tolist()
    joined = "\n".join(f"- {e}" for e in exps)
    prompt = PER_CLASS_PROMPT.replace("{label}", label)
    prompt = prompt.replace("{trace}", group["trace"].astype(str).to_string())
    prompt = prompt.replace("{joined_explanations}", joined)
    response = client.responses.create(
        model="gpt-4o",
        input=prompt,
    )
    results[label] = response.output_text
```

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
2. **Simulates pipeline states**: Implements all 9 pipeline states with realistic LLM calls
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
- **GenCustomerArgs**: LLM constructs customer DB arguments (can use wrong preferences)
- **GetCustomerProfile**: Executes customer profile tool (can return inconsistent data)
- **GenRecipeArgs**: LLM constructs recipe search arguments (most failure-prone state)
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
px.Client().log_evaluations(
    SpanEvaluations(eval_name="Failure State with Explanation", dataframe=failure_analysis)
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
