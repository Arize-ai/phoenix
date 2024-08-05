# How to evaluate Traces?

In order to improve your LLM application iteratively, it's vital to collect feedback as well as to establish an evaluation pipeline so that you can monitor your application.

Phoenix gives you the ability to annotate traces with feedback from two sources: `LLM` in the form of **evaluations** and `HUMAN` in the form of human annotations.

## Feedback from end-users

Feedback allows you to understand how your users are experiencing your application and helps draw attention to problematic traces. Phoenix makes it easy to collect feedback for traces and view it in the context of the trace, as well as filter traces based on the feedback annotations you send. For more information on how to score your application as it runs, see [capture-feedback.md](../how-to-tracing/capture-feedback.md "mention")

## Evaluations from LLMs

When you have large amounts of data it can be immensely efficient and valuble to leverage LLM judges via `evals` to produce labels and scores to annotate your traces with. For details see [llm-evaluations.md](../how-to-tracing/llm-evaluations.md "mention")

## Human Annotations

Sometimes you need to rely on human annotators to attach feedback to specific traces of your application. Human annotations through the UI can be thought of as manual quality assurance. While it can be a bit more labor intensive, it can help in sharing insights within a team, curating datasets of good/bad examples, and even in training an LLM judge.

\
