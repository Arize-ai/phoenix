import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnTimestampAdvance } from "../useOnTimestampAdvance";

const T1 = "2026-11-06T10:00:00.000Z";
const T2 = "2026-11-06T10:00:05.000Z";
const T3 = "2026-11-06T10:00:10.000Z";

let container: HTMLDivElement;
let root: Root;
const onAdvance = vi.fn();

function Harness({ timestamp }: { timestamp: string | null }) {
  useOnTimestampAdvance(timestamp, onAdvance);
  return null;
}

function render(timestamp: string | null) {
  act(() => {
    root.render(<Harness timestamp={timestamp} />);
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  onAdvance.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("useOnTimestampAdvance", () => {
  it("treats the first timestamp as the baseline", () => {
    render(T1);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("calls back once for each later timestamp", () => {
    render(T1);
    render(T2);
    render(T3);
    expect(onAdvance.mock.calls).toEqual([[T2], [T3]]);
  });

  it("ignores equal, earlier, and null timestamps", () => {
    render(T2);
    render(T2);
    render(T1);
    render(null);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("does not report a timestamp twice after it drops back", () => {
    render(T1);
    render(T2);
    render(T1);
    render(T2);
    expect(onAdvance.mock.calls).toEqual([[T2]]);
  });

  it("counts the first timestamp after a null baseline as an advance", () => {
    render(null);
    expect(onAdvance).not.toHaveBeenCalled();
    render(T1);
    expect(onAdvance.mock.calls).toEqual([[T1]]);
  });
});
