import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("scaffold-structure", () => {
  const srcPath = path.join(__dirname, "..", "src");

  it("should have created the src directory", () => {
    expect(fs.existsSync(srcPath)).toBe(true);
    const stats = fs.statSync(srcPath);
    expect(stats.isDirectory()).toBe(true);
  });

  it("should have cli.ts in the src directory", () => {
    const cliPath = path.join(srcPath, "cli.ts");
    expect(fs.existsSync(cliPath)).toBe(true);
    const stats = fs.statSync(cliPath);
    expect(stats.isFile()).toBe(true);
  });

  const subdirectories = ["modes", "snapshot", "commands", "agent", "prompts"];

  subdirectories.forEach((dir) => {
    it(`should have created the ${dir} subdirectory`, () => {
      const dirPath = path.join(srcPath, dir);
      expect(fs.existsSync(dirPath)).toBe(true);
      const stats = fs.statSync(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  it("should have the correct number of items in src directory", () => {
    const items = fs.readdirSync(srcPath);
    // cli.ts + 5 subdirectories = 6 items
    expect(items.length).toBe(6);
    expect(items).toContain("cli.ts");
    subdirectories.forEach((dir) => {
      expect(items).toContain(dir);
    });
  });
});
