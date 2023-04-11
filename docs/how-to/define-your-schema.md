---
description: How to create Phoenix datasets and schemas for common data formats
---

# Import Your Data

This guide shows you how to define a Phoenix dataset using your own data.

{% hint style="info" %}
* For a conceptual overview of the Phoenix API, including a high-level introduction to the notion of datasets and schemas, see [Phoenix Basics](../concepts/phoenix-basics.md#schemas).
* For a comprehensive description of `phoenix.Dataset` and `phoenix.Schema`, see the [API reference](../api/dataset-and-schema.md).
{% endhint %}

Once you have a pandas DataFrame `df` containing your data and a `schema` object describing the format of your DataFrame, you can define your Phoenix dataset either by running

```python
ds = px.Dataset(df, schema)
```

or by optionally providing a name for your dataset that will appear in the UI:

```python
ds = px.Dataset(df, schema, name="training")
```

As you can see, instantiating your dataset is the easy part. Before you run the code above, you must first wrangle your data into a pandas DataFrame and then create a Phoenix schema to describe the format of your DataFrame. The rest of this guide shows you how to match your schema to your DataFrame with concrete examples.

## Predictions and Actuals

Let's first see how to define a schema with predictions and actuals (Phoenix's nomenclature for ground truth). The example DataFrame below contains inference data from a binary classification model trained to predict whether a user will click on an advertisement. The timestamps are `datetime.datetime` objects that represent the time at which each inference was made in production.

#### DataFrame

| timestamp           | prediction\_score | prediction | target    |
| ------------------- | ----------------- | ---------- | --------- |
| 2023-03-01 02:02:19 | 0.91              | click      | click     |
| 2023-02-17 23:45:48 | 0.37              | no\_click  | no\_click |
| 2023-01-30 15:30:03 | 0.54              | click      | no\_click |
| 2023-02-03 19:56:09 | 0.74              | click      | click     |
| 2023-02-24 04:23:43 | 0.37              | no\_click  | click     |

#### Schema

```python
schema = px.Schema(
    timestamp_column_name="timestamp",
    prediction_score_column_name="prediction_score",
    prediction_label_column_name="prediction",
    actual_label_column_name="target",
)
```

This schema defines predicted and actual labels and scores, but you can run Phoenix with any subset of those fields, e.g., with only predicted labels.

## Features and Tags

Phoenix accepts not only predictions and ground truth but also input features of your model and tags that describe your data. In the example below, features such as FICO score and merchant ID are used to predict whether a credit card transaction is legitimate or fraudulent. In contrast, tags such as age and gender are not model inputs, but are used to filter your data and analyze meaningful cohorts in the app.

#### DataFrame

| fico\_score | merchant\_id      | loan\_amount | annual\_income | home\_ownership | num\_credit\_lines | inquests\_in\_last\_6\_months | months\_since\_last\_delinquency | age | gender | predicted  | target     |
| ----------- | ----------------- | ------------ | -------------- | --------------- | ------------------ | ----------------------------- | -------------------------------- | --- | ------ | ---------- | ---------- |
| 578         | Scammeds          | 4300         | 62966          | RENT            | 110                | 0                             | 0                                | 25  | male   | not\_fraud | fraud      |
| 507         | Schiller Ltd      | 21000        | 52335          | RENT            | 129                | 0                             | 23                               | 78  | female | not\_fraud | not\_fraud |
| 656         | Kirlin and Sons   | 18000        | 94995          | MORTGAGE        | 31                 | 0                             | 0                                | 54  | female | uncertain  | uncertain  |
| 414         | Scammeds          | 18000        | 32034          | LEASE           | 81                 | 2                             | 0                                | 34  | male   | fraud      | not\_fraud |
| 512         | Champlin and Sons | 20000        | 46005          | OWN             | 148                | 1                             | 0                                | 49  | male   | uncertain  | uncertain  |

#### Schema

```python
schema = px.Schema(
    prediction_label_column_name="predicted",
    actual_label_column_name="target",
    feature_column_names=[
        "fico_score",
        "merchant_id",
        "loan_amount",
        "annual_income",
        "home_ownership",
        "num_credit_lines",
        "inquests_in_last_6_months",
        "months_since_last_delinquency",
    ],
    tag_column_names=[
        "age",
        "gender",
    ],
)
```

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

