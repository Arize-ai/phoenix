import { describe, expect, it, vi } from "vitest";

import { promptsLoader } from "../promptsLoader";

vi.mock("@phoenix/RelayEnvironment", async () => {
  const { createMockEnvironment } = await import("relay-test-utils");
  return {
    default: createMockEnvironment(),
  };
});

describe("promptsLoader", () => {
  it("loads prompts with store-and-network so deleted evaluator prompts are revalidated on return", () => {
    const queryRef = promptsLoader();
    expect(queryRef.fetchPolicy).toBe("store-and-network");
    queryRef.dispose();
  });
});
