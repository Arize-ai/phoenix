# Prompt Formats

Phoenix LLM evaluators support multiple prompt formats and are compatible with all the supported models and providers.

### Supported Formats

#### 1. String Prompts

Simple string templates with variable placeholders.

```python
evaluator = ClassificationEvaluator(
    name="sentiment",
    llm=llm,
    prompt_template="Classify the sentiment: {text}",
    choices=["positive", "negative", "neutral"]
)
```

#### 2. Message Lists

List of message dictionaries with `role` and `content` fields.

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

#### 3. Structured Content Parts

Messages with multiple content parts (e.g., multiple text segments).

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

### Template Variables

All formats support variable substitution using f-string (`{variable}` ) or mustache (`{{variable}}`) syntax for the placeholders.&#x20;

```python
# Variables are provided when calling .evaluate()
result = evaluator.evaluate({
    "question": "What is Python?",
    "answer": "A programming language"
})
```

### Client-Specific Behavior

All clients accept the same message format as input. Adapters handle client-specific transformations internally as needed:&#x20;

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

### Example

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
