---
name: arize-phoenix
description: Open-source AI observability platform for tracing, evaluating, and improving LLM applications with OpenTelemetry integration
license: MIT
metadata:
  author: Arize AI
  category: ai-observability
---

# Arize Phoenix

Phoenix is an open-source AI observability platform built on OpenTelemetry that helps developers understand, debug, and improve AI applications. It provides comprehensive tracing, evaluation, prompt engineering, and experimentation capabilities for LLM-based systems. Phoenix captures detailed execution information from AI applications, measures output quality with evaluators, enables systematic prompt iteration, and supports data-driven experimentation to optimize AI performance.

## When to Use This Skill

- Debugging AI application failures by inspecting LLM calls, tool executions, and retrieval operations
- Measuring and improving AI output quality using LLM-based or code-based evaluators
- Iterating on prompts using real production examples and testing variations systematically
- Comparing different versions of AI applications (prompts, models, architectures) using experiments
- Monitoring LLM costs, token usage, latency, and error rates in production
- Building datasets from production traces for evaluation and fine-tuning
- Tracking multi-turn conversations and maintaining context across interactions
- Optimizing RAG systems by analyzing retrieval quality and document relevance
- Evaluating agent performance including tool call accuracy and actionability
- Managing prompt versions and deploying them across different environments

## Capabilities

Agents can leverage Phoenix to:

- **Trace** AI application execution with detailed visibility into LLM calls, tool executions, retrieval operations, embeddings, and prompt templates
- **Evaluate** output quality using pre-built or custom evaluators with LLM-as-a-judge or code-based evaluation logic
- **Annotate** traces with human feedback, scores, labels, and quality signals for continuous improvement
- **Experiment** systematically by comparing different versions of applications using datasets and evaluators
- **Monitor** performance metrics including latency, token usage, costs, and error rates across projects
- **Iterate** on prompts using the playground, span replay, and dataset-based testing
- **Organize** traces into projects and sessions for better management and analysis
- **Integrate** with 20+ AI frameworks and LLM providers via OpenTelemetry instrumentation

## Skills

### Tracing

- **Capture traces** via OpenTelemetry (OTLP) protocol with automatic instrumentation for major frameworks
- **View execution flow** showing every LLM call, tool execution, retrieval operation, embedding generation, and response generation
- **Inspect LLM parameters** including temperature, system prompts, function calls, and invocation parameters
- **Analyze retrieval operations** with document scores, order, and embedding text for RAG systems
- **Track token usage** with detailed breakdowns by token type (input/output) and model
- **Monitor latency** at trace, span, and component levels with quantile analysis
- **Organize with projects** to separate traces by environment, application, team, or use case
- **Group with sessions** to track multi-turn conversations and maintain context across interactions
- **Add metadata** to traces with custom attributes, tags, and structured data for filtering and analysis
- **Annotate traces** with scores, labels, human feedback, and LLM evaluations for quality measurement
- **Export and import traces** for backup, migration, or analysis in external tools
- **Track costs** with automatic calculation based on token usage and model pricing

### Evaluation

- **Run LLM-as-a-judge evaluations** using any LLM provider (OpenAI, Anthropic, Gemini, custom endpoints) to assess output quality
- **Build custom evaluators** with Python or TypeScript using custom prompts, scoring logic, and evaluation criteria
- **Use pre-built evaluators** for common tasks including faithfulness, relevance, toxicity, summarization, agent evaluation, and RAG quality
- **Write code-based evaluators** for deterministic checks like exact match, regex patterns, or custom Python/TypeScript logic
- **Execute evaluations at scale** with automatic concurrency, rate limit handling, error management, and batching via executors
- **Map complex inputs** using input schemas and mappings to transform nested data structures for evaluators
- **View evaluator traces** with complete transparency into prompts, model reasoning, scores, and execution metadata
- **Run batch evaluations** on traces, datasets, or custom data sources with automatic retry and error handling
- **Integrate evaluations** into workflows by running evals on production traces or test datasets

### Datasets & Experiments

- **Create datasets** from traces, code, CSV files, or manually curated examples with inputs and optional reference outputs
- **Build golden datasets** with reference outputs (ground truth) for objective evaluation using code-based evaluators
- **Version datasets** with automatic tracking of inserts, updates, and deletes for reproducibility
- **Run experiments** by executing task functions against datasets with evaluators to compare different versions
- **Compare experiments** side-by-side in the UI to see performance differences, score distributions, and individual example results
- **Use repetitions** to run experiments multiple times for statistical confidence and account for LLM variability
- **Organize with splits** to separate datasets into train/test/validation splits for proper evaluation workflows
- **Export datasets** in JSONL or CSV formats for fine-tuning, analysis, or sharing
- **View experiment results** in the Phoenix UI with task function traces, scores per example, and aggregate performance metrics

