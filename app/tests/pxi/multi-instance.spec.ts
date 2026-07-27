import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { waitForPersistedAssistantTurn } from "./fixtures";

/**
 * Multi-instance PXI smoke test.
 *
 * Requires two Phoenix instances sharing one Postgres database (see
 * scripts/pxi-multi-instance/run.sh). Exercises the session event bus across
 * deployment boundaries with a real LLM:
 *
 * - "A"  — the originating tab on instance A: sends the turns.
 * - "A2" — a second tab on instance A: must follow the live turn through the
 *          in-memory bus (same-instance replay + live tail).
 * - "B"  — a tab on instance B (does NOT own the in-flight turn): must show
 *          the degraded read-only state while the turn streams, then converge
 *          on the persisted transcript.
 */

const BASE_URL_A = process.env.PXI_MI_BASE_URL_A;
const BASE_URL_B = process.env.PXI_MI_BASE_URL_B;
const ASSISTANT_PROVIDER = "OPENAI";
const ASSISTANT_MODEL = process.env.PXI_E2E_ASSISTANT_MODEL ?? "gpt-5.4-mini";

const FIRST_TURN_PROMPT =
  "Reply with a single short sentence confirming you can hear me. " +
  "Do not use any tools.";

// Long enough that instance B's ~5s remote-lease poll and this spec's UI
// assertions comfortably land while the turn is still streaming.
const LONG_TURN_PROMPT =
  "Without using any tools and without asking clarifying questions, write a " +
  "detailed essay of roughly 1200 words on the history of software " +
  "observability, from early logging through distributed tracing to modern " +
  "LLM observability. Output quality does not matter; length does.";

const DEGRADED_ALERT_TITLE = "Live updates unavailable";
const DEGRADED_PLACEHOLDER =
  "Response is running on another server. Waiting for transcript…";
const BUSY_ELSEWHERE_TEXT = "Responding in another window…";
const IDLE_PLACEHOLDER = "Send a message...";

/** Mirrors the agent-store seed from tests/pxi/fixtures.ts, minus the consent gate. */
async function seedAgentDefaults(page: Page) {
  await page.addInitScript(
    ({ provider, modelName }) => {
      localStorage.clear();
      localStorage.setItem(
        "arize-phoenix-feature-flags",
        JSON.stringify({ agents: true, tracing_ux: false })
      );
      localStorage.setItem(
        "arize-phoenix-assistant",
        JSON.stringify({
          state: {
            isOpen: false,
            position: "pinned",
            fabPlacement: "bottom-end",
            defaultModelConfig: {
              provider,
              modelName,
              invocationParameters: [],
              supportedInvocationParameters: [],
            },
            capabilities: {
              "graphql.mutations": false,
              "web.access": false,
            },
          },
          version: 0,
        })
      );
    },
    { provider: ASSISTANT_PROVIDER, modelName: ASSISTANT_MODEL }
  );
}

async function openPxi(page: Page) {
  await seedAgentDefaults(page);
  await page.goto("/projects");
  await page.getByRole("button", { name: "Ask PXI" }).click();
  // A fresh browser context always sees the consent gate first.
  const input = page.getByLabel("Message input");
  const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
  await expect(input.or(acknowledgeButton).first()).toBeVisible();
  if (await acknowledgeButton.isVisible().catch(() => false)) {
    await acknowledgeButton.click();
  }
  await expect(input).toBeVisible();
}

/** Opens the sessions menu and selects the only session in the shared database. */
async function openOnlySession(page: Page) {
  await page.getByRole("button", { name: "Sessions" }).click();
  const sessionItem = page
    .getByRole("menuitemradio")
    .or(page.getByRole("menuitem"))
    .first();
  await expect(sessionItem).toBeVisible();
  await sessionItem.click();
}

async function newPxiPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

function messageInput(page: Page) {
  return page.getByLabel("Message input");
}

function stopButton(page: Page) {
  return page.getByRole("button", { name: "Stop generation" });
}

async function sendMessage(page: Page, prompt: string) {
  await messageInput(page).fill(prompt);
  await page.getByRole("button", { name: "Send message" }).click();
}

