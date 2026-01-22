# Phoenix Client Reference

Welcome to the Phoenix Client documentation. This lightweight Python client provides a simple interface for interacting with the Phoenix platform via its REST API, enabling you to manage datasets, run experiments, analyze traces, and collect feedback programmatically.

- **[Datasets](api/datasets)** - Create and manage datasets for experimentation
- **[Experiments](api/experiments)** - Run experiments and evaluate model performance
- **[Prompts](api/prompts)** - Manage prompt templates and versions
- **[Spans](api/spans)** - Access and analyze traces and spans
- **[Annotations](api/annotations)** - Add annotations, evals, and feedback to spans
- **[Sessions](api/sessions)** - Add session annotations to multi-turn conversations and threads
- **[Projects](api/projects)** - Organize your work with project management

## Installation

Install the Phoenix Client using pip:

```bash
pip install arize-phoenix-client
```

## Getting Started

### Environment Variables

Configure the Phoenix Client using environment variables for seamless use across different environments:

```bash
# For local Phoenix server (default)
export PHOENIX_BASE_URL="http://localhost:6006"

# Cloud Instance
export PHOENIX_API_KEY="your-api-key"
export PHOENIX_BASE_URL="https://app.phoenix.arize.com/s/your-space"

# For custom Phoenix instances with API key authentication
export PHOENIX_BASE_URL="https://your-phoenix-instance.com"
export PHOENIX_API_KEY="your-api-key"

# Customize headers
export PHOENIX_CLIENT_HEADERS="Authorization=Bearer your-api-key,custom-header=value"
```

### Client Initialization

The client automatically reads environment variables, or you can override them:

```python
from phoenix.client import Client, AsyncClient

# Automatic configuration from environment variables
client = Client()

client = Client(base_url="http://localhost:6006")  # Local Phoenix server

# Cloud instance with API key
client = Client(
    base_url="https://app.phoenix.arize.com/s/your-space",
    api_key="your-api-key"
)

# Custom authentication headers
client = Client(
    base_url="https://your-phoenix-instance.com",
    headers={"Authorization": "Bearer your-api-key"}
)

# Asynchronous client (same configuration options)
async_client = AsyncClient()
async_client = AsyncClient(base_url="http://localhost:6006")
async_client = AsyncClient(
    base_url="https://app.phoenix.arize.com/s/your-space",
    api_key="your-api-key"
)
```

## Resources

The Phoenix Client organizes functionality into resources that correspond to key Phoenix platform features. Each resource provides specialized methods for managing different types of data:

### Prompts

Manage prompt templates and versions:

```python
# Create a new prompt
from phoenix.client import Client
from phoenix.client.types import PromptVersion

content = """
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

{{ article }}
"""

prompt = client.prompts.create(
    name="article-bullet-summarizer",
    version=PromptVersion(
        messages=[{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
    prompt_description="Summarize an article in a few bullet points"
)

# Retrieve and use prompts
prompt = client.prompts.get(prompt_identifier="article-bullet-summarizer")

# Format the prompt with variables
prompt_vars = {
    "topic": "Sports",
    "article": "Moises Henriques, the Australian all-rounder, has signed to play for Surrey in this summer's NatWest T20 Blast. He will join after the IPL and is expected to strengthen the squad throughout the campaign."
}
formatted_prompt = prompt.format(variables=prompt_vars)

# Make a request with your Prompt using OpenAI
from openai import OpenAI
oai_client = OpenAI()
resp = oai_client.chat.completions.create(**formatted_prompt)
print(resp.choices[0].message.content)
```

### Spans

Query for spans and annotations from your projects for custom evaluation and annotation workflows.

```python
from datetime import datetime, timedelta
from phoenix.client.types.spans import SpanQuery

# Get spans as a list
spans = client.spans.get_spans(
    project_identifier="my-llm-app",
    limit=100,
    start_time=datetime.now() - timedelta(days=7),
    end_time=datetime.now()
)

# Get spans as pandas DataFrame for analysis
spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-llm-app",
    limit=1000,
    root_spans_only=True,  # Only get top-level spans
    start_time=datetime.now() - timedelta(hours=24)
)

# Advanced querying with SpanQuery
query = SpanQuery().where("span_kind == 'LLM'")

filtered_df = client.spans.get_spans_dataframe(
    query=query,
    project_identifier="my-llm-app",
    limit=500
)

# Get span annotations as DataFrame
annotations_df = client.spans.get_span_annotations_dataframe(
    spans_dataframe=spans_df,  # Use spans from previous query
    project_identifier="my-llm-app",
    include_annotation_names=["relevance", "accuracy"],  # Only specific annotations
    exclude_annotation_names=["note"]  # Exclude UI notes
)

# Get annotations as a list
annotations = client.spans.get_span_annotations(
    span_ids=["span-123", "span-456"],
    project_identifier="my-llm-app",
    include_annotation_names=["sentiment", "toxicity"]
)
```

