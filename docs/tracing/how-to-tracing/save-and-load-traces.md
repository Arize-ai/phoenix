---
description: How to manually save and load traces
---

# Save and Load Traces

In addition to persisting to a database, Phoenix allows you to save and load your trace data to and from external files.

### Connect to Phoenix

Before accessing px.Client(), be sure you've set the following environment variables:

```python
import os

os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key=..."
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

If you're self-hosting Phoenix, ignore the client headers and change the collector endpoint to your endpoint.

### Saving Traces

The initial step involves saving the traces present in a Phoenix instance to a designated location.

```
my_traces = px.Client().get_trace_dataset().save()
```

### Loading Traces

To facilitate the retrieval of these saved traces, one can execute the prescribed commands upon starting Phoenix.

```
px.launch_app(trace=px.TraceDataset.load(my_traces))
```

{% hint style="info" %}
Note the above will save to a default phoenix trace directory, to save in another directory, use the following example below.
{% endhint %}

### Saving Traces to a Specific Directory

You can specify the directory to save your traces by passing a`directory` argument to the `save` method.

```notebook-python
import os

# Specify and Create the Directory for Trace Dataset
directory = '/my_saved_traces'
os.makedirs(directory, exist_ok=True)

# Save the Trace Dataset
trace_id = px.Client().get_trace_dataset().save(directory=directory)
```

This output the trace ID and prints the path of the saved file:

`💾 Trace dataset saved to under ID: f7733fda-6ad6-4427-a803-55ad2182b662`

`📂 Trace dataset path: /my_saved_traces/trace_dataset-f7733fda-6ad6-4427-a803-55ad2182b662.parquet`

### Loading Traces from a Specific Directory

To load the previously saved trace dataset, use the trace ID and the specific directory path where the trace was stored.

```notebook-python
px.launch_app(trace=px.TraceDataset.load('f7733fda-6ad6-4427-a803-55ad2182b662', directory="/my_saved_traces/"))
```
