import {
  createClientErrorReporter,
  registerGlobalClientErrorReporting,
} from "../reportClientError";

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

  it.each([
    "chrome-extension://abcdefghijklmnop",
    "moz-extension://0a1b2c3d-4e5f-6789-abcd-ef0123456789",
    "safari-web-extension://0A1B2C3D-4E5F-6789-ABCD-EF0123456789",
  ])(
    "does not report an error whose stack frames all come from %s",
    (extensionOrigin) => {
      // A browser extension running in the page's main world that patches
      // XMLHttpRequest throws from its own callback.
      const error = new TypeError(
        `Cannot read properties of undefined (reading 'x') in ${extensionOrigin}`
      );
      error.stack = [
        `TypeError: ${error.message}`,
        `    at handle (${extensionOrigin}/content.js:1:761)`,
        `    at XMLHttpRequest.onreadystatechange (${extensionOrigin}/content.js:1:2598)`,
      ].join("\n");
      window.dispatchEvent(
        new ErrorEvent("error", {
          error,
          message: `Uncaught ${error.message}`,
          filename: `${extensionOrigin}/content.js`,
          lineno: 1,
          colno: 761,
        })
      );
      expect(reportedMessages(fetchSpy)).toEqual([]);
    }
  );

  it("does not report an error event raised by a browser extension script", () => {
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: null,
        message: "Uncaught TypeError: extension script failed",
        filename: "chrome-extension://abcdefghijklmnop/content.js",
        lineno: 1,
        colno: 42,
      })
    );
    expect(reportedMessages(fetchSpy)).toEqual([]);
  });

  it("reports an error whose stack also has a Phoenix frame", () => {
    const error = new TypeError("Phoenix code failed inside an extension hook");
    error.stack = [
      `TypeError: ${error.message}`,
      "    at handle (chrome-extension://abcdefghijklmnop/content.js:1:761)",
      "    at loadDatasets (http://localhost:6006/assets/index-Bx1.js:12:3456)",
    ].join("\n");
    window.dispatchEvent(
      new ErrorEvent("error", {
        error,
        message: `Uncaught ${error.message}`,
        filename: "chrome-extension://abcdefghijklmnop/content.js",
      })
    );
    expect(reportedMessages(fetchSpy)).toEqual([error.message]);
  });

  it("reports an error whose stack has an eval frame beside extension frames", () => {
    const error = new Error("evaluated code failed");
    error.stack = [
      `Error: ${error.message}`,
      "    at eval (eval at <anonymous> (http://localhost:6006/assets/index-Bx1.js:1:2), <anonymous>:1:1)",
      "    at handle (chrome-extension://abcdefghijklmnop/content.js:1:761)",
    ].join("\n");
    window.dispatchEvent(
      new ErrorEvent("error", { error, message: `Uncaught ${error.message}` })
    );
    expect(reportedMessages(fetchSpy)).toEqual([error.message]);
  });

  it("does not report an error whose Firefox-style stack is all extension frames", () => {
    const extensionOrigin =
      "moz-extension://0a1b2c3d-4e5f-6789-abcd-ef0123456789";
    const error = new TypeError("extension failed in Firefox");
    error.stack = [
      `handle@${extensionOrigin}/content.js:1:761`,
      `onreadystatechange@${extensionOrigin}/content.js:1:2598`,
    ].join("\n");
    window.dispatchEvent(
      new ErrorEvent("error", { error, message: `TypeError: ${error.message}` })
    );
    expect(reportedMessages(fetchSpy)).toEqual([]);
  });
});

describe("createClientErrorReporter", () => {
  it("does not report a rejection whose stack frames all come from a browser extension", () => {
    // Unhandled rejections and error boundaries report through the reporter
    // directly, without an ErrorEvent filename to go by.
    const send = vi.fn().mockResolvedValue(undefined);
    const reportClientError = createClientErrorReporter({ send });
    const error = new TypeError("extension promise failed");
    error.stack = [
      `TypeError: ${error.message}`,
      "    at handle (chrome-extension://abcdefghijklmnop/content.js:1:761)",
      "    at async load (chrome-extension://abcdefghijklmnop/content.js:2:10)",
    ].join("\n");
    reportClientError({ error });
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a rejection whose stack has a Phoenix frame", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const reportClientError = createClientErrorReporter({ send });
    const error = new TypeError("Phoenix promise failed");
    error.stack = [
      `TypeError: ${error.message}`,
      "    at loadDatasets (http://localhost:6006/assets/index-Bx1.js:12:3456)",
    ].join("\n");
    reportClientError({ error });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
