# Phoenix Tracing: Sessions (TypeScript)

**Track multi-turn conversations by grouping traces with session IDs.**

## Overview

Sessions group related traces within a project for:
- Multi-turn chatbot conversations
- User-specific tracking
- Debugging workflows

## Set Session ID

**Using `setSession()` (Recommended):**
```typescript
import { context } from "@opentelemetry/api";
import { setSession } from "@arizeai/openinference-core";

await context.with(
  setSession(context.active(), { sessionId: "user_123_conv_456" }),
  async () => {
    const response = await llm.invoke(prompt);  // All spans get session.id
  }
);
```

**Using span attributes directly:**
```typescript
import { trace } from "@opentelemetry/api";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";

const span = trace.getActiveSpan();
span?.setAttribute(SemanticConventions.SESSION_ID, sessionId);

// Must still wrap child calls for propagation
await context.with(
  setSession(context.active(), { sessionId }),
  async () => {
    const response = await client.chat.completions.create(...);
  }
);
```

## Best Practices

**Generate unique session IDs:**
```typescript
import { randomUUID } from "crypto";

const sessionId = randomUUID();  // UUID
// Or: `user_${userId}_conv_${conversationId}`
```

Good: `"user_123_conv_456"`, `randomUUID()`
Bad: `"session_1"`, `"test"`, empty string

**Always use `setSession()` for propagation:**
```typescript
// ✅ Good: All child spans get session ID
await context.with(
  setSession(context.active(), { sessionId }),
  async () => {
    const response = await client.chat.completions.create(...);
    const result = await myCustomFunction();
  }
);

// ❌ Bad: Only parent span has session ID
span.setAttribute(SemanticConventions.SESSION_ID, sessionId);
const response = await client.chat.completions.create(...);  // Missing!
```

## Use Cases

**Multi-turn chatbot:**
```typescript
import { context } from "@opentelemetry/api";
import { setSession } from "@arizeai/openinference-core";
import { randomUUID } from "crypto";
import OpenAI from "openai";

const sessionId = randomUUID();
const messages: any[] = [];

async function sendMessage(userInput: string): Promise<string> {
  messages.push({ role: "user", content: userInput });

  return context.with(
    setSession(context.active(), { sessionId }),
    async () => {
      const response = await client.chat.completions.create({
        model: "gpt-4",
        messages: messages,
      });

      const assistantMessage = response.choices[0].message.content!;
      messages.push({ role: "assistant", content: assistantMessage });
      return assistantMessage;
    }
  );
}
```

**User-specific tracking:**
```typescript
async function handleUserRequest(userId: string, query: string) {
  const sessionId = `user_${userId}_${new Date().toISOString()}`;
  return context.with(
    setSession(context.active(), { sessionId }),
    async () => processQuery(query)
  );
}
```

**Debugging:**
```typescript
await context.with(
  setSession(context.active(), { sessionId: "debug_session_123" }),
  async () => myBuggyWorkflow()
);
```

## Additional Attributes

**Add user ID:**
```typescript
import { trace } from "@opentelemetry/api";

await context.with(
  setSession(context.active(), { sessionId: "conv_456" }),
  async () => {
    const span = trace.getActiveSpan();
    span?.setAttribute("user.id", "user_123");
    const response = await llm.invoke(prompt);
  }
);
```

**Add custom metadata:**
```typescript
span?.setAttributes({
  "session.id": "conv_456",
  "metadata.user_tier": "premium",
  "metadata.region": "us-west",
});
```


## Express.js Integration

```typescript
import express from "express";
import { context } from "@opentelemetry/api";
import { setSession } from "@arizeai/openinference-core";

const app = express();
app.use(express.json());

// Middleware to extract session ID from request header
app.use((req, res, next) => {
  const sessionId = req.headers["x-session-id"] as string;
  if (sessionId) {
    const ctx = setSession(context.active(), { sessionId });
    context.with(ctx, () => next());
  } else {
    next();
  }
});

app.post("/chat", async (req, res) => {
  const response = await processMessage(req.body.message);
  res.json({ response });
});
```

**Client sends session ID in header:**
```typescript
fetch("http://localhost:3000/chat", {
  headers: { "X-Session-Id": sessionId },
  body: JSON.stringify({ message: "Hello!" })
});
```
