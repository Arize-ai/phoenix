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
* Access both the first and last spans in a trace topology for targeted feedback

## Understanding Span Topology

When your LLM application executes, it creates a hierarchy of spans representing different operations. For example, when using a framework, you might have:

```
framework (root span)
  ├── span 1 (query processing)
  │     └── span 2 (LLM call)
  └── span 3 (response formatting)
```

The `capture_span_context` context manager helps you easily access:
- **First span**: The root span of your operation (useful for high-level feedback and evaluations)
- **Last span**: The most recent span created (often the final LLM call, useful for LLM-specific feedback)
- **All spans**: A complete list of all spans created within the context (useful for comprehensive analysis)

## Usage

### Accessing First and Last Spans

```python
from openinference.instrumentation import capture_span_context
from phoenix.client import Client

client = Client()

def process_llm_request_with_feedback(prompt: str):
    with capture_span_context() as capture:
        # This creates multiple spans in a hierarchy when using a framework
        response = llm.invoke("Generate a summary")
        # Get user feedback (simulated)
        user_feedback = get_user_feedback(response)
        
        # Method 1: Get first span ID (root span - good for user feedback)
        first_span_id = capture.get_first_span_id()
        if first_span_id:
            # Apply user feedback to the first span
            client.annotations.add_span_annotation(
                annotation_name="user_feedback",
                annotator_kind="HUMAN",
                span_id=first_span_id,
                label=user_feedback.label,
                score=user_feedback.score,
                explanation=user_feedback.explanation
            )
        
        # Method 2: Get last span ID (most recent span - often the LLM call)
        last_span_id = capture.get_last_span_id()
        if last_span_id:
            # Apply feedback to the most recent span
            client.annotations.add_span_annotation(
                annotation_name="llm_response_quality",
                annotator_kind="HUMAN", 
                span_id=last_span_id,
                label="helpful",
                score=4,
                explanation="The LLM provided a helpful and relevant response"
            )
```

### When to Use First vs Last Spans

**Use the first span (`get_first_span_id()`) when:**
- Adding user feedback about the overall experience
- Recording evaluation scores for the entire request/response cycle
- Tracking session-level or conversation-level metadata
- Applying business logic annotations that span the entire operation

**Use the last span (`get_last_span_id()`) when:**
- The last span represents an LLM invocation
- You want to annotate the final output or generation step
- Applying feedback specifically to the model's response quality
- Recording model-specific metrics or evaluations

### Complete Example: Multi-Level Feedback

```python
from openinference.instrumentation import capture_span_context
from phoenix.client import Client

client = Client()

def chat_with_comprehensive_feedback(user_input: str):
    with capture_span_context() as capture:
        # Auto-instrumented framework call
        response = framework.process(user_input)
        
        # Simulate getting user feedback
        user_rating = get_user_rating(response)  # Returns 1-5 score
        
        # Apply feedback to the first span (overall experience)
        first_span_id = capture.get_first_span_id()
        if first_span_id:
            client.annotations.add_span_annotation(
                annotation_name="user_experience",
                annotator_kind="HUMAN",
                span_id=first_span_id,
                label="satisfied" if user_rating >= 4 else "unsatisfied",
                score=user_rating,
                explanation=f"User rated the overall experience: {user_rating}/5"
            )
        
        # Apply feedback to the last span (typically the LLM response)
        last_span_id = capture.get_last_span_id()
        if last_span_id and last_span_id != first_span_id:  # Avoid duplicate annotations
            # Run an evaluation on the LLM response
            relevance_score = evaluate_relevance(user_input, response)
            
            client.annotations.add_span_annotation(
                annotation_name="relevance",
                annotator_kind="LLM",
                span_id=last_span_id,
                score=relevance_score,
                explanation="Automated relevance evaluation of the LLM response"
            )
```

### Working with All Captured Spans

You can also access all spans for more complex annotation scenarios:

```python
with capture_span_context() as capture:
    # Make LLM call (auto-instrumented)
    response = llm.invoke("Generate a summary")
    
    # Get all captured span contexts
    span_contexts = capture.get_span_contexts()
    
    # Apply different feedback logic to different spans
    for i, span_context in enumerate(span_contexts):
        span_id = format_span_id(span_context.span_id)
        
        client.annotations.add_span_annotation(
            annotation_name="span_order",
            annotator_kind="CODE",
            span_id=span_id,
            label=f"span_{i}",
            metadata={"position": i, "total_spans": len(span_contexts)}
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

### Best Practices

1. **Hierarchical Feedback**: Use first spans for high-level feedback (user experience, overall quality) and last spans for specific component feedback (LLM response quality, retrieval relevance)

2. **Avoid Duplicate Annotations**: Check if `first_span_id == last_span_id` to avoid applying the same annotation twice when there's only one span

3. **Context-Aware Annotations**: Use the span topology to understand what each span represents in your application flow

4. **Deferred Annotation**: Capture spans first, then apply annotations after the main operation completes to avoid interfering with execution

### Resources

* [OpenInference](https://github.com/Arize-ai/openinference)
* [Phoenix Client Documentation](../../../api-reference/phoenix-client.md)
