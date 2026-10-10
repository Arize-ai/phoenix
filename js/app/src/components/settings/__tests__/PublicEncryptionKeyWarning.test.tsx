import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  createOperationDescriptor,
  Environment,
  getRequest,
  Network,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import PublicEncryptionKeyWarningQuery from "../__generated__/PublicEncryptionKeyWarningQuery.graphql";
import { PublicEncryptionKeyWarning } from "../PublicEncryptionKeyWarning";

installTestMatchMedia();

const WARNING = "Saved credentials are not protected";

function environmentFor(databaseEncryptionKeyIsPublic: boolean | null) {
  return new Environment({
    network: Network.create(() =>
      Promise.resolve({
        data: {
          serverStatus: { databaseEncryptionKeyIsPublic },
        },
      })
    ),
    store: new Store(new RecordSource()),
  });
}

function committedServerStatus(environment: Environment) {
  const operation = createOperationDescriptor(
    getRequest(PublicEncryptionKeyWarningQuery),
    {}
  );
  return environment.lookup(operation.fragment).data;
}

describe("PublicEncryptionKeyWarning", () => {
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

  async function render(environment: Environment) {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <RelayEnvironmentProvider environment={environment}>
            <PublicEncryptionKeyWarning />
          </RelayEnvironmentProvider>
        </ThemeProvider>
      );
    });
  }

  it("renders the warning when the encryption key is public", async () => {
    await render(environmentFor(true));
    expect(container.textContent).toContain(WARNING);
    expect(container.textContent).toContain("PHOENIX_SECRET is not set");
  });

  it.each([
    { value: false, name: "the encryption key is private" },
    { value: null, name: "the viewer is not told" },
  ])("renders nothing when $name", async ({ value }) => {
    const environment = environmentFor(value);
    await render(environment);
    // The Suspense fallback is also empty, so prove the query resolved first.
    expect(committedServerStatus(environment)).toEqual({
      serverStatus: { databaseEncryptionKeyIsPublic: value },
    });
    expect(container.textContent).not.toContain(WARNING);
  });
});
