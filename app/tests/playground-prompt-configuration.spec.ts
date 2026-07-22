import { randomUUID } from "crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Round-trip tests for playground prompt configuration.
 *
 * For each of the four invocation-parameter families (OpenAI, Anthropic,
 * Google, AWS Bedrock), the test:
 *   1. Switches the playground to the target provider/model (OpenAI is the
 *      default, so the OpenAI variant skips the switch).
 *   2. Opens the "Configure model parameters" popover.
 *   3. Sets a randomized non-default value on a representative
 *      provider-specific NumberField (and, for OpenAI, also the Reasoning
 *      Effort Select).
 *   4. Adds a provider-specific response format/schema.
 *   5. Adds a provider-specific function tool and raw vendor tool.
 *   6. Saves the prompt under a unique name.
 *   7. Reloads the page so the playground store is rebuilt from the saved
 *      prompt version (via the `?promptId=&promptVersionId=` URL params).
 *   8. Reopens the UI and asserts the originally entered values.
 *
 * This exercises the typed-union save path
 * (`PromptInvocationParametersInput.{openai,anthropic,google,aws}.*`) and
 * the typed-union read path (`PromptInvocationParameters` GraphQL union →
 * provider adapters → `InvocationParametersFormFields`), plus mixed
 * function/raw prompt tool persistence.
 * A break anywhere in that chain — wire shape, adapter branch, hydration, or
 * form rendering — surfaces here.
 */

/** Random integer in [128, 927] — capped under 1,000 because NumberField
 * renders larger values with a locale thousand-separator (e.g. "6,414"),
 * which would not match the raw integer string in the assertion. */
function randomTokenCount(): string {
  return String(128 + Math.floor(Math.random() * 800));
}

const OPENAI_RESPONSES_FUNCTION_TOOL = {
  type: "function",
  name: "get_weather",
  description: "Get the current weather for a location.",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "City name",
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        default: "celsius",
      },
    },
    required: ["city"],
  },
  strict: true,
};

const OPENAI_RESPONSES_RAW_TOOL = {
  type: "web_search",
  search_context_size: "medium",
};

const ANTHROPIC_FUNCTION_TOOL = {
  name: "get_weather",
  description: "Get the current weather for a location.",
  input_schema: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "City name",
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature unit",
      },
    },
    required: ["city"],
  },
};

const ANTHROPIC_RAW_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
  allowed_domains: ["arxiv.org", "pubmed.ncbi.nlm.nih.gov"],
};

const GOOGLE_FUNCTION_TOOL = {
  name: "get_weather",
  description: "Get the current weather for a location.",
  parameters: {
    type: "OBJECT",
    properties: {
      city: {
        type: "STRING",
        description: "City name",
      },
      unit: {
        type: "STRING",
        enum: ["celsius", "fahrenheit"],
      },
    },
    required: ["city"],
  },
};

const GOOGLE_RAW_TOOL = {
  google_search: {
    search_types: {
      web_search: {},
      image_search: {},
    },
  },
};

const AWS_FUNCTION_TOOL = {
  toolSpec: {
    name: "get_weather",
    description: "Get the current weather for a location.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City name",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
          },
        },
        required: ["city"],
      },
    },
  },
};

const AWS_RAW_TOOL = {
  systemTool: {
    name: "system_tool_name_per_bedrock_docs",
  },
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "string",
      description: "Weather summary for the requested location.",
    },
    confidence: {
      type: "number",
      description: "Confidence score between 0 and 1.",
    },
  },
  required: ["answer"],
  additionalProperties: false,
};

const OPENAI_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "weather_answer",
    description: "Structured weather response.",
    schema: RESPONSE_SCHEMA,
    strict: true,
  },
};

const ANTHROPIC_RESPONSE_FORMAT = {
  type: "json_schema",
  schema: RESPONSE_SCHEMA,
};

/**
 * Switch the playground model. The model menu trigger has an
 * `aria-label` of the form `"Select model[: <currentModelName>]"` (set on
 * the shared `ModelMenu` Button component), so role+name with a stable
 * `/^Select model/` prefix locates it regardless of current selection.
 * Within the menu we hover the target provider's section, type a model
 * name into the provider's submenu search field, and pick the first
 * matching item — either a built-in registry entry or the synthetic
 * "(custom)" item.
 */
