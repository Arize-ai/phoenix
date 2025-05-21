# Quickstart: Datasets & Experiments

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/datasets_and_experiments_quickstart.ipynb)

Phoenix helps you run experiments over your AI and LLM applications to evaluate and iteratively improve their performance. This quickstart shows you how to get up and running quickly.

{% embed url="https://www.youtube.com/watch?v=2oBHX4-9Sro" %}
Background + demo on datasets
{% endembed %}

## Launch Phoenix

### Using Phoenix Cloud

1. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)
2. Grab your API key from the Keys option on the left bar.
3. In your code, set your endpoint and API key:

{% tabs %}
{% tab title="Python" %}

```python
import os

PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
const PHOENIX_API_KEY = "ADD YOUR API KEY";
process.env["PHOENIX_CLIENT_HEADERS"] = `api_key=${PHOENIX_API_KEY}`;
process.env["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com";
```

{% endtab %}
{% endtabs %}

### Using Self-hosted Phoenix

1. Run Phoenix using Docker, local terminal, Kubernetes etc. For more information, [see self-hosting](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/).
2. In your code, set your endpoint:

{% tabs %}
{% tab title="Python" %}

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "Your Phoenix Endpoint"
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
process.env["PHOENIX_COLLECTOR_ENDPOINT"] = "Your Phoenix Endpoint"
```

{% endtab %}
{% endtabs %}

## Datasets

Upload a dataset.

{% tabs %}
{% tab title="Python" %}

```python
import pandas as pd
import phoenix as px

df = pd.DataFrame(
    [
        {
            "question": "What is Paul Graham known for?",
            "answer": "Co-founding Y Combinator and writing on startups and techology.",
            "metadata": {"topic": "tech"},
        }
    ]
)
phoenix_client = px.Client()
dataset = phoenix_client.upload_dataset(
    dataframe=df,
    dataset_name="test-dataset",
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["metadata"],
)
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
import { createClient } from "phoenix";
import { createDataset } from "phoenix/datasets";

// Create example data
const examples = [
  {
    input: { question: "What is Paul Graham known for?" },
    output: {
      answer: "Co-founding Y Combinator and writing on startups and techology."
    },
    metadata: { topic: "tech" }
  }
];

// Initialize Phoenix client
const client = createClient();

// Upload dataset
const { datasetId } = await createDataset({
  client,
  name: "test-dataset",
  examples: examples
});
```

{% endtab %}
{% endtabs %}

## Tasks

Create a task to evaluate.

{% tabs %}
{% tab title="Python" %}

```python
from openai import OpenAI
from phoenix.experiments.types import Example

openai_client = OpenAI()

task_prompt_template = "Answer in a few words: {question}"


def task(example: Example) -> str:
    question = example.input["question"]
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
import { Example } from "phoenix/types/datasets";
import { RunExperimentParams } from "phoenix/experiments";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const taskPromptTemplate = "Answer in a few words: {question}";

const task: RunExperimentParams["task"] = async (example: Example) => {
  // Access question with type assertion
  const question = (example.input.question as string) || "No question provided";
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

## Evaluators

Use pre-built evaluators to grade task output with code...

{% tabs %}
{% tab title="Python" %}

```python
from phoenix.experiments.evaluators import ContainsAnyKeyword

contains_keyword = ContainsAnyKeyword(keywords=["Y Combinator", "YC"])
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
import { asEvaluator } from "phoenix/experiments";
import { AnnotatorKind } from "phoenix/types/annotations";

// Code-based evaluator that checks if response contains specific keywords
const containsKeyword = asEvaluator({
  name: "contains_keyword",
  kind: "CODE" as AnnotatorKind,
  evaluate: async ({ output }) => {
    const keywords = ["Y Combinator", "YC"];
    const outputStr = String(output).toLowerCase();
    const contains = keywords.some((keyword) =>
      outputStr.toLowerCase().includes(keyword.toLowerCase())
    );

    return {
      score: contains ? 1.0 : 0.0,
      label: contains ? "contains_keyword" : "missing_keyword",
      metadata: { keywords },
      explanation: contains
        ? `Output contains one of the keywords: ${keywords.join(", ")}`
        : `Output does not contain any of the keywords: ${keywords.join(", ")}`
    };
  }
});
```

{% endtab %}
{% endtabs %}

or LLMs.

{% tabs %}
{% tab title="Python" %}

```python
from phoenix.experiments.evaluators import ConcisenessEvaluator
from phoenix.evals.models import OpenAIModel

model = OpenAIModel(model="gpt-4o")
conciseness = ConcisenessEvaluator(model=model)
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
import { asEvaluator } from "phoenix/experiments";
import { AnnotatorKind } from "phoenix/types/annotations";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// LLM-based evaluator for conciseness
const conciseness = asEvaluator({
  name: "conciseness",
  kind: "LLM" as AnnotatorKind,
  evaluate: async ({ output }) => {
    const prompt = `
      Rate the following text on a scale of 0.0 to 1.0 for conciseness (where 1.0 is perfectly concise).
      
      TEXT: ${output}
      
      Return only a number between 0.0 and 1.0.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }]
    });

    const scoreText = response.choices[0]?.message?.content?.trim() || "0";
    const score = parseFloat(scoreText);

    return {
      score: isNaN(score) ? 0.5 : score,
      label: score > 0.7 ? "concise" : "verbose",
      metadata: {},
      explanation: `Conciseness score: ${score}`
    };
  }
});
```

{% endtab %}
{% endtabs %}

Define custom evaluators with code...

{% tabs %}
{% tab title="Python" %}

```python
from typing import Any, Dict


