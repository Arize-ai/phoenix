---
"@arizeai/phoenix-cli": patch
"@arizeai/phoenix-client": patch
---

Keep a prompt tag's stored description when the tag is moved without `description`; an explicit `null` still clears it. The CLI no longer prints `description: null` for an omitted flag, and its help, README and JSDoc describe the contract.
