---
description: Learn how to create your model schema for common data formats
---

# Define Your Schema

This section shows you how to define your model schema with concrete examples.

{% hint style="info" %}
* For a conceptual overview of the Phoenix API, including a high-level introduction to the notion of a schema, see [Phoenix Basics](../concepts/phoenix-basics.md#schemas).
* For a comprehensive description of `phoenix.Schema`, including detailed descriptions of each field, see the [API reference](../reference/api/phoenix.schema).
{% endhint %}

## Predictions and Ground Truth

Let's first see how to define a schema with predictions and ground truth. The example DataFrame below contains inference data from a binary classification model trained to predict whether a user will click on an advertisement. The timestamps represent the time at which each inference was made in production.

#### DataFrame

| timestamp           | prediction | target    | score | target\_score |
| ------------------- | ---------- | --------- | ----- | ------------- |
| 2023-03-01 02:02:19 | click      | click     | 0.91  | 1.0           |
| 2023-02-17 23:45:48 | no\_click  | no\_click | 0.37  | 0.0           |
| 2023-01-30 15:30:03 | click      | no\_click | 0.54  | 0.0           |
| 2023-02-03 19:56:09 | click      | click     | 0.74  | 1.0           |
| 2023-02-24 04:23:43 | no\_click  | click     | 0.37  | 1.0           |

#### Schema

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
For more information on timestamps, including details on how Phoenix handles time zones, see the [API reference](../reference/api/phoenix.schema).
{% endhint %}

## Features and Tags

Define features and tags.

{% hint style="info" %}
Both features and tags can be used to apply filters to analyze subsets of your data. Unlike features, tags are not assumed to be inputs to your model.
{% endhint %}

#### DataFrame

#### Schema

### Implicit Features

If your data has a large number of features, it can be inconvenient to list them all. For example, the breast cancer dataset below contains 30 features that can be used to predict whether a breast mass is malignant or benign. Instead of explicitly listing each feature, you can leave the `feature_column_names` field of your schema set to its default value of `None`, in which case, any columns of your DataFrame that do not appear in your schema are implicitly assumed to be features.

#### DataFrame

| target    | predicted | mean radius | mean texture | mean perimeter | mean area | mean smoothness | mean compactness | mean concavity | mean concave points | mean symmetry | mean fractal dimension | radius error | texture error | perimeter error | area error | smoothness error | compactness error | concavity error | concave points error | symmetry error | fractal dimension error | worst radius | worst texture | worst perimeter | worst area | worst smoothness | worst compactness | worst concavity | worst concave points | worst symmetry | worst fractal dimension |
| --------- | --------- | ----------- | ------------ | -------------- | --------- | --------------- | ---------------- | -------------- | ------------------- | ------------- | ---------------------- | ------------ | ------------- | --------------- | ---------- | ---------------- | ----------------- | --------------- | -------------------- | -------------- | ----------------------- | ------------ | ------------- | --------------- | ---------- | ---------------- | ----------------- | --------------- | -------------------- | -------------- | ----------------------- |
| malignant | benign    | 15.49       | 19.97        | 102.40         | 744.7     | 0.11600         | 0.15620          | 0.18910        | 0.09113             | 0.1929        | 0.06744                | 0.6470       | 1.3310        | 4.675           | 66.91      | 0.007269         | 0.02928           | 0.04972         | 0.01639              | 0.01852        | 0.004232                | 21.20        | 29.41         | 142.10          | 1359.0     | 0.1681           | 0.3913            | 0.55530         | 0.21210              | 0.3187         | 0.10190                 |
| malignant | malignant | 17.01       | 20.26        | 109.70         | 904.3     | 0.08772         | 0.07304          | 0.06950        | 0.05390             | 0.2026        | 0.05223                | 0.5858       | 0.8554        | 4.106           | 68.46      | 0.005038         | 0.01503           | 0.01946         | 0.01123              | 0.02294        | 0.002581                | 19.80        | 25.05         | 130.00          | 1210.0     | 0.1111           | 0.1486            | 0.19320         | 0.10960              | 0.3275         | 0.06469                 |
| malignant | malignant | 17.99       | 10.38        | 122.80         | 1001.0    | 0.11840         | 0.27760          | 0.30010        | 0.14710             | 0.2419        | 0.07871                | 1.0950       | 0.9053        | 8.589           | 153.40     | 0.006399         | 0.04904           | 0.05373         | 0.01587              | 0.03003        | 0.006193                | 25.38        | 17.33         | 184.60          | 2019.0     | 0.1622           | 0.6656            | 0.71190         | 0.26540              | 0.4601         | 0.11890                 |
| benign    | benign    | 14.53       | 13.98        | 93.86          | 644.2     | 0.10990         | 0.09242          | 0.06895        | 0.06495             | 0.1650        | 0.06121                | 0.3060       | 0.7213        | 2.143           | 25.70      | 0.006133         | 0.01251           | 0.01615         | 0.01136              | 0.02207        | 0.003563                | 15.80        | 16.93         | 103.10          | 749.9      | 0.1347           | 0.1478            | 0.13730         | 0.10690              | 0.2606         | 0.07810                 |
| benign    | benign    | 10.26       | 14.71        | 66.20          | 321.6     | 0.09882         | 0.09159          | 0.03581        | 0.02037             | 0.1633        | 0.07005                | 0.3380       | 2.5090        | 2.394           | 19.33      | 0.017360         | 0.04671           | 0.02611         | 0.01296              | 0.03675        | 0.006758                | 10.88        | 19.48         | 70.89           | 357.1      | 0.1360           | 0.1636            | 0.07162         | 0.04074              | 0.2434         | 0.08488                 |

#### Schema

```python
schema = px.Schema(
    prediction_label_column_name="predicted",
    actual_label_column_name="target",
)
```

### Excluded Columns

You can tell Phoenix to ignore certain columns of your DataFrame when implicitly inferring features by adding those column names to the `excludes` field of your schema. The DataFrame below contains all the same data as the breast cancer dataset above, in addition to "hospital" and "insurance\_provider" fields that are not features of your model. Explicitly exclude these fields, otherwise, Phoenix will assume that they are features.

#### DataFrame

| target    | predicted | hospital                      | insurance\_provider | mean radius | mean texture | mean perimeter | mean area | mean smoothness | mean compactness | mean concavity | mean concave points | mean symmetry | mean fractal dimension | radius error | texture error | perimeter error | area error | smoothness error | compactness error | concavity error | concave points error | symmetry error | fractal dimension error | worst radius | worst texture | worst perimeter | worst area | worst smoothness | worst compactness | worst concavity | worst concave points | worst symmetry | worst fractal dimension |
| --------- | --------- | ----------------------------- | ------------------- | ----------- | ------------ | -------------- | --------- | --------------- | ---------------- | -------------- | ------------------- | ------------- | ---------------------- | ------------ | ------------- | --------------- | ---------- | ---------------- | ----------------- | --------------- | -------------------- | -------------- | ----------------------- | ------------ | ------------- | --------------- | ---------- | ---------------- | ----------------- | --------------- | -------------------- | -------------- | ----------------------- |
| malignant | benign    | Pacific Clinics               | uninsured           | 15.49       | 19.97        | 102.40         | 744.7     | 0.11600         | 0.15620          | 0.18910        | 0.09113             | 0.1929        | 0.06744                | 0.6470       | 1.3310        | 4.675           | 66.91      | 0.007269         | 0.02928           | 0.04972         | 0.01639              | 0.01852        | 0.004232                | 21.20        | 29.41         | 142.10          | 1359.0     | 0.1681           | 0.3913            | 0.55530         | 0.21210              | 0.3187         | 0.10190                 |
| malignant | malignant | Queens Hospital               | Anthem Blue Cross   | 17.01       | 20.26        | 109.70         | 904.3     | 0.08772         | 0.07304          | 0.06950        | 0.05390             | 0.2026        | 0.05223                | 0.5858       | 0.8554        | 4.106           | 68.46      | 0.005038         | 0.01503           | 0.01946         | 0.01123              | 0.02294        | 0.002581                | 19.80        | 25.05         | 130.00          | 1210.0     | 0.1111           | 0.1486            | 0.19320         | 0.10960              | 0.3275         | 0.06469                 |
| malignant | malignant | St. Francis Memorial Hospital | Blue Shield of CA   | 17.99       | 10.38        | 122.80         | 1001.0    | 0.11840         | 0.27760          | 0.30010        | 0.14710             | 0.2419        | 0.07871                | 1.0950       | 0.9053        | 8.589           | 153.40     | 0.006399         | 0.04904           | 0.05373         | 0.01587              | 0.03003        | 0.006193                | 25.38        | 17.33         | 184.60          | 2019.0     | 0.1622           | 0.6656            | 0.71190         | 0.26540              | 0.4601         | 0.11890                 |
| benign    | benign    | Pacific Clinics               | Kaiser Permanente   | 14.53       | 13.98        | 93.86          | 644.2     | 0.10990         | 0.09242          | 0.06895        | 0.06495             | 0.1650        | 0.06121                | 0.3060       | 0.7213        | 2.143           | 25.70      | 0.006133         | 0.01251           | 0.01615         | 0.01136              | 0.02207        | 0.003563                | 15.80        | 16.93         | 103.10          | 749.9      | 0.1347           | 0.1478            | 0.13730         | 0.10690              | 0.2606         | 0.07810                 |
| benign    | benign    | CityMed                       | Anthem Blue Cross   | 10.26       | 14.71        | 66.20          | 321.6     | 0.09882         | 0.09159          | 0.03581        | 0.02037             | 0.1633        | 0.07005                | 0.3380       | 2.5090        | 2.394           | 19.33      | 0.017360         | 0.04671           | 0.02611         | 0.01296              | 0.03675        | 0.006758                | 10.88        | 19.48         | 70.89           | 357.1      | 0.1360           | 0.1636            | 0.07162         | 0.04074              | 0.2434         | 0.08488                 |

#### Schema

```python
schema = px.Schema(
    prediction_label_column_name="predicted",
    actual_label_column_name="target",
    excludes=[
        "hospital",
        "insurance_provider",
    ],
)
```

## Embedding Features

Define embedding features with `px.EmbeddingColumnNames`.

{% hint style="info" %}
For a conceptual overview of embeddings, see [Embeddings](../concepts/embeddings.md).
{% endhint %}

{% hint style="info" %}
The examples in this section have low-dimensional embeddings so you can view them easily. In practice, the dimension of your embeddings may be much higher.
{% endhint %}

In the simplest case, provide Phoenix with just the embeddings themselves. Note that "product\_review\_embedding" in the schema below is not a column of your DataFrame, but is a name you choose for your embedding feature that will appear in the Phoenix UI.



{% hint style="warning" %}
Metrics for comparing embeddings, such as Euclidean distance and cosine similarity, can only be computed between vectors of the same length. That means that your embeddings for any particular embedding feature must all have the same length.
{% endhint %}

### Image Data

For computer vision

#### DataFrame

#### Schema

### Text Data

#### DataFrame

#### Schema

### Multiple Embedding Features

For example

#### DataFrame

#### Schema

{% hint style="info" %}
Distinct embedding features can have embeddings of differing lengths. In the example above, X has embeddings of length 4 while Y has embeddings of length 5.
{% endhint %}

