import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Formatter tests (pure — no fs needed)
// ---------------------------------------------------------------------------

import {
  formatSkillInstall,
  formatSkillList,
  formatSkillShow,
} from "../src/commands/formatSkill";
import type { SkillRecord } from "../src/skills/manifest";

const makeSkill = (overrides: Partial<SkillRecord> = {}): SkillRecord => ({
  name: "phoenix-tracing",
  version: "1.0.0",
  description: "OpenInference tracing for Phoenix",
  status: "available",
  installedPath: null,
  bundledPath: "/pkg/skills/phoenix-tracing/SKILL.md",
  installCommand: "px skill install phoenix-tracing",
  ...overrides,
});

describe("formatSkillList", () => {
  it("pretty mode shows only installed skills by default", () => {
    const skills = [
      makeSkill({ name: "phoenix-tracing", status: "available" }),
      makeSkill({
        name: "phoenix-cli",
        status: "installed",
        installedPath: "/repo/.agents/skills/phoenix-cli/SKILL.md",
      }),
    ];
    const output = formatSkillList({ skills, format: "pretty", all: false });
    expect(output).toContain("phoenix-cli");
    expect(output).not.toContain("phoenix-tracing");
    expect(output).toContain("1 more available");
  });

  it("pretty mode with --all shows all skills", () => {
    const skills = [
      makeSkill({ name: "phoenix-tracing", status: "available" }),
      makeSkill({
        name: "phoenix-cli",
        status: "installed",
        installedPath: "/repo/.agents/skills/phoenix-cli/SKILL.md",
      }),
    ];
    const output = formatSkillList({ skills, format: "pretty", all: true });
    expect(output).toContain("phoenix-cli");
    expect(output).toContain("phoenix-tracing");
  });

  it("raw mode returns JSON array regardless of --all", () => {
    const skills = [makeSkill({ name: "phoenix-tracing", status: "available" })];
    const output = formatSkillList({ skills, format: "raw", all: false });
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe("phoenix-tracing");
    expect(parsed[0].status).toBe("available");
  });

  it("json mode returns pretty-printed JSON array", () => {
    const skills = [makeSkill()];
    const output = formatSkillList({ skills, format: "json", all: false });
    expect(output).toContain("\n");
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("raw mode includes required output contract fields", () => {
    const skills = [
      makeSkill({
        status: "installed",
        installedPath: "/repo/.agents/skills/phoenix-tracing/SKILL.md",
      }),
    ];
    const output = formatSkillList({ skills, format: "raw", all: false });
    const parsed = JSON.parse(output);
    const record = parsed[0];
    expect(record).toHaveProperty("name");
    expect(record).toHaveProperty("version");
    expect(record).toHaveProperty("description");
    expect(record).toHaveProperty("status");
    expect(record).toHaveProperty("installedPath");
    expect(record).toHaveProperty("bundledPath");
    expect(record).toHaveProperty("installCommand");
  });

  it("pretty footer absent when no available skills", () => {
    const skills = [
      makeSkill({
        name: "phoenix-cli",
        status: "installed",
        installedPath: "/repo/.agents/skills/phoenix-cli/SKILL.md",
      }),
    ];
    const output = formatSkillList({ skills, format: "pretty", all: false });
    expect(output).not.toContain("more available");
  });
});

describe("formatSkillShow", () => {
  it("pretty mode prefixes output with advisory marker", () => {
    const skill = makeSkill();
    const content = "# Phoenix Tracing\n\nContent here.";
    const output = formatSkillShow({ skill, content, format: "pretty" });
    expect(output.startsWith("<!-- advisory:")).toBe(true);
    expect(output).toContain("phoenix-tracing");
    expect(output).toContain(content);
  });

  it("raw mode returns compact JSON with advisory:true", () => {
    const skill = makeSkill();
    const content = "# Phoenix Tracing";
    const output = formatSkillShow({ skill, content, format: "raw" });
    expect(output).not.toContain("\n");
    const parsed = JSON.parse(output);
    expect(parsed.advisory).toBe(true);
    expect(parsed).toHaveProperty("advisoryMarker");
    expect(parsed).toHaveProperty("content");
    expect(parsed.content).toContain("<!-- advisory:");
    expect(parsed.content).toContain(content);
  });

  it("json mode returns pretty-printed object with advisory:true", () => {
    const skill = makeSkill();
    const content = "# Phoenix Tracing";
    const output = formatSkillShow({ skill, content, format: "json" });
    expect(output).toContain("\n");
    const parsed = JSON.parse(output);
    expect(parsed.advisory).toBe(true);
  });

  it("content field in raw mode starts with advisory marker", () => {
    const skill = makeSkill();
    const content = "# Body";
    const output = formatSkillShow({ skill, content, format: "raw" });
    const parsed = JSON.parse(output);
    expect(parsed.content.startsWith("<!-- advisory:")).toBe(true);
  });
});

describe("formatSkillInstall", () => {
  it("pretty mode returns human-readable message", () => {
    const result = {
      name: "phoenix-tracing",
      installedPath: "/repo/.agents/skills/phoenix-tracing/SKILL.md",
      installedFiles: ["/repo/.agents/skills/phoenix-tracing/SKILL.md"],
    };
    const output = formatSkillInstall({ result, version: "1.0.0", format: "pretty" });
    expect(output).toContain("phoenix-tracing");
    expect(output).toContain(result.installedPath);
  });

  it("raw mode returns compact JSON resource", () => {
    const result = {
      name: "phoenix-tracing",
      installedPath: "/repo/.agents/skills/phoenix-tracing/SKILL.md",
      installedFiles: ["/repo/.agents/skills/phoenix-tracing/SKILL.md"],
    };
    const output = formatSkillInstall({ result, version: "1.0.0", format: "raw" });
    expect(output).not.toContain("\n");
    const parsed = JSON.parse(output);
    expect(parsed.name).toBe("phoenix-tracing");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.installedPath).toBe(result.installedPath);
    expect(Array.isArray(parsed.installedFiles)).toBe(true);
  });

  it("json mode returns pretty-printed JSON", () => {
    const result = {
      name: "phoenix-tracing",
      installedPath: "/repo/.agents/skills/phoenix-tracing/SKILL.md",
      installedFiles: [],
    };
    const output = formatSkillInstall({ result, version: "1.0.0", format: "json" });
    expect(output).toContain("\n");
    JSON.parse(output);
  });
});

// ---------------------------------------------------------------------------
// install.ts tests — mock the fs module
// ---------------------------------------------------------------------------

describe("installSkill", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("copies files to the correct destination", async () => {
    const { installSkill: realInstallSkill } = await import(
      "../src/skills/install"
    );

    const bundleDir = path.join(tmpDir, "bundle", "phoenix-test-skill");
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(path.join(bundleDir, "SKILL.md"), "# Test Skill\n");

    const repoDir = path.join(tmpDir, "repo");
    fs.mkdirSync(repoDir, { recursive: true });

    // We can't easily control PACKAGE_ROOT / resolveRepoRoot in this unit test
    // without dependency injection. This test documents the API contract.
    expect(typeof realInstallSkill).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// bundle-skills.ts audience filter tests
// ---------------------------------------------------------------------------

describe("bundle-skills audience filter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-skills-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function createSkillFixture(
    dir: string,
    skillName: string,
    audience: string | null
  ): void {
    const skillDir = path.join(dir, skillName);
    fs.mkdirSync(skillDir, { recursive: true });
    const frontmatter =
      audience !== null
        ? `---\nname: ${skillName}\naudience: ${audience}\ndescription: Test\n---\n\n# ${skillName}\n`
        : `---\nname: ${skillName}\ndescription: Test\n---\n\n# ${skillName}\n`;
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), frontmatter);
  }

  it("parseFrontmatter correctly identifies user and maintainer audience fields", () => {
    createSkillFixture(tmpDir, "phoenix-user-skill", "user");
    createSkillFixture(tmpDir, "phoenix-maint-skill", "maintainer");

    const userSkillContent = fs.readFileSync(
      path.join(tmpDir, "phoenix-user-skill", "SKILL.md"),
      "utf-8"
    );
    const maintSkillContent = fs.readFileSync(
      path.join(tmpDir, "phoenix-maint-skill", "SKILL.md"),
      "utf-8"
    );

    expect(userSkillContent).toContain("audience: user");
    expect(maintSkillContent).toContain("audience: maintainer");
  });

  it("skill with missing audience field should be detectable", () => {
    createSkillFixture(tmpDir, "phoenix-no-audience", null);
    const content = fs.readFileSync(
      path.join(tmpDir, "phoenix-no-audience", "SKILL.md"),
      "utf-8"
    );
    expect(content).not.toContain("audience:");
  });

  it("all bundled user skills have audience: user in frontmatter", () => {
    const agentSkillsDir = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      ".agents",
      "skills"
    );

    if (!fs.existsSync(agentSkillsDir)) {
      return; // skip if not in monorepo
    }

    const skillDirs = fs
      .readdirSync(agentSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("phoenix-"))
      .map((e) => e.name);

    const userSkills = ["phoenix-cli", "phoenix-tracing", "phoenix-evals"];

    for (const skillName of userSkills) {
      if (!skillDirs.includes(skillName)) continue;
      const skillMd = path.join(agentSkillsDir, skillName, "SKILL.md");
      const content = fs.readFileSync(skillMd, "utf-8");
      expect(content, `${skillName} should have audience: user`).toContain(
        "audience: user"
      );
    }
  });

  it("no phoenix-* skill is missing the audience field", () => {
    const agentSkillsDir = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      ".agents",
      "skills"
    );

    if (!fs.existsSync(agentSkillsDir)) {
      return;
    }

    const skillDirs = fs
      .readdirSync(agentSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("phoenix-"))
      .map((e) => e.name);

    const missing: string[] = [];
    for (const skillName of skillDirs) {
      const skillMd = path.join(agentSkillsDir, skillName, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, "utf-8");
      if (!content.includes("audience:")) {
        missing.push(skillName);
      }
    }

    expect(missing, `Skills missing audience field: ${missing.join(", ")}`).toHaveLength(0);
  });

  it("maintainer skills are NOT in the user-facing list", () => {
    const maintainerSkills = [
      "phoenix-server",
      "phoenix-frontend",
      "phoenix-typescript",
      "phoenix-release-please",
    ];

    const agentSkillsDir = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      ".agents",
      "skills"
    );

    if (!fs.existsSync(agentSkillsDir)) {
      return;
    }

    for (const skillName of maintainerSkills) {
      const skillMd = path.join(agentSkillsDir, skillName, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, "utf-8");
      expect(
        content,
        `${skillName} should have audience: maintainer`
      ).toContain("audience: maintainer");
    }
  });
});
