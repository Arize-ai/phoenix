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

Embedding features consist of vector data in addition to any unstructured data in the form of text or images that the vectors represent. Unlike normal features, a single embedding feature may span multiple columns of your DataFrame. Use `px.EmbeddingColumnNames` to associate multiple DataFrame columns with the same embedding feature.

{% hint style="info" %}
* For a conceptual overview of embeddings, see [Embeddings](../concepts/embeddings.md).
* For a comprehensive description of `px.EmbeddingColumnNames`, see the [API reference](../reference/api/phoenix.schema/phoenix.embeddingcolumnnames.md).
{% endhint %}

{% hint style="info" %}
The example in this section contain low-dimensional embeddings for the sake of easy viewing. Your embeddings in practice will typically have much higher dimension.
{% endhint %}

### Embedding Vectors

To define an embedding feature, you must at minimum provide Phoenix with the embedding vector data itself. Specify the DataFrame column that contains this data in the `vector_column_name` field on `px.EmbeddingColumnNames`. For example, the DataFrame below contains tabular credit card transaction data in addition to embedding vectors that represent each row. Notice that:

* Unlike other fields that take strings or lists of strings, the argument to `embedding_feature_column_names` is a dictionary.
* The key of this dictionary, "transaction\_embedding," is not a column of your DataFrame but is name you choose for your embedding feature that appears in the UI.
* The values of this dictionary are instances of `px.EmbeddingColumnNames`.
* Each entry in the "embedding\_vector" column is a one-dimensional Numpy array of length 4.

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
Ensure that all embedding vectors for a particular embedding feature are one-dimensional arrays of the same length, otherwise, Phoenix will throw an error.
{% endhint %}

### Embeddings of Images

If your embeddings represent images, you can provide links or local paths to image files you want to display in the app by using the `link_to_data_column_name` field on `px.EmbeddingColumnNames`. The following example contains data for an image classification model that detects product defects on an assembly line.

#### DataFrame

| defective | image                                       | image\_embedding                  |
| --------- | ------------------------------------------- | --------------------------------- |
| okay      | /path/to/your/first/image0.jpeg             | \[1.73, 2.67, 2.91, 1.79, 1.29]   |
| defective | /path/to/your/second/image1.jpeg            | \[2.18, -0.21, 0.87, 3.84, -0.97] |
| okay      | https://\<your-domain-here>.com/image2.jpeg | \[3.36, -0.62, 2.40, -0.94, 3.69] |
| defective | https://\<your-domain-here>.com/image3.jpeg | \[2.77, 2.79, 3.36, 0.60, 3.10]   |
| okay      | https://\<your-domain-here>.com/image4.jpeg | \[1.79, 2.06, 0.53, 3.58, 0.24]   |

#### Schema

```python
schema = px.Schema(
    actual_label_column_name="defective",
    embedding_feature_column_names={
        "product_image_embedding": px.EmbeddingColumnNames(
            vector_column_name="image_embedding",
            link_to_data_column_name="image",
        ),
    },
)
```

### Embeddings of Text

If your embeddings represent pieces of text, you can display that text in the app by using the `raw_data_column_name` field on `px.EmbeddingColumnNames`. The embeddings below were generated by a sentiment classification model trained on product reviews.

