import { describe, expect, it } from "vitest";

import {
  transformCasePreservingEnvironmentVariableInput,
  transformEnvironmentVariableInput,
  trimEnvironmentVariableSeparators,
} from "../environmentVariableUtils";

describe("transformEnvironmentVariableInput", () => {
  it("uppercases and converts common separators to underscores", () => {
    expect(transformEnvironmentVariableInput("openai-api key.value")).toBe(
      "OPENAI_API_KEY_VALUE"
    );
  });

  it("removes unsupported characters", () => {
    expect(transformEnvironmentVariableInput("api@key!")).toBe("APIKEY");
  });

  it("preserves a leading digit for validation", () => {
    expect(transformEnvironmentVariableInput("1 api key")).toBe("1_API_KEY");
  });

  it("drops leading underscores but keeps trailing ones while typing", () => {
    expect(transformEnvironmentVariableInput(" _api key ")).toBe("API_KEY_");
  });

  it("folds accents and does not double separators around removed characters", () => {
    expect(transformEnvironmentVariableInput("my api.key-2 é")).toBe(
      "MY_API_KEY_2_E"
    );
    expect(transformEnvironmentVariableInput("a.@-b")).toBe("A_B");
  });
});

describe("transformCasePreservingEnvironmentVariableInput", () => {
  it("keeps letter case and leading underscores", () => {
    expect(transformCasePreservingEnvironmentVariableInput("http_proxy")).toBe(
      "http_proxy"
    );
    expect(
      transformCasePreservingEnvironmentVariableInput("_JAVA_OPTIONS")
    ).toBe("_JAVA_OPTIONS");
  });

  it("converts separators and removes unsupported characters", () => {
    expect(
      transformCasePreservingEnvironmentVariableInput("no proxy.list!")
    ).toBe("no_proxy_list");
  });
});

describe("trimEnvironmentVariableSeparators", () => {
  it("removes leading and trailing underscores", () => {
    expect(trimEnvironmentVariableSeparators("__API_KEY__")).toBe("API_KEY");
  });
});