test.describe("PXI multi-instance session event bus", () => {
  test("degrades read-only on the non-owning instance and converges", async ({
    browser,
  }) => {
    test.skip(
      !BASE_URL_A || !BASE_URL_B,
      "Set PXI_MI_BASE_URL_A and PXI_MI_BASE_URL_B (see scripts/pxi-multi-instance/run.sh)."
    );

    const pageA = await newPxiPage(browser, BASE_URL_A!);

    await test.step("turn 1 on A creates and persists the session", async () => {
      await openPxi(pageA);
      await sendMessage(pageA, FIRST_TURN_PROMPT);
      await stopButton(pageA)
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(() => {
          // A very fast turn may already have completed.
        });
      await stopButton(pageA).waitFor({ state: "hidden", timeout: 180_000 });
      const persisted = await waitForPersistedAssistantTurn({
        request: pageA.request,
        requireTraceId: false,
      });
      expect(persisted.assistantText.length).toBeGreaterThan(0);
    });

    const pageB = await newPxiPage(browser, BASE_URL_B!);
    const pageA2 = await newPxiPage(browser, BASE_URL_A!);

    await test.step("B (other instance) reads the persisted transcript while idle", async () => {
      await openPxi(pageB);
      await openOnlySession(pageB);
      // The session row and transcript were written by instance A; reading
      // them here proves cross-instance persistence.
      await expect(
        pageB.locator(".chat__messages").getByText(FIRST_TURN_PROMPT)
      ).toBeVisible();
      await expect(pageB.getByPlaceholder(IDLE_PLACEHOLDER)).toBeVisible();
    });

    await test.step("A2 (same instance) attaches to the session", async () => {
      await openPxi(pageA2);
      await openOnlySession(pageA2);
      await expect(
        pageA2.locator(".chat__messages").getByText(FIRST_TURN_PROMPT)
      ).toBeVisible();
    });

    await test.step("turn 2 streams on A", async () => {
      await sendMessage(pageA, LONG_TURN_PROMPT);
      await expect(stopButton(pageA)).toBeVisible({ timeout: 30_000 });
    });

    await test.step("B degrades to read-only while the turn runs elsewhere", async () => {
      // Instance B discovers the remote lease via its ~5s poll and must NOT
      // receive live chunks — only the degraded state.
      await expect(pageB.getByText(DEGRADED_ALERT_TITLE)).toBeVisible({
        timeout: 60_000,
      });
      await expect(pageB.getByPlaceholder(DEGRADED_PLACEHOLDER)).toBeVisible();
    });

    await test.step("A2 follows the live turn through the in-memory bus", async () => {
      await expect(pageA2.getByText(BUSY_ELSEWHERE_TEXT)).toBeVisible({
        timeout: 60_000,
      });
      // The replayed turn-start carries the submitted user message.
      await expect(
        pageA2.locator(".chat__messages").getByText(LONG_TURN_PROMPT)
      ).toBeVisible({ timeout: 60_000 });
      // Same-instance followers get the live stream, never the degraded state.
      await expect(pageA2.getByText(DEGRADED_ALERT_TITLE)).toHaveCount(0);
    });

    await test.step("turn 2 completes on A", async () => {
      await stopButton(pageA).waitFor({ state: "hidden", timeout: 300_000 });
      await waitForPersistedAssistantTurn({
        request: pageA.request,
        requireTraceId: false,
      });
    });

    await test.step("all clients converge on the persisted transcript", async () => {
      // B: degraded banner clears, transcript refreshes with turn 2.
      await expect(pageB.getByText(DEGRADED_ALERT_TITLE)).toHaveCount(0, {
        timeout: 60_000,
      });
      await expect(
        pageB.locator(".chat__messages").getByText(LONG_TURN_PROMPT)
      ).toBeVisible({ timeout: 60_000 });
      await expect(pageB.getByPlaceholder(IDLE_PLACEHOLDER)).toBeVisible({
        timeout: 60_000,
      });

      // A2: live turn settled into the same transcript.
      await expect(pageA2.getByText(BUSY_ELSEWHERE_TEXT)).toHaveCount(0, {
        timeout: 60_000,
      });
      await expect(
        pageA2.locator(".chat__messages").getByText(LONG_TURN_PROMPT)
      ).toBeVisible();

      // The essay rendered everywhere: each surface holds a long assistant
      // message beyond the two prompts (~350 chars of prompt text).
      for (const page of [pageA, pageA2, pageB]) {
        const transcriptLength = await page
          .locator(".chat__messages")
          .innerText()
          .then((text) => text.length);
        expect(transcriptLength).toBeGreaterThan(1_500);
      }

      // No surface shows an agent error.
      for (const page of [pageA, pageA2, pageB]) {
        await expect(page.locator(".chat__error")).toHaveCount(0);
      }
    });
  });
});
