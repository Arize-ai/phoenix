---
description: Configure and run MistralAI for evals
---

# MistralAI Evals

### MistralAIModel

{% hint style="info" %}
Need to install extra dependency `mistralai`
{% endhint %}

```python
class MistralAIModel(BaseModel):
    model: str = "mistral-large-latest"
    temperature: float = 0
    top_p: Optional[float] = None
    random_seed: Optional[int] = None
    response_format: Optional[Dict[str, str]] = None
    safe_mode: bool = False
    safe_prompt: bool = False
```

## **Usag**

```python
# model = Instantiate your MistralAIModel here
model("Hello there, how are you?")
# Output: "As an artificial intelligence, I don't have feelings, 
#          but I'm here and ready to assist you. How can I help you today?"
```
