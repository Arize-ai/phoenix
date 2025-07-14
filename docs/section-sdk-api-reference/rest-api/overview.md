---
hidden: true
---

# Overview

The Phoenix REST API allows you to access and interact with observability data programmatically. You can use it to retrieve project information, query traces and spans, access prompts, and automate analysis workflows directly from your environment.

{% hint style="success" %}
For an up-to-date OpenAPI text file that contains descriptions of all the REST API endpoints, see here: [https://app.phoenix.arize.com/openapi.json](https://app.phoenix.arize.com/openapi.json)
{% endhint %}

### Example Request

_Get dataset by ID_

{% tabs %}
{% tab title="cURL" %}
```concurnas
curl -L \
  --url '/v1/datasets'
```
{% endtab %}

{% tab title="JavaScript" %}
```javascript
// Get dataset by ID
const response = await fetch('/v1/datasets/{id}', {
    method: 'GET',
});

const data = await response.json();
```
{% endtab %}

{% tab title="Python" %}
<pre class="language-python" data-full-width="false"><code class="lang-python"># Get dataset by ID
<strong>import requests
</strong>
response = requests.get(
    "/v1/datasets/{id}",
)

data = response.json()
</code></pre>
{% endtab %}

{% tab title="HTTP" %}
```http
GET /v1/datasets/{id} HTTP/1.1
Host: 
Accept: */*
```
{% endtab %}
{% endtabs %}

### Example Response

```
{
  "data": [
    {
      "id": "version_123",
      "dataset_id": "your_dataset_id",
      "created_at": "2025-04-18T21:23:18.216Z",
      "metadata": {
        "source": "inference-logs"
      }
    }
  ],
  "next_cursor": null
}
```
