# Prompt, PromptVersion

## Reaching a prompt

There is **no `getPromptByName`** — fetch via `node(id:)` or the `prompts(filter: PromptFilter, labelIds)` connection.

## Prompt fields

- `name`, `description`, `metadata`
- `version(versionId: GlobalID, tagName: Identifier)` → `PromptVersion` — **call with no args to get the latest version**; pass `versionId` or `tagName` to pin one.
- `promptVersions(first, after)` → `PromptVersionConnection`
- `versionTags`, `labels`

## PromptVersion fields

- `modelName`, `modelProvider`
- `templateType`, `templateFormat`
- `template` — union `PromptStringTemplate | PromptChatTemplate`. Chat templates expose `messages { role content { ... } }`; string templates expose `template`.
- `invocationParameters`, `tools`, `responseFormat`
- `tags`, `isLatest`, `sequenceNumber`, `previousVersion`

## Example

```graphql
query LatestPrompt($id: ID!) {
  node(id: $id) {
    ... on Prompt {
      name
      version {
        modelName
        modelProvider
        template {
          ... on PromptChatTemplate { messages { role } }
          ... on PromptStringTemplate { template }
        }
      }
    }
  }
}
```
