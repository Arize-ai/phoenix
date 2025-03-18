# Quickstart: Prompts (UI)

{% embed url="https://youtu.be/wLK5RwHNLUM?feature=shared" %}

## Getting Started

Prompt playground can be accessed from the left navbar of Phoenix.

From here, you can directly prompt your model by modifying either the system or user prompt, and pressing the Run button on the top right.&#x20;

## Basic Example Use Case

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-playground-qs-1.png" %}

Let's start by comparing a few different prompt variations. Add two additional prompts using the +Prompt button, and update the system and user prompts like so:

**System prompt #1:**

```
You are a summarization tool. Summarize the provided paragraph.
```

**System prompt #2:**&#x20;

```
You are a summarization tool. Summarize the provided paragraph in 2 sentences or less.
```

**System prompt #3:**

```
You are a summarization tool. Summarize the provided paragraph. Make sure not to leave out any key points.
```

**User prompt (use this for all three):**

```
In software engineering, more specifically in distributed computing, observability is the ability to collect data about programs' execution, modules' internal states, and the communication among components.[1][2] To improve observability, software engineers use a wide range of logging and tracing techniques to gather telemetry information, and tools to analyze and use it. Observability is foundational to site reliability engineering, as it is the first step in triaging a service outage. One of the goals of observability is to minimize the amount of prior knowledge needed to debug an issue.
```

Your playground should look something like this:

Let's run it and compare results:

<figure><img src="../../.gitbook/assets/Screenshot 2024-12-09 at 10.51.07 AM.png" alt=""><figcaption></figcaption></figure>

## Creating a Prompt

It looks like the second option is doing the most concise summary. Go ahead and [save that prompt to your Prompt Hub](../how-to-prompts/create-a-prompt.md).&#x20;

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-2.png" %}

Your prompt will be saved in the Prompts tab:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-3.png" %}

Now you're ready to see how that prompt performs over a larger dataset of examples.

## Running over a dataset

Prompt playground can be used to run a series of dataset rows through your prompts. To start off, we'll need a dataset. Phoenix has many options to [upload a dataset](../../datasets-and-experiments/how-to-datasets/), to keep things simple here, we'll directly upload a CSV. Download the articles summaries file linked below:

{% file src="../../.gitbook/assets/news-article-summaries-2024-11-04 11_08_10.csv" %}

Next, create a new dataset from the Datasets tab in Phoenix, and specify the input and output columns like so:

<figure><img src="../../.gitbook/assets/Screenshot 2024-12-09 at 11.29.18 AM.png" alt=""><figcaption><p>Uploading a CSV dataset</p></figcaption></figure>

Now we can return to Prompt Playground, and this time choose our new dataset from the "Test over dataset" dropdown.

You can also load in your saved Prompt:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-4.png" %}

We'll also need to update our prompt to look for the `{{input_article}}` column in our dataset. After adding this in, be sure to save your prompt once more!

Now if we run our prompt(s), each row of the dataset will be run through each variation of our prompt.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-5.png" %}

And if you return to view your dataset, you'll see the details of that run saved as an experiment.&#x20;

<figure><img src="../../.gitbook/assets/Screenshot 2024-12-09 at 11.37.34 AM.png" alt=""><figcaption></figcaption></figure>

From here, you could [evaluate that experiment](../../datasets-and-experiments/how-to-experiments/#how-to-use-evaluators) to test its performance, or add complexity to your prompts by including different tools, output schemas, and models to test against.

## Updating a Prompt

You can now easily modify you prompt or compare different versions side-by-side. Let's say you've found a stronger version of the prompt. Save your updated prompt once again, and you'll see it added as a new version under your existing prompt:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-6.png" %}

You can also tag which version you've deemed ready for production, and view code to access your prompt in code further down the page.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-7.png" %}

## Next Steps

Now you're ready to create, test, save, and iterate on your Prompts in Phoenix! Check out our other quickstarts to see how to use Prompts in code.
