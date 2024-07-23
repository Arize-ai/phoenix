# Importing Existing Traces

Phoenix also supports loading data that contains [OpenInference traces](../../reference/open-inference.md). This allows you to load an existing dataframe of traces into your Phoenix instance.

{% tabs %}
{% tab title="From the App" %}
<pre class="language-python"><code class="lang-python"><strong># Re-launch the app using trace data
</strong>px.launch_app(trace=px.TraceDataset(df))

# Load traces into an existing Phoenix instance
px.Client().log_traces(trace_dataset=px.TraceDataset(df))
</code></pre>
{% endtab %}
{% endtabs %}
