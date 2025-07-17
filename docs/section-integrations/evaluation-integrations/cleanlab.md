# Cleanlab

Ensuring the reliability and accuracy of LLM-generated responses is a critical challenge for production AI systems. Poor-quality training data, ambiguous labels, and untrustworthy outputs can degrade model performance and lead to unreliable results.

[Cleanlab TLM](https://cleanlab.ai/tlm/) is a tool that estimates the trustworthiness of an LLM response. It provides a confidence score that helps detect hallucinations, ambiguous responses, and potential misinterpretations. This enables teams to flag unreliable outputs and improve the robustness of their AI systems.

This guide demonstrates how to integrate Cleanlab’s Trustworthy Language Model (TLM) with Phoenix to systematically identify and improve low-quality LLM responses. By leveraging TLM for automated data quality assessment and Phoenix for response analysis, you can build more robust and trustworthy AI applications.

Specifically, this tutorial will walk through:

* Evaluating LLM-generated responses for trustworthiness.
* Using Cleanlab TLM to score and flag untrustworthy responses.
* Leveraging Phoenix for tracing and visualizing response evaluations.

### Key Implementation Steps for generating evals w/ TLM

1. Install Dependencies, Set up API Keys, Obtain LLM Reponses + Trace in Phoenix
2. Download Trace Dataset

```python
import phoenix as px

spans_df = px.Client().get_spans_dataframe(project_name=[your_project_name])
spans_df.head()
```

3. Prep data from trace dataset

```python
# Create a new DataFrame with input and output columns
eval_df = spans_df[["context.span_id", "attributes.input.value", "attributes.output.value"]].copy()
eval_df.set_index("context.span_id", inplace=True)

# Combine system and user prompts from the traces
def get_prompt(input_value):
    if isinstance(input_value, str):
        input_value = json.loads(input_value)
    system_prompt = input_value["messages"][0]["content"]
    user_prompt = input_value["messages"][1]["content"]
    return system_prompt + "\n" + user_prompt

# Get the responses from the traces
def get_response(output_value):
    if isinstance(output_value, str):
        output_value = json.loads(output_value)
    return output_value["choices"][0]["message"]["content"]

# Create a list of prompts and associated responses
prompts = [get_prompt(input_value) for input_value in eval_df["attributes.input.value"]]
responses = [get_response(output_value) for output_value in eval_df["attributes.output.value"]]

eval_df["prompt"] = prompts
eval_df["response"] = responses
```

3. Setup TLM & Evaluate each pair

```python
from cleanlab_tlm import TLM

tlm = TLM(options={"log": ["explanation"]})

# Evaluate each of the prompt, response pairs using TLM
evaluations = tlm.get_trustworthiness_score(prompts, responses)

# Extract the trustworthiness scores and explanations from the evaluations
trust_scores = [entry["trustworthiness_score"] for entry in evaluations]
explanations = [entry["log"]["explanation"] for entry in evaluations]

# Add the trust scores and explanations to the DataFrame
eval_df["score"] = trust_scores
eval_df["explanation"] = explanations
```

4. Upload Evals to Phoenix

```python
from phoenix.trace import SpanEvaluations

eval_df["score"] = eval_df["score"].astype(float)
eval_df["explanation"] = eval_df["explanation"].astype(str)

px.Client().log_evaluations(SpanEvaluations(eval_name="Trustworthiness", dataframe=eval_df))
```

Check out the full tutorial here:

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/integrations/evaluating_traces_cleanlabTLM.ipynb" %}

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/cleanlabsTLMEvals.gif" %}
