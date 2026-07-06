---
"@arizeai/phoenix-cli": minor
---

Improve PXI tool call rendering in the terminal: each tool call now shows a state glyph (spinner while running, then ✓/✗/?/⊘), a per-tool icon, and a one-line summary of what the tool is doing, derived from its input. Bash calls display the model-written summary, an excerpt of the executing command, and on failure the exit code plus a stderr excerpt; `load_skill` and `read_skill_resource` collapse to quiet one-liners once complete.
