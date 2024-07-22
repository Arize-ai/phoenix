# Instrumenting Prompt Templates and Prompt Variables

By instrumenting the prompt template, using the Arize prompt playground becomes very easy to use. You don't need to deploy in order to see if prompt text or prompt variables changes have the intended effect. Instead, you can experiment with these changes in playground, to make sure the right changes are acceptable before deployment.

{% tabs %}
{% tab title="Python" %}
We provide a `using_prompt_template` context manager to add a prompt template (including its version and variables) to the current OpenTelemetry Context. OpenInference auto [instrumentators](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the prompt template fields as span attributes, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). Its inputs must be of the following type:

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
{% endtabs %}
