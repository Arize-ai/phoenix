import { describe, expect, it } from "vitest";

import {
  clearEnvFileCache,
  findEnvFile,
  readEnvFileValue,
  readEnvFileValueWithPath,
} from "./envFile.browser";

describe("browser environment-file implementation", () => {
  it("exposes browser-safe no-op discovery APIs", () => {
    expect(findEnvFile()).toBeUndefined();
    expect(readEnvFileValue("PHOENIX_HOST")).toBeUndefined();
    expect(readEnvFileValueWithPath("PHOENIX_HOST")).toBeUndefined();
    expect(clearEnvFileCache()).toBeUndefined();
  });
});
