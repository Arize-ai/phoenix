import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getTestClient } from "./setup";

describe("Models Endpoint", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  it("should list available models", async () => {
    const client = getTestClient();

    const models = await client.models.list();

    expect(models.object).toBe("list");
    expect(models.data.length).toBeGreaterThan(0);

    const modelIds = models.data.map((m) => m.id);
    expect(modelIds).toContain("gpt-4o");
    expect(modelIds).toContain("gpt-4o-mini");
    expect(modelIds).toContain("gpt-3.5-turbo");
  });

  it("should return proper model objects", async () => {
    const client = getTestClient();

    const models = await client.models.list();

    for (const model of models.data) {
      expect(model.id).toBeTruthy();
      expect(model.object).toBe("model");
      expect(model.created).toBeGreaterThan(0);
      expect(model.owned_by).toBeTruthy();
    }
  });
});
