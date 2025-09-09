---
description: Configure and run Gemini for evals
---

# Gemini Evals

### GeminiModel

```python
class GeminiModel:
    project: Optional[str] = None
    location: Optional[str] = None
    credentials: Optional["Credentials"] = None
    model: str = "gemini-2.5-flash"
    default_concurrency: int = 5
    temperature: float = 0.0
    max_tokens: int = 256
    top_p: float = 1
    top_k: int = 32
```

To authenticate with Gemini, you must pass either your credentials or a project, location pair. In the following example, we quickly instantiate the Gemini model as follows:

```python
project = "my-project-id"
location = "us-central1" # as an example
model = GeminiModel(project=project, location=location)
model("Hello there, this is a tesst if you are working?")
# Output: "Hello world, I am working!"
```
