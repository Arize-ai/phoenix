---
"@arizeai/phoenix-client": minor
---

Add `customProviderId` to the `promptVersion()` builder so a prompt version can target a custom model provider configured in Phoenix (server >= 21.0.0). The value is sent as `custom_provider_id` alongside `modelProvider`, which still selects the invocation parameter format. Versions built without it are unchanged. `createPrompt` checks the server version before sending a version with `custom_provider_id`, since an older server would silently drop the field.
