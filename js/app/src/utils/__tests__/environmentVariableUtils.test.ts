import { describe, expect, it } from "vitest";

import { transformEnvironmentVariableInput } from "../environmentVariableUtils";

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
});