async function selectModel(
  page: Page,
  {
    providerDisplayName,
    modelName,
  }: {
    providerDisplayName: string;
    modelName: string;
  }
): Promise<void> {
  await page.getByRole("button", { name: /^Select model/ }).click();
  await page
    .getByRole("menuitem", { name: providerDisplayName, exact: true })
    .hover();
  // Each provider's submenu is its own dialog labelled by the provider name.
  // Scope to it so the typed-search and the menu items don't ambiguate with
  // the parent menu's search field.
  const submenuDialog = page.getByRole("dialog", {
    name: providerDisplayName,
  });
  await submenuDialog.getByRole("searchbox").fill(modelName);
  // Pick whichever menuitem first matches — either a built-in registry item
  // or the synthetic "(custom)" entry the menu adds for unknown names.
  await submenuDialog
    .getByRole("menuitem")
    .filter({ hasText: new RegExp(modelName, "i") })
    .first()
    .click();
}

async function selectOpenAIApiType(
  popover: Locator,
  page: Page,
  apiTypeLabel: "Chat Completions" | "Responses"
): Promise<void> {
  await popover.getByTestId("invocation-param-apiType").click();
  await page.getByRole("option", { name: apiTypeLabel, exact: true }).click();
}

async function openModelConfigPopover(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: "Configure model parameters" })
    .click();
  const popover = page.getByRole("dialog", {
    name: "Configure model parameters",
  });
  await expect(popover).toBeVisible();
  return popover;
}

async function closeModelConfigPopover(popover: Locator): Promise<void> {
  // The popover renders a pointer-event-blocking overlay; press Escape on
  // the popover element (focus must be inside) to dismiss it.
  await popover.press("Escape");
  await expect(popover).toBeHidden();
}

async function setCodeMirrorValue(
  page: Page,
  editor: Locator,
  value: unknown
): Promise<void> {
  const editorValue = JSON.stringify(value, null, 2);
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(editorValue);
}

const TOOL_CARD_TESTID_PREFIX = /^playground-tool-card-/;

function toolCard(page: Page, toolName: string): Locator {
  return page.getByTestId(`playground-tool-card-${toolName}`);
}

async function addTool({
  page,
  value,
  expectedTitle,
}: {
  page: Page;
  value: unknown;
  expectedTitle: string;
}): Promise<void> {
  const toolCards = page.getByTestId(TOOL_CARD_TESTID_PREFIX);
  const previousCount = await toolCards.count();
  await page.getByRole("button", { name: "add tool" }).click();
  await expect(toolCards).toHaveCount(previousCount + 1);
  const newToolEditor = toolCards
    .last()
    .getByTestId("playground-tool-editor")
    .locator(".cm-content");
  await setCodeMirrorValue(page, newToolEditor, value);
  await expect(toolCard(page, expectedTitle)).toBeVisible();
}

async function addFunctionAndRawTools({
  page,
  functionTool,
  rawTool,
  rawToolTitle,
}: {
  page: Page;
  functionTool: unknown;
  rawTool: unknown;
  rawToolTitle: string;
}): Promise<void> {
  await addTool({
    page,
    value: functionTool,
    expectedTitle: "get_weather",
  });
  await addTool({ page, value: rawTool, expectedTitle: rawToolTitle });
}

async function setToolChoiceOneOrMore({
  page,
  apiToken,
}: {
  page: Page;
  apiToken: "required" | "any";
}): Promise<void> {
  await page.getByRole("button", { name: /Tool Choice/ }).click();
  await page
    .getByRole("option", {
      name: new RegExp(`Use at least one tool\\s+${apiToken}`),
    })
    .click();
  await expectToolChoiceOneOrMore({ page, apiToken });
}

async function expectToolChoiceOneOrMore({
  page,
  apiToken,
}: {
  page: Page;
  apiToken: "required" | "any";
}): Promise<void> {
  await expect(
    page.getByRole("button", {
      name: new RegExp(`Use at least one tool\\s+${apiToken}.*Tool Choice`),
    })
  ).toBeVisible();
}

