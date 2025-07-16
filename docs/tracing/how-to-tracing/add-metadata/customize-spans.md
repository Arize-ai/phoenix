# Add Attributes, Metadata, Users

### Using context to customize spans <a href="#what-are-context-attributes" id="what-are-context-attributes"></a>

In order to customize spans that are created via [auto-instrumentation](broken-reference), The Otel Context can be used to set span attributes created during a block of code (think child spans or spans under that block of code). Our [`openinference`](https://github.com/Arize-ai/openinference/tree/main) packages offer convenient tools to write and read from the OTel Context. The benefit of this approach is that OpenInference auto [instrumentors](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will pass (e.g. inherit) these attributes to all spans underneath a parent trace.

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
{% tab title="Python" %}
Install the core instrumentation package:

```sh
pip install openinference-instrumentation
```
{% endtab %}

{% tab title="JS" %}
```bash
npm install --save @arizeai/openinference-core @opentelemetry/api
```
{% endtab %}
{% endtabs %}

### Specifying a session

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

{% tab title="JS" %}
We provide a `setSession` function which allows you to set a sessionId on context. You can use this utility in conjunction with [`context.with`](https://opentelemetry.io/docs/languages/js/context/#set-active-context) to set the active context. OpenInference [auto instrumentations](broken-reference) will then pick up these attributes and add them to any spans created within the `context.with` callback.

<pre class="language-typescript"><code class="lang-typescript"><strong>import { context } from "@opentelemetry/api"
</strong>import { setSession } from "@openinference-core"

context.with(
  setSession(context.active(), { sessionId: "session-id" }),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "session.id" = "session-id"
  }
)
</code></pre>
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

{% tab title="JS" %}
We provide a `setUser` function which allows you to set a userId on context. You can use this utility in conjunction with [`context.with`](https://opentelemetry.io/docs/languages/js/context/#set-active-context) to set the active context. OpenInference [auto instrumentations](broken-reference) will then pick up these attributes and add them to any spans created within the `context.with` callback.

```typescript
import { context } from "@opentelemetry/api"
import { setUser } from "@openinference-core"

context.with(
  setUser(context.active(), { userId: "user-id" }),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "user.id" = "user-id"
  }
)
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

{% tab title="JS" %}
We provide a `setMetadata` function which allows you to set a metadata attributes on context. You can use this utility in conjunction with [`context.with`](https://opentelemetry.io/docs/languages/js/context/#set-active-context) to set the active context. OpenInference [auto instrumentations](broken-reference) will then pick up these attributes and add them to any spans created within the `context.with` callback. Metadata attributes will be serialized to a JSON string when stored on context and will be propagated to spans in the same way.

```typescript
import { context } from "@opentelemetry/api"
import { setMetadata } from "@openinference-core"

context.with(
  setMetadata(context.active(), { key1: "value1", key2: "value2" }),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "metadata" = '{"key1": "value1", "key2": "value2"}'
  }
)
```
{% endtab %}
{% endtabs %}

### Specifying Tags

{% tabs %}
{% tab title="Python" %}
We provide a `using_tags` context manager to add tags to the current OpenTelemetry Context. OpenInference auto [instrumentators](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation) will read this Context and pass the tags as a span attribute, following the OpenInference [semantic conventions](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions). The input, the tag list, must be a list of strings.

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

{% tab title="JS" %}
We provide a `setTags` function which allows you to set a list of string tags on context. You can use this utility in conjunction with [`context.with`](https://opentelemetry.io/docs/languages/js/context/#set-active-context) to set the active context. OpenInference [auto instrumentations](broken-reference) will then pick up these attributes and add them to any spans created within the `context.with` callback. Tags, like metadata, will be serialized to a JSON string when stored on context and will be propagated to spans in the same way.

```typescript
import { context } from "@opentelemetry/api"
import { setTags } from "@openinference-core"

context.with(
  setTags(context.active(), ["value1", "value2"]),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "tag.tags" = '["value1", "value2"]'
  }
)
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

{% tab title="JS" %}
We provide a `setAttributes` function which allows you to add a set of attributes to context. You can use this utility in conjunction with [`context.with`](https://opentelemetry.io/docs/languages/js/context/#set-active-context) to set the active context. OpenInference [auto instrumentations](broken-reference) will then pick up these attributes and add them to any spans created within the `context.with` callback. Attributes set on context using `setAttributes` must be valid span [attribute values](https://opentelemetry.io/docs/specs/otel/common/#attribute).

<pre class="language-typescript"><code class="lang-typescript"><strong>import { context } from "@opentelemetry/api"
</strong>import { setAttributes } from "@openinference-core"

context.with(
  setAttributes(context.active(), { myAttribute: "test" }),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "myAttribute" = "test"
  }
)
</code></pre>

You can also use multiple setters at the same time to propagate multiple attributes to the span below. Since each setter function returns a new context, they can be used together as follows.

```typescript
import { context } from "@opentelemetry/api"
import { setAttributes } from "@openinference-core"

context.with(
  setAttributes(
    setSession(context.active(), { sessionId: "session-id"}),
    { myAttribute: "test" }
  ),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "myAttribute" = "test"
      // "session.id" = "session-id"
  }
)
```

You can also use `setAttributes` in conjunction with the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md) to set OpenInference attributes manually.

```typescript
import { context } from "@opentelemetry/api"
import { setAttributes } from "@openinference-core"
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";


context.with(
  setAttributes(
    { [SemanticConventions.SESSION_ID: "session-id" }
  ),
  () => {
      // Calls within this block will generate spans with the attributes:
      // "session.id" = "session-id"
  }
)
```
{% endtab %}
{% endtabs %}

### Span Processing

The tutorials and code snippets in these docs default to the `SimpleSpanProcessor.` A `SimpleSpanProcessor` processes and exports spans as they are created. This means that if you create 5 spans, each will be processed and exported before the next span is created in code. This can be helpful in scenarios where you do not want to risk losing a batch, or if you’re experimenting with OpenTelemetry in development. However, it also comes with potentially significant overhead, especially if spans are being exported over a network - each time a call to create a span is made, it would be processed and sent over a network before your app’s execution could continue.

The `BatchSpanProcessor` processes spans in batches before they are exported. This is usually the right processor to use for an application in production but it does mean spans may take some time to show up in Phoenix.

In production we recommend the `BatchSpanProcessor` over `SimpleSpanProcessor`\
when deployed and the `SimpleSpanProcessor` when developing.

#### BatchSpanProcessor Example - Using arize-phoenix-otel library

```python
from phoenix.otel import register

# configure the Phoenix tracer for batch processing
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  batch=True, # Default is 'False'
)
```

#### BatchSpanProcessor Example - Using OTel library

```python
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, BatchSpanProcessor

tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint)))
```
