import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { anthropic } from "@ai-sdk/anthropic-v5";

export async function createTerminalSafeFormatEvaluator() {
  return createClassificationEvaluator<{ output: string }>({
    name: "terminal-safe-format",
    model: anthropic("claude-haiku-4-5"),
    choices: { non_compliant: 0, compliant: 1 },
    promptTemplate: `You are evaluating whether a CLI agent's response is correctly formatted for terminal display.

A terminal-compliant response uses ONLY plain text or ANSI escape codes (e.g. \\x1b[1m for bold, \\x1b[32m for green, \\x1b[0m for reset).
A non-compliant response uses markdown syntax instead of ANSI codes.

<response>{{output}}</response>

CRITERIA:
"compliant" = Plain text and/or ANSI escape codes only — NO markdown syntax
"non_compliant" = Contains markdown such as **bold**, *italic*, \`code\`, \`\`\`blocks\`\`\`, # headings, [links](url), - lists (dash/asterisk/plus at line start), or > blockquotes

PLAIN TEXT that is always compliant:
- Unicode bullet characters like • are plain text characters, NOT markdown syntax → compliant
- Numbered lines like "1. item" written as plain prose → compliant
- Indented text for structure → compliant

EXAMPLES:
- "Plain explanation with no special formatting" → compliant
- "\\x1b[1mImportant:\\x1b[0m check your config" → compliant
- "• First option\\n• Second option" → compliant (• is a plain text character)
- "  • Phoenix features\\n  • Setup steps" → compliant (• with indentation is plain text)
- "You can use createEvaluator or the correctness evaluator" → compliant (technical names as plain text without backticks)
- "**Important:** check your config" → non_compliant
- "## Getting Started\\n\\nRun \`npm install\`" → non_compliant
- "Run \`npm install\` to install dependencies." → non_compliant (backtick inline code is markdown even when standalone)
- "- First item\\n- Second item" → non_compliant (dash list is markdown)
- "* First item\\n* Second item" → non_compliant (asterisk list is markdown)
- "In markdown, bold is written with two asterisks" → compliant (discussing, not using)
- "In markdown, you write bold as two asterisks before and after text." → compliant (explaining markdown syntax, not using it)

EDGE CASES:
- Empty or null response → non_compliant
- Mixed ANSI + markdown → non_compliant

Answer (compliant/non_compliant):`,
  });
}
