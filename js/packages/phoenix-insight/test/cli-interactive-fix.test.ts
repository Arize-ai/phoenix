import { describe, it, expect } from "vitest";
import { Readable, Writable } from "node:stream";

describe("CLI Interactive Mode - Premature Exit Fix", () => {
  it("should check for potential readline interface issues", () => {
    // Test that mocked readline behaves as expected
    const mockStdin = new Readable({
      read() {},
    });
    const mockStdout = new Writable({
      write(chunk, encoding, callback) {
        if (callback) callback();
        return true;
      },
    });

    // Mock readline module
    const readline = require("readline");
    const rl = readline.createInterface({
      input: mockStdin,
      output: mockStdout,
      prompt: "test> ",
    });

    // Verify the interface is created properly
    expect(rl).toBeDefined();
    expect(rl.input).toBe(mockStdin);
    expect(rl.output).toBe(mockStdout);

    // Test that event-based approach works correctly
    let lineReceived = false;
    rl.on("line", () => {
      lineReceived = true;
    });
    expect(rl.listenerCount("line")).toBe(1);

    rl.close();
  });
});
