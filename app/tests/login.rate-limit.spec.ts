import { expect, test } from "@playwright/test";

// Note: This test is skipped because the test server has rate limiting disabled
// (PHOENIX_DISABLE_RATE_LIMIT=True) to prevent flakiness in parallel login tests.
// To test rate limiting manually, run the server without that flag.
test.skip("that login gets rate limited after too many attempts", async ({
  page,
}) => {
  await page.goto("/login");
  await page.waitForURL("**/login");

  const email = `fakeuser@localhost.com`;
  // Add the user
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not-a-password");

  const numberOfAttempts = 10;
  for (let i = 0; i < numberOfAttempts; i++) {
    await page.getByRole("button", { name: "Log In", exact: true }).click();
  }
  await expect(
    page.getByText("Too many requests. Please try again later.")
  ).toBeVisible();
});
