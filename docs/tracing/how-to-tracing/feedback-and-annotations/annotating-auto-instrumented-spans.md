---
description: >-
  Use the capture_span_context context manager to annotate auto-instrumented
  spans
---

# Annotating Auto-Instrumented Spans

{% hint style="info" %}
Assumes you are using `openinference-instrumentation>=0.1.34`
{% endhint %}

When working with spans that are automatically instrumented via [OpenInference](https://github.com/Arize-ai/openinference) in your LLM applications, you often need to capture span contexts to apply feedback or annotations. The `capture_span_context` context manager provides a convenient way to capture all OpenInference spans within its scope, making it easier to apply feedback to specific spans in downstream operations.

The `capture_span_context` context manager allows you to:

* Capture all spans created within a specific code block
* Retrieve span contexts for later use in feedback systems
* Maintain a clean separation between span creation and annotation logic
* Apply feedback to spans without needing to track span IDs manually

## Usage

You can use the captured span contexts to implement custom feedback logic. The captured span contexts integrate seamlessly with Phoenix's annotation system:

```python
from openinference.instrumentation import capture_span_context
from opentelemetry.trace.span import format_span_id
from phoenix.client import Client

client = Client()

def process_llm_request_with_feedback(prompt: str):
    with capture_span_context() as capture:
        # Make LLM call (auto-instrumented)
        response = llm.invoke("Generate a summary")
        # Get user feedback (simulated)
        user_feedback = get_user_feedback(response)
        
        # Method 1: Get span ID using get_last_span_id (most recent span)
        last_span_id = capture.get_last_span_id()
        # Apply feedback to the most recent span
        if last_span_id:
            client.annotations.add_span_annotation(
                annotation_name="user_feedback",
                annotator_kind="HUMAN",
                span_id=last_span_id,
                label=user_feedback.label,
                score=user_feedback.score,
                explanation=user_feedback.explanation
            )
        
        # Method 2: Get all captured span contexts and iterate
        span_contexts = capture.get_span_contexts()
        # Apply feedback to all captured spans
        for span_context in span_contexts:
            # Convert span context to span ID for annotation
            span_id = format_span_id(span_context.span_id)
            
            # Add annotation to Phoenix
            client.annotations.add_span_annotation(
                annotation_name="user_feedback_all",
                annotator_kind="HUMAN",
                span_id=span_id,
                label=user_feedback.label,
                score=user_feedback.score,
                explanation=user_feedback.explanation
            )
```

#### Working with Multiple Span Types

You can filter spans based on their attributes:

```python
with capture_span_context() as capture:
    # Make LLM call (auto-instrumented)
    response = llm.invoke("Generate a summary")
    
    span_contexts = capture.get_span_contexts()
    
    # Filter for specific span types
    llm_spans = [
        ctx for ctx in span_contexts 
        if hasattr(ctx, 'attributes')
    ]
    
    # Apply different feedback logic to different span types
    for span_context in llm_spans:
        apply_llm_feedback(span_context)
```

### Resources

* [OpenInference](https://github.com/Arize-ai/openinference)
