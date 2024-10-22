# User Guide

Phoenix is a comprehensive platform designed to enable observability across every layer of an LLM-based system, empowering teams to build, optimize, and maintain high-quality applications and agents efficiently.

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/user-guide-image.png" alt=""><figcaption></figcaption></figure>

## 🛠️ Develop

During the development phase, Phoenix offers essential tools for debugging, experimentation, evaluation, prompt tracking, and search and retrieval.

### Traces for Debugging

Phoenix's tracing and span analysis capabilities are invaluable during the prototyping and debugging stages. By instrumenting application code with Phoenix, teams gain detailed insights into the execution flow, making it easier to identify and resolve issues. Developers can drill down into specific spans, analyze performance metrics, and access relevant logs and metadata to streamline debugging efforts.

* [llm-traces-1.md](tracing/llm-traces-1.md "mention")

### Experimentation

Leverage experiments to measure prompt and model performance. Typically during this early stage, you'll focus on gather a robust set of test cases and evaluation metrics to test initial iterations of your application. Experiments at this stage may resemble unit tests, as they're geared towards ensure your application performs correctly.

* [run-experiments.md](datasets-and-experiments/how-to-experiments/run-experiments.md "mention")

### Evaluation

Either as a part of experiments or a standalone feature, evaluations help you understand how your app is performing at a granular level. Typical evaluations might be correctness evals compared against a ground truth data set, or LLM-as-a-judge evals to detect hallucinations or relevant RAG output.

* [evals.md](evaluation/evals.md "mention")

### Prompt Tracking

Instrument prompt and prompt variable collection to associate iterations of your app with the performance measured through evals and experiments. Phoenix tracks prompt templates, variables, and versions during execution to help you identify improvements and degradations.

* [instrumenting-prompt-templates-and-prompt-variables.md](tracing/how-to-tracing/customize-spans/instrumenting-prompt-templates-and-prompt-variables.md "mention")

### Search & Retrieval Embeddings Visualizer

Phoenix's search and retrieval optimization tools include an embeddings visualizer that helps teams understand how their data is being represented and clustered. This visual insight can guide decisions on indexing strategies, similarity measures, and data organization to improve the relevance and efficiency of search results.

* [phoenix-inferences.md](inferences/phoenix-inferences.md "mention")

## 🧪 Testing/Staging

In the testing and staging environment, Phoenix supports comprehensive evaluation, benchmarking, and data curation. Traces, experimentation, prompt tracking, and embedding visualizer remain important in the testing and staging phase, helping teams identify and resolve issues before deployment.

### Iterate via Experiments

With a stable set of test cases and evaluations defined, you can now easily iterate on your application and view performance changes in Phoenix right away. Swap out models, prompts, or pipeline logic, and run your experiment to immediately see the impact on performance.

* [run-experiments.md](datasets-and-experiments/how-to-experiments/run-experiments.md "mention")

### Evals Testing

Phoenix's flexible evaluation framework supports thorough testing of LLM outputs. Teams can define custom metrics, collect user feedback, and leverage separate LLMs for automated assessment. Phoenix offers tools for analyzing evaluation results, identifying trends, and tracking improvements over time.

* [evals.md](evaluation/evals.md "mention")

### Curate Data

Phoenix assists in curating high-quality data for testing and fine-tuning. It provides tools for data exploration, cleaning, and labeling, enabling teams to curate representative data that covers a wide range of use cases and edge conditions.

* [quickstart-datasets.md](datasets-and-experiments/quickstart-datasets.md "mention")

### Guardrails

Add guardrails to your application to prevent malicious and erroneous inputs and outputs. Guardrails will be visualized in Phoenix, and can be attached to spans and traces in the same fashion as evaluation metrics.

* [guardrails-ai.md](tracing/integrations-tracing/guardrails-ai.md "mention")

## 🚀 Production

In production, Phoenix works hand-in-hand with Arize, which focuses on the production side of the LLM lifecycle. The integration ensures a smooth transition from development to production, with consistent tooling and metrics across both platforms.

### Traces in Production

Phoenix and Arize use the same collector frameworks in development and production. This allows teams to monitor latency, token usage, and other performance metrics, setting up alerts when thresholds are exceeded.

### Evals for Production

Phoenix's evaluation framework can be used to generate ongoing assessments of LLM performance in production. Arize complements this with online evaluations, enabling teams to set up alerts if evaluation metrics, such as hallucination rates, go beyond acceptable thresholds.

### Fine-tuning

Phoenix and Arize together help teams identify data points for fine-tuning based on production performance and user feedback. This targeted approach ensures that fine-tuning efforts are directed towards the most impactful areas, maximizing the return on investment.

Phoenix, in collaboration with Arize, empowers teams to build, optimize, and maintain high-quality LLM applications throughout the entire lifecycle. By providing a comprehensive observability platform and seamless integration with production monitoring tools, Phoenix and Arize enable teams to deliver exceptional LLM-driven experiences with confidence and efficiency.
