# Using a prompt

Once you have tagged a version of a prompt as ready (e.x. "staging") you can pull a prompt into your code base and use it to prompt an LLM.

<details>

<summary><span data-gb-custom-inline data-tag="emoji" data-code="26a0">⚠️</span> A caution about using prompts in your code</summary>

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

{% tabs %}
{% tab title="Python" %}
:construction: Under construction
{% endtab %}

{% tab title="TypeScript" %}
:construction: Under construction
{% endtab %}
{% endtabs %}

## Using a prompt

The phoenix clients support formatting the prompt with variables and providing the messages, model information, tools, and response format.



