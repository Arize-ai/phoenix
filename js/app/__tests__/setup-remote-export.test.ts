import { describe, expect, it } from "vitest";

import {
  DEFAULT_COLLECTOR_ENDPOINT,
  DEFAULT_PROJECT_NAME,
  getEnvValue,
  normalizeCollectorEndpoint,
  quoteShellValue,
  updateEnvVariables,
} from "../scripts/setup-remote-export";

describe("setup-remote-export", () => {
  it("provides Phoenix development defaults", () => {
    expect(DEFAULT_COLLECTOR_ENDPOINT).toBe(
      "https://app.phoenix.arize.com/s/phoenix-devs"
    );
    expect(DEFAULT_PROJECT_NAME).toBe("pxi_dev");
  });

  it("updates assignments while preserving unrelated content", () => {
    const contents = [
      "# Local Phoenix settings",
      "export OTHER=value",
      "export PHOENIX_AGENTS_COLLECTOR_ENDPOINT=old",
      "PHOENIX_AGENTS_COLLECTOR_ENDPOINT=duplicate",
      "",
    ].join("\n");

    expect(
      updateEnvVariables({
        contents,
        values: new Map([
          [
            "PHOENIX_AGENTS_COLLECTOR_ENDPOINT",
            "https://example.com/collector",
          ],
          ["PHOENIX_AGENTS_COLLECTOR_API_KEY", "secret"],
          ["PHOENIX_AGENTS_FORCE_TRACING", "true"],
        ]),
      })
    ).toBe(
      [
        "# Local Phoenix settings",
        "export OTHER=value",
        "export PHOENIX_AGENTS_COLLECTOR_ENDPOINT='https://example.com/collector'",
        "export PHOENIX_AGENTS_COLLECTOR_API_KEY='secret'",
        "export PHOENIX_AGENTS_FORCE_TRACING='true'",
        "",
      ].join("\n")
    );
  });

  it("creates a newline-terminated env file", () => {
    expect(
      updateEnvVariables({
        contents: "",
        values: new Map([["PHOENIX_AGENTS_COLLECTOR_API_KEY", ""]]),
      })
    ).toBe("export PHOENIX_AGENTS_COLLECTOR_API_KEY=''\n");
  });

  it("quotes and reads shell-safe values", () => {
    const value = "project name's $value";
    const contents = `export PROJECT=${quoteShellValue(value)}\n`;

    expect(getEnvValue({ contents, name: "PROJECT" })).toBe(value);
  });

  it("uses the last active assignment", () => {
    const contents = [
      "export PROJECT='first'",
      "# export PROJECT='ignored'",
      'PROJECT="second"',
    ].join("\n");

    expect(getEnvValue({ contents, name: "PROJECT" })).toBe("second");
  });

  it("normalizes HTTP collector endpoints", () => {
    expect(
      normalizeCollectorEndpoint("https://example.com/team/v1/traces/")
    ).toBe("https://example.com/team");
    expect(() => normalizeCollectorEndpoint("grpc://example.com")).toThrow(
      "must use http:// or https://"
    );
  });
});
