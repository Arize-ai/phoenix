---
name: phoenix-playwright-tests
description: Write Playwright E2E tests for the Phoenix AI observability platform. Use when creating, updating, or debugging Playwright tests, or when the user asks about testing UI features, writing E2E tests, or automating browser interactions for Phoenix.
---

# Phoenix Playwright Test Writing

Write end-to-end tests for Phoenix using Playwright. Tests live in `app/tests/` and follow established patterns.

## Quick Start

```typescript
import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/login`);
    await page.getByLabel("Email").fill("admin@localhost");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await page.waitForURL("**/projects");
  });

  test("can do something", async ({ page }) => {
    // Test implementation
  });
});
```

## Test Credentials

| User   | Email                | Password  | Role   |
| ------ | -------------------- | --------- | ------ |
| Admin  | admin@localhost      | admin123  | admin  |
| Member | member@localhost.com | member123 | member |
| Viewer | viewer@localhost.com | viewer123 | viewer |

## Selector Patterns (Priority Order)

1. **Role selectors** (most robust):

   ```typescript
   page.getByRole("button", { name: "Save" });
   page.getByRole("link", { name: "Datasets" });
   page.getByRole("tab", { name: /Evaluators/i });
   page.getByRole("menuitem", { name: "Edit" });
   page.getByRole("cell", { name: "my-item" });
   page.getByRole("heading", { name: "Title" });
   page.getByRole("dialog");
   page.getByRole("textbox", { name: "Name" });
   page.getByRole("combobox", { name: /mapping/i });
   ```

2. **Label selectors**:

   ```typescript
   page.getByLabel("Email");
   page.getByLabel("Dataset Name");
   page.getByLabel("Description");
   ```

3. **Text selectors**:

   ```typescript
   page.getByText("No evaluators added");
   page.getByPlaceholder("Search...");
   ```

4. **Test IDs** (when available):

   ```typescript
   page.getByTestId("modal");
   ```

5. **CSS locators** (last resort):
   ```typescript
   page.locator('button:has-text("Save")');
   ```

## Common UI Patterns

### Dropdown Menus

```typescript
// Click button to open dropdown
await page.getByRole("button", { name: "New Dataset" }).click();
// Select menu item
await page.getByRole("menuitem", { name: "New Dataset" }).click();
```

### Nested Menus (Submenus)

```typescript
// Open menu, hover over submenu trigger, click submenu item
await page.getByRole("button", { name: "Add evaluator" }).click();
await page
  .getByRole("menuitem", { name: "Use LLM evaluator template" })
  .hover();
await page.getByRole("menuitem", { name: /correctness/i }).click();

// IMPORTANT: Always use getByRole("menuitem") for submenu items, not getByText()
// Playwright's auto-waiting handles the submenu appearance timing
// ❌ BAD - flaky in CI:
// await page.getByText("ExactMatch").first().click();
// ✅ GOOD - reliable:
// await page.getByRole("menuitem", { name: /ExactMatch/i }).click();
```

### Dialogs/Modals

```typescript
// Wait for dialog
await expect(page.getByRole("dialog")).toBeVisible();
// Fill form in dialog
await page.getByLabel("Name").fill("test-name");
// Submit
await page.getByRole("button", { name: "Create" }).click();
// Wait for close
await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
```

### Tables with Row Actions

```typescript
// Find row by cell content
const row = page.getByRole("row").filter({
  has: page.getByRole("cell", { name: "item-name" }),
});
// Click action button in row (usually last button)
await row.getByRole("button").last().click();
// Select action from menu
await page.getByRole("menuitem", { name: "Edit" }).click();
```

### Tabs

```typescript
await page.getByRole("tab", { name: /Evaluators/i }).click();
await page.waitForURL("**/evaluators");
await expect(page.getByRole("tab", { name: /Evaluators/i })).toHaveAttribute(
  "aria-selected",
  "true",
);
```

### Form Inputs in Sections

```typescript
// When multiple textboxes exist, scope to section
const systemSection = page.locator('button:has-text("System")');
const systemTextbox = systemSection
  .locator("..")
  .locator("..")
  .getByRole("textbox");
await systemTextbox.fill("content");
```

## Serial Tests (Shared State)

Use `test.describe.serial` when tests depend on each other:

```typescript
test.describe.serial("Workflow", () => {
  const itemName = `item-${randomUUID()}`;

  test("step 1: create item", async ({ page }) => {
    // Creates itemName
  });

  test("step 2: edit item", async ({ page }) => {
    // Uses itemName from previous test
  });

  test("step 3: verify edits", async ({ page }) => {
    // Verifies itemName was edited
  });
});
```

## Assertions

```typescript
// Visibility
await expect(element).toBeVisible();
await expect(element).not.toBeVisible({ timeout: 10000 });

