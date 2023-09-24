---
description: >-
  Evals are LLM powered functions that you can use to evaluate the output of
  your LLM or generative application
---

# Evals

{% hint style="warning" %}
Evals are still under `experimental` and must be installed via `pip install arize-phoenix[experimental]`
{% endhint %}

## phoenix.experimental.evals.llm\_binary

```python
def llm_eval_binary(
    dataframe: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: BaseEvalModel,
    rails: List[str],
    system_instruction: Optional[str] = None,
) -> List[Optional[str]]
```

Runs binary classifications using an LLM.

### Parameters

* **dataframe (pd.DataFrame)**: A pandas dataframe in which each row represents a record to be classified. All template variable names must appear as column names in the dataframe (extra columns unrelated to the template are permitted).
* **template (PromptTemplate or st):** The prompt template as either an instance of PromptTemplate or a string. If the latter, the variable names should be surrounded by curly braces so that a call to `.format` can be made to substitute variable values.
* **model (BaseEvalModel):** An LLM model class instance
* **rails** (**List\[str]**): A list of strings representing the possible output classes of the model's predictions.
* **system\_instruction (Optional\[str])**: An optional system message for modals that support it

### Returns

* **evaluations: (List\[str])**: A list of strings representing the predicted class for each record in the dataframe. The list should have the same length as the input dataframe and its values should be the entries in the \`rails\` argument or None if the model's prediction could not be parsed.

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/experimental/evals/functions/binary.py)**]**

## phoenix.experimental.run\_relevance\_eval

```python
def run_relevance_eval(
    dataframe: pd.DataFrame,
    query_column_name: str = "attributes.input.value",
    retrieved_documents_column_name: str = "attributes.retrieval.documents",
    template: str = RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    model: Optional[BaseEvalModel] = None,
) -> List[List[Optional[bool]]]:
```

Given a pandas dataframe containing queries and retrieved documents, classifies the relevance of each retrieved document to the corresponding query using an LLM.

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/experimental/evals/functions/binary.py)**]**

## phoenix.experimental.evals.llm\_generate

```python
def llm_generate(
    dataframe: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: Optional[BaseEvalModel] = None,
    system_instruction: Optional[str] = None,
) -> List[str]
```

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/experimental/evals/functions/generate.py)**]**
