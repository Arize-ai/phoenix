<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-client">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
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
Phoenix Client provides a interface for interacting with the Phoenix platform via its REST API, enabling you to manage datasets, run experiments, analyze traces, and collect feedback programmatically.

## Features

- **REST API Interface** - Interact with Phoenix's OpenAPI REST interface
- **Prompts** - Create, version, and invoke prompt templates
- **Datasets** - Create and append to datasets from DataFrames, CSV files, or dictionaries
- **Experiments** - Run evaluations and track experiment results
- **Spans** - Query and analyze traces with powerful filtering
- **Annotations** - Add human feedback and automated evaluations
- **Evaluation Helpers** - Extract span data in formats optimized for RAG evaluation workflows

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

### Datasets

Manage evaluation datasets and examples for experiments and evaluation:

```python
import pandas as pd

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
```

### Spans

Query for spans and annotations from your projects for custom evaluation and annotation workflows:

```python
from datetime import datetime, timedelta

# Get spans as pandas DataFrame for analysis
spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-llm-app",
    limit=1000,
    root_spans_only=True,  # Only get top-level spans
    start_time=datetime.now() - timedelta(hours=24)
)

# Get span annotations as DataFrame
annotations_df = client.spans.get_span_annotations_dataframe(
    spans_dataframe=spans_df,  # Use spans from previous query
    project_identifier="my-llm-app",
    include_annotation_names=["relevance", "accuracy"],  # Only specific annotations
    exclude_annotation_names=["note"]  # Exclude UI notes
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
client.annotations.log_span_annotations(span_annotations=annotations)
```

### Projects

Manage Phoenix projects that organize your AI application data:

```python
# List all projects
projects = client.projects.list()
for project in projects:
    print(f"Project: {project['name']} (ID: {project['id']})")

# Create a new project
new_project = client.projects.create(
    name="Customer Support Bot",
    description="Traces and evaluations for our customer support chatbot"
)
print(f"Created project with ID: {new_project['id']}")
```

## Documentation

- **[Full Documentation](https://arize-phoenix.readthedocs.io/projects/client/en/latest/index.html)** - Complete API reference and guides
- **[Phoenix Docs](https://arize.com/docs/phoenix)** - Main Phoenix documentation
- **[GitHub Repository](https://github.com/Arize-ai/phoenix)** - Source code and examples

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
