# PXI System Prompt XML Conventions

PXI ("pixie") is Phoenix's built-in AI assistant. Use this guide when adding to, editing, or reviewing the PXI agent system prompt and any module that contributes lines to it.

## Why XML

Anthropic's prompt engineering guidance recommends structuring Claude prompts with XML tags so the model can cleanly separate different kinds of guidance (role, tools, constraints, output format). See Anthropic's [prompt engineering best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags).

The PXI agent system prompt follows this convention. Tool guidance, role definition, and output-format rules each live inside a descriptive top-level XML block rather than free-form markdown headings.

## Files To Know

- `src/phoenix/server/agents/prompts/base/BASE_INSTRUCTIONS.xml.j2` — base prompt template; owns the top-level `<role>` and `<link_formatting>` blocks.
- `src/phoenix/server/agents/prompts/tools/*.xml.j2` — server-side tool guidance templates. These are passed into the matching capability classes.
- `src/phoenix/server/agents/prompts/__init__.py` — loads the Jinja templates into the `AgentPrompts` bundle.
- `src/phoenix/server/agents/agent_factory.py` — renders the base instructions and wires the prompt templates into the agent capabilities.
- `src/phoenix/server/agents/capabilities/` — tool and context capabilities that expose `ToolDefinition`s and render per-run guidance.

## Top-Level Structure

The base prompt is composed of two top-level XML sections, in order:

1. `<role>` — identity and high-level behavior for the agent.
2. `<link_formatting>` — output rules for documentation links, including the canonical docs domain (`https://arize.com/docs/phoenix`) and the rules for rewriting relative paths.

Tool, context, skill, and documentation guidance is assembled through server-side capabilities, not through a browser-owned `<tools>` wrapper. Additional top-level base sections (e.g. `<output_format>`, `<examples>`) may be added when new cross-cutting guidance is introduced. Keep each section single-purpose.

## Tool Block Shape

A server-side tool guidance template contributes one `<tool>` block per tool it describes. The standard child tags are:

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

Tools with behavioural rules use a `<guidelines>` block in the relevant server-side tool template.

## Rules

- **One XML block per concern.** Do not mix tool definitions, output rules, and role content inside a single block.
- **Descriptive tag names.** Use `<canonical_docs_domain>` rather than `<domain>`. Claude is trained to respect XML structure regardless of the exact vocabulary, so favour readability.
- **Indent nested tags two spaces** so the assembled prompt stays human-readable when printed. This is cosmetic for the model but valuable when debugging prompt output.
- **Keep capability templates self-contained.** A tool capability template should render XML that is valid on its own; do not rely on the base prompt to open or close tags on its behalf.
- **Cross-cutting output rules live in the base prompt.** If a rule applies to more than one tool's output (for example, how to format documentation links), put it in a top-level XML section in `BASE_INSTRUCTIONS.xml.j2`, not inside a tool template.
- **Never emit free-form markdown headings (`##`, `###`) in prompt lines.** Use XML tags instead so tool-contributed blocks compose consistently.

## Verification

After changing the base prompt or a capability prompt template:

1. Render the touched Jinja template, or run the nearest agent/prompt unit test, and confirm XML blocks are well-formed: every `<tag>` has a matching `</tag>` and indentation is consistent.
2. Run the nearest Python test that exercises the touched capability or agent factory path.
3. If the change is behavior-sensitive, re-run the relevant agent eval or add a focused regression test before changing expected output.
