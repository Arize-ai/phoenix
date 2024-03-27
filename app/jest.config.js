/** @type {import('ts-jest').JestConfigWithTsJest} */

// eslint-disable-next-line no-undef
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": ["esbuild-jest"],
  },
  transformIgnorePatterns: [
    "node_modules/(?!d3-time-format)/",
    ".*node_modules/.pnpm/(?!d3-time-format)@",
  ],
  moduleNameMapper: {
    "^@phoenix/(.*)$": "<rootDir>/src/$1",
  },
};
