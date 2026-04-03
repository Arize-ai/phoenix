import type { Subscription } from "relay-runtime";

vi.mock("@phoenix/config");
vi.mock("@phoenix/authFetch", () => ({
  authFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

import RelayEnvironment from "@phoenix/RelayEnvironment";

describe("RelayEnvironment", () => {
  const _fetch = global.fetch;

  afterEach(() => {
    global.fetch = _fetch;
    vi.clearAllMocks();
  });

  function execute(query = "query TestQuery { viewer { id } }") {
    const results: unknown[] = [];
    let error: Error | undefined;
    let completed = false;

    const subscription: Subscription = RelayEnvironment.getNetwork()
      .execute(
        {
          id: null,
          text: query,
          name: "TestQuery",
          operationKind: "query",
          metadata: {},
          cacheID: "test",
        },
        {},
        {}
      )
      .subscribe({
        next: (val: unknown) => results.push(val),
        error: (err: Error) => {
          error = err;
        },
        complete: () => {
          completed = true;
        },
      });

    return {
      results,
      getError: () => error,
      isCompleted: () => completed,
      subscription,
    };
  }

  /**
   * Build a properly formatted multipart/mixed response body with the given
   * JSON payloads, suitable for use with ReadableStream.
   */
  function buildMultipartBody(parts: unknown[], boundary = "graphql"): string {
    let body = "";
    for (const part of parts) {
      body += `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(part)}`;
    }
    body += `\r\n--${boundary}--\r\n`;
    return body;
  }

  function createMultipartResponse(
    parts: unknown[],
    boundary = "graphql"
  ): Response {
    const body = buildMultipartBody(parts, boundary);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": `multipart/mixed; boundary=${boundary}; deferSpec=20220824`,
      },
    });
  }

  it("emits a single JSON response for standard queries", async () => {
    const payload = { data: { viewer: { id: "1" } } };
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { results, isCompleted } = execute();

    // Allow the microtask queue to flush
    await vi.waitFor(() => expect(isCompleted()).toBe(true));
    expect(results).toEqual([payload]);
  });

  it("throws on GraphQL errors in standard JSON responses", async () => {
    const payload = {
      errors: [{ message: "Something went wrong" }],
    };
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { getError } = execute();

    await vi.waitFor(() => expect(getError()).toBeDefined());
    expect(getError()!.message).toContain("Something went wrong");
  });

  it("parses multipart/mixed responses for @defer", async () => {
    const initialPayload = { data: { viewer: { id: "1" } }, hasNext: true };
    const incrementalPayload = {
      incremental: [
        { data: { name: "test" }, path: ["viewer"], label: "Deferred" },
      ],
      hasNext: false,
    };

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createMultipartResponse([initialPayload, incrementalPayload])
      )
    );

    const { results, isCompleted } = execute();

    await vi.waitFor(() => expect(isCompleted()).toBe(true));
    // readMultipartBody unwraps the `incremental` array into individual
    // payloads with top-level `data`, `path`, and `label` for Relay.
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(initialPayload);
    expect(results[1]).toEqual({
      data: { name: "test" },
      path: ["viewer"],
      label: "Deferred",
      hasNext: false,
    });
  });

  it("sends the correct Accept header for defer support", async () => {
    const payload = { data: { viewer: { id: "1" } } };
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    execute();

    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Accept).toContain("multipart/mixed");
    expect(init.headers.Accept).toContain("deferSpec=20220824");
  });

  it("aborts the fetch and does not emit an error when unsubscribed", async () => {
    let abortSignal: AbortSignal | null | undefined;
    global.fetch = vi.fn(
      (_input: unknown, init?: RequestInit): Promise<Response> => {
        abortSignal = init?.signal;
        // Return a promise that never resolves (simulates in-flight request)
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new DOMException(
              "The operation was aborted.",
              "AbortError"
            );
            reject(abortError);
          });
        });
      }
    );

    const { getError, subscription } = execute();

    // Wait for fetch to be called, then unsubscribe
    await vi.waitFor(() => expect(abortSignal).toBeDefined());
    subscription.unsubscribe();

    // Allow microtasks to settle after abort
    await new Promise((r) => setTimeout(r, 50));

    // The abort signal should have fired and no error should surface
    expect(abortSignal!.aborted).toBe(true);
    expect(getError()).toBeUndefined();
  });
});