### Annotations

Add annotations to spans for evaluation, user feedback, and custom annotation workflows:

```python
# Add a single annotation with human feedback
client.annotations.add_span_annotation(
    span_id="span-123",
    annotation_name="helpfulness",
    annotator_kind="HUMAN",
    label="helpful",
    score=0.9,
    explanation="Response directly answered the user's question"
)

# Add automated evaluation annotations
client.annotations.add_span_annotation(
    span_id="span-123",
    annotation_name="toxicity",
    annotator_kind="LLM",
    label="safe",
    score=0.05,
    explanation="Content is appropriate and non-toxic"
)

# Bulk annotation logging for multiple spans
annotations = [
    {
        "name": "sentiment",
        "span_id": "span-123",
        "annotator_kind": "LLM",
        "result": {"label": "positive", "score": 0.8}
    },
    {
        "name": "accuracy",
        "span_id": "span-456",
        "annotator_kind": "HUMAN",
        "result": {"label": "accurate", "score": 0.95}
    },
]
client.spans.log_span_annotations(span_annotations=annotations)

# Using pandas DataFrame for large-scale annotation
import pandas as pd

# Create DataFrame with evaluation results
df = pd.DataFrame({
    "name": ["relevance", "coherence", "fluency"],
    "span_id": ["span-001", "span-002", "span-003"],
    "annotator_kind": ["LLM", "LLM", "HUMAN"],
    "label": ["relevant", "coherent", "fluent"],
    "score": [0.85, 0.92, 0.88],
    "explanation": [
        "Response addresses the user query",
        "Answer flows logically",
        "Natural language generation"
    ]
})
client.spans.log_span_annotations_dataframe(dataframe=df)
```

### Evaluation Helpers

The Phoenix Client provides helper functions to extract span data in formats optimized for RAG evaluation workflows. These helpers streamline the process of preparing data for evaluation with `phoenix.evals`.

#### RAG Retrieval Evaluation

Extract retrieved documents from retriever spans for relevance evaluation:

```python
from phoenix.client import Client
from phoenix.client.helpers.spans import get_retrieved_documents

client = Client()

# Extract retrieved documents for evaluation
retrieved_docs_df = get_retrieved_documents(
    client,
    project_name="my-rag-app"
)

# Each row is a retrieved document with its metadata
print(retrieved_docs_df.head())
# Index: context.span_id, document_position
# Columns: context.trace_id, input, document, document_score, document_metadata

# Use with phoenix.evals for relevance evaluation
from phoenix.evals import LLM, async_evaluate_dataframe
from phoenix.evals.metrics import DocumentRelevanceEvaluator

llm = LLM(model="gpt-4o", provider="openai")
relevance_evaluator = DocumentRelevanceEvaluator(llm=llm)

relevance_results = await async_evaluate_dataframe(
    dataframe=retrieved_docs_df,
    evaluators=[relevance_evaluator],
    concurrency=10,
    exit_on_error=True,
)
relevance_results.head()
```

#### RAG Q&A Evaluation

Extract Q&A pairs with reference context for faithfulness evaluation:

```python
from phoenix.client.helpers.spans import get_input_output_context
from phoenix.evals.metrics import FaithfulnessEvaluator

# Extract Q&A with context documents
qa_df = get_input_output_context(
    client,
    project_name="my-rag-app"
)

# Each row combines a Q&A pair with concatenated retrieval documents
# Index: context.span_id
# Columns: context.trace_id, input, output, context, metadata
if qa_df is not None:
    print(qa_df.head())

    # Run faithfulness evaluations
    faithfulness_evaluator = FaithfulnessEvaluator(llm=llm)

    faithfulness_results = await async_evaluate_dataframe(
        dataframe=qa_df,
        evaluators=[faithfulness_evaluator],
        concurrency=10,
        exit_on_error=True,
    )
    faithfulness_results.head()
```

