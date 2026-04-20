---
"@arizeai/phoenix-client": minor
---

Add `attributes` filter to `getSpans()` for type-aware attribute matching. Pass a `Record<string, string | number | boolean>` to filter spans by attribute key/value pairs with AND semantics — the JS value type selects how the stored attribute is matched (e.g., `{ "user.id": 12345 }` matches a stored integer, `{ "user.id": "12345" }` matches a stored string). Requires Phoenix server >= 14.9.0.
