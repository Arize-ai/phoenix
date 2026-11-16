"""The tool that object generation asks a model to call, shared by the adapters."""

TOOL_NAME = "extract_structured_data"
# A forced `tool_choice` (`{"type": "tool"}` or `{"type": "any"}`) is rejected by some Claude models
# and can't be combined with extended thinking, so Anthropic object generation leaves `tool_choice`
# on `auto`, which every model accepts, and asks for the tool call in the system prompt instead, as
# Anthropic's migration guide recommends:
# https://platform.claude.com/docs/en/models/opus-5-5/migration-guide#forced-tool-use
TOOL_INSTRUCTION = f"Respond by calling the `{TOOL_NAME}` tool."
