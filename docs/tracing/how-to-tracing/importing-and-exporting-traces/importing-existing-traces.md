# Import Existing Traces

Phoenix supports loading data that contains [OpenInference traces](https://docs.arize.com/phoenix/references/openinference). This allows you to load an existing dataframe of traces into your Phoenix instance.

Usually these will be traces you've previously saved using [Save All Traces](https://docs.arize.com/phoenix/tracing/how-to-tracing/extract-data-from-spans#save-all-traces).

### Connect to Phoenix

Before accessing px.Client(), be sure you've set the following environment variables:

```python
import os

os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key=..."
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

If you're self-hosting Phoenix, ignore the client headers and change the collector endpoint to your endpoint.

### Importing Traces to an Existing Phoenix Instance

```python
import phoenix as px

# Re-launch the app using trace data
px.launch_app(trace=px.TraceDataset(df))

# Load traces into an existing Phoenix instance
px.Client().log_traces(trace_dataset=px.TraceDataset(df))

# Load traces into an existing Phoenix instance from a local file
px.launch_app(trace=px.TraceDataset.load('f7733fda-6ad6-4427-a803-55ad2182b662', directory="/my_saved_traces/"))
```

### Launching a new Phoenix Instance with Saved Traces

You can also launch a temporary version of Phoenix in your local notebook to quickly view the traces. But be warned, this Phoenix instance will only last as long as your notebook environment is runing

```python
# Load traces from a dataframe
px.launch_app(trace=px.TraceDataset.load(my_traces))

# Load traces from a local file
px.launch_app(trace=px.TraceDataset.load('f7733fda-6ad6-4427-a803-55ad2182b662', directory="/my_saved_traces/"))
```
