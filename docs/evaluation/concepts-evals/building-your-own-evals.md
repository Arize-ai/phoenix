# Custom Task Evaluation

## Customize Your Own Eval Templates

The LLM Evals library is designed to support the building of any custom Eval templates.

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-04 at 10.06.26 PM.png" alt=""><figcaption><p>Custom Eval Templates</p></figcaption></figure>

## Steps to Building Your Own Eval

Follow the following steps to easily build your own Eval with Phoenix

### 1. Choose a Metric

To do that, you must identify what is the **metric best suited for your use case**. Can you use a pre-existing template or do you need to evaluate something unique to your use case?

### 2. Build a Golden Dataset

Then, you need the **golden dataset**. This should be representative of the type of data you expect the LLM eval to see. The golden dataset should have the “ground truth” label so that we can measure performance of the LLM eval template. Often such labels come from human feedback.

Building such a dataset is laborious, but you can often find a standardized one for the most common use cases (as we did in the code above)

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/Create_Your_Own_Template_Golden_Dataset.png" alt=""><figcaption><p>Golden Dataset</p></figcaption></figure>

The Evals dataset is designed or easy benchmarking and pre-set downloadable test datasets. The datasets are pre-tested, many are hand crafted and designed for testing specific Eval tasks.

```python
from phoenix.experimental.evals import download_benchmark_dataset

df = download_benchmark_dataset(
    task="binary-hallucination-classification", dataset_name="halueval_qa_data"
)
df.head()
```

### 3. Decide Which LLM to use For Evaluation

Then you need to decide **which LLM** you want to use for evaluation. This could be a different LLM from the one you are using for your application. For example, you may be using Llama for your application and GPT-4 for your eval. Often this choice is influenced by questions of cost and accuracy.

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/Create_Your_Own_Template_Pick_Model.png" alt=""><figcaption><p>Decide your LLM for evaluation</p></figcaption></figure>

### 4. Build the Eval Template

Now comes the core component that we are trying to benchmark and improve: the **eval template**.

You can adjust an existing template or build your own from scratch.

Be explicit about the following:

* **What is the input?** In our example, it is the documents/context that was retrieved and the query from the user.
* **What are we asking?** In our example, we’re asking the LLM to tell us if the document was relevant to the query
* **What are the possible output formats?** In our example, it is binary relevant/irrelevant, but it can also be multi-class (e.g., fully relevant, partially relevant, not relevant).

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/Create_Your_Own_Template.png" alt=""><figcaption><p>Building the eval template</p></figcaption></figure>

In order to create a new template all that is needed is the setting of the input string to the Eval function.

```python
MY_CUSTOM_TEMPLATE = '''
    You are evaluating the positivity or negativity of the responses to questions.
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Response]: {response}
    [END DATA]


    Please focus on the tone of the response.
    Your answer must be single word, either "positive" or "negative"
    '''
```

The above template shows an example creation of an easy to use string template. The Phoenix Eval templates support both strings and objects.

```python
model = OpenAIModel(model_name="gpt-4",temperature=0.6)
positive_eval = llm_classify(
    dataframe=df,
    template= MY_CUSTOM_TEMPLATE,
    model=model
)
```

The above example shows a use of the custom created template on the df dataframe.

```python
#Phoenix Evals support using either strings or objects as templates
MY_CUSTOM_TEMPLATE = " ..."
MY_CUSTOM_TEMPLATE = PromptTemplate("This is a test {prompt}")
```

### 5. Run Eval on your Golden Dataset and Benchmark Performance

You now need to run the eval across your golden dataset. Then you can **generate metrics** (overall accuracy, precision, recall, F1, etc.) to determine the benchmark. It is important to look at more than just overall accuracy. We’ll discuss that below in more detail.

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/Create_Your_Own_Template_Benchmark.png" alt=""><figcaption><p>Benchmark performance</p></figcaption></figure>
