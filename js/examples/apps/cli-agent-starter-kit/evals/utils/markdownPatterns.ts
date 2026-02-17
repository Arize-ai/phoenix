export type MarkdownPattern = {
  pattern: RegExp;
  name: string;
};

export const MARKDOWN_PATTERNS: MarkdownPattern[] = [
  { pattern: /\*\*[^*]+\*\*/g, name: "bold (**text**)" },
  { pattern: /__[^_]+__/g, name: "bold (__text__)" },
  { pattern: /\*[^*\n]+\*/g, name: "italic (*text*)" },
  { pattern: /_[^_\n]+_/g, name: "italic (_text_)" },
  { pattern: /`[^`]+`/g, name: "inline code (`code`)" },
  { pattern: /```[\s\S]+?```/g, name: "code block (```)" },
  { pattern: /^#{1,6}\s+.+$/gm, name: "heading (# Title)" },
  { pattern: /\[([^\]]+)\]\(([^)]+)\)/g, name: "link ([text](url))" },
  { pattern: /^[-*+]\s+/gm, name: "unordered list (- item)" },
  { pattern: /^\d+\.\s+/gm, name: "ordered list (1. item)" },
  { pattern: /^>\s+/gm, name: "blockquote (> text)" },
];

export function detectMarkdownViolations(text: string) {
  const violations: Array<{
    pattern: string;
    matches: string[];
    lines: number[];
  }> = [];

  for (const { pattern, name } of MARKDOWN_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Find line numbers
      const lines = new Set<number>();
      for (const match of matches) {
        const index = text.indexOf(match);
        const lineNumber = text.substring(0, index).split("\n").length;
        lines.add(lineNumber);
      }
      violations.push({
        pattern: name,
        matches: [...new Set(matches)],
        lines: Array.from(lines).sort((a, b) => a - b),
      });
    }
  }

  return {
    hasViolations: violations.length > 0,
    violations,
  };
}
