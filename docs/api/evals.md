---
description: >-
  Evals are LLM-powered functions that you can use to evaluate the output of
  your LLM or generative application
---

# Evals

## phoenix.evals.run\_evals

```python
def run_evals(
    dataframe: pd.DataFrame,
    evaluators: List[LLMEvaluator],
    provide_explanation: bool = False,
    use_function_calling_if_available: bool = True,
    verbose: bool = False,
    concurrency: int = 20,
) -> List[pd.DataFrame]
```

Evaluates a pandas dataframe using a set of user-specified evaluators that assess each row for relevance of retrieved documents, hallucinations, toxicity, etc. Outputs a list of dataframes, one for each evaluator, that contain the labels, scores, and optional explanations from the corresponding evaluator applied to the input dataframe.

### Parameters

* **dataframe** (pandas.DataFrame): A pandas dataframe in which each row represents an individual record to be evaluated. Each evaluator uses an LLM and an evaluation prompt template to assess the rows of the dataframe, and those template variables must appear as column names in the dataframe.
* **evaluators** (List\[LLMEvaluator]): A list of evaluators to apply to the input dataframe. Each evaluator class accepts a [model](evaluation-models.md) as input, which is used in conjunction with an evaluation prompt template to evaluate the rows of the input dataframe and to output labels, scores, and optional explanations. Currently supported evaluators include:
  * **HallucinationEvaluator:** Evaluates whether a response (stored under an "output" column) is a hallucination given a query (stored under an "input" column) and one or more retrieved documents (stored under a "reference" column).
  * **RelevanceEvaluator:** Evaluates whether a retrieved document (stored under a "reference" column) is relevant or irrelevant to the corresponding query (stored under an "input" column).
  * **ToxicityEvaluator:** Evaluates whether a string (stored under an "input" column) contains racist, sexist, chauvinistic, biased, or otherwise toxic content.
  * **QAEvaluator:** Evaluates whether a response (stored under an "output" column) is correct or incorrect given a query (stored under an "input" column) and one or more retrieved documents (stored under a "reference" column).
  * **SummarizationEvaluator:** Evaluates whether a summary (stored under an "output" column) provides an accurate synopsis of an input document (stored under an "input" column).
* **provide\_explanation** (bool, optional): If true, each output dataframe will contain an explanation column containing the LLM's reasoning for each evaluation.
* **use\_function\_calling\_if\_available** (bool, optional): If true, function calling is used (if available) as a means to constrain the LLM outputs. With function calling, the LLM is instructed to provide its response as a structured JSON object, which is easier to parse.
* **verbose** (bool, optional): If true, prints detailed information such as model invocation parameters, retries on failed requests, etc.
* **concurrency** (int, optional): The number of concurrent workers if async submission is possible. If not provided, a recommended default concurrency is set on a per-model basis.

### Returns

* **List\[pandas.DataFrame]**: A list of dataframes, one for each evaluator, all of which have the same number of rows as the input dataframe.

### Usage

To use `run_evals`, you must first wrangle your LLM application data into a pandas dataframe either manually or by querying and exporting the spans collected by your Phoenix session. Once your dataframe is wrangled into the appropriate format, you can instantiate your evaluators by passing the model to be used during evaluation.

{% hint style="info" %}
This example uses `OpenAIModel`, but you can use any of our [supported evaluation models](evaluation-models.md).
{% endhint %}

```python
from phoenix.evals import (
    OpenAIModel,
    HallucinationEvaluator,
    QAEvaluator,
    run_evals,
)

api_key = None  # set your api key here or with the OPENAI_API_KEY environment variable
eval_model = OpenAIModel(model_name="gpt-4-turbo-preview", api_key=api_key)

hallucination_evaluator = HallucinationEvaluator(eval_model)
qa_correctness_evaluator = QAEvaluator(eval_model)
```

Run your evaluations by passing your `dataframe` and your list of desired evaluators.

```
hallucination_eval_df, qa_correctness_eval_df = run_evals(
    dataframe=dataframe,
    evaluators=[hallucination_evaluator, qa_correctness_evaluator],
    provide_explanation=True,
)
```

Assuming your `dataframe` contains the "input", "reference", and "output" columns required by `HallucinationEvaluator` and `QAEvaluator`, your output dataframes should contain the results of the corresponding evaluator applied to the input dataframe, including columns for labels (e.g., "factual" or "hallucinated"), scores (e.g., 0 for factual labels, 1 for hallucinated labels), and explanations. If your dataframe was exported from your Phoenix session, you can then ingest the evaluations using `phoenix.log_evaluations` so that the evals will be visible as annotations inside Phoenix.

For an end-to-end example, see the [evals quickstart](../quickstart/evals.md).

## phoenix.evals.PromptTemplate

```python
class PromptTemplate(
    text: str
    delimiters: List[str]
)
```

Class used to store and format prompt templates.

### Parameters

* **text** (str): The raw prompt text used as a template.
* **delimiters** (List\[str]): List of characters used to locate the variables within the prompt template `text`. Defaults to `["{", "}"]`.

### Attributes

* **text** (str): The raw prompt text used as a template.
* **variables** (List\[str]): The names of the variables that, once their values are substituted into the template, create the prompt text. These variable names are automatically detected from the template `text` using the `delimiters` passed when initializing the class (see Usage section below).

### Usage

