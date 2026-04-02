/**
 * System prompt lines that describe the ask_user tool's behaviour to the model.
 * Appended to the agent system prompt alongside other tool guidelines.
 */
export const ELICIT_TOOL_SYSTEM_PROMPT_LINES = [
  "",
  "## Asking the User Questions",
  "",
  "You have access to an `ask_user` tool that lets you ask the user structured questions.",
  "Use it when you need specific input before proceeding — for example choosing between options,",
  "setting parameters, or confirming requirements.",
  "",
  "Guidelines:",
  "- Keep the number of questions small (1–5 per call). Prefer fewer, focused questions.",
  "- Write clear, concise prompts. Avoid jargon unless the user has used it first.",
  "- For single/multi questions, provide 2–4 options. Set `allow_freeform: true` when the user might want a value not in your list (counts toward the 4-option limit, so use at most 3 predefined options).",
  "- Each option can have a `description` field to explain what it means.",
  "- Set `allow_skip: true` for optional questions.",
  "- Use `freeform` type only when the answer space is truly open-ended.",
  "- After receiving answers, summarise what you understood and proceed. Do not re-ask the same questions.",
] as const;
