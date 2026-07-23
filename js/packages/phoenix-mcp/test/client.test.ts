import { afterEach, describe, expect, it, vi } from "vitest";

type CreateClientArg = { options: { headers: Record<string, string> } };

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn((_arg: CreateClientArg) => ({}) as unknown),
}));

vi.mock("@arizeai/phoenix-client", () => ({
  createClient: createClientMock,
}));

import { createPhoenixClient } from "../src/client";
import { USER_AGENT } from "../src/constants";

const headersFromLastCall = (): Record<string, string> =>
  createClientMock.mock.calls.at(-1)![0].options.headers;

describe("createPhoenixClient", () => {
  afterEach(() => {
    createClientMock.mockClear();
  });

  it("sets an explicit User-Agent so requests are not sent as undici (#13742)", () => {
    createPhoenixClient({
      config: { baseUrl: "https://app.phoenix.arize.com" },
    });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(headersFromLastCall()["User-Agent"]).toBe(USER_AGENT);
  });

  it("lets caller-supplied headers override the default User-Agent", () => {
    createPhoenixClient({
      config: {
        baseUrl: "https://app.phoenix.arize.com",
        headers: { "User-Agent": "custom-agent/1.0" },
      },
    });

    expect(headersFromLastCall()["User-Agent"]).toBe("custom-agent/1.0");
  });

  it("preserves auth headers alongside the User-Agent", () => {
    createPhoenixClient({
      config: { baseUrl: "https://app.phoenix.arize.com", apiKey: "secret" },
    });

    const headers = headersFromLastCall();
    expect(headers["User-Agent"]).toBe(USER_AGENT);
    expect(headers.Authorization).toBe("Bearer secret");
    expect(headers.api_key).toBe("secret");
  });
});
