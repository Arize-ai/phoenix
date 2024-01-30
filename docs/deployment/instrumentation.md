---
description: >-
  How OpenInference facilitates automatic and manual instrumentation of
  applications.
---

# Instrumentation

<figure><img src="../.gitbook/assets/integrations (1).png" alt=""><figcaption><p>Instrumentations available via OpenInference</p></figcaption></figure>



In order to make a system observable, it must be **instrumented**: That is, code from the system’s components must emit traces.

Without being required to modify the source code you can collect telemetry from an application using automatic instrumentation. If you previously used an APM agent to extract telemetry from your application, Automatic Instrumentation will give you a similar out of the box experience.

To facilitate the instrumentation of applications even more, you can manually instrument your applications by coding against the OpenTelemetry APIs.

For that you don’t need to instrument all the dependencies used in your application:

* some of your libraries will be observable out of the box by calling the OpenTelemetry API themselves directly. Those libraries are sometimes called **natively instrumented**.
* for libraries without such an integration the OpenTelemetry projects provide language specific [Instrumentation Libraries](https://github.com/Arize-ai/openinference)

Note, that for most languages it is possible to use both manual and automatic instrumentation at the same time: Automatic Instrumentation will allow you to gain insights into your application quickly and manual instrumentation will enable you to embed granular observability into your code.

The exact installation mechanism for manual and automatic instrumentation varies based on the language you’re developing in, but there are some similarities covered in the sections below.
