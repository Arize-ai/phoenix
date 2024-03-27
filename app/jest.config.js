/** @type {import('ts-jest').JestConfigWithTsJest} */

// eslint-disable-next-line no-undef
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": ["esbuild-jest"],
  },
  transformIgnorePatterns: [".*node_modules/.pnpm/(?!d3)@"],
  moduleNameMapper: {
    "^@phoenix/(.*)$": "<rootDir>/src/$1",
  },
};
