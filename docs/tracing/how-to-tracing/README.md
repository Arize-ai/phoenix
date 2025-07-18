---
description: Guides on how to use traces
---

# How-to: Tracing

## Setup Tracing

* Setup Tracing in [Python](./#instrument-python-using-openinference-helpers) or [Typescript](setup-tracing/javascript.md)
* Add Integrations via [Auto Instrumentation](https://arize.com/docs/phoenix/integrations)
* [Manually Instrument](./#manual-instrumentation) your application

## [Customize Traces & Spans](add-metadata/customize-spans.md)

How to set custom attributes and semantic attributes to child spans and spans created by auto-instrumentors.

* [How to track sessions](setup-tracing/setup-sessions.md)
* [How to create custom spans](setup-tracing/custom-spans.md)
* [Setting metadata](add-metadata/customize-spans.md#using_metadata)
* [Setting tags](add-metadata/customize-spans.md#specifying-tags)
* [Setting a user](add-metadata/customize-spans.md#using_user)
* [Setting prompt template attributes](add-metadata/customize-spans.md#specifying-the-prompt-template)
* [How to read attributes from context](add-metadata/customize-spans.md#using_attributes)
* [Masking attributes on spans](advanced/masking-span-attributes.md)

## [Auto Instrumentation](broken-reference)

Phoenix natively works with a variety of frameworks and SDKs across [Python](./#python) and [JavaScript](./#javascript) via OpenTelemetry auto-instrumentation. Phoenix can also be natively integrated with AI platforms such as [LangFlow](broken-reference) and [LiteLLM proxy](broken-reference).

## Manual Instrumentation

Create and customize spans for your use-case

### [Instrument: Python using OpenInference Helpers](setup-tracing/instrument-python.md)

### [Instrument: Python using Base OTEL](./#instrument-python-using-base-otel)

* [How to acquire a Tracer](setup-tracing/custom-spans.md#acquire-tracer)
* [How to create spans](setup-tracing/custom-spans.md#creating-spans)
* [How to create nested spans](setup-tracing/custom-spans.md#creating-nested-spans)
* [How to create spans with decorators](setup-tracing/custom-spans.md#creating-spans-with-decorators)
* [How to get the current span](setup-tracing/custom-spans.md#get-the-current-span)
* [How to add attributes to a span](setup-tracing/custom-spans.md#add-attributes-to-a-span)
* [How to add semantic attributes](setup-tracing/custom-spans.md#add-semantic-attributes)
* [How to add events](setup-tracing/custom-spans.md#adding-events)
* [How to set a span's status](setup-tracing/custom-spans.md#set-span-status)
* [How to record exceptions](setup-tracing/custom-spans.md#record-exceptions-in-spans)

### [javascript.md](setup-tracing/javascript.md "mention")

## [Querying Spans](importing-and-exporting-traces/extract-data-from-spans.md)

How to query spans for to construct DataFrames to use for evaluation

* [How to run a query](importing-and-exporting-traces/extract-data-from-spans.md#how-to-run-a-query)
* [How to specify a project](importing-and-exporting-traces/extract-data-from-spans.md#how-to-specify-a-project)
* [How to query for documents](importing-and-exporting-traces/extract-data-from-spans.md#querying-for-retrieved-documents)
* [How to apply filters](importing-and-exporting-traces/extract-data-from-spans.md#filtering-spans)
* [How to extract attributes](importing-and-exporting-traces/extract-data-from-spans.md#extracting-span-attributes)
* [How to use data for evaluation](importing-and-exporting-traces/extract-data-from-spans.md#how-to-use-data-for-evaluation)
* [How to use pre-defined queries](importing-and-exporting-traces/extract-data-from-spans.md#predefined-queries)

## [Annotate Traces](feedback-and-annotations/)

* [Annotating in the UI](feedback-and-annotations/annotating-in-the-ui.md)
* [Annotating via the Client](feedback-and-annotations/capture-feedback.md)

## [Log Evaluation Results](./#log-evaluation-results)

How to log evaluation results to annotate traces with evals

* [How to log span evaluations](feedback-and-annotations/llm-evaluations.md#span-evaluations)
* [How to log document evaluations](feedback-and-annotations/llm-evaluations.md#document-evaluations)
* [How to specify a project for logging evaluations](feedback-and-annotations/llm-evaluations.md#specifying-a-project-for-the-evaluations)

## [Save and Load Traces](importing-and-exporting-traces/extract-data-from-spans.md)

* [Saving Traces](importing-and-exporting-traces/extract-data-from-spans.md)
* [Loading Traces](importing-and-exporting-traces/importing-existing-traces.md)

## [Cost Tracking](cost-tracking/)

How to track token-based costs for your LLM applications

* [Setting up cost tracking](cost-tracking/#send-token-counts)
* [Model pricing configuration](cost-tracking/#model-pricing-configuration)
* [Viewing cost data](cost-tracking/#viewing-cost-data)
* [Session and experiment costs](cost-tracking/#session-level-costs)
