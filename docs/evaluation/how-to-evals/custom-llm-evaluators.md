# Custom LLM Evaluators

## Building Custom Evaluators

While pre-built evals offer convenience, the best evals are ones you custom build for your specific use case. In this guide, we show how to build two types of custom "LLM-as-a-judge" style evaluators:

1. A custom [`ClassificationEvaluator`](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/api/evals.html#classificationevaluator) that returns categorical labels.
2. A custom [`LLMEvaluator`](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/api/evals.html#llmevaluator) that scores data on a numeric scale.

### Classification Evals

The `ClassificationEvaluator` is a special LLM-based evaluator designed for classification (both binary and multi-class). It leverages LLM structured-output or tool-calling functionality to ensure consistent and parseable output; this evaluator will only respond with one of the provided label choices and, optionally, an explanation for the judgement.

A classification prompt template looks like the following with instructions for the evaluation as well as placeholders for the evaluation input data:

```python
CATEGORICAL_TEMPLATE = '''You are comparing a reference text to a question and trying to determine if the reference text
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
"irrelevant" means that the reference text does not contain an answer to the Question.
"relevant" means the reference text contains an answer to the Question. '''
```

For more information about prompt templates, see the API Reference for [Prompt Template](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/api/evals.html#prompt-template). For more information about how to configure the LLM judge, see [Configuring the LLM](configuring-the-llm.md).

#### Label Choices

While the prompt template contains instructions for the LLM, the label choices tell it how to format its response.

The `choices` of a `ClassificationEvaluator` can be structured in a couple of ways:

1. A list of string labels only: `choices=["relevant", "irrelevant"]` **\***
2. String labels mapped to numeric scores: `choices = {"irrelevant": 0, "relevant": 1}`

**\*Note:** if no score mapping is provided, the returned `Score` objects will have a `label` but not a numeric `score` component.

The `ClassificationEvaluator` also supports multi-class labels and scores, for example: `choices = {"good": 1.0, "bad": 0.0, "neutral": 0.5}`

#### Putting it together

```python
from phoenix.evals ClassificationEvaluator
from phoenix.evals.llm import LLM

choices = {"irrelevant": 0, "relevant": 1}

relevance_classifier = ClassificationEvaluator(
    name="relevance",
    prompt_template=CATEGORICAL_TEMPLATE,
    model=LLM(provider="openai", model="gpt-4o"),
    choices=choices
)
results = relevance_classifier.evaluate({"query": "input query goes here", "reference": "document text goes here"})
```

### Custom Numeric Rating LLM Evaluator

We do not have a pre-built `LLMEvaluator` designed for LLM judges that produce numeric ratings (also known as Likert scores), since classification-style evals are more widely used and generally more reliable. That said, it is still possible to create a custom evaluator that implements the base [`LLMEvaluator`](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/api/evals.html#llmevaluator) class.

Here is a prompt that asks the LLM to rate the input context on a scale from 1-10:

```python
SCORE_TEMPLATE = """
You are an expert copy editor that checks for grammatical, spelling and typing errors
in a document context. You are going to return a rating for the
document based on the percent of grammatical and typing errors. The score should be
between 1 and 10, where 1 means no words have errors and 10 means all words have errors. 

Example Scoring Rubric
1: no grammatical errors in any word
2: 20% of words have errors
5: 50% of words have errors 
7: 70% of words have errors 
10: all of the words in the context have errors 

#CONTEXT
{context}
#ENDCONTEXT

#QUESTION
Please rate the percentage of errors in the context on a scale from 1 to 10. 
"""
```

We can implement our own `LLMEvaluator` for almost any complex eval that doesn't fit into the classification type.

#### Steps to create a custom evaluator:

1. Create a new class that inherits the base (`LLMEvaluator`)
2. Define your prompt template and a JSON schema for the structured output.
3. Initialize the base class with a name, LLM, prompt template, and direction.
4. Implement the `_evaluate` method that takes an `eval_input` and returns a list of `Score` objects. The base class handles the `input_mapping` logic so you can assume the input here has the required input fields.

```python
from phoenix.evals.evaluators import LLMEvaluator, EvalInput, Score

class SpellingEvaluator(LLMEvaluator):

    PROMPT = SCORE_TEMPLATE # use the prompt defined above

    TOOL_SCHEMA = {
        "type": "object",
        "properties": {
            "rating": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10,
            "description": "An integer rating between 1 and 10"
            },
            "explanation": {
            "type": "string",
            "description": "A brief explanation for the rating"
            }
        },
        "required": ["rating", "explanation"]
    }

    def __init__(
        self,
        llm: LLM, # define LLM at instantiation 
    ):
        super().__init__(
            name="spelling_evaluator",
            llm=llm,
            prompt_template=self.PROMPT,
            direction="minimize", # lower scores = better, so direction = minimize 
        )

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        prompt_filled = self.prompt_template.render(variables=eval_input)
        
        response = self.llm.generate_object(
            prompt=prompt_filled,
            schema=self.TOOL_SCHEMA,
        ) # will use either structured output or tool calling depending on model capabilities 
        rating = response["rating"]
        explanation = response.get("explanation", None)
        return [
            Score(
                score=rating,
                name=self.name,
                explanation=explanation,
                metadata={"model": self.llm.model},  # could add more metadata here if you want
                source=self.source,
                direction=self.direction,
            )
        ]
```

You can now use your custom evaluator like any other LLM-based evaluator:

```python
spelling_evaluator = SpellingEvaluator(llm=LLM(provider="openai", model="gpt-4o-mini"))
spelling_evaluator.evaluate(
    eval_input={"context": "This is a test. There are is some typo in this sentence."}
)
>>> [Score(name='spelling_evaluator', score=2, label=None, explanation="There is one grammatical error ('There are is') and one typo ('typo' instead of 'typos'), which roughly represents 20% of the 10 words in the document.", metadata={'model': 'gpt-4o-mini'}, source='llm', direction='minimize')]
```

#### Improving your Custom Eval

As with all evals, it is important to test that your custom evaluators are working as expected before trusting them at scale. When testing an eval, you use many of the same techniques used for testing your application:

1. Start with a labeled ground truth set of data. Each input would be an example, and each labeled output would be the correct judge label.
2. Test your eval on that labeled set of examples, and compare to the ground truth to calculate F1, precision, and recall scores.
3. Tweak your prompt and retest.
