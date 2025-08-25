# Evaluators

At the core, an Evaluator is anything that returns a Score. 

### Abstractions
- Score: immutable result container
- Evaluator: base class for sync/async evaluation with input validation and mapping
- LLMEvaluator: base class that integrates with an LLM and a prompt template
- ClassificationEvaluator: LLM-powered single-criteria classification
- create_classifier: factory for ClassificationEvaluator
- create_evaluator decorator: register simple evaluation functions

### Score
- `name: str | None`: The human-readable name of the score/evaluator.
- `score: float | int | None`: The numeric score value, when applicable.
- `label: str | None`: The categorical outcome (e.g., "good", "bad", or other label).
- `explanation: str | None`: A brief rationale or justification for the result (e.g. for LLM-as-a-judge).
- `metadata: dict`: Arbitrary extra context such as model details, intermediate scores, or run info.
- `source: "human" | "llm" | "heuristic" | None`: The origin of the evaluation signal.
- `direction: "maximize" | "minimize"`: The optimization direction; defaults to "maximize".
- Methods:
  - `to_dict() -> dict`: Returns only non-None fields.
  - `pretty_print(indent: int = 2) -> None`: Prints a formatted JSON view of the score.

### Evaluator
- Constructor: `Evaluator(name: str, source: SourceType, input_schema: Optional[type[BaseModel]] = None, direction: Literal["maximize","minimize"] = "maximize")`
- Properties: `name`, `source`, `direction`, `input_schema`
- Methods:
  - `evaluate(eval_input: dict, input_mapping: InputMappingType | None = None) -> list[Score]`
  - `aevaluate(eval_input: dict, input_mapping: InputMappingType | None = None) -> list[Score]`
  - `describe() -> dict`: Returns evaluator metadata and input schema
  - Subclasses implement `_evaluate(eval_input) -> list[Score]` and optionally `_aevaluate(eval_input)`.

### Input mapping and validation
- Evaluators use Pydantic schemas for input validation and type safety
- Required fields are enforced. Missing or empty values raise `ValueError`.
- Use `input_mapping` to map evaluator-required field names to your input keys or paths.

### LLMEvaluator
- Constructor: `LLMEvaluator(name: str, llm: LLM | AsyncLLM, prompt_template: str | Template, schema: dict | None = None, input_schema: Optional[type[BaseModel]] = None, direction: "maximize" | "minimize" = "maximize")`
- Infers `input_schema` from the prompt template placeholders when not provided.
- Synchronous `evaluate` requires a sync `LLM`. Asynchronous `aevaluate` requires an `AsyncLLM`.

### ClassificationEvaluator
- Constructor: `ClassificationEvaluator(name: str, llm: LLM | AsyncLLM, prompt_template: str | Template, choices: list[str] | dict[str, float | int] | dict[str, tuple[float|int, str]], include_explanation: bool = True, input_schema: Optional[type[BaseModel]] = None, direction: "maximize" | "minimize" = "maximize")`
- Behavior:
  - `choices` may be a list of labels, a mapping label->score, or label->(score, description)
  - Returns one `Score` with `label` and optional `score` (from mapping) and `explanation`
  - Validates that the generated label is within the provided choices

### Decorator and factory
- `create_evaluator(name: str, source: SourceType, direction: DirectionType = "maximize")` registers a function as a heuristic evaluator. Input schema is inferred from the function signature.
- `list_evaluators() -> list[str]` returns registered evaluator names.
- `create_classifier(...) -> ClassificationEvaluator` shortcut to build a `ClassificationEvaluator`.

### Utilities
- `remap_eval_input(eval_input: Mapping[str, Any], required_fields: Set[str], input_mapping: InputMappingType | None = None) -> dict`
  - Returns a dict keyed by evaluator's required fields.
- `to_thread(fn)`
  - Wrap a sync function to run in a thread from async contexts.

# Input Mapping and Binding

The preview evals library provides powerful input mapping capabilities that allow you to extract and transform data from complex nested structures.

## Input Mapping Types

The `input_mapping` parameter accepts several types of mappings:

