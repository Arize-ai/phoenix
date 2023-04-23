---
description: Take your first flight with Phoenix in your Jupyter or Colab notebook
---

# Tabular Data

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb)

Install Phoenix and Arize auto-embeddings.

```python
!pip install -q arize-phoenix "arize[AutoEmbeddings]"
```

Import dependencies.

```python
from arize.pandas.embeddings.tabular_generators import EmbeddingGeneratorForTabularFeatures
import pandas as pd
import phoenix as px
import torch
```

Download your training and production data from a fraud detection model.

```python
train_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/structured/credit-card-fraud/credit_card_fraud_train.parquet",
)
prod_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/structured/credit-card-fraud/credit_card_fraud_production.parquet",
)
train_df.head()
```

| index | fico\_score | loan\_amount | term      | interest\_rate | installment | grade | home\_ownership | annual\_income | verification\_status | pymnt\_plan | ... | actual\_label | predicted\_label | predicted\_score | prediction\_id                       | age | state | merchant\_ID    | merchant\_risk\_score | prediction\_timestamp | tabular\_vector                                    |
| ----- | ----------- | ------------ | --------- | -------------- | ----------- | ----- | --------------- | -------------- | -------------------- | ----------- | --- | ------------- | ---------------- | ---------------- | ------------------------------------ | --- | ----- | --------------- | --------------------- | --------------------- | -------------------------------------------------- |
| 0     | 616         | 20700.0      | 36 months | 13.33          | 700.76      | C     | OWN             | 7172387        | Source Verified      | n           | ... | not\_fraud    | not\_fraud       | 0.097716         | a19d989d-76ee-416d-b832-bc7bdae1c810 | 20  | CA    | Leannon Ward    | 23                    | 1.669853e+09          | \[-0.3837759, -0.30560106, 0.43840367, 0.002096... |
| 1     | 642         | 12000.0      | 36 months | 13.33          | 406.24      | C     | RENT            | 7590130        | Not Verified         | n           | ... | not\_fraud    | not\_fraud       | 0.149905         | 0234fe86-c01f-452b-9c8b-2809306a5a6f | 86  | CA    | Kirlin and Sons | 17                    | 1.669853e+09          | \[-0.36309245, -0.2509997, 0.38966152, 0.008986... |
| 2     | 543         | 12000.0      | 36 months | 15.27          | 417.58      | C     | OWN             | 48249          | Not Verified         | n           | ... | not\_fraud    | not\_fraud       | 0.209666         | 8aab2000-bbf0-4b12-9b83-c88a45bf3501 | 51  | TX    | Reilly LLC      | 78                    | 1.669853e+09          | \[-0.3961212, -0.32158342, 0.44024423, 0.038749... |
| 3     | 616         | 7500.0       | 36 months | 9.99           | 241.97      | B     | OWN             | 94880          | Not Verified         | n           | ... | uncertain     | uncertain        | 0.147598         | 6f24df12-5531-4557-a11e-e9baa312ad75 | 25  | TX    | Schiller Ltd    | 49                    | 1.669853e+09          | \[-0.37020123, -0.28127947, 0.44664872, 0.01211... |
| 4     | 614         | 10800.0      | 36 months | 8.39           | 340.38      | A     | LEASE           | 83848          | Not Verified         | n           | ... | not\_fraud    | fraud            | 0.173840         | 047817c6-4113-429f-8db3-1a502f8b0fe8 | 29  | TX    | Schiller Ltd    | 64                    | 1.669853e+09          | \[-0.39094505, -0.2960744, 0.44086558, -0.01314... |

The columns of the DataFrame are:

* **prediction\_id:** the unique ID for each prediction
* **prediction\_timestamp:** the timestamps of your predictions
* **predicted\_label:** the label your model predicted
* **predicted\_score:** the score of each prediction
* **actual\_label:** the true, ground-truth label for each prediction (fraud vs. not\_fraud)
* **tabular\_vector:** pre-computed tabular embeddings for each row of data
* **age:** a tag used to filter your data in the Phoenix UI
* the rest of the columns are features

The cell below computes embeddings for your tabular data from scratch if you have a CUDA-enabled GPU; otherwise, use the pre-computed embeddings downloaded with the rest of your data.

```python
feature_column_names = [
    "fico_score",
    "loan_amount",
    "term",
    "interest_rate",
    "installment",
    "grade",
    "home_ownership",
    "annual_income",
    "verification_status",
    "pymnt_plan",
    "addr_state",
    "dti",
    "delinq_2yrs",
    "inq_last_6mths",
    "mths_since_last_delinq",
    "mths_since_last_record",
    "open_acc",
    "pub_rec",
    "revol_bal",
    "revol_util",
    "state",
    "merchant_ID",
    "merchant_risk_score",
]

if torch.cuda.is_available():
    generator = EmbeddingGeneratorForTabularFeatures(
        model_name="distilbert-base-uncased",
    )
    train_df["tabular_vector"] = generator.generate_embeddings(
        train_df,
        selected_columns=feature_column_names,
    )
    prod_df["tabular_vector"] = generator.generate_embeddings(
        prod_df,
        selected_columns=feature_column_names,
    )
else:
    print("CUDA is not available. Using pre-computed embeddings.")
```

Define your schema.

```python
schema = px.Schema(
    prediction_id_column_name="prediction_id",
    prediction_label_column_name="predicted_label",
    prediction_score_column_name="predicted_score",
    actual_label_column_name="actual_label",
    timestamp_column_name="prediction_timestamp",
    feature_column_names=feature_column_names,
    tag_column_names=["age"],
    embedding_feature_column_names={
        "tabular_embedding": px.EmbeddingColumnNames(
            vector_column_name="tabular_vector",
        ),
    },
)
```

Define your primary and reference datasets.

```python
prod_ds = px.Dataset(dataframe=prod_df, schema=schema, name="production")
train_ds = px.Dataset(dataframe=train_df, schema=schema, name="training")
```

Launch Phoenix.

```python
session = px.launch_app(primary=prod_ds, reference=train_ds)
```

Open Phoenix by copying and pasting the output of `session.url` into a new browser tab.

```python
session.url
```

Alternatively, open the Phoenix UI in your notebook.

```python
session.view()
```

Navigate to the embeddings page. Select a period of high drift. Select a drifted cluster. Color your data by the `merchant_ID` feature. Select a cluster of drifted production data. Notice that much of this data consists of fraudulent transactions from the Scammeds merchant. Export the cluster.

View your most recently exported data as a DataFrame.

```python
export_df = session.exports[-1]
export_df.head()
```

| index | fico\_score | loan\_amount | term      | interest\_rate | installment | grade | home\_ownership | annual\_income | verification\_status | pymnt\_plan | ... | actual\_label | predicted\_label | predicted\_score | prediction\_id                       | age | state | merchant\_ID | merchant\_risk\_score | prediction\_timestamp            | tabular\_vector                                    |
| ----- | ----------- | ------------ | --------- | -------------- | ----------- | ----- | --------------- | -------------- | -------------------- | ----------- | --- | ------------- | ---------------- | ---------------- | ------------------------------------ | --- | ----- | ------------ | --------------------- | -------------------------------- | -------------------------------------------------- |
| 0     | 599         | 24000.0      | 36 months | 9.17           | 765.10      | B     | MORTGAGE        | 37273          | Verified             | n           | ... | fraud         | not\_fraud       | 1.000000         | c3d671ab-378b-4c5a-908c-7ba758137097 | 47  | CA    | Scammeds     | 79.0                  | 2023-01-24 01:00:38.098000+00:00 | \[-0.37643525, -0.29411978, 0.4526869, 0.007012... |
| 1     | 503         | 10800.0      | 36 months | 18.79          | 394.74      | E     | RENT            | 35791          | Verified             | n           | ... | fraud         | not\_fraud       | 0.998413         | 06338a33-2af4-4d36-b26d-9cbcef26ed7b | 42  | CA    | Scammeds     | 65.0                  | 2023-01-24 01:02:57.534000+00:00 | \[-0.355947, -0.25465658, 0.46187162, 0.0156519... |
| 2     | 551         | 16000.0      | 60 months | 12.69          | 361.52      | C     | MORTGAGE        | 46799          | Verified             | n           | ... | fraud         | not\_fraud       | 0.859242         | 6143a1a7-07c5-4e29-b9df-2a5cf9cc7b61 | 92  | FL    | Scammeds     | 75.0                  | 2023-01-24 01:06:26.689000+00:00 | \[-0.38369793, -0.31040847, 0.47383925, 0.01653... |
| 3     | 595         | 18375.0      | 60 months | 22.40          | 511.69      | E     | RENT            | 48022          | Verified             | n           | ... | not\_fraud    | fraud            | 0.133351         | f59a5272-811b-413c-b7d7-7e6fac6b1dc3 | 69  | CA    | Scammeds     | 67.0                  | 2023-01-24 01:09:55.843000+00:00 | \[-0.37594548, -0.28427985, 0.4825426, 0.033805... |
| 4     | 317         | 10800.0      | 36 months | 12.29          | 360.22      | C     | MORTGAGE        | 6161           | Verified             | n           | ... | not\_fraud    | not\_fraud       | 0.218005         | ad30dbcb-b25c-4bda-8d06-ea312f80ff0c | 38  | OH    | Scammeds     | 94.0                  | 2023-01-24 01:19:13.589000+00:00 | \[-0.36684346, -0.28798828, 0.4652715, 0.032788... |

Close the app.

```python
px.close_app()
```

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](../concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](notebooks.md)
* Learn how to [use Phoenix with your own data](../how-to/define-your-schema.md) and how to [manage the app](../how-to/manage-the-app.md)
