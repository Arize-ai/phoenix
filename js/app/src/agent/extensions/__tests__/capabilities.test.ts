import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";

describe("agent capabilities", () => {
  it("creates a fresh copy of the default capabilities", () => {
    const firstDefaults = createDefaultAgentCapabilities();
    const secondDefaults = createDefaultAgentCapabilities();

    expect(firstDefaults).toEqual(secondDefaults);
    expect(firstDefaults).not.toBe(secondDefaults);
  });
});
