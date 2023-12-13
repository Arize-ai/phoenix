# AutoGen Support

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/autogen_tutorial.ipynb" %}

AutoGen is a new agent framework from Microsoft that allows for complex Agent creation. It is unique in its ability to create multiple agents that work together.&#x20;

<figure><img src="../../.gitbook/assets/autogen_agentchat.png" alt=""><figcaption><p>AutoGen</p></figcaption></figure>

The AutoGen Agent framework allows creation of multiple agents and connection of those agents to work together to accomplish tasks.

```python
from phoenix.trace.tracer import Tracer
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor
from phoenix.trace.exporter import HttpExporter
from phoenix.trace.openai import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer

import phoenix as px
session = px.launch_app()
tracer = Tracer(exporter=HttpExporter())
OpenAIInstrumentor(tracer).instrument()

```

The Phoenix support is simple in its first incarnation but allows for capturing all of the prompt and responses that occur under the framework between each agent.&#x20;

<figure><img src="../../.gitbook/assets/auto_gen_phoenix.png" alt=""><figcaption><p>Agent Reply</p></figcaption></figure>

The individual prompt and responses are captured directly through OpenAI calls.&#x20;

{% hint style="info" %}
As callbacks are supported in AutoGen Phoenix will add more agent level information.&#x20;
{% endhint %}
