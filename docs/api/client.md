---
description: >-
  Descriptions of classes and methods related to Phoenix Client for
  extracting/downloading data from the Phoenix server (either local or remote).
---

# Client & Get Spans

* [Usage](client.md#usage)

## phoenix.Client

```python
class Client:
    def __init__(
        self,
        *,
        endpoint: Optional[str] = None,
        use_active_session_if_available: bool = True,
    ):
        ...
```

A client for making HTTP requests to the Phoenix server for extracting/downloading data. See [#usage](client.md#usage "mention")for examples.

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/29800e4ed4a901ad19874ba049638e13d8c67b87/src/phoenix/session/client.py#L22)**]**

### Parameters

* **endpoint** (Optional\[str]): Phoenix server endpoint. This is the URL for a remote server. If not provided, the endpoint will be inferred from environment variables. See [#environment-variables](client.md#environment-variables "mention").
* **use\_active\_session\_if\_available** (Optional\[bool]): This is set to False if **endpoint** is set explicitly. If True and `px.active_session()` is available in the same runtime environment, e.g. the same Jupyter notebook, then delegate the requests to the `Session` object instead of making an HTTP request to the Phoenix server.

### Methods

## _**get\_spans\_dataframe**_&#x20;

\-> Optional\[pandas.DataFrame]

```python
phoenix.Client(endpoint="http://127.0.0.1:6006").get_spans_dataframe()
```

Returns spans in a pandas.dataframe. Filters can be applied. See [LLM Traces](../concepts/llm-traces.md) for more about tracing your LLM application.\
\
**Parameters**

* **filter\_condition** (Optional\[str]): A Python expression for filtering spans. See [Usage](client.md#usage-3) below for examples.
* **start\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **stop\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **root\_spans\_only** (Optional\[bool]): Whether to return only root spans, i.e. spans without parents. Defaults to `False`.
* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.



## _**query\_spans**_&#x20;

\-> Optional\[Union\[pandas.DataFrame, List\[pandas.DataFrame]]\


Extract values from spans in a pandas.dataframe. See [extract-data-from-spans.md](../tracing/how-to-tracing/extract-data-from-spans.md "mention")for more details.\
\
**Parameters**

* **\*queries** (SpanQuery): One or more SpanQuery object. See [extract-data-from-spans.md](../tracing/how-to-tracing/extract-data-from-spans.md "mention")for more details.
* **start\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **stop\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **root\_spans\_only** (Optional\[bool]): Whether to return only root spans, i.e. spans without parents. Defaults to `False`.
* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.



## _**get\_evaluations**_&#x20;

\-> List\[Evaluations]

```python
px.Client(endpoint="http://127.0.0.1:6006").get_evaluations()
```

Extract evaluations if any. Otherwise returns empty List. See [llm-evaluations.md](../tracing/how-to-tracing/llm-evaluations.md "mention")for more details.\
\
**Parameters**

* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.



## _**get\_trace\_dataset**_&#x20;

\-> Optional\[TraceDataset]

```python
px.Client(endpoint="http://127.0.0.1:6006").get_trace_dataset()
```

Returns the trace dataset containing spans and evaluations.\
\
**Parameters**

* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.



## _**log\_evaluations**_&#x20;

\-> None\
\
Send evaluations to Phoenix. See [#logging-multiple-evaluation-dataframes](../tracing/how-to-tracing/llm-evaluations.md#logging-multiple-evaluation-dataframes "mention")for usage.\


**Parameters**

* **\*evaluations** (Evaluations): One or more Evaluations datasets. See [llm-evaluations.md](../tracing/how-to-tracing/llm-evaluations.md "mention")for more details.
* **project\_name** (Optional\[str]): The name of the project to send the evaluations for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.

### Usage

Get all spans from Phoenix as a pandas dataframe.

```
px.Client().get_spans_dataframe()
```

To extract/download spans from a remote server, set the endpoint argument to the remote URL. A remote server could be a Phoenix server instance running in the background on your machine, or one that's hosted on the internet. The endpoint can also be set via the `PHOENIX_COLLECTOR_ENDPOINT` environment variable.

```
px.Client(endpoint="http://remote.server.com").get_spans_dataframe()
```

Get spans associated with calls to LLMs.

<pre class="language-python"><code class="lang-python"><strong>px.Client().get_spans_dataframe("span_kind == 'LLM'")
</strong></code></pre>

Get spans associated with calls to retrievers in a Retrieval Augmented Generation use case.

<pre class="language-python"><code class="lang-python"><strong>px.Client().get_spans_dataframe("span_kind == 'RETRIEVER'")
</strong></code></pre>

### Environment Variables

Some settings of the Phoenix Client can be configured through the environment variables below.&#x20;

* `PHOENIX_COLLECTOR_ENDPOINT` The endpoint of the Phoenix collector.
  * This is usually the URL to a Phoenix server either hosted on the internet or running in the background on your machine.
* `PHOENIX_PORT` The port on which the server listens.
* `PHOENIX_HOST` The host on which the server listens.

Below is an example of how to set up the `port` parameter as an environment variable.

```
import os

os.environ["PHOENIX_PORT"] = "54321"
```
