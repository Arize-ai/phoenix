import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.beforeEach(async ({ page }) => {
  // Mock the systemApiKeys response to prevent unauthorized errors
  await page.route('**/graphql', async (route) => {
    const request = route.request();
    const postData = request.postDataJSON();
    
    // If this is a query that includes systemApiKeys, return an empty array
    if (postData.query && postData.query.includes('systemApiKeys')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            systemApiKeys: []
          }
        })
      });
    } else {
      // Otherwise, let the request proceed normally
      await route.continue();
    }
  });

  page.goto(`/login`);
  await page.getByLabel("Email").fill("member@localhost.com");
  await page.getByLabel("Password").fill("member123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/projects");
});

test("can create user key", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "New Key" }).click();
  const keyName = `key-${randomUUID()}`;
  await page.getByRole("dialog").getByLabel("Name").fill(keyName);
  await page.getByRole("button", { name: "Create Key" }).click();
  await page.getByLabel("dismiss").click();
  
  // Verify the key appears in the table - which means key creation succeeded
  await expect(page.getByRole("cell", { name: keyName })).toBeVisible({ timeout: 60000 });
});