You can tell Phoenix to ignore certain columns of your DataFrame when implicitly inferring features by adding those column names to the `excluded_column_names` field of your schema. The DataFrame below contains all the same data as the breast cancer dataset above, in addition to "hospital" and "insurance\_provider" fields that are not features of your model. Explicitly exclude these fields, otherwise, Phoenix will assume that they are features.

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
    excluded_column_names=[
        "hospital",
        "insurance_provider",
    ],
)
```

## Embedding Features

Embedding features consist of vector data in addition to any unstructured data in the form of text or images that the vectors represent. Unlike normal features, a single embedding feature may span multiple columns of your DataFrame. Use `px.EmbeddingColumnNames` to associate multiple DataFrame columns with the same embedding feature.

{% hint style="info" %}
* For a conceptual overview of embeddings, see [Embeddings](../concepts/embeddings.md).
* For a comprehensive description of `px.EmbeddingColumnNames`, see the [API reference](../api/dataset-and-schema.md#phoenix.embeddingcolumnnames).
{% endhint %}

{% hint style="info" %}
The example in this section contain low-dimensional embeddings for the sake of easy viewing. Your embeddings in practice will typically have much higher dimension.
{% endhint %}

### Embedding Vectors

To define an embedding feature, you must at minimum provide Phoenix with the embedding vector data itself. Specify the DataFrame column that contains this data in the `vector_column_name` field on `px.EmbeddingColumnNames`. For example, the DataFrame below contains tabular credit card transaction data in addition to embedding vectors that represent each row. Notice that:

* Unlike other fields that take strings or lists of strings, the argument to `embedding_feature_column_names` is a dictionary.
* The key of this dictionary, "transaction\_embedding," is not a column of your DataFrame but is name you choose for your embedding feature that appears in the UI.
* The values of this dictionary are instances of `px.EmbeddingColumnNames`.
* Each entry in the "embedding\_vector" column is a list of length 4.

#### DataFrame

| predicted  | target     | embedding\_vector           | fico\_score | merchant\_id      | loan\_amount | annual\_income | home\_ownership | num\_credit\_lines | inquests\_in\_last\_6\_months | months\_since\_last\_delinquency |
| ---------- | ---------- | --------------------------- | ----------- | ----------------- | ------------ | -------------- | --------------- | ------------------ | ----------------------------- | -------------------------------- |
| fraud      | not\_fraud | \[-0.97, 3.98, -0.03, 2.92] | 604         | Leannon Ward      | 22000        | 100781         | RENT            | 108                | 0                             | 0                                |
| fraud      | not\_fraud | \[3.20, 3.95, 2.81, -0.09]  | 612         | Scammeds          | 7500         | 116184         | MORTGAGE        | 42                 | 2                             | 56                               |
| not\_fraud | not\_fraud | \[-0.49, -0.62, 0.08, 2.03] | 646         | Leannon Ward      | 32000        | 73666          | RENT            | 131                | 0                             | 0                                |
| not\_fraud | not\_fraud | \[1.69, 0.01, -0.76, 3.64]  | 560         | Kirlin and Sons   | 19000        | 38589          | MORTGAGE        | 131                | 0                             | 0                                |
| uncertain  | uncertain  | \[1.46, 0.69, 3.26, -0.17]  | 636         | Champlin and Sons | 10000        | 100251         | MORTGAGE        | 10                 | 0                             | 3                                |

#### Schema

```python
schema = px.Schema(
    prediction_label_column_name="predicted",
    actual_label_column_name="target",
    embedding_feature_column_names={
        "transaction_embeddings": px.EmbeddingColumnNames(
            vector_column_name="embedding_vector"
        ),
    },
)
```

{% hint style="info" %}
The features in this example are [implicitly inferred](define-your-schema.md#implicit-features) to be the columns of the DataFrame that do not appear in the schema.
{% endhint %}

{% hint style="warning" %}
To compare embeddings, Phoenix uses metrics such as Euclidean distance that can only be computed between vectors of the same length. Ensure that all embedding vectors for a particular embedding feature are one-dimensional arrays of the same length, otherwise, Phoenix will throw an error.
{% endhint %}

### Embeddings of Images

If your embeddings represent images, you can provide links or local paths to image files you want to display in the app by using the `link_to_data_column_name` field on `px.EmbeddingColumnNames`. The following example contains data for an image classification model that detects product defects on an assembly line.

#### DataFrame

| defective | image                               | image\_vector                     |
| --------- | ----------------------------------- | --------------------------------- |
| okay      | https://www.example.com/image0.jpeg | \[1.73, 2.67, 2.91, 1.79, 1.29]   |
| defective | https://www.example.com/image1.jpeg | \[2.18, -0.21, 0.87, 3.84, -0.97] |
| okay      | https://www.example.com/image2.jpeg | \[3.36, -0.62, 2.40, -0.94, 3.69] |
| defective | https://www.example.com/image3.jpeg | \[2.77, 2.79, 3.36, 0.60, 3.10]   |
| okay      | https://www.example.com/image4.jpeg | \[1.79, 2.06, 0.53, 3.58, 0.24]   |

#### Schema

```python
schema = px.Schema(
    actual_label_column_name="defective",
    embedding_feature_column_names={
        "image_embedding": px.EmbeddingColumnNames(
            vector_column_name="image_vector",
            link_to_data_column_name="image",
        ),
    },
)
```

#### Local Images

For local image data, we recommend the following steps to serve your images via a local HTTP server:

1. In your terminal, navigate to a directory containing your image data and run `python -m http.server 8000`.
2. Add URLs of the form "http://localhost:8000/rel/path/to/image.jpeg" to the appropriate column of your DataFrame.

For example, suppose your HTTP server is running in a directory with the following contents:

```python
.
└── image-data
    └── example_image.jpeg
