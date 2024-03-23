# LangChain

Phoenix has first-class support for [LangChain](https://langchain.com/) applications.

To begin, you will have to start a Phoenix server. You can do this by running:

```python
import phoenix as px
session = px.launch_app()
```

Once you have started a Phoenix server,  You will instrument LangChain so that spans are created whenever you run a chain.

{% tabs %}
{% tab title="Python" %}
```python
from phoenix.trace.langchain import LangChainInstrumentor

# By default, the traces will be exported to the locally running Phoenix 
# server. If a different endpoint is desired, change the environment
# variable os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = ...
LangChainInstrumentor().instrument()

# Initialize your LangChain application

# Note that we do not have to pass in the tracer as a callback here
# since the above instrumented LangChain in it's entirety.
response = chain.run(query)
```
{% endtab %}
{% endtabs %}

By instrumenting LangChain, spans will be created whenevera a chain is run and will be sent to the Phoenix server for collection.

To view the traces in Phoenix, simply open the UI in your browser.

```python
px.active_session().url
```

For a fully working example of tracing with LangChain, checkout our colab notebook.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/langchain_tracing_tutorial.ipynb" %}
Troubleshooting an LLM application using the OpenInferenceTracer
{% endembed %}

