---
"@arizeai/phoenix-cli": patch
---

Update the `ai` dependency to v7 to match `@arizeai/phoenix-client`'s `ai@^7.0.0` peer requirement, so installing the CLI no longer produces an unresolvable peer conflict. The CLI only uses the AI SDK's UI-message transport APIs, which are unchanged in v7.
