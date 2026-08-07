import { createSubmittedToolOutputTracker } from "@phoenix/agent/chat/submittedToolOutputs";

describe("createSubmittedToolOutputTracker", () => {
  it("marks recorded outputs submitted once the server acknowledges them", () => {
    const tracker = createSubmittedToolOutputTracker();

    tracker.recordRequest(["tool-call-1"]);
    expect(tracker.isSubmitted("tool-call-1")).toBe(false);

    tracker.commitInFlight();
    expect(tracker.isSubmitted("tool-call-1")).toBe(true);
  });

  it("accumulates submissions across sequential requests", () => {
    const tracker = createSubmittedToolOutputTracker();

    tracker.recordRequest(["tool-call-1"]);
    tracker.commitInFlight();
    tracker.recordRequest(["tool-call-1", "tool-call-2"]);
    tracker.commitInFlight();

    expect(tracker.isSubmitted("tool-call-1")).toBe(true);
    expect(tracker.isSubmitted("tool-call-2")).toBe(true);
  });

  it("leaves outputs resendable when the request fails", () => {
    const tracker = createSubmittedToolOutputTracker();

    tracker.recordRequest(["tool-call-1"]);
    tracker.discardInFlight();

    expect(tracker.isSubmitted("tool-call-1")).toBe(false);

    // A later acknowledgement (e.g. of a retried request recorded afresh)
    // must not resurrect the discarded ids.
    tracker.commitInFlight();
    expect(tracker.isSubmitted("tool-call-1")).toBe(false);
  });

  it("resets when the turn completes", () => {
    const tracker = createSubmittedToolOutputTracker();

    tracker.recordRequest(["tool-call-1"]);
    tracker.commitInFlight();
    tracker.clear();

    expect(tracker.isSubmitted("tool-call-1")).toBe(false);
  });
});
