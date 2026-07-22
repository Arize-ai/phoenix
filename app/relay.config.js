// eslint-disable-next-line no-undef
module.exports = {
  src: "./src",
  language: "typescript",
  schema: "./schema.graphql",
  excludes: ["**/node_modules/**", "**/__mocks__/**", "**/__generated__/**"],
  noFutureProofEnums: true,
  eagerEsModules: true,
  customScalarTypes: {
    DateTime: "string",
    UUID: "string",
    Identifier: "string",
    CronExpression: "string",
    SecretString: "string",
    RedactedString: "string",
  },
  typescriptExcludeUndefinedFromNullableUnion: true,
  featureFlags: {
    // Relay v21 enables @alias enforcement on ambiguous fragment spreads by
    // default; keep the v20 behavior until spreads are migrated to @alias.
    enforce_fragment_alias_where_ambiguous: { kind: "disabled" },
  },
};
