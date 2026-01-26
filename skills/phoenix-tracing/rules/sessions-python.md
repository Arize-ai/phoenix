# Phoenix Tracing: Sessions (Python)

**Track multi-turn conversations by grouping traces with session IDs.**

## Overview

Sessions group related traces within a project for:
- Multi-turn chatbot conversations
- User-specific tracking
- Debugging workflows

## Set Session ID

**Using `using_session()` (Recommended):**
```python
from openinference.instrumentation import using_session

with using_session(session_id="user_123_conv_456"):
    response = llm.invoke(prompt)  # All spans get session.id
```

**Using span attributes directly:**
```python
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace

span = trace.get_current_span()
span.set_attribute(SpanAttributes.SESSION_ID, session_id)

# Must still wrap child calls for propagation
with using_session(session_id):
    response = client.chat.completions.create(...)
```

## Best Practices

**Generate unique session IDs:**
```python
import uuid

session_id = str(uuid.uuid4())  # UUID
# Or: f"user_{user_id}_conv_{conversation_id}"
```

Good: `"user_123_conv_456"`, `str(uuid.uuid4())`
Bad: `"session_1"`, `"test"`, empty string

**Always use `using_session()` for propagation:**
```python
# ✅ Good: All child spans get session ID
with using_session(session_id):
    response = client.chat.completions.create(...)
    result = my_custom_function()

# ❌ Bad: Only parent span has session ID
span.set_attribute(SpanAttributes.SESSION_ID, session_id)
response = client.chat.completions.create(...)  # Missing!
```

## Use Cases

**Multi-turn chatbot:**
```python
import uuid
from openinference.instrumentation import using_session
from openai import OpenAI

session_id = str(uuid.uuid4())
messages = []

def send_message(user_input: str) -> str:
    messages.append({"role": "user", "content": user_input})

    with using_session(session_id):
        response = client.chat.completions.create(model="gpt-4", messages=messages)

    assistant_message = response.choices[0].message.content
    messages.append({"role": "assistant", "content": assistant_message})
    return assistant_message
```

**User-specific tracking:**
```python
def handle_user_request(user_id: str, query: str):
    session_id = f"user_{user_id}_{datetime.now().isoformat()}"
    with using_session(session_id):
        return process_query(query)
```

**Debugging:**
```python
with using_session("debug_session_123"):
    result = my_buggy_workflow()
```

## Additional Attributes

**Add user ID:**
```python
from openinference.instrumentation import using_attributes

with using_attributes(user_id="user_123", session_id="conv_456"):
    response = llm.invoke(prompt)
```

**Add custom metadata:**
```python
with using_attributes(
    session_id="conv_456",
    metadata={"user_tier": "premium", "region": "us-west"}
):
    response = llm.invoke(prompt)
```




## LangChain Integration

LangChain threads are recognized as sessions:
```python
from langchain.chat_models import ChatOpenAI

response = llm.invoke(
    [HumanMessage(content="Hi!")],
    config={"metadata": {"thread_id": "user_123_thread"}}
)
```

Phoenix recognizes: `thread_id`, `session_id`, `conversation_id`
