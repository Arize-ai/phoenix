# Get Started: Evaluations

Now that you have Phoenix up and running, and sent traces to your first project, the next step you can take is running **evaluations** of your Python application. Evaluations let you measure and monitor the quality of your application by scoring traces against metrics like accuracy, relevance, or custom checks.

{% stepper %}
{% step %}
**Launch Phoenix**

Before running evals, make sure Phoenix is running & you have sent traces in your project. For more step by step instructions, check out this [Get Started guide](./) & [Get Started with Tracing guide](get-started-tracing.md).

{% tabs %}
{% tab title="Phoenix Cloud" %}
Before sending traces, make sure Phoenix is running. For more step by step instructions, check out this [Get Started guide](./).

Log in, create a space, navigate to the settings page in your space, and create your API keys.

Set your environment variables.

```bash
export PHOENIX_API_KEY = "ADD YOUR PHOENIX API KEY"
export PHOENIX_COLLECTOR_ENDPOINT = "ADD YOUR PHOENIX COLLECTOR ENDPOINT"
```

You can find your collector endpoint here:

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/phoenix_hostname_settings.png" alt="After launching your space, go to settings."><figcaption><p>Launch your space, navigate to settings &#x26; copy your hostname for your collector endpoint</p></figcaption></figure>

Your Collector Endpoint is: [https://app.phoenix.arize.com/s/](https://app.phoenix.arize.com/s/) + your space name.
{% endtab %}

{% tab title="Local (Self-hosted)" %}
If you installed Phoenix locally, you have a variety of options for deployment methods including: Terminal, Docker, Kubernetes, Railway, & AWS CloudFormation. ([Learn more: Self-Hosting](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/))

To host on your local machine, run `phoenix serve` in your terminal.

Navigate to your localhost in your browser. (example localhost:6006)
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Install Phoenix Evals**

You'll need to install the evals library that's apart of Phoenix.

{% tabs %}
{% tab title="Python" %}
```python
pip install -q "arize-phoenix-evals>=2"
pip install -q "arize-phoenix-client"
```
{% endtab %}

{% tab title="TS" %}
```typescript
npm install @arizeai/phoenix-evals @arizeai/phoenix-client
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Pull down your Trace Data**

Since, we are running our evaluations on our trace data from our first project, we'll need to pull that data into our code.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.client import Client

px_client = Client()
primary_df = px_client.spans.get_spans_dataframe(project_identifier="my-llm-app")
```
{% endtab %}

{% tab title="TS" %}
```typescript
import { getSpans } from "@arizeai/phoenix-client/spans";

// Simple: Get first batch of spans (most common use case)
const { spans } = await getSpans({
  project: { projectName: "my-llm-app" },
  limit: 100,
});

// Full: Get ALL spans with pagination
const allSpans = [];
let cursor: string | undefined;

do {
  const result = await getSpans({
    project: { projectName: "my-llm-app" },
    cursor,
    limit: 100,
  });
  allSpans.push(...result.spans);
  cursor = result.nextCursor ?? undefined;
} while (cursor);
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Set Up Evaluations**

In this example, we will define, create, and run our own evaluator. There's a number of different evaluators you can run, but this quick start will go through an LLM as a Judge Model.

**1) Define your LLM Judge Model**

We'll use OpenAI as our evaluation model for this example, but Phoenix also supports a number of [other models](../evaluation/how-to-evals/configuring-the-llm/).

If you haven't yet defined your OpenAI API Key from the previous step, let's first add it to our environment.

{% tabs %}
{% tab title="Python" %}
```python
import os
from getpass import getpass

if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")

os.environ["OPENAI_API_KEY"] = openai_api_key

from phoenix.evals.llm import LLM
llm = LLM(model="gpt-4o", provider="openai")
```
{% endtab %}

{% tab title="TS" %}
```typescript
// pnpm add @ai-sdk/openai

import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "your-api-key-here",
});

