import {
  AGENT_CAPABILITY_DEFINITIONS,
  createDefaultAgentCapabilities,
  getAgentCapabilitiesForControlSurface,
} from "@phoenix/agent/extensions/capabilities";

describe("agent capabilities", () => {
  it("creates a fresh copy of the default capabilities", () => {
    const firstDefaults = createDefaultAgentCapabilities();
    const secondDefaults = createDefaultAgentCapabilities();

    expect(firstDefaults).toEqual(secondDefaults);
    expect(firstDefaults).not.toBe(secondDefaults);
  });

  it("filters capabilities by control surface", () => {
    const debugMenuCapabilities = getAgentCapabilitiesForControlSurface(
      "experimental-settings"
    );
    const agentSettingsCapabilities =
      getAgentCapabilitiesForControlSurface("agent-settings");

    expect(debugMenuCapabilities).toEqual(
      AGENT_CAPABILITY_DEFINITIONS.filter(
        (definition) => definition.controlSurface === "experimental-settings"
      )
    );
    expect(
      agentSettingsCapabilities.map((definition) => definition.key)
    ).toEqual(["web.access"]);
  });
});
