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
});
