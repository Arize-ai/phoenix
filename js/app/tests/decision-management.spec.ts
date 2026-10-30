import { randomUUID } from "crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

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
            templateFormat: "MUSTACHE",
            state: { json: "{{ticket}}" },
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
  test("lists decisions on a tab of the prompts page and opens one", async ({
    page,
  }) => {
    const decisionName = `triage-${randomUUID()}`;
    const decisionId = await createDecision(page, decisionName);

    await page.goto("/prompts");
    await page.waitForURL("**/prompts");
    await page.getByRole("tab", { name: "Decisions" }).click();
    await expect(page).toHaveURL(/\/prompts\/decisions$/);

    const row = page
      .getByTestId("decisions-table")
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: decisionName }) });
    await expect(row).toBeVisible();

    await row.getByRole("link", { name: decisionName }).click();
    await expect(page).toHaveURL(
      new RegExp(`/prompts/decisions/${decisionId}$`)
    );
    await expect(
      page.getByRole("heading", { name: decisionName })
    ).toBeVisible();
    await expect(page.getByText("Is the ticket urgent?").first()).toBeVisible();

    await page.getByRole("tab", { name: /versions/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/prompts/decisions/${decisionId}/versions$`)
    );
    await expect(
      page.getByRole("heading", { name: "Version" }).first()
    ).toBeVisible();
  });
});
