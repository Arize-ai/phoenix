# Local instance

You can use Phoenix's open-source package to launch a local instance of Phoenix on your machine. For more info on other self-hosting options, like Docker, see [.](./ "mention")

First, install the Phoenix package:

```bash
pip install arize-phoenix
```

Then launch your instance in terminal:

```bash
phoenix serve
```

This will expose the Phoenix UI and REST API on `localhost:6006` and exposes the gRPC endpoint for spans on `localhost:4317`

### Connect your app to Phoenix

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix. The `register` utility from the `phoenix` module streamlines this process.

Connect your application to your cloud instance using:

```python
import os
from phoenix.otel import register

# If you have set up auth on your local Phoenix instance, include:
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_API_KEY] = "{PHOENIX_API_KEY}"

# configure the Phoenix tracer
tracer_provider = register(
  endpoint="http://localhost:4317",  # Sends traces using gRPC
) 
```

Your app is now connected to Phoenix! Any OpenTelemetry traces you generate will be sent to your Phoenix instance.
