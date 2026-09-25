import { css } from "@emotion/react";
import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  ExternalLink,
  Flex,
  Icon,
  Icons,
  Text,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

import {
  type CodexDeviceAuthStart,
  pollCodexDeviceAuth,
  startCodexDeviceAuth,
} from "../../agent/codex/codexAuthApi";

const settingBodyCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-150);
`;

const userCodeCSS = css`
  font-family: var(--ac-global-font-family-code, monospace);
  font-size: var(--ac-global-font-size-xl, 1.5rem);
  letter-spacing: 0.15em;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border: 1px solid var(--ac-global-border-color-default);
  border-radius: var(--ac-global-rounding-small);
  background-color: var(--ac-global-background-color-light);
  user-select: all;
`;

type DeviceFlowState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "waiting"; start: CodexDeviceAuthStart; startedAt: number }
  | { status: "error"; message: string };

/**
 * ChatGPT (Codex subscription) sign-in for the assistant, via the OAuth
 * device-code flow of the public Codex client. Experimental. The token bundle
 * is kept only in this browser's local storage.
 */
export function AgentCodexSettings() {
  const store = useAgentStore();
  const notifySuccess = useNotifySuccess();
  const codexAuth = useAgentContext((state) => state.codexAuth);
  const [flow, setFlow] = useState<DeviceFlowState>({ status: "idle" });

  useEffect(() => {
    if (flow.status !== "waiting") {
      return () => {};
    }
    const { start, startedAt } = flow;
    const expiresAt = startedAt + (start.expiresInSeconds ?? 15 * 60) * 1000;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) {
        return;
      }
      if (Date.now() > expiresAt) {
        setFlow({
          status: "error",
          message: "The sign-in code expired. Start again to get a new one.",
        });
        return;
      }
      try {
        const auth = await pollCodexDeviceAuth({
          deviceAuthId: start.deviceAuthId,
          userCode: start.userCode,
        });
        if (cancelled) {
          return;
        }
        if (auth) {
          store.getState().setCodexAuth(auth);
          setFlow({ status: "idle" });
          notifySuccess({
            title: "Signed in to ChatGPT",
            message:
              "ChatGPT subscription models are now available in the model menu.",
          });
          return;
        }
      } catch (error) {
        if (!cancelled) {
          setFlow({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Sign-in failed. Try again.",
          });
        }
        return;
      }
      timer = setTimeout(tick, Math.max(1, start.intervalSeconds) * 1000);
    };
    timer = setTimeout(tick, Math.max(1, start.intervalSeconds) * 1000);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [flow, notifySuccess, store]);

  const startFlow = async () => {
    setFlow({ status: "starting" });
    try {
      const start = await startCodexDeviceAuth();
      setFlow({ status: "waiting", start, startedAt: Date.now() });
      window.open(start.verificationUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setFlow({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not start the ChatGPT sign-in.",
      });
    }
  };

  const signOut = () => {
    store.getState().setCodexAuth(null);
    setFlow({ status: "idle" });
    notifySuccess({
      title: "Signed out of ChatGPT",
      message: "The ChatGPT credentials were removed from this browser.",
    });
  };

  return (
    <li>
      <div css={settingBodyCSS}>
        <Flex direction="column" gap="size-75">
          <Flex direction="row" alignItems="center" gap="size-100">
            <Icon svg={<Icons.Key />} />
            <Text weight="heavy" size="M">
              ChatGPT subscription (experimental)
            </Text>
          </Flex>
          <Text color="text-500">
            Use your ChatGPT Plus/Pro/Team subscription for the assistant
            instead of an OpenAI API key. Signing in uses the same device-code
            flow as the Codex CLI. Credentials are stored only in this browser
            and never saved on the server.
          </Text>
          <Text color="text-500" size="S">
            {codexAuth
              ? `Signed in (account ${codexAuth.accountId}).`
              : "Not signed in."}
          </Text>
        </Flex>
        {flow.status === "waiting" ? (
          <Flex direction="column" gap="size-100">
            <Text>
              Enter this code at{" "}
              <ExternalLink href={flow.start.verificationUrl}>
                {flow.start.verificationUrl}
              </ExternalLink>
              , then return here. Waiting for sign-in…
            </Text>
            <div>
              <span css={userCodeCSS}>{flow.start.userCode}</span>
            </div>
            <Text color="text-500" size="S">
              Your ChatGPT account must have &ldquo;Enable device code
              authorization for Codex&rdquo; turned on in its security settings.
            </Text>
          </Flex>
        ) : null}
        {flow.status === "error" ? (
          <Alert variant="danger">{flow.message}</Alert>
        ) : null}
        <Flex direction="row" gap="size-100" justifyContent="end">
          {codexAuth ? (
            <Button size="S" variant="danger" onPress={signOut}>
              Sign out
            </Button>
          ) : null}
          {flow.status === "waiting" ? (
            <Button
              size="S"
              variant="default"
              onPress={() => setFlow({ status: "idle" })}
            >
              Cancel
            </Button>
          ) : (
            <Button
              size="S"
              variant={codexAuth ? "default" : "primary"}
              isDisabled={flow.status === "starting"}
              onPress={() => void startFlow()}
            >
              {codexAuth ? "Sign in again" : "Sign in with ChatGPT"}
            </Button>
          )}
        </Flex>
      </div>
    </li>
  );
}
