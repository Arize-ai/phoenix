# Generating Embeddings

### What are Auto-Embeddings?

Generating embeddings is likely another problem to solve, on top of ensuring your model is performing properly. With our Python SDK, you can offload that task to the SDK and we will generate the embeddings for you. We use large, pre-trained models that will capture information from your inputs and encode it into embedding vectors.&#x20;

Phoenix supports any type of dense embedding generated for almost any type of data.

We also support generating embeddings for you for the following types of data:

* CV - Computer Vision&#x20;
* NLP - Natural Language&#x20;
* Tabular Data - Pandas DataFrames&#x20;

We extract the embeddings in the appropriate way depending on your use case, and we return it to you to include in your pandas DataFrame, which you can then analyze using Phoenix.

Auto-Embeddings works end-to-end, you don't have to worry about formatting your inputs for the correct model. By simply passing your input, an embedding will come out as a result. We take care of everything in between.

#### How to enable Auto-Embeddings?

If you want to use this functionality as part of our Python SDK, you need to install it with the extra dependencies using `pip install arize[AutoEmbeddings]`.

#### Supported models

You can get an updated table listing of supported models by running the line below.

```python
from arize.pandas.embeddings import EmbeddingGenerator

EmbeddingGenerator.list_pretrained_models()
```

{% hint style="info" %}
We are constantly innovating, so if you want other models included, reach out to us at support@arize.com or in our community Slack!
{% endhint %}

### How do they work?

Auto-Embeddings is designed to require minimal code from the user. We only require two steps:

1. **Create the generator**: you simply instantiate the generator using `EmbeddingGenerator.from_use_case()` and passing information about your use case, the model to use, and more options depending on the use case; see examples below.
2. **Let Arize generate your embeddings**: obtain your embeddings column by calling `generator.generate_embedding()` and passing the column containing your inputs; see examples below.

### Use Case Examples

{% hint style="warning" %}
Arize expects the DataFrame's index to be sorted and begin at 0. If you perform operations that might affect the index prior to generating embeddings, reset the index as follows:

```python
df = df.reset_index(drop=True)
```
{% endhint %}

{% tabs %}
{% tab title="CV" %}
```python
from arize.pandas.embeddings import EmbeddingGenerator, UseCases

df = df.reset_index(drop=True)

generator = EmbeddingGenerator.from_use_case(
    use_case=UseCases.CV.IMAGE_CLASSIFICATION,
    model_name="google/vit-base-patch16-224-in21k",
    batch_size=100
)
df["image_vector"] = generator.generate_embeddings(
    local_image_path_col=df["local_path"]
)
```
{% endtab %}

{% tab title="NLP" %}
```python
from arize.pandas.embeddings import EmbeddingGenerator, UseCases

df = df.reset_index(drop=True)

generator = EmbeddingGenerator.from_use_case(
    use_case=UseCases.NLP.SEQUENCE_CLASSIFICATION,
    model_name="distilbert-base-uncased",
    tokenizer_max_length=512,
    batch_size=100
)
df["text_vector"] = generator.generate_embeddings(text_col=df["text"])
```
{% endtab %}

{% tab title="Tabular Data - Pandas DataFrame" %}
<pre class="language-python"><code class="lang-python">from arize.pandas.embeddings import EmbeddingGenerator, UseCases
<strong>
</strong><strong>df = df.reset_index(drop=True)
</strong># Instantiate the embeddding generator
generator = EmbeddingGeneratorForTabularFeatures(
    model_name="distilbert-base-uncased",
    tokenizer_max_length=512
)

# Select the columns from your dataframe to consider
selected_cols = [...]

# (Optional) Provide a mapping for more verbose column names
column_name_map = {...: ...}

# Generate tabular embeddings and assign them to a new column
df["tabular_embedding_vector"] = generator.generate_embeddings(
    df,
    selected_columns=selected_cols,
    col_name_map=column_name_map # (OPTIONAL, can remove)
)
</code></pre>
{% endtab %}
{% endtabs %}
