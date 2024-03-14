---
description: Evaluation model classes powering your LLM Evals
---

# Models

## Supported LLM Providers

We currently support the following LLM providers:

### phoenix.evals.OpenAIModel

{% hint style="info" %}
Need to install the extra dependencies `openai>=0.26.4` and `tiktoken`
{% endhint %}

```python
class OpenAIModel:
    api_key: Optional[str] = field(repr=False, default=None)
    """Your OpenAI key. If not provided, will be read from the environment variable"""
    organization: Optional[str] = field(repr=False, default=None)
    """
    The organization to use for the OpenAI API. If not provided, will default
    to what's configured in OpenAI
    """
    base_url: Optional[str] = field(repr=False, default=None)
    """
    An optional base URL to use for the OpenAI API. If not provided, will default
    to what's configured in OpenAI
    """
    model_name: str = "gpt-4"
    """Model name to use. In of azure, this is the deployment name such as gpt-35-instant"""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion.
    -1 returns as many tokens as possible given the prompt and
    the models maximal context size."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    frequency_penalty: float = 0
    """Penalizes repeated tokens according to frequency."""
    presence_penalty: float = 0
    """Penalizes repeated tokens."""
    n: int = 1
    """How many completions to generate for each prompt."""
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    """Holds any model parameters valid for `create` call not explicitly specified."""
    batch_size: int = 20
    """Batch size to use when passing multiple documents to generate."""
    request_timeout: Optional[Union[float, Tuple[float, float]]] = None
    """Timeout for requests to OpenAI completion API. Default is 600 seconds."""
    max_retries: int = 20
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""
```

To authenticate with OpenAI you will need, at a minimum, an API key. The model class will look for it in your environment, or you can pass it via argument as shown above. In addition, you can choose the specific name of the model you want to use and its configuration parameters. The default values specified above are common default values from OpenAI. Quickly instantiate your model as follows:

```python
model = OpenAI()
model("Hello there, this is a test if you are working?")
# Output: "Hello! I'm working perfectly. How can I assist you today?"
```

#### Azure OpenAI

