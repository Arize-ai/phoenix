# Table of contents

* [Arize Phoenix](README.md)
* [User Guide](user-guide.md)
* [Examples](notebooks.md)
* [Setup](setup/README.md)
  * [Environments](environments.md)
  * [Configuration](setup/configuration.md)
* [Deployment](reference/deploying-phoenix.md)

## 🔭 Tracing

* [Overview: Tracing](concepts/llm-traces.md)
* [Quickstart: Tracing](quickstart/llm-traces.md)
* [Concepts: Tracing](tracing/concepts-tracing.md)
  * [What are Traces?](tracing/concepts-tracing/what-are-traces.md)
  * [How does Tracing Work?](tracing/concepts-tracing/how-does-tracing-work.md)
* [How-to: Tracing](tracing/how-to-tracing/README.md)
  * [Tracing Core Concepts](tracing/how-to-tracing/tracing-core-concepts.md)
  * [Customize Traces](tracing/how-to-tracing/customize-traces.md)
  * [Auto Instrumentation](tracing/how-to-tracing/instrumentation/README.md)
    * [LlamaIndex](tracing/how-to-tracing/instrumentation/llamaindex.md)
    * [LangChain](tracing/how-to-tracing/instrumentation/langchain.md)
    * [OpenAI](tracing/how-to-tracing/instrumentation/openai.md)
    * [MistralAI](tracing/how-to-tracing/instrumentation/mistralai.md)
    * [DSPy](tracing/how-to-tracing/instrumentation/dspy.md)
    * [Bedrock](tracing/how-to-tracing/instrumentation/bedrock.md)
    * [AutoGen](tracing/how-to-tracing/instrumentation/autogen-support.md)
  * [Manual Instrumentation](tracing/how-to-tracing/custom-spans.md)
  * [Querying Spans](tracing/how-to-tracing/extract-data-from-spans.md)
  * [Log Evaluation Results](tracing/how-to-tracing/llm-evaluations.md)
  * [Trace a Deployed App](tracing/how-to-tracing/trace-a-deployed-app.md)
  * [Save and Load Traces](tracing/how-to-tracing/save-and-load-traces.md)
* [Use Cases: Tracing](tracing/use-cases-tracing/README.md)
  * [Evaluate RAG](use-cases/rag-evaluation.md)
  * [Structured Data Extraction](tracing/use-cases-tracing/structured-extraction.md)

## 🧠 Evaluation

* [Overview: Evals](llm-evals/llm-evals.md)
* [Quickstart: Evals](quickstart/evals.md)
* [Concepts: Evals](evaluation/concepts-evals/README.md)
  * [LLM as a Judge](evaluation/concepts-evals/llm-as-a-judge.md)
  * [Eval Data Types](evaluation/concepts-evals/evaluation-types.md)
  * [Evals With Explanations](evaluation/concepts-evals/evals-with-explanations.md)
  * [Evaluators](evaluation/concepts-evals/evaluation.md)
  * [Custom Task Evaluation](evaluation/concepts-evals/building-your-own-evals.md)
* [How to: Evals](evaluation/how-to-evals/README.md)
  * [Use Phoenix Evaluators](evaluation/how-to-evals/running-pre-tested-evals/README.md)
    * [Hallucinations](evaluation/how-to-evals/running-pre-tested-evals/hallucinations.md)
    * [Q\&A on Retrieved Data](evaluation/how-to-evals/running-pre-tested-evals/q-and-a-on-retrieved-data.md)
    * [Retrieval (RAG) Relevance](evaluation/how-to-evals/running-pre-tested-evals/retrieval-rag-relevance.md)
    * [Summarization](evaluation/how-to-evals/running-pre-tested-evals/summarization-eval.md)
    * [Code Generation](evaluation/how-to-evals/running-pre-tested-evals/code-generation-eval.md)
    * [Toxicity](evaluation/how-to-evals/running-pre-tested-evals/toxicity.md)
    * [AI vs Human (Groundtruth)](evaluation/how-to-evals/running-pre-tested-evals/ai-vs-human-groundtruth.md)
    * [Reference (citation) Link](evaluation/how-to-evals/running-pre-tested-evals/reference-link-evals.md)
  * [Bring Your Own Evaluator](evaluation/how-to-evals/bring-your-own-evaluator.md)
  * [Online Evals](evaluation/how-to-evals/online-evals.md)
* [Evaluation Models](evaluation/evaluation-models.md)

## 🔎 Retrieval

* [Overview: Retrieval](retrieval/overview-retrieval.md)
* [Quickstart: Retrieval](retrieval/quickstart-retrieval.md)
* [Concepts: Retrieval](retrieval/concepts-retrieval/README.md)
  * [Retrieval with Embeddings](retrieval/concepts-retrieval/troubleshooting-llm-retrieval-with-vector-stores.md)
  * [Benchmarking Retrieval](retrieval/concepts-retrieval/benchmarking-retrieval-rag.md)
  * [Retrieval Evals on Document Chunks](retrieval/concepts-retrieval/retrieval-evals-on-document-chunks.md)

## 🌌 inferences

* [Quickstart: Inferences](quickstart/phoenix-inferences/README.md)
* [How-to: Inferences](inferences/how-to-inferences/README.md)
  * [Import Your Data](how-to/define-your-schema/README.md)
    * [Prompt and Response (LLM)](inferences/how-to-inferences/define-your-schema/prompt-and-response-llm.md)
    * [Retrieval (RAG)](how-to/define-your-schema/retrieval-rag.md)
    * [Corpus Data](inferences/how-to-inferences/define-your-schema/corpus-data.md)
  * [Export Data](how-to/export-your-data.md)
  * [Generate Embeddings](inferences/how-to-inferences/generating-embeddings.md)
  * [Manage the App](how-to/manage-the-app.md)
* [Concepts: Inferences](inferences/concepts-inferences/README.md)
  * [Concepts: Inferences](inferences/concepts-inferences/inferences.md)
* [How to: Inferences](inferences/how-to-inferences-1/README.md)
  * [Use Example Datasets](inferences/how-to-inferences-1/use-example-datasets.md)
* [Use-Cases: Inferences](inferences/use-cases-inferences/README.md)
  * [Embeddings Analysis](inferences/use-cases-inferences/embeddings-analysis.md)

## ⌨️ API

* [Dataset and Schema](api/dataset-and-schema.md)
* [Session](api/session.md)
* [Client](api/client.md)
* [Evals](api/evals.md)
* [Models](api/evaluation-models.md)

## 🔌 INTEGRATIONS

* [Arize](integrations/arize/README.md)
  * [Export Data from Arize to Phoenix](integrations/bring-production-data-to-notebook-for-eda-or-retraining.md)
* [Ragas](integrations/ragas.md)

## 🏴‍☠️ Programming Languages

* [JavaScript](programming-languages/javascript.md)

## 📚 Reference

* [Frequently Asked Questions](reference/frequently-asked-questions.md)
* [OpenInference](reference/open-inference.md)
* [Contribute to Phoenix](reference/contribute-to-phoenix.md)

***

* [GitHub](https://github.com/Arize-ai/phoenix)
* [Releases](https://github.com/Arize-ai/phoenix/releases)
