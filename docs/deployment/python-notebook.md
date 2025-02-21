# Python notebook

Within any Jupyter notebook, you can run a temporary version of Phoenix directly in your notebook.

Install Phoenix using:

```bash
pip install arize-phoenix
```

Within your notebook, launch Phoenix using:

```python
import phoenix as px
px.launch_app().view()
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [Persistence](https://docs.arize.com/phoenix/deployment/persistence) or use one of the other deployment options to retain traces.
{% endhint %}

<figure><img src="../.gitbook/assets/Screenshot 2025-02-13 at 13.22@2x.png" alt=""><figcaption></figcaption></figure>

### Connect your app to Phoenix

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix. The `register` utility from the `phoenix` module streamlines this process.

Connect your application to your cloud instance using:

```python
from phoenix.otel import register

tracer_provider = register(endpoint="http://127.0.0.1:6006/v1/traces") 
```

Your app is now connected to Phoenix! Any OpenTelemetry traces you generate will be sent to your Phoenix instance.