#### Time-Filtered RAG Spans

Filter spans by time range for evaluation:

```python
from datetime import datetime, timedelta

# Get documents from last 24 hours
recent_docs = get_retrieved_documents(
    client,
    project_name="my-rag-app",
    start_time=datetime.now() - timedelta(hours=24),
    end_time=datetime.now()
)

# Get Q&A from last week
weekly_qa = get_input_output_context(
    client,
    project_name="my-rag-app",
    start_time=datetime.now() - timedelta(days=7)
)
```

### Datasets

Manage evaluation datasets and examples for experiments and testing:

```python
import pandas as pd

# List all available datasets
datasets = client.datasets.list()
for dataset in datasets:
    print(f"Dataset: {dataset['name']} ({dataset['example_count']} examples)")
    print(f"Created: {dataset['created_at']}")

# Get limited number of datasets for large collections
limited_datasets = client.datasets.list(limit=10)

# Get a specific dataset with all examples
dataset = client.datasets.get_dataset(dataset="qa-evaluation")
print(f"Dataset {dataset.name} has {len(dataset)} examples")
print(f"Version ID: {dataset.version_id}")

# Access dataset properties
print(f"Description: {dataset.description}")
print(f"Created: {dataset.created_at}")
print(f"Updated: {dataset.updated_at}")

# Iterate through examples
for example in dataset:
    print(f"Input: {example['input']}")
    print(f"Output: {example['output']}")
    print(f"Metadata: {example['metadata']}")

# Get specific example by index
first_example = dataset[0]

# Convert dataset to pandas DataFrame for analysis
df = dataset.to_dataframe()
print(df.columns)  # Index(['input', 'output', 'metadata'], dtype='object')
print(df.index.name)  # example_id

# Create a new dataset from dictionaries
dataset = client.datasets.create_dataset(
    name="customer-support-qa",
    dataset_description="Q&A dataset for customer support evaluation",
    inputs=[
        {"question": "How do I reset my password?"},
        {"question": "What's your return policy?"},
        {"question": "How do I track my order?"}
    ],
    outputs=[
        {"answer": "You can reset your password by clicking the 'Forgot Password' link on the login page."},
        {"answer": "We offer 30-day returns for unused items in original packaging."},
        {"answer": "You can track your order using the tracking number sent to your email."}
    ],
    metadata=[
        {"category": "account", "difficulty": "easy"},
        {"category": "policy", "difficulty": "medium"},
        {"category": "orders", "difficulty": "easy"}
    ]
)

# Create dataset from pandas DataFrame
df = pd.DataFrame({
    "prompt": ["Hello", "Hi there", "Good morning"],
    "response": ["Hi! How can I help?", "Hello! What can I do for you?", "Good morning! How may I assist?"],
    "sentiment": ["neutral", "positive", "positive"],
    "length": [20, 25, 30]
})

dataset = client.datasets.create_dataset(
    name="greeting-responses",
    dataframe=df,
    input_keys=["prompt"],           # Columns to use as input
    output_keys=["response"],        # Columns to use as expected output
    metadata_keys=["sentiment", "length"]  # Additional metadata columns
)

# Create dataset from CSV file
dataset = client.datasets.create_dataset(
    name="csv-dataset",
    csv_file_path="path/to/data.csv",
    input_keys=["question", "context"],
    output_keys=["answer"],
    metadata_keys=["source", "confidence"]
)

# Add more examples to existing dataset
updated_dataset = client.datasets.add_examples_to_dataset(
    dataset="customer-support-qa",
    inputs=[{"question": "How do I cancel my subscription?"}],
    outputs=[{"answer": "You can cancel your subscription in your account settings."}],
    metadata=[{"category": "subscription", "difficulty": "medium"}]
)

# Add examples from DataFrame
new_examples_df = pd.DataFrame({
    "question": ["What are your hours?", "Do you offer live chat?"],
    "answer": ["We're open 24/7", "Yes, live chat is available on our website"],
    "topic": ["hours", "support"]
})

client.datasets.add_examples_to_dataset(
    dataset="customer-support-qa",
    dataframe=new_examples_df,
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["topic"]
)

# Get dataset versions (track changes over time)
versions = client.datasets.get_dataset_versions(dataset="customer-support-qa")
for version in versions:
    print(f"Version: {version['version_id']}")
    print(f"Created: {version['created_at']}")

# Get specific version of dataset
versioned_dataset = client.datasets.get_dataset(
    dataset="customer-support-qa",
    version_id="version-123"
)

# Dataset serialization for backup/sharing
from phoenix.client.resources.datasets import Dataset

dataset_dict = dataset.to_dict()
# Save to file, send over network, etc.

# Restore dataset from dictionary
restored_dataset = Dataset.from_dict(dataset_dict)
```

