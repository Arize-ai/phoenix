---
title: TS - Launch Phoenix
---

{% tabs %}
{% tab title="Phoenix Cloud" %}
1. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)
2. Grab your API key from the Keys option on the left bar.
3. In your code, configure environment variables for your endpoint and API key:

```sh
# .env, or shell environment

# And Collector Endpoint for Phoenix Cloud
PHOENIX_ENDPOINT="ADD YOUR PHOENIX ENDPOINT e.g. https://app.phoenix.arize.com/s/<example>/v1/traces"
# Add Phoenix API Key for tracing
PHOENIX_API_KEY="ADD YOUR PHOENIX API KEY"
```
{% endtab %}

{% tab title="Self-Hosted Phoenix" %}
1. Run Phoenix using Docker, local terminal, Kubernetes etc. For more information, see [self-hosting](https://arize.com/docs/phoenix/self-hosting).
2. In your code, configure environment variables for your endpoint and API key:

```sh
# .env, or shell environment
​
# Collector Endpoint for your self hosted Phoenix, like localhost
PHOENIX_ENDPOINT="http://localhost:6006/v1/traces"
# (optional) If authentication enabled, add Phoenix API Key for tracing
PHOENIX_API_KEY="ADD YOUR API KEY"
```
{% endtab %}
{% endtabs %}