Define a `PromptTemplate` by passing a `text` string and the `delimiters` to use to locate the `variables`. The default delimiters are `{` and `}`.

```python
from phoenix.evals import PromptTemplate

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

## phoenix.evals.llm\_classify

```python
def llm_classify(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[ClassificationTemplate, PromptTemplate, str],
    rails: List[str],
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    use_function_calling_if_available: bool = True,
    provide_explanation: bool = False,
) -> pd.DataFrame
```

Classifies each input row of the `dataframe` using an LLM. Returns a `pandas.DataFrame` where the first column is named `label` and contains the classification labels. An optional column named `explanation` is added when `provide_explanation=True`.

### Parameters

* **dataframe (pandas.DataFrame)**: A pandas dataframe in which each row represents a record to be classified. All template variable names must appear as column names in the dataframe (extra columns unrelated to the template are permitted).
* **template (ClassificationTemplate, or str):** The prompt template as either an instance of PromptTemplate or a string. If the latter, the variable names should be surrounded by curly braces so that a call to `.format` can be made to substitute variable values.
* **model (BaseEvalModel):** An LLM model class instance
* **rails (List\[str]):** A list of strings representing the possible output classes of the model's predictions.
* **system\_instruction (Optional\[str]):** An optional system message for modals that support it
* **verbose (bool, optional):** If `True`, prints detailed info to stdout such as model invocation parameters and details about retries and snapping to rails. Default `False`.
* **use\_function\_calling\_if\_available (bool, default=True):** If `True`, use function calling (if available) as a means to constrain the LLM outputs. With function calling, the LLM is instructed to provide its response as a structured JSON object, which is easier to parse.
* **provide\_explanation (bool, default=False):** If `True`, provides an explanation for each classification label. A column named `explanation` is added to the output dataframe. Note that this will default to using function calling if available. If the model supplied does not support function calling, `llm_classify` will need a prompt template that prompts for an explanation. For phoenix's pre-tested eval templates, the template is swapped out for a [chain-of-thought](https://www.promptingguide.ai/techniques/cot) based template that prompts for an explanation.

### Returns

* **pandas.DataFrame:** A dataframe where the `label` column (at column position 0) contains the classification labels. If `provide_explanation=True`, then an additional column named `explanation` is added to contain the explanation for each label. The dataframe has the same length and index as the input dataframe. The classification label values are from the entries in the rails argument or "NOT\_PARSABLE" if the model's output could not be parsed.

## phoenix.evals.llm\_generate

```python
def llm_generate(
    dataframe: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: Optional[BaseEvalModel] = None,
    system_instruction: Optional[str] = None,
    output_parser: Optional[Callable[[str, int], Dict[str, Any]]] = None,
) -> List[str]
```

Generates a text using a template using an LLM. This function is useful if you want to generate synthetic data, such as irrelevant responses

### Parameters

* **dataframe (pandas.DataFrame)**: A pandas dataframe in which each row represents a record to be used as in input to the template. All template variable names must appear as column names in the dataframe (extra columns unrelated to the template are permitted).
* **template (Union\[PromptTemplate, str])**: The prompt template as either an instance of PromptTemplate or a string. If the latter, the variable names should be surrounded by curly braces so that a call to `format` can be made to substitute variable values.
* **model (BaseEvalModel)**: An LLM model class.
* **system\_instruction (Optional\[str], optional):** An optional system message.
* **output\_parser (Callable\[\[str, int], Dict\[str, Any]], optional)**: An optional function that takes each generated response and response index and parses it to a dictionary. The keys of the dictionary should correspond to the column names of the output dataframe. If None, the output dataframe will have a single column named "output". Default None.

### Returns

* **generations\_dataframe (pandas.DataFrame)**: A dataframe where each row represents the generated output

### Usage

Below we show how you can use `llm_generate` to use an llm to generate synthetic data. In this example, we use the `llm_generate` function to generate the capitals of countries but `llm_generate` can be used to generate any type of data such as synthetic questions, irrelevant responses, and so on.

```python
import pandas as pd
from phoenix.evals import OpenAIModel, llm_generate

countries_df = pd.DataFrame(
    {
        "country": [
            "France",
            "Germany",
            "Italy",
        ]
    }
)

capitals_df = llm_generate(
    dataframe=countries_df,
    template="The capital of {country} is ",
    model=OpenAIModel(model_name="gpt-4"),
    verbose=True,
)

```

`llm_generate` also supports an output parser so you can use this to generate data in a structured format. For example, if you want to generate data in JSON format, you ca prompt for a JSON object and then parse the output using the `json` library.

```python
import json
from typing import Dict

import pandas as pd
from phoenix.evals import OpenAIModel, PromptTemplate, llm_generate


def output_parser(response: str) -> Dict[str, str]:
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            return {"__error__": str(e)}

countries_df = pd.DataFrame(
    {
        "country": [
            "France",
            "Germany",
            "Italy",
        ]
    }
)

template = PromptTemplate("""
Given the country {country}, output the capital city and a description of that city.
The output must be in JSON format with the following keys: "capital" and "description".

response:
""")

capitals_df = llm_generate(
    dataframe=countries_df,
    template=template,
    model=OpenAIModel(
        model_name="gpt-4-turbo-preview",
        model_kwargs={
            "response_format": {"type": "json_object"}
        }
        ),
    output_parser=output_parser
)
```
