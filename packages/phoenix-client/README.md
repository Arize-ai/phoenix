<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-client">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        arize-phoenix-client
    </div>
</h1>
<p align="center">
    <a href="https://pypi.org/project/arize-phoenix-client/">
        <img src="https://img.shields.io/pypi/v/arize-phoenix-client" alt="PyPI Version">
    </a>
    <a href="https://arize-phoenix.readthedocs.io/projects/client/en/latest/index.html">
        <img src="https://img.shields.io/badge/docs-blue?logo=readthedocs&logoColor=white" alt="Documentation">
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=packages/phoenix-client/README.md" />
</p>
Phoenix Client provides an interface for interacting with the Phoenix platform via its REST API, enabling you to manage datasets, run experiments, analyze traces, and collect feedback programmatically.

## Features

- **REST API Interface** - Interact with Phoenix's OpenAPI REST interface
- **Prompts** - Create, version, and invoke prompt templates
- **Datasets** - Create and append to datasets from DataFrames, CSV files, or dictionaries
- **Experiments** - Run evaluations and track experiment results
- **Eval CI (pytest)** - Run LLM evals as ordinary pytest tests and record them as Phoenix experiments (`pip install "arize-phoenix-client[pytest]"`)
- **Spans** - Query and analyze traces with powerful filtering
- **Annotations** - Add human feedback and automated evaluations
- **Evaluation Helpers** - Extract span data in formats optimized for RAG evaluation workflows

## Installation

Install the Phoenix Client with pip:

```bash
pip install arize-phoenix-client
```

## Getting Started

### Environment Variables

Configure the Phoenix Client using environment variables for seamless use across different environments:

```bash
# For local Phoenix server (default)
export PHOENIX_ENDPOINT="http://localhost:6006"

# A hosted or self-hosted instance with authentication
export PHOENIX_ENDPOINT="https://phoenix.example.com"
export PHOENIX_API_KEY="your-api-key"

# Customize headers
export PHOENIX_CLIENT_HEADERS="Authorization=Bearer your-api-key,custom-header=value"
```

