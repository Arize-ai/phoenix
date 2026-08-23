import type { componentsV1 } from "@arizeai/phoenix-testing";
import { describe, expect, it } from "vitest";

import {
  assertPromptIdentifier,
  buildInvocationParameters,
  buildPromptSetRequest,
  hasPromptVersionInput,
  parsePromptMessages,
  parsePromptSetFile,
  parsePromptSetFlags,
} from "../src/commands/promptSet";
import { InvalidArgumentError } from "../src/exitCodes";

const EXISTING: componentsV1["schemas"]["PromptVersion"] = {
  id: "pv-001",
  description: "first version",
  model_provider: "OPENAI",
  model_name: "gpt-4o",
  template: { type: "string", template: "Hello {{name}}" },
  template_type: "STR",
  template_format: "MUSTACHE",
  invocation_parameters: { type: "openai", openai: { temperature: 0.5 } },
};

describe("hasPromptVersionInput", () => {
  it("is false when only description or tag would change", () => {
    expect(hasPromptVersionInput({ tag: "production" })).toBe(false);
    expect(hasPromptVersionInput({ message: [] })).toBe(false);
  });

  it("is true for a template, messages, file, or version field", () => {
    expect(hasPromptVersionInput({ template: "Hi" })).toBe(true);
    expect(hasPromptVersionInput({ message: ["user:Hi"] })).toBe(true);
    expect(hasPromptVersionInput({ file: "p.json" })).toBe(true);
    expect(hasPromptVersionInput({ model: "gpt-4o" })).toBe(true);
  });
});

describe("assertPromptIdentifier", () => {
  it("accepts lowercase identifier names", () => {
    expect(assertPromptIdentifier("greeting", "Prompt name")).toBe("greeting");
    expect(assertPromptIdentifier("my-prompt_1", "Prompt name")).toBe(
      "my-prompt_1"
    );
  });

  it("rejects uppercase names and IDs", () => {
    expect(() => assertPromptIdentifier("Greeting", "Prompt name")).toThrow(
      InvalidArgumentError
    );
    expect(() => assertPromptIdentifier("UHJvbXB0OjE=", "Prompt name")).toThrow(
      InvalidArgumentError
    );
  });
});

describe("parsePromptMessages", () => {
  it("splits on the first colon and lowercases the role", () => {
    expect(
      parsePromptMessages(["SYSTEM:Be nice", "user:Hello: world"])
    ).toEqual([
      { role: "system", content: "Be nice" },
      { role: "user", content: "Hello: world" },
    ]);
  });

  it("rejects a missing colon or unknown role", () => {
    expect(() => parsePromptMessages(["hello"])).toThrow(InvalidArgumentError);
    expect(() => parsePromptMessages(["narrator:hi"])).toThrow(
      InvalidArgumentError
    );
  });
});

describe("parsePromptSetFlags", () => {
  it("rejects --template together with --message", () => {
    expect(() =>
      parsePromptSetFlags({
        template: "Hi",
        message: ["user:Hi"],
      })
    ).toThrow(InvalidArgumentError);
  });

  it("parses invocation-parameters and metadata JSON objects", () => {
    const flags = parsePromptSetFlags({
      invocationParameters: '{"temperature":0.2}',
      metadata: '{"team":"evals"}',
    });
    expect(flags.invocationParameters).toEqual({ temperature: 0.2 });
    expect(flags.metadata).toEqual({ team: "evals" });
  });

  it("rejects invalid JSON flags", () => {
    expect(() =>
      parsePromptSetFlags({ invocationParameters: "not-json" })
    ).toThrow(InvalidArgumentError);
    expect(() => parsePromptSetFlags({ metadata: "[1]" })).toThrow(
      InvalidArgumentError
    );
  });
});

