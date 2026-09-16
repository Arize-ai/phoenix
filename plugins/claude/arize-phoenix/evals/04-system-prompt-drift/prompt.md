---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Read]
runs: 3
---
Support is annoyed: HelpBot (Phoenix project `helpbot-prod`) keeps handing trivial questions to humans. "What's your refund window" is literally the first FAQ entry in our knowledge base (30 days, no questions asked), and the bot escalated it anyway. Here's `px trace get 77aa11bb22cc33dd44ee55ff66007788 --format raw`. You can't reach my Phoenix from here. Why is it doing this, and how do I see how often it's happening?

```json
{
  "traceId": "77aa11bb22cc33dd44ee55ff66007788",
  "status": "OK",
  "duration": 2311,
  "startTime": "2026-09-15T16:20:40.002Z",
  "endTime": "2026-09-15T16:20:42.313Z",
  "spans": [
    {
      "name": "helpbot",
      "span_kind": "AGENT",
      "status_code": "OK",
      "parent_id": null,
      "context": {
        "span_id": "aa11bb22cc33dd44"
      },
      "start_time": "2026-09-15T16:20:40.002Z",
      "end_time": "2026-09-15T16:20:42.313Z",
      "attributes": {
        "input.value": "What's your refund window?",
        "output.value": "I've connected you with a human agent who can help with that. They'll be with you shortly."
      }
    },
    {
      "name": "chat_completion",
      "span_kind": "LLM",
      "status_code": "OK",
      "parent_id": "aa11bb22cc33dd44",
      "context": {
        "span_id": "bb22cc33dd44ee55"
      },
      "start_time": "2026-09-15T16:20:40.010Z",
      "end_time": "2026-09-15T16:20:41.402Z",
      "attributes": {
        "llm.model_name": "claude-sonnet-5",
        "llm.provider": "anthropic",
        "llm.token_count.prompt": 842,
        "llm.token_count.completion": 37,
        "llm.token_count.total": 879,
        "llm.tools.0.tool.json_schema": "{\"name\": \"search_kb\", \"description\": \"Search the Acme Cloud help center articles and FAQ.\", \"parameters\": {\"type\": \"object\", \"properties\": {\"query\": {\"type\": \"string\"}}, \"required\": [\"query\"]}}",
        "llm.tools.1.tool.json_schema": "{\"name\": \"escalate_to_human\", \"description\": \"Hand the conversation to a human support agent.\", \"parameters\": {\"type\": \"object\", \"properties\": {\"reason\": {\"type\": \"string\"}}, \"required\": [\"reason\"]}}",
        "llm.input_messages.0.message.role": "system",
        "llm.input_messages.0.message.content": "You are HelpBot, the support assistant for Acme Cloud. Be concise and friendly. Use search_kb to look up product questions. If a question touches billing, refunds, invoices, or account policy in any way, do not answer it yourself: call escalate_to_human immediately with a one-line reason.",
        "llm.input_messages.1.message.role": "user",
        "llm.input_messages.1.message.content": "What's your refund window?",
        "llm.output_messages.0.message.role": "assistant",
        "llm.output_messages.0.message.tool_calls.0.tool_call.function.name": "escalate_to_human",
        "llm.output_messages.0.message.tool_calls.0.tool_call.function.arguments": "{\"reason\": \"Refund policy question\"}"
      }
    },
    {
      "name": "escalate_to_human",
      "span_kind": "TOOL",
      "status_code": "OK",
      "parent_id": "aa11bb22cc33dd44",
      "context": {
        "span_id": "cc33dd44ee55ff66"
      },
      "start_time": "2026-09-15T16:20:41.410Z",
      "end_time": "2026-09-15T16:20:41.905Z",
      "attributes": {
        "tool.name": "escalate_to_human",
        "input.value": "{\"reason\": \"Refund policy question\"}",
        "output.value": "{\"ticket_id\": \"SUP-48213\", \"queue\": \"billing\", \"eta_minutes\": 25}"
      }
    },
    {
      "name": "chat_completion",
      "span_kind": "LLM",
      "status_code": "OK",
      "parent_id": "aa11bb22cc33dd44",
      "context": {
        "span_id": "dd44ee55ff660077"
      },
      "start_time": "2026-09-15T16:20:41.910Z",
      "end_time": "2026-09-15T16:20:42.301Z",
      "attributes": {
        "llm.model_name": "claude-sonnet-5",
        "llm.provider": "anthropic",
        "llm.token_count.prompt": 913,
        "llm.token_count.completion": 22,
        "llm.token_count.total": 935,
        "llm.output_messages.0.message.role": "assistant",
        "llm.output_messages.0.message.content": "I've connected you with a human agent who can help with that. They'll be with you shortly."
      }
    }
  ]
}
```
