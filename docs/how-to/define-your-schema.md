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

Next, let's see an example of how to handle features and tags.

{% hint style="info" %}
Both features and tags can be used to apply filters to analyze subsets of your data. Unlike features, tags are not assumed to be inputs to your model.
{% endhint %}

#### DataFrame

#### Schema

### Implicitly Defined Features

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

You can tell Phoenix to ignore certain columns of your DataFrame when implicitly inferring features by adding those column names to the `excludes` field. The DataFrame below contains all the same data as the breast cancer dataset above, in addition to "hospital" and "" fields. These fields should be excluded

#### DataFrame

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>target</th>
      <th>predicted</th>
      <th>hospital</th>
      <th>insurance_provider</th>
      <th>mean radius</th>
      <th>mean texture</th>
      <th>mean perimeter</th>
      <th>mean area</th>
      <th>mean smoothness</th>
      <th>mean compactness</th>
      <th>mean concavity</th>
      <th>mean concave points</th>
      <th>mean symmetry</th>
      <th>mean fractal dimension</th>
      <th>radius error</th>
      <th>texture error</th>
      <th>perimeter error</th>
      <th>area error</th>
      <th>smoothness error</th>
      <th>compactness error</th>
      <th>concavity error</th>
      <th>concave points error</th>
      <th>symmetry error</th>
      <th>fractal dimension error</th>
      <th>worst radius</th>
      <th>worst texture</th>
      <th>worst perimeter</th>
      <th>worst area</th>
      <th>worst smoothness</th>
      <th>worst compactness</th>
      <th>worst concavity</th>
      <th>worst concave points</th>
      <th>worst symmetry</th>
      <th>worst fractal dimension</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>malignant</td>
      <td>benign</td>
      <td>Pacific Clinics</td>
      <td>uninsured</td>
      <td>15.49</td>
      <td>19.97</td>
      <td>102.40</td>
      <td>744.7</td>
      <td>0.11600</td>
      <td>0.15620</td>
      <td>0.18910</td>
      <td>0.09113</td>
      <td>0.1929</td>
      <td>0.06744</td>
      <td>0.6470</td>
      <td>1.3310</td>
      <td>4.675</td>
      <td>66.91</td>
      <td>0.007269</td>
      <td>0.02928</td>
      <td>0.04972</td>
      <td>0.01639</td>
      <td>0.01852</td>
      <td>0.004232</td>
      <td>21.20</td>
      <td>29.41</td>
      <td>142.10</td>
      <td>1359.0</td>
      <td>0.1681</td>
      <td>0.3913</td>
      <td>0.55530</td>
      <td>0.21210</td>
      <td>0.3187</td>
      <td>0.10190</td>
    </tr>
    <tr>
      <td>malignant</td>
      <td>malignant</td>
      <td>Queens Hospital</td>
      <td>Anthem Blue Cross</td>
      <td>17.01</td>
      <td>20.26</td>
      <td>109.70</td>
      <td>904.3</td>
      <td>0.08772</td>
      <td>0.07304</td>
      <td>0.06950</td>
      <td>0.05390</td>
      <td>0.2026</td>
      <td>0.05223</td>
      <td>0.5858</td>
      <td>0.8554</td>
      <td>4.106</td>
      <td>68.46</td>
      <td>0.005038</td>
      <td>0.01503</td>
      <td>0.01946</td>
      <td>0.01123</td>
      <td>0.02294</td>
      <td>0.002581</td>
      <td>19.80</td>
      <td>25.05</td>
      <td>130.00</td>
      <td>1210.0</td>
      <td>0.1111</td>
      <td>0.1486</td>
      <td>0.19320</td>
      <td>0.10960</td>
      <td>0.3275</td>
      <td>0.06469</td>
    </tr>
    <tr>
      <td>malignant</td>
      <td>malignant</td>
      <td>St. Francis Memorial Hospital</td>
      <td>Blue Shield of CA</td>
      <td>17.99</td>
      <td>10.38</td>
      <td>122.80</td>
      <td>1001.0</td>
      <td>0.11840</td>
      <td>0.27760</td>
      <td>0.30010</td>
      <td>0.14710</td>
      <td>0.2419</td>
      <td>0.07871</td>
      <td>1.0950</td>
      <td>0.9053</td>
      <td>8.589</td>
      <td>153.40</td>
      <td>0.006399</td>
      <td>0.04904</td>
      <td>0.05373</td>
      <td>0.01587</td>
      <td>0.03003</td>
      <td>0.006193</td>
      <td>25.38</td>
      <td>17.33</td>
      <td>184.60</td>
      <td>2019.0</td>
      <td>0.1622</td>
      <td>0.6656</td>
      <td>0.71190</td>
      <td>0.26540</td>
      <td>0.4601</td>
      <td>0.11890</td>
    </tr>
    <tr>
      <td>benign</td>
      <td>benign</td>
      <td>Pacific Clinics</td>
      <td>Kaiser Permanente</td>
      <td>14.53</td>
      <td>13.98</td>
      <td>93.86</td>
      <td>644.2</td>
      <td>0.10990</td>
      <td>0.09242</td>
      <td>0.06895</td>
      <td>0.06495</td>
      <td>0.1650</td>
      <td>0.06121</td>
      <td>0.3060</td>
      <td>0.7213</td>
      <td>2.143</td>
      <td>25.70</td>
      <td>0.006133</td>
      <td>0.01251</td>
      <td>0.01615</td>
      <td>0.01136</td>
      <td>0.02207</td>
      <td>0.003563</td>
      <td>15.80</td>
      <td>16.93</td>
      <td>103.10</td>
      <td>749.9</td>
      <td>0.1347</td>
      <td>0.1478</td>
      <td>0.13730</td>
      <td>0.10690</td>
      <td>0.2606</td>
      <td>0.07810</td>
    </tr>
    <tr>
      <td>benign</td>
      <td>benign</td>
      <td>CityMed</td>
      <td>Anthem Blue Cross</td>
      <td>10.26</td>
      <td>14.71</td>
      <td>66.20</td>
      <td>321.6</td>
      <td>0.09882</td>
      <td>0.09159</td>
      <td>0.03581</td>
      <td>0.02037</td>
      <td>0.1633</td>
      <td>0.07005</td>
      <td>0.3380</td>
      <td>2.5090</td>
      <td>2.394</td>
      <td>19.33</td>
      <td>0.017360</td>
      <td>0.04671</td>
      <td>0.02611</td>
      <td>0.01296</td>
      <td>0.03675</td>
      <td>0.006758</td>
      <td>10.88</td>
      <td>19.48</td>
      <td>70.89</td>
      <td>357.1</td>
      <td>0.1360</td>
      <td>0.1636</td>
      <td>0.07162</td>
      <td>0.04074</td>
      <td>0.2434</td>
      <td>0.08488</td>
    </tr>
  </tbody>
</table>

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

## Embeddings

### Images

### Another
