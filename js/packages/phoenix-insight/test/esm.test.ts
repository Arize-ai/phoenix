import { describe, it, expect } from "vitest";
import * as url from "node:url";
import * as path from "node:path";

describe("ESM Module Configuration", () => {
  it("should be running in ESM context", () => {
    // In ESM, import.meta.url is available
    expect(import.meta.url).toBeDefined();
    expect(typeof import.meta.url).toBe("string");
    expect(import.meta.url).toMatch(/file:\/\//);
  });

  it("should have correct file extensions in imports", async () => {
    // Dynamic import to verify .js extensions work
    const modesModule = await import("../src/modes/index.js");
    expect(modesModule).toBeDefined();
    expect(modesModule.SandboxMode).toBeDefined();
    expect(modesModule.LocalMode).toBeDefined();
  });

  it("should export SandboxMode correctly", async () => {
    const { SandboxMode } = await import("../src/modes/sandbox.js");
    expect(SandboxMode).toBeDefined();
    expect(typeof SandboxMode).toBe("function");

    const sandbox = new SandboxMode();
    expect(sandbox).toBeDefined();
    expect(typeof sandbox.writeFile).toBe("function");
    expect(typeof sandbox.exec).toBe("function");
    expect(typeof sandbox.getBashTool).toBe("function");
    expect(typeof sandbox.cleanup).toBe("function");
  });

  it("should export LocalMode correctly", async () => {
    const { LocalMode } = await import("../src/modes/local.js");
    expect(LocalMode).toBeDefined();
    expect(typeof LocalMode).toBe("function");

    const local = new LocalMode();
    expect(local).toBeDefined();
    expect(typeof local.writeFile).toBe("function");
    expect(typeof local.exec).toBe("function");
    expect(typeof local.getBashTool).toBe("function");
    expect(typeof local.cleanup).toBe("function");
  });

  it("should handle Node.js built-in module imports correctly", async () => {
    const { LocalMode } = await import("../src/modes/local.js");
    // LocalMode uses Node.js built-ins with node: prefix
    // Just verify it can be instantiated without errors
    const local = new LocalMode();
    expect(local).toBeDefined();
  });

  it("should be able to resolve current directory using import.meta.url", () => {
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    expect(__filename).toContain("test/esm.test.ts");
    expect(__dirname).toContain("/test");
  });

  it("should export from main index.js", async () => {
    const mainModule = await import("../src/index.js");
    expect(mainModule).toBeDefined();
    expect(mainModule.SandboxMode).toBeDefined();
    expect(mainModule.LocalMode).toBeDefined();
  });
});
