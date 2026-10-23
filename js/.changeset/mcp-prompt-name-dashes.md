---
"@arizeai/phoenix-mcp": patch
---

Stop `upsert-prompt` from stripping dashes out of prompt names. The server's prompt name identifier accepts `[a-z0-9_-]`, so `article-summarizer` is now stored under that name instead of `articlesummarizer`. Leading and trailing separators are trimmed as well, so names like `_draft` no longer reach the API and fail validation there.
