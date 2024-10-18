# Annotating Traces

In order to improve your LLM application iteratively, it's vital to collect feedback as well as to establish an evaluation pipeline so that you can monitor your application. In Phoenix we capture this type of **feedback** in the form of **annotations**.

Phoenix gives you the ability to annotate traces with feedback from two sources: `LLM` in the form of **evaluations** and `HUMAN` in the form of human **annotations**. Phoenix's annotation model is simple yet powerful - given an entity such as a span that is collected, you can assign a `label` and/or a `score` to that entity. Let's see a few examples of the types of feedback you might want to collect:

## Types of Feedback

### Feedback from End-users

Human feedback allows you to understand how your users are experiencing your application and helps draw attention to problematic traces. Phoenix makes it easy to collect feedback for traces and view it in the context of the trace, as well as filter all your traces based on the feedback annotations you send. Before anything else, you want to know if your users or customers are happy with your product. This can be as straightforward as adding :thumbsup: :thumbsdown: buttons to your application, and logging the result as annotations.

For more information on how to wire up your application to collect feedback from your users, see [capture-feedback.md](../how-to-tracing/capture-feedback.md "mention")

### Evaluations from LLMs

When you have large amounts of data it can be immensely efficient and valuable to leverage LLM judges via `evals` to produce labels and scores to annotate your traces with. Phoenix's [evals library](../../evaluation/llm-evals.md) as well as other third-party eval libraries can be leveraged to annotate your spans with evaluations. For details see:

* [evals.md](../../evaluation/evals.md "mention") to generate evaluation results
* [llm-evaluations.md](../how-to-tracing/llm-evaluations.md "mention") to add evaluation results to spans

### Human Annotations

Sometimes you need to rely on human annotators to attach feedback to specific traces of your application. Human annotations through the UI can be thought of as manual quality assurance. While it can be a bit more labor intensive, it can help in sharing insights within a team, curating datasets of good/bad examples, and even in training an LLM judge.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/annotation_flow.gif" alt=""><figcaption></figcaption></figure>

## How to Use Feedback

Feedback / Annotations can help you share valuble insight about how your application is performing. However making these insights actionable can be difficult. With Phoenix, the annotations you add to your trace data is propagated to datasets so that you can use the annotations during experimentation.\\

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/span_to_dataset_example.png" alt=""><figcaption><p>A span's attributes as well as annotations are propagated to example metadata</p></figcaption></figure>

### Track Improvements during Experimentation

Since Phoenix datasets preserve the annotations, you can track whether or not changes to your application (e.g. [experimentation](../../datasets-and-experiments/how-to-experiments/#how-to-run-experiments)) produce better results (e.g. better scores / labels). Phoenix [evaluators](../../datasets-and-experiments/how-to-experiments/using-evaluators.md) have access to the example metadata at evaluation time, making it possible to track improvements / regressions over previous generations (e.g. the previous annotations).

### Train an LLM Judge

AI development currently faces challenges when evaluating LLM application outputs at scale:

* Human annotation is precise but time-consuming and impossible to scale efficiently.
* Existing automated methods using LLM judges require careful prompt engineering and often fall short of capturing human evaluation nuances.
* Solutions requiring extensive human resources are difficult to scale and manage.

These challenges create a bottleneck in the rapid development and improvement of high-quality LLM applications.

Since Phoenix datasets preserve the annotations in the example metadata, you can use datasets to build human-preference calibrated judges using libraries and tools such as DSPy and Zenbase.

{% hint style="info" %}
Training human-aligned LLM judges is still under active development. If this is an area you are interested in, please reach out!
{% endhint %}
