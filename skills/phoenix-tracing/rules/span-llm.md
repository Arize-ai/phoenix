# LLM Spans

## Purpose

LLM spans represent calls to language models (OpenAI, Anthropic, local models, etc.). This is the most common span type.

## Required Attributes

| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| `openinference.span.kind` | String | Must be "LLM" | Yes |
| `llm.model_name` | String | Model identifier (e.g., "gpt-4", "claude-3-5-sonnet-20241022") | Recommended |

## Attribute Reference

### Model Information

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `llm.model_name` | String | Model identifier | "gpt-4-turbo", "claude-3-5-sonnet-20241022" |
| `llm.provider` | String | Provider name | "openai", "anthropic", "ollama" |

### Invocation Parameters

| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.invocation_parameters` | String (JSON) | Model parameters (temperature, max_tokens, top_p, top_k, frequency_penalty, presence_penalty) |

**Example:**
```json
{
  "llm.invocation_parameters": "{\"temperature\": 0.7, \"max_tokens\": 1024, \"top_p\": 1.0}"
}
```

### Token Counts

| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.token_count.prompt` | Integer | Input tokens consumed |
| `llm.token_count.completion` | Integer | Output tokens generated |
| `llm.token_count.total` | Integer | Total tokens (prompt + completion) |

### Cost Tracking

**Core Cost Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.cost.prompt` | Float | Total input cost (USD) |
| `llm.cost.completion` | Float | Total output cost (USD) |
| `llm.cost.total` | Float | Total cost (USD) |

**Prompt Cost Details:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.cost.prompt_details.input` | Float | Cost of input tokens (USD) |
| `llm.cost.prompt_details.cache_read` | Float | Cost of prompt tokens read from cache (USD) |
| `llm.cost.prompt_details.cache_write` | Float | Cost of prompt tokens written to cache (USD) |
| `llm.cost.prompt_details.cache_input` | Float | Cost of input tokens that were cached (USD) |
| `llm.cost.prompt_details.audio` | Float | Cost of audio tokens in prompt (USD) |

**Completion Cost Details:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.cost.completion_details.output` | Float | Cost of output tokens (USD) |
| `llm.cost.completion_details.reasoning` | Float | Cost of reasoning tokens (USD) |
| `llm.cost.completion_details.audio` | Float | Cost of audio tokens in completion (USD) |

**Example with detailed costs:**
```json
{
  "llm.cost.prompt": 0.0021,
  "llm.cost.completion": 0.0045,
  "llm.cost.total": 0.0066,
  "llm.cost.prompt_details.input": 0.0003,
  "llm.cost.prompt_details.cache_read": 0.0003,
  "llm.cost.prompt_details.cache_write": 0.0006,
  "llm.cost.completion_details.output": 0.0009,
  "llm.cost.completion_details.reasoning": 0.0024,
  "llm.cost.completion_details.audio": 0.0012
}
```

### Prompt Templates

| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.prompt_template.template` | String | Template with variables (e.g., "Answer: {question}") |
| `llm.prompt_template.variables` | String (JSON) | Variable values |
| `llm.prompt_template.version` | String | Template version |

### Messages

- `llm.input_messages.{i}.message.role` - Message role (user, assistant, system, tool)
- `llm.input_messages.{i}.message.content` - Simple text content
- `llm.input_messages.{i}.message.contents.{j}` - Multimodal content (text + images)
- `llm.input_messages.{i}.message.tool_calls` - Tool invocations
- `llm.output_messages.{i}.message.*` - Same structure for responses

### Tools

| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.tools.{i}.tool.json_schema` | String (JSON) | Tool/function definition in JSON Schema format |


## Examples

### Basic LLM Call

```json
{
  "openinference.span.kind": "LLM",
  "llm.model_name": "claude-3-5-sonnet-20241022",
  "llm.invocation_parameters": "{\"temperature\": 0.7, \"max_tokens\": 1024}",
  "llm.input_messages.0.message.role": "system",
  "llm.input_messages.0.message.content": "You are a helpful assistant.",
  "llm.input_messages.1.message.role": "user",
  "llm.input_messages.1.message.content": "What is the capital of France?",
  "llm.output_messages.0.message.role": "assistant",
  "llm.output_messages.0.message.content": "The capital of France is Paris.",
  "llm.token_count.prompt": 25,
  "llm.token_count.completion": 8,
  "llm.token_count.total": 33
}
```

### LLM with Tool Calls

```json
{
  "openinference.span.kind": "LLM",
  "llm.model_name": "gpt-4-turbo",
  "llm.input_messages.0.message.role": "user",
  "llm.input_messages.0.message.content": "What's the weather in San Francisco?",
  "llm.output_messages.0.message.role": "assistant",
  "llm.output_messages.0.message.tool_calls.0.tool_call.function.name": "get_weather",
  "llm.output_messages.0.message.tool_calls.0.tool_call.function.arguments": "{\"location\": \"San Francisco\"}",
  "llm.tools.0.tool.json_schema": "{\"type\": \"function\", \"function\": {\"name\": \"get_weather\", \"parameters\": {\"type\": \"object\", \"properties\": {\"location\": {\"type\": \"string\"}}}}}",
  "llm.token_count.total": 175
}
```
