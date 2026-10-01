import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReloadUntilTracesArrive } from "../useReloadUntilTracesArrive";

const streamState = vi.hoisted(() => ({ fetchKey: "initial" }));

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => streamState,
}));

function ReloadProbe({
  hasTraces,
  reload,
}: {
  hasTraces: boolean;
  reload: () => void;
}) {
  useReloadUntilTracesArrive({ hasTraces, reload });
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  streamState.fetchKey = "initial";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useReloadUntilTracesArrive", () => {
  it("reloads on each new fetch key while the project is empty, not on mount", () => {
    const reload = vi.fn();
    // The page loads from the network on tab entry; a mount-time reload would
    // land in the same commit and be released before it renders.
    act(() => root.render(<ReloadProbe hasTraces={false} reload={reload} />));
    expect(reload).not.toHaveBeenCalled();

    streamState.fetchKey = "fetch-traces-1";
    act(() => root.render(<ReloadProbe hasTraces={false} reload={reload} />));
    expect(reload).toHaveBeenCalledTimes(1);

    // A re-render with the same fetch key, e.g. the reloaded query landing
    // with no traces yet, must not loop.
    act(() => root.render(<ReloadProbe hasTraces={false} reload={reload} />));
    expect(reload).toHaveBeenCalledTimes(1);

    streamState.fetchKey = "fetch-traces-2";
    act(() => root.render(<ReloadProbe hasTraces={false} reload={reload} />));
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("uses the latest reload without a new reload identity triggering one", () => {
    const first = vi.fn();
    const second = vi.fn();
    act(() => root.render(<ReloadProbe hasTraces={false} reload={first} />));
    act(() => root.render(<ReloadProbe hasTraces={false} reload={second} />));
    expect(second).not.toHaveBeenCalled();

    streamState.fetchKey = "fetch-traces-1";
    act(() => root.render(<ReloadProbe hasTraces={false} reload={second} />));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops reloading once the project has traces", () => {
    const reload = vi.fn();
    act(() => root.render(<ReloadProbe hasTraces reload={reload} />));
    streamState.fetchKey = "fetch-traces-1";
    act(() => root.render(<ReloadProbe hasTraces reload={reload} />));
    expect(reload).not.toHaveBeenCalled();
  });
});
