# Annotations Concepts

### Annotation Types

Depending on what you want to do with your annotations, you may want to configure a rubric for what your annotation represents - e.g. is it a **category**, number with a range (**continuous**), or **freeform**.

* Annotation type:\
  \- **Categorical:** Predefined labels for selection. (e.x. 👍 or 👎)\
  \- **Continuous:** a score across a specified range. (e.g. confidence score 0-100)\
  \- **Freeform:** Open-ended text comments. (e.g. "correct")
* Optimize the direction based on your goal:\
  \- **Maximize:** higher scores are better. (e.g. confidence)\
  \- **Minimize:** lower scores are better. (e.g. hallucinations)\
  \- **None:** direction optimization does not apply. (e.g. tone)

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/annotation_types.png" alt=""><figcaption><p>Different types of annotations change the way human annotators provide feedback</p></figcaption></figure>

See [Annotate Traces](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/how-to-tracing/feedback-and-annotations) for more details.

### Annotation Targets

Phoenix supports annotating different annotation targets to capture different levels of LLM application performance. The core annotation types include:

* **Span Annotations**: Applied to individual spans within a trace, providing granular feedback about specific components
* **Document Annotations**: Specifically for retrieval systems, evaluating individual documents with metrics like relevance and precision

Each annotation can include:

* **Labels**: Text-based classifications (e.g., "helpful" or "not helpful")
* **Scores**: Numeric evaluations (e.g., 0-1 scale for relevance)
* **Explanations**: Detailed justifications for the annotation

These annotations can come from different sources:

* **Human** feedback (e.g., thumbs up/down from end-users)
* **LLM**-as-a-judge evaluations (automated assessments)
* **Code**-based evaluations (programmatic metrics)

Phoenix also supports specialized evaluation metrics for retrieval systems, including NDCG, Precision@K, and Hit Rate, making it particularly useful for evaluating search and retrieval components of LLM applications.

### Feedback from End-users

Human feedback allows you to understand how your users are experiencing your application and helps draw attention to problematic traces. Phoenix makes it easy to collect feedback for traces and view it in the context of the trace, as well as filter all your traces based on the feedback annotations you send. Before anything else, you want to know if your users or customers are happy with your product. This can be as straightforward as adding :thumbsup: :thumbsdown: buttons to your application, and logging the result as annotations.

For more information on how to wire up your application to collect feedback from your users, see [Annotate Traces](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/how-to-tracing/feedback-and-annotations "mention").&#x20;

### Evaluations from LLMs

When you have large amounts of data it can be immensely efficient and valuable to leverage LLM judges via `evals` to produce labels and scores to annotate your traces with. Phoenix's evals library as well as other third-party eval libraries can be leveraged to annotate your spans with evaluations. For details see [Running Evals on Traces](https://app.gitbook.com/s/ShR775Rt7OzHRfy5j2Ks/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces) to:

* &#x20;Generate evaluation results
* &#x20;Add evaluation results to spans

### Human Annotations

Sometimes you need to rely on human annotators to attach feedback to specific traces of your application. Human annotations through the UI can be thought of as manual quality assurance. While it can be a bit more labor intensive, it can help in sharing insights within a team, curating datasets of good/bad examples, and even in training an LLM judge.

## How to Use Annotations

Annotations can help you share valuable insight about how your application is performing. However making these insights actionable can be difficult. With Phoenix, the annotations you add to your trace data is propagated to datasets so that you can use the annotations during experimentation.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/span_to_dataset_example.png" alt=""><figcaption><p>A span's attributes as well as annotations are propagated to example metadata</p></figcaption></figure>

### Track Improvements during Experimentation

Since Phoenix datasets preserve the annotations, you can track whether or not changes to your application (e.g. experimentation) produce better results (e.g. better scores / labels). Phoenix evaluators have access to the example metadata at evaluation time, making it possible to track improvements / regressions over previous generations (e.g. the previous annotations).

### Train an LLM Judge

AI development currently faces challenges when evaluating LLM application outputs at scale:

* Human annotation is precise but time-consuming and impossible to scale efficiently.
* Existing automated methods using LLM judges require careful prompt engineering and often fall short of capturing human evaluation nuances.
* Solutions requiring extensive human resources are difficult to scale and manage.

These challenges create a bottleneck in the rapid development and improvement of high-quality LLM applications.

Since Phoenix datasets preserve the annotations in the example metadata, you can use datasets to build human-preference calibrated judges using libraries and tools such as DSPy and Zenbase.

### Annotator Kind

Phoenix supports three types of annotators: Human, LLM, and Code.

<table data-header-hidden><thead><tr><th width="104.390625"></th><th width="134.921875"></th><th></th><th></th><th></th></tr></thead><tbody><tr><td><strong>Annotator Kind</strong></td><td><strong>Source</strong></td><td><strong>Purpose</strong></td><td><strong>Strengths</strong></td><td><strong>Use Case</strong></td></tr><tr><td><strong>Human</strong></td><td>Manual review</td><td>Expert judgment and quality assurance</td><td>High accuracy, nuanced understanding</td><td>Manual QA, edge cases, subjective evaluation</td></tr><tr><td><strong>LLM</strong></td><td>Language model output</td><td>Scalable evaluation of application responses</td><td>Fast, scalable, consistent across examples</td><td>Large-scale output scoring, pattern review</td></tr><tr><td><strong>Code</strong></td><td>Programmatic evaluators</td><td>Automated assessment based on rules/metrics</td><td>Objective, repeatable, useful in experiments</td><td>Model benchmarking, regression testing</td></tr></tbody></table>

### Annotation Source

Phoenix provides two interfaces for annotations: API and APP. The API interface via the REST clients enables automated feedback collection at scale, such as collecting thumbs up/down from end-users in production, providing real-time insights into LLM system performance. The APP interface via the UI offers an efficient workflow for human annotators with hotkey support and structured configurations, making it practical to create high-quality training sets for LLMs.

The combination of these interfaces creates a powerful feedback loop: human annotations through the APP interface help train and calibrate LLM evaluators, which can then be deployed at scale via the API. This cycle of human oversight and automated evaluation helps identify the most valuable examples for review while maintaining quality at scale.

### Annotation Configuration

Annotation configurations in Phoenix are designed to maximize efficiency for human annotators. The system allows you to define the structure of annotations (categorical or continuous values, with appropriate bounds and options) and pair these with keyboard shortcuts (hotkeys) to enable rapid annotation.

For example, a categorical annotation might be configured with specific labels that can be quickly assigned using number keys, while a continuous annotation might use arrow keys for fine-grained scoring. This combination of structured configurations and hotkey support allows annotators to provide feedback quickly, significantly reducing the effort required for manual annotation tasks.

The primary goal is to streamline the annotation workflow, enabling human annotators to process large volumes of data efficiently while maintaining quality and consistency in their feedback.
