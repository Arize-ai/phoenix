# Flowise Tracing

Analyzing and troubleshooting what happens under the hood can be challenging without proper insights. By integrating your Flowise application with Phoenix, you can monitor traces and gain robust observability into your chatflows and agentflows.

### Viewing Flowise traces in Phoenix

1. **Access Configurations:** Navigate to settings in your chatflow or agentflow and find configurations.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/flowise_config.gif" %}

2.  **Connect to Phoenix:** Go to the **Analyze Chatflow** tab and configure your application with Phoenix. Get your API key from your Phoenix instance to create your credentials. Be sure to name your project and confirm that the Phoenix toggle is enabled before saving.

    **Note**: If you are using using an environment that is not [Phoenix Cloud](https://arize.com/docs/phoenix/environments), you may need to modify the Endpoint field.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/flowise_config2.gif" %}

3. **View Traces:** In Phoenix, you will find your project under the Projects tab. Click into this to view and analyze traces as you test your application.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/flowise_traces.gif" %}

4. **Store and Experiment:** Optionally, you can also filter traces, store traces in a dataset to run experiments, analyze patterns, and optimize your workflows over time.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/flowise_traces2.gif" %}

You can also reference [Flowise documentation](https://docs.flowiseai.com/using-flowise/analytics/phoenix) here.