```

Then your image URL would be http://localhost:8000/image-data/example\_image.jpeg.

### Embeddings of Text

If your embeddings represent pieces of text, you can display that text in the app by using the `raw_data_column_name` field on `px.EmbeddingColumnNames`. The embeddings below were generated by a sentiment classification model trained on product reviews.

#### DataFrame

| name                             | text                                                                     | text\_vector              | category          | sentiment |
| -------------------------------- | ------------------------------------------------------------------------ | ------------------------- | ----------------- | --------- |
| Magic Lamp                       | Makes a great desk lamp!                                                 | \[2.66, 0.89, 1.17, 2.21] | office            | positive  |
| Ergo Desk Chair                  | This chair is pretty comfortable, but I wish it had better back support. | \[3.33, 1.14, 2.57, 2.88] | office            | neutral   |
| Cloud Nine Mattress              | I've been sleeping like a baby since I bought this thing.                | \[2.5, 3.74, 0.04, -0.94] | bedroom           | positive  |
| Dr. Fresh's Spearmint Toothpaste | Avoid at all costs, it tastes like soap.                                 | \[1.78, -0.24, 1.37, 2.6] | personal\_hygiene | negative  |
| Ultra-Fuzzy Bath Mat             | Cheap quality, began fraying at the edges after the first wash.          | \[2.71, 0.98, -0.22, 2.1] | bath              | negative  |

#### Schema

```python
schema = px.Schema(
    actual_label_column_name="sentiment",
    feature_column_names=[
        "category",
    ],
    tag_column_names=[
        "name",
    ],
    embedding_feature_column_names={
        "product_review_embeddings": px.EmbeddingColumnNames(
            vector_column_name="text_vector",
            raw_data_column_name="text",
        ),
    },
)
```

### Multiple Embedding Features

Sometimes it is useful to have more than one embedding feature. The example below shows a multi-modal application in which one embedding represents the textual description and another embedding represents the image associated with products on an e-commerce site.

#### DataFrame

| name                             | description                                                                                                                                        | description\_vector         | image                               | image\_vector                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------- | --------------------------------- |
| Magic Lamp                       | Enjoy the most comfortable setting every time for working, studying, relaxing or getting ready to sleep.                                           | \[2.47, -0.01, -0.22, 0.93] | https://www.example.com/image0.jpeg | \[2.42, 1.95, 0.81, 2.60, 0.27]   |
| Ergo Desk Chair                  | The perfect mesh chair, meticulously developed to deliver maximum comfort and high quality.                                                        | \[-0.25, 0.07, 2.90, 1.57]  | https://www.example.com/image1.jpeg | \[3.17, 2.75, 1.39, 0.44, 3.30]   |
| Cloud Nine Mattress              | Our Cloud Nine Mattress combines cool comfort with maximum affordability.                                                                          | \[1.36, -0.88, -0.45, 0.84] | https://www.example.com/image2.jpeg | \[-0.22, 0.87, 1.10, -0.78, 1.25] |
| Dr. Fresh's Spearmint Toothpaste | Natural toothpaste helps remove surface stains for a brighter, whiter smile with anti-plaque formula                                               | \[-0.39, 1.29, 0.92, 2.51]  | https://www.example.com/image3.jpeg | \[1.95, 2.66, 3.97, 0.90, 2.86]   |
| Ultra-Fuzzy Bath Mat             | The bath mats are made up of 1.18-inch height premium thick, soft and fluffy microfiber, making it great for bathroom, vanity, and master bedroom. | \[0.37, 3.22, 1.29, 0.65]   | https://www.example.com/image4.jpeg | \[0.77, 1.79, 0.52, 3.79, 0.47]   |

#### Schema

```python
schema = px.Schema(
    tag_column_names=["name"],
    embedding_feature_column_names={
        "description_embedding": px.EmbeddingColumnNames(
            vector_column_name="description_vector",
            raw_data_column_name="description",
        ),
        "image_embedding": px.EmbeddingColumnNames(
            vector_column_name="image_vector",
            link_to_data_column_name="image",
        ),
    },
)
```

{% hint style="info" %}
Distinct embedding features may have embedding vectors of differing length. The text embeddings in the above example have length 4 while the image embeddings have length 5.
{% endhint %}
