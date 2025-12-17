# Get Started: Prompt Playground

Now that you have Phoenix up and running, you're now able to use **Prompt Playground** & the **Prompt** **Hub**.

* Prompt Playground lets you experiment with prompts in real time, explore variations across models, and fine-tune responses with a versatile, interactive workflow.
* Prompt Hub lets you organize, version, and share prompts across projects.

First, make sure Phoenix is running. For more step by step instructions, check out this [Get Started guide](./).

{% tabs %}
{% tab title="Phoenix Cloud" %}
Before sending traces, make sure Phoenix is running. For more step by step instructions, check out this [Get Started guide](./).

Log in, create a space, navigate to the settings page in your space, and create your API keys.

Set your environment variables.

```bash
export PHOENIX_API_KEY = "ADD YOUR PHOENIX API KEY"
export PHOENIX_COLLECTOR_ENDPOINT = "ADD YOUR PHOENIX COLLECTOR ENDPOINT"
```

You can find your collector endpoint here:

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix-docs-images/phoenix_hostname_settings.png" alt="After launching your space, go to settings."><figcaption><p>Launch your space, navigate to settings &#x26; copy your hostname for your collector endpoint</p></figcaption></figure>

Your Collector Endpoint is: [https://app.phoenix.arize.com/s/](https://app.phoenix.arize.com/s/) + your space name.
{% endtab %}

{% tab title="Local (Self-hosted)" %}
If you installed Phoenix locally, you have a variety of options for deployment methods including: Terminal, Docker, Kubernetes, Railway, & AWS CloudFormation. ([Learn more: Self-Hosting](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/))

To host on your local machine, run `phoenix serve` in your terminal.

Navigate to your localhost in your browser. (example localhost:6006)
{% endtab %}
{% endtabs %}

There's multiple ways to get around Prompts in Phoenix, choose the best path for you!

<table data-view="cards"><thead><tr><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Prompts (UI)</td><td><a href="../../.gitbook/assets/prompt_playground.png">prompt_playground.png</a></td><td><a href="get-started-prompt-playground.md#prompts-ui">#prompts-ui</a></td></tr><tr><td>Prompts (Python SDK)</td><td><a href="../../.gitbook/assets/python.png">python.png</a></td><td><a href="get-started-prompt-playground.md#prompts-python-sdk">#prompts-python-sdk</a></td></tr><tr><td>Prompts (TS SDK)</td><td><a href="../../.gitbook/assets/javascript.png">javascript.png</a></td><td><a href="get-started-prompt-playground.md#prompts-ts-sdk">#prompts-ts-sdk</a></td></tr></tbody></table>

## Prompts (UI)

There's multiple ways you can get started with using Prompts. Below is just one flow you can follow along.

### Getting Started

Prompt playground can be accessed from the left navbar of Phoenix.

From here, you can directly prompt your model by modifying either the system or user prompt, and pressing the Run button on the top right.

### Basic Example Use Case

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-playground-qs-1.png" %}

Let's start by comparing a few different prompt variations. Add two additional prompts using the +Compare button, and update the system and user prompts like so:

**System prompt #1:**

```
You are a summarization tool. Summarize the provided paragraph.
```

**System prompt #2:**

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

Let's run it and compare results:

<figure><img src="../../.gitbook/assets/Screenshot 2024-12-09 at 10.51.07 AM.png" alt=""><figcaption></figcaption></figure>

### Creating a Prompt

It looks like System Prompt #2 is producing the most concise summary. Go ahead and [save that prompt to your Prompt Hub](../prompt-engineering/how-to-prompts/create-a-prompt.md).

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-2.png" %}

Your prompt will be saved in the Prompts tab:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-3.png" %}

Now you're ready to see how that prompt performs over a larger dataset of examples.

### Running over a dataset

Often times, users want to run multiple inputs through an LLM with their prompts. This allows you to scale your prompt experiments over many inputs at once, building stronger insight into how your prompt is performing.

Phoenix has many options to [upload a dataset](../datasets-and-experiments/how-to-datasets/). To keep things simple here, we'll directly upload a CSV. Download the articles summaries file linked below.

{% file src="../../.gitbook/assets/news-article-summaries-2024-11-04 11_08_10.csv" %}

Next, create a new dataset from the Datasets tab in Phoenix, and specify the input and output columns like so:

<figure><img src="../../.gitbook/assets/Screenshot 2024-12-09 at 11.29.18 AM.png" alt=""><figcaption><p>Uploading a CSV dataset</p></figcaption></figure>

Now we can return to Prompt Playground, and this time choose our new dataset from the "Test over dataset" dropdown.

You can also load in your saved Prompt:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-4.png" %}

We'll also need to update our prompt to look for the `{{input_article}}` column in our dataset. After adding this in, be sure to save your prompt once more!

Now if we run our prompt(s), each row of the dataset will be run through each variation of our prompt.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-5.png" %}

And if you return to view your dataset, you'll see the details of that run saved as an experiment.

<figure><img src="../../.gitbook/assets/Screenshot 2024-12-09 at 11.37.34 AM.png" alt=""><figcaption></figcaption></figure>

From here, you could [evaluate that experiment](../datasets-and-experiments/how-to-experiments/#how-to-use-evaluators) to test its performance, or add complexity to your prompts to see which prompts performed better. You can also bolster your prompts with tools and output schemas, or experiment with different LLMs, for better alignment with your application/use case.

### Updating a Prompt

You can now easily modify you prompt or compare different versions side-by-side. Let's say you've found a stronger version of the prompt. Save your updated prompt once again, and you'll see it added as a new version under your existing prompt:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-6.png" %}

You can also tag which version you've deemed ready for production, and view code to access your prompt in code further down the page.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt-qs-7.png" %}

### Next Steps

Now you're ready to create, test, save, and iterate on your Prompts in Phoenix! [Learn More](get-started-prompt-playground.md#learn-more).

## Prompts (Python SDK)

### Installation

Start out by installing the Phoenix library:

```bash
pip install arize-phoenix-client openai
```

### Creating a Prompt

Now you can create a prompt. In this example, you'll create a summarization Prompt.

Prompts in Phoenix have **names**, as well as multiple **versions**. When you create your prompt, you'll define its name. Then, each time you update your prompt, that will create a new version of the prompt under the same name.

```python
from phoenix.client import Client
from phoenix.client.types import PromptVersion

content = """
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

{{ article }}
"""

prompt_name = "article-bullet-summarizer"
prompt = Client().prompts.create(
    name=prompt_name,
    prompt_description="Summarize an article in a few bullet points",
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
)
```

Your prompt will now appear in your Phoenix dashboard:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompts-python-qs-1.png" %}

### Retrieving a Prompt

You can retrieve a prompt by name, tag, or version:

```python
from phoenix.client import Client

client = Client()

# Pulling a prompt by name
prompt_name = "article-bullet-summarizer"
client.prompts.get(prompt_identifier=prompt_name)

# Pulling a prompt by version id
# The version ID can be found in the versions tab in the UI
prompt = client.prompts.get(prompt_version_id="UHJvbXB0VmVyc2lvbjoy")

# Pulling a prompt by tag
# Since tags don't uniquely identify a prompt version 
#  it must be paired with the prompt identifier (e.g. name)
prompt = client.prompts.get(prompt_identifier=prompt_name, tag="staging")
```

### Using a Prompt

To use a prompt, call the `prompt.format()`function. Any `{{ variables }}` in the prompt can be set by passing in a dictionary of values.

```python
from openai import OpenAI

prompt_vars = {"topic": "Sports", "article": "Surrey have signed Australia all-rounder Moises Henriques for this summer's NatWest T20 Blast. Henriques will join Surrey immediately after the Indian Premier League season concludes at the end of next month and will be with them throughout their Blast campaign and also as overseas cover for Kumar Sangakkara - depending on the veteran Sri Lanka batsman's Test commitments in the second half of the summer. Australian all-rounder Moises Henriques has signed a deal to play in the T20 Blast for Surrey . Henriques, pictured in the Big Bash (left) and in ODI action for Australia (right), will join after the IPL . Twenty-eight-year-old Henriques, capped by his country in all formats but not selected for the forthcoming Ashes, said: 'I'm really looking forward to playing for Surrey this season. It's a club with a proud history and an exciting squad, and I hope to play my part in achieving success this summer. 'I've seen some of the names that are coming to England to be involved in the NatWest T20 Blast this summer, so am looking forward to testing myself against some of the best players in the world.' Surrey director of cricket Alec Stewart added: 'Moises is a fine all-round cricketer and will add great depth to our squad.'"}
formatted_prompt = prompt.format(variables=prompt_vars)

# Make a request with your Prompt
oai_client = OpenAI()
resp = oai_client.chat.completions.create(**formatted_prompt)
```

### Updating a Prompt

To update a prompt with a new version, simply call the create function using the existing prompt name:

```python
content = """
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

Be sure not to miss any key points.

{{ article }}
"""

prompt_name = "article-bullet-summarizer"
prompt = Client().prompts.create(
    name=prompt_name,
    prompt_description="Summarize an article in a few bullet points",
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
)
```

The new version will appear in your Phoenix dashboard:

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompts-python-qs-2.png" %}

Congratulations! You can now create, update, access and use prompts using the Phoenix SDK!

### Next Steps

Now you're ready to create, test, save, and iterate on your Prompts in Phoenix! [Learn More](get-started-prompt-playground.md#learn-more).

## Prompts (TS SDK)

### Installation

First, install the [Phoenix client library](https://www.npmjs.com/package/@arizeai/phoenix-client):

```bash
npm install @arizeai/phoenix-client
```

### Creating a Prompt

Let's start by creating a simple prompt in Phoenix using the TypeScript client:

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

// Create a Phoenix client 
// (optional, the createPrompt function will create one if not provided)
const client = createClient({
  options: {
    baseUrl: "http://localhost:6006", // Change to your Phoenix server URL
    // If your Phoenix instance requires authentication:
    // headers: {
    //   Authorization: "bearer YOUR_API_KEY",
    // }
  }
});

// Define a simple summarization prompt
const summarizationPrompt = await createPrompt({
  client,
  name: "article-summarizer",
  description: "Summarizes an article into concise bullet points",
  version: promptVersion({
    description: "Initial version",
    templateFormat: "MUSTACHE",
    modelProvider: "OPENAI", // Could also be ANTHROPIC, GEMINI, etc.
    modelName: "gpt-3.5-turbo",
    template: [
      {
        role: "system",
        content: "You are an expert summarizer. Create clear, concise bullet points highlighting the key information."
      },
      {
        role: "user",
        content: "Please summarize the following {{topic}} article:\n\n{{article}}"
      }
    ],
  })
});

console.dir(summarizationPrompt);
```

### Getting a Prompt

You can retrieve prompts by name, ID, version, or tag:

```typescript
import { getPrompt } from "@arizeai/phoenix-client/prompts";

// Get by name (latest version)
const latestPrompt = await getPrompt({
  prompt: {
    name: "article-summarizer",
  }
});

// Get by specific version ID
const specificVersionPrompt = await getPrompt({ 
  prompt: {
    versionId: "abcd1234",
  },
});

// Get by tag (e.g., "production", "staging", "development")
const productionPrompt = await getPrompt({ 
  prompt: {
    name: "article-summarizer", 
    tag: "production", 
  }
});
```

### Using a Prompt with SDKs

Phoenix makes it easy to use your prompts with various SDKs, no proprietary SDK necessary! Here's how to use a prompt with OpenAI:

```typescript
import { getPrompt, toSDK } from "@arizeai/phoenix-client/prompts";
import OpenAI from "openai";

// Initialize your OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get your prompt
const prompt = await getPrompt({
  prompt: {
    name: "article-summarizer",
  },
});

// Make sure the prompt was properly fetched
if (!prompt) {
  throw new Error("Prompt not found");
}

// Transform the prompt to OpenAI format with variable values
const openaiParameters = toSDK({
  sdk: "openai", 
  prompt,
  variables: {
    topic: "technology",
    article:
      "Artificial intelligence has seen rapid advancement in recent years. Large language models like GPT-4 can now generate human-like text, code, and even create images from descriptions. This technology is being integrated into many industries, from healthcare to finance, transforming how businesses operate and people work.",
  },
});

// Make sure the prompt was successfully converted to parameters
if (!openaiParameters) {
  throw new Error("OpenAI parameters not found");
}

// Use the transformed parameters with OpenAI
const response = await openai.chat.completions.create({
  ...openaiParameters,
  // You can override any parameters here
  model: "gpt-4o-mini", // Override the model if needed
  stream: false,
});


console.log("Summary:", response.choices[0].message.content);
```

The Phoenix client natively supports passing your prompts to OpenAI, Anthropic, and the[ Vercel AI SDK](https://sdk.vercel.ai/docs/introduction).

Congratulations! You can now create, update, access and use prompts using the Phoenix SDK!

### Next Steps

Now you're ready to create, test, save, and iterate on your Prompts in Phoenix! [Learn More](get-started-prompt-playground.md#learn-more).

### Learn More:

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td>Prompt Concepts</td><td><a href="../prompt-engineering/concepts-prompts/prompts-concepts.md">prompts-concepts.md</a></td></tr><tr><td>Prompts in Phoenix</td><td><a href="../prompt-engineering/overview-prompts.md">overview-prompts.md</a></td></tr></tbody></table>
