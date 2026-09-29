import { act } from "react";
import { MenuSection } from "react-aria-components";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { useCodexModels } from "@phoenix/agent/codex/useCodexModels";
import { Button } from "@phoenix/components/core/button";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu/Menu";
import { AgentProvider } from "@phoenix/contexts/AgentContext";

const pendingFetches: Array<{
  resolve: (models: string[]) => void;
  reject: (error: Error) => void;
}> = [];

vi.mock("@phoenix/agent/codex/codexAuthApi", () => ({
  ensureFreshCodexAuth: (store: { getState: () => { codexAuth: unknown } }) =>
    Promise.resolve(store.getState().codexAuth),
  listCodexModels: vi.fn(
    () =>
      new Promise<string[]>((resolve, reject) => {
        pendingFetches.push({ resolve, reject });
      })
  ),
}));

function CodexSection() {
  const { models, isLoading, error } = useCodexModels();
  return (
    <MenuSection>
      <MenuSectionTitle title="ChatGPT subscription" />
      {models.map((modelName) => (
        <MenuItem key={modelName} id={`codex:${modelName}`}>
          {modelName}
        </MenuItem>
      ))}
      {models.length === 0 ? (
        <MenuItem id="codex:status" textValue="status" isDisabled>
          {isLoading ? "Loading models…" : (error ?? "No models available")}
        </MenuItem>
      ) : null}
    </MenuSection>
  );
}

let tokenCounter = 0;
// The module-level cache survives between tests, so each gets its own token.
const freshCodexAuth = () => ({
  accessToken: `access-token-${tokenCounter++}`,
  refreshToken: "refresh-token",
  idToken: null,
  accountId: "acct_123",
  expiresAt: null,
});

describe("useCodexModels", () => {
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
    pendingFetches.length = 0;
  });

  const renderMenu = async () => {
    await act(async () => {
      root.render(
        <AgentProvider codexAuth={freshCodexAuth()}>
          <MenuTrigger defaultOpen>
            <Button>Open</Button>
            <MenuContainer aria-label="Models">
              <Menu aria-label="Models">
                <CodexSection />
                <MenuItem id="other">claude-fable-5-1</MenuItem>
              </Menu>
            </MenuContainer>
          </MenuTrigger>
        </AgentProvider>
      );
    });
  };

  const menuText = () =>
    document.querySelector('[role="menu"]')?.textContent ?? "";

  it("replaces the loading item with the fetched models", async () => {
    await renderMenu();
    expect(menuText()).toContain("Loading models…");

    await act(async () => {
      pendingFetches[0].resolve(["gpt-5.5", "gpt-5.6-terra"]);
    });

    expect(menuText()).toContain("gpt-5.5");
    expect(menuText()).toContain("gpt-5.6-terra");
    expect(menuText()).not.toContain("Loading models…");
  });

  it("shows the failure message when the fetch rejects", async () => {
    await renderMenu();

    await act(async () => {
      pendingFetches[0].reject(new Error("ChatGPT session expired."));
    });

    expect(menuText()).toContain("ChatGPT session expired.");
    expect(menuText()).not.toContain("Loading models…");
  });
});
