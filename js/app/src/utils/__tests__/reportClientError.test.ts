import { registerGlobalClientErrorReporting } from "../reportClientError";

function reportedMessages(fetchSpy: ReturnType<typeof vi.fn>): string[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).endsWith("/client_errors"))
    .map(
      ([, init]) => JSON.parse((init as RequestInit).body as string).message
    );
}

describe("registerGlobalClientErrorReporting", () => {
  const fetchSpy = vi.fn();

  beforeAll(() => {
    vi.stubGlobal("fetch", fetchSpy);
    registerGlobalClientErrorReporting();
  });

  beforeEach(() => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("reports an uncaught error", () => {
    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("boom"), message: "boom" })
    );
    expect(reportedMessages(fetchSpy)).toEqual(["boom"]);
  });

  it.each([
    "ResizeObserver loop completed with undelivered notifications.",
    "ResizeObserver loop limit exceeded",
  ])("does not report the benign browser notice %j", (message) => {
    // Browsers dispatch this notice as an ErrorEvent with a null `error`.
    window.dispatchEvent(new ErrorEvent("error", { error: null, message }));
    expect(reportedMessages(fetchSpy)).toEqual([]);
  });

  it("does not report a rejection caused by aborting a request", () => {
    function dispatchUnhandledRejection(reason: unknown) {
      const promise = Promise.reject(reason);
      // Handled here so the test runner does not see a real unhandled rejection.
      promise.catch(() => {});
      window.dispatchEvent(
        new PromiseRejectionEvent("unhandledrejection", { promise, reason })
      );
    }
    // Relay cancelling an in-flight request aborts its signal with no reason;
    // the signal's reason is the AbortError that the rejection carries.
    const controller = new AbortController();
    controller.abort();
    dispatchUnhandledRejection(controller.signal.reason);
    dispatchUnhandledRejection(new Error("real failure"));
    expect(reportedMessages(fetchSpy)).toEqual(["real failure"]);
  });
});
