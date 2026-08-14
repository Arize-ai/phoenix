/**
 * Regression test for circular-import detection (see issue #15078).
 *
 * The app relies on oxlint's `import/no-cycle` rule (enabled in
 * `.oxlintrc.json`) instead of a per-directory import denylist or a
 * build-time vite plugin. This test verifies, against throwaway fixture
 * projects, that the rule:
 *
 *  1. rejects a cycle closed through a tsconfig path alias and a barrel
 *     re-export (the original `components -> ai -> components` shape),
 *  2. reports the participating modules in the diagnostic, and
 *  3. does not flag acyclic deep imports through the same alias.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const OXLINT_BIN = resolve(__dirname, "../node_modules/.bin/oxlint");

const OXLINT_CONFIG = JSON.stringify({
  plugins: ["import"],
  rules: { "import/no-cycle": "error" },
});

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    paths: { "@fixture/*": ["./src/*"] },
  },
});

type LintResult = { status: number; output: string };

function runOxlint(cwd: string): LintResult {
  try {
    // --format=default renders the "These paths form a cycle" note that the
    // compact non-TTY format omits.
    const output = execFileSync(OXLINT_BIN, ["--format=default", "src"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output };
  } catch (error) {
    const failure = error as {
      status: number | null;
      stdout?: string;
      stderr?: string;
    };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

function makeFixtureProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "phoenix-no-cycle-"));
  writeFileSync(join(root, ".oxlintrc.json"), OXLINT_CONFIG);
  writeFileSync(join(root, "tsconfig.json"), TSCONFIG);
  mkdirSync(join(root, "src/components/ai"), { recursive: true });
  for (const [path, contents] of Object.entries(files)) {
    writeFileSync(join(root, path), contents);
  }
  return root;
}

describe("import/no-cycle lint coverage", () => {
  let fixtureRoot: string | undefined;

  afterEach(() => {
    if (fixtureRoot) {
      rmSync(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it("rejects a cycle closed through the path alias and a barrel re-export", () => {
    fixtureRoot = makeFixtureProject({
      // components barrel re-exports the ai barrel...
      "src/components/index.ts": `export * from "./ai";\nexport const shared = "shared";\n`,
      "src/components/ai/index.ts": `export * from "./Widget";\n`,
      // ...and a module inside ai imports back through the components barrel,
      // via the alias, closing the cycle.
      "src/components/ai/Widget.ts": `import { shared } from "@fixture/components";\nexport const widget = shared;\n`,
    });

    const { status, output } = runOxlint(fixtureRoot);

    expect(status).not.toBe(0);
    expect(output).toContain("no-cycle");
    // The diagnostic must identify the modules forming the cycle.
    expect(output).toContain("These paths form a cycle");
    expect(output).toContain("@fixture/components");
  });

  it("accepts acyclic deep imports through the same alias", () => {
    fixtureRoot = makeFixtureProject({
      "src/components/index.ts": `export * from "./ai";\nexport const shared = "shared";\n`,
      "src/components/ai/index.ts": `export * from "./Widget";\n`,
      "src/components/Standalone.ts": `export const standalone = "standalone";\n`,
      // Deep import of a module that does not point back at the barrel.
      "src/components/ai/Widget.ts": `import { standalone } from "@fixture/components/Standalone";\nexport const widget = standalone;\n`,
    });

    const { status, output } = runOxlint(fixtureRoot);

    expect(output).not.toContain("no-cycle");
    expect(status).toBe(0);
  });
});