def jaccard_similarity(output: str, expected: Dict[str, Any]) -> float:
    # https://en.wikipedia.org/wiki/Jaccard_index
    actual_words = set(output.lower().split(" "))
    expected_words = set(expected["answer"].lower().split(" "))
    words_in_common = actual_words.intersection(expected_words)
    all_words = actual_words.union(expected_words)
    return len(words_in_common) / len(all_words)
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
import { asEvaluator } from "phoenix/experiments";
import { AnnotatorKind } from "phoenix/types/annotations";

// Custom Jaccard similarity evaluator
const jaccardSimilarity = asEvaluator({
  name: "jaccard_similarity",
  kind: "CODE" as AnnotatorKind,
  evaluate: async ({ output, expected }) => {
    const actualWords = new Set(String(output).toLowerCase().split(" "));
    const expectedAnswer = (expected?.answer as string) || "";
    const expectedWords = new Set(expectedAnswer.toLowerCase().split(" "));

    const wordsInCommon = new Set(
      [...actualWords].filter((word) => expectedWords.has(word))
    );

    const allWords = new Set([...actualWords, ...expectedWords]);
    const score = wordsInCommon.size / allWords.size;

    return {
      score,
      label: score > 0.5 ? "similar" : "dissimilar",
      metadata: {
        actualWordsCount: actualWords.size,
        expectedWordsCount: expectedWords.size,
        commonWordsCount: wordsInCommon.size,
        allWordsCount: allWords.size
      },
      explanation: `Jaccard similarity: ${score}`
    };
  }
});
```

{% endtab %}
{% endtabs %}

or LLMs.

{% tabs %}
{% tab title="Python" %}

```python
from phoenix.experiments.evaluators import create_evaluator
from typing import Any, Dict

eval_prompt_template = """
Given the QUESTION and REFERENCE_ANSWER, determine whether the ANSWER is accurate.
Output only a single word (accurate or inaccurate).

QUESTION: {question}

REFERENCE_ANSWER: {reference_answer}

ANSWER: {answer}

ACCURACY (accurate / inaccurate):
"""


@create_evaluator(kind="llm")  # need the decorator or the kind will default to "code"
def accuracy(input: Dict[str, Any], output: str, expected: Dict[str, Any]) -> float:
    message_content = eval_prompt_template.format(
        question=input["question"], reference_answer=expected["answer"], answer=output
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    response_message_content = response.choices[0].message.content.lower().strip()
    return 1.0 if response_message_content == "accurate" else 0.0
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
import { asEvaluator } from "phoenix/experiments";
import { AnnotatorKind } from "phoenix/types/annotations";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// LLM-based accuracy evaluator
const accuracy = asEvaluator({
  name: "accuracy",
  kind: "LLM" as AnnotatorKind,
  evaluate: async ({ input, output, expected }) => {
    const question = (input.question as string) || "No question provided";
    const referenceAnswer = (expected?.answer as string) || "No reference answer provided";

    const evalPromptTemplate = `
      Given the QUESTION and REFERENCE_ANSWER, determine whether the ANSWER is accurate.
      Output only a single word (accurate or inaccurate).
      
      QUESTION: {question}
      
      REFERENCE_ANSWER: {reference_answer}
      
      ANSWER: {answer}
      
      ACCURACY (accurate / inaccurate):
    `;

    const messageContent = evalPromptTemplate
      .replace("{question}", question)
      .replace("{reference_answer}", referenceAnswer)
      .replace("{answer}", String(output));

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: messageContent }]
    });

    const responseContent = 
      response.choices[0]?.message?.content?.toLowerCase().trim() || "";
    const isAccurate = responseContent === "accurate";

    return {
      score: isAccurate ? 1.0 : 0.0,
      label: isAccurate ? "accurate" : "inaccurate",
      metadata: {},
      explanation: `LLM determined the answer is ${isAccurate ? "accurate" : "inaccurate"}`
    };
  }
});
```

{% endtab %}
{% endtabs %}

## Experiments

Run an experiment and evaluate the results.

{% tabs %}
{% tab title="Python" %}

```python
from phoenix.experiments import run_experiment

experiment = run_experiment(
    dataset,
    task,
    experiment_name="initial-experiment",
    evaluators=[jaccard_similarity, accuracy],
)
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
import { runExperiment } from "phoenix/experiments";

// Run the experiment with selected evaluators
const experiment = await runExperiment({
  client,
  experimentName: "initial-experiment",
  dataset: { datasetId }, // Use the dataset ID from earlier
  task,
  evaluators: [jaccardSimilarity, accuracy]
});

console.log("Initial experiment completed with ID:", experiment.id);
```

{% endtab %}
{% endtabs %}

Run more evaluators after the fact.

{% tabs %}
{% tab title="Python" %}

```python
from phoenix.experiments import evaluate_experiment

experiment = evaluate_experiment(experiment, evaluators=[contains_keyword, conciseness])
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
import { runExperiment } from "phoenix/experiments";

// Run additional evaluators on the same experiment
const updatedExperiment = await runExperiment({
  client,
  experimentName: experiment.id, // Use the same experiment ID
  dataset: { datasetId }, // Use the dataset ID from earlier
  task: async () => "", // No-op task since we're just evaluating
  evaluators: [containsKeyword, conciseness]
});

console.log("Additional evaluations completed with ID:", updatedExperiment.id);
```

{% endtab %}
{% endtabs %}

And iterate 🚀

### Dry Run

Sometimes we may want to do a quick sanity check on the task function or the evaluators before unleashing them on the full dataset. `run_experiment()` and `evaluate_experiment()` both are equipped with a `dry_run=` parameter for this purpose: it executes the task and evaluators on a small subset without sending data to the Phoenix server. Setting `dry_run=True` selects one sample from the dataset, and setting it to a number, e.g. `dry_run=3`, selects multiple. The sampling is also deterministic, so you can keep re-running it for debugging purposes.
