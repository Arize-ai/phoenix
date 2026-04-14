---
name: phoenix-pxi
 description: Development guide for the Phoenix PXI agent. Use when modifying PXI-specific frontend or backend behavior, extending PXI tool wiring, updating PXI runtime capabilities, or changing the PXI agent request/dispatch flow. Start here for PXI-specific workflows, then read the relevant rule file for the layer you are changing.
metadata:
  internal: true
---

# Phoenix PXI Development

Composable guidance for extending PXI across the Phoenix codebase.

Before changing PXI behavior, identify which layer you are working in and read the relevant rule file.

## Rule Files

Read the relevant file(s) based on the task:

| Rule file                                   | When to read                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules/extending-frontend-tool-registry.md` | Adding, editing, or removing a frontend-executed PXI tool; changing capability-gated tool behavior; updating request/dispatch flow for frontend tools |

## Verification

Use layer-appropriate verification for the PXI surface you touched.

Refer to the makefile for verification commands.
