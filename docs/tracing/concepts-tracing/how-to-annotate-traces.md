# How to annotate Traces?

In order to improve your LLM application iteratively, it's vital to collect feedback as well as to establish an evaluation pipeline so that you can monitor your application. In Phoenix we capture this type of **feedback** in the form of **annotations**.

Phoenix gives you the ability to annotate traces with feedback from two sources: `LLM` in the form of **evaluations** and `HUMAN` in the form of human **annotations**. Phoenix's annotation model is simple yet powerful - given an entity such as a span that is collected, you can assign a `label` and/or a score to that entity. Let's see a few examples of the types of feedback you might want to collect:

## Feedback from End-users

human feedback allows you to understand how your users are experiencing your application and helps draw attention to problematic traces. Phoenix makes it easy to collect feedback for traces and view it in the context of the trace, as well as lets you filter your traces based on the feedback annotations you send. Before anything else, you want to know if your users or customers are happy with your product. You can start capturing this feedback (such as adding a 👍👎 buttons ). For more information on how to wire up your application to collect feedback from your users, see [capture-feedback.md](../how-to-tracing/capture-feedback.md "mention")

## Evaluations from LLMs

When you have large amounts of data it can be immensely efficient and valuable to leverage LLM judges via `evals` to produce labels and scores to annotate your traces with. Phoenix's [evals library](../../llm-evals/llm-evals.md) as well as other third-party eval libraries can be leveraged to annotate your spans with evaluations. For details see [llm-evaluations.md](../how-to-tracing/llm-evaluations.md "mention")

## Human Annotations

Sometimes you need to rely on human annotators to attach feedback to specific traces of your application. Human annotations through the UI can be thought of as manual quality assurance. While it can be a bit more labor intensive, it can help in sharing insights within a team, curating datasets of good/bad examples, and even in training an LLM judge.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/annotation_flow.gif" alt=""><figcaption></figcaption></figure>

\
