---
description: Guides on how to use traces
---

# How-to: Tracing

## [Setup Tracing](setup-tracing/)

* Setup Tracing in [Python](setup-tracing/setup-tracing-python/) or [TypeScript](setup-tracing/setup-tracing-ts.md)
* Add Integrations via [Auto Intstrumentation](./#auto-instrumentation)

## [Tracing Core Concepts](tracing-core-concepts.md)

* [How to log traces](tracing-core-concepts.md#how-to-log-traces)
* [How to turn off tracing](tracing-core-concepts.md#how-to-turn-off-tracing)

## [Customize Traces](customize-traces.md)

* [How to log to a specific project](customize-traces.md#log-to-a-specific-project)
* [How to switch projects in a notebook](customize-traces.md#switching-projects-in-a-notebook)
* [How to add auto-instrumentation](instrumentation/)
* [How to create custom spans](manual-instrumentation/custom-spans.md)
* [How to add custom metadata](customize-traces.md#adding-custom-metadata-to-spans)

### [Customize Spans](./#customizing-spans)

How to set custom attributes and semantic attributes to child spans and spans created by auto-instrumentors.

* [Setting metadata](customize-spans/#using\_metadata)
* [Setting tags](customize-spans/#specifying-tags)
* [Setting a user](customize-spans/#using\_user)
* [Setting prompt template attributes](customize-spans/#specifying-the-prompt-template)
* [How to read attributes from context](customize-spans/#using\_attributes)

## [Auto Instrumentation](./#auto-instrumentation)

Use auto-instrumentation to export traces for common frameworks and libraries

### Auto Instrument: Python

* [Instrument LlamaIndex](../integrations-tracing/llamaindex.md)
* [Instrument LangChain](../integrations-tracing/langchain.md)
* [Instrument OpenAI](../integrations-tracing/dspy.md)
* [Instrument DSPy](../integrations-tracing/dspy.md)
* [Instrument AWS Bedrock](../integrations-tracing/bedrock.md)
* [Instrument AutoGen](../integrations-tracing/autogen-support.md)

### Auto Instrument: TypeScript

* [Instrument OpenAI Node SDK](../integrations-tracing/openai-node-sdk.md)
* [Instrument LangChain.js](../integrations-tracing/langchain.js.md)

## [Manual Instrumentation](./#manual-instrumentation)

Create and customize spans for your use-case

### [Instrument: Python](./#instrument-python)

* [How to acquire a Tracer](manual-instrumentation/custom-spans.md#acquire-tracer)
* [How to create spans](manual-instrumentation/custom-spans.md#creating-spans)
* [How to create nested spans](manual-instrumentation/custom-spans.md#creating-nested-spans)
* [How to create spans with decorators](manual-instrumentation/custom-spans.md#creating-spans-with-decorators)
* [How to get the current span](manual-instrumentation/custom-spans.md#get-the-current-span)
* [How to add attributes to a span](manual-instrumentation/custom-spans.md#add-attributes-to-a-span)
* [How to add semantic attributes](manual-instrumentation/custom-spans.md#add-semantic-attributes)
* [How to add events](manual-instrumentation/custom-spans.md#adding-events)
* [How to set a span's status](manual-instrumentation/custom-spans.md#set-span-status)
* [How to record exceptions](manual-instrumentation/custom-spans.md#record-exceptions-in-spans)

### [Instrument: TypeScript](./#instrument-typescript)

## [Querying Spans](extract-data-from-spans.md)

How to query spans for to construct DataFrames to use for evaluation

* [How to run a query](extract-data-from-spans.md#how-to-run-a-query)
* [How to specify a project](extract-data-from-spans.md#how-to-specify-a-project)
* [How to query for documents](extract-data-from-spans.md#querying-for-retrieved-documents)
* [How to apply filters](extract-data-from-spans.md#filtering-spans)
* [How to extract attributes](extract-data-from-spans.md#extracting-span-attributes)
* [How to use data for evaluation](extract-data-from-spans.md#how-to-use-data-for-evaluation)
* [How to use pre-defined queries](extract-data-from-spans.md#predefined-queries)

## [Log Evaluation Results](./#log-evaluation-results)

How to log evaluation results to annotate traces with evals

* [How to log span evaluations](llm-evaluations.md#span-evaluations)
* [How to log document evaluations](llm-evaluations.md#document-evaluations)
* [How to specify a project for logging evaluations](llm-evaluations.md#specifying-a-project-for-the-evaluations)

## [Save and Load Traces](save-and-load-traces.md)

* [Saving Traces](save-and-load-traces.md#saving-traces)
* [Loading Traces](save-and-load-traces.md#loading-traces)

## [Trace a Deployed Application](trace-a-deployed-app.md)

* [How to instrument an application](trace-a-deployed-app.md#how-to-instrument-an-application)
* [How to deploy a Phoenix server (collector)](../../deployment/deploying-phoenix.md)
* [How to use Arize as a collector ](trace-a-deployed-app.md#exporting-traces-to-arize)