The code snippet below shows how to initialize `OpenAIModel` for Azure. Refer to the Azure [docs](https://microsoftlearning.github.io/mslearn-openai/Instructions/Labs/02-natural-language-azure-openai.html) on how to obtain these value from your Azure deployment.

Here is an example of how to initialize `OpenAIModel` for Azure:

```python
model = OpenAIModel(
    model_name="gpt-35-turbo-16k",
    azure_endpoint="https://arize-internal-llm.openai.azure.com/",
    api_version="2023-09-15-preview",
)
```

{% hint style="info" %}
Note that the `model_name` param is actually the `engine` of your deployment.  You may get a `DeploymentNotFound` error if this parameter is not correct. You can find your engine param in the Azure OpenAI playground.\
\

{% endhint %}

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/azure_openai_engine.png" alt=""><figcaption><p>How to find the model param in Azure</p></figcaption></figure>

Azure OpenAI supports specific options:

```python
api_version: str = field(default=None)
"""
The verion of the API that is provisioned
https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#rest-api-versioning
"""
azure_endpoint: Optional[str] = field(default=None)
"""
The endpoint to use for azure openai. Available in the azure portal.
https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/create-resource?pivots=web-portal#create-a-resource
"""
azure_deployment: Optional[str] = field(default=None)
azure_ad_token: Optional[str] = field(default=None)
azure_ad_token_provider: Optional[Callable[[], str]] = field(default=None)

```

For full details on Azure OpenAI, check out the [OpenAI Documentation](https://github.com/openai/openai-python#microsoft-azure-openai)

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
model = VertexAIModel(project=project, location=location)
model("Hello there, this is a tesst if you are working?")
# Output: "Hello world, I am working!"
```

### phoenix.evals.AnthropicModel

```python
class AnthropicModel(BaseModel):
    model: str = "claude-2.1"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    top_k: int = 256
    """The cutoff where the model no longer selects the words."""
    stop_sequences: List[str] = field(default_factory=list)
    """If the model encounters a stop sequence, it stops generating further tokens."""
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    """Any extra parameters to add to the request body (e.g., countPenalty for a21 models)"""
    max_content_size: Optional[int] = None
    """If you're using a fine-tuned model, set this to the maximum content size"""
```

### phoenix.evals.BedrockModel

```python
class BedrockModel:
    model_id: str = "anthropic.claude-v2"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    top_k: int = 256
    """The cutoff where the model no longer selects the words"""
    stop_sequences: List[str] = field(default_factory=list)
    """If the model encounters a stop sequence, it stops generating further tokens. """
    max_retries: int = 6
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""
    client = None
    """The bedrock session client. If unset, a new one is created with boto3."""
    max_content_size: Optional[int] = None
    """If you're using a fine-tuned model, set this to the maximum content size"""
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    """Any extra parameters to add to the request body (e.g., countPenalty for a21 models)"""
```

To Authenticate, the following code is used to instantiate a session and the session is used with Phoenix Evals

```python
import boto3

# Create a Boto3 session
session = boto3.session.Session(
    aws_access_key_id='ACCESS_KEY',
    aws_secret_access_key='SECRET_KEY',
    region_name='us-east-1'  # change to your preferred AWS region
)
```

```python
#If you need to assume a role
# Creating an STS client
sts_client = session.client('sts')

# (optional - if needed) Assuming a role
response = sts_client.assume_role(
    RoleArn="arn:aws:iam::......",
    RoleSessionName="AssumeRoleSession1",
    #(optional) if MFA Required
    SerialNumber='arn:aws:iam::...',
    #Insert current token, needs to be run within x seconds of generation
    TokenCode='PERIODIC_TOKEN'
)

# Your temporary credentials will be available in the response dictionary
temporary_credentials = response['Credentials']

# Creating a new Boto3 session with the temporary credentials
assumed_role_session = boto3.Session(
    aws_access_key_id=temporary_credentials['AccessKeyId'],
    aws_secret_access_key=temporary_credentials['SecretAccessKey'],
    aws_session_token=temporary_credentials['SessionToken'],
    region_name='us-east-1'
)
```

```python
client_bedrock = assumed_role_session.client("bedrock-runtime")
# Arize Model Object - Bedrock ClaudV2 by default
model = BedrockModel(client=client_bedrock)

```

### phoenix.experimental.evals.LiteLLMModel

Need to install the extra dependency `litellm>=1.0.3`

```python
class LiteLLMModel(BaseEvalModel):
    model_name: str = "gpt-3.5-turbo"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    num_retries: int = 6
    """Maximum number to retry a model if an RateLimitError, OpenAIError, or
    ServiceUnavailableError occurs."""
    request_timeout: int = 60
    """Maximum number of seconds to wait when retrying."""
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    """Model specific params"""

    # non-LiteLLM params
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    max_content_size: Optional[int] = None
    """If you're using a fine-tuned model, set this to the maximum content size"""
```

You can choose among [multiple models](https://docs.litellm.ai/docs/providers) supported by LiteLLM. Make sure you have set the right environment variables set prior to initializing the model. For additional information about the environment variables for specific model providers visit: [LiteLLM provider specific params](https://docs.litellm.ai/docs/completion/input#provider-specific-params)

Here is an example of how to initialize `LiteLLMModel` for model "gpt-3.5-turbo":

```python
model = LiteLLMModel(model_name="gpt-3.5-turbo", temperature=0.0)
model("Hello world, this is a test if you are working?")
# Output: 'Hello! Yes, I am here and ready to assist you. How can I help you today?'
```

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

Furthermore, LLM models have a limited number of tokens that they can pay attention to. We call this limit the _context size_ or _context window_. You can access the context size of your model via the property `max_context_size`. In the following example, we used the model `gpt-4-0613` and the context size is

```python
print(model.max_context_size)
# Output: 8192
```
