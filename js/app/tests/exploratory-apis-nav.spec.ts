import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

/**
 * Exploratory coverage for the APIs pages (/apis/rest, /apis/graphql) and
 * the navigation chrome (global search, side nav collapse persistence,
 * breadcrumbs, account menu).
 */
test.describe("APIs and navigation chrome", () => {
  test("REST API page renders the OpenAPI reference and expands an operation", async ({
    page,
  }) => {
    await page.goto("/apis/rest");

    // Breadcrumb reflects the current page.
    await expect(
      page.getByRole("list", { name: "Breadcrumbs" }).getByText("REST API")
    ).toBeVisible();

    // The Swagger UI is embedded in an iframe pointed at /docs.
    const docs = page.frameLocator('iframe[title="REST API documentation"]');
    await expect(
      docs.getByRole("heading", { name: /Arize-Phoenix REST API/ })
    ).toBeVisible();

    // Expanding an operation reveals its interactive "Try it out" widget.
    const operation = docs.getByRole("button", {
      name: /List annotation configurations$/,
    });
    await operation.click();
    await expect(operation).toHaveAttribute("aria-expanded", "true");
    await expect(
      docs.getByRole("button", { name: "Try it out" })
    ).toBeVisible();
  });

  test("GraphQL IDE loads and executes a query against the server", async ({
    page,
  }) => {
    await page.goto("/apis/graphql");

    await expect(
      page.getByRole("list", { name: "Breadcrumbs" }).getByText("GraphQL")
    ).toBeVisible();

    // GraphiQL is embedded in an iframe pointed at /graphql.
    const graphiql = page.frameLocator(
      'iframe[title="GraphQL API documentation"]'
    );
    const queryEditor = graphiql.getByRole("region", { name: "Query Editor" });
    await expect(queryEditor).toBeVisible();

    // Replace the default welcome comment with a minimal query. CodeMirror
    // hides its textarea, so click the rendered editor surface and type.
    await queryEditor.locator(".CodeMirror-code").click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("{__typename}");

    await graphiql.getByRole("button", { name: /Execute query/ }).click();

    // The result window shows the server's response.
    await expect(
      graphiql.getByRole("region", { name: "Result Window" })
    ).toContainText('"__typename"');
    await expect(
      graphiql.getByRole("region", { name: "Result Window" })
    ).toContainText('"Query"');
  });

  test("global search opens, filters, shows an empty state, and Escape closes it", async ({
    page,
  }) => {
    await page.goto("/apis/rest");

    await page.getByTestId("global-search-trigger").click();
    const searchInput = page.getByRole("searchbox", {
      name: "Search Phoenix",
    });
    await expect(searchInput).toBeVisible();

    // Static navigation destinations are always listed.
    await expect(
      page.getByRole("menuitem", { name: /REST API/ })
    ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /GraphQL/ })).toBeVisible();

    // A query with no matches shows the empty state.
    await searchInput.fill(`zzz-no-match-${randomUUID()}`);
    await expect(
      page.getByRole("menuitem", { name: "No results" })
    ).toBeVisible();

    // First Escape clears the query, restoring the default listing.
    await page.keyboard.press("Escape");
    await expect(searchInput).toHaveValue("");
    await expect(
      page.getByRole("menuitem", { name: /REST API/ })
    ).toBeVisible();

    // Second Escape closes the search overlay entirely.
    await page.keyboard.press("Escape");
    await expect(searchInput).not.toBeVisible();
  });

  test("global search navigates to a matching destination", async ({
    page,
  }) => {
    await page.goto("/apis/rest");

    await page.getByTestId("global-search-trigger").click();
    const searchInput = page.getByRole("searchbox", {
      name: "Search Phoenix",
    });
    await searchInput.fill("graphql");

    await page.getByRole("menuitem", { name: /GraphQL/ }).click();
    await expect(page).toHaveURL(/\/apis\/graphql/);
    await expect(
      page.getByRole("list", { name: "Breadcrumbs" }).getByText("GraphQL")
    ).toBeVisible();
  });

  test("side navigation collapse persists across reload", async ({ page }) => {
    await page.goto("/apis/rest");

    const collapseButton = page.getByRole("button", {
      name: "Collapse side navigation",
    });
    const expandButton = page.getByRole("button", {
      name: "Expand side navigation",
    });

    await collapseButton.click();
    await expect(expandButton).toBeVisible();

    // The preference is persisted and survives a full reload.
    await page.reload();
    await expect(expandButton).toBeVisible();

    // Expanding restores the full side navigation.
    await expandButton.click();
    await expect(collapseButton).toBeVisible();
    await expect(
      page
        .getByTestId("application-side-navigation")
        .getByRole("link", { name: /REST API/ })
    ).toBeVisible();
  });

  test("account menu lists its items and navigates to the profile page", async ({
    page,
  }) => {
    await page.goto("/apis/rest");

    await page.getByRole("button", { name: "Account" }).click();
    const menu = page.getByRole("menu", { name: "Account" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Documentation" })
    ).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Support" })).toBeVisible();

    await menu.getByRole("menuitem", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/profile/);
  });
});
