import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

/**
 * Exploratory coverage for the application navigation chrome: global search,
 * side nav collapse persistence, breadcrumbs, and the account menu.
 *
 * The /apis/rest and /apis/graphql pages are intentionally not covered here —
 * they embed third-party IDEs (Swagger UI, GraphiQL) whose behavior is not
 * Phoenix's to test.
 */
test.describe("navigation chrome", () => {
  test("global search opens, filters, shows an empty state, and Escape closes it", async ({
    page,
  }) => {
    await page.goto("/datasets");

    await page.getByTestId("global-search-trigger").click();
    const searchInput = page.getByRole("searchbox", {
      name: "Search Phoenix",
    });
    await expect(searchInput).toBeVisible();

    // Static navigation destinations are always listed.
    await expect(
      page.getByRole("menuitem", { name: /Playground/ })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /Settings/ })
    ).toBeVisible();

    // A query with no matches shows the empty state.
    await searchInput.fill(`zzz-no-match-${randomUUID()}`);
    await expect(
      page.getByRole("menuitem", { name: "No results" })
    ).toBeVisible();

    // First Escape clears the query, restoring the default listing.
    await page.keyboard.press("Escape");
    await expect(searchInput).toHaveValue("");
    await expect(
      page.getByRole("menuitem", { name: /Playground/ })
    ).toBeVisible();

    // Second Escape closes the search overlay entirely.
    await page.keyboard.press("Escape");
    await expect(searchInput).not.toBeVisible();
  });

  test("global search navigates to a matching destination", async ({
    page,
  }) => {
    await page.goto("/datasets");

    await page.getByTestId("global-search-trigger").click();
    const searchInput = page.getByRole("searchbox", {
      name: "Search Phoenix",
    });
    await searchInput.fill("playground");

    await page.getByRole("menuitem", { name: /Playground/ }).click();
    await expect(page).toHaveURL(/\/playground/);
    await expect(
      page.getByRole("list", { name: "Breadcrumbs" }).getByText("Playground")
    ).toBeVisible();
  });

  test("side navigation collapse persists across reload", async ({ page }) => {
    await page.goto("/datasets");

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
        .getByRole("link", { name: /Playground/ })
    ).toBeVisible();
  });

  test("account menu lists its items and navigates to the profile page", async ({
    page,
  }) => {
    await page.goto("/datasets");

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
