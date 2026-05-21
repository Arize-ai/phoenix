import { describe, expect, it } from "vitest";

import {
  getDependencyPackages,
  validateDependencyPackages,
} from "../packageSpecUtils";

describe("getDependencyPackages", () => {
  it("returns an empty list for empty/whitespace input", () => {
    expect(getDependencyPackages("")).toEqual([]);
    expect(getDependencyPackages("\n  \n\t\n")).toEqual([]);
  });

  it("splits on newlines and trims each line", () => {
    expect(getDependencyPackages("requests\n  numpy==1.26.0  \nhttpx")).toEqual(
      ["requests", "numpy==1.26.0", "httpx"]
    );
  });

  it("drops blank lines between packages", () => {
    expect(getDependencyPackages("requests\n\n\nnumpy")).toEqual([
      "requests",
      "numpy",
    ]);
  });
});

describe("validateDependencyPackages", () => {
  describe("empty input", () => {
    it("returns valid for empty text in either ecosystem", () => {
      expect(
        validateDependencyPackages({ packagesText: "", language: "PYTHON" })
      ).toEqual({ valid: true });
      expect(
        validateDependencyPackages({
          packagesText: "\n  \n",
          language: "TYPESCRIPT",
        })
      ).toEqual({ valid: true });
    });
  });

  describe("PYTHON", () => {
    it.each([
      ["bare name", "requests"],
      ["exact version", "numpy==1.26.0"],
      ["compound version clause", "httpx>=0.27,<1"],
      ["extras list", "httpx[http2]"],
      ["extras + version", "httpx[http2,brotli]>=0.27,<1"],
      ["tilde-equal", "openai~=2.0"],
      ["wildcard version", "django==4.*"],
    ])("accepts %s", (_label, spec) => {
      expect(
        validateDependencyPackages({ packagesText: spec, language: "PYTHON" })
      ).toEqual({ valid: true });
    });

    it("accepts multi-line valid input", () => {
      expect(
        validateDependencyPackages({
          packagesText: "requests\nnumpy==1.26.0\nhttpx[http2]>=0.27,<1",
          language: "PYTHON",
        })
      ).toEqual({ valid: true });
    });

    it.each([
      ["whitespace in name", "not a package!"],
      ["npm-style @version", "lodash@^4.17"],
      ["leading dot", ".invalid"],
    ])("rejects %s with a Python-spec error", (_label, spec) => {
      const result = validateDependencyPackages({
        packagesText: spec,
        language: "PYTHON",
      });
      expect(result).toMatchObject({ valid: false });
      if (result.valid) throw new Error("expected invalid result");
      expect(result.message).toMatch(/Invalid Python package spec/);
      expect(result.message).toContain(spec);
    });

    it("reports the first offending line when multiple lines are invalid", () => {
      const result = validateDependencyPackages({
        packagesText: "requests\nbad spec!\nanother bad!",
        language: "PYTHON",
      });
      expect(result).toMatchObject({ valid: false });
      if (result.valid) throw new Error("expected invalid result");
      expect(result.message).toContain("bad spec!");
      expect(result.message).not.toContain("another bad!");
    });
  });

  describe("TYPESCRIPT", () => {
    it.each([
      ["bare name", "lodash"],
      ["caret range", "lodash@^4.17"],
      ["scoped package", "@scope/pkg@1.2.3"],
      ["scoped package without version", "@types/node"],
      ["tilde range", "react@~18.2"],
    ])("accepts %s", (_label, spec) => {
      expect(
        validateDependencyPackages({
          packagesText: spec,
          language: "TYPESCRIPT",
        })
      ).toEqual({ valid: true });
    });

    it("accepts multi-line valid input", () => {
      expect(
        validateDependencyPackages({
          packagesText: "lodash\nlodash@^4.17\n@scope/pkg@1.2.3",
          language: "TYPESCRIPT",
        })
      ).toEqual({ valid: true });
    });

    it.each([
      ["whitespace in name", "has spaces"],
      ["Python-style version", "openai>=6.37.0"],
      ["double @ in spec", "pkg@@1.0"],
    ])("rejects %s with an npm-spec error", (_label, spec) => {
      const result = validateDependencyPackages({
        packagesText: spec,
        language: "TYPESCRIPT",
      });
      expect(result).toMatchObject({ valid: false });
      if (result.valid) throw new Error("expected invalid result");
      expect(result.message).toMatch(/Invalid npm package spec/);
      expect(result.message).toContain(spec);
    });

    it("reports the first offending line when multiple lines are invalid", () => {
      const result = validateDependencyPackages({
        packagesText: "lodash\nbad spec!\nalso bad!",
        language: "TYPESCRIPT",
      });
      expect(result).toMatchObject({ valid: false });
      if (result.valid) throw new Error("expected invalid result");
      expect(result.message).toContain("bad spec!");
      expect(result.message).not.toContain("also bad!");
    });
  });
});
