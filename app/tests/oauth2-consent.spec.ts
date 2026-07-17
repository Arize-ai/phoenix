import { expect, test } from "@playwright/test";

function consentUrl(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: "phoenix-cli",
    client_name: "Phoenix CLI",
    is_first_party: "true",
    redirect_uri: "http://127.0.0.1:53211/callback",
    state: "test-state-1234567890",
    code_challenge: "test-code-challenge",
    code_challenge_method: "S256",
    ...overrides,
  });
  return `/oauth2/consent?${params.toString()}`;
}

test.describe("OAuth2 consent", () => {
  test("shows access breadth and loopback provenance copy", async ({
    page,
  }) => {
    await page.goto(consentUrl());

    await expect(
      page.getByRole("heading", { name: "Connect Phoenix CLI" })
    ).toBeVisible();
    await expect(page.getByText("to your Phoenix workspace")).toBeVisible();
    await expect(page.getByText("View your data")).toBeVisible();
    await expect(page.getByText("with your permissions")).toBeVisible();
    await expect(
      page.getByText("Only approve if you started this request")
    ).toBeVisible();
    await expect(page.getByText("127.0.0.1:53211")).toBeVisible();
    await expect(page.getByText("this machine")).toBeVisible();
  });

  test("shows private-use scheme redirects as local applications", async ({
    page,
  }) => {
    await page.goto(
      consentUrl({
        client_id: "px_dcr_abc1234567890",
        client_name: "Cursor",
        is_first_party: "false",
        redirect_uri: "cursor://anysphere.cursor-mcp/oauth/callback",
      })
    );

    await expect(page.getByText("Unverified application")).toBeVisible();
    await expect(page.getByText("an application on this device")).toBeVisible();
    await expect(
      page.getByText("cursor://anysphere.cursor-mcp/oauth/callback")
    ).toBeVisible();
  });
});
