# Get Started: Datasets & Experiments

Now that you have Phoenix up and running, one of the next steps you can take is creating a **Dataset** & Running **Experiments**.&#x20;

* Datasets let you curate and organize examples to test your application systematically.&#x20;
* Experiments let you compare different model versions or configurations on the same dataset to see which performs best.&#x20;

## Datasets&#x20;

{% stepper %}
{% step %}
### Launch Phoenix&#x20;

Before setting up your first dataset, make sure Phoenix is running. For more step by step instructions, check out this [Get Started guide](./). &#x20;

{% tabs %}
{% tab title="Phoenix Cloud" %}
Before sending traces, make sure Phoenix is running. For more step by step instructions, check out this [Get Started guide](./).&#x20;

{% tabs %}
{% tab title="Phoenix Cloud" %}
Log in, create a space, navigate to the settings page in your space, and create your API keys.&#x20;

In your code, set your environment variables.&#x20;

```python
import os
os.environ["PHOENIX_API_KEY"] = "ADD YOUR PHOENIX API KEY"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "ADD YOUR PHOENIX Collector endpoint"
```

You can find your collector endpoint here:&#x20;

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/phoenix_hostname_settings.png" alt="After launching your space, go to settings. "><figcaption><p>Launch your space, navigate to settings &#x26; copy your hostname for your collector endpoint </p></figcaption></figure>

