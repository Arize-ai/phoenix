import { expect, test } from "@playwright/test";

test("that login gets rate limited after too many attempts", async ({
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
