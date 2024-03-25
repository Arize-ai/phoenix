---
description: >-
  This guide shows how to manually save traces in Phoenix and load them back
  into Phoenix
---

# Save and Load Traces

## Saving Traces

```
// # First we need to save existing traces in that exist in Phoenix
// my_traces = px.Client().get_trace_dataset().save()
```

## Loading Traces

```
// # If we want load the saved traces, when we launch phoenix, we can simply run the following:
// px.launch_app(trace=px.TraceDataset.load(tds_id))
```