Your Collector Endpoint is: [https://app.phoenix.arize.com/s/](https://app.phoenix.arize.com/s/) + your space name.&#x20;
{% endtab %}
{% endtabs %}
{% endtab %}

{% tab title="Local (Self-hosted)" %}
If you installed Phoenix locally, you have a variety of options for deployment methods including: Terminal, Docker, Kubernetes, Railway, & AWS CloudFormation.  ([Learn more: Self-Hosting](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/))

To host on your local machine, run `phoenix serve` in your terminal.&#x20;

Navigate to your localhost in your browser. (example localhost:6006)&#x20;
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### Creating a Dataset&#x20;

You can either create a Dataset in the UI, or via code.&#x20;

For this quickstart, you can download this [sample.csv](https://drive.google.com/file/d/1n2WoejEe807VYGVT-GsTAA3QUdyFtR6g/view?usp=sharing) as a starter to run you through how to use datasets.&#x20;

{% tabs %}
{% tab title="UI" %}
In the UI, you can either create a empty dataset and then populate data or upload from a CSV.&#x20;

Once you've downloaded the above csv file, you can follow the video below to upload your first dataset.&#x20;

{% embed url="https://drive.google.com/file/d/1UOSnEbmcf-ELE85h4JcPpPiqx5LxgaGj/view?usp=sharing" %}
{% endtab %}

{% tab title="Python" %}
To create a Dataset in Phoenix, you will use the `datasets.create_dataset()` function. This can take in either a CSV file, Pandas DataFrame, or dataset Examples.&#x20;

If you have already downloaded the sample.csv, you can create this dataset via this code snippet:&#x20;

```python
from phoenix.client import AsyncClient
from phoenix.

px_client = AsyncClient()
dataset = await px_client.datasets.create_dataset(
    csv_file_path="sample.csv",
    name="test-dataset",
    input_keys=["input"],
    output_keys=["output", "label"]
)
```
{% endtab %}

{% tab title="TS" %}
i dont think this is possible unless you have a set of examples. doesn't yet take in csv via code&#x20;

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createDataset } from "@arizeai/phoenix-client/datasets";

// Initialize Phoenix client
const client = createClient();

// Upload dataset
const { datasetId } = await createDataset({
  client,
  name: "test-dataset",
  examples: sample.csv
});
```
{% endtab %}
{% endtabs %}

That's it! You've now successfully created your first dataset.&#x20;
{% endstep %}
{% endstepper %}

## Experiments&#x20;

Once you have a dataset, you're now able to run experiments. Experiments are made of tasks &, optionally, evals. While running evals is optional, they provide valuable metrics to help you compare  each of your experiments quickly — such as comparing models, catching regressions, and understanding which version performs best.&#x20;

{% stepper %}
{% step %}
### Load your Dataset in Code

The first step is to pull down your dataset into your code.&#x20;

If you made your dataset in the UI, you can follow this code snippet: &#x20;

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.client import AsyncClient

client = AsyncClient()
dataset = await client.datasets.get_dataset(dataset="sample", version_id= {your version id here})
```

To get the version\_id of your dataset, please navigate to the Versions tab and copy the version you want to run an experiment on.&#x20;
{% endtab %}
{% endtabs %}

If you created your dataset programmatically, you should already have it available as an instance assigned to your dataset variable.
{% endstep %}

{% step %}
### Create your Task  &#x20;

Create a Task to evaluate.&#x20;

{% tabs %}
{% tab title="Python" %}
Your task can be any function with any definition & does not have to use an LLM. However, for our experiment we want to run our list of input questions through a new prompt, and will need to start by setting our API Keys:&#x20;

```python
from openai import OpenAI

openai_client = OpenAI()

if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")

os.environ["OPENAI_API_KEY"] = openai_api_key
```

```python
from phoenix.experiments.types import Example

task_prompt_template = "Answer this question: {question}"

def task(example: Example) -> str:
    question = example.input
    message_content = task_prompt_template.format(question=question)
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    return response.choices[0].message.content
```
{% endtab %}

{% tab title="Typescript" %}
```typescript
import { OpenAI } from "openai";
import { type RunExperimentParams } from "@arizeai/phoenix-client/experiments";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const taskPromptTemplate = "Answer this question: {question}";

const task: RunExperimentParams["task"] = async (example) => {
  // Access question with type assertion
  const question = example.input.question || "No question provided";
  const messageContent = taskPromptTemplate.replace("{question}", question);

  const response = await openai.chat.completions.create({
    model: "gpt-4o", 
    messages: [{ role: "user", content: messageContent }]
  });

  return response.choices[0]?.message?.content || "";
};
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### Create your Evaluator&#x20;

Next step is to create your Evaluator. If you have already defined your Q\&A Correctness eval from the last quick start, you won't need to redefine it. If not, you can follow along with these code snippets.&#x20;

```python
from phoenix.evals.llm import LLM
from phoenix.evals import create_classifier

llm = LLM(model="gpt-4o", provider="openai")

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

correctness_evaluator = create_classifier(
    name="correctness",
    prompt_template=CORRECTNESS_TEMPLATE,
    llm=llm,
    choices={"correct": 1.0, "incorrect": 0.0},
)
```

You can run multiple evaluators at once. Let's define a custom Completeness Eval.&#x20;

```python
from phoenix.evals import ClassificationEvaluator

completeness_prompt = """
You are an expert at judging the completeness of a response to a query.
Given a query and response, rate the completeness of the response.
A response is complete if it fully answers all parts of the query.
A response is partially complete if it only answers part of the query.
A response is incomplete if it does not answer any part of the query or is not related to the query.

Query: {{input}}
Response: {{output}}

Is the response complete, partially complete, or incomplete?
"""

completeness = ClassificationEvaluator(
    llm=llm,
    name="completeness",
    prompt_template=completeness_prompt,
    choices={"complete": 1.0, "partially complete": 0.5, "incomplete": 0.0},
)
```
{% endstep %}

{% step %}
### Run your Experiment&#x20;

Now that we have defined our Task & our Evaluators, we're now ready to run our experiment.&#x20;

```python
from phoenix.client.experiments import async_run_experiment

experiment = await async_run_experiment(
    dataset=dataset,
    task=task,
    evaluators=[correctness_evaluator, completeness])
```

After running multiple experiments, you can compare the experiment output & evals side by side!&#x20;

{% embed url="https://drive.google.com/file/d/1EtkIVSq23fuaXlRaLOSCNYwgsxgGpFCR/view?usp=sharing" %}

**Optional:** If you wanted to run even more evaluators after this experiment, you can do so following this code:&#x20;

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.client.experiments import evaluate_experiment

experiment = evaluate_experiment(experiment, evaluators=[{add your evals}])
```
{% endtab %}

{% tab title="Typescript" %}
```typescript
import { evaluateExperiment } from "@arizeai/phoenix-client/experiments";

// Add more evaluations to an existing experiment
const updatedEvaluation = await evaluateExperiment({
  client,
  experiment, // Use the existing experiment object
  evaluators: [containsKeyword, conciseness]
});

console.log("Additional evaluations completed for experiment:", experiment.id);
```
{% endtab %}
{% endtabs %}
{% endstep %}
{% endstepper %}

### Learn More:

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Datasets &#x26; Experiments Concepts </td><td><a href="../datasets-and-experiments/concepts-datasets.md">concepts-datasets.md</a></td></tr><tr><td>Datasets &#x26; Experiments in Phoenix </td><td><a href="../datasets-and-experiments/overview-datasets.md">overview-datasets.md</a></td></tr></tbody></table>
