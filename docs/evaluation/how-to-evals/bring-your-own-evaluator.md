---
description: >-
  This guide shows you how to build and improve an LLM as a Judge Eval from
  scratch.
---

# Build an Eval

### Before you begin:

You'll need two things to build your own LLM Eval:&#x20;

1. A **dataset** to evaluate
2. A **template prompt** to use as the evaluation prompt on each row of data.

The dataset can have any columns you like, and the template can be structured however you like. The only requirement is that the dataset has all the columns your template uses.

We have two examples of templates below: `CATEGORICAL_TEMPLATE` and `SCORE_TEMPLATE`. The first must be used alongside a dataset with columns `query` and `reference`. The second must be used with a dataset that includes a column called `context`.

Feel free to set up your template however you'd like to match your dataset.

### Preparing your data

You will need a dataset of results to evaluate. This dataset should be a pandas dataframe. If you are already collecting traces with Phoenix, you can [export these traces](../../tracing/how-to-tracing/importing-and-exporting-traces/extract-data-from-spans.md) and use them as the dataframe to evaluate:

```python
trace_df = px.Client(endpoint="http://127.0.0.1:6006").get_spans_dataframe()
```

If your eval should have categorical outputs, use `llm_classify`.

If your eval should have numeric outputs, use `llm_generate`.

### Categorical - llm\_classify

The `llm_classify` function is designed for classification support both Binary and Multi-Class. The llm\_classify function ensures that the output is clean and is either one of the "classes" or "UNPARSABLE"

A binary template looks like the following with only two values "irrelevant" and "relevant" that are expected from the LLM output:

```python
CATEGORICAL_TEMPLATE = ''' You are comparing a reference text to a question and trying to determine if the reference text
contains information relevant to answering the question. Here is the data:
    [BEGIN DATA]
    ************
    [Question]: {query}
    ************
    [Reference text]: {reference}
    [END DATA]

Compare the Question above to the Reference text. You must determine whether the Reference text
contains information that can answer the Question. Please focus on whether the very specific
question can be answered by the information in the Reference text.
Your response must be single word, either "relevant" or "irrelevant",
and should not contain any text or characters aside from that word.
"irrelevant" means that the reference text does not contain an answer to the Question.
"relevant" means the reference text contains an answer to the Question. '''
```

The categorical template defines the expected output of the LLM, and the rails define the classes expected from the LLM:

* irrelevant
* relevant

```python
from phoenix.evals import (
    llm_classify,
    OpenAIModel # see https://docs.arize.com/phoenix/evaluation/evaluation-models
    # for a full list of supported models
)

# The rails is used to hold the output to specific values based on the template
# It will remove text such as ",,," or "..."
# Will ensure the binary value expected from the template is returned
rails = ["irrelevant", "relevant"]
#MultiClass would be rails = ["irrelevant", "relevant", "semi-relevant"]
relevance_classifications = llm_classify(
    dataframe=<YOUR_DATAFRAME_GOES_HERE>,
    template=CATEGORICAL_TEMPLATE,
    model=OpenAIModel('gpt-4o', api_key=''),
    rails=rails
)
```

#### Snap to Rails Function

The classify uses a `snap_to_rails` function that searches the output string of the LLM for the classes in the classification list. It handles cases where no class is available, both classes are available or the string is a substring of the other class such as irrelevant and relevant.

```
#Rails examples
#Removes extra information and maps to class
llm_output_string = "The answer is relevant...!"
> "relevant"

#Removes "." and capitalization from LLM output and maps to class
llm_output_string = "Irrelevant."
>"irrelevant"

#No class in resposne
llm_output_string = "I am not sure!"
>"UNPARSABLE"

#Both classes in response
llm_output_string = "The answer is relevant i think, or maybe irrelevant...!"
>"UNPARSABLE"

```

A common use case is mapping the class to a 1 or 0 numeric value.

### Numeric - llm\_generate

The Phoenix library does support numeric score Evals if you would like to use them. A template for a score Eval looks like the following:

```
SCORE_TEMPLATE = """
You are a helpful AI bot that checks for grammatical, spelling and typing errors
in a document context. You are going to return a continous score for the
document based on the percent of grammatical and typing errors. The score should be
between 10 and 1. A score of 1 will be no grammatical errors in any word,
a score of 2 will be 20% of words have errors, a 5 score will be 50% errors,
a score of 7 is 70%, and a 10 score will be all words in the context have a
grammatical errors.

The following is the document context.

#CONTEXT
{context}
#ENDCONTEXT

#QUESTION
Please return a score between 10 and 1.
You will return no other text or language besides the score. Only return the score.
Please return in a format that is "the score is: 10" or "the score is: 1"
"""
```

We use the more generic `llm_generate` function that can be used for almost any complex eval that doesn't fit into the categorical type.

<pre class="language-python"><code class="lang-python">from phoenix.evals import (
    llm_generate,
    OpenAIModel # see https://docs.arize.com/phoenix/evaluation/evaluation-models
    # for a full list of supported models
)

<strong>test_results = llm_generate(
</strong>    dataframe=&#x3C;YOUR_DATAFRAME_GOES_HERE>,
    template=SCORE_TEMPLATE,
    model=OpenAIModel('gpt-4o', api_key=''),
    verbose=True,
    # Callback function that will be called for each row of the dataframe
    output_parser=numeric_score_eval,
    # These two flags will add the prompt / response to the returned dataframe
    include_prompt=True,
    include_response=True,
)

def numeric_score_eval(output, row_index):
    # This is the function that will be called for each row of the 
    # dataframe after the eval is run
    row = df.iloc[row_index]
    score = self.find_score(output)

    return {"score": score}

def find_score(self, output):
    # Regular expression pattern
    # It looks for 'score is', followed by any characters (.*?), and then a float or integer
    pattern = r"score is.*?([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?)"

    match = re.search(pattern, output, re.IGNORECASE)
    if match:
        # Extract and return the number
        return float(match.group(1))
    else:
        return None
</code></pre>

The above is an example of how to run a score based Evaluation.

### Logging Evaluations to Phoenix

{% hint style="warning" %}
In order for the results to show in Phoenix, make sure your `test_results` dataframe has a column `context.span_id` with the corresponding span id. This value comes from Phoenix when you export traces from the platform. If you've brought in your own dataframe to evaluate, this section does not apply.
{% endhint %}

<details>

<summary>Log Evals to Phoenix</summary>

Use the following method to log the results of either the `llm_classify` or `llm_generate` calls to Phoenix:

```python
from phoenix.trace import SpanEvaluations

px.Client().log_evaluations(
    SpanEvaluations(eval_name="Your Eval Display Name", dataframe=test_results)
)
```

This method will show aggregate results in Phoenix.

</details>

### Improving your Custom Eval

At this point, you've constructed a custom Eval, but you have no understanding of how accurate that Eval is. To test your eval, you can use the same techniques that you use to iterate and improve on your application.

1. Start with a labeled ground truth set of data. Each input would be a row of your dataframe of examples, and each labeled output would be the correct judge label
2. Test your eval on that labeled set of examples, and compare to the ground truth to calculate F1, precision, and recall scores. For an example of this, see [hallucinations.md](running-pre-tested-evals/hallucinations.md "mention")
3. Tweak your prompt and retest. See [prompt-optimization.md](../../prompt-engineering/use-cases-prompts/prompt-optimization.md "mention") for an example of how to do this in an automated way.
