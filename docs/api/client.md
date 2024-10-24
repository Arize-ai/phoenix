---
description: >-
  API reference for phoenix.Client, which helps you upload and download data to
  and from local or remote Phoenix servers
---

# Client

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

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/client.py)**]**

### Parameters

* **endpoint** (Optional\[str]): Phoenix server endpoint. This is the URL for a remote server. If not provided, the endpoint will be inferred from environment variables. This endpoint should just be a base url, without a `v1/traces` url slug. See [#environment-variables](client.md#environment-variables "mention").
* **use\_active\_session\_if\_available** (Optional\[bool]): This is set to False if **endpoint** is set explicitly. If True and `px.active_session()` is available in the same runtime environment, e.g. the same Jupyter notebook, then delegate the requests to the `Session` object instead of making an HTTP request to the Phoenix server.

### Methods

## _**get\_spans\_dataframe**_

\-> Optional\[pandas.DataFrame]

```python
px.Client(endpoint="http://127.0.0.1:6006").get_spans_dataframe()
```

Returns spans in a pandas.dataframe. Filters can be applied. See [LLM Traces](../tracing/llm-traces.md) for more about tracing your LLM application.\
\
**Parameters**

* **filter\_condition** (Optional\[str]): A Python expression for filtering spans. See [Usage](client.md#usage) below for examples.
* **start\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **end\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **root\_spans\_only** (Optional\[bool]): Whether to return only root spans, i.e. spans without parents. Defaults to `False`.
* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.

## _**query\_spans**_

\-> Optional\[Union\[pandas.DataFrame, List\[pandas.DataFrame]]\
\
Extract values from spans in a pandas.dataframe. See [extract-data-from-spans.md](../tracing/how-to-tracing/extract-data-from-spans.md "mention")for more details.\
\
**Parameters**

* **\*queries** (SpanQuery): One or more SpanQuery object. See [extract-data-from-spans.md](../tracing/how-to-tracing/extract-data-from-spans.md "mention")for more details.
* **start\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **end\_time** (Optional\[datetime]): A Python datetime object for filtering spans by time.
* **root\_spans\_only** (Optional\[bool]): Whether to return only root spans, i.e. spans without parents. Defaults to `False`.
* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.

## _**get\_evaluations**_

\-> List\[Evaluations]

```python
px.Client(endpoint="http://127.0.0.1:6006").get_evaluations()
```

Extract evaluations if any. Otherwise returns empty List. See [llm-evaluations.md](../tracing/how-to-tracing/llm-evaluations.md "mention")for more details.\
\
**Parameters**

* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.

## _**get\_trace\_dataset**_

\-> Optional\[TraceDataset]

```python
px.Client(endpoint="http://127.0.0.1:6006").get_trace_dataset()
```

Returns the trace dataset containing spans and evaluations.\
\
**Parameters**

* **project\_name** (Optional\[str]): The name of the project to retrieve spans for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.

## _**log\_evaluations**_

\-> None\
\
Send evaluations to Phoenix. See [#logging-multiple-evaluation-dataframes](../tracing/how-to-tracing/llm-evaluations.md#logging-multiple-evaluation-dataframes "mention")for usage.\
\
**Parameters**

* **\*evaluations** (Evaluations): A collection of Evaluations. See [llm-evaluations.md](../tracing/how-to-tracing/llm-evaluations.md "mention")for more details.
* **project\_name** (Optional\[str]): The name of the project to send the evaluations for. It can also be specified via an environment variable, or if left blank, defaults to the default project name.

## _**get\_dataset\_versions**_

\-> pandas.DataFrame\
\
Get dataset versions as pandas DataFrame.\
\
**Parameters**

* **dataset\_id** (str): Dataset ID.
* **limit** (Optional\[int]): maximum number of versions to return, starting from the most recent version.

## _**upload\_dataset**_

\-> Dataset\
\
Upload a dataset to Phoenix. See [Usage](client.md#usage) below for examples. It can upload a pandas dataframe, a CSV text file, or a series of dictionary objects, and only one of these options should be specified.\
\
**Parameters**

* **dataset\_name** (str): The name of the dataset.
* **dataset\_description**: (Optional\[str]): Description of the dataset.
* **dataframe** (Optional\[pandas.DataFrame]): pandas DataFrame.
* **csv\_file\_path** (Optional\[str | Path]): Location of the CSV file.
* **input\_keys** (Optional\[Iterable\[str]): When uploading a dataframe or CSV file, this specifies the list of column names for inputs. Column names must actually exist among the column headers of the dataframe or CSV file.
* **output\_keys** (Optional\[Iterable\[str]): When uploading a dataframe or CSV file, this specifies the list of column names for outputs. Column names must actually exist among the column headers of the dataframe or CSV file.
* **metadata\_keys** (Optional\[Iterable\[str]): When uploading a dataframe or CSV file, this specifies the list of column names for metadata. Column names must actually exist among the column headers of the dataframe or CSV file.
* **inputs** (Iterable\[Mapping\[str, Any]]): When uploading a series of dictionary objects, this specifies the list of dictionaries object for inputs.
* **outputs** (Iterable\[Mapping\[str, Any]]): When uploading a series of dictionary objects, this specifies the list of dictionaries object for inputs.
* **metadata** (Iterable\[Mapping\[str, Any]]): When uploading a series of dictionary objects, this specifies the list of dictionaries object for inputs.

## _**append\_dataset**_

\-> Dataset\
\
Method signature is identical to that of the _upload\_dataset_ method. If dataset doesn't already exist on the Phoenix server, it will be created.

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

#### Upload Dataset

Upload a dataframe.

```python
df = pd.DataFrame({"Q": ["1+1", "2+2", "3+3"], "A": [2, 4, 6]})
dataset = px.Client().upload_dataset(
    dataframe=df,
    input_keys=["Q"],
    output_keys=["A"],
    dataset_name="my dataset",
)
```

Or upload a series of dictionary objects.

```python
dataset = px.Client().upload_dataset(
  inputs=[{"Q": "1+1"}, {"Q": "2+2"}, {"Q": "3+3"}],
  outputs=[{"A": 2}, {"A": 4}, {"A": 6}],
  dataset_name="my dataset",
)
```

Each item in the `Dataset` is called an `Example`, and you can look at the first `Example` via subscripting, as shown below.

```python
dataset[0]
```

### Environment Variables

Some settings of the Phoenix Client can be configured through the environment variables below.

* `PHOENIX_COLLECTOR_ENDPOINT` The endpoint of the Phoenix collector.
  * This is usually the URL to a Phoenix server either hosted on the internet or running in the background on your machine.
* `PHOENIX_PORT` The port on which the server listens.
* `PHOENIX_HOST` The host on which the server listens.

Below is an example of how to set up the `port` parameter as an environment variable.

```
import os

os.environ["PHOENIX_PORT"] = "54321"
```
