import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import type { OperationDescriptor } from "relay-runtime";
import { createMockEnvironment } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PromptLabel } from "../PromptLabelPicker";
import { useSavePromptLabels } from "../PromptLabelPicker";

const PROMPT_ID = "UHJvbXB0OjU=";
const PRODUCTION: PromptLabel = {
  id: "label-production",
  name: "production",
  color: "#33c5e8",
};
const SQL: PromptLabel = { id: "label-sql", name: "sql", color: "#ff9b2e" };
const STAGING: PromptLabel = {
  id: "label-staging",
  name: "staging",
  color: "#e5484d",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * Saves `nextLabels` over `currentLabels` once, and returns the mutations
 * that sent, by operation name, with their label ids.
 */
function saveLabels({
  currentLabels,
  nextLabels,
}: {
  currentLabels: readonly PromptLabel[];
  nextLabels: readonly PromptLabel[];
}) {
  const environment = createMockEnvironment();
  function Harness() {
    const { savePromptLabels } = useSavePromptLabels({
      promptId: PROMPT_ID,
      currentLabels,
    });
    return (
      <button onClick={() => savePromptLabels(nextLabels)}>Save labels</button>
    );
  }
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <Harness />
      </RelayEnvironmentProvider>
    );
  });
  act(() => container.querySelector("button")!.click());
  return Object.fromEntries(
    environment.mock
      .getAllOperations()
      .map((operation: OperationDescriptor) => [
        operation.request.node.operation.name,
        operation.request.variables,
      ])
  );
}

describe("useSavePromptLabels", () => {
  it("sets only the labels that were added and unsets only those removed", () => {
    expect(
      saveLabels({
        currentLabels: [PRODUCTION, SQL],
        nextLabels: [SQL, STAGING],
      })
    ).toEqual({
      PromptLabelPickerSetLabelsMutation: {
        promptId: PROMPT_ID,
        promptLabelIds: [STAGING.id],
      },
      PromptLabelPickerUnsetLabelsMutation: {
        promptId: PROMPT_ID,
        promptLabelIds: [PRODUCTION.id],
      },
    });
  });

  it("sends only a set when labels were only added", () => {
    expect(
      saveLabels({ currentLabels: [SQL], nextLabels: [SQL, PRODUCTION] })
    ).toEqual({
      PromptLabelPickerSetLabelsMutation: {
        promptId: PROMPT_ID,
        promptLabelIds: [PRODUCTION.id],
      },
    });
  });

  it("sends nothing when the set is unchanged, whatever its order", () => {
    expect(
      saveLabels({
        currentLabels: [PRODUCTION, SQL],
        nextLabels: [SQL, PRODUCTION],
      })
    ).toEqual({});
  });
});
