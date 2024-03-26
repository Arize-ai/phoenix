---
description: >-
  This guide shows how to manually save traces in Phoenix and load them back
  into Phoenix
---

# Save and Load Traces

### Saving Traces

First we need to save existing traces that exist in an instance of Phoenix

```
my_traces = px.Client().get_trace_dataset().save()
```

### Loading Traces

If we want to load the saved traces, when launch phoenix we can simply run the following

```
px.launch_app(trace=px.TraceDataset.load(my_traces))
```

{% hint style="info" %}
Note the above will save to a default phoenix trace directory, to save in another directory, use the following example below
{% endhint %}

## Create Your Own Directory Example

If you want to save your traces somewhere custom run the following code:

```notebook-python
import os

# Specify and Create the Directory for Trace Dataset
directory = '/my_saved_traces'
os.makedirs(directory, exist_ok=True)

# Save the Trace Dataset
my_traces = px.Client().get_trace_dataset().save(directory=directory)
```

An example, of the above return should be the Trace ID and Path:

`💾 Trace dataset saved to under ID: f7733fda-6ad6-4427-a803-55ad2182b662`&#x20;

`📂 Trace dataset path: /my_saved_traces/trace_dataset-f7733fda-6ad6-4427-a803-55ad2182b662.parquet`

## Load from Created Directory

Continued example, to load the trace dataset we just saved. We will need the trace UUID and directory where the trace is saved

```notebook-python
px.launch_app(trace=px.TraceDataset.load('f7733fda-6ad6-4427-a803-55ad2182b662', directory="/my_saved_traces/"))
```
