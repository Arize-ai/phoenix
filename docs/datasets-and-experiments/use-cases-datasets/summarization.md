# Summarization

Imagine you're deploying a service for your media company's summarization model that condenses daily news into concise summaries to be displayed online. One challenge of using LLMs for summarization is that even the best models tend to be verbose.

In this tutorial, you will construct a dataset and run experiments to engineer a prompt template that produces concise yet accurate summaries. You will:

- Upload a **dataset** of **examples** containing articles and human-written reference summaries to Phoenix
- Define an **experiment task** that summarizes a news article
- Devise **evaluators** for length and ROUGE score
- Run **experiments** to iterate on your prompt template and to compare the summaries produced by different LLMs

⚠️ This tutorial requires and OpenAI API key, and optionally, an Anthropic API key.

Let's get started!


## Install Dependencies and Import Libraries

Install requirements and import libraries.


```python
pip install anthropic arize-phoenix openai openinference-instrumentation-openai rouge tiktoken
```


```python
from typing import Any, Dict

import nest_asyncio
import pandas as pd

nest_asyncio.apply()  # needed for concurrent evals in notebook environments
pd.set_option("display.max_colwidth", None)  # display full cells of dataframes
```

## Launch Phoenix

Launch Phoenix and follow the instructions in the cell output to open the Phoenix UI.


```python
import phoenix as px

px.launch_app()
```

## Instrument Your Application




```python
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Create Your Dataset

Download your [data](https://huggingface.co/datasets/abisee/cnn_dailymail) from HuggingFace and inspect a random sample of ten rows. This dataset contains news articles and human-written summaries that we will use as a reference against which to compare our LLM generated summaries.

Upload the data as a **dataset** in Phoenix and follow the link in the cell output to inspect the individual **examples** of the dataset. Later in the notebook, you will run **experiments** over this dataset in order to iteratively improve your summarization application.


```python
from datetime import datetime

from datasets import load_dataset

hf_ds = load_dataset("abisee/cnn_dailymail", "3.0.0")
df = (
    hf_ds["test"]
    .to_pandas()
    .sample(n=10, random_state=0)
    .set_index("id")
    .rename(columns={"highlights": "summary"})
)
now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
dataset = px.Client().upload_dataset(
    df,
    input_keys=["article"],
    output_keys=["summary"],
    name=f"news-article-summaries-{now}",
)
```

## Define Your Experiment Task

A **task** is a callable that maps the input of a dataset example to an output by invoking a chain, query engine, or LLM. An **experiment** maps a task across all the examples in a dataset and optionally executes **evaluators** to grade the task outputs.

You'll start by defining your task, which in this case, invokes OpenAI. First, set your OpenAI API key if it is not already present as an environment variable.


```python
import os
from getpass import getpass

if os.environ.get("OPENAI_API_KEY") is None:
    os.environ["OPENAI_API_KEY"] = getpass("🔑 Enter your OpenAI API key: ")
```

Next, define a function to format a prompt template and invoke an OpenAI model on an example.


```python
from openai import AsyncOpenAI
from phoenix.datasets.types import Example

openai_client = AsyncOpenAI()


async def summarize_article_openai(example: Example, prompt_template: str, model: str) -> str:
    formatted_prompt_template = prompt_template.format(article=example.input["article"])
    response = await openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "assistant", "content": formatted_prompt_template},
        ],
    )
    assert response.choices
    return response.choices[0].message.content
```

From this function, you can use `functools.partial` to derive your first task, which is a callable that takes in an example and returns an output. Test out your task by invoking it on the test example.


```python
import textwrap
from functools import partial

