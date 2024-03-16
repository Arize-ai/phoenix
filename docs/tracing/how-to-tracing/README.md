---
description: Guides on how to use traces
---

# How-to: Tracing

## [Tracing Core Concepts](tracing-core-concepts.md)

* [How to log traces](tracing-core-concepts.md#how-to-log-traces)
* [How to turn off tracing](tracing-core-concepts.md#how-to-turn-off-tracing)

## [Customize Traces](customize-traces.md)

* [How to log to a specific project](customize-traces.md#log-to-a-specific-project)
* [How to switch projects in a notebook](customize-traces.md#switching-projects-in-a-notebook)
* [How to add auto-instrumentation](instrumentation/)
* [How to create custom spans](custom-spans.md)

## [Auto Instrumentation](./#auto-instrumentation)

Use auto-instrumentation to export traces for common frameworks and libraries

* [Instrument LlamaIndex](instrumentation/llamaindex.md)
* [Instrument LangChain](instrumentation/langchain.md)
* [Instrument OpenAI](instrumentation/dspy.md)
* [Instrument DSPy](instrumentation/dspy.md)
* [Instrument AWS Bedrock](instrumentation/bedrock.md)
* [Instrument utoGen](instrumentation/autogen-support.md)

## [Manual Instrumentation](./#manual-instrumentation)

Create and customize spans for your use-case

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
