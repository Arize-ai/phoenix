import { describe, expect, it } from "vitest";

import { renderOAuthCallbackPage } from "../src/oauthCallbackPage";

describe("renderOAuthCallbackPage", () => {
  it("renders the success page", () => {
    const html = renderOAuthCallbackPage({ status: "success", code: "abc" });
    expect(html).toContain("You&#39;re all set".replace("&#39;", "'"));
    expect(html).toContain("close this tab");
    expect(html).not.toContain("abc");
  });

  it("renders the cancelled page", () => {
    const html = renderOAuthCallbackPage({ status: "access_denied" });
    expect(html).toContain("Authorization cancelled");
    expect(html).toContain("<code>px auth login</code>");
  });

  it("renders the error page with the message", () => {
    const html = renderOAuthCallbackPage({
      status: "invalid",
      message: "OAuth state mismatch; possible CSRF.",
    });
    expect(html).toContain("Something went wrong");
    expect(html).toContain("OAuth state mismatch; possible CSRF.");
  });

  it("escapes HTML in error messages", () => {
    const html = renderOAuthCallbackPage({
      status: "invalid",
      message: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