template = """
Summarize the article in two to four sentences:

ARTICLE
=======
{article}

SUMMARY
=======
"""
gpt_4o = "gpt-4o-2024-05-13"
task = partial(summarize_article_openai, prompt_template=template, model=gpt_4o)
test_example = dataset.examples[0]
print(textwrap.fill(await task(test_example), width=100))
```

## Define Your Evaluators

Evaluators take the output of a task (in this case, a string) and grade it, often with the help of an LLM. In your case, you will create ROUGE score evaluators to compare the LLM-generated summaries with the human reference summaries you uploaded as part of your dataset. There are several variants of ROUGE, but we'll use ROUGE-1 for simplicity:

- ROUGE-1 precision is the proportion of overlapping tokens (present in both reference and generated summaries) that are present in the generated summary (number of overlapping tokens / number of tokens in the generated summary)
- ROUGE-1 recall is the proportion of overlapping tokens that are present in the reference summary (number of overlapping tokens / number of tokens in the reference summary)
- ROUGE-1 F1 score is the harmonic mean of precision and recall, providing a single number that balances these two scores.

Higher ROUGE scores mean that a generated summary is more similar to the corresponding reference summary. Scores near 1 / 2 are considered excellent, and a [model fine-tuned on this particular dataset achieved a rouge score of ~0.44](https://huggingface.co/datasets/abisee/cnn_dailymail#supported-tasks-and-leaderboards).

Since we also care about conciseness, you'll also define an evaluator to count the number of tokens in each generated summary.

Note that you can use any third-party library you like while defining evaluators (in your case, `rouge` and `tiktoken`).


```python
import tiktoken
from rouge import Rouge


# convenience functions
def _rouge_1(hypothesis: str, reference: str) -> Dict[str, Any]:
    scores = Rouge().get_scores(hypothesis, reference)
    return scores[0]["rouge-1"]


def _rouge_1_f1_score(hypothesis: str, reference: str) -> float:
    return _rouge_1(hypothesis, reference)["f"]


def _rouge_1_precision(hypothesis: str, reference: str) -> float:
    return _rouge_1(hypothesis, reference)["p"]


def _rouge_1_recall(hypothesis: str, reference: str) -> float:
    return _rouge_1(hypothesis, reference)["r"]


# evaluators
def rouge_1_f1_score(output: str, expected: Dict[str, Any]) -> float:
    return _rouge_1_f1_score(hypothesis=output, reference=expected["summary"])


def rouge_1_precision(output: str, expected: Dict[str, Any]) -> float:
    return _rouge_1_precision(hypothesis=output, reference=expected["summary"])


def rouge_1_recall(output: str, expected: Dict[str, Any]) -> float:
    return _rouge_1_recall(hypothesis=output, reference=expected["summary"])


def num_tokens(output: str) -> int:
    encoding = tiktoken.encoding_for_model(gpt_4o)
    return len(encoding.encode(output))


EVALUATORS = [rouge_1_f1_score, rouge_1_precision, rouge_1_recall, num_tokens]
```

## Run Experiments and Iterate on Your Prompt Template



Run your first experiment and follow the link in the cell output to inspect the task outputs (generated summaries) and evaluations.


```python
from phoenix.datasets.experiments import run_experiment

experiment_results = run_experiment(
    dataset,
    task,
    experiment_name="initial-template",
    experiment_description="first experiment using a simple prompt template",
    experiment_metadata={"vendor": "openai", "model": gpt_4o},
    evaluators=EVALUATORS,
)
```

Our initial prompt template contained little guidance. It resulted in an ROUGE-1 F1-score just above 0.3 (this will vary from run to run). Inspecting the task outputs of the experiment, you'll also notice that the generated summaries are far more verbose than the reference summaries. This results in high ROUGE-1 recall and low ROUGE-1 precision. Let's see if we can improve our prompt to make our summaries more concise and to balance out those recall and precision scores while maintaining or improving F1. We'll start by explicitly instructing the LLM to produce a concise summary.


```python
template = """
Summarize the article in two to four sentences. Be concise and include only the most important information.

ARTICLE
=======
{article}

SUMMARY
=======
"""
task = partial(summarize_article_openai, prompt_template=template, model=gpt_4o)
experiment_results = run_experiment(
    dataset,
    task,
    experiment_name="concise-template",
    experiment_description="explicitly instuct the llm to be concise",
    experiment_metadata={"vendor": "openai", "model": gpt_4o},
    evaluators=EVALUATORS,
)
```

Inspecting the experiment results, you'll notice that the average `num_tokens` has indeed increased, but the generated summaries are still far more verbose than the reference summaries.

Instead of just instructing the LLM to produce concise summaries, let's use a few-shot prompt to show it examples of articles and good summaries. The cell below includes a few articles and reference summaries in an updated prompt template.


```python
# examples to include (not included in the uploaded dataset)
train_df = (
    hf_ds["train"]
    .to_pandas()
    .sample(n=5, random_state=42)
    .head()
    .rename(columns={"highlights": "summary"})
)

