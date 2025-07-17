# Quickstart: Evals

This quickstart guide will show you through the basics of evaluating data from your LLM application.

## Install Phoenix Evals


```bash
%%bash
pip install -q "arize-phoenix>=4.29.0"
pip install -q openai nest_asyncio
```

## Prepare your dataset
The first thing you'll need is a dataset to evaluate. This could be your own collect or generated set of examples, or data you've exported from Phoenix traces. If you've already collected some trace data, this makes a great starting point.

For the sake of this guide however, we'll download some pre-existing data to evaluate. Feel free to sub this with your own data, just be sure it includes the following columns:
- reference
- query
- response


```python
import pandas as pd

df = pd.DataFrame(
    [
        {
            "reference": "The Eiffel Tower is located in Paris, France. It was constructed in 1889 as the entrance arch to the 1889 World's Fair.",
            "query": "Where is the Eiffel Tower located?",
            "response": "The Eiffel Tower is located in Paris, France.",
        },
        {
            "reference": "The Great Wall of China is over 13,000 miles long. It was built over many centuries by various Chinese dynasties to protect against nomadic invasions.",
            "query": "How long is the Great Wall of China?",
            "response": "The Great Wall of China is approximately 13,171 miles (21,196 kilometers) long.",
        },
        {
            "reference": "The Amazon rainforest is the largest tropical rainforest in the world. It covers much of northwestern Brazil and extends into Colombia, Peru and other South American countries.",
            "query": "What is the largest tropical rainforest?",
            "response": "The Amazon rainforest is the largest tropical rainforest in the world. It is home to the largest number of plant and animal species in the world.",
        },
        {
            "reference": "Mount Everest is the highest mountain on Earth. It is located in the Mahalangur Himal sub-range of the Himalayas, straddling the border between Nepal and Tibet.",
            "query": "Which is the highest mountain on Earth?",
            "response": "Mount Everest, standing at 29,029 feet (8,848 meters), is the highest mountain on Earth.",
        },
        {
            "reference": "The Nile is the longest river in the world. It flows northward through northeastern Africa for approximately 6,650 km (4,132 miles) from its most distant source in Burundi to the Mediterranean Sea.",
            "query": "What is the longest river in the world?",
            "response": "The Nile River, at 6,650 kilometers (4,132 miles), is the longest river in the world.",
        },
        {
            "reference": "The Mona Lisa was painted by Leonardo da Vinci. It is considered an archetypal masterpiece of the Italian Renaissance and has been described as 'the best known, the most visited, the most written about, the most sung about, the most parodied work of art in the world'.",
            "query": "Who painted the Mona Lisa?",
            "response": "The Mona Lisa was painted by the Italian Renaissance artist Leonardo da Vinci.",
        },
        {
            "reference": "The human body has 206 bones. These bones provide structure, protect organs, anchor muscles, and store calcium.",
            "query": "How many bones are in the human body?",
            "response": "The adult human body typically has 256 bones.",
        },
        {
            "reference": "Jupiter is the largest planet in our solar system. It is a gas giant with a mass more than two and a half times that of all the other planets in the solar system combined.",
            "query": "Which planet is the largest in our solar system?",
            "response": "Jupiter is the largest planet in our solar system.",
        },
        {
            "reference": "William Shakespeare wrote 'Romeo and Juliet'. It is a tragedy about two young star-crossed lovers whose deaths ultimately reconcile their feuding families.",
            "query": "Who wrote 'Romeo and Juliet'?",
            "response": "The play 'Romeo and Juliet' was written by William Shakespeare.",
        },
        {
            "reference": "The first moon landing occurred in 1969. On July 20, 1969, American astronauts Neil Armstrong and Edwin 'Buzz' Aldrin became the first humans to land on the moon as part of the Apollo 11 mission.",
            "query": "When did the first moon landing occur?",
            "response": "The first moon landing took place on July 20, 1969.",
        },
    ]
)
df.head()
```

## Evaluate and Log Results
Set up evaluators (in this case for hallucinations and Q&A correctness), run the evaluations, and log the results to visualize them in Phoenix. We'll use OpenAI as our evaluation model for this example, but Phoenix also supports a number of other models. First, we need to add our OpenAI API key to our environment.


```python
import os
from getpass import getpass

if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")

os.environ["OPENAI_API_KEY"] = openai_api_key
```


```python
import nest_asyncio

from phoenix.evals import HallucinationEvaluator, OpenAIModel, QAEvaluator, run_evals

nest_asyncio.apply()  # This is needed for concurrency in notebook environments

# Set your OpenAI API key
eval_model = OpenAIModel(model="gpt-4o")

# Define your evaluators
hallucination_evaluator = HallucinationEvaluator(eval_model)
qa_evaluator = QAEvaluator(eval_model)

# We have to make some minor changes to our dataframe to use the column names expected by our evaluators
# for `hallucination_evaluator` the input df needs to have columns 'output', 'input', 'context'
# for `qa_evaluator` the input df needs to have columns 'output', 'input', 'reference'
df["context"] = df["reference"]
df.rename(columns={"query": "input", "response": "output"}, inplace=True)
assert all(column in df.columns for column in ["output", "input", "context", "reference"])

# Run the evaluators, each evaluator will return a dataframe with evaluation results
# We upload the evaluation results to Phoenix in the next step
hallucination_eval_df, qa_eval_df = run_evals(
    dataframe=df, evaluators=[hallucination_evaluator, qa_evaluator], provide_explanation=True
)
```

Explanation of the parameters used in run_evals above:
- `dataframe` - a pandas dataframe that includes the data you want to evaluate. This could be spans exported from Phoenix, or data you've brought in from elsewhere. This dataframe must include the columns expected by the evaluators you are using. To see the columns expected by each built-in evaluator, check the corresponding page in the Using Phoenix Evaluators section.
- `evaluators` - a list of built-in Phoenix evaluators to use.
- `provide_explanations` - a binary flag that instructs the evaluators to generate explanations for their choices.

## Analyze Your Evaluations
Combine your evaluation results and explanations with your original dataset:


```python
results_df = df.copy()
results_df["hallucination_eval"] = hallucination_eval_df["label"]
results_df["hallucination_explanation"] = hallucination_eval_df["explanation"]
results_df["qa_eval"] = qa_eval_df["label"]
results_df["qa_explanation"] = qa_eval_df["explanation"]
results_df.head()
```

## (Optional) Log Results to Phoenix


**Note:** You'll only be able to log evaluations to the Phoenix UI if you used a trace or span dataset exported from Phoenix as your dataset in this quickstart. If you've used your own outside dataset, you won't be able to log these results to Phoenix.

Provided you started from a trace dataset, you can log your evaluation results to Phoenix using [these instructions](https://arize.com/docs/phoenix/tracing/how-to-tracing/llm-evaluations)
