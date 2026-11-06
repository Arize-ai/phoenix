import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emitAgentDataChange, type AgentDataChange } from "../agentDataChanges";
import { useAgentDataChangeFetchKey } from "../useAgentDataChangeFetchKey";

const DATASET_CHANGES = ["datasets", "datasetLabels"] as const;
const SPLIT_CHANGES = ["datasetSplits"] as const;

function FetchKeyProbe({
  entities,
}: {
  entities: readonly AgentDataChange["entity"][];
}) {
  const fetchKey = useAgentDataChangeFetchKey(entities);
  return <output>{fetchKey}</output>;
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
  act(() => root.unmount());
  container.remove();
});

describe("useAgentDataChangeFetchKey", () => {
  it("advances only for watched changes and updates its subscription", () => {
    act(() => root.render(<FetchKeyProbe entities={DATASET_CHANGES} />));
    expect(container.textContent).toBe("0");

    act(() => emitAgentDataChange({ entity: "datasetSplits" }));
    expect(container.textContent).toBe("0");

    act(() => emitAgentDataChange({ entity: "datasets" }));
    act(() => emitAgentDataChange({ entity: "datasetLabels" }));
    expect(container.textContent).toBe("2");

    act(() => root.render(<FetchKeyProbe entities={SPLIT_CHANGES} />));
    act(() => emitAgentDataChange({ entity: "datasets" }));
    expect(container.textContent).toBe("2");

    act(() => emitAgentDataChange({ entity: "datasetSplits" }));
    expect(container.textContent).toBe("3");
  });
});
