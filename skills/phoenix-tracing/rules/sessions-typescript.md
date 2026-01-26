# Sessions (TypeScript)

Track multi-turn conversations by grouping traces with session IDs.

## Setup

```typescript
import { context } from "@opentelemetry/api";
import { setSession } from "@arizeai/openinference-core";

await context.with(
  setSession(context.active(), { sessionId: "user_123_conv_456" }),
  async () => {
    const response = await llm.invoke(prompt);
  }
);
```

## Best Practices

**Bad: Only parent span gets session ID**

```typescript
const span = trace.getActiveSpan();
span?.setAttribute(SemanticConventions.SESSION_ID, sessionId);
const response = await client.chat.completions.create(...);
```

**Good: All child spans inherit session ID**

```typescript
await context.with(
  setSession(context.active(), { sessionId }),
  async () => {
    const response = await client.chat.completions.create(...);
    const result = await myCustomFunction();
  }
);
```

**Why:** `setSession()` propagates session ID to all nested spans automatically.

## Session ID Patterns

```typescript
import { randomUUID } from "crypto";

const sessionId = randomUUID();
const sessionId = `user_${userId}_conv_${conversationId}`;
const sessionId = `debug_${timestamp}`;
```

Good: `randomUUID()`, `"user_123_conv_456"`
Bad: `"session_1"`, `"test"`, empty string

## Multi-Turn Chatbot Example

```typescript
import { randomUUID } from "crypto";
import { context } from "@opentelemetry/api";
import { setSession } from "@arizeai/openinference-core";

const sessionId = randomUUID();
const messages: any[] = [];

async function sendMessage(userInput: string): Promise<string> {
  messages.push({ role: "user", content: userInput });

  return context.with(
    setSession(context.active(), { sessionId }),
    async () => {
      const response = await client.chat.completions.create({
        model: "gpt-4",
        messages
      });
      const content = response.choices[0].message.content!;
      messages.push({ role: "assistant", content });
      return content;
    }
  );
}
```

## Additional Attributes

```typescript
import { trace } from "@opentelemetry/api";

await context.with(
  setSession(context.active(), { sessionId }),
  async () => {
    const span = trace.getActiveSpan();
    span?.setAttributes({
      "user.id": "user_123",
      "metadata.tier": "premium"
    });
    const response = await llm.invoke(prompt);
  }
);
```

## See Also

- **Python sessions:** `sessions-python.md`
- **Session docs:** https://docs.arize.com/phoenix/tracing/sessions