describe("parsePromptSetFile", () => {
  it("accepts a PromptVersion from px prompt get --format raw", () => {
    const file = parsePromptSetFile(JSON.stringify(EXISTING));
    expect(file.version?.model_name).toBe("gpt-4o");
    expect(file.version?.template).toEqual({
      type: "string",
      template: "Hello {{name}}",
    });
  });

  it("accepts a {prompt, version} POST body", () => {
    const file = parsePromptSetFile(
      JSON.stringify({
        prompt: { name: "greeting", description: "says hello" },
        version: {
          model_provider: "OPENAI",
          model_name: "gpt-4o",
          template: {
            type: "chat",
            messages: [{ role: "user", content: "Hi" }],
          },
          template_type: "CHAT",
          template_format: "MUSTACHE",
          invocation_parameters: { type: "openai", openai: {} },
        },
      })
    );
    expect(file.promptDescription).toBe("says hello");
    expect(file.version?.template).toEqual({
      type: "chat",
      messages: [{ role: "user", content: "Hi" }],
    });
  });

  it("accepts {messages: [...]} and a JSON string template", () => {
    expect(
      parsePromptSetFile(
        JSON.stringify({ messages: [{ role: "user", content: "Hi" }] })
      ).messages
    ).toEqual([{ role: "user", content: "Hi" }]);
    expect(parsePromptSetFile(JSON.stringify("Hello"))).toEqual({
      templateText: "Hello",
    });
  });

  it("rejects empty or non-object JSON", () => {
    expect(() => parsePromptSetFile("")).toThrow(InvalidArgumentError);
    expect(() => parsePromptSetFile("[]")).toThrow(InvalidArgumentError);
    expect(() => parsePromptSetFile("not json")).toThrow(InvalidArgumentError);
  });
});

describe("buildInvocationParameters", () => {
  it("wraps a bare object in the provider discriminator", () => {
    expect(buildInvocationParameters("OPENAI", { temperature: 0.2 })).toEqual({
      type: "openai",
      openai: { temperature: 0.2 },
    });
  });

  it("unwraps an already-wrapped object", () => {
    expect(
      buildInvocationParameters("OPENAI", {
        type: "openai",
        openai: { temperature: 0.1 },
      })
    ).toEqual({ type: "openai", openai: { temperature: 0.1 } });
  });

  it("requires max_tokens for Anthropic", () => {
    expect(() => buildInvocationParameters("ANTHROPIC", {})).toThrow(
      InvalidArgumentError
    );
    expect(
      buildInvocationParameters("ANTHROPIC", { max_tokens: 1024 })
    ).toEqual({
      type: "anthropic",
      anthropic: { max_tokens: 1024 },
    });
  });
});

describe("buildPromptSetRequest", () => {
  it("creates a chat version from --template and --model", () => {
    const { prompt, version } = buildPromptSetRequest({
      name: "greeting",
      flags: { template: "Hello {{name}}", model: "gpt-4o" },
    });
    expect(prompt).toEqual({ name: "greeting" });
    expect(version.model_provider).toBe("OPENAI");
    expect(version.model_name).toBe("gpt-4o");
    expect(version.template_type).toBe("CHAT");
    expect(version.template).toEqual({
      type: "chat",
      messages: [{ role: "user", content: "Hello {{name}}" }],
    });
    expect(version.invocation_parameters).toEqual({
      type: "openai",
      openai: {},
    });
  });

  it("inherits model and converts a string template when updating", () => {
    const { version } = buildPromptSetRequest({
      name: "greeting",
      flags: { template: "Hi {{name}}" },
      existing: EXISTING,
    });
    expect(version.model_name).toBe("gpt-4o");
    expect(version.model_provider).toBe("OPENAI");
    expect(version.template).toEqual({
      type: "chat",
      messages: [{ role: "user", content: "Hi {{name}}" }],
    });
    expect(version.invocation_parameters).toEqual({
      type: "openai",
      openai: { temperature: 0.5 },
    });
  });

  it("rebuilds invocation parameters when the provider changes", () => {
    const { version } = buildPromptSetRequest({
      name: "greeting",
      flags: {
        modelProvider: "GOOGLE",
        model: "gemini-2.0-flash",
      },
      existing: EXISTING,
    });
    expect(version.model_provider).toBe("GOOGLE");
    expect(version.invocation_parameters).toEqual({
      type: "google",
      google: {},
    });
    expect(version.template).toEqual({
      type: "chat",
      messages: [{ role: "user", content: "Hello {{name}}" }],
    });
  });

  it("overlays --file onto flags", () => {
    const { prompt, version } = buildPromptSetRequest({
      name: "greeting",
      flags: { model: "gpt-4.1", description: "from flags" },
      file: parsePromptSetFile(JSON.stringify(EXISTING)),
    });
    expect(prompt.description).toBe("from flags");
    expect(version.model_name).toBe("gpt-4.1");
    expect(version.template).toEqual({
      type: "chat",
      messages: [{ role: "user", content: "Hello {{name}}" }],
    });
  });

  it("requires --model when creating without a file", () => {
    expect(() =>
      buildPromptSetRequest({
        name: "greeting",
        flags: { template: "Hello" },
      })
    ).toThrow(InvalidArgumentError);
  });
});
