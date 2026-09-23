import {
  ModelProviders,
  ProviderToCredentialsConfigMap,
} from "../generativeConstants";

describe("generativeConstants", () => {
  describe("ProviderToCredentialsMap", () => {
    it("should have credentials defined for every provider", () => {
      const providers = Object.keys(ModelProviders) as ModelProvider[];
      const credentialProviders = Object.keys(
        ProviderToCredentialsConfigMap
      ) as ModelProvider[];

      // Check that every provider has credentials defined
      providers.forEach((provider) => {
        expect(ProviderToCredentialsConfigMap).toHaveProperty(provider);
        expect(ProviderToCredentialsConfigMap[provider]).toBeDefined();
        expect(Array.isArray(ProviderToCredentialsConfigMap[provider])).toBe(
          true
        );
        if (provider !== "OLLAMA") {
          expect(
            ProviderToCredentialsConfigMap[provider].length
          ).toBeGreaterThan(0);
        }
      });

      // Check that every credential entry has required fields
      credentialProviders.forEach((provider) => {
        const credentials = ProviderToCredentialsConfigMap[provider];
        credentials.forEach((credential) => {
          expect(credential).toHaveProperty("envVarName");
          expect(credential).toHaveProperty("isRequired");
          expect(typeof credential.envVarName).toBe("string");
          expect(credential.envVarName.length).toBeGreaterThan(0);
          expect(typeof credential.isRequired).toBe("boolean");
        });
      });

      // Ensure no extra providers in credentials map
      expect(credentialProviders.sort()).toEqual(providers.sort());
    });

    it("should have at least one required credential per provider", () => {
      const providers = Object.keys(ModelProviders) as ModelProvider[];

      providers.forEach((provider) => {
        const credentials = ProviderToCredentialsConfigMap[provider];
        const hasRequiredCredential = credentials.some(
          (credential) => credential.isRequired
        );
        if (provider === "OLLAMA") {
          expect(hasRequiredCredential).toBe(false);
        } else {
          expect(hasRequiredCredential).toBe(true);
        }
      });
    });

    it("should have unique environment variable names per provider", () => {
      const providers = Object.keys(ModelProviders) as ModelProvider[];

      providers.forEach((provider) => {
        const credentials = ProviderToCredentialsConfigMap[provider];
        const envVarNames = credentials.map(
          (credential) => credential.envVarName
        );
        const uniqueEnvVarNames = new Set(envVarNames);
        expect(uniqueEnvVarNames.size).toBe(envVarNames.length);
      });
    });
  });
});