#### DataFrame

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>name</th>
      <th>category</th>
      <th>sentiment</th>
      <th>text</th>
      <th>text_vector</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Magic Lamp</td>
      <td>office</td>
      <td>positive</td>
      <td>This is the best desk light I have had. So glad I chose this one. 3 types of light from bright, to more of a normal light, to a tinted softer light. Also it can be angled in such a versatile way to not shine in your eyes. I love the plug in features with two places to plug things in on the base and ability to plug in a USB as well. I would highly recommend this light. I work at home all hours and it adds just the right amount of light for my work surface.</td>
      <td>[3.53, 3.22, 2.74, -0.79]</td>
    </tr>
    <tr>
      <td>Ergo Desk Chair</td>
      <td>office</td>
      <td>neutral</td>
      <td>This office chair sits nice and high, which I like, but the seat is SO BROAD (both front to back and side to side) that when I sit far enough back to take advantage of the lumbar support, my feet don't touch the ground (I'm 5'7" with long legs - I'm not short or weirdly proportioned or anything). My desks height requires I keep the chair at its highest setting to type comfortably, so there's that. The lumbar support height is adjustable, but not nearly deep enough - perhaps the chair needs breaking in, but I can barely touch the lumbar support through the back mesh (maybe I don't weigh enough?). No matter how I adjust the tilt tension knob the seat DOESN'T recline, but has this sort of back-and-forth ricketiness that allows you an inch or so of movement (maybe I really DON'T weigh enough!). The height adjustment lever is meant to be twisted, not lifted (as the instructions say) - took me a bit to figure that out. Overall - the primary reason I got this chair was for the lumbar support and height adjustment, but I feel like I'm sitting in a chair that was built for a MUCH larger human than myself. You get what you pay for.</td>
      <td>[2.21, 1.34, -0.39, 1.87]</td>
    </tr>
    <tr>
      <td>Cloud Nine Mattress</td>
      <td>bedroom</td>
      <td>positive</td>
      <td>I bought the 6 inch version and after it arrived while it was 'unpacking' itself I thought it might not be enough, but turns out I was wrong. I have it on a metal frame and thought it might be too thin, but with myself at 5' 8" and 190 pounds, along with three large dogs 70lbs+ it holds up great. It is very comfortable and I sleep very well on it, the only thing if you have the metal frame like I do is make sure you take the sticky tape off or the mattress slides too easily.</td>
      <td>[0.44, 0.14, 3.69, 2.26]</td>
    </tr>
    <tr>
      <td>Dr. Fresh's Spearmint Toothpaste</td>
      <td>personal_hygiene</td>
      <td>negative</td>
      <td>I purchased this two-pack of a toothpaste I really like. What I received had less than thirty days before its expiration date. Seriously folks, all this does is create a problem. It's going to take $20 worth of time and effort to return one really dreadfully fulfilled $8 order. Please be better than this.</td>
      <td>[1.53, 3.84, 3.91, 2.33]</td>
    </tr>
    <tr>
      <td>Ultra-Fuzzy Bath Mat</td>
      <td>bath</td>
      <td>negative</td>
      <td>I guess I was expecting this to be a little bigger then what it is. It's very pretty and really soft and it seems to absorb as described. It's slippery on the bare floor which is not good at all!!! The only way I would continue to use this is if I put it on top of another rug that's way bigger to cover more area of the bathroom. But after all you get what you pay for!!</td>
      <td>[3.93, 2.23, -0.57, 1.20]</td>
    </tr>
  </tbody>
</table>

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

Sometimes it is useful to have more than one embedding feature for the same data. This is often the case with multi-modal applications in which one embedding represents the text and another embedding represents the image associated with a particular data point. The example below has both image and text embeddings for products in an e-commerce site.&#x20;