1. **Simple key mapping**: `{"field": "key"}` - maps evaluator field to input key
2. **Path mapping**: `{"field": "nested.path"}` - uses JSON path syntax from [jsonpath-ng](https://pypi.org/project/jsonpath-ng/)
3. **Callable mapping**: `{"field": lambda x: x["key"]}` - custom extraction logic

### Path Mapping Examples

```python
# Nested dictionary access
input_mapping = {
    "query": "input.query",
    "context": "input.documents",
    "response": "output.answer"
}

# Array indexing
input_mapping = {
    "first_doc": "input.documents[0]",
    "last_doc": "input.documents[-1]"
}

# Combined nesting and list indexing
input_mapping = {
    "user_query": "data.user.messages[0].content",
}
```

### Callable Mappings

For complex transformations, use callable functions that accept an `eval_input` payload:

```python
# Callable example
def extract_context(eval_input):
    docs = eval_input.get("input", {}).get("documents", [])
    return " ".join(docs[:3])  # Join first 3 documents

input_mapping = {
    "query": "input.query",
    "context": extract_context,
    "response": "output.answer"
}

# Lambda example
input_mapping = {
    "user_query": lambda x: x["input"]["query"].lower(),
    "context": lambda x: " ".join(x["documents"][:3])
}
```

## Pydantic Input Schemas

Evaluators use Pydantic models for input validation and type safety. 

```python
from pydantic import BaseModel
from typing import List

class HallucinationInput(BaseModel):
    query: str
    context: List[str]
    response: str

evaluator = HallucinationEvaluator(
    name="hallucination",
    llm=llm,
    prompt_template="...",
    input_schema=HallucinationInput
)
```

### Schema Inference

LLM evaluators automatically infer schemas from prompt templates:

```python
# This creates a schema with required str fields: query, context, response
evaluator = LLMEvaluator(
    name="hallucination",
    llm=llm,
    prompt_template="Query: {query}\nContext: {context}\nResponse: {response}"
)
```
or decorated function signatures:

```python
@create_evaluator(name="exact_match")
def exact_match(output: str, expected: str) -> Score:
  ...
# creates input_schema with required str fields: output, expected
{'properties': {
  'output': {'title': 'Output','type': 'string'},
  'expected': {'title': 'Expected', 'type': 'string'}
  },
  'required': ['output', 'expected']
}
```


## Binding System

Use `bind_evaluator` to create a pre-configured evaluator with a fixed input mapping. 
At evaluation time, you only need to provide the `eval_input` and the mapping is handled internally.

```python
from phoenix.evals.preview import bind_evaluator

# Create a bound evaluator with fixed mapping
bound_evaluator = bind_evaluator(
    evaluator,
    {
        "query": "input.query",
        "context": "input.documents",
        "response": "output.answer"
    }
)

# Run evaluation
scores = bound_evaluator({
    "input": {"query": "How do I reset?", "documents": ["Manual", "Guide"]},
    "output": {"answer": "  Go to settings > reset.  "}
})
```

### BoundEvaluator Features

- **Static validation**: Mapping syntax is validated at creation time
- **Introspection**: `describe()` shows mapping details alongside schema


## FAQ

### Why do evaluators accept a payload and an input_mapping vs. kwargs?
Different evaluators require different keyword arguments to operate. These arguments may not perfectly match those in your example or dataset.

Let's say our example looks like this, where the inputs and outputs contain nested dictionaries:

```python
eval_input = {
	"input": {
		"query": "user input query",
		"documents": ["doc A", "doc B"]
	},
	"output": {"response": "model answer"},
	"expected": "correct answer"
}
```

We want to run two evaluators over this example:
- `Hallucination`, which requires `query`, `context`, and `response` 
- `exact_match`, which requires `expected` and `output` 

Rather than modifying our data to fit the two evaluators, we make the evaluators fit the data.

Binding an `input_mapping` enables the evaluators to run on the same payload - the map/transform steps are handled by the evaluator itself.


### How are missing or optional fields handled?

The input mapping system distinguishes between required and optional fields:

- **Required fields**: Must be present and non-empty, or evaluation fails
- **Optional fields**: Can be missing or empty, and are only included if successfully extracted from the input

For optional fields, use the binding system or ensure your input schema marks fields as optional:

```python
from pydantic import BaseModel
from typing import Optional

class MyInput(BaseModel):
    required_field: str
    optional_field: Optional[str] = None
```


