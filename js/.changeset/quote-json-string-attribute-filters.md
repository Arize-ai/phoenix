---
"@arizeai/phoenix-client": patch
---

fix(client): JSON-quote `getSpans` string attribute filters that the server would decode, such as `'"hello"'` or `"NaN"`, so they match the stored string
