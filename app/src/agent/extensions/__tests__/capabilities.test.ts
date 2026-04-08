import {
  AGENT_CAPABILITY_DEFINITIONS,
  buildAgentCapabilitySystemPrompt,
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
    const debugMenuCapabilities =
      getAgentCapabilitiesForControlSurface("debug-menu");

    expect(debugMenuCapabilities).toEqual(
      AGENT_CAPABILITY_DEFINITIONS.filter(
        (definition) => definition.controlSurface === "debug-menu"
      )
    );
  });

  it("serializes capability prompt state from the shared definitions", () => {
    const baseCapabilities = createDefaultAgentCapabilities();
    const promptWithDefaults = buildAgentCapabilitySystemPrompt({
      capabilities: baseCapabilities,
    });

    for (const definition of AGENT_CAPABILITY_DEFINITIONS) {
      if (!definition.systemPromptState) {
        continue;
      }

      expect(promptWithDefaults).toContain(
        definition.systemPromptState.disabled
      );
    }

    const firstPromptedCapability = AGENT_CAPABILITY_DEFINITIONS.find(
      (definition) => definition.systemPromptState
    );

    expect(firstPromptedCapability).toBeDefined();

    const promptWithEnabledCapability = buildAgentCapabilitySystemPrompt({
      capabilities: {
        ...baseCapabilities,
        [firstPromptedCapability!.key]: true,
      },
    });

    expect(promptWithEnabledCapability).toContain(
      firstPromptedCapability!.systemPromptState!.enabled
    );
    expect(promptWithEnabledCapability).not.toContain(
      firstPromptedCapability!.systemPromptState!.disabled
    );
  });
});
