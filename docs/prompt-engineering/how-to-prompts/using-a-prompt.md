# Using a prompt

Once you have tagged a version of a prompt as ready (e.x. "staging") you can pull a prompt into your code base and use it to prompt an LLM.

<details>

<summary>ℹ️ A caution about using prompts inside your application code</summary>

When integrating Phoenix prompts into your application, it's important to understand that prompts are treated as code and are stored externally from your primary codebase. This architectural decision introduces several considerations:

#### Key Implementation Impacts

* Network dependencies for prompt retrieval
* Additional debugging complexity
* External system dependencies

#### Current Status

The Phoenix team is actively implementing safeguards to minimize these risks through:

* Caching mechanisms
* Fallback systems

#### Best Practices

If you choose to implement Phoenix prompts in your application, ensure you:

1. Implement robust caching strategies
2. Develop comprehensive fallback mechanisms
3. Consider the impact on your application's reliability requirements

If you have any feedback on the above improvements, please let us know [https://github.com/Arize-ai/phoenix/issues/6290](https://github.com/Arize-ai/phoenix/issues/6290)

</details>



To use prompts in your code you will need to install the phoenix client library.

For Python:

```
pip install arize-phoenix-client
```

For JavaScript / TypeScript:

```
npm install @arizeai/phoenix-client
```

## Pulling a prompt

There are three major ways pull prompts,  pull by [name or ID](using-a-prompt.md#pulling-a-prompt-by-name-or-id) (latest), pull by version, and pull by tag.&#x20;

### Pulling a prompt by Name or ID

Pulling a prompt by name or ID (e.g. the identifier) is the easiest way to pull a prompt. Note that since name and ID doesn't specify a specific version, you will always get the latest version of a prompt. For this reason we only recommend doing this during development.

{% tabs %}
{% tab title="Python" %}
<pre class="language-python"><code class="lang-python">from phoenix.client import Client

# Initialize a phoenix client with your phoenix endpoint
# By default it will read from your environment variables
client = Client(
 # endpoint="https://my-phoenix.com",
)

# Pulling a prompt by name
prompt_name = "my-prompt-name"
<strong>client.prompts.get(prompt_identifier=prompt_name)
</strong></code></pre>

Note prompt names and IDs are synonymous.
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { getPrompt } from "@arizeai/phoenix-client/prompts";

const prompt = await getPrompt({ name: "my-prompt" });
// ^ the latest version of the prompt named "my-prompt"

const promptById = await getPrompt({ promptId: "a1234" })
// ^ the latest version of the prompt with Id "a1234"
```
{% endtab %}
{% endtabs %}

### Pulling a prompt by Version ID

Pulling a prompt by version retrieves the content of a prompt at a particular point in time. The version can never change, nor be deleted, so you can reasonably rely on it in production-like use cases.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_version_id.png" alt=""><figcaption><p>The ID of a specific prompt version can be found in the prompt history.</p></figcaption></figure>

{% tabs %}
{% tab title="Python" %}
```python
# Initialize a phoenix client with your phoenix endpoint
# By default it will read from your environment variables
client = Client(
 # endpoint="https://my-phoenix.com",
)

# The version ID can be found in the versions tab in the UI
prompt = client.prompts.get(prompt_version_id="UHJvbXB0VmVyc2lvbjoy")
print(prompt.id)
prompt.dumps()
```
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { getPrompt } from "@arizeai/phoenix-client/prompts";

const promptByVersionId = await getPrompt({ versionId: "b5678" })
// ^ the latest version of the prompt with Id "a1234"
```
{% endtab %}
{% endtabs %}

### Pulling a prompt by Tag

Pulling by prompt by [tag](https://app.gitbook.com/s/fqGNxHHFrgwnCxgUBNsJ/prompt-engineering/prompts-concepts#prompt-version-tag) is most useful when you want a particular version of a prompt to be automatically used in a specific environment (say "staging").  To pull prompts by tag, you must [tag-a-prompt.md](tag-a-prompt.md "mention") in the UI first.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/prompt_version_tagging.png" alt=""><figcaption><p>You can control the prompt version tags in the UI.</p></figcaption></figure>

{% tabs %}
{% tab title="Python" %}
```python
# By default it will read from your environment variables
client = Client(
 # endpoint="https://my-phoenix.com",
)

# Since tags don't uniquely identify a prompt version 
#  it must be paired with the prompt identifier (e.g. name)
prompt = client.prompts.get(prompt_identifier="my-prompt-name", tag="staging")
print(prompt.id)
prompt.dumps()
```

Note that tags are unique per prompt so it must be paired with the **prompt\_identifier**
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { getPrompt } from "@arizeai/phoenix-client/prompts";

const promptByTag = await getPrompt({ tag: "staging", name: "my-prompt" });
// ^ the specific prompt version tagged "production", for prompt "my-prompt"
```
{% endtab %}
{% endtabs %}

A Prompt pulled in this way can be automatically updated in your application by simply moving the "staging" tag from one prompt version to another.

## Using a prompt

The phoenix clients support formatting the prompt with variables, and providing the messages, model information, [tools](https://app.gitbook.com/s/fqGNxHHFrgwnCxgUBNsJ/prompt-engineering/prompts-concepts#tools), and response format (when applicable).

The Phoenix Client libraries make it simple to transform prompts to the SDK that you are using (no proxying necessary!)

{% tabs %}
{% tab title="Python" %}
```python
from openai import OpenAI

prompt_vars = {"topic": "Sports", "article": "Surrey have signed Australia all-rounder Moises Henriques for this summer's NatWest T20 Blast. Henriques will join Surrey immediately after the Indian Premier League season concludes at the end of next month and will be with them throughout their Blast campaign and also as overseas cover for Kumar Sangakkara - depending on the veteran Sri Lanka batsman's Test commitments in the second half of the summer. Australian all-rounder Moises Henriques has signed a deal to play in the T20 Blast for Surrey . Henriques, pictured in the Big Bash (left) and in ODI action for Australia (right), will join after the IPL . Twenty-eight-year-old Henriques, capped by his country in all formats but not selected for the forthcoming Ashes, said: 'I'm really looking forward to playing for Surrey this season. It's a club with a proud history and an exciting squad, and I hope to play my part in achieving success this summer. 'I've seen some of the names that are coming to England to be involved in the NatWest T20 Blast this summer, so am looking forward to testing myself against some of the best players in the world.' Surrey director of cricket Alec Stewart added: 'Moises is a fine all-round cricketer and will add great depth to our squad.'"}
formatted_prompt = prompt.format(variables=prompt_vars)

# Make a request with your Prompt
oai_client = OpenAI()
resp = oai_client.chat.completions.create(**formatted_prompt)
```
{% endtab %}

{% tab title="TypeScript" %}
```typescript
import { getPrompt, toSDK } from "@arizeai/phoenix-client/prompts";
import OpenAI from "openai";

const openai = new OpenAI()
const prompt = await getPrompt({ name: "my-prompt" });

// openaiParameters is fully typed, and safe to use directly in the openai client
const openaiParameters = toSDK({
  // sdk does not have to match the provider saved in your prompt
  // if it differs, we will apply a best effort conversion between providers automatically
  sdk: "openai",
  prompt: questionAskerPrompt,
  // variables within your prompt template can be replaced across messages
  variables: { question: "How do I write 'Hello World' in JavaScript?" }
});

const response = await openai.chat.completions.create({
  ...openaiParameters,
  // you can still override any of the invocation parameters as needed
  // for example, you can change the model or stream the response
  model: "gpt-4o-mini",
  stream: false
})
```
{% endtab %}
{% endtabs %}

Both the Python and TypeScript SDKs support transforming your prompts to a variety of SDKs (no proprietary SDK necessary).

* Python - support for OpenAI, Anthropic, Gemini
* TypeScript -  support for OpenAI, Anthropic, and the Vercel AI SDK



