import { describe, expect, it } from "vitest";

import { getDependencyPackages, getDependencyPreview } from "../utils";

describe("getDependencyPackages", () => {
  it("trims whitespace and drops empty lines", () => {
    expect(getDependencyPackages("  numpy  \n\n pandas\n")).toEqual([
      "numpy",
      "pandas",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(getDependencyPackages("")).toEqual([]);
    expect(getDependencyPackages("   \n  ")).toEqual([]);
  });
});

describe("getDependencyPreview", () => {
  it("returns null when no language is advertised", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        dependenciesLanguage: null,
        backendType: "E2B",
      })
    ).toBeNull();
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        dependenciesLanguage: undefined,
        backendType: "E2B",
      })
    ).toBeNull();
  });

  it("returns null when packages list is empty", () => {
    expect(
      getDependencyPreview({
        packagesText: "",
        dependenciesLanguage: "PYTHON",
        backendType: "E2B",
      })
    ).toBeNull();
    expect(
      getDependencyPreview({
        packagesText: "   \n  ",
        dependenciesLanguage: "PYTHON",
        backendType: "E2B",
      })
    ).toBeNull();
  });

  it("renders pip install for Python on E2B", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy\npandas==2.0",
        dependenciesLanguage: "PYTHON",
        backendType: "E2B",
      })
    ).toBe("pip install numpy pandas==2.0");
  });

  it("renders pip install for Python on Daytona", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        dependenciesLanguage: "PYTHON",
        backendType: "DAYTONA_PYTHON",
      })
    ).toBe("pip install numpy");
  });

  it("renders image.pip_install for Python on Modal", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy\npandas==2.0",
        dependenciesLanguage: "PYTHON",
        backendType: "MODAL",
      })
    ).toBe('image.pip_install("numpy", "pandas==2.0")');
  });

  it("renders unavailable for TypeScript", () => {
    expect(
      getDependencyPreview({
        packagesText: "lodash",
        dependenciesLanguage: "TYPESCRIPT",
        backendType: "DENO",
      })
    ).toBe("preview unavailable for typescript");
  });
});
