---
name: phoenix-pxi
description: Development guide for the Phoenix PXI agent. Use when modifying PXI-specific frontend or backend behavior, extending PXI tool wiring, updating PXI runtime capabilities, or changing the PXI agent request/dispatch flow. Start here for PXI-specific workflows, then read the relevant resource file for the layer you are changing.
metadata:
  internal: true
---

# Phoenix PXI Development

Composable guidance for extending PXI across the Phoenix codebase.

Before changing PXI behavior, identify which layer you are working in and read the relevant resource file.

## Resources

Read the relevant file(s) based on the task:

| Resource file                                     | When to read                                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resources/extending-frontend-tool-registry.md`   | Adding, editing, or removing a frontend-executed PXI tool; changing capability-gated tool behavior; updating request/dispatch flow for frontend tools |
| `resources/system-prompt-xml-conventions.md`      | Adding to, editing, or reviewing the PXI agent system prompt, any `*ToolCapabilities.ts` module, or cross-cutting output-format guidance              |

## Verification

Use layer-appropriate verification for the PXI surface you touched.

Refer to the makefile for verification commands.
