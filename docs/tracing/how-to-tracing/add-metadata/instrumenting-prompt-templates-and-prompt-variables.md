# Instrument Prompt Templates and Prompt Variables

Instrumenting prompt templates and variables allows you to track and visualize prompt changes. These can also be combined with [Experiments](../../../datasets-and-experiments/how-to-experiments/run-experiments.md) to measure the performance changes driven by each of your prompts.

{% tabs %}
{% tab title="Python" %}
We provide a `using_prompt_template` context manager to add a prompt template (including its version and variables) to the current OpenTelemetry Context. OpenInference [auto-instrumentors](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the prompt template fields as span attributes, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). Its inputs must be of the following type:

* Template: non-empty string.
* Version: non-empty string.
* Variables: a dictionary with string keys. This dictionary will be serialized to JSON when saved to the OTEL Context and remain a JSON string when sent as a span attribute.

```python
from openinference.instrumentation import using_prompt_template

prompt_template = "Please describe the weather forecast for {city} on {date}"
prompt_template_variables = {"city": "Johannesburg", "date":"July 11"}
with using_prompt_template(
    template=prompt_template,
    variables=prompt_template_variables,
    version="v1.0",
    ):
    # Commonly preceeds a chat completion to append templates to auto instrumentation
    # response = client.chat.completions.create()
    # Calls within this block will generate spans with the attributes:
    # "llm.prompt_template.template" = "Please describe the weather forecast for {city} on {date}"
    # "llm.prompt_template.version" = "v1.0"
    # "llm.prompt_template.variables" = "{\"city\": \"Johannesburg\", \"date\": \"July 11\"}" # JSON serialized
    ...
```

It can also be used as a decorator:

```python
@using_prompt_template(
    template=prompt_template,
    variables=prompt_template_variables,
    version="v1.0",
)
def call_fn(*args, **kwargs):
    # Calls within this function will generate spans with the attributes:
    # "llm.prompt_template.template" = "Please describe the weather forecast for {city} on {date}"
    # "llm.prompt_template.version" = "v1.0"
    # "llm.prompt_template.variables" = "{\"city\": \"Johannesburg\", \"date\": \"July 11\"}" # JSON serialized
    ...
```
{% endtab %}

{% tab title="JS" %}
We provide a `setPromptTemplate` function which allows you to set a template, version, and variables on context. You can use this utility in conjunction with [`context.with`](https://opentelemetry.io/docs/languages/js/context/#set-active-context) to set the active context. OpenInference [auto instrumentations](broken-reference) will then pick up these attributes and add them to any spans created within the `context.with` callback. The components of a prompt template are:

* template - a string with templated variables ex. `"hello {{name}}"`
* variables - an object with variable names and their values ex. `{name: "world"}`
* version - a string version of the template ex. `v1.0`

All of these are optional. Application of variables to a template will typically happen before the call to an llm and may not be picked up by auto instrumentation. So, this can be helpful to add to ensure you can see the templates and variables while troubleshooting.

<pre class="language-typescript"><code class="lang-typescript"><strong>import { context } from "@opentelemetry/api"
</strong>import { setPromptTemplate } from "@openinference-core"

context.with(
  setPromptTemplate(
    context.active(),
    { 
      template: "hello {{name}}",
      variables: { name: "world" },
      version: "v1.0"
    }
  ),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "llm.prompt_template.template" = "hello {{name}}"
      // "llm.prompt_template.version" = "v1.0"
      // "llm.prompt_template.variables" = '{ "name": "world" }'
  }
)
</code></pre>
{% endtab %}
{% endtabs %}
