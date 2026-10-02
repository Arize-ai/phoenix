import { render } from "ink-testing-library";
import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { PxiApp, type PxiCodexAuthClient } from "../src/pxi/App";
import type {
  CodexAuthFile,
  CodexBrowserAuthorization,
} from "../src/pxi/codexAuth";
import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import type { PxiChatClient } from "../src/pxi/types";

// oxlint-disable-next-line no-control-regex -- terminal escape sequences
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const ESCAPE = "\u001b";
const DOWN_ARROW = "\u001b[B";

/** The frame as plain text with wrapped lines rejoined. */
function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "").replace(/\s+/g, " ");
}

function encodeJwt(payload: Record<string, unknown>): string {
  const segment = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${segment}.signature`;
}

const SIGNED_IN: CodexAuthFile = {
  auth_mode: "chatgpt",
  OPENAI_API_KEY: null,
  tokens: {
    id_token: encodeJwt({ email: "user@example.com" }),
    access_token: encodeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    refresh_token: "refresh-1",
    account_id: "acct-1",
  },
  last_refresh: new Date().toISOString(),
};

const BROWSER_AUTHORIZATION: CodexBrowserAuthorization = {
  authorization_url: "https://auth.openai.com/oauth/authorize?client_id=app",
  state: "state-1",
  code_verifier: "verifier-1",
  redirect_uri: "http://localhost:1455/auth/callback",
};

const AUTHORIZATION = {
  device_code: "device-1",
  user_code: "ABCD-EFGH",
  verification_uri: "https://auth.openai.com/codex/device",
  expires_in: 900,
  interval: 5,
};

/**
 * An in-memory sign-in store whose device grant resolves when the test calls
 * `approve`, so the panel can be observed mid-flow.
 */
function createFakeCodexAuthClient({
  stored = null,
}: { stored?: CodexAuthFile | null } = {}) {
  let auth = stored;
  let approve: ((auth: CodexAuthFile | null) => void) | null = null;
  const client: PxiCodexAuthClient = {
    load: () => auth,
    save: (next) => {
      auth = next;
    },
    clear: () => {
      auth = null;
    },
    ensureFresh: async () => auth,
    startBrowserAuthorization: vi.fn(async () => BROWSER_AUTHORIZATION),
    completeBrowserAuthorization: vi.fn(
      ({ signal }) =>
        new Promise<CodexAuthFile | null>((resolve) => {
          approve = resolve;
          signal.addEventListener("abort", () => resolve(null));
        })
    ),
    startDeviceAuthorization: vi.fn(async () => AUTHORIZATION),
    waitForDeviceAuthorization: vi.fn(
      ({ signal }) =>
        new Promise<CodexAuthFile | null>((resolve) => {
          approve = resolve;
          signal.addEventListener("abort", () => resolve(null));
        })
    ),
    listModels: vi.fn(async () => ["gpt-5.4", "gpt-5.4-codex"]),
    openBrowser: vi.fn(async () => {}),
  };
  return {
    client,
    approve: (next: CodexAuthFile) => approve?.(next),
    getStored: () => auth,
  };
}

function createOptions() {
  return resolvePxiRuntimeOptions({
    cliOptions: {
      endpoint: "http://localhost:6006",
      provider: "OPENAI",
      model: "gpt-5.4",
    },
    sessionId: "session-1",
  });
}

const idleClient: PxiChatClient = { sendMessage: async () => null };

async function writeInput({
  stdin,
  input,
}: {
  stdin: { write: (input: string) => unknown };
  input: string;
}) {
  await act(async () => {
    stdin.write(input);
  });
}

async function settle() {
  await act(async () => Promise.resolve());
  await act(async () => Promise.resolve());
}

async function flushPendingEscapeInput() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe("PXI /login and /logout", () => {
  it("offers browser and device-code sign-in without opening anything", async () => {
    const fake = createFakeCodexAuthClient();
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
      />
    );

    await writeInput({ stdin, input: "/login" });
    await writeInput({ stdin, input: "\r" });
    await settle();

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Sign in with ChatGPT (Codex)");
    expect(frame).toContain("› Sign in with browser");
    expect(frame).toContain("Sign in with device code");
    expect(fake.client.openBrowser).not.toHaveBeenCalled();
    expect(fake.client.startBrowserAuthorization).not.toHaveBeenCalled();
    expect(fake.client.startDeviceAuthorization).not.toHaveBeenCalled();
    unmount();
  });

  it("runs the browser sign-in and stores the result", async () => {
    const fake = createFakeCodexAuthClient();
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
      />
    );

    await writeInput({ stdin, input: "/login" });
    await writeInput({ stdin, input: "\r" });
    await settle();
    await writeInput({ stdin, input: "\r" });
    await settle();

    let frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("A browser window should open");
    expect(frame).toContain(BROWSER_AUTHORIZATION.authorization_url);
    // The URL is an OSC 8 hyperlink so it stays clickable when it wraps.
    expect(lastFrame()).toContain(
      `\u001B]8;;${BROWSER_AUTHORIZATION.authorization_url}\u0007`
    );
    expect(fake.client.openBrowser).toHaveBeenCalledWith(
      BROWSER_AUTHORIZATION.authorization_url
    );
    expect(fake.client.completeBrowserAuthorization).toHaveBeenCalledOnce();

    await act(async () => {
      fake.approve(SIGNED_IN);
      await Promise.resolve();
    });
    await settle();

    frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Signed in to ChatGPT (Codex) as user@example.com");
    expect(fake.getStored()).toEqual(SIGNED_IN);
    unmount();
  });

  it("runs the device-code sign-in and stores the result", async () => {
    const fake = createFakeCodexAuthClient();
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
      />
    );

    await writeInput({ stdin, input: "/login" });
    await writeInput({ stdin, input: "\r" });
    await settle();
    await writeInput({ stdin, input: DOWN_ARROW });
    await settle();
    await writeInput({ stdin, input: "\r" });
    await settle();

    let frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("ABCD-EFGH");
    expect(frame).toContain("https://auth.openai.com/codex/device");
    expect(frame).toContain("Waiting for approval");
    expect(fake.client.openBrowser).not.toHaveBeenCalled();

    await act(async () => {
      fake.approve(SIGNED_IN);
      await Promise.resolve();
    });
    await settle();

    frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Signed in to ChatGPT (Codex) as user@example.com");
    expect(frame).toContain("chatgpt: user@example.com");
    expect(fake.getStored()).toEqual(SIGNED_IN);
    unmount();
  });

  it("cancels the pending sign-in on escape", async () => {
    const fake = createFakeCodexAuthClient();
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
      />
    );

    await writeInput({ stdin, input: "/login" });
    await writeInput({ stdin, input: "\r" });
    await settle();
    await writeInput({ stdin, input: DOWN_ARROW });
    await writeInput({ stdin, input: "\r" });
    await settle();
    expect(stripAnsi(lastFrame() ?? "")).toContain("ABCD-EFGH");

    await writeInput({ stdin, input: ESCAPE });
    await flushPendingEscapeInput();
    await settle();

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).not.toContain("ABCD-EFGH");
    expect(frame).not.toContain("Signed in");
    expect(fake.getStored()).toBeNull();
    unmount();
  });

  it("shows the account when already signed in", async () => {
    const fake = createFakeCodexAuthClient({ stored: SIGNED_IN });
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
      />
    );

    await writeInput({ stdin, input: "/login" });
    await writeInput({ stdin, input: "\r" });
    await settle();

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Signed in as user@example.com");
    expect(frame).toContain("r re-authenticate");
    expect(fake.client.startDeviceAuthorization).not.toHaveBeenCalled();
    unmount();
  });

  it("signs out after confirmation", async () => {
    const fake = createFakeCodexAuthClient({ stored: SIGNED_IN });
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
      />
    );
    expect(stripAnsi(lastFrame() ?? "")).toContain("chatgpt: user@example.com");

    await writeInput({ stdin, input: "/logout" });
    await writeInput({ stdin, input: "\r" });
    await settle();
    let frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Sign out of ChatGPT (Codex) as user@example.com?");

    await writeInput({ stdin, input: "n" });
    await settle();
    expect(fake.getStored()).toEqual(SIGNED_IN);

    await writeInput({ stdin, input: "/logout" });
    await writeInput({ stdin, input: "\r" });
    await settle();
    await writeInput({ stdin, input: "y" });
    await settle();

    frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Signed out of ChatGPT (Codex).");
    expect(frame).not.toContain("chatgpt: user@example.com");
    expect(fake.getStored()).toBeNull();
    unmount();
  });

  it("tells the user when there is nothing to sign out of", async () => {
    const fake = createFakeCodexAuthClient();
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
      />
    );

    await writeInput({ stdin, input: "/logout" });
    await writeInput({ stdin, input: "\r" });
    await settle();

    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "Not signed in to ChatGPT (Codex)."
    );
    unmount();
  });

  it("lists the subscription's models in the picker when signed in", async () => {
    const fake = createFakeCodexAuthClient({ stored: SIGNED_IN });
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
        modelLoader={undefined}
        sessionClient={{
          createSession: vi.fn(),
          listSessions: vi.fn(async () => []),
          getSession: vi.fn(),
          getSessionSyncState: vi.fn(),
          patchSessionModel: vi.fn(),
          compactSession: vi.fn(),
        }}
      />
    );
    // The recommended-model fetch hits the network; stub it out so only the
    // Codex listing contributes entries.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            modelProviders: [],
            playgroundModels: [
              { providerKey: "OPENAI", name: "gpt-5.4" },
              { providerKey: "ANTHROPIC", name: "claude-opus-5" },
            ],
            generativeModelCustomProviders: { edges: [] },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await writeInput({ stdin, input: "/model" });
    await writeInput({ stdin, input: "\r" });
    await settle();
    await settle();

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("CODEX/gpt-5.4");
    expect(frame).toContain("CODEX/gpt-5.4-codex");
    expect(frame).not.toContain("Sign in with /login");
    // Provider order: ANTHROPIC, then CODEX, then the rest. Scoped to the
    // picker, since the header also names the active OPENAI model.
    const picker = frame.slice(frame.indexOf("Recommended models"));
    expect(picker.indexOf("ANTHROPIC/claude-opus-5")).toBeLessThan(
      picker.indexOf("CODEX/gpt-5.4")
    );
    expect(picker.indexOf("CODEX/gpt-5.4-codex")).toBeLessThan(
      picker.indexOf("OPENAI/gpt-5.4")
    );
    fetchSpy.mockRestore();
    unmount();
  });

  it("points a signed-out user at /login from the picker", async () => {
    const fake = createFakeCodexAuthClient();
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={idleClient}
        codexAuthClient={fake.client}
        modelLoader={async () => [
          { providerType: "builtin", provider: "OPENAI", modelName: "gpt-5.4" },
        ]}
      />
    );

    await writeInput({ stdin, input: "/model" });
    await writeInput({ stdin, input: "\r" });
    await settle();

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("OPENAI/gpt-5.4");
    expect(frame).toContain("Sign in with /login");
    expect(fake.client.listModels).not.toHaveBeenCalled();
    unmount();
  });
});