#### DataFrame

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>name</th>
      <th>description</th>
      <th>description_vector</th>
      <th>image</th>
      <th>image_vector</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Magic Lamp</td>
      <td>Multiple Functions: Equipped 1 Port USB Charger, 2 Outlet Power Strip(1250W), memory function, 3 light modes, 3 brightness Levels dimmable, 60-minute timer. College dorm room essentials for students.\nEye Care Dimmable Tech: Magic lamp is optimized for each activity. Enjoy the most comfortable setting every time for working, studying, relaxing or getting ready to sleep.\n1 Port Smart USB Charger: Extra USB port allow you to charge your smartphone, ipad, tablet or other smart device without plug in wall, handy, conveniently and organized. It can detects your device automatically to deliver its fastest possible charge speed up to 2.4 amps.\n2 Safe Outlet Power Socket: You can charge your laptops, printers,bluetooth speakers and other devices with this outlets power strip. The Total Output of this AC Outlet is 1250W.\nQUALITY GUARANTEE: We provide 90-Day Money Back Guarantee and 24-month warranty. If there is any quality issue for this desk lamp or you are not happy with your purchase, please do not hesitate to contact us. We will do our best to help you</td>
      <td>[-0.79, 3.77, 2.96, 0.81]</td>
      <td>/path/to/your/first/image0.jpeg</td>
      <td>[-0.10, 1.94, 1.24, 1.95, 0.51]</td>
    </tr>
    <tr>
      <td>Ergo Desk Chair</td>
      <td>2022 NEW LAUNCH: The perfect mesh chair with padded armrests that flip up for versatility. Meticulously developed to deliver maximum comfort and high quality. Designed for every space in mind.\nStrong Support: Back support is made of breathable woven mesh that hugs your lower back and promotes an ergonomic upright posture.\nComfy Cushion: This well-balanced seat delivers reliable comfort all day long. Not too firm not too soft just right. Breeze through working gaming and focusing on your desk.\nEasy Assembly: Specifically made to be hassle-free! Assemble under 15 minutes with our molded backrest and armrest frames that fit right onto each other. Designed by NEO CHAIR.\nTwo Modes: Armrests UP: Sit more freely cross your legs or easily stow under your desk. Armrests DOWN: Rest your arms on the soft padded armrests for extra support while you focus.</td>
      <td>[0.68, 3.32, 1.06, -0.12]</td>
      <td>/path/to/your/second/image1.jpeg</td>
      <td>[0.43, -0.63, 3.41, -0.34, 2.54]</td>
    </tr>
    <tr>
      <td>Cloud Nine Mattress</td>
      <td>Our Cloud Nine Mattress combines cool comfort with maximum affordability. Made to soothe you to sleep, this supportive foam mattress features an extra line of defense for hot sleepers. The secret to its comfy, cooling success? Cozy layers of supportive memory foam wrapped in a plush cover that breathes well to help regulate your body temperature while you snooze. Its dependable high-density foam layers are designed with durability and a feel that's not too soft and not too firm-perfect for all types of sleeping positions. Plus, like all of our mattresses, it arrives at your door compressed and rolled into one compact box. And despite its extremely reasonable price tag, the Cloud Nine Mattress still includes our 10 year worry-free warranty, so you get extra peace of mind when cozying up on top of it. If you're a fan of sound, comfortable sleep and a good value (like us), then this mattress will live up to your every expectation.</td>
      <td>[3.02, 0.87, 3.36, 1.57]</td>
      <td>https://&lt;your-domain-here&gt;.com/image2.jpeg</td>
      <td>[0.92, -0.49, 1.59, 0.63, 3.73]</td>
    </tr>
    <tr>
      <td>Dr. Fresh's Spearmint Toothpaste</td>
      <td>WHAT YOU'LL GET: Two 5.5-ounce tubes of Dr. Fresh's Spearmint Toothpaste\nFLUORIDE-FREE TOOTHPASTE: Helps fight tartar buildup with anti-plaque formula\nWHITEN TEETH: Natural toothpaste helps remove surface stains for a brighter, whiter smile\nRECYCLABLE TUBE: Look for the blue recycling flag, squeeze out as much toothpaste as you can, replace the cap, and recycle\nTAKE CARE OF YOURSELF NATURALLY: Contains no artificial sweeteners, preservatives, colors or flavors and is not tested on animals</td>
      <td>[3.89, 2.87, 3.16, 0.37]</td>
      <td>https://&lt;your-domain-here&gt;.com/image3.jpeg</td>
      <td>[1.02, 0.21, 3.74, 2.20, 2.24]</td>
    </tr>
    <tr>
      <td>Ultra-Fuzzy Bath Mat</td>
      <td>Heavy Density Microfiber: The bath mats are made up of 1.18-inch height premium thick, soft and fluffy microfiber, where with the help of unique fiber locking technique, the fluff is thicker, making it great for bathroom, vanity, vacation home, master bedroom, kids' bathroom, guest suite.\nNon-Skid TPR Backing: The mat is equipped with TP rubber backing and not PVC or glue, to provide you with slip free experience and durability. Please note not to place the mat on wet surface and make sure that the floors are dry underneath the rug, to prevent slippage.\nUltra-Absorbent &amp; Quick Dry: The soft shaggy microfiber fabric, will not let the water drip on to the floors, when you are stepping out of your bath, shower or getting ready by the sink. Further, there is moisture trapped inside the mat's deep pile, which allows the rug to dry quickly and cleanly.\nEasy Maintenance: OLANLY bathroom mats can be machine washed separately with cold water, mild detergent which has no chlorine or bleach and tumble dry on low speed or hang dry. Also, the color will not fade and will stay vibrant for many years even with after washing and drying many times.\nBeautiful Decor, Gifting &amp; Multipurpose: The mats have unique gradient color stripe design, to provide beautiful decor to nearly any space in your bathroom. The mats work perfectly in front of your single or double sink, shower, bathtub or anywhere you want to have support and warmth for your feet. Further, the mats make a perfect gifting choice for your friends and family during Christmas, Mother's Day, Father's Day or any other special occasion.</td>
      <td>[0.21, 3.83, 1.36, 3.90]</td>
      <td>https://&lt;your-domain-here&gt;.com/image4.jpeg</td>
      <td>[3.81, -0.65, -0.41, -0.94, 1.86]</td>
    </tr>
  </tbody>
</table>

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
