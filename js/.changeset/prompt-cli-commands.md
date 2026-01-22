---
"@arizeai/phoenix-cli": minor
"@arizeai/phoenix-client": minor
---

Add prompt introspection commands to Phoenix CLI

- `px prompts`: List all available prompts with names and descriptions
- `px prompt <identifier>`: Show a specific prompt with support for `--tag` and `--version` options
- `--format text`: Output prompt content with XML-style role tags for piping to AI assistants like Claude Code
- Pretty print now includes full tool definitions with parameters, types, and descriptions
- Added `listPrompts` function to phoenix-client
