// eslint-disable-next-line no-undef
module.exports = {
  src: "./src",
  language: "typescript",
  schema: "./schema.graphql",
  exclude: ["**/node_modules/**", "**/__mocks__/**", "**/__generated__/**"],
  noFutureProofEnums: true,
  eagerEsModules: true,
  customScalarTypes: {
    DateTime: "string",
    UUID: "string",
    Identifier: "string",
    CronExpression: "string",
  },
  typescriptExcludeUndefinedFromNullableUnion: true,
};
