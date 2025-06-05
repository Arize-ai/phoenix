---
title: TS - Launch Phoenix
---

{% tabs %}
{% tab title="Phoenix Cloud" %}
**Sign up for Phoenix:**

Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Set your Phoenix endpoint and API Key:**

```bash
export PHOENIX_COLLECTOR_ENDPOINT="https://app.phoenix.arize.com/v1/traces"
export OTEL_EXPORTER_OTLP_HEADERS="api_key=YOUR_PHOENIX_API_KEY"
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
pip install arize-phoenix
phoenix serve
```

This will expose the Phoenix on `localhost:6006`

For details on customizing a local terminal deployment, see [Terminal Setup](https://arize.com/docs/phoenix/setup/environments#terminal).

**Set your Phoenix endpoint and API Key:**

```bash
export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006/v1/traces"
export PHOENIX_API_KEY="YOUR PHOENIX API KEY" # only necessary if you've enabled auth
```
{% endtab %}

{% tab title="Docker" %}
**Pull latest Phoenix image from** [**Docker Hub**](https://hub.docker.com/r/arizephoenix/phoenix)**:**

```bash
docker pull arizephoenix/phoenix:latest
```

**Run your containerized instance:**

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

This will expose the Phoenix on `localhost:6006`

**Set your Phoenix endpoint and API Key:**

```bash
export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006/v1/traces"
export PHOENIX_API_KEY="YOUR PHOENIX API KEY" # only necessary if you've enabled auth
```

For more info on using Phoenix with Docker, see [Docker](https://arize.com/docs/phoenix/self-hosting/deployment-options/docker).
{% endtab %}
{% endtabs %}
