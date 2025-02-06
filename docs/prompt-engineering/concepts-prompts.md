# Concepts: Prompts

### Prompt

Prompts often times refer to the content of how you "prompt" a LLM, e.g. the "text" that you send to a model like gpt-4. Within Phoenix we expand this definition to be everything that's needed to prompt:

* The **prompt template** of the messages to send to a completion endpoint
* The **invocation parameters** (temperature, frequency penalty, etc.)
* The [**tools**](concepts-prompts.md#tools) made accessible to the LLM (e.x. weather API)
* The [**response** **format**](concepts-prompts.md#response-format) (sometimes called the output schema) used for when you have JSON mode enabled.

This expanded definition of a **prompt** lets you more deterministically invoke LLMs with confidence as everything is snapshotted for you to use within your application.

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix_prompt.png" alt=""><figcaption><p>A phoenix prompt captures everything needed to invoke an LLM</p></figcaption></figure>

### Prompt Version

Every time you save a prompt within Phoenix, a snapshot of the prompt is saved as a **prompt version**. Phoenix does this so that you not only can view the changes to a prompt over time but also so that you can build confidence about a specific **prompt version** before using it within your application. With every **prompt version** phoenix tracks the author of the prompt and the date at which the version was saved.

Similar to the way in which you can track changes to your code via git shas, Phoenix tracks each change to your **prompt** with a `prompt_id`.

### Prompt Format

Prompts can be formatted to include any attributes from spans or datasets. These attributes can be added as **F-Strings** or using **Mustache** formatting.&#x20;

F-strings should be formatted with single `{`s:

```
{question}
```

{% hint style="info" %}
To escape a `{` when using F-string, add a second `{` in front of it, e.g., \{{escaped\}} {not-escaped}. Escaping variables will remove them from inputs in the Playground.
{% endhint %}



Mustache should be formatted with double `{{`s:

```
{{question}}
```

{% hint style="info" %}
We recommend using Mustache where possible, since it supports nested attributes, e.g. `attributes.input.value`, more seamlessly
{% endhint %}

### Tools

Tools allow LLM's to interact with the external environment. This can allow LLM's to interface with your application in more controlled ways. Given a prompt and some tools to choose from an LLM may choose to use some (or one) tools or not. Many LLM API's also expose a tool choice parameter which allow you to constrain how and which tools are selected.

Here is an example of what a tool would looke like for the weather API using OpenAI.

```json
{
    "type": "function",
    "function": {
        "name": "get_current_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                },
            },
            "required": ["location"],
        }
    }
}
```



## Response Format

Some LLM's support returning content in a specific format, this is called response format (sometimes also called output schema). You can specify the exact schema that you want the LLM to return content in and it will return content according to that schema. Check out this [OpenAI guide](https://platform.openai.com/docs/guides/structured-outputs) for more information.
