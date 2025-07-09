---
description: Store and track prompt versions in Phoenix
---

# Create a prompt

Prompts with Phoenix can be created using the playground as well as via the phoenix-clients.

## Using the Playground

Navigate to the **Prompts** in the navigation and click the add prompt button on the top right. This will navigate you to the Playground.&#x20;

The [playground](../overview-prompts/prompt-playground.md) is like the IDE where you will develop your prompt. The prompt section on the right lets you add more messages, change the template format (f-string or mustache), and an output schema (JSON mode).

### Compose a prompt

To the right you can enter sample inputs for your prompt variables and run your prompt against a model. Make sure that you have an API key set for the LLM provider of your choosing.

### Save the prompt

To save the prompt, click the save button in the header of the prompt on the right. Name the prompt using alpha numeric characters (e.x. \`my-first-prompt\`) with no spaces. \
\
The model configuration you selected in the Playground will be saved with the prompt. When you re-open the prompt, the model and configuration will be loaded along with the prompt.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/create_prompt.png" alt=""><figcaption><p>Once you are satisfied with your prompt in the playground, you can name it and save it</p></figcaption></figure>

### View your prompts

You just created your first prompt in Phoenix! You can view and search for prompts by navigating to Prompts in the UI.&#x20;

Prompts can be loaded back into the Playground at any time by clicking on "open in playground"

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/open_prompt.gif" alt=""><figcaption><p>You can quickly load in the latest version of a prompt into the playground</p></figcaption></figure>



To view the details of a prompt, click on the prompt name. You will be taken to the prompt details view. The prompt details view shows all the [parts of the prompt](https://app.gitbook.com/s/fqGNxHHFrgwnCxgUBNsJ/prompt-engineering/prompts-concepts#prompt) that has been saved (ex: the model used, the invocation parameters, etc.)

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_details.png" alt=""><figcaption><p>The details of a prompt shows everything that is saved about a prompt</p></figcaption></figure>



### Making edits to a prompt

Once you've crated a prompt, you probably need to make tweaks over time. The best way to make tweaks to a prompt is using the playground.  Depending on how destructive a change you are making you might want to just create a new [prompt version](https://app.gitbook.com/s/fqGNxHHFrgwnCxgUBNsJ/prompt-engineering/prompts-concepts#prompt-version) or [clone](create-a-prompt.md#cloning-a-prompt) the prompt.

#### Editing a prompt in the playground

To make edits to a prompt, click on the edit in Playground on the top right of the prompt details view.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_edit.gif" alt=""><figcaption><p>Iterate on prompts in the playground and save when you are happy with the prompt</p></figcaption></figure>

When you are happy with your prompt, click save. You will be asked to provide a description of the changes you made to the prompt. This description will show up in the history of the prompt for others to understand what you did.

#### Cloning a prompt

In some cases, you may need to modify a prompt without altering its original version. To achieve this, you can **clone** a prompt, similar to forking a repository in Git.

Cloning a prompt allows you to experiment with changes while preserving the history of the main prompt. Once you have made and reviewed your modifications, you can choose to either keep the cloned version as a separate prompt or merge your changes back into the main prompt. To do this, simply load the cloned prompt in the playground and save it as the main prompt.

This approach ensures that your edits are flexible and reversible, preventing unintended modifications to the original prompt.

### Adding labels and metadata

:construction: Prompt labels and metadata is still [under construction.](https://github.com/Arize-ai/phoenix/issues/6290)

## Using the Phoenix Client

Starting with prompts, Phoenix has a dedicated client that lets you programmatically. Make sure you have installed the appropriate[ phoenix-client](../../#packages) before proceeding.

{% hint style="info" %}
phoenix-client for both Python and TypeScript are very early in it's development and may not have every feature you might be looking for. Please drop us an issue if there's an enhancement you'd like to see. [https://github.com/Arize-ai/phoenix/issues](https://github.com/Arize-ai/phoenix/issues)
{% endhint %}

### Compose a Prompt

Creating a prompt in code can be useful if you want a programatic way to sync prompts with the Phoenix server.

{% tabs %}
{% tab title="Python" %}
Below is an example prompt for summarizing articles as bullet points. Use the Phoenix client to store the prompt in the Phoenix server. The name of the prompt is an identifier with lowercase alphanumeric characters plus hyphens and underscores (no spaces).

```python
import phoenix as px
from phoenix.client.types import PromptVersion

content = """\
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

{{ article }}
"""

prompt_name = "article-bullet-summarizer"
prompt = px.Client().prompts.create(
    name=prompt_name,
    version=PromptVersion(
        [{"role": "user", "content": content}],
        model_name="gpt-4o-mini",
    ),
)
```

A prompt stored in the database can be retrieved later by its name. By default the latest version is fetched. Specific version ID or a tag can also be used for retrieval of a specific version.

```python
prompt = px.Client().prompts.get(prompt_identifier=prompt_name)
```

If a version is [tagged](tag-a-prompt.md) with, e.g. "production", it can retrieved as follows.

```python
prompt = px.Client().prompts.get(prompt_identifier=prompt_name, tag="production")
```
{% endtab %}

{% tab title="TypeScript" %}
Below is an example prompt for summarizing articles as bullet points. Use the Phoenix client to store the prompt in the Phoenix server. The name of the prompt is an identifier with lowercase alphanumeric characters plus hyphens and underscores (no spaces).

```typescript
import { createPrompt, promptVersion } from "@arizeai/phoenix-client";

const promptTemplate = `
You're an expert educator in {{ topic }}. Summarize the following article
in a few concise bullet points that are easy for beginners to understand.

{{ article }}
`;

const version = createPrompt({
  name: "article-bullet-summarizer",
  version: promptVersion({
    modelProvider: "OPENAI",
    modelName: "gpt-3.5-turbo",
    template: [
      {
        role: "user",
        content: promptTemplate,
      },
    ],
  }),
});
```

A prompt stored in the database can be retrieved later by its name. By default the latest version is fetched. Specific version ID or a tag can also be used for retrieval of a specific version.

```typescript
import { getPrompt } from "@arizeai/phoenix-client/prompts";

const prompt = await getPrompt({ name: "article-bullet-summarizer" });
// ^ you now have a strongly-typed prompt object, in the Phoenix SDK Prompt type
```

If a version is [tagged](tag-a-prompt.md) with, e.g. "production",  it can retrieved as follows.

```typescript
const promptByTag = await getPrompt({ tag: "production", name: "article-bullet-summarizer" });
// ^ you can optionally specify a tag to filter by
```
{% endtab %}
{% endtabs %}

