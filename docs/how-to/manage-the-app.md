---
description: >-
  Launch a Phoenix session, open the UI in your notebook or browser, and close
  your session when you're done
---

# Manage the App

## Launch the App

Use `phoenix.launch_app` to start a session in the background. You can launch Phoenix with either a single dataset or with primary and reference datasets.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th></th></tr></thead><tbody><tr><td align="center"><strong>Single Dataset</strong></td><td><pre class="language-python"><code class="lang-python">session = px.launch_app(ds)
</code></pre></td></tr><tr><td align="center"><strong>Primary and Reference Datasets</strong></td><td><pre class="language-python"><code class="lang-python">session = px.launch_app(prim_ds, ref_ds)
</code></pre></td></tr></tbody></table>

{% hint style="info" %}
For a conceptual overview of datasets, including an explanation of when to use a single dataset vs. primary and reference datasets, see the [Phoenix Basics](../concepts/phoenix-basics.md#datasets).
{% endhint %}

## Open the UI

&#x20;You can view and interact with the Phoenix UI either directly in your notebook or in a separate browser tab or window.

{% tabs %}
{% tab title="In Your Notebook" %}
In a notebook cell, run

```python
session.view()
```

The Phoenix UI will appear in a window beneath the cell.



{% hint style="info" %}
The height of the window can be adjusted by passing a `height` parameter, e.g., `session.view(height=700)`. Defaults to 500 pixels.
{% endhint %}
{% endtab %}

{% tab title="In the Browser" %}
In a notebook cell, run

```python
session.url
```

Copy and paste the output URL into a new browser tab or window.



{% hint style="info" %}
Browser-based sessions are supported in both local Jupyter environments and Colab.
{% endhint %}
{% endtab %}
{% endtabs %}

## Close the App

When you're done using Phoenix, gracefully shut down your running background session with

```python
px.close_app()
```
