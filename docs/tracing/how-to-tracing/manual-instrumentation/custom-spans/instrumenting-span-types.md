# Instrumenting Span Types

This is a link to the semantic conventions for open inference:

[https://github.com/Arize-ai/openinference/blob/main/spec/semantic\_conventions.md](https://github.com/Arize-ai/openinference/blob/main/spec/semantic\_conventions.md)

## General Attributes <a href="#general-attributes" id="general-attributes"></a>

These are attributes that can work on any span.

```python
from openinference.semconv.trace import SpanAttributes

def do_work():
    with tracer.start_as_current_span("span-name") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN") # see here for a list of span kinds: https://github.com/Arize-ai/openinference/blob/main/python/openinference-semantic-conventions/src/openinference/semconv/trace/__init__.py#L271
        span.set_attribute(SpanAttributes.TAG_TAGS, str("['tag1','tag2']")) # List of tags to give the span a category
        span.set_attribute(SpanAttributes.INPUT_VALUE, "<INPUT>") # The input value to an operation
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, "text/plain") # either text/plain or application/json
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, "<OUTPUT>") # The output value of an operation
        span.set_attribute(SpanAttributes.OUTPUT_MIME_TYPE, "text/plain") # either text/plain or application/json 
        span.set_attribute(SpanAttributes.METADATA, "<ADDITIONAL_METADATA>") # additional key value pairs you want to store
        span.set_attribute(SpanAttributes.IMAGE_URL, "<IMAGE_URL>") # An http or base64 image url
        span.set_attribute("exception.message", "<EXCEPTION_MESSAGE>")
        span.set_attribute("exception.stacktrace", "<EXCEPTION_STACKTRACE>")
        span.set_attribute("exception.type", "<EXCEPTION_TYPE>") # e.g. NullPointerException
        
        
        # do some work that 'span' will track
        print("doing some work...")
        # When the 'with' block goes out of scope, 'span' is closed for you
```

## LLM <a href="#llm" id="llm"></a>

```python
from openinference.semconv.trace import SpanAttributes

def llm_call():
    with tracer.start_as_current_span("span-name") as span:
        span.set_attribute(SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES, "<prompt_template_variables>") # JSON of key value pairs representing prompt vars: to be applied to prompt template
        span.set_attribute(SpanAttributes.LLM_PROMPT_TEMPLATE, "<prompt_template>") # Template used to generate prompts as Python f-strings
        span.set_attribute(SpanAttributes.LLM_PROMPT_TEMPLATE_VERSION, "<input_messages>") # The version of the prompt template, "v1.0"
        span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, "<prompt_tokens>") # The number of tokens in the prompt
        span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, "<completion_tokens>") # The number of tokens in the completion
        span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_TOTAL, "<tokens_total>") # Total number of tokens, including both prompt and completion.
        span.set_attribute(SpanAttributes.LLM_FUNCTION_CALL, "<function_call_results>") # For models and APIs that support function calling. Records attributes such as the function name and arguments to the called function. This is the result JSON from a model representing the function(s) "to call" 
        span.set_attribute(SpanAttributes.LLM_INVOCATION_PARAMETERS, "<invocation_parameters>") # These are the invocation Object recording details of a function call in models or APIs, "{model_name: 'gpt-3', temperature: 0.7}"
        span.set_attribute(SpanAttributes.LLM_INPUT_MESSAGES, "<input_messages>") # List of messages sent to the LLM in a chat API request, [{"message.role": "user", "message.content": "hello"}]
        span.set_attribute(SpanAttributes.LLM_OUTPUT_MESSAGES, "<output_messages>") # Messages received from a chat API, [{"message.role": "user", "message.content": "hello"}]
        span.set_attribute(SpanAttributes.LLM_MODEL_NAME, "<model_name") # The name of the language model being utilized
        
```

## EMBEDDING <a href="#embedding" id="embedding"></a>

```python
from openinference.semconv.trace import SpanAttributes

def get_embeddings():
    with tracer.start_as_current_span("span-name") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.EMBEDDING.value)
        span.set_attribute(SpanAttributes.EMBEDDING_MODEL_NAME, "<RETURNED_EMBEDDING_VECTOR>") # The name of the embedding model.                
        span.set_attribute(SpanAttributes.EMBEDDING_TEXT, "<EMBEDDING_TEXT_VARIABLE>") # The text represented in the embedding
        span.set_attribute(SpanAttributes.EMBEDDING_VECTOR, "<RETURNED_EMBEDDING_VECTOR>") # The embedding vector consisting of a list of floats
        # do some work that 'span' will track
        print("doing some work...")
        # When the 'with' block goes out of scope, 'span' is closed for you
```

## DOCUMENT <a href="#document" id="document"></a>

Use this span type to log spans for documents retrieved as part of a RAG pipeline.

```python
from openinference.semconv.trace import SpanAttributes

def get_embeddings():
    with tracer.start_as_current_span("span-name") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.DOCUMENT.value)
        span.set_attribute(SpanAttributes.DOCUMENT_ID, "<DOCUMENT_ID>") # Unique identifier for a document               
        span.set_attribute(SpanAttributes.DOCUMENT_SCORE, "<DOCUMENT_SCORE>") # Score representing the relevance of a document
        span.set_attribute(SpanAttributes.DOCUMENT_CONTENT, "<DOCUMENT_CONTENT>") # The content of a retrieved document
        span.set_attribute(SpanAttributes.DOCUMENT_METADATA, str(<DOCUMENT_METADATA_JSON>)) # Metadata associated with a document
        # do some work that 'span' will track
        print("doing some work...")
        # When the 'with' block goes out of scope, 'span' is closed for you
```

## TOOL <a href="#tool" id="tool"></a>

```python
from openinference.semconv.trace import SpanAttributes

def tool_call():
    with tracer.start_as_current_span("span-name") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.TOOL.value)
        span.set_attribute(SpanAttributes.TOOL_CALL_FUNCTION_NAME, "<NAME_OF_YOUR_TOOL>") # The name of the tool being utilized
        span.set_attribute(SpanAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON, str(<JSON_OBJ_OF_FUNCTION_PARAMS>)) # The arguments for the function being invoked by a tool call
        # do some work that 'span' will track
        print("doing some work...")
        # When the 'with' block goes out of scope, 'span' is closed for you
```

## RERANKER <a href="#reranker" id="reranker"></a>

```python
from openinference.semconv.trace import SpanAttributes

def tool_call():
    with tracer.start_as_current_span("span-name") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.RERANKER.value)
        span.set_attribute(SpanAttributes.RERANKER_INPUT_DOCUMENTS, str(<LIST_OF_DOCUMENTS>)) # List of documents as input to the reranker
        span.set_attribute(SpanAttributes.RERANKER_OUTPUT_DOCUMENTS, str(<LIST_OF_DOCUMENTS>)) # List of documents as outputs of the reranker
        span.set_attribute(SpanAttributes.RERANKER_QUERY, "<RERANKER_QUERY>") # Query parameter of the reranker
        span.set_attribute(SpanAttributes.RERANKER_MODEL_NAME, "<MODEL_NAME>") # Name of the reranker model
        span.set_attribute(SpanAttributes.RERANKER_TOP_K, "<RERANKER_TOP_K>") # Top K parameter of the reranker        
        # do some work that 'span' will track
        print("doing some work...")
        # When the 'with' block goes out of scope, 'span' is closed for you
```
