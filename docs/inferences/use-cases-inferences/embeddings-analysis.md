# Embeddings Analysis

### Embedding Details

For each [embedding](embeddings-analysis.md#embeddings) described in the inference [schema](../../api/dataset-and-schema.md)(s), Phoenix serves a embeddings troubleshooting view to help you identify areas of drift and performance degradation. Let's start with embedding drift.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/ner_color_by_correctness.png" alt=""><figcaption></figcaption></figure>

### Embedding Drift Over Time

The picture below shows a time series graph of the drift between two groups of vectors –- the primary (typically production) vectors and reference / baseline vectors. Phoenix uses euclidean distance as the primary measure of embedding drift and helps us identify times where your dataset is diverging from a given reference baseline.&#x20;

{% hint style="info" %}
Note that when you are troubleshooting search and retrieval using [corpus](../how-to-inferences/define-your-schema/corpus-data.md) inferences, the euclidean distance of your queries to your knowledge base vectors is presented as **query distance**&#x20;
{% endhint %}

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/euclidean_distance_timeseries_graph.png" alt="Euclidean distance over time graph"><figcaption><p>Euclidean distance over time</p></figcaption></figure>

Moments of high euclidean distance is an indication that the primary dataset is starting to drift from the reference dataset. As the primary inferences move further away from the reference (both in angle and in magnitude), the euclidean distance increases as well. For this reason times of high euclidean distance are a good starting point for trying to identify new anomalies and areas of drift.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/euclidean_distance_vectors.png" alt="Breakdown of euclidean distance - two centroids of points diverging"><figcaption><p>Centroids of the two datasets are used to calculate euclidean and cosine distance</p></figcaption></figure>

{% hint style="info" %}
For an in-depth guide of euclidean distance and embedding drift, check out[ Arze's ML course ](https://arize.com/blog-course/embedding-drift-euclidean-distance/)
{% endhint %}

In Phoenix, you can views the drift of a particular embedding in a time series graph at the top of the page. To diagnose the cause of the  drift, click on the graph at different times to view a breakdown of the embeddings at particular time.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/euclidean_distance_click_cta.png" alt="A time series graph of embeddings over time and a call to action to view details via a click"><figcaption><p>Click on a particular time to view why the inference embeddings are drifting</p></figcaption></figure>

### Clusters

Phoenix automatically breaks up your embeddings into groups of inferences using a clustering algorithm called [HDBSCAN](https://hdbscan.readthedocs.io/en/latest/index.html). This is particularly useful if you are trying to identify areas of your embeddings that are drifting or performing badly.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/HDBSCAN_drift_analysis.png" alt=""><figcaption></figcaption></figure>

When two datasets are used to initialize phoenix, the clusters are automatically ordered by drift. This means that clusters that are suffering from the highest amount of under-sampling (more in the primary dataset than the reference) are bubbled to the top. You can click on these clusters to view the details of the points contained in each cluster.&#x20;

### UMAP Point-Cloud

Phoenix projects the embeddings you provided into lower dimensional space (3 dimensions) using a dimension reduction algorithm called [UMAP](https://github.com/lmcinnes/umap) (stands for Uniform Manifold Approximation and Projection).  This lets us understand how your [embeddings have encoded semantic meaning](broken-reference) in a visually understandable way.\
\
In addition to the point-cloud, another dimension we have at our disposal is color (and in some cases shape). Out of the box phoenix let's you assign colors to the UMAP point-cloud by dimension (features, tags, predictions, actuals), performance (correctness which distinguishes true positives and true negatives from the incorrect predictions), and inference (to highlight areas of drift). This helps you explore your point-cloud from different perspectives depending on what you are looking for.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/umap_color_by.png" alt="Color by dataset vs color by correctness vs color by prediction for a computer vision model"><figcaption><p>Color by dataset vs color by correctness vs color by prediction for a computer vision model</p></figcaption></figure>
