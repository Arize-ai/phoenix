import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useSingleSubjectEvaluatorPreview } from "../useEvaluatorPreview";

type PreviewOutcome = Awaited<
  ReturnType<ReturnType<typeof useSingleSubjectEvaluatorPreview>>
>;

/** A network whose subscriptions stay open until the test ends them. */
function createHeldOpenEnvironment() {
  const streams = { opened: 0, closed: 0 };
  const environment = new Environment({
    network: Network.create(
      async () => ({ data: {} }),
      () =>
        Observable.create(() => {
          streams.opened += 1;
          return () => {
            streams.closed += 1;
          };
        })
    ),
    store: new Store(new RecordSource()),
  });
  return { environment, streams };
}

let startPreview: ReturnType<typeof useSingleSubjectEvaluatorPreview>;

function PreviewProbe() {
  startPreview = useSingleSubjectEvaluatorPreview();
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  container.remove();
});

describe("useSingleSubjectEvaluatorPreview", () => {
  it("closes a running preview when the form unmounts and settles it", async () => {
    const { environment, streams } = createHeldOpenEnvironment();
    act(() =>
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <PreviewProbe />
        </RelayEnvironmentProvider>
      )
    );
    let outcome: PreviewOutcome | null = null;
    void startPreview({
      evaluator: { builtInEvaluatorId: "QnVpbHRJbkV2YWx1YXRvcjox" },
      inputMapping: { literalMapping: {}, pathMapping: {} },
      context: { output: "hello" },
    }).then((settled) => {
      outcome = settled;
    });
    expect(streams).toEqual({ opened: 1, closed: 0 });

    act(() => root.unmount());
    await Promise.resolve();

    expect(streams).toEqual({ opened: 1, closed: 1 });
    expect(outcome).toEqual({
      ok: false,
      error: "The evaluator form closed before the test finished",
    });
  });
});
