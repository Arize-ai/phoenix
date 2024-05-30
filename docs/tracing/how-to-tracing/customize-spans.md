# Customize Spans

### Using context to customize spans <a href="#what-are-context-attributes" id="what-are-context-attributes"></a>

In order to customize spans that are created via [auto-instrumentation](instrumentation/), The Otel Context can be used to set span attributes created during a block of code (think child spans or spans under that block of code). Our [`openinference`](https://github.com/Arize-ai/openinference/tree/main) packages offer convenient tools to write and read from the OTel Context. The benefit of this approach is that OpenInference auto [instrumentors](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will pass (e.g. inherit) these attributes to all spans underneath a parent trace.

Supported Context Attributes include:

* **Session ID\*** Unique identifier for a session
* **User ID\*** Unique identifier for a user.
* **Metadata** Metadata associated with a span.
* **Tags\*** List of tags to give the span a category.
* **Prompt Template**
  * **Template** Used to generate prompts as Python f-strings.
  * **Version** The version of the prompt template.
  * **Variables** key-value pairs applied to the prompt template.

{% hint style="info" %}
\*UI support for session, user, and metadata is coming soon in an upcoming phoenix release ([https://github.com/Arize-ai/phoenix/issues/2619](https://github.com/Arize-ai/phoenix/issues/2619))
{% endhint %}

### Install Core Instrumentation Package

{% tabs %}
{% tab title="undefined" %}
Install the core instrumentation package:

```sh
pip install openinference-instrumentation
```
{% endtab %}
{% endtabs %}

### Specifying a session

{% hint style="warning" %}
Sessions are not currently supported in Phoenix and only supported via the Arize OTel collector ([https://docs.arize.com/phoenix/api/session](https://docs.arize.com/phoenix/api/session))
{% endhint %}

{% tabs %}
{% tab title="Python" %}
We provide a `using_session` context manager to add session a ID to the current OpenTelemetry Context. OpenInference auto [instrumentators](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the session ID as a span attribute, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). Its input, the session ID, must be a non-empty string.

```python
from openinference.instrumentation import using_session

with using_session(session_id="my-session-id"):
    # Calls within this block will generate spans with the attributes:
    # "session.id" = "my-session-id"
    ...
```

It can also be used as a decorator:

```python
@using_session(session_id="my-session-id")
def call_fn(*args, **kwargs):
    # Calls within this function will generate spans with the attributes:
    # "session.id" = "my-session-id"
    ...
```
{% endtab %}
{% endtabs %}

### Specifying users <a href="#using_user" id="using_user"></a>

{% tabs %}
{% tab title="Python" %}
We provide a `using_user` context manager to add user ID to the current OpenTelemetry Context. OpenInference auto [instrumentators](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the user ID as a span attribute, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). Its input, the user ID, must be a non-empty string.

```python
from openinference.instrumentation import using_user
with using_user("my-user-id"):
    # Calls within this block will generate spans with the attributes:
    # "user.id" = "my-user-id"
    ...
```

It can also be used as a decorator:

```python
@using_user("my-user-id")
def call_fn(*args, **kwargs):
    # Calls within this function will generate spans with the attributes:
    # "user.id" = "my-user-id"
    ...
```
{% endtab %}
{% endtabs %}

### Specifying Metadata <a href="#using_metadata" id="using_metadata"></a>

{% tabs %}
{% tab title="Python" %}
We provide a `using_metadata` context manager to add metadata to the current OpenTelemetry Context. OpenInference auto [instrumentators](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the metadata as a span attribute, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). Its input, the metadata, must be a dictionary with string keys. This dictionary will be serialized to JSON when saved to the OTEL Context and remain a JSON string when sent as a span attribute.

```python
from openinference.instrumentation import using_metadata
metadata = {
    "key-1": value_1,
    "key-2": value_2,
    ...
}
with using_metadata(metadata):
    # Calls within this block will generate spans with the attributes:
    # "metadata" = "{\"key-1\": value_1, \"key-2\": value_2, ... }" # JSON serialized
    ...
```

It can also be used as a decorator:

```python
@using_metadata(metadata)
def call_fn(*args, **kwargs):
    # Calls within this function will generate spans with the attributes:
    # "metadata" = "{\"key-1\": value_1, \"key-2\": value_2, ... }" # JSON serialized
    ...
```
{% endtab %}
{% endtabs %}

### Specifying Tags

{% tabs %}
{% tab title="Python" %}
We provide a `using_tags` context manager to add tags to the current OpenTelemetry Context. OpenInference auto [instrumentators](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the tags as a span attribute, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). ts input, the tag list, must be a list of strings.

```python
from openinference.instrumentation import using_tags
tags = ["tag_1", "tag_2", ...]
with using_tags(tags):
    # Calls within this block will generate spans with the attributes:
    # "tag.tags" = "["tag_1","tag_2",...]"
    ...
```

It can also be used as a decorator:

```python
@using_tags(tags)
def call_fn(*args, **kwargs):
    # Calls within this function will generate spans with the attributes:
    # "tag.tags" = "["tag_1","tag_2",...]"
    ...
```
{% endtab %}
{% endtabs %}

### Specifying the Prompt Template

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
    version=prompt_template_variables,
    variables="v1.0",
    ):
    # Calls within this block will generate spans with the attributes:
    # "llm.prompt_template.template" = "Please describe the weather forecast for {city} on {date}"
    # "llm.prompt_template.version" = "v1.0"
    # "llm.prompt_template.variables" = "{\"city\": \"Johannesburg\", \"date\": \"July 11\"}" # JSON serialized
    ...
```

It can also be used as a decorator:

```
@using_prompt_template(
    template=prompt_template,
    version=prompt_template_variables,
    variables="v1.0",
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

### Customizing Attributes <a href="#using_attributes" id="using_attributes"></a>

{% tabs %}
{% tab title="Python" %}
We provide a `using_attributes` context manager to add attributes to the current OpenTelemetry Context. OpenInference auto [instrumentators](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the attributes fields as span attributes, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). This is a convenient context manager to use if you find yourself using many of the previous ones in conjunction.

```python
from openinference.instrumentation import using_attributes
tags = ["tag_1", "tag_2", ...]
metadata = {
    "key-1": value_1,
    "key-2": value_2,
    ...
}
prompt_template = "Please describe the weather forecast for {city} on {date}"
prompt_template_variables = {"city": "Johannesburg", "date":"July 11"}
prompt_template_version = "v1.0"
with using_attributes(
    session_id="my-session-id",
    user_id="my-user-id",
    metadata=metadata,
    tags=tags,
    prompt_template=prompt_template,
    prompt_template_version=prompt_template_version,
    prompt_template_variables=prompt_template_variables,
):
    # Calls within this block will generate spans with the attributes:
    # "session.id" = "my-session-id"
    # "user.id" = "my-user-id"
    # "metadata" = "{\"key-1\": value_1, \"key-2\": value_2, ... }" # JSON serialized
    # "tag.tags" = "["tag_1","tag_2",...]"
    # "llm.prompt_template.template" = "Please describe the weather forecast for {city} on {date}"
    # "llm.prompt_template.variables" = "{\"city\": \"Johannesburg\", \"date\": \"July 11\"}" # JSON serialized
    # "llm.prompt_template.version " = "v1.0"
    ...
```

The previous example is equivalent to doing the following, making `using_attributes` a very convenient tool for the more complex settings.

```python
with (
    using_session("my-session-id"),
    using_user("my-user-id"),
    using_metadata(metadata),
    using_tags(tags),
    using_prompt_template(
        template=prompt_template,
        version=prompt_template_version,
        variables=prompt_template_variables,
    ),
):
    # Calls within this block will generate spans with the attributes:
    # "session.id" = "my-session-id"
    # "user.id" = "my-user-id"
    # "metadata" = "{\"key-1\": value_1, \"key-2\": value_2, ... }" # JSON serialized
    # "tag.tags" = "["tag_1","tag_2",...]"
    # "llm.prompt_template.template" = "Please describe the weather forecast for {city} on {date}"
    # "llm.prompt_template.variables" = "{\"city\": \"Johannesburg\", \"date\": \"July 11\"}" # JSON serialized
    # "llm.prompt_template.version " = "v1.0"
    ...
```

It can also be used as a decorator:

```python
@using_attributes(
    session_id="my-session-id",
    user_id="my-user-id",
    metadata=metadata,
    tags=tags,
    prompt_template=prompt_template,
    prompt_template_version=prompt_template_version,
    prompt_template_variables=prompt_template_variables,
)
def call_fn(*args, **kwargs):
    # Calls within this function will generate spans with the attributes:
    # "session.id" = "my-session-id"
    # "user.id" = "my-user-id"
    # "metadata" = "{\"key-1\": value_1, \"key-2\": value_2, ... }" # JSON serialized
    # "tag.tags" = "["tag_1","tag_2",...]"
    # "llm.prompt_template.template" = "Please describe the weather forecast for {city} on {date}"
    # "llm.prompt_template.variables" = "{\"city\": \"Johannesburg\", \"date\": \"July 11\"}" # JSON serialized
    # "llm.prompt_template.version " = "v1.0"
    ...
```
{% endtab %}
{% endtabs %}



