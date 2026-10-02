import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

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

function renderWarning(databaseEncryptionKeyIsPublic: boolean | null) {
  return (
    <ThemeProvider themeMode="light" disableBodyTheme>
      <RelayEnvironmentProvider
        environment={environmentFor(databaseEncryptionKeyIsPublic)}
      >
        <PublicEncryptionKeyWarning />
      </RelayEnvironmentProvider>
    </ThemeProvider>
  );
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

  async function render(node: ReactNode) {
    await act(async () => {
      root.render(node);
    });
  }

  it("renders the warning when the encryption key is public", async () => {
    await render(renderWarning(true));
    expect(container.textContent).toContain(WARNING);
    expect(container.textContent).toContain("PHOENIX_SECRET is not set");
  });

  it("renders nothing when the encryption key is private", async () => {
    await render(renderWarning(false));
    expect(container.textContent).not.toContain(WARNING);
  });

  it("renders nothing when the viewer is not told", async () => {
    await render(renderWarning(null));
    expect(container.textContent).not.toContain(WARNING);
  });
});
