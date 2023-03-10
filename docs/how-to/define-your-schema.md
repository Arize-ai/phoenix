---
description: Learn how to create your model schema for common data formats
---

# Define Your Schema

The guides in this section show you how to define your model schema with concrete examples.

{% hint style="info" %}
* For a conceptual overview of the Phoenix API, including a high-level introduction to the notion of a schema, see [Phoenix Basics](../concepts/phoenix-basics.md#schemas).
* For a comprehensive description of `phoenix.Schema`, see the [API reference](../reference/api/phoenix.schema/).                                     &#x20;
{% endhint %}

## Basic Fields

Suppose you have some data

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>timestamp</th>
      <th>prediction</th>
      <th>target</th>
      <th>score</th>
      <th>target_score</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>2023-03-01 02:02:19</td>
      <td>click</td>
      <td>click</td>
      <td>0.91</td>
      <td>1.0</td>
    </tr>
    <tr>
      <td>2023-02-17 23:45:48</td>
      <td>no_click</td>
      <td>no_click</td>
      <td>0.37</td>
      <td>0.0</td>
    </tr>
    <tr>
      <td>2023-01-30 15:30:03</td>
      <td>click</td>
      <td>no_click</td>
      <td>0.54</td>
      <td>0.0</td>
    </tr>
    <tr>
      <td>2023-02-03 19:56:09</td>
      <td>click</td>
      <td>click</td>
      <td>0.74</td>
      <td>1.0</td>
    </tr>
    <tr>
      <td>2023-02-24 04:23:43</td>
      <td>no_click</td>
      <td>click</td>
      <td>0.37</td>
      <td>1.0</td>
    </tr>
  </tbody>
</table>

## Features and Tags

If you have a DataFrame containing features and tags,



### Implicit and Excluded Features

Sometimes, you have a large number of features and it is inconvenient to list them all.

## Embeddings

### Images

### Another