// Text content
await expect(element).toHaveText("expected");
await expect(element).toContainText("partial");

// Attributes
await expect(element).toHaveAttribute("aria-selected", "true");

// Input values
await expect(input).toHaveValue("expected value");

// URL
await page.waitForURL("**/datasets/**/examples");
```

## Navigation Patterns

```typescript
// Direct navigation
await page.goto("/datasets");
await page.waitForURL("**/datasets");

// Click navigation
await page.getByRole("link", { name: "Datasets" }).click();
await page.waitForURL("**/datasets");

// Extract ID from URL
const url = page.url();
const match = url.match(/datasets\/([^/]+)/);
const datasetId = match ? match[1] : "";

// Navigate with query params
await page.goto(`/playground?datasetId=${datasetId}`);
```

## Running Tests

```bash
# Run specific test file
pnpm exec playwright test tests/server-evaluators.spec.ts --project=chromium

# Run with UI mode
pnpm exec playwright test --ui

# Run specific test by name
pnpm exec playwright test -g "can create"

# Debug mode
pnpm exec playwright test --debug
```

### Avoiding Interactive Report Server

By default, Playwright serves an HTML report after tests finish and waits for Ctrl+C, which can cause command timeouts. Use these options to avoid this:

```bash
# Use list reporter (no interactive server)
pnpm exec playwright test tests/example.spec.ts --project=chromium --reporter=list

# Use dot reporter for minimal output
pnpm exec playwright test tests/example.spec.ts --project=chromium --reporter=dot

# Set CI mode to disable interactive features
CI=1 pnpm exec playwright test tests/example.spec.ts --project=chromium
```

**Recommended for automation**: Always use `--reporter=list` or `CI=1` when running tests programmatically to ensure the command exits cleanly after tests complete.

## Phoenix-Specific Pages

| Page                 | URL Pattern                  | Key Elements                                       |
| -------------------- | ---------------------------- | -------------------------------------------------- |
| Datasets             | `/datasets`                  | Table, "New Dataset" button                        |
| Dataset Detail       | `/datasets/{id}/examples`    | Tabs (Experiments, Examples, Evaluators, Versions) |
| Dataset Evaluators   | `/datasets/{id}/evaluators`  | "Add evaluator" button, evaluators table           |
| Playground           | `/playground`                | Prompts section, Experiment section                |
| Playground + Dataset | `/playground?datasetId={id}` | Dataset selector, Evaluators button                |
| Prompts              | `/prompts`                   | "New Prompt" button, prompts table                 |
| Settings             | `/settings/general`          | "Add User" button, users table                     |

## UI Exploration with agent-browser

When selectors are unclear, use agent-browser to explore the Phoenix UI. For detailed agent-browser usage, invoke the `/agent-browser` skill.

### Quick Reference for Phoenix

```bash
# Open Phoenix page (dev server runs on port 6006)
agent-browser open "http://localhost:6006/datasets"

# Get interactive snapshot with element refs
agent-browser snapshot -i

# Click using refs from snapshot
agent-browser click @e5

# Fill form fields
agent-browser fill @e2 "test value"