example_template = """
ARTICLE
=======
{article}

SUMMARY
=======
{summary}
"""

examples = "\n".join(
    [
        example_template.format(article=row["article"], summary=row["summary"])
        for _, row in train_df.iterrows()
    ]
)

template = """
Summarize the article in two to four sentences. Be concise and include only the most important information, as in the examples below.

EXAMPLES
========

{examples}


Now summarize the following article.

ARTICLE
=======
{article}

SUMMARY
=======
"""

template = template.format(
    examples=examples,
    article="{article}",
)
print(template)
```

Now run the experiment.


```python
task = partial(summarize_article_openai, prompt_template=template, model=gpt_4o)
experiment_results = run_experiment(
    dataset,
    task,
    experiment_name="few-shot-template",
    experiment_description="include examples",
    experiment_metadata={"vendor": "openai", "model": gpt_4o},
    evaluators=EVALUATORS,
)
```

By including examples in the prompt, you'll notice a steep decline in the number of tokens per summary while maintaining F1.

## Compare With Another Model (Optional)

⚠️ This section requires an Anthropic API key.

Now that you have a prompt template that is performing reasonably well, you can compare the performance of other models on this particular task. Anthropic's Claude is notable for producing concise and to-the-point output.

First, enter your Anthropic API key if it is not already present.



```python
import os
from getpass import getpass

if os.environ.get("ANTHROPIC_API_KEY") is None:
    os.environ["ANTHROPIC_API_KEY"] = getpass("🔑 Enter your Anthropic API key: ")
```

Next, define a new task that summarizes articles using the same prompt template as before. Then, run the experiment.


```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic()


async def summarize_article_anthropic(example: Example, prompt_template: str, model: str) -> str:
    formatted_prompt_template = prompt_template.format(article=example.input["article"])
    message = await client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": formatted_prompt_template}],
    )
    return message.content[0].text


claude_35_sonnet = "claude-3-5-sonnet-20240620"
task = partial(summarize_article_anthropic, prompt_template=template, model=claude_35_sonnet)

experiment_results = run_experiment(
    dataset,
    task,
    experiment_name="anthropic-few-shot",
    experiment_description="anthropic",
    experiment_metadata={"vendor": "anthropic", "model": claude_35_sonnet},
    evaluators=EVALUATORS,
)
```

If your experiment does not produce more concise summaries, inspect the individual results. You may notice that some summaries from Claude 3.5 Sonnet start with a preamble such as:

```
Here is a concise 3-sentence summary of the article...
```

See if you can tweak the prompt and re-run the experiment to exclude this preamble from Claude's output. Doing so should result in the most concise summaries yet.

## Synopsis and Next Steps

Congrats! In this tutorial, you have:

- Created a Phoenix dataset
- Defined an experimental task and custom evaluators
- Iteratively improved a prompt template to produce more concise summaries with balanced ROUGE-1 precision and recall

As next steps, you can continue to iterate on your prompt template. If you find that you are unable to improve your summaries with further prompt engineering, you can export your dataset from Phoenix and use the [OpenAI fine-tuning API](https://platform.openai.com/docs/guides/fine-tuning/create-a-fine-tuned-model) to train a bespoke model for your needs.
