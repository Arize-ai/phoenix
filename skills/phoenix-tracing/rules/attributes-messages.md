# Message Attributes

Detailed reference for LLM message structures.


## Message Roles

Valid values for `message.role`:
- `user` - User input
- `assistant` - Model response
- `system` - System instructions
- `tool` - Tool/function result

## Basic Message Structure

| Attribute Pattern | Type | Description |
|-------------------|------|-------------|
| `llm.input_messages.{i}.message.role` | String | Message role |
| `llm.input_messages.{i}.message.content` | String | Message text content |
| `llm.output_messages.{i}.message.role` | String | Response role |
| `llm.output_messages.{i}.message.content` | String | Response content |

## Simple Message Example

```json
{
  "llm.input_messages.0.message.role": "system",
  "llm.input_messages.0.message.content": "You are a helpful assistant.",
  "llm.input_messages.1.message.role": "user",
  "llm.input_messages.1.message.content": "What is 2+2?",
  "llm.output_messages.0.message.role": "assistant",
  "llm.output_messages.0.message.content": "2+2 equals 4."
}
```

## Multimodal Messages

Messages can include images:

| Attribute Pattern | Type | Description |
|-------------------|------|-------------|
| `llm.input_messages.{i}.message.contents.{j}.message_content.type` | String | "text" or "image" |
| `llm.input_messages.{i}.message.contents.{j}.message_content.text` | String | Text content |
| `llm.input_messages.{i}.message.contents.{j}.message_content.image.url` | String | Image URL or data URI |

**Example:**
```json
{
  "llm.input_messages.0.message.role": "user",
  "llm.input_messages.0.message.contents.0.message_content.type": "text",
  "llm.input_messages.0.message.contents.0.message_content.text": "What's in this image?",
  "llm.input_messages.0.message.contents.1.message_content.type": "image",
  "llm.input_messages.0.message.contents.1.message_content.image.url": "https://example.com/image.jpg"
}
```

## Tool Call Messages

When the model requests tool calls:

| Attribute Pattern | Type | Description |
|-------------------|------|-------------|
| `llm.output_messages.{i}.message.tool_calls.{j}.tool_call.function.name` | String | Function name |
| `llm.output_messages.{i}.message.tool_calls.{j}.tool_call.function.arguments` | String (JSON) | Function arguments |
| `llm.output_messages.{i}.message.tool_calls.{j}.tool_call.id` | String | Tool call ID (for matching results) |

**Example:**
```json
{
  "llm.output_messages.0.message.role": "assistant",
  "llm.output_messages.0.message.tool_calls.0.tool_call.id": "call_abc123",
  "llm.output_messages.0.message.tool_calls.0.tool_call.function.name": "get_weather",
  "llm.output_messages.0.message.tool_calls.0.tool_call.function.arguments": "{\"location\": \"San Francisco\", \"units\": \"celsius\"}"
}
```

## Tool Result Messages

Tool results returned to the model:

| Attribute Pattern | Type | Description |
|-------------------|------|-------------|
| `llm.input_messages.{i}.message.role` | String | Must be "tool" |
| `llm.input_messages.{i}.message.tool_call_id` | String | Matches tool_call.id from request |
| `llm.input_messages.{i}.message.content` | String | Tool result as string |

**Example:**
```json
{
  "llm.input_messages.2.message.role": "tool",
  "llm.input_messages.2.message.tool_call_id": "call_abc123",
  "llm.input_messages.2.message.content": "{\"temperature\": 18, \"conditions\": \"partly cloudy\"}"
}
```

## Complete Multi-Turn with Tools Example

```json
{
  "openinference.span.kind": "LLM",
  "llm.model_name": "gpt-4-turbo",
  "llm.input_messages.0.message.role": "system",
  "llm.input_messages.0.message.content": "You are a helpful assistant with access to tools.",
  "llm.input_messages.1.message.role": "user",
  "llm.input_messages.1.message.content": "What's the weather in San Francisco?",
  "llm.output_messages.0.message.role": "assistant",
  "llm.output_messages.0.message.tool_calls.0.tool_call.id": "call_123",
  "llm.output_messages.0.message.tool_calls.0.tool_call.function.name": "get_weather",
  "llm.output_messages.0.message.tool_calls.0.tool_call.function.arguments": "{\"location\": \"San Francisco\"}",
  "llm.input_messages.2.message.role": "tool",
  "llm.input_messages.2.message.tool_call_id": "call_123",
  "llm.input_messages.2.message.content": "{\"temperature\": 18, \"conditions\": \"cloudy\"}",
  "llm.output_messages.1.message.role": "assistant",
  "llm.output_messages.1.message.content": "The weather in San Francisco is currently 18°C and cloudy."
}
```
