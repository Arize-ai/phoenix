import chalk from "chalk";
import { highlight } from "cli-highlight";

/**
 * Renders markdown text to terminal-formatted output with ANSI codes.
 * Provides clean, readable formatting for agent responses.
 *
 * @param text - The markdown text to render
 * @returns Terminal-formatted string with ANSI codes
 *
 * @example
 * ```typescript
 * const output = renderMarkdown("# Hello\n\nThis is **bold** text");
 * console.log(output); // Displays formatted output in terminal
 * ```
 */
export function renderMarkdown(text: string): string {
  if (!text || text.trim() === "") {
    return text;
  }

  try {
    let result = text;

    // Process code blocks first (triple backticks)
    result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      const language = lang || "text";
      try {
        const highlighted = highlight(code.trim(), { language, theme: { keyword: chalk.cyan, string: chalk.yellow, comment: chalk.gray } });
        return "\n" + highlighted.split("\n").map(line => "  " + line).join("\n") + "\n";
      } catch {
        return "\n" + code.trim().split("\n").map((line: string) => "  " + chalk.gray(line)).join("\n") + "\n";
      }
    });

    // Process inline code (single backticks)
    result = result.replace(/`([^`]+)`/g, (_match, code) => {
      return chalk.yellow(code);
    });

    // Process headings
    result = result.replace(/^### (.+)$/gm, (_match, heading) => {
      return chalk.cyan("### " + heading);
    });
    result = result.replace(/^## (.+)$/gm, (_match, heading) => {
      return chalk.cyan.bold("## " + heading);
    });
    result = result.replace(/^# (.+)$/gm, (_match, heading) => {
      return chalk.green.bold.underline("# " + heading);
    });

    // Process bold (**text** or __text__)
    result = result.replace(/\*\*(.+?)\*\*/g, (_match, text) => {
      return chalk.bold(text);
    });
    result = result.replace(/__(.+?)__/g, (_match, text) => {
      return chalk.bold(text);
    });

    // Process italic (*text* or _text_)
    result = result.replace(/\*(.+?)\*/g, (_match, text) => {
      return chalk.italic(text);
    });
    result = result.replace(/_(.+?)_/g, (_match, text) => {
      return chalk.italic(text);
    });

    // Process links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      return chalk.blue(text) + chalk.dim(" (" + url + ")");
    });

    // Process unordered lists
    result = result.replace(/^[\s]*[-*+] (.+)$/gm, (_match, item) => {
      return chalk.dim("  •") + " " + item;
    });

    // Process ordered lists
    result = result.replace(/^[\s]*(\d+)\. (.+)$/gm, (_match, num, item) => {
      return chalk.dim("  " + num + ".") + " " + item;
    });

    return result;
  } catch {
    // Graceful fallback to original text on parsing errors
    return text;
  }
}

/**
 * Checks if text contains markdown syntax patterns.
 * Useful for conditional rendering or performance optimization.
 *
 * @param text - The text to check
 * @returns True if markdown patterns are detected
 *
 * @example
 * ```typescript
 * hasMarkdownSyntax("# Hello") // true
 * hasMarkdownSyntax("Plain text") // false
 * ```
 */
export function hasMarkdownSyntax(text: string): boolean {
  if (!text) return false;

  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s/m, // Headings
    /\*\*[\s\S]+?\*\*/, // Bold
    /\*[\s\S]+?\*/, // Italic
    /`[\s\S]+?`/, // Code spans
    /```[\s\S]+?```/, // Code blocks
    /^\s*[-*+]\s/m, // Unordered lists
    /^\s*\d+\.\s/m, // Ordered lists
    /\[[\s\S]+?\]\([\s\S]+?\)/, // Links
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}
