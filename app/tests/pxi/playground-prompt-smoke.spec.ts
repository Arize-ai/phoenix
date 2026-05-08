import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, testV2 as test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const EXPERIMENT_EXAMPLE = PXI_EXPERIMENT_EXAMPLES.playgroundPromptSmoke;
const USER_PROMPT = EXPERIMENT_EXAMPLE.prompt;

const JUDGE_RUBRIC = [
  "The assistant used read_prompt to inspect the current playground state before proposing changes.",
  "The assistant used edit_prompt to propose adding a JSON-format system message.",
  "The assistant indicated it is waiting for user approval (accept/reject) before proceeding.",
  "The assistant did not claim the edit was already applied before user approval.",
];

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer about playground prompt editing. Return a label, score, and brief explanation.";

/**
 * Playground prompt tools smoke test.
 *
 * This test exercises the key features of the playground prompt tools:
 * 1. read_prompt - reads the current playground prompt state
 * 2. edit_prompt - proposes edits with diff preview and waits for approval
 *
 * The test verifies:
 * - PXI calls read_prompt to understand current state
 * - PXI calls edit_prompt to propose changes
 * - The diff preview UI appears with Accept/Reject buttons
 * - User can accept the edit and see it applied
 */
test.describe("PXI playground prompt smoke", () => {
  test("reads prompt and proposes edit with approval flow", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium",
      "PXI real-LLM smoke runs once in chromium."
    );
    test.skip(
      process.env.PXI_E2E !== "true",
      "Set PXI_E2E=true to run PXI E2E tests."
    );
    const judgeApiKeyEnv = getRequiredJudgeApiKeyEnv();
    test.skip(
      !process.env.OPENAI_API_KEY,
      "OPENAI_API_KEY is required for the PXI assistant."
    );
    test.skip(
      !process.env[judgeApiKeyEnv],
      `${judgeApiKeyEnv} is required for the PXI E2E judge.`
    );
    test.skip(
      (process.env.PXI_E2E_ASSISTANT_PROVIDER ?? "OPENAI") !== "OPENAI",
      "This PXI E2E smoke test currently supports OPENAI assistant runs."
    );

    // Open PXI on the playground page directly
    // We need to install defaults, navigate to playground, then open PXI
    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("button", { name: /run/i }).first()
    ).toBeVisible();

    // Now open PXI (this will set up localStorage and open the panel)
    await pxi.open();
    await pxi.acknowledgeConsent();

    // Navigate back to playground (pxi.open goes to /projects)
    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("button", { name: /run/i }).first()
    ).toBeVisible();

    // Wait for the playground context to register with the agent store
    // The Playground component uses useAdvertiseAgentContext to register
    // the playground context which enables the prompt tools on the server
    await page.waitForTimeout(500);

    // Re-open PXI panel (navigation closed it)
    await page.getByRole("button", { name: "Open agent chat" }).click();
    // Wait for either message input or acknowledge button (consent dialog may show again)
    const messageInput = page.getByLabel("Message input");
    const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
    await expect(messageInput.or(acknowledgeButton)).toBeVisible();
    if (await acknowledgeButton.isVisible()) {
      await acknowledgeButton.click();
      await expect(messageInput).toBeVisible();
    }

    // Send the prompt - don't use askAndWait since edit_prompt blocks waiting for user approval
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(USER_PROMPT);
    await page.getByRole("button", { name: "Send message" }).click();

    // Wait for the edit_prompt tool to show "Awaiting approval" status
    await expect(page.getByText(/awaiting approval/i).first()).toBeVisible({
      timeout: 30000,
    });

    const calledTools: string[] = [];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // Verify read_prompt was called (visible in UI)
        await expect(page.getByText("read_prompt").first()).toBeVisible();
        calledTools.push("read_prompt");

        // Verify edit_prompt was called (visible in UI)
        await expect(page.getByText("edit_prompt").first()).toBeVisible();
        calledTools.push("edit_prompt");

        // Verify the diff preview UI appeared
        // The diff shows "Proposed diff for" header text
        await expect(
          page.getByText(/proposed diff for/i).first()
        ).toBeVisible();

        // Verify Accept/Reject buttons are present
        const acceptButton = page.getByRole("button", { name: "Accept" });
        const rejectButton = page.getByRole("button", { name: "Reject" });
        await expect(acceptButton.first()).toBeVisible();
        await expect(rejectButton.first()).toBeVisible();

        // Accept the edit
        await acceptButton.first().click();

        // Verify the edit was applied - the status should change to "Accepted"
        await expect(page.getByText(/accepted/i).first()).toBeVisible();

        // Verify the playground now contains the JSON instruction
        // (The system message should be visible in the playground editor)
        await expect(
          page.getByText(/always respond in valid json format/i).first()
        ).toBeVisible();
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: USER_PROMPT,
        // For edit_prompt flow, the assistant doesn't produce a final text response
        // until after user accepts/rejects, so we use a placeholder
        assistantText:
          "Used read_prompt to inspect the playground, then edit_prompt to propose adding JSON format instruction. Awaiting user approval.",
        rubric: JUDGE_RUBRIC,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: EXPERIMENT_EXAMPLE,
        assistantText:
          "Used read_prompt and edit_prompt tools successfully. User accepted the edit.",
        calledTools: [...new Set(calledTools)],
        url: page.url(),
        durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    assertPxiOutcome(outcome);
  });

  test("clone_prompt_instance creates duplicate for comparison", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium",
      "PXI real-LLM smoke runs once in chromium."
    );
    test.skip(
      process.env.PXI_E2E !== "true",
      "Set PXI_E2E=true to run PXI E2E tests."
    );
    const judgeApiKeyEnv = getRequiredJudgeApiKeyEnv();
    test.skip(
      !process.env.OPENAI_API_KEY,
      "OPENAI_API_KEY is required for the PXI assistant."
    );
    test.skip(
      !process.env[judgeApiKeyEnv],
      `${judgeApiKeyEnv} is required for the PXI E2E judge.`
    );
    test.skip(
      (process.env.PXI_E2E_ASSISTANT_PROVIDER ?? "OPENAI") !== "OPENAI",
      "This PXI E2E smoke test currently supports OPENAI assistant runs."
    );

    // Open PXI and acknowledge consent first
    await pxi.open();
    await pxi.acknowledgeConsent();

    // Navigate to playground (pxi.open goes to /projects)
    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("button", { name: /run/i }).first()
    ).toBeVisible();

    // Wait for the playground context to register with the agent store
    await page.waitForTimeout(500);

    // Re-open PXI panel (navigation closed it)
    await page.getByRole("button", { name: "Open agent chat" }).click();
    // Wait for either message input or acknowledge button
    const messageInput = page.getByLabel("Message input");
    const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
    await expect(messageInput.or(acknowledgeButton)).toBeVisible();
    if (await acknowledgeButton.isVisible()) {
      await acknowledgeButton.click();
      await expect(messageInput).toBeVisible();
    }

    // Ask PXI to clone the prompt instance
    const cloneExample = PXI_EXPERIMENT_EXAMPLES.playgroundCloneSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(cloneExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    // Wait for the clone_prompt_instance tool to complete
    await expect(page.getByText("clone_prompt_instance").first()).toBeVisible({
      timeout: 30000,
    });
    // Wait for tool to show "Completed" status
    await expect(page.getByText(/completed/i).first()).toBeVisible({
      timeout: 30000,
    });

    const calledTools: string[] = ["clone_prompt_instance"];

    const cloneJudgeRubric = [
      "The assistant used clone_prompt_instance to duplicate the playground instance.",
      "The assistant confirmed the clone was created successfully.",
      "The assistant did not claim failure or inability to clone.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // Verify a second playground instance now exists
        // After cloning, the PXI response mentions "A" and "B" instances
        // The playground shows a "B Output" heading for the cloned instance
        await expect(
          page.getByRole("heading", { name: "B Output" })
        ).toBeVisible({
          timeout: 5000,
        });
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: cloneExample.prompt,
        assistantText:
          "Used clone_prompt_instance to clone A into B for side-by-side comparison.",
        rubric: cloneJudgeRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: cloneExample,
        assistantText:
          "Used clone_prompt_instance to clone A into B successfully.",
        calledTools: [...new Set(calledTools)],
        url: page.url(),
        durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    assertPxiOutcome(outcome);
  });

  test("edit_prompt reject flow cancels proposed changes", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium",
      "PXI real-LLM smoke runs once in chromium."
    );
    test.skip(
      process.env.PXI_E2E !== "true",
      "Set PXI_E2E=true to run PXI E2E tests."
    );
    const judgeApiKeyEnv = getRequiredJudgeApiKeyEnv();
    test.skip(
      !process.env.OPENAI_API_KEY,
      "OPENAI_API_KEY is required for the PXI assistant."
    );
    test.skip(
      !process.env[judgeApiKeyEnv],
      `${judgeApiKeyEnv} is required for the PXI E2E judge.`
    );
    test.skip(
      (process.env.PXI_E2E_ASSISTANT_PROVIDER ?? "OPENAI") !== "OPENAI",
      "This PXI E2E smoke test currently supports OPENAI assistant runs."
    );

    // Open PXI and acknowledge consent first
    await pxi.open();
    await pxi.acknowledgeConsent();

    // Navigate to playground (pxi.open goes to /projects)
    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("button", { name: /run/i }).first()
    ).toBeVisible();

    // Wait for the playground context to register with the agent store
    await page.waitForTimeout(500);

    // Re-open PXI panel (navigation closed it)
    await page.getByRole("button", { name: "Open agent chat" }).click();
    // Wait for either message input or acknowledge button
    const messageInput = page.getByLabel("Message input");
    const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
    await expect(messageInput.or(acknowledgeButton)).toBeVisible();
    if (await acknowledgeButton.isVisible()) {
      await acknowledgeButton.click();
      await expect(messageInput).toBeVisible();
    }

    // Ask for an edit we'll reject
    const rejectExample = PXI_EXPERIMENT_EXAMPLES.playgroundRejectSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(rejectExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    // Wait for the edit_prompt tool to show "Awaiting approval" status
    await expect(page.getByText(/awaiting approval/i).first()).toBeVisible({
      timeout: 30000,
    });

    const calledTools: string[] = ["edit_prompt"];

    const rejectJudgeRubric = [
      "The assistant proposed an edit adding a pirate-themed system message.",
      "The assistant presented the edit for user review before applying.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // Verify edit_prompt was called
        await expect(page.getByText("edit_prompt").first()).toBeVisible();

        // Verify diff preview appeared
        await expect(
          page.getByText(/proposed diff for/i).first()
        ).toBeVisible();

        // Reject the edit
        const rejectButton = page.getByRole("button", { name: "Reject" });
        await expect(rejectButton.first()).toBeVisible();
        await rejectButton.first().click();

        // Verify the edit was rejected - status should show "Rejected"
        await expect(page.getByText(/rejected/i).first()).toBeVisible();

        // Verify the pirate message was NOT added to the playground prompt editor
        // The text may appear in the user message and diff preview, but should NOT
        // be in the actual playground message editor textboxes
        const playgroundTextboxes = page.locator(
          '[data-testid="message-content"] textarea, [class*="message-content"] textarea'
        );
        // If there are any textboxes, verify none contain the pirate text
        const textboxCount = await playgroundTextboxes.count();
        for (let i = 0; i < textboxCount; i++) {
          const textboxValue = await playgroundTextboxes.nth(i).inputValue();
          expect(textboxValue.toLowerCase()).not.toContain("you are a pirate");
        }
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: rejectExample.prompt,
        assistantText:
          "Used edit_prompt to propose adding a pirate system message. Awaiting user approval.",
        rubric: rejectJudgeRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: rejectExample,
        assistantText:
          "Used edit_prompt tool. User rejected the proposed edit.",
        calledTools: [...new Set(calledTools)],
        url: page.url(),
        durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    assertPxiOutcome(outcome);
  });

  test("pending edit_prompt is cancelled when leaving playground", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium",
      "PXI real-LLM smoke runs once in chromium."
    );
    test.skip(
      process.env.PXI_E2E !== "true",
      "Set PXI_E2E=true to run PXI E2E tests."
    );
    const judgeApiKeyEnv = getRequiredJudgeApiKeyEnv();
    test.skip(
      !process.env.OPENAI_API_KEY,
      "OPENAI_API_KEY is required for the PXI assistant."
    );
    test.skip(
      !process.env[judgeApiKeyEnv],
      `${judgeApiKeyEnv} is required for the PXI E2E judge.`
    );
    test.skip(
      (process.env.PXI_E2E_ASSISTANT_PROVIDER ?? "OPENAI") !== "OPENAI",
      "This PXI E2E smoke test currently supports OPENAI assistant runs."
    );

    await pxi.open();
    await pxi.acknowledgeConsent();

    await page.goto("/playground");
    await page.waitForURL("**/playground");
    await expect(
      page.getByRole("button", { name: /run/i }).first()
    ).toBeVisible();

    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Open agent chat" }).click();
    const messageInput = page.getByLabel("Message input");
    const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
    await expect(messageInput.or(acknowledgeButton)).toBeVisible();
    if (await acknowledgeButton.isVisible()) {
      await acknowledgeButton.click();
      await expect(messageInput).toBeVisible();
    }

    const cancelExample =
      PXI_EXPERIMENT_EXAMPLES.playgroundNavigationCancelSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(cancelExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText(/awaiting approval/i).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("edit_prompt").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accept" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reject" }).first()
    ).toBeVisible();

    await page.getByRole("link", { name: /tracing/i }).click();
    await page.waitForURL("**/projects");

    const openChatButton = page.getByRole("button", {
      name: "Open agent chat",
    });
    if (await openChatButton.isVisible()) {
      await openChatButton.click();
    }
    await expect(
      page
        .getByText(
          /playground was closed before this prompt edit was reviewed/i
        )
        .first()
    ).toBeVisible({ timeout: 10000 });

    const calledTools: string[] = ["edit_prompt"];
    const navigationCancelRubric = [
      "The assistant proposed a playground prompt edit for user review.",
      "The pending edit_prompt tool call was cancelled when the user left the playground before accepting or rejecting.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        await expect(
          page
            .getByText(
              /playground was closed before this prompt edit was reviewed/i
            )
            .first()
        ).toBeVisible();

        await page.getByRole("link", { name: "Playground" }).click();
        await page.waitForURL("**/playground");
        await expect(
          page.getByRole("button", { name: /run/i }).first()
        ).toBeVisible();
        const playgroundTextboxes = page.locator(
          '[data-testid="message-content"] textarea, [class*="message-content"] textarea'
        );
        const textboxCount = await playgroundTextboxes.count();
        for (let index = 0; index < textboxCount; index++) {
          const textboxValue = await playgroundTextboxes
            .nth(index)
            .inputValue();
          expect(textboxValue).not.toContain("NAVIGATION CANCEL MARKER");
        }
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: cancelExample.prompt,
        assistantText:
          "Used edit_prompt to propose adding NAVIGATION CANCEL MARKER. The user left the playground before reviewing it, so the pending tool call was cancelled with an error.",
        rubric: navigationCancelRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: cancelExample,
        assistantText:
          "Used edit_prompt tool. Pending edit was cancelled when the user left the playground.",
        calledTools: [...new Set(calledTools)],
        url: page.url(),
        durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    assertPxiOutcome(outcome);
  });
});