### Prompt Engineering

- **Manage prompts** with versioning, storage, and deployment across different environments
- **Test prompts interactively** in the Prompt Playground with various models, parameters, and tools
- **Replay LLM spans** from production traces in the playground to debug failures and test improvements
- **Test at scale** by running prompts against datasets to evaluate performance systematically
- **Compare prompt versions** side-by-side to see which performs better on your data
- **Optimize automatically** using automated prompt optimization features
- **Sync prompts via SDK** to keep prompts in sync across applications and environments programmatically
- **Tag prompts** for deployment control across development, staging, and production environments
- **Track prompt changes** with version history, author information, and timestamps

### Projects & Organization

- **Create projects** to organize traces by environment (development, staging, production), application, or team
- **Set up sessions** to track multi-turn conversations with chatbot-like UI showing conversation history
- **View metrics dashboards** with pre-defined metrics including latency, errors, token usage, costs, and model performance
- **Filter and search** traces by metadata, attributes, annotations, or custom tags
- **Configure data retention** policies to control how long trace and evaluation data is stored

### API & Programmatic Access

- **Use Python SDK** (arize-phoenix-client, arize-phoenix-evals, arize-phoenix-otel) for programmatic access
- **Use TypeScript SDK** (arizeai-phoenix-client, arizeai-phoenix-evals, arizeai-phoenix-otel) for JavaScript/TypeScript applications
- **Access REST API** for annotations, datasets, experiments, traces, spans, prompts, projects, and users
- **Instrument manually** using OpenTelemetry decorators, wrappers, or direct OpenInference SDKs
- **Generate API keys** for programmatic access with role-based permissions

### Authentication & Security

- **Configure RBAC** with role-based access control for user permissions and project access
- **Set up authentication** including SSO and user management for self-hosted instances
- **Manage API keys** for secure programmatic access to Phoenix APIs and SDKs
- **Control data privacy** with self-hosting options for VPC deployment or local execution

## Workflows

### Workflow 1: Instrument and Trace an AI Application
1. **Choose integration** - Select appropriate Phoenix integration for your framework (LangChain, LlamaIndex, OpenAI, etc.)
2. **Install package** - Install Phoenix client and OpenTelemetry packages for your language (Python or TypeScript)
3. **Configure endpoint** - Set Phoenix endpoint URL and optionally configure project name and session tracking
4. **Instrument application** - Add auto-instrumentation or manual instrumentation to capture LLM calls, tool executions, and retrievals
5. **View traces** - Open Phoenix UI to see execution flow, latency, token usage, and detailed span information
6. **Add annotations** - Add scores, labels, or human feedback to traces for quality measurement

### Workflow 2: Evaluate AI Output Quality
1. **Choose evaluator type** - Select LLM-as-a-judge for subjective quality or code-based for objective checks
2. **Configure LLM provider** - Set up evaluator LLM (OpenAI, Anthropic, Gemini, or custom endpoint)
3. **Define evaluation logic** - Use pre-built evaluator or create custom evaluator with prompts/scoring logic
4. **Run evaluation** - Execute evaluator on traces, datasets, or custom data with automatic batching and concurrency
5. **Review results** - View evaluator traces, scores, explanations, and labels in Phoenix UI
6. **Iterate** - Adjust evaluator prompts or logic based on results and human feedback

### Workflow 3: Run Experiments to Compare Versions
1. **Create dataset** - Build dataset with inputs and optional reference outputs from traces, code, or CSV
2. **Define task function** - Create Python function that wraps your AI application logic and returns outputs
3. **Select evaluators** - Choose code-based evaluators for ground truth comparison or LLM-as-a-judge for subjective quality
4. **Run experiment** - Execute task function against dataset with evaluators to generate scores
5. **Compare results** - View experiment results in UI with aggregate metrics, score distributions, and per-example analysis
6. **Iterate** - Make changes to prompts, models, or architecture and run new experiment to compare performance

