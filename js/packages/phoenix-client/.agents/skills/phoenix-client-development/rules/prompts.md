# Prompt APIs

## Select Prompts With A Selector, Not A Bare String

Helpers in `src/prompts/` take a **selector object** under a `prompt` key, never a
bare identifier string. `getPrompt` established this with `PromptSelector`
(`{ promptId }` | `{ name }` | `{ versionId }` | `{ tag, name }`), and new helpers
follow it — a call site reads as `{ prompt: { name: "x" } }`, which says _which
kind_ of thing `"x"` is.

Two selector unions live in `src/types/prompts.ts`. Pick by what the operation
acts on:

| Union              | Members                       | For                                             |
| ------------------ | ----------------------------- | ----------------------------------------------- |
| `PromptSelector`   | id, name, versionId, tag+name | Operations that resolve to a prompt **version** |
| `PromptIdentifier` | `{ promptId }` \| `{ name }`  | Operations on the **prompt itself**             |

`PromptIdentifier` is what the REST `{prompt_identifier}` path segment accepts.
Resolve it with `resolvePromptIdentifier()` from `src/utils/` rather than reaching
into the selector inline.

## Guard Version Selectors At Runtime

TypeScript alone will not keep a version selector out of a `PromptIdentifier`
parameter: `GetPromptByTagSelector` is structurally assignable to
`GetPromptByNameSelector`, so a `{ name, tag }` variable type-checks and would
silently widen to the whole prompt. `resolvePromptIdentifier()` therefore
rejects `versionId` and `tag` at runtime. Keep that guard in place — for
destructive operations it is the difference between deleting one version's worth
of intent and deleting everything.

## Known Inconsistency

`updatePrompt` predates this convention and still takes `promptIdentifier: string`.
Do not copy it for new helpers. If you touch its signature, add `prompt` as the
supported form and deprecate `promptIdentifier` rather than breaking callers.

## Version-Gate New Routes

Prompt routes have landed across many server releases. Add a `RouteRequirement`
to `src/constants/serverRequirements.ts` (with the release the route shipped in,
confirmed from `CHANGELOG.md` — not guessed) and call `ensureServerCapability()`
before the request so old servers fail with a clear message instead of a 404.
