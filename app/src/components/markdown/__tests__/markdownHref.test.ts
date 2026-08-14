import { describe, expect, it } from "vitest";

import { normalizeMarkdownHref } from "../markdownHref";

const TEST_BASE_URL = "http://localhost:6006/";

describe("normalizeMarkdownHref", () => {
  it("preserves multiple query parameters on internal links", () => {
    expect(
      normalizeMarkdownHref({
        href: "/datasets/id/evaluators?createCodeEvaluator=true&foo=bar",
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "internal",
      to: {
        pathname: "/datasets/id/evaluators",
        search: "?createCodeEvaluator=true&foo=bar",
        hash: "",
      },
    });
  });

  it("keeps encoded query values encoded", () => {
    const search = "?filterCondition=span_kind%20%3D%3D%20%27LLM%27";
    expect(
      normalizeMarkdownHref({
        href: `/projects/1/traces${search}`,
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "internal",
      to: {
        pathname: "/projects/1/traces",
        search,
        hash: "",
      },
    });
  });

  it("preserves fragments alongside query strings", () => {
    expect(
      normalizeMarkdownHref({
        href: "/projects/1/traces?tab=spans#span",
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "internal",
      to: {
        pathname: "/projects/1/traces",
        search: "?tab=spans",
        hash: "#span",
      },
    });
  });

  it("unescapes markdown HTML artifacts without corrupting query delimiters", () => {
    expect(
      normalizeMarkdownHref({
        href: "/datasets/id/evaluators?createCodeEvaluator=true&amp;foo=bar",
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "internal",
      to: {
        pathname: "/datasets/id/evaluators",
        search: "?createCodeEvaluator=true&foo=bar",
        hash: "",
      },
    });

    expect(
      normalizeMarkdownHref({
        href: String.raw`/projects/1/traces\?tab=spans\#span`,
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "internal",
      to: {
        pathname: "/projects/1/traces",
        search: "?tab=spans",
        hash: "#span",
      },
    });
  });

  it("treats same-origin absolute URLs as internal app paths", () => {
    expect(
      normalizeMarkdownHref({
        href: "http://localhost:6006/settings?tab=ai",
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "internal",
      to: {
        pathname: "/settings",
        search: "?tab=ai",
        hash: "",
      },
    });
  });

  it("keeps external URLs absolute, including query strings and fragments", () => {
    const href = "https://arize.com/docs/phoenix/x?a=1&b=2#y";
    expect(
      normalizeMarkdownHref({
        href,
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "external",
      href,
    });
  });

  it("keeps encoded values on external URLs", () => {
    const href =
      "https://arize.com/docs/phoenix?q=span_kind%20%3D%3D%20%27LLM%27";
    expect(
      normalizeMarkdownHref({
        href,
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "external",
      href,
    });
  });

  it("classifies mailto and protocol-relative hrefs as external", () => {
    expect(
      normalizeMarkdownHref({
        href: "mailto:support@example.com",
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "external",
      href: "mailto:support@example.com",
    });

    expect(
      normalizeMarkdownHref({
        href: "//cdn.example.com/file?cache=1",
        baseUrl: TEST_BASE_URL,
      })
    ).toEqual({
      kind: "external",
      href: "http://cdn.example.com/file?cache=1",
    });
  });
});
