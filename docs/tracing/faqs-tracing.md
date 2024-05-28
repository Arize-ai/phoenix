---
description: Frequently Asked Questions
---

# FAQs: Tracing

## For OpenAI, how do I get token counts when streaming?

To get token counts when streaming, install `openai>=1.26` and set `stream_options={"include_usage": True}` when calling `create`. Below is an example Python code snippet. For more info, see [here](https://community.openai.com/t/usage-stats-now-available-when-using-streaming-with-the-chat-completions-api-or-completions-api/738156).

```python
response = openai.OpenAI().chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Write a haiku."}],
    max_tokens=20,
    stream=True,
    stream_options={"include_usage": True},
)
```
