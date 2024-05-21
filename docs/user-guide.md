---
description: >-
  LLM observability is complete visibility into every layer of an LLM-based
  software system: the application, the prompt, and the response.
---

# User Guide

Phoenix is a comprehensive platform designed to enable observability across every layer of an LLM-based system, empowering teams to build, optimize, and maintain high-quality applications efficiently.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/user_guide.png" alt=""><figcaption></figcaption></figure>

## Develop

During the development phase, Phoenix offers essential tools for debugging, prompt tracking, and search and retrieval optimization.

### Traces for Debugging

Phoenix's tracing and span analysis capabilities are invaluable during the prototyping and debugging stages. By instrumenting application code with Phoenix, teams gain detailed insights into the execution flow, making it easier to identify and resolve issues. Developers can drill down into specific spans, analyze performance metrics, and access relevant logs and metadata to streamline debugging efforts.

### Prompt Tracking

Phoenix provides a dedicated prompt engineering workspace that allows developers to create, manage, and experiment with prompt variations. It offers tools for analyzing prompt performance, comparing outputs, and identifying patterns that lead to better results. Phoenix also enables teams to maintain a central repository of optimized prompts, facilitating collaboration and knowledge sharing.

### Search & Retrieval Embeddings Visualizer

Phoenix's search and retrieval optimization tools include an embeddings visualizer that helps teams understand how their data is being represented and clustered. This visual insight can guide decisions on indexing strategies, similarity measures, and data organization to improve the relevance and efficiency of search results.

&#x20;

## Testing/Staging

In the testing and staging environment, Phoenix supports comprehensive evaluation, benchmarking, and dataset curation. Traces, prompt tracking, and embedding visualizer remain important in the testing and staging phase, helping teams identify and resolve issues before deployment.

### Benchmarking of Evals

Phoenix allows teams to benchmark their evaluation metrics against industry standards or custom baselines. This helps ensure that the LLM application meets performance and quality targets before moving into production.

### Evals Testing

Phoenix's flexible evaluation framework supports thorough testing of LLM outputs. Teams can define custom metrics, collect user feedback, and leverage separate LLMs for automated assessment. Phoenix offers tools for analyzing evaluation results, identifying trends, and tracking improvements over time.

### Curate Datasets

Phoenix assists in curating high-quality datasets for testing and fine-tuning. It provides tools for data exploration, cleaning, and labeling, enabling teams to create representative and diverse datasets that cover a wide range of use cases and edge conditions.



## Production

In production, Phoenix works hand-in-hand with Arize, which focuses on the production side of the LLM lifecycle. The integration ensures a smooth transition from development to production, with consistent tooling and metrics across both platforms.&#x20;

### Traces in Production

Phoenix and Arize use the same collector frameworks in development and production. This allows teams to monitor latency, token usage, and other performance metrics, setting up alerts when thresholds are exceeded.

### Evals for Production

Phoenix's evaluation framework can be used to generate ongoing assessments of LLM performance in production. Arize complements this with online evaluations, enabling teams to set up alerts if evaluation metrics, such as hallucination rates, go beyond acceptable thresholds.&#x20;

### Fine-tuning

Phoenix and Arize together help teams identify data points for fine-tuning based on production performance and user feedback. This targeted approach ensures that fine-tuning efforts are directed towards the most impactful areas, maximizing the return on investment.

Phoenix, in collaboration with Arize, empowers teams to build, optimize, and maintain high-quality LLM applications throughout the entire lifecycle. By providing a comprehensive observability platform and seamless integration with production monitoring tools, Phoenix and Arize enable teams to deliver exceptional LLM-driven experiences with confidence and efficiency.