### Experiments

Run evaluations and experiments on your datasets to test AI application performance:

```python
from phoenix.client.experiments import run_experiment, get_experiment, evaluate_experiment

# Get a dataset for experimentation
dataset = client.datasets.get_dataset(dataset="my-dataset")

# Define a simple task function
def my_task(input):
    return f"Hello {input['name']}"

# Basic experiment
experiment = run_experiment(
    dataset=dataset,
    task=my_task,
    experiment_name="greeting-experiment"
)
print(f"Experiment completed with {len(experiment.runs)} runs")

# With evaluators
def accuracy_evaluator(output, expected):
    return 1.0 if output == expected['text'] else 0.0

experiment = run_experiment(
    dataset=dataset,
    task=my_task,
    evaluators=[accuracy_evaluator],
    experiment_name="evaluated-experiment"
)

# Dynamic binding for tasks (access multiple dataset fields)
def my_task(input, metadata, expected):
    # Task can access multiple fields from the dataset example
    context = metadata.get("context", "")
    return f"Context: {context}, Input: {input}, Expected: {expected}"

# Dynamic binding for evaluators
def my_evaluator(output, input, expected, metadata):
    # Evaluator can access task output and example fields
    score = calculate_similarity(output, expected)
    return {"score": score, "label": "pass" if score > 0.8 else "fail"}

experiment = run_experiment(
    dataset=dataset,
    task=my_task,
    evaluators=[my_evaluator],
    experiment_name="dynamic-evaluator"
)

# Get a completed experiment by ID
experiment = get_experiment(experiment_id="123")

# Run additional evaluations on existing experiment
evaluated = evaluate_experiment(
    experiment=experiment,
    evaluators=[accuracy_evaluator],
    print_summary=True
)

# Async experiments
from phoenix.client.experiments import async_run_experiment
from phoenix.client import AsyncClient

async def async_task(input):
    return f"Hello {input['name']}"

async_client = AsyncClient()
dataset = await async_client.datasets.get_dataset(dataset="my-dataset")

experiment = await async_run_experiment(
    dataset=dataset,
    task=async_task,
    experiment_name="greeting-experiment",
    concurrency=5  # Run 5 tasks concurrently
)
```

### Projects

Manage Phoenix projects that organize your AI application data:

```python
# List all projects
projects = client.projects.list()
for project in projects:
    print(f"Project: {project['name']} (ID: {project['id']})")
    print(f"Description: {project.get('description', 'No description')}")

# Get a specific project by name
project = client.projects.get(project_name="my-llm-app")
print(f"Project name: {project['name']}")
print(f"Project ID: {project['id']}")

# Get a project by ID (useful when you have the project ID from other operations)
project = client.projects.get(project_id="UHJvamVjdDoy")
print(f"Project name: {project['name']}")

# Create a new project
new_project = client.projects.create(
    name="Customer Support Bot",
    description="Traces and evaluations for our customer support chatbot"
)
print(f"Created project with ID: {new_project['id']}")

# Update project description (note: project names cannot be changed)
updated_project = client.projects.update(
    project_id=new_project["id"],
    description="Updated: Customer support bot with sentiment analysis and quality metrics"
)
print(f"Updated project description: {updated_project['description']}")
```

## API Reference

```{toctree}
:maxdepth: 3

api/client
api/datasets
api/experiments
api/prompts
api/spans
api/annotations
api/sessions
api/projects
api/helpers
api/utils
api/types
api/exceptions
```

## External Links

- [Main Phoenix Documentation](https://arize.com/docs/phoenix)
- [Python Reference](https://arize-phoenix.readthedocs.io/)
- [GitHub Repository](https://github.com/Arize-ai/phoenix)

## Indices and tables

- {ref}`genindex`
- {ref}`modindex`
- {ref}`search`
