---
description: Meaning, Examples and How To Compute
---

# 🌌 Embeddings

### What's an embedding?

Embeddings are **vector representations** of information. (e.g. a list of floating point numbers). With embeddings, the distance between two vectors carry semantic meaning:  Small distances suggest high relatedness and large distances suggest low relatedness. Embeddings are everywhere in modern deep learning, such as transformers, recommendation engines, layers of deep neural networks, encoders, and decoders.

{% hint style="info" %}
**A simple example**: In an image, a color can be represented as the amount of red, green, blue, and transparency in the form of `rgba(255, 255, 255, 0)`.  This vector `[255, 255, 255, 0] not only encodes information`(the color white) but it carries meaning in space as well. Colors more similar to white are closer to the vector and points farther from this vector are less similar (e.x. black is \`\[0, 0, 0, 0]\`).&#x20;
{% endhint %}

### Why embeddings

Embeddings are foundational to machine learning because:

* Embeddings can represent various forms of data such as images, audio signals, and even large chunks of structured data.
* They provide a common mathematical representation of your data
* They compress data
* They preserve relationships within your data
* They are the output of deep learning layers providing comprehensible linear views into complex non-linear relationships learned by models\


Embeddings are used for a variety of machine learning problems. To learn more, chick out our course [here](https://arize.com/blog-course/embeddings-meaning-examples-and-how-to-compute/).\


### How to generate embeddings

\
Embedding vectors are generally extracted from the **activation values** of one or many hidden layers of your model. In general, there are many ways of obtaining embedding vectors, including:

1. Word embeddings
2. Autoencoder Embeddings
3. Generative Adversarial Networks (GANs)
4. Pre-trained Embeddings

Given the wide accessibility to pre-trained transformer models, we will focus on generating embeddings using them. These models are models such as BERT or GPT-x, models that are trained on a large datasets and that are fine-tuning them on a specific task.

\
Once  you have chosen a model to generate embeddings, the question is: _how?_ Here are few use-case based examples. In each example you will notice that the embeddings are generated such that the resulting vector represents your input according to your use case.

{% tabs %}
{% tab title="CV Image Classification" %}
If you are working on image classification, the model will take an image and classify it into a given set of categories. Each of our embedding vectors should be representative of the corresponding entire image input.

First, we need to use a `feature_extractor` that will take an image and prepare it for the large pre-trained image model.

```python
inputs = feature_extractor(
    [x.convert("RGB") for x in batch["image"]], 
    return_tensors="pt"
).to(device)
```

Then, we pass the results from the `feature_extractor` to our `model`. In PyTorch, we use `torch.no_grad()` since we don't need to compute the gradients for backward propagation, we are not training the model in this example.

```python
with torch.no_grad():
    outputs = model(**inputs)
```

It is imperative that these outputs contain the activation values of the hidden layers of the model since you will be using them to construct your embeddings. In this scenario, we will use just the last hidden layer.

```python
last_hidden_state = outputs.last_hidden_state
# last_hidden_state.shape = (batch_size, num_image_tokens, hidden_size)
```

Finally, since we want the embedding vector to represent the entire image, we will average across the second dimension, representing the areas of the image.

```
embeddings = torch.mean(last_hidden_state, 1).cpu().numpy()
```
{% endtab %}

{% tab title="NLP Classification" %}
If you are working on NLP sequence classification (for example, sentiment classification), the model will take a piece of text and classify it into a given set of categories. Hence, your embedding vector must represent the entire piece of text.

For this example, let us assume we are working with a model from the `BERT` family.

First, we must use a `tokenizer` that will the text and prepare it for the pre-trained large language model (LLM).

```python
inputs = {
        k: v.to(device) 
        for k,v in batch.items() if k in tokenizer.model_input_names
}
```

Then, we pass the results from the `tokenizer` to our `model`. In PyTorch, we use `torch.no_grad()` since we don't need to compute the gradients for backward propagation, we are not training the model in this example.

```python
with torch.no_grad():
    outputs = model(**inputs)
```

It is imperative that these outputs contain the activation values of the hidden layers of the model since you will be using them to construct your embeddings. In this scenario, we will use just the last hidden layer.

```python
last_hidden_state = outputs.last_hidden_state
# last_hidden_state.shape = (batch_size, num_tokens, hidden_size)
```

Finally, since we want the embedding vector to represent the entire piece of text for classification, we will use the vector associated with the classification token,`[CLS]`, as our embedding vector.&#x20;

```
embeddings = last_hidden_state[:,0,:].cpu().numpy()
```
{% endtab %}

{% tab title="NLP Name Entity Recognition" %}
f you are working on NLP Named Entity Recognition (NER), the model will take a piece of text and classify some words within it into a given set of entities. Hence, each of your embedding vectors must represent a classified word or token.

For this example, let us assume we are working with a model from the `BERT` family.

First, we must use a `tokenizer` that will the text and prepare it for the pre-trained large language model (LLM).

```python
inputs = {
        k: v.to(device) 
        for k,v in batch.items() if k in tokenizer.model_input_names
}
```

Then, we pass the results from the `tokenizer` to our `model`. In PyTorch, we use `torch.no_grad()` since we don't need to compute the gradients for backward propagation, we are not training the model in this example.

```python
with torch.no_grad():
    outputs = model(**inputs)
```

It is imperative that these outputs contain the activation values of the hidden layers of the model since you will be using them to construct your embeddings. In this scenario, we will use just the last hidden layer.

```python
last_hidden_state = outputs.last_hidden_state.cpu().numpy()
# last_hidden_state.shape = (batch_size, num_tokens, hidden_size)
```

Further, since we want the embedding vector to represent any given token, we will use the vector associated with a specific token in the piece of text as our embedding vector. So, let `token_index` be the integer value that locates the token of interest in the list of tokens that result from passing the piece of text to the `tokenizer`. Let `ex_index` the integer value that locates a given example in the batch. Then,

```
token_embedding = last_hidden_state[ex_index, token_index,:]
```
{% endtab %}
{% endtabs %}
