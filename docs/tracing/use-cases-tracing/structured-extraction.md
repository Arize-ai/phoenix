---
description: Using LLMs to extract structured data from unstructured text
---

# Structured Data Extraction

| Framework         | Example notebook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open AI Functions | [![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/openai\_tracing\_tutorial.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/openai\_tracing\_tutorial.ipynb) |

## Overview

Data extraction tasks using LLMs, such as scraping text from documents or pulling key information from paragraphs, are on the rise. Using an LLM for this task makes sense - LLMs are great at inherently capturing the structure of language, so extracting that structure from text using LLM prompting is a low cost, high scale method to pull out relevant data from unstructured text.&#x20;

{% hint style="info" %}
**Structured Extraction at a Glance**

**LLM Input:** Unstructured text + schema + system message

**LLM Output:** Response based on provided text + schema

**Evaluation Metrics:**

1. Did the LLM extract the text correctly? (correctness)
{% endhint %}

<figure><img src="../../.gitbook/assets/Screenshot 2023-10-13 at 5.10.42 PM.png" alt=""><figcaption></figcaption></figure>

One approach is using a flattened schema. Let's say you're dealing with extracting information for a trip planning application. The query may look something like:

> User: I need a budget-friendly hotel in San Francisco close to the Golden Gate Bridge for a family vacation. What do you recommend?

As the application designer, the schema you may care about here for downstream usage could be a flattened representation looking something like:

```
{
    budget: "low",
    location: "San Francisco",
    purpose: "pleasure"
}
```

With the above extracted attributes, your downstream application can now construct a structured query to find options that might be relevant to the user.

## Implementing a structured extraction application

Structured extraction is a place where it’s simplest to work directly with the [OpenAI function calling API](https://openai.com/blog/function-calling-and-other-api-updates). Open AI functions for structured data extraction recommends providing the following JSON schema object in the form of`parameters_schema`(the desired fields for structured data output).

<pre class="language-json"><code class="lang-json"><strong>parameters_schema = {
</strong>    "type": "object",
    "properties": {
        "location": {
            "type": "string",
            "description": 'The desired destination location. Use city, state, and country format when possible. If no destination is provided, return "unstated".',
        },
        "budget_level": {
            "type": "string",
            "enum": ["low", "medium", "high", "not_stated"],
            "description": 'The desired budget level. If no budget level is provided, return "not_stated".',
        },
        "purpose": {
            "type": "string",
            "enum": ["business", "pleasure", "other", "non_stated"],
            "description": 'The purpose of the trip. If no purpose is provided, return "not_stated".',
        },
    },
    "required": ["location", "budget_level", "purpose"],
}
function_schema = {
    "name": "record_travel_request_attributes",
    "description": "Records the attributes of a travel request",
    "parameters": parameters_schema,
}
system_message = (
    "You are an assistant that parses and records the attributes of a user's travel request."
)
</code></pre>

The `ChatCompletion` call to Open AI would look like

```
response = openai.ChatCompletion.create(
    model=model,
    messages=[
        {"role": "system", "content": system_message},
        {"role": "user", "content": travel_request},
    ],
    functions=[function_schema],
    # By default, the LLM will choose whether or not to call a function given the conversation context.
    # The line below forces the LLM to call the function so that the output conforms to the schema.
    function_call={"name": function_schema["name"]},
)
```

## Inspecting structured extraction with Phoenix

You can use phoenix spans and traces to inspect the invocation parameters of the function to&#x20;

1. verify the inputs to the model in form of the the user message
2. verify your request to Open AI&#x20;
3. verify the corresponding generated outputs from the model match what's expected from the schema and are correct

<figure><img src="../../.gitbook/assets/Screenshot 2023-10-13 at 5.39.53 PM.png" alt=""><figcaption><p>Viewing a batch of traces</p></figcaption></figure>

<figure><img src="../../.gitbook/assets/Screenshot 2023-10-13 at 5.40.31 PM.png" alt=""><figcaption><p>Inspecting an individual trace</p></figcaption></figure>

<figure><img src="../../.gitbook/assets/Screenshot 2023-10-13 at 5.40.56 PM (1).png" alt=""><figcaption><p>Verifying an individual trace invocation parameters</p></figcaption></figure>

## Evaluating the Extraction Performance

Point level evaluation is a great starting point, but verifying correctness of extraction at scale or in a batch pipeline can be challenging and expensive. Evaluating data extraction tasks performed by LLMs is inherently challenging due to factors like:

* The diverse nature and format of source data.
* The potential absence of a 'ground truth' for comparison.
* The intricacies of context and meaning in extracted data.

To learn more about how to evaluate structured extraction applications, [head to our documentation on LLM assisted evals](https://arize.com/blog-course/llm-evaluation-the-definitive-guide/)!
