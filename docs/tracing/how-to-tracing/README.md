---
description: Guides on how to use traces
---

# How-to: Tracing (Manual)

## [Setup Tracing](setup-tracing-python.md)

* Setup Tracing in [Python](setup-tracing-python.md) or [Typescript](javascript.md)
* Add Integrations via [Auto Instrumentation](../integrations-tracing/)
* [Manually Instrument](./#instrument-python) your application

## [Customize Traces & Spans](customize-spans.md)

How to set custom attributes and semantic attributes to child spans and spans created by auto-instrumentors.

* [How to log to a specific project](setup-tracing-python.md#log-to-a-specific-project)
* [How to track sessions](setup-sessions.md)
* [How to switch projects in a notebook](setup-tracing-python.md#switching-projects-in-a-notebook)
* [How to create custom spans](custom-spans.md)
* [Setting metadata](customize-spans.md#using_metadata)
* [Setting tags](customize-spans.md#specifying-tags)
* [Setting a user](customize-spans.md#using_user)
* [Setting prompt template attributes](customize-spans.md#specifying-the-prompt-template)
* [How to read attributes from context](customize-spans.md#using_attributes)
* [Masking attributes on spans](masking-span-attributes.md)

## [Auto Instrumentation](../integrations-tracing/)

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

## Manual Instrumentation

Create and customize spans for your use-case

### [Instrument: Python using OpenInference Helpers](instrument-python.md)

### [Instrument: Python using Base OTEL](./#instrument-python-using-base-otel)

* [How to acquire a Tracer](custom-spans.md#acquire-tracer)
* [How to create spans](custom-spans.md#creating-spans)
* [How to create nested spans](custom-spans.md#creating-nested-spans)
* [How to create spans with decorators](custom-spans.md#creating-spans-with-decorators)
* [How to get the current span](custom-spans.md#get-the-current-span)
* [How to add attributes to a span](custom-spans.md#add-attributes-to-a-span)
* [How to add semantic attributes](custom-spans.md#add-semantic-attributes)
* [How to add events](custom-spans.md#adding-events)
* [How to set a span's status](custom-spans.md#set-span-status)
* [How to record exceptions](custom-spans.md#record-exceptions-in-spans)

### [Instrument: TypeScript](setup-tracing-python.md)

## [Querying Spans](../how-to-interact-with-traces/extract-data-from-spans.md)

How to query spans for to construct DataFrames to use for evaluation

* [How to run a query](../how-to-interact-with-traces/extract-data-from-spans.md#how-to-run-a-query)
* [How to specify a project](../how-to-interact-with-traces/extract-data-from-spans.md#how-to-specify-a-project)
* [How to query for documents](../how-to-interact-with-traces/extract-data-from-spans.md#querying-for-retrieved-documents)
* [How to apply filters](../how-to-interact-with-traces/extract-data-from-spans.md#filtering-spans)
* [How to extract attributes](../how-to-interact-with-traces/extract-data-from-spans.md#extracting-span-attributes)
* [How to use data for evaluation](../how-to-interact-with-traces/extract-data-from-spans.md#how-to-use-data-for-evaluation)
* [How to use pre-defined queries](../how-to-interact-with-traces/extract-data-from-spans.md#predefined-queries)

## [Log Evaluation Results](./#log-evaluation-results)

How to log evaluation results to annotate traces with evals

* [How to log span evaluations](../how-to-interact-with-traces/llm-evaluations.md#span-evaluations)
* [How to log document evaluations](../how-to-interact-with-traces/llm-evaluations.md#document-evaluations)
* [How to specify a project for logging evaluations](../how-to-interact-with-traces/llm-evaluations.md#specifying-a-project-for-the-evaluations)

## [Save and Load Traces](../how-to-interact-with-traces/extract-data-from-spans.md)

* [Saving Traces](../how-to-interact-with-traces/extract-data-from-spans.md)
* [Loading Traces](../how-to-interact-with-traces/importing-existing-traces.md)

## [Trace a Deployed Application](trace-a-deployed-app.md)

* [How to instrument an application](trace-a-deployed-app.md#how-to-instrument-an-application)
* [How to deploy a Phoenix server (collector)](../../deployment/deploying-phoenix.md)
* [How to use Arize as a collector](trace-a-deployed-app.md#exporting-traces-to-arize)
