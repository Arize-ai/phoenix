import { STALE_CAPABILITIES_MISSING_SUBAGENTS } from "./constants";
import { expect, test } from "./fixtures";
import type { PxiChatRequestBody, PxiChatRequestContext } from "./types";

/**
 * Browser-level regression coverage for persisted agent capability state that
 * predates a newer capability key.
 *
 * PR #13788 fixed a bug where older PXI localStorage could rehydrate a
 * `capabilities` object missing newly added keys such as `subagents.enabled`.
 * Reading the absent key produced `enabled: undefined`, JSON serialization
 * dropped the field, and the backend rejected the `subagents` context with a
 * 422 missing-field response. This spec reproduces the real user path: stale
 * localStorage, opening PXI, sending a message, and asserting the serialized
 * `/chat` request still carries valid capability contexts and is not rejected
 * with a 422.
 *
 * This is a deterministic protocol-level spec: it asserts on the serialized
 * request body and the backend's HTTP status, so it does not require model
 * credentials or the LLM-as-judge / experiment-persistence harness used by the
 * answer-quality smoke specs.
 *
 * Extending this for future capability additions: when a new capability key is
 * introduced, add a stale snapshot to `constants.ts` that omits it (mirroring
 * {@link STALE_CAPABILITIES_MISSING_SUBAGENTS}) and assert its context below.
 */

const USER_PROMPT = "Hello, PXI.";

/** Required capability contexts and the boolean field each must carry. */
const REQUIRED_CAPABILITY_CONTEXTS: ReadonlyArray<{
  type: string;
  booleanField: string;
}> = [
  { type: "subagents", booleanField: "enabled" },
  { type: "web_access", booleanField: "enabled" },
  { type: "graphql", booleanField: "mutationsEnabled" },
];

function findContext(
  body: PxiChatRequestBody,
  type: string
): PxiChatRequestContext | undefined {
  return (body.contexts ?? []).find((context) => context.type === type);
}

test.describe("PXI stale capability state", () => {
  test("submits a chat request with valid capability contexts after rehydrating stale persisted state", async ({
    browserName,
    pxi,
  }) => {
    test.skip(
      browserName !== "chromium",
      "PXI E2E specs run once in chromium."
    );
    test.skip(
      process.env.PXI_E2E !== "true",
      "Set PXI_E2E=true to run PXI E2E tests."
    );

    // Seed localStorage as an older Phoenix build would have written it: the
    // persisted capabilities omit `subagents.enabled` entirely.
    await pxi.open({ capabilities: STALE_CAPABILITIES_MISSING_SUBAGENTS });
    await pxi.acknowledgeConsent();

    const { requestBody, responseStatus } =
      await pxi.submitMessageAndCaptureChatRequest(USER_PROMPT);

    // Every required capability context must be present with an explicit
    // boolean. Before the fix, the rehydrated `subagents` capability was
    // `undefined`, so this context serialized as `{ type: "subagents" }` with
    // the `enabled` field dropped.
    for (const { type, booleanField } of REQUIRED_CAPABILITY_CONTEXTS) {
      const context = findContext(requestBody, type);
      expect(
        context,
        `Expected the /chat request to include a "${type}" capability context.`
      ).toBeDefined();
      const fieldValue = context?.[booleanField];
      expect(
        typeof fieldValue,
        `Expected the "${type}" context field "${booleanField}" to be an explicit boolean, got ${typeof fieldValue}.`
      ).toBe("boolean");
    }

    // The backend must accept the request body: a 422 is exactly the
    // missing-field validation failure this regression guards against.
    expect(
      responseStatus,
      `Expected the /chat request to avoid a 422 validation error, got status ${responseStatus}.`
    ).not.toBe(422);
  });
});
