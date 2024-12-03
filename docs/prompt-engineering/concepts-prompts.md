# Concepts: Prompts

## Testing Multiple Prompts

Prompt Playground supports testing multiple prompt variants side-by-side. Use the `+ Compare` button to add a prompt variant. Whether you're using Span Replay or running your prompts over a Dataset, playground will run your inputs through each prompt variant and show the results side-by-side.

<figure><img src="../.gitbook/assets/Screenshot 2024-12-02 at 9.55.26 AM.png" alt=""><figcaption><p>Testing multiple prompts simultaneously</p></figcaption></figure>

## Prompt Format

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

## Tools

Tools allow LLM's to interact with the external environment. This can allow LLM's to interface with your application in more controlled ways. Given a prompt and some tools to choose from an LLM may choose to use some (or one) tools or not. Many LLM API's also expose a tool choice parameter which allow you to constrain how and which tools are selected.

## Structured Output

Some LLM's support returning content in a specific format, this is called Structured Output. You can specify the exact schema that you want the LLM to return content in and it will return content according to that schema. Check out this [OpenAI guide](https://platform.openai.com/docs/guides/structured-outputs) for more information.
