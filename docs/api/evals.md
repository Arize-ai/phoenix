---
description: >-
  Evals are LLM-powered functions that you can use to evaluate the output of
  your LLM or generative application
---

# Evals

{% hint style="warning" %}
Evals are still under `experimental` and must be installed via `pip install arize-phoenix[experimental]`
{% endhint %}

## phoenix.experimental.evals.PromptTemplate

```python
class PromptTemplate(
    text: str
    delimiters: List[str]
)
```

Class used to store and format prompt templates.&#x20;

### Parameters

* **text** (str): The raw prompt text used as a template.&#x20;
* **delimiters** (List\[str]): List of characters used to locate the variables within the prompt template `text`. Defaults to `["{", "}"]`.

### Attributes

* **text** (str): The raw prompt text used as a template.&#x20;
* **variables** (List\[str]): The names of the variables that, once their values are substituted into the template, create the prompt text. These variable names are automatically detected from the template `text` using the `delimiters` passed when initializing the class (see Usage section below).&#x20;

### Usage

Define a `PromptTemplate` by passing a `text` string and the `delimiters` to use to locate the `variables`. The default delimiters are `{` and `}`.

```python
from phoenix.experimental.evals import PromptTemplate

template_text = "My name is {name}. I am {age} years old and I am from {location}."
prompt_template = PromptTemplate(text=template_text)
```

If the prompt template variables have been correctly located, you can access them as follows:

```python
print(prompt_template.variables)
# Output: ['name', 'age', 'location']
```

The `PromptTemplate` class can also understand any combination of delimiters. Following the example above, but getting creative with our delimiters:

```python
template_text = "My name is :/name-!). I am :/age-!) years old and I am from :/location-!)."
prompt_template = PromptTemplate(text=template_text, delimiters=[":/", "-!)"])
print(prompt_template.variables)
# Output: ['name', 'age', 'location']
```

Once you have a `PromptTemplate` class instantiated, you can make use of its `format` method to construct the prompt text resulting from substituting values into the `variables`. To do so, a dictionary mapping the variable names to the values is passed:

```python
value_dict = {
    "name": "Peter",
    "age": 20,
    "location": "Queens"
}
print(prompt_template.format(value_dict))
# Output: My name is Peter. I am 20 years old and I am from Queens
```

Note that once you initialize the `PromptTemplate` class, you don't need to worry about delimiters anymore, it will be handled for you.

## phoenix.experimental.evals.llm\_eval\_binary

```python
def llm_eval_binary(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str],
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

### Parameters

* dataframe (pd.DataFrame): A pandas dataframe containing queries and retrieved documents.
* query\_column\_name (str, optional): The name of the column containing the queries.
* retrieved\_documents\_column\_name (str, optional): The name of the column containing the retrieved document data. Each entry in this column should be a list of dictionaries containing metadata about the retrieved documents.

### Returns

* evaluations (List\[List\[str])]: A list of relevant and not relevant classifications. The "shape" of the list should mirror the "shape" of the retrieved documents column, in the sense that it has the same length as the input dataframe and each sub-list has the same length as the corresponding list in the retrieved documents column. The values in the sub-lists are either booleans or None in the case where the LLM output could not be parsed.

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

Generates a text using a template using an LLM. This function is useful if you want to generate synthetic data, such as irrelevant responses

### Parameters

* **dataframe (pandas.DataFrame)**: A pandas dataframe in which each row represents a record to be used as in input to the template. All template variable names must appear as column names in the dataframe (extra columns unrelated to the template are permitted).
* **template (Union\[PromptTemplate, str])**: The prompt template as either an instance of PromptTemplate or a string. If the latter, the variable names should be surrounded by curly braces so that a call to `format` can be made to substitute variable values.
* **model (BaseEvalModel)**: An LLM model class.
* **system\_instruction (Optional\[str], optional):** An optional system message.

### Returns

* **generations (List\[Optional\[str]])**: A list of strings representing the output of the model for each record

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/experimental/evals/functions/generate.py)**]**
