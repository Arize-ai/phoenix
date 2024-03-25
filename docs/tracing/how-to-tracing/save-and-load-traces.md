---
description: >-
  This guide shows how to manually save traces in Phoenix and load them back
  into Phoenix
---

# Save and Load Traces

## Saving Traces

First we need to save existing traces that exist in an instance of Phoenix

```
my_traces = px.Client().get_trace_dataset().save()
```

## Loading Traces

If we want to load the saved traces, when launch phoenix we can simply run the following

```
px.launch_app(trace=px.TraceDataset.load(tds_id))
```