async function addResponseFormat({
  page,
  label,
  value,
}: {
  page: Page;
  label: "Response Format" | "Response Schema";
  value: unknown;
}): Promise<void> {
  await page.getByTestId("add-response-format").click();
  await expect(
    page.getByRole("button", { name: label, exact: true })
  ).toBeVisible();
  const responseFormatEditor = page
    .getByTestId("playground-response-format-editor")
    .locator(".cm-content");
  await setCodeMirrorValue(page, responseFormatEditor, value);
}

async function expectResponseFormat({
  page,
  label,
}: {
  page: Page;
  label: "Response Format" | "Response Schema";
}): Promise<void> {
  await expect(
    page.getByRole("button", { name: label, exact: true })
  ).toBeVisible();
  await expect(page.getByText("Weather summary").first()).toBeVisible();
  await expect(page.getByText("confidence").first()).toBeVisible();
}

async function expectFunctionAndRawTools({
  page,
  rawToolTitle,
  rawToolText,
}: {
  page: Page;
  rawToolTitle: string;
  rawToolText: string;
}): Promise<void> {
  await expect(toolCard(page, "get_weather")).toBeVisible();
  await expect(toolCard(page, rawToolTitle)).toBeVisible();
  await expect(page.getByText(rawToolText).first()).toBeVisible();
}

async function savePromptWithUniqueName(
  page: Page,
  prefix: string
): Promise<void> {
  const promptName = `${prefix}-${randomUUID().slice(0, 8)}`;
  await page.getByRole("button", { name: "Save Prompt" }).click();
  await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
  await page
    .getByLabel("Description (optional)")
    .fill("invocation parameters round-trip test");
  await page.getByRole("button", { name: "Create Prompt" }).click();
  await expect(page).toHaveURL(/promptId=/);
}

async function reloadAndExpectPlayground(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByRole("heading", { name: "Playground" })).toBeVisible();
  await expect(page).toHaveURL(/promptId=/);
}

