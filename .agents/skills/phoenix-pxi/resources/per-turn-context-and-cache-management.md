# Per-Turn Context And Prompt Cache Management

PXI ("pixie") is Phoenix's built-in AI assistant. Use this guide when adding any per-turn information to the chat request — current page state, selected entity, validated form fields, ephemeral capability flags — that the agent should see for one turn but that does not belong in the static system prompt.

## Principle

Provider prompt caches (Anthropic `cache_control`, OpenAI prefix caching) key on a **stable byte-prefix**. The cache breaks the moment any byte of the prefix changes. The agent message list looks roughly like:

```
[system prompt, ...prior conversation, latest user turn]
   ^---------- prefix that providers can cache ---------^
```

Anything appended at the **tail** is cheap. Anything mutated in the **prefix** invalidates the cache for the entire conversation, and the cost grows linearly with conversation length.

Per-turn ephemeral data — selected span, current span filter, page route, transient capability — is volatile by definition. It must live at the tail.

## Pattern

When you need to add per-turn context to the model's view:

1. **Build a string** from the resolved server-side state. Wrap it in a domain-specific XML tag so the model has an unambiguous boundary, e.g. `<phoenix_ui_context>…</phoenix_ui_context>`.
2. **Append** the string as a `UserPromptPart`-bearing `ModelRequest` at the **end** of `body.messages`. Do not prepend, do not insert into the system slot, do not modify `body.system`.
3. **Dedupe** on exact `UserPromptPart.content` match against the existing messages. If the same content already appears, return the list unchanged. This handles inner agent loops re-entering the request path within a single turn and avoids duplicate token spend.
4. **Frame** the body with a one-line disclaimer that the content is ambient state, not user instructions. Tag wrappers help; framing reduces residual prompt-injection risk.

The canonical implementation is `src/phoenix/server/api/routers/chat_context.py` — `build_phoenix_context_user_message_content` + `insert_context_user_message`. Reuse those helpers; do not invent a parallel injection path.

## Sanitize User-Controlled Values

Any value that originates from the user (filter expressions, free-text labels, names) and flows into the rendered context body is a prompt-injection vector even when it sits in a user-role message. Treat it as untrusted:

- **Collapse whitespace.** Replace `\n`, `\r`, `\t` with single spaces so the value is one line and cannot mimic the surrounding prompt structure.
- **Neutralize the wrapper closing tag.** Replace any literal `</phoenix_ui_context>` (or whatever wrapper you used) with a defanged form like `[/phoenix_ui_context]`. A single closing tag inside the body would let an attacker escape the sandbox.
- **Cap length.** Pick a generous cap (e.g. 512 chars) and append a truncation marker (`… [truncated]`). Unbounded user text means unbounded prompt size.
- **Render as a literal.** Wrap the sanitized value in backticks so the model reads it as data, not instructions.

`_sanitize_condition` in `chat_context.py` is the reference. Mirror it for new fields rather than rolling new sanitization.

## Anti-Patterns

- **Don't** prepend a `SystemPromptPart` carrying per-turn data. It busts the cache prefix on every turn.
- **Don't** mutate `body.system` to inject context. `body.system` is the user-set system prompt and should remain stable across turns.
- **Don't** rely on the disclaimer alone to neutralize injection. Tag wrappers + sanitization + length caps are layered defense; the disclaimer is the weakest layer.
- **Don't** skip the dedupe check. Inner loops (tool follow-ups, retries) can re-enter the chat router; without dedupe, identical context blocks pile up.

## Files To Know

- `src/phoenix/server/api/routers/chat_context.py` — context resolution, body builder, sanitization, and the `insert_context_user_message` helper.
- `src/phoenix/server/api/routers/chat.py` — the single call site that injects the per-turn message into `body.messages`.
- `src/phoenix/server/api/routers/data_stream_protocol.py` — `parse_chat_body`; note how `body.system` is applied to the prefix and why per-turn data must not flow through that path.

## Verification

- Unit-test that the helper appends at the tail and that the prefix is byte-identical to the input list — the test in `tests/unit/server/api/routers/test_chat_context.py::TestInsertContextUserMessage::test_appends_user_message_at_end` is the template.
- Unit-test that an exact-content match in any prior `UserPromptPart` is a no-op.
- For sanitization: cover newline collapse, length truncation, and closing-tag neutralization. Cover the closing-tag case explicitly; it's the only one that turns a soft injection into a sandbox escape.
- For end-to-end caching: enable `logger.debug` on the chat router and confirm that two consecutive turns produce model-bound message lists that differ only in the trailing context message and the new user turn. The static prefix must be byte-equal.
