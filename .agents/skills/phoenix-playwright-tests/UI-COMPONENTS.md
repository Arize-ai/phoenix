# Phoenix UI Component Reference

Reference for common Phoenix UI components and how to interact with them in Playwright tests.

## Navigation Sidebar

The main navigation sidebar contains:

- Projects
- Datasets & Experiments
- Playground
- Evaluators
- Prompts
- APIs
- Settings
- Documentation
- Support
- Profile

```typescript
// Navigate via sidebar
await page.getByRole("link", { name: "Datasets & Experiments" }).click();
await page.getByRole("link", { name: "Settings" }).click();
```

## Breadcrumbs

Located at top of pages, shows navigation path:

```typescript
await page.getByRole("link", { name: "Datasets" }).click(); // In breadcrumbs
```

## Tables

Phoenix uses data tables with sortable columns and row actions.

### Table Structure

```html
<table>
  <thead>
    <tr>
      <th>name</th>
      <th>description</th>
      <th>actions</th>
      <!-- Often empty header for action column -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>item-name</td>
      <td>description</td>
      <td><button>...</button></td>
      <!-- Action menu -->
    </tr>
  </tbody>
</table>
```

### Interacting with Tables

```typescript
// Click on cell content (usually a link)
await page.getByRole("link", { name: "item-name" }).click();

// Find specific row
const row = page.getByRole("row").filter({
  has: page.getByRole("cell", { name: "item-name" }),
});

// Click action menu in row
await row.getByRole("button").last().click();

// Verify cell exists
await expect(page.getByRole("cell", { name: "item-name" })).toBeVisible();
```

## Tabs

Used on detail pages (e.g., Dataset detail has Experiments, Examples, Evaluators, Versions tabs).

```typescript
// Click tab
await page.getByRole("tab", { name: /Evaluators/i }).click();

// Verify tab is selected
await expect(page.getByRole("tab", { name: /Evaluators/i })).toHaveAttribute(
  "aria-selected",
  "true"
);

// Get content from tab panel
await page.getByRole("tabpanel").getByText("content");
```

## Dialogs/Modals

Used for forms, confirmations, and complex interactions.

```typescript
// Wait for dialog to appear
await expect(page.getByRole("dialog")).toBeVisible();

// Get dialog heading
await expect(
  page.getByRole("heading", { name: "Create Evaluator" })
).toBeVisible();

// Interact with dialog content
await page.getByRole("dialog").getByLabel("Name").fill("value");

// Close dialog
await page.getByRole("button", { name: "Cancel" }).click();
// or
await page.getByRole("button", { name: "Create" }).click();

// Wait for dialog to close
await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
```

## Dropdown Menus

Two types: button dropdowns and menu triggers.

### Button Dropdown

```typescript
// Click button to open dropdown
await page.getByRole("button", { name: "New Dataset" }).click();

// Select option
await page.getByRole("menuitem", { name: "New Dataset" }).click();
```

### Action Menu (Three Dots)

```typescript
// Usually the last button in a row
await row.getByRole("button").last().click();

// Select action
await page.getByRole("menuitem", { name: "Edit" }).click();
await page.getByRole("menuitem", { name: "Delete" }).click();
```

### Nested Submenus

```typescript
// Open parent menu
await page.getByRole("button", { name: "Add evaluator" }).click();

// Hover/click to open submenu
await page
  .getByRole("menuitem", { name: "Use LLM evaluator template" })
  .click();

// Select from submenu
await page.getByRole("menuitem", { name: /correctness/i }).click();
```

## Form Elements

### Text Inputs

```typescript
// By label
await page.getByLabel("Name").fill("value");
await page.getByLabel("Description").fill("value");

// By role
await page.getByRole("textbox", { name: "Name" }).fill("value");

// By placeholder
await page.getByPlaceholder("Enter name").fill("value");

// Clear and fill
await page.getByLabel("Name").clear();
await page.getByLabel("Name").fill("new value");
```

### Select/Combobox

```typescript
// Click to open
await page.getByRole("combobox", { name: /mapping/i }).click();

// Type to filter and select
await page.getByRole("combobox", { name: /mapping/i }).fill("option");

// Select from dropdown
await page.getByRole("option", { name: "option-name" }).click();
```

### Checkboxes and Switches

```typescript
// Toggle switch
await page.getByRole("switch", { name: "Include explanation" }).click();

// Checkbox
await page.getByRole("checkbox", { name: "Option" }).check();
await page.getByRole("checkbox", { name: "Option" }).uncheck();
```

### Radio Buttons

```typescript
await page.getByRole("radio", { name: "Mustache" }).click();
await page.getByRole("radio", { name: "F-String" }).click();
```

## Buttons

```typescript
// By name
await page.getByRole("button", { name: "Save" }).click();
await page.getByRole("button", { name: "Create" }).click();
await page.getByRole("button", { name: "Update" }).click();
await page.getByRole("button", { name: "Cancel" }).click();

// Exact match
await page.getByRole("button", { name: "Log In", exact: true }).click();

// With icon (may need different selector)
await page.getByRole("button", { name: "Add evaluator" }).click();
```

## Search Boxes

```typescript
await page
  .getByRole("searchbox", { name: "Search datasets by name" })
  .fill("query");
await page.getByRole("searchbox", { name: /Search/i }).fill("query");
```

## Slideover Panels

Full-screen modals that slide in from the side (used for editing evaluators).

```typescript
// These behave like dialogs
await expect(page.getByRole("dialog")).toBeVisible();
await page.getByRole("heading", { name: "Edit Evaluator" }).toBeVisible();
```

## Expandable Sections (Disclosure)

Collapsible sections in forms.

```typescript
// Click to expand/collapse
await page
  .getByRole("button", { name: "System Role for the chat message" })
  .click();

// Check if expanded
await expect(
  page.getByRole("button", { name: "System Role for the chat message" })
).toHaveAttribute("aria-expanded", "true");
```

## Code Editor Areas (CodeMirror)

Phoenix uses CodeMirror for code/prompt editing. These are typically wrapped in textbox roles.

```typescript
// Find the textbox within a section
const systemSection = page.locator('button:has-text("System")');
const editor = systemSection.locator("..").locator("..").getByRole("textbox");
await editor.fill("content");
```

## Empty States

Tables and lists show empty state messages when no data exists.

```typescript
await expect(
  page.getByText("No evaluators added to this dataset")
).toBeVisible();
await expect(page.getByText("No data")).toBeVisible();
```

## Loading States

```typescript
// Wait for loading to complete
await expect(page.getByText("Loading...")).not.toBeVisible();

// Or wait for specific content
await expect(page.getByRole("table")).toBeVisible();
```

## Error States

```typescript
// Error alerts
await expect(page.getByRole("alert")).toContainText("Error message");

// Error page
await expect(
  page.getByRole("heading", { name: "Something went wrong" })
).toBeVisible();
```

## Tooltips

```typescript
// Hover to show tooltip
await page.getByRole("button", { name: "Info" }).hover();
await expect(page.getByRole("tooltip")).toContainText("Help text");
```
