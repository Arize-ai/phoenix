import { describe, expect, it } from "vitest";

import { buildDefaultDeps } from "../../src/setup/deps/buildDefaultDeps";

const ENDPOINT = "https://phoenix.example.com";

describe("buildDefaultDeps createClient", () => {
  it("points the client at the endpoint the user chose", () => {
    const client = buildDefaultDeps().createClient({ endpoint: ENDPOINT });
    expect(client.config.baseUrl).toBe(ENDPOINT);
  });

  it("sends the api key as a bearer token", () => {
    const client = buildDefaultDeps().createClient({
      endpoint: ENDPOINT,
      apiKey: "sk-live",
    });
    expect(client.config.headers).toMatchObject({
      Authorization: "Bearer sk-live",
    });
  });

  it("routes calls to --api-url, leaving the chosen endpoint alone", () => {
    const deps = buildDefaultDeps({ apiUrl: "http://localhost:9999" });
    const client = deps.createClient({ endpoint: ENDPOINT });
    expect(client.config.baseUrl).toBe("http://localhost:9999");
  });
});
