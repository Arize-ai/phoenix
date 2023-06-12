---
description: >-
  What responses are getting bad scores? Where should you fine tune for better
  responses? Where should you prompt engineer for better prompts?
---

# Insights to Fine Tune or Prompt Engineer LLMs

LLMs are susceptible to “[hallucinations](https://research.google/pubs/pub51844/)”. Hallucinations refer to when LLMs generate text that is factually incorrect or fictional. These are especially a risk when LLMs are deployed into production use cases. Using Phoenix, teams can score their LLM responses and identify clusters of hallucinations/bad responses.&#x20;

### How it works

#### Step 1: Import Prompt & Responses&#x20;

Users import their prompt and responses (+embeddings and metadata) to Phoenix. For more details on computing embeddings for prompts and responses, follow along with our colab.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llm_summarization_tutorial.ipynb" %}

#### Step 2: Log or Generate Evaluation Metrics&#x20;

The most common evaluation metrics used for LLMs: &#x20;

<table data-view="cards"><thead><tr><th></th><th></th><th></th></tr></thead><tbody><tr><td></td><td><strong>User Feedback</strong></td><td>End user feedback (ex: Thumbs up/Thumbs down) on the LLM response.</td></tr><tr><td></td><td><strong>LLM Assisted Evaluation</strong></td><td>Use a second LLM call to evaluate LLM Response. We recommend using the <a href="https://github.com/openai/evals">OpenAI Evals Library</a> to find various templates.</td></tr><tr><td></td><td><strong>Task-Based Metrics</strong></td><td>Different metrics for different tasks (Ex: Rouge for summarization, Bleu for translation)</td></tr></tbody></table>

Learn how to compute a task-based evaluation metric in our colab.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llm_summarization_tutorial.ipynb" %}

#### Step 3: Find clusters of bad responses with low evaluation scores&#x20;

Using these evaluation scores, Phoenix surfaces clusters of bad responses to focus on for improvement.&#x20;

#### Step 4: Kick off Workflows for Improvement&#x20;

Depending on what the accuracy of the task is, there's a lot of immediate improvement that can be from leveraging prompt-engineering. As teams hit a wall with prompt engineering, finetuning can be an option for improvement.&#x20;

<figure><img src="../.gitbook/assets/image (9).png" alt=""><figcaption><p>Image by Andrej Karpathy</p></figcaption></figure>
