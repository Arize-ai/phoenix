I want to make the following changes to the traces for LLM and built-in evaluators.


## LLM Evaluator Trace Changes

The topology of the traces needs to change.

- The "Evaluation: <name>" span needs to be renamed to "Evaluator: <name>", where `<name>` is the name of the **dataset evaluator**.
- The "Apply input mapping span" needs to be broken into two spans:
    - An "Input Mapping" span. This will be a simple chain span.
        - For input value, it should take a JSON object (fill in the empty objects):

```json
{
    "input_mapping": {
        "path_mapping": {
        
        },
        "literal_mapping": {

        }
    },
    "template_variables": {

    }
}
```
        - As an output value, it should take the mapped template variables as a JSON object.
    - The second span will be a "Prompt: <prompt-template-name>" span.
        - It should have "PROMPT" span kind. This needs to be hard-coded, it is not yet part of the OpenInference library.
        - The input value should be the template variables as a JSON object. No nesting, just the template variable names as base-level keys.
        - The output value should be the JSON dumps of the list of messages, where the messages have type `Message` from `openinference-instrumentation`. It should be a JSON object with a single "messages" key.
    - The "Parse eval result" span should be renamed to "Parse Eval Result".

## Built-in Evaluator Trace Changes

    - The "Evaluation: <name>" span needs to be renamed to "Evaluator: <name>", where `<name>` is the name of the **dataset evaluator**.
    - "Apply input mapping" should be renamed to "Input Mapping". It should have the same structure as above.
    - The `Run Contains` span should be renamed to just the name of the evaluator. This is the name of the **base built-in evaluator**, not the dataset evaluator name.
    - The "Parse eval result" span should be renamed to "Parse Eval Result".

## Relevant Files

### Primary Source File
- **`src/phoenix/server/api/evaluators.py`** - Main implementation file containing all evaluator classes and trace logic
  - `LLMEvaluator` class (line 143): Implements LLM-based evaluators
  - `BuiltInEvaluator` class (line 469): Base class for built-in evaluators
  - Built-in evaluator implementations:
    - `ContainsEvaluator` (line 1000)
    - `ExactMatchEvaluator` (line 1227)
    - `RegexEvaluator` (line 1437)
    - `LevenshteinDistanceEvaluator` (line 1682)
    - `JSONDistanceEvaluator` (line 1915)
  - `_get_llm_evaluators()` function (line 544): Fetches LLM evaluators and prompt information

### Primary Test File
- **`tests/unit/server/api/test_subscriptions.py`** - Comprehensive tests for evaluator spans
  - Tests verify span names, attributes, parent-child relationships
  - Test fixtures at lines 2193, 2419, 2472, 2497, 2559

### Supporting Test Files
- **`tests/unit/server/api/conftest.py`** - Test fixtures
  - `correctness_llm_evaluator` fixture (line 827): Creates test LLM evaluator with prompt
  - `assign_correctness_llm_evaluator_to_dataset` fixture (line 909): Assigns LLM evaluator to dataset
  - `assign_exact_match_builtin_evaluator_to_dataset` fixture (line 940): Assigns built-in evaluator to dataset
- **`tests/unit/server/api/mutations/test_chat_mutations.py`** - Chat mutation tests with evaluators
- **`tests/unit/server/api/helpers/test_evaluators.py`** - Helper tests for evaluator validation

### Helper Files
- **`src/phoenix/server/api/helpers/evaluators.py`** - Validation logic for evaluator prompts and configs
- **`src/phoenix/db/models.py`** - Database models
  - `Prompt` class (line 1892): Stores prompt templates
  - `PromptVersion` class (line 1956): Stores prompt versions
  - `LLMEvaluator` class (line 2258): LLM evaluator database model

Ensure all unit tests pass.