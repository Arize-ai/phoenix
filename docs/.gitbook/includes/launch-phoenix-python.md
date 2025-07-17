---
title: Launch Phoenix Python
---

{% tabs %}
{% tab title="Using Phoenix Cloud" %}
**Sign up for Phoenix:**

1. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)
2. Click `Create Space`, then follow the prompts to create and launch your space.

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint and API Key:**

From your new Phoenix Space

1. Create your API key from the Settings page
2. Copy your `Hostname` from the Settings page
3. In your code, set your endpoint and API key:

```python
import os

os.environ["PHOENIX_API_KEY"] = "ADD YOUR PHOENIX API KEY"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "ADD YOUR PHOENIX HOSTNAME"

# If you created your Phoenix Cloud instance before June 24th, 2025,
# you also need to set the API key as a header
#os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={os.getenv('PHOENIX_API_KEY')}"
```

{% hint style="info" %}
Having trouble finding your endpoint? Check out [Finding your Phoenix Endpoint](https://arize.com/docs/phoenix/learn/faqs/what-is-my-phoenix-endpoint)
{% endhint %}
{% endtab %}

{% tab title="Using Self-hosted Phoenix" %}
1. Run Phoenix using Docker, local terminal, Kubernetes etc. For more information, [see self-hosting](https://arize.com/docs/phoenix/self-hosting).
2. In your code, set your endpoint:

```python
import os

# Update this with your self-hosted endpoint
os.environ["PHOENIX_COLLECTOR_ENDPOINT] = "http://localhost:6006/v1/traces"
```

{% hint style="warning" %}
Having trouble finding your endpoint? Check out [Finding your Phoenix Endpoint](https://arize.com/docs/phoenix/learn/faqs/what-is-my-phoenix-endpoint)
{% endhint %}
{% endtab %}
{% endtabs %}
