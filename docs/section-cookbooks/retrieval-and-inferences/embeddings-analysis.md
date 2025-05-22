# Embeddings Analysis

## Embedding Details <a href="#embedding-details" id="embedding-details"></a>

For each [embedding](https://docs.arize.com/phoenix/inferences/use-cases-inferences/embeddings-analysis#embeddings) described in the inference [schema](https://github.com/Arize-ai/phoenix/blob/main/docs/inferences/use-cases-inferences/broken-reference/README.md)(s), Phoenix serves a embeddings troubleshooting view to help you identify areas of drift and performance degradation. Let's start with embedding drift.

<figure><img src="https://docs.arize.com/~gitbook/image?url=https%3A%2F%2Fstorage.googleapis.com%2Farize-assets%2Fphoenix%2Fassets%2Fimages%2Fner_color_by_correctness.png&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=3568e353&#x26;sv=2" alt=""><figcaption></figcaption></figure>

## Embedding Drift Over Time <a href="#embedding-drift-over-time" id="embedding-drift-over-time"></a>

The picture below shows a time series graph of the drift between two groups of vectors –- the primary (typically production) vectors and reference / baseline vectors. Phoenix uses euclidean distance as the primary measure of embedding drift and helps us identify times where your inference set is diverging from a given reference baseline.

Note that when you are troubleshooting search and retrieval using [corpus](https://docs.arize.com/phoenix/inferences/how-to-inferences/define-your-schema/corpus-data) inferences, the euclidean distance of your queries to your knowledge base vectors is presented as **query distance.**

<figure><img src="https://docs.arize.com/~gitbook/image?url=https%3A%2F%2Fstorage.googleapis.com%2Farize-assets%2Fphoenix%2Fassets%2Fimages%2Feuclidean_distance_timeseries_graph.png&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=7991f28e&#x26;sv=2" alt=""><figcaption><p>Euclidean distance over time</p></figcaption></figure>

Moments of high euclidean distance is an indication that the primary inference set is starting to drift from the reference inference set. As the primary inferences move further away from the reference (both in angle and in magnitude), the euclidean distance increases as well. For this reason times of high euclidean distance are a good starting point for trying to identify new anomalies and areas of drift.

<figure><img src="https://docs.arize.com/~gitbook/image?url=https%3A%2F%2Fstorage.googleapis.com%2Farize-assets%2Fphoenix%2Fassets%2Fimages%2Feuclidean_distance_vectors.png&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=631c6eef&#x26;sv=2" alt=""><figcaption><p>Centroids of the two inferences are used to calculate euclidean and cosine distance</p></figcaption></figure>

For an in-depth guide of euclidean distance and embedding drift, check out[ Arze's ML course](https://arize.com/blog-course/embedding-drift-euclidean-distance/)

In Phoenix, you can views the drift of a particular embedding in a time series graph at the top of the page. To diagnose the cause of the drift, click on the graph at different times to view a breakdown of the embeddings at particular time.

<figure><img src="https://docs.arize.com/~gitbook/image?url=https%3A%2F%2Fstorage.googleapis.com%2Farize-assets%2Fphoenix%2Fassets%2Fimages%2Feuclidean_distance_click_cta.png&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=2c49621e&#x26;sv=2" alt=""><figcaption><p>Click on a particular time to view why the inference embeddings are drifting</p></figcaption></figure>

## Clusters <a href="#clusters" id="clusters"></a>

Phoenix automatically breaks up your embeddings into groups of inferences using a clustering algorithm called [HDBSCAN](https://hdbscan.readthedocs.io/en/latest/index.html). This is particularly useful if you are trying to identify areas of your embeddings that are drifting or performing badly.

<figure><img src="https://docs.arize.com/~gitbook/image?url=https%3A%2F%2Fstorage.googleapis.com%2Farize-assets%2Fphoenix%2Fassets%2Fimages%2FHDBSCAN_drift_analysis.png&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=d2e19e04&#x26;sv=2" alt=""><figcaption></figcaption></figure>

When twos are used to initialize phoenix, the clusters are automatically ordered by drift. This means that clusters that are suffering from the highest amount of under-sampling (more in the primary inferences than the reference) are bubbled to the top. You can click on these clusters to view the details of the points contained in each cluster.

## UMAP Point-Cloud <a href="#umap-point-cloud" id="umap-point-cloud"></a>

Phoenix projects the embeddings you provided into lower dimensional space (3 dimensions) using a dimension reduction algorithm called [UMAP](https://github.com/lmcinnes/umap) (stands for Uniform Manifold Approximation and Projection). This lets us understand how your [embeddings have encoded semantic meaning](https://github.com/Arize-ai/phoenix/blob/main/docs/inferences/use-cases-inferences/broken-reference/README.md) in a visually understandable way.&#x20;

In addition to the point-cloud, another dimension we have at our disposal is color (and in some cases shape). Out of the box phoenix let's you assign colors to the UMAP point-cloud by dimension (features, tags, predictions, actuals), performance (correctness which distinguishes true positives and true negatives from the incorrect predictions), and inference (to highlight areas of drift). This helps you explore your point-cloud from different perspectives depending on what you are looking for.

<figure><img src="https://docs.arize.com/~gitbook/image?url=https%3A%2F%2Fstorage.googleapis.com%2Farize-assets%2Fphoenix%2Fassets%2Fimages%2Fumap_color_by.png&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=2fa4d9ef&#x26;sv=2" alt=""><figcaption><p>Color by inferences vs color by correctness vs color by prediction for a computer vision model</p></figcaption></figure>
