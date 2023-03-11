---
description: Learn how to create your model schema for common data formats
---

# Define Your Schema

This section show you how to define your model schema with concrete examples.

{% hint style="info" %}
* For a conceptual overview of the Phoenix API, including a high-level introduction to the notion of a schema, see [Phoenix Basics](../concepts/phoenix-basics.md#schemas).
* For a comprehensive description of `phoenix.Schema`, including detailed descriptions of each field, see the [API reference](../reference/api/phoenix.schema).
{% endhint %}

## Predictions and Ground Truth

Let's first see how to define a schema with predictions and ground truth. The example DataFrame below contains inference data from a binary classification model trained to predict whether a user will click on an advertisement. The timestamps represent the time at which each inference was made in production.

### DataFrame

| timestamp           | prediction | target    | score | target\_score |
| ------------------- | ---------- | --------- | ----- | ------------- |
| 2023-03-01 02:02:19 | click      | click     | 0.91  | 1.0           |
| 2023-02-17 23:45:48 | no\_click  | no\_click | 0.37  | 0.0           |
| 2023-01-30 15:30:03 | click      | no\_click | 0.54  | 0.0           |
| 2023-02-03 19:56:09 | click      | click     | 0.74  | 1.0           |
| 2023-02-24 04:23:43 | no\_click  | click     | 0.37  | 1.0           |

### Schema

```python
schema = px.Schema(
    timestamp_column_name="timestamp",
    prediction_label_column_name="prediction",
    actual_label_column_name="target",
    prediction_score_column_name="score",
    actual_score_column_name="target_score",
)
```

This schema defines predicted and actual labels and scores, but you can run Phoenix with any subset of those fields, e.g., with only predicted labels.

{% hint style="info" %}
For more information on timestamps, including details on how Phoenix handles time zones, see the [API reference](../reference/api/phoenix.schema/).
{% endhint %}

## Features and Tags

Next, let's see an example of how to handle features and tags.

{% hint style="info" %}
Both features and tags can be used to apply filters to analyze subsets of your data. Unlike features, tags are not assumed to be inputs to your model.
{% endhint %}

### DataFrame



### Schema



If your data has a large number of features, it can be inconvenient to list them all. For example, the breast cancer dataset below contains 30 features that can be used to predict whether a breast mass is malignant or benign. Instead of explicitly listing each feature, you can leave the `feature_column_names` field of your schema set to its default value of `None`, in which case, any column of your DataFrame that does not appear in the schema is implicitly assumed to be a feature.

### DataFrame



### Schema





## Embeddings

### Images

### Another
