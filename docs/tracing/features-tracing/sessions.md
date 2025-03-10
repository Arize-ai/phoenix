---
description: Track and analyze multi-turn conversations
---

# Sessions

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/sessions.mp4" %}
Track multi-turn conversations with a chatbot or assistant using sessions
{% endembed %}



Sessions enable tracking and organizing related traces across multi-turn conversations with your AI application. When building conversational AI, maintaining context between interactions is critical - Sessions make this possible from an observability perspective.

With Sessions in Phoenix, you can:

* Track the entire history of a conversation in a single thread
* View conversations in a chatbot-like UI showing inputs and outputs of each turn
* Search through sessions to find specific interactions
* Track token usage and latency per conversation

This feature is particularly valuable for applications where context builds over time, like chatbots, virtual assistants, or any other multi-turn interaction. By tagging spans with a consistent session ID, you create a connected view that reveals how your application performs across an entire user journey.

## Next Steps

* Check out how to [setup-sessions.md](../how-to-tracing/setup-tracing/setup-sessions.md "mention")