### Workflow 4: Optimize Prompts with Playground
1. **Identify prompt** - Find prompt in traces or load existing prompt from prompt management
2. **Open playground** - Load prompt into Prompt Playground with current parameters and tools
3. **Test variations** - Modify prompt text, model parameters, tools, or response format and test with real inputs
4. **View traces** - All playground runs are automatically recorded as traces for analysis
5. **Test at scale** - Run prompt variations against dataset examples to evaluate performance systematically
6. **Save and deploy** - Save best-performing prompt version, tag for environment, and deploy via SDK

### Workflow 5: Debug Production Issues
1. **Identify problematic trace** - Search or filter traces to find failed or low-quality executions
2. **Inspect execution flow** - View detailed span information including LLM calls, tool executions, and retrievals
3. **Replay span** - Load problematic LLM span into Prompt Playground to test fixes
4. **Test improvements** - Modify prompts, parameters, or tools in playground and compare outputs
5. **Add to dataset** - Add problematic examples to dataset for future testing
6. **Run experiment** - Test improved version against dataset to verify fix before deployment

## Integrations

### LLM Providers
OpenAI, Anthropic, Amazon Bedrock, Google (Gemini), Groq, MistralAI, VertexAI, LiteLLM, OpenRouter, Together, Vercel AI

### Python Frameworks
Agno, AutoGen, BeeAI, CrewAI, DSPy, Google ADK, Graphite, Guardrails AI, Haystack, Hugging Face smolagents, Instructor, LlamaIndex, LangChain, LangGraph, MCP, NVIDIA, Portkey, Pydantic AI

### TypeScript Frameworks
BeeAI, LangChain.js, Mastra, MCP, Vercel AI SDK

### Java Frameworks
LangChain4j, Spring AI, Arconia

### Platforms
Dify, Flowise, LangFlow, Prompt Flow

### Vector Databases
MongoDB, OpenSearch, Pinecone, Qdrant, Weaviate, Zilliz/Milvus, Couchbase

### Evaluation Integrations
Cleanlab, Ragas, UQLM

### Observability Protocols
OpenTelemetry (OTLP), OpenInference

### Developer Tools
Claude Code, Cursor, Phoenix MCP Server

### Cloud Platforms
AWS (CloudFormation), Kubernetes (Helm), Docker, Railway

## Context

**OpenTelemetry**: Phoenix tracing is built on OpenTelemetry (OTLP), an industry-standard observability protocol. This means instrumentation code written for Phoenix can be reused with other observability platforms, avoiding vendor lock-in.

**OpenInference**: Phoenix uses OpenInference instrumentation, an extension of OpenTelemetry specifically designed for AI/LLM applications. OpenInference adds semantic conventions for LLM spans, retrieval operations, and embeddings.

**Traces and Spans**: A trace represents the complete execution path of a request through an AI application. Spans are individual units of work within a trace (e.g., a single LLM call, tool execution, or retrieval operation). Spans can be nested to show hierarchical execution flow.

**Projects**: Projects provide organizational structure for traces, allowing separation by environment, application, or team. Each project has its own metrics dashboard and data isolation.

**Sessions**: Sessions group related traces into conversational threads, enabling tracking of multi-turn conversations with context maintained across interactions.

**Evaluators**: Evaluators measure the quality of AI outputs. LLM-based evaluators use LLMs as judges to assess subjective quality. Code-based evaluators use deterministic logic for objective checks. All evaluators return scores with optional labels, explanations, and metadata.

**Datasets**: Datasets are collections of examples with inputs and optional reference outputs. Golden datasets contain reference outputs (ground truth) for objective evaluation. Datasets are versioned automatically.

**Experiments**: Experiments run task functions (wrapped AI application logic) against datasets with evaluators to systematically compare different versions. Experiments track scores per example and aggregate metrics.

**Prompts**: In Phoenix, a prompt includes the prompt template, invocation parameters (temperature, etc.), tools, and response format. Prompts are versioned and can be tagged for deployment across environments.

**Executors**: Executors handle evaluation execution with automatic concurrency, rate limit management, error handling, and batching. They can achieve up to 20x speedup compared to direct API calls.

**Self-Hosting**: Phoenix can be self-hosted on Docker, Kubernetes, AWS, Railway, or locally. Self-hosted instances support authentication, email configuration, and data retention policies.

**Phoenix Cloud**: Managed Phoenix hosting service with automatic updates, scaling, and maintenance handled by Arize team.

> For additional documentation: https://arize.com/docs/phoenix/llms.txt