# Get element text
agent-browser get text @e1
```

### Discovering Selectors Workflow

1. Open the page: `agent-browser open "http://localhost:6006/datasets"`
2. Get snapshot: `agent-browser snapshot -i`
3. Find element refs in output (e.g., `@e1 [button] "New Dataset"`)
4. Interact: `agent-browser click @e1`
5. Re-snapshot after navigation/DOM changes: `agent-browser snapshot -i`

### Translating to Playwright

| agent-browser output       | Playwright selector                              |
| -------------------------- | ------------------------------------------------ |
| `@e1 [button] "Save"`      | `page.getByRole("button", { name: "Save" })`     |
| `@e2 [link] "Datasets"`    | `page.getByRole("link", { name: "Datasets" })`   |
| `@e3 [textbox] "Name"`     | `page.getByRole("textbox", { name: "Name" })`    |
| `@e4 [menuitem] "Edit"`    | `page.getByRole("menuitem", { name: "Edit" })`   |
| `@e5 [tab] "Evaluators 0"` | `page.getByRole("tab", { name: /Evaluators/i })` |

## File Naming

- Feature tests: `{feature-name}.spec.ts`
- Access control: `{role}-access.spec.ts`
- Rate limiting: `{feature}.rate-limit.spec.ts` (runs last)

## Common Gotchas

1. **Dialog not closing**: Add longer timeout: `{ timeout: 10000 }`
2. **Multiple elements**: Use `.first()`, `.last()`, or `.nth(n)`
3. **Dynamic content**: Use regex in name: `{ name: /pattern/i }`
4. **Flaky waits**: Prefer `waitForURL` over `waitForTimeout`
5. **Menu not appearing**: Add small delay or wait for specific element

## Debugging Flaky Tests

### Critical Lessons Learned

1. **Don't assume parallelism is the problem**
   - Phoenix tests run with 7 parallel workers without issues
   - The app handles concurrent logins, database operations, and session management properly
   - If tests fail with parallelism, it's usually a test timing issue, not infrastructure
   - Playwright's browser context isolation is robust - each worker gets isolated cookies/sessions

2. **waitForTimeout is almost always wrong**
   - `page.waitForTimeout()` is the #1 cause of flakiness in Phoenix tests
   - Arbitrary timeouts race against rendering and network speed
   - **Always replace with state-based waits:**
     ```typescript
     // ❌ BAD - flaky, races against rendering
     await page.waitForTimeout(500);
     await element.click();

     // ✅ GOOD - waits for actual state
     await element.waitFor({ state: "visible", timeout: 5000 });
     await element.click();
     ```

3. **Test the actual failure before fixing**
   - Run tests with parallelism enabled to see what actually fails
   - Check error messages - they often point to the real issue
   - Don't optimize prematurely (e.g., caching auth state) if it's not the problem

4. **Phoenix test infrastructure is solid**
   - In-memory SQLite works fine with parallel tests
   - No need for per-worker databases
   - No need for auth state caching
   - Tests use `randomUUID()` for data isolation - this works well

### Debugging Workflow

When tests are flaky:

1. **Run with parallelism multiple times** to catch intermittent failures:
   ```bash
   for i in 1 2 3 4 5; do
     pnpm exec playwright test --project=chromium --reporter=dot
   done
   ```

2. **Look for `waitForTimeout` usage** - replace with proper waits:
   ```bash
   grep -r "waitForTimeout" app/tests/
   ```

3. **Check for race conditions** in element interactions:
   - Wait for element visibility before interacting
   - Wait for network idle when needed: `page.waitForLoadState("networkidle")`
   - Use `waitForURL` after navigation actions

4. **Verify selectors are stable**:
   - Avoid CSS selectors that depend on DOM structure
   - Use role/label selectors that match ARIA attributes
   - Test selectors don't break when UI updates

5. **Run with trace on failure** to see what happened:
   ```bash
   pnpm exec playwright test --trace on-first-retry
   ```

### Common Flaky Patterns and Fixes

| Flaky Pattern | Root Cause | Fix |
|--------------|------------|-----|
| Submenu item not found | Using `getByText()` instead of `getByRole()` | Use `getByRole("menuitem", { name: /pattern/i })` for submenu items |
| Menu click fails | Menu not fully rendered | `await menu.waitFor({ state: "visible" })` before click |
| Dialog assertion fails | Dialog animation not complete | Increase timeout or wait for specific content |
| Navigation timeout | Page still loading | Remove `waitForLoadState("networkidle")` - it's flaky in CI |
| Element not found | Dynamic content loading | Wait for element visibility, not arbitrary timeout |
| Stale element | Re-render between locate and click | Store locator, not element handle |

### Test Stability Best Practices

1. **Use proper waits**:
   ```typescript
   // Wait for element state
   await element.waitFor({ state: "visible" | "hidden" | "attached" })

   // Wait for network
   await page.waitForLoadState("networkidle" | "domcontentloaded" | "load")

   // Wait for URL change
   await page.waitForURL("**/expected-path")
   ```

2. **Use unique test data**:
   ```typescript
   const uniqueName = `test-${randomUUID()}`;
   ```

3. **Prefer role selectors** - they're less brittle:
   ```typescript
   page.getByRole("button", { name: "Save" }) // ✅ Good
   page.locator('button.save-btn') // ❌ Brittle
   ```

4. **Don't fight animations** - wait for them:
   ```typescript
   await expect(dialog).not.toBeVisible({ timeout: 10000 });
   ```

5. **Verify URL changes** after navigation:
   ```typescript
   await page.waitForURL("**/datasets");
   ```
