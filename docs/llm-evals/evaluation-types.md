# Evaluation Types

There are a multiple types of evaluations supported by the Phoenix Library. A type of an LLM Evaluation can be understood as the output type of the LLM Eval.

&#x20;

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/eval_types.png" alt=""><figcaption></figcaption></figure>

Phoenix has options for all of the above though we highly recommend categorical options:

**Categorical (binary)**: Ouptut is either a single string or a 1/0

**Categorical (Multi-class)**: Output is a class of string values also can be distinct numbers

**Score:** A numeric value in a range

Why we recommend categorical LLM Evals over scores is highlighted in this[ research. ](https://twitter.com/aparnadhinak/status/1748368364395721128)

### Categorical - llm\_classify

The "llm\_classify" function is designed for classification support both Binary and Multi-Class. The llm\_classify function ensures that the output is clean and is either one of the "classes" or "UNPARSABLE"&#x20;

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

The categorical template defines the expected output of the LLM and the rails define the classes expected from the LLM:

* irrelevant
* relevant

```python

# The rails is used to hold the output to specific values based on the template
# It will remove text such as ",,," or "..."
# Will ensure the binary value expected from the template is returned
rails = ["irrelevant", "relevant"]
#MultiClass would be rails = ["irrelevant", "relevant", "semi-relevant"] 
relevance_classifications = llm_classify(
    dataframe=df,
    template=CATEGORICAL_TEMPLATE,
    model=model,
    rails=rails
)
```

The classify uses a snap\_to\_rails function that searches the output string of the LLM for the classes in the classification list. It handles cases where no class is available, both classes are available or the string is a substring of the other class such as irrelevant and relevant.&#x20;

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

A common use case is mapping the class to a 1 or 0 numeric value.&#x20;

### Score Numeric Eval - llm\_generate

The Phoenix library does support numeric score Evals if you would like to use them. A template for a score Eval looks like the following.

```
 SCORE_TEMPLATE = """
You are a helpful AI bot that checks for grammatical, spelling and typing errors 
in a document context. You are going to return a continous score for the 
document based on the percent of grammatical and typing errors. The score should be 
between 10 and 1. A score of 1 will be no grmatical errors in any word, 
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

We use the more generic llm\_generate function that can be used for almost any complex eval that doesn't fit into the categorical type.

```python
test_results = llm_generate(
    dataframe=df,
    template=SCORE_TEMPLATE,
    model=model,
    verbose=True,
    # Callback function that will be called for each row of the dataframe
    output_parser=numeric_score_eval,
    # These two flags will add the prompt / response to the returned dataframe
    include_prompt=True,
    include_response=True,
)

def numeric_score_eval(output, row_index):
    # This is the function that will be called for each row of the dataframe
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
```

The above is an example of how to run a score based Evaluation.&#x20;