const llm = openai("gpt-4o");
```
{% endtab %}
{% endtabs %}

**2) Define your Evaluators**

We will set up a Q\&A correctness Evaluator with the LLM of choice. I want to first define my LLM-as-a-Judge prompt template. Most LLM-as-a-judge evaluations can be framed as a classification task where the output is one of two or more categorical labels.

{% tabs %}
{% tab title="Python" %}
```python
CORRECTNESS_TEMPLATE = """ 
You are given a question and an answer. Decide if the answer is fully correct. 
Rules: The answer must be factually accurate, complete, and directly address the question. 
If it is, respond with "correct". Otherwise respond with "incorrect". 
[BEGIN DATA]
    ************
    [Question]: {attributes.llm.input_messages}
    ************
    [Answer]: {attributes.llm.output_messages}
[END DATA]

Your response must be a single word, either "correct" or "incorrect",
and should not contain any text or characters aside from that word.
"correct" means that the question is correctly and fully answered by the answer.
"incorrect" means that the question is not correctly or only partially answered by the
answer.
"""
```
{% endtab %}

{% tab title="TS" %}
```typescript
const CORRECTNESS_TEMPLATE = `
You are given a question and an answer. Decide if the answer is fully correct.
Rules: The answer must be factually accurate, complete, and directly address the question.
If it is, respond with "correct". Otherwise respond with "incorrect".

[BEGIN DATA]
    ************
    [Question]: {{attributes.llm.input_messages}}
    ************
    [Answer]: {{attributes.llm.output_messages}}
[END DATA]

Your response must be a single word, either "correct" or "incorrect",
and should not contain any text or characters aside from that word.
"correct" means that the question is correctly and fully answered by the answer.
"incorrect" means that the question is not correctly or only partially answered by the
answer.
`;
```
{% endtab %}
{% endtabs %}

Now we want to define our Classification Evaluator

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.evals import create_classifier

correctness_evaluator = create_classifier(
    name="correctness",
    prompt_template=CORRECTNESS_TEMPLATE,
    llm=llm,
    choices={"correct": 1.0, "incorrect": 0.0},
)
```
{% endtab %}

{% tab title="TS" %}
```typescript
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

const correctnessEvaluator = createClassificationEvaluator({
  name: "correctness",
  promptTemplate: CORRECTNESS_TEMPLATE,
  model: llm,
  choices: { correct: 1.0, incorrect: 0.0 },
});
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Run Evaluation**

Now that we have defined our evaluator, we're ready to evaluate our traces.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.evals import evaluate_dataframe

results_df = evaluate_dataframe(
    dataframe=primary_df,
    evaluators=[correctness_evaluator]
)
```
{% endtab %}
{% endtabs %}


{% endstep %}

{% step %}
**Log results to Visualize in Phoenix**

You'll now be able to log your evaluations in your project view.

{% tabs %}
{% tab title="Python" %}
```python
client.log_span_annotations(
    dataframe=results_df,
    annotation_name="QA Correctness",
    annotator_kind="LLM"
)
```
{% endtab %}

{% tab title="TS" %}
```typescript
await logSpanAnnotations({
  spanAnnotations: results
    .filter((r) => r.label !== undefined)
    .map((r) => ({
      spanId: r.spanId,
      name: "QA Correctness",
      label: r.label,
      score: r.score,
      annotatorKind: "LLM" as const,
    })),
});
```
{% endtab %}
{% endtabs %}


{% endstep %}
{% endstepper %}

### Learn More:

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Evaluation Concepts</td><td><a href="https://arize.com/docs/phoenix/evaluation/concepts-evals/llm-as-a-judge">https://arize.com/docs/phoenix/evaluation/concepts-evals/llm-as-a-judge</a></td></tr><tr><td>Evals in Phoenix</td><td><a href="https://arize.com/docs/phoenix/evaluation/llm-evals">https://arize.com/docs/phoenix/evaluation/llm-evals</a></td></tr></tbody></table>
