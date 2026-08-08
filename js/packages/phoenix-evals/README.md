<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-client-ts">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        @arizeai/phoenix-evals
    </div>
</h1>

<p align="center">
    <a href="https://www.npmjs.com/package/@arizeai/phoenix-evals">
        <img src="https://img.shields.io/npm/v/%40arizeai%2Fphoenix-evals" alt="NPM Version">
    </a>
    <a href="https://arize-ai.github.io/phoenix/">
        <img src="https://img.shields.io/badge/docs-blue?logo=typescript&logoColor=white" alt="Documentation">
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=js/packages/phoenix-evals/README.md" />
</p>

This package provides a TypeScript evaluation library. It is vendor agnostic and can be used in isolation of any framework or platform. This package is still under active development and is subject to change.

## Installation

```bash
# or yarn, pnpm, bun, etc...
npm install @arizeai/phoenix-evals
```

This package is built on [AI SDK](https://ai-sdk.dev/) v7, which is ESM-only. Node.js 22.12 or newer is required (the CommonJS build relies on `require()` of ESM). Use AI SDK v7-compatible model provider packages (e.g. `@ai-sdk/openai` v4+).

## Usage

### Creating a Classifier

The library provides a `createClassifier` function that allows you to create custom evaluators for different tasks like hallucination detection, relevance scoring, or any binary/multi-class classification.

```typescript
import { createClassifier } from "@arizeai/phoenix-evals/llm";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

const promptTemplate = `
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information. You
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the answer text
contains factual information and is not a hallucination. A 'hallucination' refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text. Your response should be a single word: either "factual" or "hallucinated", and
it should not include any other text or characters.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Reference text]: {{reference}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

Is the answer above factual or hallucinated based on the query and reference text?
`;

// Create the classifier
const evaluator = await createClassifier({
  model,
  choices: { factual: 1, hallucinated: 0 },
  promptTemplate: promptTemplate,
});

// Use the classifier
const result = await evaluator({
  output: "Arize is not open source.",
  input: "Is Arize Phoenix Open Source?",
  reference:
    "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
});

console.log(result);
// Output: { label: "hallucinated", score: 0 }
```

See the complete example in [`examples/classifier_example.ts`](examples/classifier_example.ts).

### Pre-Built Evaluators

The library includes several pre-built evaluators for common evaluation tasks. These evaluators come with optimized prompts and can be used directly with any AI SDK model.

All pre-built evaluators are available from the `@arizeai/phoenix-evals/llm` module:

| Evaluator              | Function                              | Description                                                                       |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Faithfulness           | `createFaithfulnessEvaluator`         | Detects hallucinations — checks if the output is grounded in the provided context |
| Conciseness            | `createConcisenessEvaluator`          | Evaluates whether the response is appropriately concise                           |
| Correctness            | `createCorrectnessEvaluator`          | Checks if the output is factually correct given the input                         |
| Document Relevance     | `createDocumentRelevanceEvaluator`    | Measures how relevant a retrieved document is to the query                        |
| Refusal                | `createRefusalEvaluator`              | Detects whether the model refused to answer                                       |
| Tool Invocation        | `createToolInvocationEvaluator`       | Evaluates whether the correct tool was invoked with the right arguments           |
| Tool Selection         | `createToolSelectionEvaluator`        | Checks whether the right tool was selected for the task                           |
| Tool Response Handling | `createToolResponseHandlingEvaluator` | Evaluates how well the model uses a tool's response                               |

```typescript
import {
  createFaithfulnessEvaluator,
  createConcisenessEvaluator,
  createCorrectnessEvaluator,
  createDocumentRelevanceEvaluator,
  createRefusalEvaluator,
} from "@arizeai/phoenix-evals/llm";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

// Faithfulness: checks if the output is grounded in the context
const faithfulnessEvaluator = createFaithfulnessEvaluator({ model });
const faithfulnessResult = await faithfulnessEvaluator.evaluate({
  input: "What is the capital of France?",
  context: "France is a country in Europe. Paris is its capital city.",
  output: "The capital of France is London.",
});
console.log(faithfulnessResult);
// Output: { label: "unfaithful", score: 0, explanation: "..." }

// Correctness: checks if the output is factually correct
const correctnessEvaluator = createCorrectnessEvaluator({ model });
const correctnessResult = await correctnessEvaluator.evaluate({
  input: "What is the capital of France?",
  output: "Paris is the capital of France.",
});
console.log(correctnessResult);
// Output: { label: "correct", score: 1, explanation: "..." }

// Document Relevance: checks if a retrieved document is relevant to the query
const relevanceEvaluator = createDocumentRelevanceEvaluator({ model });
const relevanceResult = await relevanceEvaluator.evaluate({
  input: "What is the capital of France?",
  documentText: "Paris is the capital of France and a major European city.",
});
console.log(relevanceResult);
// Output: { label: "relevant", score: 1, explanation: "..." }
```

### Code Evaluators

The library also includes built-in, deterministic (non-LLM) code evaluators for common classification metrics: precision, recall, and F-beta (including F1). These are available from the `@arizeai/phoenix-evals/code` module and work over a batch of expected vs. predicted labels, supporting both binary classification (via `positiveLabel`) and multi-class classification (via `macro`/`micro`/`weighted` averaging).

- **Precision** — of everything predicted as a class, the fraction that was actually that class (`TP / (TP + FP)`). Lower precision means more false alarms.
- **Recall** — of everything that actually belongs to a class, the fraction the model found (`TP / (TP + FN)`). Lower recall means more misses.
- **F-beta** — the weighted harmonic mean of precision and recall. `beta = 1` (F1, the default) weights them equally; `beta > 1` weights recall more (use when missing a true positive is costlier, e.g. medical screening); `beta < 1` weights precision more (use when a false alarm is costlier, e.g. spam filtering).

```typescript
import {
  createPrecisionEvaluator,
  createRecallEvaluator,
  createF1Evaluator,
  createPrecisionRecallFScoreEvaluators,
} from "@arizeai/phoenix-evals/code";

const f1 = createF1Evaluator();
const result = await f1.evaluate({
  expected: ["cat", "dog", "cat", "bird"],
  output: ["cat", "cat", "cat", "bird"],
});
console.log(result);
// Output: { score: 0.6 }

// Or create matching precision/recall/F-score evaluators at once
const { precision, recall, fScore } = createPrecisionRecallFScoreEvaluators({
  average: "weighted",
});
```

Use `createFBetaEvaluator({ beta })` for F-scores other than F1 (e.g. `beta: 2` weights recall higher than precision). `createPrecisionRecallFScoreEvaluators` returns three separate evaluators (`{ precision, recall, fScore }`) sharing one options object — each yields a single score, matching the individual factories.

For multi-class data, `average` controls how per-class scores combine into one number: `"macro"` (default) weights every class equally — good for surfacing whether a rare class is being ignored; `"weighted"` weights each class by how often it occurs — good when overall performance matters more than parity across classes; `"micro"` pools every true/false positive and false negative across classes first — for single-label multi-class problems this equals overall accuracy.

See [`examples/classification_metrics_example.ts`](examples/classification_metrics_example.ts) for a runnable walkthrough covering binary classification, F-beta tradeoffs, and all three averaging strategies. For the underlying formulas, the precision/recall tradeoff, and citations, see the [Precision / Recall / F-Score docs](https://arize.com/docs/phoenix/evaluation/pre-built-metrics/precision-recall-fscore).

> **Note:** unlike the per-row LLM evaluators above, these classification-metric evaluators are batch/dataset-level: `expected`/`output` are the full sequence of labels across every example, not a single row's labels. Don't wire them directly into `runExperiment` as a per-row evaluator — instead, collect every row's expected/predicted label first, then call `.evaluate({ expected, output })` once over the full arrays.

### Data Mapping

When your data structure doesn't match what an evaluator expects, use `bindEvaluator` to map your fields to the evaluator's expected input format:

```typescript
import { bindEvaluator } from "@arizeai/phoenix-evals";
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals/llm";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

type ExampleType = {
  question: string;
  context: string;
  answer: string;
};

const evaluator = bindEvaluator<ExampleType>(
  createFaithfulnessEvaluator({ model }),
  {
    inputMapping: {
      input: "question", // Map "input" from "question"
      context: "context", // Map "context" from "context"
      output: "answer", // Map "output" from "answer"
    },
  }
);

const result = await evaluator.evaluate({
  question: "Is Arize Phoenix Open Source?",
  context:
    "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
  answer: "Arize is not open source.",
});
```

Mapping supports simple properties (`"fieldName"`), dot notation (`"user.profile.name"`), array access (`"items[0].id"`), JSONPath expressions (`"$.items[*].id"`), and function extractors (`(data) => data.customField`).

See the complete example in [`examples/bind_evaluator_example.ts`](examples/bind_evaluator_example.ts).

## Experimentation with Phoenix

This package works seamlessly with [`@arizeai/phoenix-client`](https://www.npmjs.com/package/@arizeai/phoenix-client) to enable experimentation workflows. You can create datasets, run experiments, and trace evaluation calls for analysis and debugging.

### Running Experiments

To run experiments with your evaluations, install the phoenix-client

```bash
npm install @arizeai/phoenix-client
```

```typescript
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals/llm";
import { openai } from "@ai-sdk/openai";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";

// Create your evaluator
const faithfulnessEvaluator = createFaithfulnessEvaluator({
  model: openai("gpt-4o-mini"),
});

// Create a dataset for your experiment
const dataset = await createDataset({
  name: "faithfulness-eval",
  description: "Evaluate the faithfulness of the model",
  examples: [
    {
      input: {
        question: "Is Phoenix Open-Source?",
        context: "Phoenix is Open-Source.",
      },
    },
    // ... more examples
  ],
});

// Define your experimental task
const task = async (example) => {
  // Your AI system's response to the question
  return "Phoenix is not Open-Source";
};

// Create a custom evaluator to validate results
const faithfulnessCheck = asExperimentEvaluator({
  name: "faithfulness",
  kind: "LLM",
  evaluate: async ({ input, output }) => {
    // Use the faithfulness evaluator from phoenix-evals
    const result = await faithfulnessEvaluator({
      input: input.question,
      context: input.context,
      output: output,
    });

    return result; // Return the evaluation result
  },
});

// Run the experiment with automatic tracing
runExperiment({
  experimentName: "faithfulness-eval",
  experimentDescription: "Evaluate the faithfulness of the model",
  dataset: dataset,
  task,
  evaluators: [faithfulnessCheck],
});
```

## Examples

To run examples, install dependencies using `pnpm` and run:

```bash
pnpm install
pnpx tsx examples/classifier_example.ts
# change the file name to run other examples
```

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g).
- 📚 Read the [Phoenix documentation](https://arize.com/docs/phoenix).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 💼 Follow us on [LinkedIn](https://www.linkedin.com/showcase/113218220).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
