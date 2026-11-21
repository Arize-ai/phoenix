# Evaluators in TypeScript

Every evaluator from `@arizeai/phoenix-evals` has a `name` and an async
`evaluate(record)` that returns one result: `{ score?, label?, explanation?,
metadata? }`. The same evaluator works on its own, in `runExperiment`, and in the
Vitest and Jest integrations.

## Code evaluators

```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

const hasCitation = createEvaluator<{ output: string }>(
  ({ output }) => (/\[\d+\]/.test(output) ? 1 : 0),
  { name: "has_citation", kind: "CODE" }
);

const validJson = createEvaluator<{ output: string }>(
  ({ output }) => {
    try {
      JSON.parse(output);
      return { score: 1, label: "valid" };
    } catch (error) {
      return { score: 0, label: "invalid", explanation: String(error) };
    }
  },
  { name: "valid_json", kind: "CODE" }
);
```

The function can return a number, which becomes the score, a string, which becomes
the label, or an object. From an object, the evaluator keeps `score`, `label`,
`explanation`, and `metadata`. Options are
`name`, `kind` (`"CODE"` or `"LLM"`), and `optimizationDirection` (`"MAXIMIZE"`,
`"MINIMIZE"`, or `"NEUTRAL"`).

## LLM classification evaluators

`createClassificationEvaluator` is synchronous, so don't `await` it.

```typescript
import { openai } from "@ai-sdk/openai";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

const grounded = createClassificationEvaluator<{ context: string; output: string }>({
  name: "grounded",
  model: openai("gpt-4o"),
  promptTemplate: `You are checking whether an answer is supported by its sources.

<sources>{{context}}</sources>
<answer>{{output}}</answer>

"grounded": every factual claim in the answer appears in the sources.
"ungrounded": at least one factual claim is missing from or contradicts the sources.`,
  choices: { grounded: 1, ungrounded: 0 },
});

const result = await grounded.evaluate({
  context: "Paris is in France.",
  output: "Paris is in France.",
});
console.log(result.label, result.score, result.explanation);
```

- `choices` maps each label to its score.
- Set `optimizationDirection: "MINIMIZE"` when 1 is the bad outcome.
- `createClassifierFn` returns a plain classify function, without the evaluator
  wrapper, for use outside experiments.

### Decision models

Any classification evaluator accepts an AI SDK decision model, such as
`openai.decisionModel("gpt-6-luna")`, in place of a language model. A decision model
picks a label directly. It's cheaper and faster, returns no explanation, and puts
label probabilities in `metadata.probabilities`. With OpenAI, use `@ai-sdk/openai`
4.0.89 or later.

## Map your field names to the evaluator's

Templates read keys by name. Inside `runExperiment`, the record is `{ input, output,
expected, metadata }`, and `input` and `expected` are objects, so a template that
reads `{{input}}` gets JSON. Read nested fields with a dotted path in the template,
such as `{{input.question}}`, or map them with `inputMapping`. Templates support full
Mustache, so a section such as `{{#turns}}{{role}}: {{content}}{{/turns}}` formats a
list of turns as a transcript:

```typescript
import { bindEvaluator } from "@arizeai/phoenix-evals";

const boundGrounded = bindEvaluator(grounded, {
  inputMapping: {
    context: "metadata.retrievedText",
    output: "output.answer",
  },
});
```

`inputMapping` is also an option on `createClassificationEvaluator` and every
pre-built factory. For a `createEvaluator` code evaluator, use `bindEvaluator`.

## Use evaluators in experiments

Pass `@arizeai/phoenix-evals` evaluators straight into `runExperiment({ evaluators })`.
For a custom experiment evaluator that isn't built with this library, use
`asExperimentEvaluator` from `@arizeai/phoenix-client/experiments`; see
phoenix-experiments.
