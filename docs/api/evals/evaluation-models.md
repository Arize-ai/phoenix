---
description: Evaluation model classes powering your LLM Evals
---

# Evaluation Models

## Supported LLM Providers

We currently support the following LLM providers:

### phoenix.experimental.evals.OpenAIModel

{% hint style="info" %}
Need to install the extra dependencies `openai>=0.26.4` and `tiktoken`
{% endhint %}

```python
class OpenAIModel:
    openai_api_key: Optional[str] = None
    openai_api_base: Optional[str] = None
    openai_organization: Optional[str] = None
    model_name: str = "gpt-4"
    temperature: float = 0.0
    max_tokens: int = 256
    top_p: float = 1
    frequency_penalty: float = 0
    presence_penalty: float = 0
    n: int = 1
    model_kwargs: Dict[str, Any] = {}
    batch_size: int = 20
    request_timeout: Optional[Union[float, Tuple[float, float]]] = None
    max_retries: int = 6
    retry_min_seconds: int = 10
    retry_max_seconds: int = 60
```

To authenticate with OpenAI you will need, at a minimum, an API key. Our classes will look for it in your environment, or you can pass it via argument as shown above. In addition, you can choose the specific name of the model you want to use and its configuration parameters. The default values specified above are common default values from OpenAI. Quickly instantiate your model as follows:

```python
model = OpenAI()
model("Hello there, this is a tesst if you are working?")
# Output: "Hello! I'm working perfectly. How can I assist you today?"
```

Find more about the functionality available in our EvalModels in the [#usage](evaluation-models.md#usage "mention") section.

### phoenix.experimental.evals.VertexAI

{% hint style="info" %}
Need to install the extra dependency`google-cloud-aiplatform>=1.33.0`
{% endhint %}

<pre class="language-python"><code class="lang-python">class VertexAIModel:
<strong>    project: Optional[str] = None
</strong>    location: Optional[str] = None
    credentials: Optional["Credentials"] = None
    model_name: str = "text-bison"
    tuned_model_name: Optional[str] = None
    max_retries: int = 6
    retry_min_seconds: int = 10
    retry_max_seconds: int = 60
    temperature: float = 0.0
    max_tokens: int = 256
    top_p: float = 0.95
    top_k: int = 40
</code></pre>

To authenticate with VertexAI, you must pass either your credentials or a project, location pair. In the following example, we quickly instantiate the VertexAI model as follows:

```python
project = "my-project-id"
location = "us-central1" # as an example
model = VertexAI(project=project, location=location)
model("Hello there, this is a tesst if you are working?")
# Output: "Hello world, I am working!"
```

Find more about the functionality available in our EvalModels in the [#usage](evaluation-models.md#usage "mention") section.

## **Usage**

In this section, we will showcase the methods and properties that our `EvalModels` have. First, instantiate your model from the[#supported-llm-providers](evaluation-models.md#supported-llm-providers "mention"). Once you've instantiated your `model`, you can get responses from the LLM by simply calling the model and passing a text string.

<pre class="language-python"><code class="lang-python"><strong># model = Instantiate your model here
</strong>model("Hello there, how are you?")
# Output: "As an artificial intelligence, I don't have feelings, 
#          but I'm here and ready to assist you. How can I help you today?"
</code></pre>

### `model.generate`

If you want to run multiple prompts through the LLM, you can do so via the `generate` method

<pre class="language-python"><code class="lang-python">responses = model.generate(
    [
        "Hello there, how are you?",
        "What is the typical weather in the Mediterranean",
        "Thank you for helping out, good bye!"
    ]
)
print(responses)
<strong># Output: [
</strong><strong>#     "As an artificial intelligence, I don't have feelings, but I'm here and ready 
</strong><strong>#         to assist you. How can I help you today?",
</strong>#     "The Mediterranean region is known for its hot, dry summers and mild, wet 
#         winters. This climate is characterized by warm temperatures throughout the
#         year, with the highest temperatures usually occurring in July and August. 
#         Rainfall is scarce during the summer months but more frequent during the 
#         winter months. The region also experiences a lot of sunshine, with some 
#         areas receiving about 300 sunny days per year.",
#     "You're welcome! Don't hesitate to reach out if you need anything else. 
#         Goodbye!"
#    ]
</code></pre>

### `model.agenerate`

In addition, you can also run multiple prompts through the LLM asynchronously via the `agenerate` method

```python
responses = await model.agenerate(
    [
        "Hello there, how are you?",
        "What is the typical weather in the Mediterranean",
        "Thank you for helping out, good bye!"
    ]
)
print(responses)
# Output: [
#     "As an artificial intelligence, I don't have feelings, but I'm here and ready 
#         to assist you. How can I help you today?",
#     "The Mediterranean region is known for its hot, dry summers and mild, wet 
#         winters. This climate is characterized by warm temperatures throughout the
#         year, with the highest temperatures usually occurring in July and August. 
#         Rainfall is scarce during the summer months but more frequent during the 
#         winter months. The region also experiences a lot of sunshine, with some 
#         areas receiving about 300 sunny days per year.",
#     "You're welcome! Don't hesitate to reach out if you need anything else. 
#         Goodbye!"
#    ]
```

Our EvalModels also contain some methods that can help create evaluation applications:

### `model.get_tokens_from_text`

```python
tokens = model.get_tokens_from_text("My favorite season is summer")
print(tokens)
# Output: [5159, 7075, 3280, 374, 7474]
```

### `model.get_text_from_tokens`

```python
text = model.get_text_from_tokens(tokens)
print(text)
# Output: "My favorite season is summer"
```

### `model.max_context_size`

Furthermore, LLM models have a limited number of tokens that they can pay attention to. We call this limit the _context size_ or _context window_. You can access the context size of your model via the  property `max_context_size`. In the following example, we used the model `gpt-4-0613` and the context size is

```python
print(model.max_context_size)
# Output: 8192
```
