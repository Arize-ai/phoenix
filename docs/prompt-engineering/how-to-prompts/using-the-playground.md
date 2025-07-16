---
description: General guidelines on how to use Phoenix's prompt playground
---

# Using the Playground

## Setup

To first get started, you will first [configure-ai-providers.md](configure-ai-providers.md "mention"). In the playground view, create a valid prompt for the LLM and click Run on the top right (or the `mod + enter`)

If successful you should see the LLM output stream out in the **Output** section of the UI.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/playground_overview.png" alt=""><figcaption><p>Pick an LLM and setup the API Key for that provider to get started</p></figcaption></figure>

## Prompt Editor

The prompt editor (typically on the left side of the screen)  is where you define the [Prompt Templates](https://app.gitbook.com/s/fqGNxHHFrgwnCxgUBNsJ/prompt-engineering/prompts-concepts#prompt-templates "mention"). You select the template language (**mustache** or **f-string**)  on the toolbar. Whenever you type a variable placeholder in the prompt (say {**{question\}}** for mustache), the variable to fill will show up in the **inputs** section. Input variables must either be filled in by hand or can be filled in via a dataset (where each row has key / value pairs for the input).

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/variable_substitution.gif" alt=""><figcaption><p>Use the template language to create prompt template variables that can be applied during runtime</p></figcaption></figure>



## Model Configuration

Every prompt instance can be configured to use a specific LLM and set of invocation parameters. Click on the model configuration button at the top of the prompt editor and configure your LLM of choice. Click on the "save as default" option to make your configuration sticky across playground sessions.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/model_config.gif" alt=""><figcaption><p>Switch models and modify invocation params</p></figcaption></figure>

## Comparing Prompts

The Prompt Playground offers the capability to compare multiple prompt variants directly within the playground. Simply click the **+ Compare** button at the top of the first prompt to create duplicate instances. Each prompt variant manages its own independent template, model, and parameters. This allows you to quickly compare prompts (labeled A, B, C, and D in the UI) and run experiments to determine which prompt and model configuration is optimal for the given task.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_variants.png" alt=""><figcaption><p>Compare multiple different prompt variants at once</p></figcaption></figure>

## Using Datasets with Prompts

Phoenix lets you run a prompt (or multiple prompts) on a dataset. Simply [load a dataset](../../datasets-and-experiments/how-to-datasets/) containing the input variables you want to use in your prompt template. When you click **Run**, Phoenix will apply each configured prompt to every example in the dataset, invoking the LLM for all possible prompt-example combinations. The result of your playground runs will be tracked as an experiment under the loaded dataset (see [#playground-traces](using-the-playground.md#playground-traces "mention"))

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/playground_datasets.png" alt=""><figcaption><p>Each example's input is used to fill the prompt template</p></figcaption></figure>

## Playground Traces

All invocations of an LLM via the playground is recorded for analysis, annotations, evaluations, and dataset curation.

If you simply run an LLM in the playground using the free form inputs (e.g. not using a dataset), Your spans will be recorded in a project aptly titled "playground".\


<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/playground_project.png" alt=""><figcaption><p>All free form playground runs are recorded under the playground project </p></figcaption></figure>

If however you run a prompt over dataset examples, the outputs and spans from your playground runs will be captured as an experiment. Each experiment will be named according to the prompt you ran the experiment over.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/playground_experiment.png" alt=""><figcaption><p>If you run over a dataset, the output and traces is tracked as a dataset experiment</p></figcaption></figure>





