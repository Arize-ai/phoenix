# Masking Span Attributes

In some situations, you may need to modify the observability level of your tracing. For instance, you may want to keep sensitive information from being logged for security reasons, or you may want to limit the size of the base64 encoded images logged to reduced payload size.

The OpenInference Specification defines a set of environment variables you can configure to suit your observability needs. In addition, the OpenInference auto-instrumentors accept a trace config which allows you to set these value in code without having to set environment variables, if that's what you prefer

The possible settings are:

<table data-full-width="false"><thead><tr><th width="298">Environment Variable Name</th><th width="281">Effect</th><th width="86">Type</th><th>Default</th></tr></thead><tbody><tr><td>OPENINFERENCE_HIDE_INPUTS</td><td>Hides input value, all input messages &#x26; embedding input text</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_OUTPUTS</td><td>Hides output value &#x26; all output messages</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_INPUT_MESSAGES</td><td>Hides all input messages &#x26; embedding input text</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_OUTPUT_MESSAGES</td><td>Hides all output messages</td><td>bool</td><td>False</td></tr><tr><td>PENINFERENCE_HIDE_INPUT_IMAGES</td><td>Hides images from input messages</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_INPUT_TEXT</td><td>Hides text from input messages &#x26; input embeddings</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_OUTPUT_TEXT</td><td>Hides text from output messages</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_EMBEDDING_VECTORS</td><td>Hides returned embedding vectors</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_LLM_INVOCATION_PARAMETERS</td><td>Hides LLM invocation parameters</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_HIDE_LLM_PROMPTS</td><td>Hides LLM prompts span attributes</td><td>bool</td><td>False</td></tr><tr><td>OPENINFERENCE_BASE64_IMAGE_MAX_LENGTH</td><td>Limits characters of a base64 encoding of an image</td><td>int</td><td>32,000</td></tr></tbody></table>

To set up this configuration you can either:

* Set environment variables as specified above
* Define the configuration in code as shown below
* Do nothing and fall back to the default values
* Use a combination of the three, the order of precedence is:
  * Values set in the `TraceConfig` in code
  * Environment variables
  * default values

Below is an example of how to set these values in code using our OpenAI Python and JavaScript instrumentors, however, the config is respected by all of our auto-instrumentors.

{% tabs %}
{% tab title="Python" %}
```python
from openinference.instrumentation import TraceConfig
config = TraceConfig(        
    hide_inputs=...,
    hide_outputs=...,
    hide_input_messages=...,
    hide_output_messages=...,
    hide_input_images=...,
    hide_input_text=...,
    hide_output_text=...,
    hide_embedding_vectors=...,
    hide_llm_invocation_parameters=...,
    hide_llm_prompts=...,
    base64_image_max_length=...,
)

from openinference.instrumentation.openai import OpenAIInstrumentor
OpenAIInstrumentor().instrument(
    tracer_provider=tracer_provider,
    config=config,
)
```
{% endtab %}

{% tab title="JS" %}
```typescript
/**
 * Everything left out of here will fallback to
 * environment variables then defaults
 */
const traceConfig = { hideInputs: true } 

const instrumentation = new OpenAIInstrumentation({ traceConfig })
```
{% endtab %}
{% endtabs %}

