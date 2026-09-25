import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  mergeSecretEntries,
  parseSecretEnvFile,
  readValueSource,
  REDACTED,
  redactSecretValues,
  stripTrailingNewline,
  validateSecretKey,
} from "../src/commands/secretInput";
import { InvalidArgumentError } from "../src/exitCodes";

const SECRET = "sk-live-0123456789abcdef";

describe("validateSecretKey", () => {
  it("accepts environment-style keys and trims whitespace", () => {
    expect(validateSecretKey("OPENAI_API_KEY", "argument 1")).toBe(
      "OPENAI_API_KEY"
    );
    expect(validateSecretKey("  _private9 ", "argument 1")).toBe("_private9");
  });

  it.each(["", "   ", "9LEADING_DIGIT", "with-dash", "with space", "ünïcode"])(
    "rejects %j as INVALID_ARGUMENT without echoing it",
    (key) => {
      let caught: unknown;
      try {
        validateSecretKey(key, "argument 1");
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(InvalidArgumentError);
      const message = (caught as Error).message;
      expect(message).toContain("argument 1");
      if (key.trim()) {
        // A mistyped key is often a pasted secret, so the text is never shown.
        expect(message).not.toContain(key.trim());
      }
    }
  );

  it("rejects KEY=value and shows only the key portion", () => {
    let caught: unknown;
    try {
      validateSecretKey(`OPENAI_API_KEY=${SECRET}`, "argument 1");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidArgumentError);
    const message = (caught as Error).message;
    expect(message).toContain("must not be passed on the command line");
    expect(message).toContain("OPENAI_API_KEY=...");
    expect(message).toContain("--value-file");
    expect(message).not.toContain(SECRET);
  });
});

describe("stripTrailingNewline", () => {
  it("removes exactly one trailing LF or CRLF", () => {
    expect(stripTrailingNewline("abc\n")).toBe("abc");
    expect(stripTrailingNewline("abc\r\n")).toBe("abc");
    expect(stripTrailingNewline("abc\n\n")).toBe("abc\n");
    expect(stripTrailingNewline("abc")).toBe("abc");
    expect(stripTrailingNewline("")).toBe("");
  });
});

describe("parseSecretEnvFile", () => {
  it("parses KEY=value lines, skipping blanks and comments", () => {
    const entries = parseSecretEnvFile(
      [
        "# provider keys",
        "",
        "OPENAI_API_KEY=sk-one",
        "export ANTHROPIC_API_KEY='sk-two'",
        'COHERE_API_KEY="sk=with=equals"',
        "   ",
      ].join("\n"),
      "secrets.env"
    );
    expect(entries).toEqual([
      { key: "OPENAI_API_KEY", value: "sk-one" },
      { key: "ANTHROPIC_API_KEY", value: "sk-two" },
      { key: "COHERE_API_KEY", value: "sk=with=equals" },
    ]);
  });

  it("does not interpolate or unescape values", () => {
    const entries = parseSecretEnvFile(
      'KEY="$OTHER\\n${X}"\r\nRAW=a b c\n',
      "secrets.env"
    );
    expect(entries).toEqual([
      { key: "KEY", value: "$OTHER\\n${X}" },
      { key: "RAW", value: "a b c" },
    ]);
  });

  it("rejects a line without '=' naming only the line number", () => {
    expect(() =>
      parseSecretEnvFile(`OPENAI_API_KEY=ok\n${SECRET}\n`, "secrets.env")
    ).toThrow(/line 2 of secrets\.env/);
    let caught: unknown;
    try {
      parseSecretEnvFile(`OPENAI_API_KEY=ok\n${SECRET}\n`, "secrets.env");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidArgumentError);
    expect((caught as Error).message).not.toContain(SECRET);
  });

  it("rejects an invalid key without echoing the line", () => {
    let caught: unknown;
    try {
      parseSecretEnvFile(`bad-key=${SECRET}`, "secrets.env");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidArgumentError);
    const message = (caught as Error).message;
    expect(message).toContain("line 1 of secrets.env");
    expect(message).not.toContain("bad-key");
    expect(message).not.toContain(SECRET);
  });

  it("rejects an empty value and points at px secret delete", () => {
    expect(() => parseSecretEnvFile("OPENAI_API_KEY=", "secrets.env")).toThrow(
      /empty.*line 1 of secrets\.env.*px secret delete OPENAI_API_KEY/
    );
    expect(() => parseSecretEnvFile('OPENAI_API_KEY=""', "-")).toThrow(
      InvalidArgumentError
    );
  });
});

describe("mergeSecretEntries", () => {
  it("keeps the last occurrence of a key in first-seen order", () => {
    expect(
      mergeSecretEntries([
        { key: "A", value: "1" },
        { key: "B", value: "2" },
        { key: "A", value: "3" },
      ])
    ).toEqual([
      { key: "A", value: "3" },
      { key: "B", value: "2" },
    ]);
  });
});

describe("redactSecretValues", () => {
  it("replaces every occurrence of every value", () => {
    const text = `bad: ${SECRET}, again ${SECRET}; other=hunter2`;
    expect(redactSecretValues(text, [SECRET, "hunter2"])).toBe(
      `bad: ${REDACTED}, again ${REDACTED}; other=${REDACTED}`
    );
  });

  it("redacts longer values first so substrings leave no fragment", () => {
    expect(redactSecretValues("abcdef abc", ["abc", "abcdef"])).toBe(
      `${REDACTED} ${REDACTED}`
    );
  });

  it("ignores null, undefined, and empty values", () => {
    expect(redactSecretValues("untouched", [null, undefined, ""])).toBe(
      "untouched"
    );
  });
});

describe("readValueSource", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "px-secret-input-"));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads a file path", async () => {
    const file = path.join(tmpDir, "key.txt");
    fs.writeFileSync(file, `${SECRET}\n`);
    await expect(
      readValueSource({ path: file, stdin: Readable.from([]) })
    ).resolves.toBe(`${SECRET}\n`);
  });

  it("reads stdin for '-'", async () => {
    await expect(
      readValueSource({
        path: "-",
        stdin: Readable.from([Buffer.from("part-"), "two\n"]),
      })
    ).resolves.toBe("part-two\n");
  });

  it("reports a missing file by path and errno code only", async () => {
    const missing = path.join(tmpDir, "missing.txt");
    await expect(
      readValueSource({ path: missing, stdin: Readable.from([]) })
    ).rejects.toThrow(InvalidArgumentError);
    await expect(
      readValueSource({ path: missing, stdin: Readable.from([]) })
    ).rejects.toThrow(`Could not read file '${missing}' (ENOENT)`);
  });
});
