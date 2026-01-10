import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Documentation", () => {
  it("README.md should exist with comprehensive content", async () => {
    const readmePath = join(__dirname, "..", "README.md");
    const content = await readFile(readmePath, "utf-8");

    // Check that README exists and is substantial
    expect(content.length).toBeGreaterThan(5000); // Should be comprehensive

    // Check for required sections
    expect(content).toContain("# Phoenix Insight CLI");
    expect(content).toContain("## Installation");
    expect(content).toContain("## Quick Start");
    expect(content).toContain("## How It Works");
    expect(content).toContain("## Execution Modes");
    expect(content).toContain("### Sandbox Mode");
    expect(content).toContain("### Local Mode");
    expect(content).toContain("## Usage Examples");
    expect(content).toContain("### Basic Queries");
    expect(content).toContain("### Advanced Options");
    expect(content).toContain("### Interactive Mode");
    expect(content).toContain("### Snapshot Management");
    expect(content).toContain("## Configuration");
    expect(content).toContain("### Environment Variables");
    expect(content).toContain("### Command Line Options");
    expect(content).toContain("## Troubleshooting");
    expect(content).toContain("### Connection Issues");
    expect(content).toContain("### Authentication Errors");
    expect(content).toContain("### Debug Mode");
    expect(content).toContain("### Common Issues");
    expect(content).toContain("## Agent Capabilities");
    expect(content).toContain("## Development");
    expect(content).toContain("## Examples of Agent Analysis");
    expect(content).toContain("## Tips and Best Practices");
    expect(content).toContain("## License");
    expect(content).toContain("## Contributing");
    expect(content).toContain("## Support");

    // Check for key features mentioned
    expect(content).toContain("just-bash");
    expect(content).toContain("~/.phoenix-insight/");
    expect(content).toContain("px-fetch-more");
    expect(content).toContain("_context.md");
    expect(content).toContain("PHOENIX_BASE_URL");
    expect(content).toContain("PHOENIX_API_KEY");

    // Check for usage examples
    expect(content).toContain('phoenix-insight "');
    expect(content).toContain("--sandbox");
    expect(content).toContain("--local");
    expect(content).toContain("--refresh");
    expect(content).toContain("--interactive");
    expect(content).toContain("--stream");

    // Check for troubleshooting examples
    expect(content).toContain("DEBUG=1");
    expect(content).toContain("curl http://localhost:6006");

    // Check filesystem structure is documented
    expect(content).toContain("/projects/");
    expect(content).toContain("/datasets/");
    expect(content).toContain("/experiments/");
    expect(content).toContain("/prompts/");
    expect(content).toContain("/traces/");
    expect(content).toContain("/_meta/");
  });

  it("README.md should have valid markdown structure", async () => {
    const readmePath = join(__dirname, "..", "README.md");
    const content = await readFile(readmePath, "utf-8");

    // Basic structure checks
    const lines = content.split("\n");

    // Check we have a main title
    expect(lines.some((line) => line.startsWith("# "))).toBe(true);

    // Check we have section headers
    const h2Count = lines.filter((line) => line.startsWith("## ")).length;
    expect(h2Count).toBeGreaterThan(10); // Should have many sections

    // Check code blocks are properly closed
    let inCodeBlock = false;
    for (const line of lines) {
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
      }
    }
    expect(inCodeBlock).toBe(false); // All code blocks should be closed

    // Check links are properly formatted
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links = content.match(linkRegex) || [];
    expect(links.length).toBeGreaterThan(0); // Should have some links

    // Validate no broken markdown patterns
    expect(content).not.toContain("](]"); // Malformed links
    expect(content).not.toContain("[[]"); // Malformed links
    expect(content).not.toContain("```\n```"); // Empty code blocks

    // Check tables are formatted properly (should have header separator)
    const tableLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(i);
      }
    }

    // For each potential table, check it has a separator line
    for (const lineNum of tableLines) {
      if (lineNum > 0 && lines[lineNum - 1].includes("|")) {
        // This looks like a table data row, check for separator
        const prevLine = lines[lineNum - 1];
        const currentLine = lines[lineNum];
        if (prevLine.includes("|") && !currentLine.match(/\|[\s-]+\|/)) {
          // Check if there's a separator line nearby
          const hasNearSeparator =
            (lineNum > 1 && lines[lineNum - 2].match(/\|[\s-]+\|/)) ||
            (lineNum < lines.length - 1 &&
              lines[lineNum + 1].match(/\|[\s-]+\|/));

          if (!hasNearSeparator && !currentLine.match(/\|[\s-]+\|/)) {
            console.warn(
              `Possible table without separator at line ${lineNum + 1}`
            );
          }
        }
      }
    }
  });

  it("README.md should document all CLI options", async () => {
    const readmePath = join(__dirname, "..", "README.md");
    const content = await readFile(readmePath, "utf-8");

    // All CLI flags should be documented
    const requiredFlags = [
      "--sandbox",
      "--local",
      "--base-url",
      "--api-key",
      "--refresh",
      "--limit",
      "--stream",
      "--interactive",
      "-i",
    ];

    for (const flag of requiredFlags) {
      expect(content).toContain(flag);
    }

    // Commands should be documented
    expect(content).toContain("phoenix-insight snapshot");
    expect(content).toContain("px-fetch-more spans");
    expect(content).toContain("px-fetch-more trace");
  });
});
