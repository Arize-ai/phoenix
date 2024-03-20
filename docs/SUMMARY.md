# Table of contents

* [Arize Phoenix](README.md)
* [User Guide](user-guide.md)
* [Examples](notebooks.md)
* [Setup](setup/README.md)
  * [Environments](setup/environments.md)
  * [Configuration](setup/configuration.md)
* [Deployment](deploying-phoenix.md)

## 🔭 Tracing

* [Overview: Tracing](concepts/llm-traces.md)
* [Quickstart: Tracing](quickstart/llm-traces.md)
* [Concepts: Tracing](tracing/concepts-tracing/README.md)
  * [What are Traces?](tracing/concepts-tracing/what-are-traces.md)
  * [How does Tracing Work?](tracing/concepts-tracing/how-does-tracing-work.md)
* [How-to: Tracing](tracing/how-to-tracing/README.md)
  * [Tracing Core Concepts](tracing/how-to-tracing/tracing-core-concepts.md)
  * [Customize Traces](tracing/how-to-tracing/customize-traces.md)
  * [Auto Instrumentation](tracing/how-to-tracing/instrumentation/README.md)
    * [LlamaIndex](tracing/how-to-tracing/instrumentation/llamaindex.md)
    * [LangChain](tracing/how-to-tracing/instrumentation/langchain.md)
    * [OpenAI](tracing/how-to-tracing/instrumentation/openai.md)
    * [DSPy](tracing/how-to-tracing/instrumentation/dspy.md)
    * [Bedrock](tracing/how-to-tracing/instrumentation/bedrock.md)
    * [AutoGen](tracing/how-to-tracing/instrumentation/autogen-support.md)
  * [Manual Instrumentation](tracing/how-to-tracing/custom-spans.md)
  * [Querying Spans](tracing/how-to-tracing/extract-data-from-spans.md)
  * [Log Evaluation Results](tracing/how-to-tracing/llm-evaluations.md)
* [Use Cases: Tracing](tracing/use-cases-tracing/README.md)
  * [Evaluate RAG](tracing/use-cases-tracing/rag-evaluation.md)
  * [Structured Data Extraction](tracing/use-cases-tracing/structured-extraction.md)

## 🧠 Evaluation

* [Overview: Evals](llm-evals/llm-evals.md)
* [Quickstart: Evals](quickstart/evals.md)
* [Concepts: Evaluation](evaluation/evaluation/README.md)
  * [Evaluation Types](evaluation/evaluation/evaluation-types.md)
  * [Evals With Explanations](evaluation/evaluation/evals-with-explanations.md)
* [Pre-Tested Evals](llm-evals/running-pre-tested-evals/README.md)
  * [Retrieval (RAG) Relevance](llm-evals/running-pre-tested-evals/retrieval-rag-relevance.md)
  * [Hallucinations](llm-evals/running-pre-tested-evals/hallucinations.md)
  * [Q\&A on Retrieved Data](llm-evals/running-pre-tested-evals/q-and-a-on-retrieved-data.md)
  * [Toxicity](llm-evals/running-pre-tested-evals/toxicity.md)
  * [Code Generation Eval](llm-evals/running-pre-tested-evals/code-generation-eval.md)
  * [Summarization Eval](llm-evals/running-pre-tested-evals/summarization-eval.md)
  * [Reference (citation) Link Evals](llm-evals/running-pre-tested-evals/reference-link-evals.md)
  * [AI vs Human (Groundtruth)](llm-evals/running-pre-tested-evals/ai-vs-human-groundtruth.md)
* [Building Your Own Evals](llm-evals/building-your-own-evals.md)
* [Quickstart: Retrieval Evals](llm-evals/quickstart-retrieval-evals/README.md)
  * [Retrieval Evals on Document Chunks](llm-evals/quickstart-retrieval-evals/retrieval-evals-on-document-chunks.md)
* [Benchmarking Retrieval](llm-evals/benchmarking-retrieval-rag.md)
* [Online Evals](evaluation/online-evals.md)
* [Models Supported](evaluation/models-supported.md)

## 🌌 inferences

* [Quickstart: Inferences](quickstart/phoenix-inferences/README.md)
* [Concepts: Inferences](quickstart/phoenix-inferences/inferences.md)
* [How-to: Inferences](inferences/how-to-inferences/README.md)
  * [Import Your Data](inferences/how-to-inferences/define-your-schema/README.md)
    * [Prompt and Response (LLM)](inferences/how-to-inferences/define-your-schema/prompt-and-response-llm.md)
    * [Retrieval (RAG)](inferences/how-to-inferences/define-your-schema/retrieval-rag.md)
    * [Corpus Data](inferences/how-to-inferences/define-your-schema/corpus-data.md)
  * [Export Data](inferences/how-to-inferences/export-your-data.md)
  * [Generate Embeddings](inferences/how-to-inferences/generating-embeddings.md)
  * [Manage the App](inferences/how-to-inferences/manage-the-app.md)
* [Use-Cases: Inferences](inferences/use-cases-inferences/README.md)
  * [Retrieval with Embeddings](inferences/use-cases-inferences/troubleshooting-llm-retrieval-with-vector-stores.md)
  * [Embeddings Analysis](inferences/use-cases-inferences/embeddings-analysis.md)

## ⌨️ API

* [Dataset and Schema](api/dataset-and-schema.md)
* [Session](api/session.md)
* [Client](api/client.md)
* [Evals](api/evals.md)
* [Models](api/evaluation-models.md)

## 🔌 INTEGRATIONS

* [Arize](integrations/bring-production-data-to-notebook-for-eda-or-retraining.md)
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
