# Prompt Formats

Phoenix evaluators support multiple prompt formats, all compatible with supported models and providers.

## Supported Formats

### 1. String Prompts

Simple string templates with variable placeholders.

{% tabs %}
{% tab title="Python" %}
```python
evaluator = ClassificationEvaluator(
    name="sentiment",
    llm=llm,
    prompt_template="Classify the sentiment: {text}",
    choices=["positive", "negative", "neutral"]
)
```
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

const evaluator = createClassificationEvaluator({
  name: "sentiment",
  model,
  promptTemplate: "Classify the sentiment: {{text}}",
  choices: { positive: 1, negative: 0, neutral: 0.5 },
});
```
{% endtab %}
{% endtabs %}

### 2. Message Lists

Arrays of message objects with `role` and `content` fields.

{% tabs %}
{% tab title="Python" %}
```python
evaluator = ClassificationEvaluator(
    name="helpfulness",
    llm=llm,
    prompt_template=[
        {"role": "system", "content": "Evaluate the answer helpfulness."},
        {"role": "user", "content": "Question: {question}\nAnswer: {answer}"}
    ],
    choices=["helpful", "somewhat_helpful", "not_helpful"]
)
```

**Supported roles:**

* `"system"` - Instructions for the model.
* `"user"` - User messages and input context.
* `"assistant"` - Assistant/model responses (for multi-turn conversations or few-shot examples)
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

const evaluator = createClassificationEvaluator({
  name: "helpfulness",
  model,
  promptTemplate: [
    { role: "system", content: "Evaluate the answer helpfulness." },
    { role: "user", content: "Question: {{question}}\nAnswer: {{answer}}" },
  ],
  choices: { helpful: 1, somewhat_helpful: 0.5, not_helpful: 0 },
});
```

**Supported roles:**

* `"system"` - Instructions for the model.
* `"user"` - User messages and input context.
* `"assistant"` - Assistant/model responses (for multi-turn conversations or few-shot examples)
{% endtab %}
{% endtabs %}

### 3. Structured Content Parts (Python only)

Messages with multiple content parts, useful for separating different pieces of context.

{% tabs %}
{% tab title="Python" %}
Only text content is supported at this time.

```python
evaluator = ClassificationEvaluator(
    name="relevance",
    llm=llm,
    prompt_template=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Question: {question}"},
                {"type": "text", "text": "Answer: {answer}"}
            ]
        }
    ],
    choices=["relevant", "not_relevant"]
)
```
{% endtab %}

{% tab title="TypeScript" %}
Structured content parts are not currently supported in the TypeScript library. Use message lists or string templates instead.
{% endtab %}
{% endtabs %}

## Template Variables

All formats support variable substitution. Python supports both f-string (`{variable}`) and mustache (`{{variable}}`) syntax, while TypeScript supports mustache syntax only.

{% tabs %}
{% tab title="Python" %}
```python
# Variables are provided when calling .evaluate()
result = evaluator.evaluate({
    "question": "What is Python?",
    "answer": "A programming language"
})
```
{% endtab %}

{% tab title="TypeScript" %}
```typescript
// Variables are provided when calling .evaluate()
const result = await evaluator.evaluate({
  question: "What is Python?",
  answer: "A programming language",
});

console.log(result.label); // e.g., "relevant"
```
{% endtab %}
{% endtabs %}

## Client-Specific Behavior

{% tabs %}
{% tab title="Python" %}
All clients accept the same message format as input. Adapters handle client-specific transformations internally as needed:

#### OpenAI

* System role is converted to developer role for reasoning models.
* Otherwise, messages are passed as-is.

#### Anthropic

* System messages are extracted and passed via `system` parameter
* User/assistant messages sent in messages array

#### Google GenAI

* System messages are extracted and passed via `system_instruction` in config
* Assistant role converted to `model` role
* Messages sent in contents array

#### LiteLLM

* Messages passed directly to LiteLLM in OpenAI format
* LiteLLM handles provider-specific conversions internally

#### LangChain

* OpenAI format messages are converted to LangChain message objects (`HumanMessage`, `AIMessage`, `SystemMessage`)
{% endtab %}

{% tab title="TypeScript" %}
The TypeScript library uses the AI SDK which handles provider-specific message formatting automatically. The AI SDK normalizes the interface across providers, so you can use the same prompt templates regardless of which model provider you choose.

For provider-specific details, refer to the [AI SDK documentation](https://sdk.vercel.ai/providers/ai-sdk-providers).
{% endtab %}
{% endtabs %}

## Full Example

A complete example showing evaluator setup and usage:

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.evals import ClassificationEvaluator, LLM

llm = LLM(provider="openai", model="gpt-4o-mini")

evaluator = ClassificationEvaluator(
    name="helpfulness",
    llm=llm,
    prompt_template=[
        {"role": "system", "content": "You evaluate response helpfulness."},
        {"role": "user", "content": "Question: {question}\nAnswer: {answer}"}
    ],
    choices=["helpful", "somewhat_helpful", "not_helpful"]
)

result = evaluator.evaluate({
    "question": "How do I learn Python?",
    "answer": "Start with online tutorials and practice daily."
})

print(result[0].label)  # e.g., "helpful"
```
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4o-mini");

const evaluator = createClassificationEvaluator({
  name: "helpfulness",
  model,
  promptTemplate: [
    { role: "system", content: "You evaluate response helpfulness." },
    { role: "user", content: "Question: {{question}}\nAnswer: {{answer}}" },
  ],
  choices: { helpful: 1, somewhat_helpful: 0.5, not_helpful: 0 },
});

const result = await evaluator.evaluate({
  question: "How do I learn Python?",
  answer: "Start with online tutorials and practice daily.",
});

console.log(result.label); // e.g., "helpful"
```
{% endtab %}
{% endtabs %}
