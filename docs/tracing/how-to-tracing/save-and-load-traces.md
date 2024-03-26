---
description: >-
  This documentation outlines the procedure for manually saving and subsequently
  loading traces within Phoenix.
---

# Save and Load Traces

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

## Create Your Own Directory Example

Illustrated below is a method for saving traces to a specified directory.

### Create Directory and Save Traces

```notebook-python
import os

# Specify and Create the Directory for Trace Dataset
directory = '/my_saved_traces'
os.makedirs(directory, exist_ok=True)

# Save the Trace Dataset
my_traces = px.Client().get_trace_dataset().save(directory=directory)
```

The process yields an output consisting of the Trace ID and the storage path:

`💾 Trace dataset saved to under ID: f7733fda-6ad6-4427-a803-55ad2182b662`&#x20;

`📂 Trace dataset path: /my_saved_traces/trace_dataset-f7733fda-6ad6-4427-a803-55ad2182b662.parquet`

### Load from Created Directory

To access and load the previously saved trace dataset, load trace dataset using unique trace UUID and the specific directory path where the trace was stored.

```notebook-python
px.launch_app(trace=px.TraceDataset.load('f7733fda-6ad6-4427-a803-55ad2182b662', directory="/my_saved_traces/"))
```
