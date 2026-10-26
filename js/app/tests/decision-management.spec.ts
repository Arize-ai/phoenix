import { randomUUID } from "crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Creates a saved decision through the GraphQL API. Saving a decision does
 * not call a model, so no provider credentials are needed.
 */
async function createDecision(page: Page, name: string): Promise<string> {
  const response = await page.request.post("/graphql", {
    data: {
      operationName: "CreateDecisionForTest",
      query: `
        mutation CreateDecisionForTest($input: CreateDecisionInput!) {
          createDecision(input: $input) {
            id
          }
        }
      `,
      variables: {
        input: {
          name,
          description: "routes support tickets",
          version: {
            inputs: [{ name: "ticket" }],
            state: { input: "ticket" },
            questions: [
              {
                predicate: {
                  name: "is_urgent",
                  instructions: "Is the ticket urgent?",
                },
              },
            ],
            modelProvider: "OPENAI",
            modelName: "gpt-4o-mini",
          },
        },
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.errors).toBeUndefined();
  return body.data.createDecision.id;
}

test.describe("Decision Management", () => {
  test("lists a decision with prompts and opens it under /prompts", async ({
    page,
  }) => {
    const decisionName = `triage-${randomUUID()}`;
    const decisionId = await createDecision(page, decisionName);

    await page.goto("/prompts");
    const row = page
      .getByTestId("prompts-table")
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: decisionName }) });
    await expect(row).toBeVisible();
    await expect(row.getByText("DECISION", { exact: true })).toBeVisible();

    await row.getByRole("link", { name: decisionName }).click();
    await expect(page).toHaveURL(new RegExp(`/prompts/${decisionId}$`));
    await expect(
      page.getByRole("heading", { name: decisionName })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Decision" })).toBeVisible();
    await expect(page.getByText("Is the ticket urgent?").first()).toBeVisible();

    await page.getByRole("tab", { name: /versions/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/prompts/${decisionId}/versions/`)
    );
    await expect(page.getByRole("heading", { name: "Version" })).toBeVisible();
  });

  test("redirects old decision URLs to /prompts", async ({ page }) => {
    const decisionName = `triage-${randomUUID()}`;
    const decisionId = await createDecision(page, decisionName);

    await page.goto(`/decisions/${decisionId}`);
    await expect(page).toHaveURL(new RegExp(`/prompts/${decisionId}$`));
    await expect(
      page.getByRole("heading", { name: decisionName })
    ).toBeVisible();

    await page.goto("/decisions");
    await expect(page).toHaveURL(/\/prompts$/);
  });
});
