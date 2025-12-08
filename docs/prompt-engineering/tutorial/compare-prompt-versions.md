---
description: Build New Prompt Versions and Compare
---

# Compare Prompt Versions

Our earlier experiment revealed the limits of our current prompt and settings. Now we’ll iterate systematically: adjusting instructions, model choice, and generation hyperparameters, to test how each change impacts accuracy.

{% hint style="info" %}
**Follow along with code**: This guide has a companion notebook with runnable code examples. Find it [here](https://github.com/Arize-ai/phoenix/blob/main/tutorials/prompts/phoenix_prompt_tutorial.ipynb), and go to Part 3: Compare Prompt Versions.
{% endhint %}

## Build Two New Prompt Versions

In [test-prompts-at-scale.md](test-prompts-at-scale.md "mention"), our experiment gave us some insights into why our prompt was underperforming - only achieving 53% accuracy. In this section, we'll build our new version of the prompt based on this analysis.

### Edit Prompt Template (Version 3)

The prompt template refers to the specific text passed to your LLM. In [test-prompts-at-scale.md](test-prompts-at-scale.md "mention"), we saw that 30/71 errors came from the broad\_vs\_specific error type, so we built a custom instruction from this observation.&#x20;

{% code overflow="wrap" %}
```
When classifying user queries, always prefer the most specific applicable category over a broader one. If a query mentions a clear, concrete action or object (e.g., subscription downgrade, invoice, profile name), classify it under that specific intent rather than a general one (e.g., Billing Inquiry, General Feedback).
```
{% endcode %}

Let's upload a new prompt version with this instruction added in.

{% tabs %}
{% tab title="UI" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/added_broad_vs_specific_instruction.mp4" %}
{% endtab %}

{% tab title="Python" %}
{% code overflow="wrap" %}
```python
from phoenix.client import Client
from phoenix.client.types.prompts import PromptVersion

px_client = Client()

# 1. New Instruction
broad_vs_specific_instruction = """When classifying user queries, always prefer the most specific applicable category over a broader one. If a query mentions a clear, concrete action or object (e.g., subscription downgrade, invoice, profile name), classify it under that specific intent rather than a general one (e.g., Billing Inquiry, General Feedback)."""

# 2. Get existing prompt
existing = px_client.prompts.get(prompt_identifier="support-classifier")

# 3. Modify the template
messages = existing._template["messages"]

# Add new instruction to system prompt
messages[0]["content"][0]["text"] += broad_vs_specific_instruction


# 4. Create new version with modifications
new_version = PromptVersion(
    messages,
    model_name=existing._model_name,
    model_provider=existing._model_provider,
    template_format=existing._template_format,
    description="Added broad_vs_specific rule"
)

# 5. Save as new version
created = px_client.prompts.create(
    name="support-classifier",  # Same name = new version on existing prompt
    version=new_version,
)
```
{% endcode %}
{% endtab %}

{% tab title="TS" %}
{% code overflow="wrap" %}
```typescript
import { getPrompt, createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

// 1. New Instruction
const broadVsSpecificInstruction = `When classifying user queries, always prefer the most specific applicable category over a broader one...`;

// 2. Get existing prompt
const existing = await getPrompt({
  prompt: { name: "support-classifier" },
});

// 3. Modify the template
const messages = existing.template.messages;
const originalText = messages[0]?.content?.[0]?.text || "";
const newText = originalText + broadVsSpecificInstruction;

const newMessages = [
  { role: "system", content: [{ type: "text", text: newText }] },
  { role: "user", content: [{ type: "text", text: "{{query}}" }] },
];

// 4. Create new version (same name = new version on existing prompt)
const newVersion = await createPrompt({
  name: "support-classifier",
  version: promptVersion({
    description: "Added broad_vs_specific instruction",
    modelProvider: "OPENAI",
    modelName: existing.model_name
    template: newMessages,
    templateFormat: "MUSTACHE",
    invocationParameters: { temperature: 1, top_p: 1 },
  }),
});
```
{% endcode %}
{% endtab %}
{% endtabs %}

### Edit Prompt Parameters (Version 4)

In Phoenix, Prompt Objects are more than just the Prompt Template - they include other parameters that can have huge impacts on the success of your prompt. In this section, we'll upload another Prompt Version, this one with adjusted model parameters, so we can later test it out.&#x20;

Here are common prompt parameters:

* **Model Choice** (GPT-4.1, Claude Sonnet 4.5, Gemini 3, etc.) – Different models vary in reasoning depth, instruction-following ability, speed, and cost; selecting the right one can dramatically affect accuracy, latency, and overall cost.
* **Temperature** – Lower values make responses more consistent and deterministic; higher values increase variety and creativity.
* **Top-p / Top-k** – Control how many token options the model considers when generating text; useful for balancing precision and diversity.
* **Frequency / Presence Penalties** – Help reduce repetition or encourage mentioning new concepts.
* **Tool Descriptions** – Clearly defined tools (like web search or dataset retrieval) help the model ground its outputs and choose the right action during generation.

Let's edit our parameters.

<table data-header-hidden><thead><tr><th></th><th width="133.66796875"></th><th width="136.55859375"></th><th></th></tr></thead><tbody><tr><td><strong>Parameter</strong></td><td><strong>Current</strong></td><td><strong>New</strong></td><td><strong>Description</strong></td></tr><tr><td><strong>Model</strong></td><td><code>gpt-4o-mini</code></td><td><code>gpt-4.1-mini</code></td><td>Slightly higher cost but improved reasoning and classification accuracy; better suited for nuanced intent detection.</td></tr><tr><td><strong>Temperature</strong></td><td><code>1.0</code></td><td><code>0.3</code></td><td>Lowering temperature makes outputs more consistent and less random—ideal for deterministic tasks like classification.</td></tr><tr><td><strong>Top-p</strong></td><td><code>1.0</code></td><td><code>0.8</code></td><td>Reduces the sampling range, encouraging the model to choose higher-probability tokens for more stable predictions.</td></tr></tbody></table>

{% tabs %}
{% tab title="UI" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_params.mp4" %}
{% endtab %}

{% tab title="Python" %}
{% code overflow="wrap" %}
```python
from phoenix.client import Client
from phoenix.client.types.prompts import PromptVersion

px_client = Client()

# 1. Get existing prompt
existing = px_client.prompts.get(prompt_identifier="support-classifier")

new_version = PromptVersion(
    existing._template["messages"],
    model_name="gpt-4.1-mini",
    model_provider=existing._model_provider,
    template_format="MUSTACHE",
    description="using temperature=0.3, top_p=0.8, model_name=gpt-4.1-mini"
)

# Set invocation parameters
new_version._invocation_parameters = {
    "temperature": 0.3,
    "top_p": 0.8,
}

updated_params_prompt = px_client.prompts.create(
    name="support-classifier",
    version=new_version,
)
```
{% endcode %}
{% endtab %}

{% tab title="TS" %}
{% code overflow="wrap" %}
```typescript
import { getPrompt, createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

// 1. Get existing prompt
const existing = await getPrompt({
  prompt: { name: "support-classifier" },
});

if (!existing) throw new Error("Prompt not found");

// 2. Create new version with updated parameters
const updatedParamsPrompt = await createPrompt({
  name: "support-classifier",
  version: promptVersion({
    description: "using temperature=0.3, top_p=0.8, model_name=gpt-4.1-mini",
    modelProvider: "OPENAI",
    modelName: "gpt-4.1-mini",  // Changed model
    template: existing.template.messages,  // Keep same template
    templateFormat: "MUSTACHE",
    invocationParameters: {
      temperature: 0.3,
      top_p: 0.8,
    },
  }),
});

console.log(`New version ID: ${updatedParamsPrompt.id}`);
```
{% endcode %}
{% endtab %}
{% endtabs %}

## Compare Prompt Versions

Now that we've created 2 new versions of our prompt, we need to test them on our dataset to see if our accuracy improved. This will help us figure out if our prompts improved, and what changes lead to the most improvements.&#x20;

{% tabs %}
{% tab title="Python" %}
First, head to your support-classifier prompt in the Phoenix UI and copy the corresponding version IDs for Version 3 and Version 4.

{% code overflow="wrap" %}
```python
from phoenix.client import Client
from phoenix.client.experiments import async_run_experiment
from openai import AsyncOpenAI

px_client = Client()
async_openai_client = AsyncOpenAI()

# Get dataset
support_query_dataset = px_client.datasets.get_dataset(dataset="support-query-dataset")

# Version IDs copied from Phoenix UI
VERSION_3 = "REPLACE WITH VERSION 3 ID"
VERSION_4 = "REPLACE WITH VERSION 4 ID"

# Get prompt versions
prompt_v1 = px_client.prompts.get(prompt_version_id=VERSION_A)
prompt_v2 = px_client.prompts.get(prompt_version_id=VERSION_B)

# Define task factory
def create_task(prompt):
    model = prompt._model_name
    messages = prompt._template["messages"]
    
    async def task(input):
        messages[1]["content"][0]["text"] = input["query"]
        response = await async_openai_client.chat.completions.create(
            model=model,
            messages=messages,
        )
        return response.choices[0].message.content
    return task

# Run experiment with Version 3
experiment_v3 = await async_run_experiment(
    dataset=dataset,
    task=create_task(prompt_v1),
    evaluators=[ground_truth_evaluator, output_evaluator], 
    ## evaluator code in Test Prompts at Scale
    experiment_name="support-classifier-v3",
)

# Run experiment with Version 4
experiment_v4 = await async_run_experiment(
    dataset=dataset,
    task=create_task(prompt_v2),
    evaluators=[ground_truth_evaluator, output_evaluator],
    ## evaluator code in Test Prompts at Scale
    experiment_name="support-classifier-v4",
)

# See experiments in Phoenix UI
```
{% endcode %}
{% endtab %}

{% tab title="TS" %}
{% code overflow="wrap" %}
```typescript
import { getPrompt, createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

// 1. New Instruction
const broadVsSpecificInstruction = `When classifying user queries, always prefer the most specific applicable category over a broader one...`;

// 2. Get existing prompt
const existing = await getPrompt({
  prompt: { name: "support-classifier" },
});

// 3. Modify the template
const messages = existing.template.messages;
const originalText = messages[0]?.content?.[0]?.text || "";
const newText = originalText + broadVsSpecificInstruction;

const newMessages = [
  { role: "system", content: [{ type: "text", text: newText }] },
  { role: "user", content: [{ type: "text", text: "{{query}}" }] },
];

// 4. Create new version (same name = new version on existing prompt)
const newVersion = await createPrompt({
  name: "support-classifier",
  version: promptVersion({
    description: "Added broad_vs_specific instruction",
    modelProvider: "OPENAI",
    modelName: existing.model_name
    template: newMessages,
    templateFormat: "MUSTACHE",
    invocationParameters: { temperature: 1, top_p: 1 },
  }),
});
```
{% endcode %}
{% endtab %}
{% endtabs %}

Let's take a look at our results in the Experiments tab of our support query dataset.&#x20;

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/Screenshot%202025-12-04%20at%201.51.02%E2%80%AFPM.png" %}

**Awesome!** Our new instruction improved accuracy to **61%**, and combining it with updated hyperparameters and an upgraded model (**gpt-4.1-mini**) pushed accuracy even higher, up to **74%**.

## Summary

In this section, we translated our analysis into measurable improvement.\
We built two new prompt versions, ran them through experiments, and quantified the gains:

* **Custom instruction only:** Accuracy improved from **53% → 61%**
* **Instruction + tuned parameters + upgraded model:** Accuracy climbed further to **74%**

By refining our prompt and adjusting key model settings, we saw clear, data-backed progress. We now have a stronger prompt, a better-performing model, and a workflow for iterating with confidence inside Phoenix.

## Next Steps

**We're not done yet. There's still a lot of room for improvement!**

In the next section, [optimize-prompts-automatically.md](optimize-prompts-automatically.md "mention"), we'll use Prompt Learning, an automated prompt optimization algorithm (developed by Arize), to improve our prompt even more.



