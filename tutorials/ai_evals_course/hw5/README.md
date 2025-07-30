# Homework 5 – Failure Transition Heat-Map with Phoenix

## Overview
Your cooking-assistant agent sometimes drops the spatula.  Every
conversation trace in this assignment contains **one failure**.  Your job is
pure analysis: given pre-labeled traces from Phoenix, build a transition matrix that shows
where the agent succeeds last and where it fails first, then visualize the
result as a heat-map and explain the patterns you see.

You do **not** need to call any LLMs or generate any additional data.  All
classification work has already been done for you.

## Understanding Phoenix in This Assignment

**Phoenix** is an observability platform that helps you collect, trace, and analyze LLM applications. In this assignment, you'll use Phoenix to:

1. **Collect Recipe Bot traces**: Automatically capture user queries, bot responses, and pipeline state transitions
2. **Load pre-labeled traces**: Retrieve traces with failure state annotations from Phoenix
3. **Analyze failure patterns**: Build transition matrices and visualize failure heatmaps
4. **Monitor failure patterns**: Track where failures occur most frequently in the pipeline

### Key Phoenix Concepts You'll Use:

- **Spans**: Individual units of work (e.g., a single Recipe Bot query-response with pipeline states)
- **SpanQuery**: Query language to filter and retrieve specific traces
- **Span Attributes**: Metadata stored with each trace (last_success_state, first_failure_state)
- **Phoenix Dashboard**: Visualize your failure analysis and patterns

> **📚 Phoenix Methods Guide**: For detailed examples and usage patterns, see [phoenix_methods_guide.md](../hw3/phoenix_methods_guide.md)

---
## Data provided
Traces are stored in Phoenix with the following structure:
```json
{
  "conversation_id": "a1b2…",
  "messages": [ {"role": "user", "content": "…"}, … ],
  "attributes": {
    "last_success_state": "GetRecipes",
    "first_failure_state": "GetWebInfo"
  }
}
```

The two state fields form a **directed edge** that you will count in the
transition matrix.

If you are curious how the data were produced, see
`homeworks/hw5/generation/` (not part of the graded assignment).

---
## Pipeline state taxonomy
The agent's internal pipeline is abstracted to **10 canonical states**:

| # | State | Description |
|---|--------------------|-------------------------------------------|
| 1 | `ParseRequest`     | LLM interprets the user's message         |
| 2 | `PlanToolCalls`    | LLM decides which tools to invoke         |
| 3 | `GenCustomerArgs`  | LLM constructs arguments for customer DB  |
| 4 | `GetCustomerProfile` | Executes customer-profile tool         |
| 5 | `GenRecipeArgs`    | LLM constructs arguments for recipe DB    |
| 6 | `GetRecipes`       | Executes recipe-search tool               |
| 7 | `GenWebArgs`       | LLM constructs arguments for web search   |
| 8 | `GetWebInfo`       | Executes web-search tool                  |
| 9 | `ComposeResponse`  | LLM drafts the final answer               |
|10 | `DeliverResponse`  | Agent sends the answer                    |

Every trace succeeds through `last_success_state` and then fails at
`first_failure_state`.

---
## What you need to do

### Step 1: Set Up Phoenix and Load Traces

**Phoenix Setup:**
1. Sign up for Phoenix at https://app.phoenix.arize.com
2. Install Phoenix: `pip install arize-phoenix-otel`
3. Set environment variables:
   ```bash
   export PHOENIX_API_KEY="your_api_key"
   export PHOENIX_COLLECTOR_ENDPOINT="your_endpoint"
   ```

**Load Traces from Phoenix:**
The analysis script automatically loads traces from Phoenix using:
```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

# Query traces with failure state annotations
query = SpanQuery().where("span_kind == 'AGENT'")
traces_df = px.Client().query_spans(query, project_name='recipe-agent-hw5')
```

### Step 2: Build the transition matrix
Count how many times each `(last_success → first_failure)` pair appears.

### Step 3: Visualize
Render a heat-map where rows = last-success, columns = first-failure.
A starter script is provided:
```bash
cd homeworks/hw5
python analysis/transition_heatmaps.py
```
This writes `results/failure_transition_heatmap.png`.

### Step 4: Analyze
• Which states fail most often?  
• Do failures cluster around tool execution or argument generation?  
• Any surprising low-frequency transitions?

### Step 5: Deliverables
• Heat-map PNG (commit to `homeworks/hw5/results/`).  
• Short write-up (README or a separate markdown file) summarising your
  findings.

---
## File structure (after you generate the heat-map)
```
homeworks/hw5/
├── analysis/
│   └── transition_heatmaps.py   # you may tweak but it already works
├── generation/  (ignore – instructor utilities)
│   ├── generate_traces_phoenix.py  # Phoenix trace generation
│   ├── semantic_convention.py      # Phoenix semantic conventions
│   └── README.md                   # Generation documentation
├── results/
│   └── failure_transition_heatmap.png  # ← your output
└── README.md  # this file
```

---
## Phoenix Integration Details

### Loading Traces from Phoenix

The analysis script uses Phoenix to load pre-labeled traces:

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

def load_labeled_traces() -> pd.DataFrame:
    # Query traces with failure state annotations
    query = SpanQuery().where("span_kind == 'AGENT'")
    traces_df = px.Client().query_spans(query, project_name='recipe-agent-hw5')
    return traces_df
```

### Building Transition Matrix from Phoenix Data

The script extracts failure state information from span attributes:

```python
def build_transition_matrix(traces: pd.DataFrame) -> np.ndarray:
    n = len(PIPELINE_STATES)
    m = np.zeros((n, n), dtype=int)

    for _, trace in traces.iterrows():
        frm = trace["attributes.last_success_state"]
        to = trace["attributes.first_failure_state"]
        if frm not in STATE_INDEX or to not in STATE_INDEX:
            continue  # skip malformed
        m[STATE_INDEX[frm], STATE_INDEX[to]] += 1
    return m
```

### Error Handling for Phoenix Queries

The script includes error handling for Phoenix connectivity:

```python
def safe_query_spans(client, query, project_name='recipe-agent-hw5'):
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

---
## Advanced / optional
Curious how the dataset was made?  Peek inside `generation/` – it uses GPT-4.1
to pick failure states and author synthetic conversations with Phoenix instrumentation.  Exploring or
modifying those scripts will **not** affect your grade.

### Phoenix Trace Generation (Instructor Reference)

The generation scripts use Phoenix to create synthetic traces:

```python
from phoenix.otel import register
from opentelemetry.trace import Status, StatusCode

# Register tracer with Phoenix
tracer_provider = register(
    project_name="recipe-agent-hw5",
    batch=True,
    auto_instrument=True
)
tracer = tracer_provider.get_tracer(__name__)

# Create spans with failure state annotations
with tracer.start_as_current_span(
    "RecipeAgent",
    openinference_span_kind="agent",
) as span:
    # Set span attributes for failure analysis
    span.set_attribute("last_success_state", "GetRecipes")
    span.set_attribute("first_failure_state", "GetWebInfo")
    
    # Simulate conversation
    # ... conversation logic ...
    
    span.set_status(Status(StatusCode.ERROR))  # Mark as failed
```

Happy debugging 🛠️🍳
