# Open Inference

## Overview

The open inference data format is designed to provide an open interoperable data format for model inference files. Our goal is for modern ML systems, such as model servers and ML Observability platforms, to interface with each other using a common data format.\


The goal of this is to define a specification for production inference logs that can be used on top of many file formats including Parquet, Avro, CSV and JSON. It will also support future formats such as Lance.

<figure><img src="https://lh5.googleusercontent.com/tI-YqWsq9RbkrlhfDzbyVHMj45wPvtvyoEiwfkL-s6UM0eR2Xb2AN6YqR4jWaRrFZdBlgrsw_cJsMWbQBlfFMNELWSmYcM2b0B2WFYNVGhH_iS9I1R7QNzd_7XIpTUrcl8DP0lKIi1fEl--Ad81FZb4" alt=""><figcaption><p><strong>Inference Table in Inference Store</strong></p></figcaption></figure>

An inference store is a common approach to store model inferences, normally stored in a data lake or data warehouse.&#x20;

### Model Types Covered

**NLP**

* Text Generative - Prompt and Response
* Text Classification
*   NER Span Categorization

    ****

**Tabular:**

* Regression
* Classification&#x20;
* Classification + Score
* Multi-Classification
* Ranking&#x20;
* Multi-Output/Label
* Time Series Forecasting

**CV**

* Classification
* Bounding Box
*   Segmentation



### Inferences Overview&#x20;

In an inference store the prediction ID is a unique identifier for a model prediction event. The prediction ID defines the inputs to the model, model outputs, latently linked ground truth (actuals), meta data (tags) and model internals (embeddings and/or SHAP).&#x20;

In this section we will review a flat (non nested structure) prediction event, the following sections will cover how to handle nested structures.

<figure><img src="https://lh6.googleusercontent.com/tMg0bwe276Z7d-SGuieLBP5J4NPqyZCPSsc1vfSl_KCG_soLufPJ98syu4ijsFoZfa2BMejjtarmVS3G9UbJvwHhvHzBsJL_xGNV6HrOi3ai4XbKQiaP89MrroPiuKeAVjM-9soaJb4_mbDkuhVfMwI" alt=""><figcaption><p>Prediction Inference Event Data</p></figcaption></figure>



<figure><img src="https://lh6.googleusercontent.com/F1ll2Q1FfyaNmgQbTlWHIr-BrhRO9dvEbPhVC8Sqeq9bxcrh6ZCw-NfdTtsbdeis2wm_opRxblKdbNA_MYkzkian6qWBRme-JM1JbgUuBFPcSCrZHkGnfQrhdzioG7JlgIsY8TV0uERbqDjHPsMLl7w" alt=""><figcaption><p>LLM Inference Data</p></figcaption></figure>

A prediction event can represent a prompt response pair for LLMs where the conversation ID maintains the thread of conversation.&#x20;

\


<figure><img src="https://lh4.googleusercontent.com/PudqLcuRTJnYhXXS0hZj7XCA14TDWv-3WkUKyoSa0drmFZcG0KZo0WPQ8ieavNz-RuHUzvva-Ei1Z4D2kL0ROpkYkf5TlkNZr-sZBo1n5YmcBtEd2qGcxkDhW6dHahwirRaeOuatZzlaN6aa7Ym2jDI" alt=""><figcaption><p>Core Model Inference Data</p></figcaption></figure>

The core components of an inference event are the:

* Model input (features/prompt)
* Model output (prediction/response)
* Ground truth (actuals or latent actuals)
* Model ID
* Model Version
* Environment&#x20;
* Conversation ID

Additional data that may be contained include:

* Metadata&#x20;
* SHAP values&#x20;
* Embeddings&#x20;
* Raw links to data&#x20;
* Bounding boxes

The fundamental storage unit in an inference store is an inference event. These events are stored in groups that are logically separated by model ID, model version and environment.

