import { describe, expect, it } from "vitest";

import {
  formatMarkdownForTerminal,
  resolvePhoenixMarkdownHref,
} from "../src/pxi/markdown";

const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_ESCAPE_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}

describe("formatMarkdownForTerminal", () => {
  describe("resolvePhoenixMarkdownHref", () => {
    it("resolves root-relative links against a local Phoenix endpoint", () => {
      expect(
        resolvePhoenixMarkdownHref({
          href: "/settings/data",
          phoenixBaseUrl: "http://localhost:6006",
        })
      ).toBe("http://localhost:6006/settings/data");
    });

    it("preserves a custom Phoenix base path for root-relative links", () => {
      expect(
        resolvePhoenixMarkdownHref({
          href: "/settings/data",
          phoenixBaseUrl: "https://example.com/phoenix",
        })
      ).toBe("https://example.com/phoenix/settings/data");
    });

    it("resolves relative links against the Phoenix base path", () => {
      expect(
        resolvePhoenixMarkdownHref({
          href: "settings/data",
          phoenixBaseUrl: "https://example.com/phoenix",
        })
      ).toBe("https://example.com/phoenix/settings/data");
      expect(
        resolvePhoenixMarkdownHref({
          href: "./settings/data",
          phoenixBaseUrl: "https://example.com/phoenix",
        })
      ).toBe("https://example.com/phoenix/settings/data");
    });

    it("preserves query strings and hashes", () => {
      expect(
        resolvePhoenixMarkdownHref({
          href: "/projects/1?tab=traces#span",
          phoenixBaseUrl: "https://example.com/phoenix/",
        })
      ).toBe("https://example.com/phoenix/projects/1?tab=traces#span");
    });

    it("leaves external and special links unchanged", () => {
      const unchangedHrefs = [
        "https://external.example/path",
        "http://external.example/path",
        "mailto:support@example.com",
        "tel:+15555555555",
        "//cdn.example.com/file",
        "#section",
      ];

      for (const href of unchangedHrefs) {
        expect(
          resolvePhoenixMarkdownHref({
            href,
            phoenixBaseUrl: "https://example.com/phoenix",
          })
        ).toBe(href);
      }
    });

    it("leaves links unchanged when the Phoenix base URL is invalid", () => {
      expect(
        resolvePhoenixMarkdownHref({
          href: "/settings/data",
          phoenixBaseUrl: "not a url",
        })
      ).toBe("/settings/data");
    });
  });

  it("formats markdown pipe tables as terminal tables", () => {
    const formatted = formatMarkdownForTerminal({
      text: [
        "Here are the projects:",
        "",
        "| Name | Traces |",
        "| --- | ---: |",
        "| default | 12 |",
        "| staging | 3 |",
      ].join("\n"),
      maxWidth: 80,
    });

    expect(formatted).toContain("Here are the projects:");
    expect(formatted).toContain("┌");
    expect(formatted).toContain("│ Name");
    expect(formatted).toContain("│ default");
    expect(formatted).not.toContain("| --- |");
  });

  it("renders markdown lists without raw markdown markers", () => {
    const formatted = formatMarkdownForTerminal({
      text: "- one\n- two",
      maxWidth: 80,
    });

    expect(formatted).toContain("one");
    expect(formatted).toContain("two");
    expect(formatted).not.toContain("- one");
  });

  it("renders Phoenix-relative markdown links as absolute terminal links", () => {
    const formatted = stripAnsi(
      formatMarkdownForTerminal({
        text: "[Data retention](/settings/data)",
        maxWidth: 80,
        phoenixBaseUrl: "https://example.com/phoenix",
      })
    );

    expect(formatted).toContain("Data retention");
    expect(formatted).toContain("https://example.com/phoenix/settings/data");
    expect(formatted).not.toContain("](/settings/data)");
  });

  it("does not rewrite links inside fenced code blocks", () => {
    const formatted = stripAnsi(
      formatMarkdownForTerminal({
        text: ["```md", "[Data retention](/settings/data)", "```"].join("\n"),
        maxWidth: 80,
        phoenixBaseUrl: "https://example.com/phoenix",
      })
    );

    expect(formatted).toContain("[Data retention](/settings/data)");
    expect(formatted).not.toContain(
      "https://example.com/phoenix/settings/data"
    );
  });
});
