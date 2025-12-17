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

```typescript
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals/llm";
import { openai } from "@ai-sdk/openai";
const model = openai("gpt-4o-mini");

// Hallucination Detection
const hallucinationEvaluator = createHallucinationEvaluator({
  model,
});

// Use the evaluators
const result = await hallucinationEvaluator({
  input: "What is the capital of France?",
  context: "France is a country in Europe. Paris is its capital city.",
  output: "The capital of France is London.",
});

console.log(result);
// Output: { label: "hallucinated", score: 0, explanation: "..." }
```

### Data Mapping

When your data structure doesn't match what an evaluator expects, use `bindEvaluator` to map your fields to the evaluator's expected input format:

```typescript
import {
  bindEvaluator,
  createHallucinationEvaluator,
} from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

type ExampleType = {
  question: string;
  context: string;
  answer: string;
};

const evaluator = bindEvaluator<ExampleType>(
  createHallucinationEvaluator({ model }),
  {
    inputMapping: {
      input: "question", // Map "input" from "question"
      reference: "context", // Map "reference" from "context"
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
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals/llm";
import { openai } from "@ai-sdk/openai";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";

// Create your evaluator
const hallucinationEvaluator = createHallucinationEvaluator({
  model: openai("gpt-4o-mini"),
});

// Create a dataset for your experiment
const dataset = await createDataset({
  name: "hallucination-eval",
  description: "Evaluate the hallucination of the model",
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
const hallucinationCheck = asEvaluator({
  name: "hallucination",
  kind: "LLM",
  evaluate: async ({ input, output }) => {
    // Use the hallucination evaluator from phoenix-evals
    const result = await hallucinationEvaluator({
      input: input.question,
      context: input.context, // Note: uses 'context' not 'reference'
      output: output,
    });

    return result; // Return the evaluation result
  },
});

// Run the experiment with automatic tracing
runExperiment({
  experimentName: "hallucination-eval",
  experimentDescription: "Evaluate the hallucination of the model",
  dataset: dataset,
  task,
  evaluators: [hallucinationCheck],
});
```

## Examples

To run examples, install dependencies using `pnpm` and run:

```bash
pnpm install
pnpx tsx examples/experiment_evaluation_example.ts
# change the file name to run other examples
```

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg).
- 📚 Read the [Phoenix documentation](https://arize.com/docs/phoenix).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
