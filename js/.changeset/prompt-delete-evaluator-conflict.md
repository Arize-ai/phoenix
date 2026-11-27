---
"@arizeai/phoenix-client": patch
"@arizeai/phoenix-testing": patch
---

Add the 409 response to the generated `DELETE /v1/prompts/{prompt_identifier}` types. The server returns it when an LLM evaluator uses the prompt.
