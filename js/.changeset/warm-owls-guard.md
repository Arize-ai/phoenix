---
"@arizeai/phoenix-config": minor
"@arizeai/phoenix-cli": patch
"@arizeai/phoenix-mcp": patch
---

Harden `.env.phoenix` discovery: resolve credentials (API key + client headers) and related settings as tier groups so file values are never mixed with process-environment values; verify file trust on the opened descriptor; warn when the file is readable or writable by other users; add `clearEnvFileCache()`, `resolveEnvironmentTier()`, `getCredentialsFromEnvironment()`, and `parseHeaders()`. The Phoenix CLI now ranks discovered `.env.phoenix` values below configured profiles, so a stray file can never override an explicitly selected `--profile`.
