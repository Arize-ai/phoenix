# Environments

The Phoenix app can be run in various environments such as Colab and SageMaker notebooks, as well as be served via the terminal or a docker container.

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td><strong>Phoenix Cloud</strong></td><td>Connect to a pre-configured, managed Phoenix instance</td><td><a href="https://app.phoenix.arize.com/login">https://app.phoenix.arize.com/login</a></td><td><a href=".gitbook/assets/Screenshot 2024-10-09 at 6.32.50 PM.png">Screenshot 2024-10-09 at 6.32.50 PM.png</a></td></tr><tr><td><strong>As a Container</strong></td><td>Self-host your own Phoenix</td><td><a href="https://arize.com/docs/phoenix/self-hosting">https://arize.com/docs/phoenix/self-hosting</a></td><td><a href=".gitbook/assets/docker.png">docker.png</a></td></tr><tr><td><strong>In a Notebook</strong></td><td>Run Phoenix in the notebook as you run experiments</td><td><a href="environments.md#notebooks">#notebooks</a></td><td><a href=".gitbook/assets/notebook.png">notebook.png</a></td></tr><tr><td><strong>From the Terminal</strong></td><td>Run Phoenix via the CLI on your local machine</td><td><a href="environments.md#terminal">#terminal</a></td><td><a href=".gitbook/assets/terminal.png">terminal.png</a></td></tr></tbody></table>

{% hint style="success" %}
If you are set up, see [Quickstarts](quickstart.md) to start using Phoenix in your preferred environment.
{% endhint %}

### Phoenix Cloud

[Phoenix Cloud](https://app.phoenix.arize.com/) provides free-to-use Phoenix instances that are preconfigured for you with 10GBs of storage space. Phoenix Cloud instances are a great starting point, however if you need more storage or more control over your instance, self-hosting options could be a better fit.

If you're using Phoenix Cloud, be sure to set the proper environment variables to connect to your instance:

```python
import os

# Add Phoenix API Key for tracing
os.environ["PHOENIX_API_KEY"] = "ADD YOUR PHOENIX API KEY"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "ADD YOUR PHOENIX HOSTNAME"

# If you created your Phoenix Cloud instance before June 24th, 2025,
# you also need to set the API key as a header
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={os.getenv('PHOENIX_API_KEY')}"
```

### Container

See [Self-Hosting](https://arize.com/docs/phoenix/self-hosting).

### Notebooks

To start phoenix in a notebook environment, run:

```python
import phoenix as px

session = px.launch_app()
```

This will start a local Phoenix server. You can initialize the phoenix server with various kinds of data (traces, inferences).

{% hint style="info" %}
By default, Phoenix does not persist your data when run in a notebook.
{% endhint %}

### Terminal

If you want to start a phoenix server to collect traces, you can also run phoenix directly from the command line:

```sh
phoenix serve
```

This will start the phoenix server on port 6006. If you are running your instrumented notebook or application on the same machine, traces should automatically be exported to `http://127.0.0.1:6006` so no additional configuration is needed. However if the server is running remotely, you will have to modify the environment variable `PHOENIX_COLLECTOR_ENDPOINT` to point to that machine (e.g. `http://<my-remote-machine>:<port>`)
