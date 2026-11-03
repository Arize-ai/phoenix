---
"@arizeai/phoenix-mcp": patch
---

Stop `upsert-prompt` from stripping dashes out of prompt names. The server's prompt name identifier accepts `[a-z0-9_-]`, so `article-summarizer` is now stored under that name instead of `articlesummarizer`. Leading and trailing separators are trimmed as well, so names like `_draft` no longer reach the API and fail validation there.

Upserting a name that contains a dash now creates or versions the prompt under the dashed name, instead of adding a version to the dash-stripped prompt that earlier releases created. `upsert-prompt("foo-bar")` wrote to `foobar` before and writes to `foo-bar` now, and mixed separators move the same way, with `foo - bar` going from `foo__bar` to `foo_-_bar`. Nothing raises, so a caller relying on the stripped name starts a new prompt rather than a new version of the old one.