`PHOENIX_ENDPOINT` is a base URL and is the canonical setting for the client. If
your app also exports traces, set `PHOENIX_COLLECTOR_ENDPOINT` for the OTel SDK
— usually to the same value. When only `PHOENIX_COLLECTOR_ENDPOINT` is set, the
client infers its base URL from it. See
[Environments](https://arize.com/docs/phoenix/environments) for the full list.

### Credential File Discovery (`.env.phoenix`)

When a setting is not provided by argument or environment variable, the client
looks for a `.env.phoenix` file in the current working directory — walking up
toward the filesystem root and stopping at the first match — and reads
`PHOENIX_`-prefixed keys from it (dotenv format):

```bash
# .env.phoenix
PHOENIX_ENDPOINT=http://localhost:6006
PHOENIX_API_KEY=your-api-key
```

Explicit arguments and environment variables always take precedence — the file
never overrides anything already set. Set `PHOENIX_DISCOVER_CONFIG=false` to
disable discovery entirely.

Credentials (`PHOENIX_API_KEY` and `PHOENIX_CLIENT_HEADERS`) and server location
(`PHOENIX_ENDPOINT` and the variables it falls back to) are each resolved as a
group from one source tier. If explicit or process credentials are paired with
an endpoint from `.env.phoenix`, the client warns once and continues without
logging credential values.

Discovery results, including a missing file, are cached per working directory
for the process lifetime. Long-running processes can call
`phoenix.client.utils.config.clear_env_file_cache()` after creating or changing
the file.

### Client Initialization

The client automatically reads environment variables, or you can override them:

```python
from phoenix.client import Client, AsyncClient

# Automatic configuration from environment variables
client = Client()

client = Client(base_url="http://localhost:6006")  # Local Phoenix server

# Remote instance with API key
client = Client(base_url="https://your-phoenix-instance.com", api_key="your-api-key")

# Custom authentication headers
client = Client(
    base_url="https://your-phoenix-instance.com", headers={"Authorization": "Bearer your-api-key"}
)

# Asynchronous client (same configuration options)
async_client = AsyncClient()
async_client = AsyncClient(base_url="http://localhost:6006")
async_client = AsyncClient(base_url="https://your-phoenix-instance.com", api_key="your-api-key")
```

## Resources

The Phoenix Client organizes functionality into resources that correspond to key Phoenix platform features. Each resource provides specialized methods for managing different types of data:

### Prompts

Manage prompt templates and versions:

```python
from phoenix.client import Client
from phoenix.client.types import PromptVersion

client = Client()

content = """
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

{{ article }}
"""

prompt = client.prompts.create(
    name="article-bullet-summarizer",
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
    prompt_description="Summarize an article in a few bullet points",
)

# Retrieve and use prompts
prompt = client.prompts.get(prompt_identifier="article-bullet-summarizer")

# Format the prompt with variables
prompt_vars = {
    "topic": "Sports",
    "article": "Moises Henriques, the Australian all-rounder, has signed to play for Surrey in this summer's NatWest T20 Blast. He will join after the IPL and is expected to strengthen the squad throughout the campaign.",
}
formatted_prompt = prompt.format(variables=prompt_vars)

# Make a request with your Prompt using OpenAI
from openai import OpenAI

oai_client = OpenAI()
resp = oai_client.chat.completions.create(**formatted_prompt)
print(resp.choices[0].message.content)
```

Pass `custom_provider_id` to send a version to a custom model provider configured in Phoenix. `model_provider` still selects the invocation parameter format, so the provider's SDK must be able to serve it; Phoenix refuses an incompatible provider with 422 and an unknown one with 404:

```python
prompt = client.prompts.create(
    name="article-bullet-summarizer",
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
        model_provider="OPENAI",
        custom_provider_id="R2VuZXJhdGl2ZU1vZGVsQ3VzdG9tUHJvdmlkZXI6MQ==",
    ),
)
print(prompt.custom_provider_id)
```

Creating a version with `custom_provider_id` requires Phoenix server >= 21.0.0. The client checks the server version first and raises against an older server, which would ignore the field and silently store the version with the built-in provider. Versions without it are not checked.

### Datasets

Manage evaluation datasets and examples for experiments and evaluation:

```python
from phoenix.client import Client
import pandas as pd

client = Client()

# List all available datasets
datasets = client.datasets.list()
for dataset in datasets:
    print(f"Dataset: {dataset['name']} ({dataset['example_count']} examples)")

# Get a specific dataset with all examples
dataset = client.datasets.get_dataset(dataset="qa-evaluation")
print(f"Dataset {dataset.name} has {len(dataset)} examples")

# Convert dataset to pandas DataFrame for analysis
df = dataset.to_dataframe()
print(df.columns)  # Index(['input', 'output', 'metadata'], dtype='object')

# Create a new dataset from dictionaries
dataset = client.datasets.create_dataset(
    name="customer-support-qa",
    dataset_description="Q&A dataset for customer support evaluation",
    inputs=[
        {"question": "How do I reset my password?"},
        {"question": "What's your return policy?"},
        {"question": "How do I track my order?"},
    ],
    outputs=[
        {
            "answer": "You can reset your password by clicking the 'Forgot Password' link on the login page."
        },
        {"answer": "We offer 30-day returns for unused items in original packaging."},
        {"answer": "You can track your order using the tracking number sent to your email."},
    ],
    metadata=[
        {"category": "account", "difficulty": "easy"},
        {"category": "policy", "difficulty": "medium"},
        {"category": "orders", "difficulty": "easy"},
    ],
)

# Create dataset from pandas DataFrame
df = pd.DataFrame(
    {
        "prompt": ["Hello", "Hi there", "Good morning"],
        "response": [
            "Hi! How can I help?",
            "Hello! What can I do for you?",
            "Good morning! How may I assist?",
        ],
        "sentiment": ["neutral", "positive", "positive"],
        "length": [20, 25, 30],
    }
)

dataset = client.datasets.create_dataset(
    name="greeting-responses",
    dataframe=df,
    input_keys=["prompt"],  # Columns to use as input
    output_keys=["response"],  # Columns to use as expected output
    metadata_keys=["sentiment", "length"],  # Additional metadata columns
)
```

### Traces

Retrieve traces for a project with optional filtering and sorting:

```python
from phoenix.client import Client

client = Client()

# Get the latest 100 traces
traces = client.traces.get_traces(project_identifier="my-llm-app")
for trace in traces:
    print(f"Trace {trace.trace_id}: {trace.status} ({trace.latency_ms}ms)")

# Filter by time range
from datetime import datetime, timedelta

traces = client.traces.get_traces(
    project_identifier="my-llm-app",
    start_time=datetime.now() - timedelta(hours=24),
    end_time=datetime.now(),
    sort="latency_ms",
    order="desc",
    limit=50,
)

# Include full span details
traces = client.traces.get_traces(
    project_identifier="my-llm-app",
    include_spans=True,  # caution: can increase response size significantly
    limit=10,
)

# Filter by session
traces = client.traces.get_traces(
    project_identifier="my-llm-app",
    session_id="my-session-id",
)
```

**Async usage:**

```python
from phoenix.client import AsyncClient

async_client = AsyncClient()

traces = await async_client.traces.get_traces(
    project_identifier="my-llm-app",
    limit=50,
)
```

| Parameter              | Type                                    | Default | Description                                          |
| ---------------------- | --------------------------------------- | ------- | ---------------------------------------------------- |
| `project_identifier`   | `str`                                   | —       | Project name or ID — **required**                    |
| `start_time`           | `datetime \| None`                      | `None`  | Inclusive lower bound on trace start time             |
| `end_time`             | `datetime \| None`                      | `None`  | Exclusive upper bound on trace start time            |
| `sort`                 | `"start_time" \| "latency_ms" \| None`  | `None`  | Sort field (server defaults to `"start_time"`)       |
| `order`                | `"asc" \| "desc" \| None`              | `None`  | Sort direction (server defaults to `"desc"`)         |
| `include_spans`        | `bool`                                  | `False` | Include full span details for each trace             |
| `session_id`           | `str \| Sequence[str] \| None`          | `None`  | Filter by session ID(s) or GlobalID(s)               |
| `limit`                | `int`                                   | `100`   | Maximum number of traces to return                   |
| `timeout`              | `int \| None`                           | `60`    | Request timeout in seconds                           |

> **Note:** Requires Phoenix server >= 13.15.0.

### Spans

Query for spans and annotations from your projects for custom evaluation and annotation workflows:

```python
from phoenix.client import Client
from phoenix.client.types.spans import SpanQuery
from datetime import datetime, timedelta

client = Client()

# Get spans as pandas DataFrame for analysis
spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-llm-app",
    limit=1000,
    query=SpanQuery().where("parent_id is None"),  # Only top-level spans
    start_time=datetime.now() - timedelta(hours=24),
)

# Get span annotations as DataFrame
annotations_df = client.spans.get_span_annotations_dataframe(
    spans_dataframe=spans_df,  # Use spans from previous query
    project_identifier="my-llm-app",
    include_annotation_names=["relevance", "accuracy"],  # Only specific annotations
    exclude_annotation_names=["note"],  # Exclude UI notes
)
```

### Annotations

Add annotations to spans for evaluation, user feedback, and custom annotation workflows:

```python
from phoenix.client import Client

client = Client()

# Add a single annotation with human feedback
client.spans.add_span_annotation(
    span_id="span-123",
    annotation_name="helpfulness",
    annotator_kind="HUMAN",
    label="helpful",
    score=0.9,
    explanation="Response directly answered the user's question",
)

# Bulk annotation logging for multiple spans
annotations = [
    {
        "name": "sentiment",
        "span_id": "span-123",
        "annotator_kind": "LLM",
        "result": {"label": "positive", "score": 0.8},
    },
    {
        "name": "accuracy",
        "span_id": "span-456",
        "annotator_kind": "HUMAN",
        "result": {"label": "accurate", "score": 0.95},
    },
]
client.spans.log_span_annotations(span_annotations=annotations)
```

### Sessions

Retrieve and annotate conversation sessions:

```python
from phoenix.client import Client

client = Client()

# List sessions for a project
sessions = client.sessions.list(project_name="my-llm-app")
for session in sessions:
    print(f"Session: {session['session_id']}")

# Get conversation turns for a session
turns = client.sessions.get_session_turns(session_id="my-session-id")
for turn in turns:
    print(f"Input: {turn.get('input', {}).get('value')}")
    print(f"Output: {turn.get('output', {}).get('value')}")

# Add a session-level annotation
client.sessions.add_session_annotation(
    session_id="my-session-id",
    annotation_name="user-satisfaction",
    label="satisfied",
    score=0.9,
    annotator_kind="HUMAN",
)
```

### Experiments

Run tasks across datasets and evaluate their outputs:

```python
from phoenix.client import Client

client = Client()

# Get an existing dataset to run the experiment on
dataset = client.datasets.get_dataset(dataset="my-dataset")


# Define a task function
def my_task(example):
    # Your LLM call or business logic here
    return f"Result for: {example['input']['question']}"


# Run an experiment
experiment = client.experiments.run_experiment(
    dataset=dataset,
    task=my_task,
    experiment_name="my-experiment",
)

# Retrieve an existing experiment
ran_experiment = client.experiments.get_experiment(experiment_id="my-experiment-id")
for run in ran_experiment["task_runs"]:
    print(f"Output: {run['output']}, Error: {run['error']}")
```

Beyond the batch `run_experiment` loop, you can post runs and evaluations one at a
time with `log_run` and `log_evaluation`. These are the incremental primitives the
pytest plugin builds on, and they are useful for any consumer that produces results
progressively rather than all at once:

```python
from datetime import datetime, timezone

# Record a single run against an existing experiment and example
run = client.experiments.log_run(
    experiment_id="my-experiment-id",
    dataset_example_id="my-example-id",
    output="the task output",
    start_time=datetime.now(timezone.utc),
    end_time=datetime.now(timezone.utc),
)

# Attach an evaluation (annotation) to that run
client.experiments.log_evaluation(
    experiment_run_id=run["id"],
    name="exact_match",
    annotator_kind="CODE",
    score=1.0,
    label="correct",
)
```

Both methods are available on `AsyncClient` as awaitable coroutines with the same
signatures.

### Eval CI (pytest)

Write LLM evals as ordinary pytest tests and record each marked test as a run in a
Phoenix experiment, so the same suite that gates your pull requests also builds a
history of results in Phoenix. Install the `pytest` extra and mark tests with
`@pytest.mark.phoenix`:

```bash
pip install "arize-phoenix-client[pytest]" pytest
```

```python
import pytest
from phoenix.client.pytest import evaluate, log_evaluation, log_output


@pytest.mark.phoenix(dataset="qa-suite")
@pytest.mark.parametrize("question,expected", [("2+2?", "4")], ids=["arithmetic"])
def test_answers(question, expected):
    result = my_app(question)
    log_output(result)
    log_evaluation(name="exact_match", score=float(result == expected))
    assert result == expected
```

See the [Eval CI with pytest guide](https://arize.com/docs/phoenix/datasets-and-experiments/how-to-experiments/eval-ci-with-pytest)
for marker options, environment variables, and a CI recipe.

### Projects

Manage Phoenix projects that organize your AI application data:

```python
from phoenix.client import Client

client = Client()

# List all projects
projects = client.projects.list()
for project in projects:
    print(f"Project: {project['name']} (ID: {project['id']})")

# Filter server-side by a case-insensitive substring of the project name
support_projects = client.projects.list(name_contains="support")

# Create a new project
new_project = client.projects.create(
    name="Customer Support Bot",
    description="Traces and evaluations for our customer support chatbot",
)
print(f"Created project with ID: {new_project['id']}")
```

### Evaluators

Read and edit shared evaluator definitions. A definition is shared by every project and dataset that binds it, so an update applies everywhere it is used. Requires Phoenix server >= 21.0.0:

```python
from phoenix.client import Client

client = Client()

# List definitions; `type` is "llm", "code", or "builtin"
for definition in client.evaluators.list(type="code", limit=20):
    print(definition["id"], definition["name"])

# Create a code evaluator that nothing binds yet
definition = client.evaluators.create_code(
    name="exact-match",
    source_code=open("evaluator.py").read(),
    language="PYTHON",
    sandbox_config_id="U2FuZGJveENvbmZpZzox",
    input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
    output_configs=[{"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}],
)

# Deploy new code together with the outputs it produces; refuse to deploy over a
# version somebody else pushed in the meantime
[current] = client.evaluators.list_code_versions(evaluator_id=definition["id"], limit=1)
version = client.evaluators.create_code_version(
    evaluator_id=definition["id"],
    source_code=open("evaluator.py").read(),
    expected_current_version_id=current["id"],
    output_configs=[{"type": "FREEFORM", "name": "notes"}],
)
print(version["id"], version["was_created"])

# Point an LLM evaluator at another version of its prompt. Prompt content is
# edited through the prompts API; the evaluator only records which version runs.
client.evaluators.update_llm(
    evaluator_id="TExNRXZhbHVhdG9yOjE=",
    prompt_version_id="UHJvbXB0VmVyc2lvbjo3",
)

# Delete a code evaluator once nothing binds it
client.evaluators.delete(evaluator_id=definition["id"])
```

Bind evaluators to datasets. A binding registers the evaluator to run against the dataset's experiments and carries its own name and input mapping; it does not run an experiment by itself. Existing code and built-in evaluators are bound by ID; LLM evaluators are created with the binding because each one is tied to its own prompt:

```python
# Bind an existing evaluator to a dataset by name or ID
binding = client.evaluators.dataset_evaluators.create(
    dataset="golden-questions",
    name="exact-match",
    evaluator_id="Q29kZUV2YWx1YXRvcjoy",
    input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
)

# Or create a new LLM evaluator that runs an existing prompt version and bind it in one step.
# The version must carry the output tool the evaluator scores with, so build it in the Prompt
# Hub or with the prompts API first; the evaluator's description must equal that tool's description.
binding = client.evaluators.dataset_evaluators.create(
    dataset="golden-questions",
    name="toxicity",
    input_mapping={"literal_mapping": {}, "path_mapping": {"output": "output"}},
    evaluator={
        "type": "llm",
        "description": "toxicity",
        "prompt_version_id": "UHJvbXB0VmVyc2lvbjo3",
        "output_configs": [
            {
                "type": "CATEGORICAL",
                "name": "toxicity",
                "optimization_direction": "MINIMIZE",
                "values": [{"label": "toxic", "score": 1}, {"label": "clean", "score": 0}],
            }
        ],
    },
)

for item in client.evaluators.dataset_evaluators.list(dataset="golden-questions"):
    print(item["id"], item["name"], item["evaluator_type"])

client.evaluators.dataset_evaluators.update(
    dataset_evaluator_id=binding["id"],
    description="Runs against the nightly golden set",
)

# Deleting the last binding of an evaluator deletes the evaluator too. Its
# prompt is kept unless delete_associated_prompt=True.
client.evaluators.dataset_evaluators.delete(dataset_evaluator_id=binding["id"])
```

Bind evaluators to projects to run them on incoming traces. A project binding controls scheduling: the target (`SPAN`, `TRACE`, or `SESSION`), a sampling rate, an optional filter in the language of the target, and for `TRACE` and `SESSION` targets a quiet-period delay. `SPAN` evaluators run on matching sampled spans as they arrive; `TRACE` and `SESSION` evaluators run once per trace or session after it has been quiet for the delay:

```python
# Evaluate a quarter of matching LLM spans as they arrive
binding = client.evaluators.project_evaluators.create(
    project="support-bot",
    name="toxicity",
    evaluation_target="SPAN",
    sampling_rate=0.25,
    evaluator_id="Q29kZUV2YWx1YXRvcjox",
    filter_condition="span_kind == 'LLM'",
)

for item in client.evaluators.project_evaluators.list(project="support-bot"):
    print(item["id"], item["name"], item["evaluation_target"], item["enabled"])

# Pause the binding without deleting it
client.evaluators.project_evaluators.update(project_evaluator_id=binding["id"], enabled=False)

# Deleting the last binding of an evaluator deletes the evaluator too. Its
# prompt is kept unless delete_associated_prompt=True.
client.evaluators.project_evaluators.delete(project_evaluator_id=binding["id"])
```

## Documentation

- **[Full Documentation](https://arize-phoenix.readthedocs.io/projects/client/en/latest/index.html)** - Complete API reference and guides
- **[Phoenix Docs](https://arize.com/docs/phoenix)** - Main Phoenix documentation
- **[GitHub Repository](https://github.com/Arize-ai/phoenix)** - Source code and examples

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 💼 Follow us on [LinkedIn](https://www.linkedin.com/showcase/113218220).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
