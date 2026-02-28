---
"@arizeai/phoenix-client": major
"@arizeai/phoenix-mcp": major
"@arizeai/phoenix-evals": major
---

feat: upgrade zod from v3 to v4

BREAKING CHANGE: Upgraded zod from v3 to v4. This changes inferred TypeScript types
for schemas using `z.looseObject()` (previously `.passthrough()`) which now include
`[x: string]: unknown` in their output types. Consumers using these types may need
to update their code. Additionally, `ZodError.errors` has been replaced with
`ZodError.issues`, `z.record()` now requires explicit key schemas, and
`zod-to-json-schema` has been replaced with native `z.toJSONSchema()`.
