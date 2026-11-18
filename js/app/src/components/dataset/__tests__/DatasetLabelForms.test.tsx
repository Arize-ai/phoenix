import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter } from "react-router";
import type { OperationDescriptor } from "relay-runtime";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { ThemeProvider } from "@phoenix/contexts";

import { CreateDatasetForm } from "../CreateDatasetForm";
import type { DatasetLabel } from "../DatasetLabelPicker";
import { EditDatasetForm } from "../EditDatasetForm";

installTestMatchMedia();
installTestStorage();

const DATASET_ID = "RGF0YXNldDox";
const PRODUCTION: DatasetLabel = {
  id: "RGF0YXNldExhYmVsOjE=",
  name: "production",
  color: "#33c5e8",
};
const BANKING: DatasetLabel = {
  id: "RGF0YXNldExhYmVsOjI=",
  name: "banking",
  color: "#ff9b2e",
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

function operationName(operation: OperationDescriptor) {
  return operation.request.node.operation.name;
}

/**
 * A store-backed environment that answers the picker's label list at once
 * and leaves every mutation pending for the test to settle.
 */
function renderWithRelay(element: ReactNode) {
  const environment = createMockEnvironment();
  environment.mock.queueOperationResolver((operation) =>
    operationName(operation) === "DatasetLabelPickerQuery"
      ? MockPayloadGenerator.generate(operation, {
          DatasetLabelConnection: () => ({
            edges: [PRODUCTION, BANKING].map((label) => ({ node: label })),
          }),
        })
      : null
  );
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <MemoryRouter>
          <ThemeProvider themeMode="light">{element}</ThemeProvider>
        </MemoryRouter>
      </RelayEnvironmentProvider>
    );
  });
  return environment;
}

function pendingOperationNames(
  environment: ReturnType<typeof createMockEnvironment>
) {
  return environment.mock.getAllOperations().map(operationName);
}

function getByText<T extends HTMLElement>({
  selector,
  text,
}: {
  selector: string;
  text: string;
}): T {
  const element = Array.from(document.querySelectorAll<T>(selector)).find(
    (candidate) =>
      candidate.textContent?.trim() === text ||
      candidate.getAttribute("aria-label") === text
  );
  if (!element) {
    throw new Error(`Expected a ${selector} named "${text}"`);
  }
  return element;
}

async function click(element: HTMLElement) {
  await act(async () => userEvent.click(element));
}

async function checkLabel(name: string) {
  await click(getByText({ selector: "button", text: "Add label" }));
  await click(getByText({ selector: "[role='menuitemcheckbox']", text: name }));
}

function resolveMutation({
  environment,
  name,
}: {
  environment: ReturnType<typeof createMockEnvironment>;
  name: string;
}) {
  return act(async () => {
    const operation = environment.mock
      .getAllOperations()
      .find((candidate) => operationName(candidate) === name);
    if (!operation) {
      throw new Error(`Expected a pending ${name}`);
    }
    environment.mock.resolve(
      operation,
      MockPayloadGenerator.generate(operation, {
        Dataset: () => ({ id: DATASET_ID, name: "golden-set" }),
      })
    );
  });
}

function rejectMutation({
  environment,
  name,
}: {
  environment: ReturnType<typeof createMockEnvironment>;
  name: string;
}) {
  return act(async () => {
    const operation = environment.mock
      .getAllOperations()
      .find((candidate) => operationName(candidate) === name);
    if (!operation) {
      throw new Error(`Expected a pending ${name}`);
    }
    environment.mock.reject(
      operation,
      new Error("One or more dataset labels not found")
    );
  });
}

describe("CreateDatasetForm labels", () => {
  async function submitWithLabel() {
    const onDatasetCreated = vi.fn();
    const environment = renderWithRelay(
      <CreateDatasetForm onDatasetCreated={onDatasetCreated} />
    );
    await checkLabel("banking");
    await click(getByText({ selector: "button", text: "Create Dataset" }));
    await resolveMutation({ environment, name: "CreateDatasetFormMutation" });
    return { environment, onDatasetCreated };
  }

  it("hands off the new dataset only once its labels are attached", async () => {
    const { environment, onDatasetCreated } = await submitWithLabel();
    const setLabels = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operationName(operation) === "DatasetLabelPickerSetLabelsMutation"
      );
    expect(setLabels?.request.variables).toEqual({
      datasetId: DATASET_ID,
      datasetLabelIds: [BANKING.id],
    });
    expect(onDatasetCreated).not.toHaveBeenCalled();

    await resolveMutation({
      environment,
      name: "DatasetLabelPickerSetLabelsMutation",
    });
    expect(onDatasetCreated).toHaveBeenCalledTimes(1);
    expect(onDatasetCreated.mock.calls[0][0]).toMatchObject({
      id: DATASET_ID,
    });
  });

  it("says the dataset was created without its labels and never creates it again", async () => {
    const { environment, onDatasetCreated } = await submitWithLabel();
    await rejectMutation({
      environment,
      name: "DatasetLabelPickerSetLabelsMutation",
    });

    expect(onDatasetCreated).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Labels not attached");
    expect(container.textContent).toContain(
      "One or more dataset labels not found"
    );
    // the form, and its submit button, are gone
    expect(container.querySelector("form")).toBeNull();

    await click(getByText({ selector: "button", text: "Continue" }));
    expect(onDatasetCreated).toHaveBeenCalledTimes(1);
    expect(pendingOperationNames(environment)).not.toContain(
      "CreateDatasetFormMutation"
    );
  });
});

describe("EditDatasetForm labels", () => {
  function renderEditForm(onDatasetEdited = vi.fn()) {
    const environment = renderWithRelay(
      <EditDatasetForm
        datasetId={DATASET_ID}
        datasetName="golden-set"
        datasetLabels={[PRODUCTION, BANKING]}
        onDatasetEdited={onDatasetEdited}
      />
    );
    return { environment, onDatasetEdited };
  }

  it("keeps the dialog's form open with the reason when the labels do not save", async () => {
    const { environment, onDatasetEdited } = renderEditForm();
    await click(getByText({ selector: "button", text: "Remove production" }));
    await click(getByText({ selector: "button", text: "Save" }));
    await resolveMutation({ environment, name: "EditDatasetFormMutation" });
    await rejectMutation({
      environment,
      name: "DatasetLabelPickerSetLabelsMutation",
    });

    expect(onDatasetEdited).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "The labels were not saved: One or more dataset labels not found"
    );
    expect(container.querySelector("form")).not.toBeNull();
  });
});
