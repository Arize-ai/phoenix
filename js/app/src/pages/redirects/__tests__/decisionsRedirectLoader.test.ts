import { RouterContextProvider } from "react-router";

import { decisionsRedirectLoader } from "../decisionsRedirectLoader";

function redirectFrom(path: string, rest: string) {
  const url = new URL(`http://localhost${path}`);
  const response = decisionsRedirectLoader({
    request: new Request(url),
    url,
    pattern: "/decisions/*",
    params: { "*": rest },
    context: new RouterContextProvider(),
  });
  return response.headers.get("Location");
}

describe("decisionsRedirectLoader", () => {
  it("sends the decisions list to the prompts list", () => {
    expect(redirectFrom("/decisions", "")).toBe("/prompts");
  });

  it("keeps the decision id and the rest of the path", () => {
    expect(redirectFrom("/decisions/D1", "D1")).toBe("/prompts/D1");
    expect(redirectFrom("/decisions/D1/config", "D1/config")).toBe(
      "/prompts/D1/config"
    );
    expect(redirectFrom("/decisions/D1/versions/V1", "D1/versions/V1")).toBe(
      "/prompts/D1/versions/V1"
    );
  });

  it("keeps the query string", () => {
    expect(
      redirectFrom("/decisions/D1/versions/V1?diff=true", "D1/versions/V1")
    ).toBe("/prompts/D1/versions/V1?diff=true");
  });
});
