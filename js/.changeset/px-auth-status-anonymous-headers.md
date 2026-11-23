---
"@arizeai/phoenix-cli": patch
---

`px auth status` now sends the profile's custom headers when it retries expired OAuth credentials as anonymous access, so the retry works behind a header-gated proxy.
