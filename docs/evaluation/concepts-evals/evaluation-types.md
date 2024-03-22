# Eval Data Types

There are a multiple types of evaluations supported by the Phoenix Library. A type of an LLM Evaluation can be understood as the output type of the LLM Eval.

&#x20;

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/eval_types.png" alt=""><figcaption></figcaption></figure>

Phoenix has options for all of the above though we highly recommend categorical options:

**Categorical (binary)**: Ouptut is either a single string or a 1/0

**Categorical (Multi-class)**: Output is a class of string values also can be distinct numbers

**Score:** A numeric value in a range

Why we recommend categorical LLM Evals over scores is highlighted in this[ research. ](https://twitter.com/aparnadhinak/status/1748368364395721128)

###
