"""
Phoenix Datasets & Experiments Quickstart

This script demonstrates how to:
1. Create a dataset from a CSV file
2. Define a task that runs inputs through an LLM
3. Create evaluators to assess the outputs
4. Run an experiment combining the dataset, task, and evaluators

Prerequisites:
- pip install arize-phoenix-client arize-phoenix-evals openai
- Set OPENAI_API_KEY environment variable
- Download sample.csv from: https://drive.google.com/file/d/1n2WoejEe807VYGVT-GsTAA3QUdyFtR6g/view
"""

import asyncio
import openai
from phoenix.client import AsyncClient
from phoenix.experiments.types import Example
from phoenix.experiments import run_experiment
from phoenix.evals import LLM, ClassificationEvaluator


# =============================================================================
# Step 1: Create a Dataset
# =============================================================================

async def create_dataset():
    px_client = AsyncClient()
    dataset = await px_client.datasets.create_dataset(
        csv_file_path="sample.csv",
        name="test-dataset",
        input_keys=["input"],
        output_keys=["output", "label"]
    )
    return dataset


# =============================================================================
# Step 2: Load an Existing Dataset (alternative to creating)
# =============================================================================

async def load_dataset():
    client = AsyncClient()
    dataset = await client.datasets.get_dataset(dataset="test-dataset")
    return dataset


# =============================================================================
# Step 3: Define the Task
# =============================================================================

openai_client = openai.OpenAI()
task_prompt_template = "Answer this question: {question}"


def task(example: Example) -> str:
    question = example.input.get("input", "")
    message_content = task_prompt_template.format(question=question)
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    return response.choices[0].message.content


# =============================================================================
# Step 4: Create Evaluators
# =============================================================================

llm = LLM(model="gpt-4o", provider="openai")

CORRECTNESS_TEMPLATE = """
You are evaluating the correctness of a response.

<rubric>
- Accuracy: Does the output contain factually correct information?
- Completeness: Does the output fully address what was asked?
- Relevance: Does the output stay on topic and answer the actual question?
</rubric>

<labels>
- correct: The output accurately and completely addresses the input
- incorrect: The output contains errors, is incomplete, or fails to address the input
</labels>

<instructions>
Review the input and output below, then determine if the output is correct or incorrect.
</instructions>

<input>{{input}}</input>
<output>{{output}}</output>
"""

correctness_evaluator = ClassificationEvaluator(
    name="correctness",
    prompt_template=CORRECTNESS_TEMPLATE,
    llm=llm,
    choices={"correct": 1.0, "incorrect": 0.0},
)

completeness_prompt = """
You are evaluating the completeness of a response.

<rubric>
- Coverage: Does the response address all parts of the query?
- Depth: Is sufficient detail provided for each part?
- Relevance: Is all content in the response relevant to the query?
</rubric>

<labels>
- complete: Fully answers all parts of the query with sufficient detail
- partially complete: Only answers some parts of the query or lacks detail
- incomplete: Does not meaningfully address the query
</labels>

<instructions>
Review the input and output below, then rate the completeness.
</instructions>

<input>{{input}}</input>
<output>{{output}}</output>
"""

completeness_evaluator = ClassificationEvaluator(
    name="completeness",
    prompt_template=completeness_prompt,
    llm=llm,
    choices={"complete": 1.0, "partially complete": 0.5, "incomplete": 0.0},
)


# =============================================================================
# Step 5: Run the Experiment
# =============================================================================

async def main():
    # Create or load your dataset
    # Option A: Create a new dataset from CSV
    dataset = await create_dataset()
    
    # Option B: Load an existing dataset
    # dataset = await load_dataset()

    # Run the experiment
    experiment = run_experiment(
        dataset=dataset,
        task=task,
        evaluators=[correctness_evaluator, completeness_evaluator],
    )
    
    print(f"Experiment completed: {experiment}")


if __name__ == "__main__":
    asyncio.run(main())
