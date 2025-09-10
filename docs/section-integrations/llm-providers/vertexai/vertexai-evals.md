---
description: Configure and run VertexAI for evals
---

# VertexAI Evals

### VertexAI

{% hint style="info" %}
Need to install the extra dependency`google-cloud-aiplatform>=1.33.0`
{% endhint %}

<pre class="language-python"><code class="lang-python">class VertexAIModel:
<strong>    project: Optional[str] = None
</strong>    location: Optional[str] = None
    credentials: Optional["Credentials"] = None
    model: str = "text-bison"
    tuned_model: Optional[str] = None
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