<figure><img src="https://lh5.googleusercontent.com/V_xkGRjd6sa54rbJjtIrtp8pj-T89ZR-ev2TS4Ri0Mbz80V95sqORa482oCohD-fVtzI2qftoer75BBgPyLPDLaP9n4d6458Ahzo55sRfDJv8VwpqrcflYiVjyKQ-8d9Ja6lV91-fSkuuCEwnBy0-Bs" alt=""><figcaption><p>Model Data and Version</p></figcaption></figure>

Environment describes where the model is running for example we use environments of training, validation/test and production to describe different places you run a model.&#x20;

\
The production environment is commonly a streaming-like environment. It is streaming in the sense that a production dataset has no beginning or end. The data can be added to it continuously. In most production use cases data is added in small mini batches or real time event-by-event.

The training and validation environments are commonly used to send data in batches. These batches define a group of data for analysis purposes. It’s common in validation/test and training to have the timestamp be optional. &#x20;

**Note**: historical backtesting data comparisons on time series data can require non-runtime settings for timestamp use for training and validation

The model ID is a unique human readable identifier for a model within a workspace - it completely separates the model data between logical instances.&#x20;

The model version is a logical separator for metrics and analysis used to look at different builds of a model. A model version can capture common changes such as weight updates and feature additions.

### Ground Truth&#x20;

Unlike Infra observability, the inference store needs some mutability. There needs to be some way in which ground truth is added or updated for a prediction event.&#x20;

Ground truth is required in the data in order to analyze performance metrics such as precision, recall, AUC, LogLoss, and Accuracy.

Latent ground truth data may need to be “joined” to a prediction ID to enable performance visualization. In Phoenix, the library requires ground truth to be pre-joined to prediction data. In an ML Observability system such as Arize the joining of ground truth is typically done by the system itself.

<figure><img src="../.gitbook/assets/Screenshot 2023-03-15 at 4.31.32 PM.png" alt=""><figcaption><p>Latent Ground Truth</p></figcaption></figure>

The above image shows a common use case in ML Observability in which latent ground truth is received by a system and linked back to the original prediction based on a prediction ID.

<figure><img src="../.gitbook/assets/Screenshot 2023-03-15 at 4.33.25 PM.png" alt=""><figcaption><p>Latent MetaData (Tags)</p></figcaption></figure>

In addition to ground truth, latent metadata is also required to be linked to a prediction ID. Latent metadata can be critical to analyze model results using additional data tags linked to the original prediction ID.

Examples of Metadata (Tags):

* Loan default amount&#x20;
* Loan status&#x20;
* Revenue from conversion or click
* Server region&#x20;

### Nested Predictions (Flattening Hierarchy)

Images bounding box, NLP NER, and Image segmentation

The above picture shows how a nested set of detections can occur for a single image in the prediction body with bounding boxes within the image itself.&#x20;

A model may have multiple inputs with different embeddings and images for each generating a prediction class. An example might be an insurance claim event with multiple images and a single prediction estimate for the claim.

The above prediction shows hierarchical data. The current version of Phoenix is designed to ingest a flat structure so teams will need to flatten the above hierarchy. An example of flattening is below.

<figure><img src="https://lh4.googleusercontent.com/eBFKL2_rOcikfJC47gzwCz6XZ0ktNDU9ILc5A6Owj7_5hLH9ep_yDOkFF-rNMePozy04ERj6RkB-RpclWf3BZLv_ZQ0SGPk4jpBIGW-BzoX8Yc6n2tR6C1bHiZqBeA_hCbV8AbCUR4-rbL8-v2YSCJY" alt=""><figcaption><p>Hierarchical Data Flattened</p></figcaption></figure>

The example above shows an exploded representation of the hierarchical data. \<todo fix, once team reviews approach internally>

### Examples: Supported Schemas&#x20;

#### NLP - LLM Generative/Summarization/Translation

#### NLP - Classification   &#x20;

#### Regression

<figure><img src="../.gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

#### Classification

<figure><img src="../.gitbook/assets/image (1) (1).png" alt=""><figcaption></figcaption></figure>

#### &#x20;Classification + Score

#### Ranking

<figure><img src="../.gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

#### CV - Classification&#x20;



####



