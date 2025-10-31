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

For more information about prompt templates, see the API Reference for [Prompt Template](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/api/evals.html#prompt-template). For more information about how to configure the LLM judge, see [Configuring the LLM](configuring-the-llm/).

#### Label Choices

While the prompt template contains instructions for the LLM, the label choices tell it how to format its response.

The `choices` of a `ClassificationEvaluator` can be structured in a couple of ways:

1. A list of string labels only: `choices=["relevant", "irrelevant"]` **\***
2. String labels mapped to numeric scores: `choices = {"irrelevant": 0, "relevant": 1}`

**\*Note:** if no score mapping is provided, the returned `Score` objects will have a `label` but not a numeric `score` component.

The `ClassificationEvaluator` also supports multi-class labels and scores, for example: `choices = {"good": 1.0, "bad": 0.0, "neutral": 0.5}`

There is no limit to the number of label choices you can provide, and you can specify any numeric scores (not limited to values between 0 and 1). For example, you can set `choices = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}` for a numeric rating task.&#x20;

#### Putting it together

For the relevance evaluation, we define the evaluator as follows:

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

The `ClassificationEvaluator` is a flexible LLM-as-a-judge construct that can also be used to produce numeric ratings (also known as Likert scores).&#x20;

**Note**: We generally recommend using categorical labels over numeric ratings for most evaluation tasks. LLMs have inherent limitations in their numeric reasoning abilities, and numeric scores do not correlate as well with human judgements. See this [technical report](https://arize.com/blog/testing-binary-vs-score-llm-evals-on-the-latest-models/) for more information about our findings on this subject.&#x20;

Here is a prompt that asks the LLM to rate the spelling/grammatical correctness of some input context on a scale from 1-10:

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
#END CONTEXT

#QUESTION
Please rate the percentage of errors in the context on a scale from 1 to 10. 
"""
```

This numeric rating task can be framed as a classification task where the set of labels is the set of numbers on the rating scale (here, 1-10). Then we can set up a custom `ClassificationEvaluator` for our evaluation task, similar to how we did above. Make sure to set the optimization `direction = "minimize"` here since a lower score is better on this task (fewer spelling errors).&#x20;

```python
from phoenix.evals ClassificationEvaluator
from phoenix.evals.llm import LLM

choices = {i: str(i) for i in range(1, 11)} # choices are {"1": 1, "2": 2, etc...}

spelling_classifier = ClassificationEvaluator(
    name="spelling",
    prompt_template=SCORE_TEMPLATE,
    model=LLM(provider="openai", model="gpt-4o"),
    choices=choices
    direction="minimize" # lower scores = better, so direction = minimize 
)
spelling_classifier.evaluate({"context": "This is a test. There are is some typo in this sentence."})
>>> [Score(name='spelling', score=2, label="2", explanation="There is one grammatical error ('There are is') and one typo ('typo' instead of 'typos'), which roughly represents 20% of the 10 words in the document.", metadata={'model': 'gpt-4o-mini'}, kind='llm', direction='minimize')]
```

### Alternative: Fully Custom LLM Evaluator

Alternatively, for LLM-as-a-judge tasks that don't fit the classification paradigm, it is also possible to create a custom evaluator that implements the base [`LLMEvaluator`](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/api/evals.html#llmevaluator) class. We can implement our own `LLMEvaluator` for almost any complex eval that doesn't fit into the classification type.

In this example, we implement the same spelling evaluator from above as a fully custom `LLMEvaluator.` &#x20;

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
                kind=self.kind,
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
>>> [Score(name='spelling_evaluator', score=2, label=None, explanation="There is one grammatical error ('There are is') and one typo ('typo' instead of 'typos'), which roughly represents 20% of the 10 words in the document.", metadata={'model': 'gpt-4o-mini'}, kind='llm', direction='minimize')]
```

#### Improving your Custom Evals

As with all evals, it is important to test that your custom evaluators are working as expected before trusting them at scale. When testing an eval, you use many of the same techniques used for testing your application:

1. Start with a labeled ground truth set of data. Each input would be an example, and each labeled output would be the correct judge label.
2. Test your eval on that labeled set of examples, and compare to the ground truth to calculate F1, precision, and recall scores.
3. Tweak your prompt and retest.
