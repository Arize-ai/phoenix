# What is my Phoenix Endpoint?

There are two endpoints that matter in Phoenix:

1. **Application Endpoint:** The endpoint your Phoenix instance is running on
2. **OTEL Tracing Endpoint:** The endpoint through which your Phoenix instance receives OpenTelemetry traces

#### **Application Endpoint**

If you're accessing a Phoenix Cloud instance through our website, then your endpoint is available under the `Hostname` field of your Settings page.

If you're self-hosting Phoenix, then you choose the endpoint when you set up the app. The default value is `http://localhost:6006`

To set this endpoint, use the `PHOENIX_COLLECTOR_ENDPOINT` environment variable. This is used by the Phoenix client package to query traces, log annotations, and retrieve prompts.

#### **OTEL Tracing Endpoint**

If you're accessing a Phoenix Cloud instance through our website, then your endpoint is available under the `Hostname` field of your Settings page.

If you're self-hosting Phoenix, then you choose the endpoint when you set up the app. The default values are:

* Using the GRPC protocol: `http://localhost:6006/v1/traces`
* Using the HTTP protocol: `http://localhost:4317`

{% hint style="info" %}
As of May 2025, Phoenix Cloud only supports trace collection via HTTP
{% endhint %}

To set this endpoint, use the `register(endpoint=YOUR ENDPOINT)` function. This endpoint can also be set using environment variables. For more on the register function and other configuration options, [see here](https://github.com/Arize-ai/phoenix/tree/main/packages/phoenix-otel#configuring-the-collector-endpoint).