test.describe("Playground prompt configuration round-trip", () => {
  // Both OpenAI API types share the Max Completion Tokens + Reasoning Effort
  // fields but route through different `applicableOpenAIApiTypes` filtering
  // and different canonicalization on the RESPONSES write path
  // (`max_output_tokens` → `max_completion_tokens`, nested `reasoning.effort`
  // → flat `reasoning_effort`). Running both ensures neither branch silently
  // drops a shared field. Saved prompts don't record the API type — on reload
  // it is inferred from Responses-only tool shapes and otherwise assumed to be
  // Responses (the default) — so both cases rehydrate to the Responses surface.
  for (const apiTypeLabel of ["Chat Completions", "Responses"] as const) {
    test(`OpenAI (${apiTypeLabel}): prompt configuration survives reload`, async ({
      page,
    }) => {
      const expectedMaxCompletionTokens = randomTokenCount();
      const reasoningEffortChoices = [
        "minimal",
        "low",
        "medium",
        "high",
      ] as const;
      const expectedReasoningEffort =
        reasoningEffortChoices[
          Math.floor(Math.random() * reasoningEffortChoices.length)
        ];

      await page.goto("/playground");
      await page.waitForURL("**/playground");

      const popover = await openModelConfigPopover(page);

      await selectOpenAIApiType(popover, page, apiTypeLabel);

      await popover
        .getByRole("textbox", { name: "Max Completion Tokens" })
        .fill(expectedMaxCompletionTokens);

      await popover.getByTestId("invocation-param-reasoningEffort").click();
      await page
        .getByRole("option", { name: expectedReasoningEffort, exact: true })
        .click();

      await closeModelConfigPopover(popover);

      await addResponseFormat({
        page,
        label: "Response Format",
        value: OPENAI_RESPONSE_FORMAT,
      });

      if (apiTypeLabel === "Responses") {
        await addFunctionAndRawTools({
          page,
          functionTool: OPENAI_RESPONSES_FUNCTION_TOOL,
          rawTool: OPENAI_RESPONSES_RAW_TOOL,
          rawToolTitle: "web_search",
        });
        await setToolChoiceOneOrMore({ page, apiToken: "required" });
      }

      const savePrefix =
        apiTypeLabel === "Chat Completions"
          ? "playground-invocation-rt-openai-chat"
          : "playground-invocation-rt-openai-responses";
      await savePromptWithUniqueName(page, savePrefix);
      await reloadAndExpectPlayground(page);

      const reopened = await openModelConfigPopover(page);
      await expect(
        reopened.getByRole("textbox", { name: "Max Completion Tokens" })
      ).toHaveValue(expectedMaxCompletionTokens);
      await expect(
        reopened.getByTestId("invocation-param-apiType")
      ).toContainText("Responses");
      await expect(
        reopened.getByTestId("invocation-param-reasoningEffort")
      ).toContainText(expectedReasoningEffort);
      await expectResponseFormat({ page, label: "Response Format" });
      if (apiTypeLabel === "Responses") {
        await expectFunctionAndRawTools({
          page,
          rawToolTitle: "web_search",
          rawToolText: "web_search",
        });
        await expectToolChoiceOneOrMore({ page, apiToken: "required" });
      }
    });
  }

  test("Anthropic: prompt configuration survives reload", async ({ page }) => {
    // Anthropic constraints: budget ≥ 1024 (SDK floor) and budget < max_tokens
    // (backend validator). Both values land in NumberFields that render with
    // a locale thousand-separator above 999, so we format with `Intl` so the
    // string we fill matches what `toHaveValue` reads back.
    const numberFmt = new Intl.NumberFormat("en-US");
    const budgetNum = 1024 + Math.floor(Math.random() * 1500); // [1024, 2523]
    const maxTokensNum = budgetNum + 1 + Math.floor(Math.random() * 2500);
    const expectedBudgetTokens = numberFmt.format(budgetNum);
    const expectedMaxTokens = numberFmt.format(maxTokensNum);
    const thinkingDisplayChoices = ["summarized", "omitted"] as const;
    const expectedThinkingDisplay =
      thinkingDisplayChoices[
        Math.floor(Math.random() * thinkingDisplayChoices.length)
      ];
    // Pick a concrete non-default effort so this proves the select write and
    // prompt round-trip, rather than passing because the adapter default is
    // already "high".
    const effortChoices = ["low", "medium", "xhigh", "max"] as const;
    const expectedEffort =
      effortChoices[Math.floor(Math.random() * effortChoices.length)];

    await page.goto("/playground");
    await page.waitForURL("**/playground");

    await selectModel(page, {
      providerDisplayName: "Anthropic",
      modelName: "claude-3-5-sonnet-latest",
    });

    const popover = await openModelConfigPopover(page);
    await popover
      .getByRole("textbox", { name: "Max Tokens" })
      .fill(expectedMaxTokens);

    // Switch Thinking to "Enabled" so the budget path is exercised. The Budget
    // Tokens NumberField only renders in Enabled mode.
    await popover.getByTestId("invocation-param-thinkingType").click();
    await page.getByRole("option", { name: "enabled", exact: true }).click();
    await popover
      .getByRole("textbox", { name: "Budget Tokens" })
      .fill(expectedBudgetTokens);

    await popover.getByTestId("invocation-param-thinkingDisplay").click();
    await page
      .getByRole("option", { name: expectedThinkingDisplay, exact: true })
      .click();

    await popover.getByTestId("invocation-param-effort").click();
    await page
      .getByRole("option", { name: expectedEffort, exact: true })
      .click();

    await closeModelConfigPopover(popover);
    await addResponseFormat({
      page,
      label: "Response Format",
      value: ANTHROPIC_RESPONSE_FORMAT,
    });
    await addFunctionAndRawTools({
      page,
      functionTool: ANTHROPIC_FUNCTION_TOOL,
      rawTool: ANTHROPIC_RAW_TOOL,
      rawToolTitle: "web_search",
    });
    await setToolChoiceOneOrMore({ page, apiToken: "any" });

    await savePromptWithUniqueName(page, "playground-invocation-rt-anthropic");
    await reloadAndExpectPlayground(page);

    const reopened = await openModelConfigPopover(page);
    await expect(
      reopened.getByRole("textbox", { name: "Max Tokens" })
    ).toHaveValue(expectedMaxTokens);
    await expect(
      reopened.getByTestId("invocation-param-thinkingType")
    ).toContainText("enabled");
    await expect(
      reopened.getByRole("textbox", { name: "Budget Tokens" })
    ).toHaveValue(expectedBudgetTokens);
    await expect(
      reopened.getByTestId("invocation-param-thinkingDisplay")
    ).toContainText(expectedThinkingDisplay);
    await expect(reopened.getByTestId("invocation-param-effort")).toContainText(
      expectedEffort
    );
    await expectResponseFormat({ page, label: "Response Format" });
    await expectFunctionAndRawTools({
      page,
      rawToolTitle: "web_search",
      rawToolText: "web_search_20250305",
    });
    await expectToolChoiceOneOrMore({ page, apiToken: "any" });
  });

  test("Google: prompt configuration survives reload", async ({ page }) => {
    const expectedMaxOutputTokens = randomTokenCount();
    const expectedThinkingLevel = "high";

    await page.goto("/playground");
    await page.waitForURL("**/playground");

    await selectModel(page, {
      providerDisplayName: "Google Gemini",
      modelName: "gemini-3-flash-preview",
    });

    const popover = await openModelConfigPopover(page);
    await popover
      .getByRole("textbox", { name: "Max Output Tokens" })
      .fill(expectedMaxOutputTokens);
    await expect(
      popover.getByTestId("invocation-param-thinkingLevel")
    ).toContainText("medium");
    await expect(
      popover.getByRole("switch", { name: "Include Thoughts" })
    ).toBeChecked();
    await popover.getByTestId("invocation-param-thinkingLevel").click();
    await page
      .getByRole("option", { name: expectedThinkingLevel, exact: true })
      .click();
    await popover
      .getByRole("switch", { name: "Include Thoughts" })
      .press("Space");
    await expect(
      popover.getByRole("switch", { name: "Include Thoughts" })
    ).not.toBeChecked();
    await closeModelConfigPopover(popover);
    await addResponseFormat({
      page,
      label: "Response Schema",
      value: RESPONSE_SCHEMA,
    });
    await addFunctionAndRawTools({
      page,
      functionTool: GOOGLE_FUNCTION_TOOL,
      rawTool: GOOGLE_RAW_TOOL,
      rawToolTitle: "Tool",
    });
    await setToolChoiceOneOrMore({ page, apiToken: "any" });

    await savePromptWithUniqueName(page, "playground-invocation-rt-google");
    await reloadAndExpectPlayground(page);

    const reopened = await openModelConfigPopover(page);
    await expect(
      reopened.getByRole("textbox", { name: "Max Output Tokens" })
    ).toHaveValue(expectedMaxOutputTokens);
    await expect(
      reopened.getByTestId("invocation-param-thinkingLevel")
    ).toContainText(expectedThinkingLevel);
    await expect(
      reopened.getByRole("switch", { name: "Include Thoughts" })
    ).not.toBeChecked();
    await expectResponseFormat({ page, label: "Response Schema" });
    await expectFunctionAndRawTools({
      page,
      rawToolTitle: "Tool",
      rawToolText: "google_search",
    });
    await expectToolChoiceOneOrMore({ page, apiToken: "any" });
  });

  test("AWS Bedrock: prompt configuration survives reload", async ({
    page,
  }) => {
    const expectedMaxTokens = randomTokenCount();

    await page.goto("/playground");
    await page.waitForURL("**/playground");

    await selectModel(page, {
      providerDisplayName: "AWS Bedrock",
      modelName: "anthropic.claude-3-haiku-20240307-v1:0",
    });

    const popover = await openModelConfigPopover(page);
    await popover
      .getByRole("textbox", { name: "Max Tokens" })
      .fill(expectedMaxTokens);
    await closeModelConfigPopover(popover);
    await addResponseFormat({
      page,
      label: "Response Schema",
      value: RESPONSE_SCHEMA,
    });
    await addFunctionAndRawTools({
      page,
      functionTool: AWS_FUNCTION_TOOL,
      rawTool: AWS_RAW_TOOL,
      rawToolTitle: "Tool",
    });
    await setToolChoiceOneOrMore({ page, apiToken: "any" });

    await savePromptWithUniqueName(page, "playground-invocation-rt-aws");
    await reloadAndExpectPlayground(page);

    const reopened = await openModelConfigPopover(page);
    await expect(
      reopened.getByRole("textbox", { name: "Max Tokens" })
    ).toHaveValue(expectedMaxTokens);
    await expectResponseFormat({ page, label: "Response Schema" });
    await expectFunctionAndRawTools({
      page,
      rawToolTitle: "Tool",
      rawToolText: "system_tool_name_per_bedrock_docs",
    });
    await expectToolChoiceOneOrMore({ page, apiToken: "any" });
  });
});
