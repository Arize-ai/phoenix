import { parseCodexRedirect } from "@phoenix/agent/codex/codexAuthApi";

const authorization = {
  redirect_uri: "http://localhost:1455/auth/callback",
  state: "st_1",
};

describe("parseCodexRedirect", () => {
  it("reads the code from the full redirect URL", () => {
    expect(
      parseCodexRedirect(
        "  http://localhost:1455/auth/callback?code=ac_1&state=st_1&scope=openid ",
        authorization
      )
    ).toEqual({ ok: true, code: "ac_1" });
  });

  it("accepts a bare authorization code", () => {
    expect(parseCodexRedirect("ac_1", authorization)).toEqual({
      ok: true,
      code: "ac_1",
    });
  });

  it("rejects a redirect from another sign-in attempt", () => {
    expect(
      parseCodexRedirect(
        "http://localhost:1455/auth/callback?code=ac_1&state=other",
        authorization
      )
    ).toEqual({ ok: false, reason: "state_mismatch" });
  });

  it("rejects URLs that are not the Codex callback", () => {
    expect(
      parseCodexRedirect(
        "https://auth.openai.com/oauth/authorize?code=x",
        authorization
      )
    ).toEqual({ ok: false, reason: "not_a_redirect" });
    expect(parseCodexRedirect("not a code at all", authorization)).toEqual({
      ok: false,
      reason: "not_a_redirect",
    });
  });

  it("reports a callback without a code", () => {
    expect(
      parseCodexRedirect(
        "http://localhost:1455/auth/callback?error=access_denied&state=st_1",
        authorization
      )
    ).toEqual({ ok: false, reason: "missing_code" });
    expect(parseCodexRedirect("", authorization)).toEqual({
      ok: false,
      reason: "missing_code",
    });
  });
});
