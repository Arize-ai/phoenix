---
description: How to customize OpenTelemetry and OpenInference for your setup
---

# Configure Tracing

### Span Processing

The tutorials and code snippets in these docs default  to the `SimpleSpanProcessor.` A `SimpleSpanProcessor` processes and exports spans as they are created. This means that if you create 5 spans, each will be processed and exported before the next span is created in code. This can be helpful in scenarios where you do not want to risk losing a batch, or if you’re experimenting with OpenTelemetry in development. However, it also comes with potentially significant overhead, especially if spans are being exported over a network - each time a call to create a span is made, it would be processed and sent over a network before your app’s execution could continue.

&#x20;The `BatchSpanProcessor` processes spans in batches before they are exported. This is usually the right processor to use for an application in production but it does mean spans may take some time to show up in Phoenix.

In production we recommend the `BatchSpanProcessor` over `SimpleSpanProcessor`\
when deployed and the `SimpleSpanProcessor` when developing.
