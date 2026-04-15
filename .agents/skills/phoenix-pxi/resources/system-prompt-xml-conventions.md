# PXI System Prompt XML Conventions

Use this guide when adding to, editing, or reviewing the PXI agent system prompt and any module that contributes lines to it.

## Why XML

Anthropic's prompt engineering guidance recommends structuring Claude prompts with XML tags so the model can cleanly separate different kinds of guidance (role, tools, constraints, output format). See Anthropic's [prompt engineering best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags).

The PXI agent system prompt follows this convention. Tool guidance, role definition, and output-format rules each live inside a descriptive top-level XML block rather than free-form markdown headings.

## Files To Know

- `app/src/agent/chat/systemPrompt.ts` — top-level assembly; owns `<role>`, the `<tools>` wrapper, and `<link_formatting>`.
- `app/src/agent/tools/<tool>/...ToolCapabilities.ts` — each tool module exports a `*_SYSTEM_PROMPT_LINES` constant that contributes one or more `<tool name="...">` blocks.

## Top-Level Structure

The system prompt is composed of three top-level XML sections, in order:

1. `<role>` — identity and high-level behavior for the agent.
2. `<tools>` — a wrapper that contains one `<tool name="...">` block per registered tool. Each tool block is contributed by its capability module.
3. `<link_formatting>` — output rules for documentation links, including the canonical docs domain (`https://arize.com/docs/phoenix`) and the rules for rewriting relative paths.

Additional top-level sections (e.g. `<output_format>`, `<examples>`) may be added when new cross-cutting guidance is introduced. Keep each section single-purpose.

## Tool Block Shape

A tool capability module contributes one `<tool>` block per tool it advertises. The standard child tags are:

```xml
<tool name="search_phoenix">
  <description>One sentence describing what the tool does.</description>
  <when_to_use>Concrete situations where the model should reach for it.</when_to_use>
</tool>
```

Tools with sandbox constraints or privileged state use additional nested blocks:

```xml
<tool name="bash">
  <description>...</description>
  <constraints>
    - first constraint
    - second constraint
  </constraints>
  <orientation>
    - how to orient the model to current context
  </orientation>
</tool>
```

Tools with behavioural rules use a `<guidelines>` block (see `elicitToolCapabilities.ts`).

## Rules

- **One XML block per concern.** Do not mix tool definitions, output rules, and role content inside a single block.
- **Descriptive tag names.** Use `<canonical_docs_domain>` rather than `<domain>`. Claude is trained to respect XML structure regardless of the exact vocabulary, so favour readability.
- **Indent nested tags two spaces** so the assembled prompt stays human-readable when printed. This is cosmetic for the model but valuable when debugging prompt output.
- **Keep capability modules self-contained.** A tool capability module should export lines that are valid XML on their own; do not rely on the top-level assembly to open or close tags on its behalf.
- **Cross-cutting output rules live in `systemPrompt.ts`.** If a rule applies to more than one tool's output (for example, how to format documentation links), put it in a top-level XML section in `systemPrompt.ts`, not inside a tool module.
- **Never emit free-form markdown headings (`##`, `###`) in prompt lines.** Use XML tags instead so tool-contributed blocks compose consistently.

## Verification

After changing any `*_SYSTEM_PROMPT_LINES` constant or the top-level assembly:

1. Run `pnpm typecheck` in `app/`.
2. Print `AGENT_SYSTEM_PROMPT` (for example via a Vitest snapshot or a scratch script) and confirm XML blocks are well-formed: every `<tag>` has a matching `</tag>` and indentation is consistent.
3. If you have an eval harness under `app/evals/`, re-run the relevant experiment to confirm the new prompt produces the intended output format.
