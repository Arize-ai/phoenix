import { css } from "@emotion/react";
import { useEffect, useState } from "react";
import { Pressable } from "react-aria";

import {
  Alert,
  Button,
  CopyToClipboardButton,
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  RichTooltip,
  RichTooltipDescription,
  RichTooltipTitle,
  Text,
  TextField,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import type { CodexAuth } from "@phoenix/store/agentStore";

import {
  type CodexBrowserAuthorization,
  type CodexDeviceAuthorization,
  CodexAuthApiError,
  completeCodexBrowserAuthorization,
  parseCodexRedirect,
  pollCodexDeviceAuthorization,
  startCodexBrowserAuthorization,
  startCodexDeviceAuthorization,
} from "../../agent/codex/codexAuthApi";

const settingBodyCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-150);
`;

const stepListCSS = css`
  margin: 0;
  padding-left: var(--global-dimension-size-250);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
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

const infoTriggerCSS = css`
  display: inline-flex;
  align-items: center;
  cursor: default;
  color: var(--ac-global-text-color-500);
`;

/** How long the device flow waits before hinting that it may be disabled. */
const DEVICE_CODE_NUDGE_MS = 2 * 60 * 1000;

type Flow =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "browser"; authorization: CodexBrowserAuthorization }
  | { kind: "device_code"; start: CodexDeviceAuthorization; startedAt: number }
  | { kind: "error"; message: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * ChatGPT (Codex subscription) sign-in for the assistant. Experimental. The
 * token bundle is kept only in this browser's local storage.
 *
 * Two flows reach the same tokens. The browser flow (authorization code with
 * PKCE) works for every account. The device-code flow needs the account or
 * workspace to opt in, which Phoenix cannot detect, so both are offered.
 */
export function AgentCodexSettings() {
  const store = useAgentStore();
  const notifySuccess = useNotifySuccess();
  const codexAuth = useAgentContext((state) => state.codexAuth);
  const [flow, setFlow] = useState<Flow>({ kind: "idle" });

  const startBrowserFlow = async () => {
    setFlow({ kind: "starting" });
    try {
      setFlow({
        kind: "browser",
        authorization: await startCodexBrowserAuthorization(),
      });
    } catch (error) {
      setFlow({
        kind: "error",
        message: errorMessage(error, "Could not start the ChatGPT sign-in."),
      });
    }
  };

  const startDeviceCodeFlow = async () => {
    setFlow({ kind: "starting" });
    try {
      setFlow({
        kind: "device_code",
        start: await startCodexDeviceAuthorization(),
        startedAt: Date.now(),
      });
    } catch (error) {
      setFlow({
        kind: "error",
        message: errorMessage(
          error,
          "Could not start the device code sign-in."
        ),
      });
    }
  };

  const finish = (auth: CodexAuth) => {
    store.getState().setCodexAuth(auth);
    setFlow({ kind: "idle" });
    notifySuccess({
      title: "Signed in to ChatGPT",
      message:
        "ChatGPT subscription models are now available in the model menu.",
    });
  };

  const fail = (message: string) => setFlow({ kind: "error", message });

  const signOut = () => {
    store.getState().setCodexAuth(null);
    setFlow({ kind: "idle" });
    notifySuccess({
      title: "Signed out of ChatGPT",
      message: "The ChatGPT credentials were removed from this browser.",
    });
  };

  const isStarting = flow.kind === "starting";
  const isWaiting = flow.kind === "browser" || flow.kind === "device_code";

  return (
    <li>
      <div css={settingBodyCSS}>
        <Flex direction="column" gap="size-75">
          <Flex direction="row" alignItems="center" gap="size-100">
            <Icon svg={<Icons.Key />} />
            <Text weight="heavy" size="M">
              ChatGPT subscription
            </Text>
          </Flex>
          <Text color="text-500">
            Use your ChatGPT subscription for the assistant instead of an OpenAI
            API key.
          </Text>
        </Flex>
        {flow.kind === "browser" ? (
          <BrowserSignInPanel
            authorization={flow.authorization}
            onSignedIn={finish}
            onFailed={fail}
          />
        ) : null}
        {flow.kind === "device_code" ? (
          <DeviceCodeSignInPanel
            start={flow.start}
            startedAt={flow.startedAt}
            onSignedIn={finish}
            onFailed={fail}
          />
        ) : null}
        {flow.kind === "error" ? (
          <Alert variant="danger">{flow.message}</Alert>
        ) : null}
        <Flex
          direction="row"
          gap="size-100"
          justifyContent="end"
          alignItems="center"
          wrap
        >
          {codexAuth ? (
            <Button size="S" variant="danger" onPress={signOut}>
              Sign out
            </Button>
          ) : null}
          {isWaiting ? (
            <Button
              size="S"
              variant="default"
              onPress={() => setFlow({ kind: "idle" })}
            >
              Cancel
            </Button>
          ) : codexAuth ? null : (
            <>
              <DeviceCodeInfo />
              <Button
                size="S"
                variant="default"
                isDisabled={isStarting}
                onPress={() => void startDeviceCodeFlow()}
              >
                Sign in with Device Code
              </Button>
              <Button
                size="S"
                variant="primary"
                isDisabled={isStarting}
                onPress={() => void startBrowserFlow()}
              >
                Sign in with ChatGPT
              </Button>
            </>
          )}
        </Flex>
      </div>
    </li>
  );
}

function BrowserSignInPanel({
  authorization,
  onSignedIn,
  onFailed,
}: {
  authorization: CodexBrowserAuthorization;
  onSignedIn: (auth: CodexAuth) => void;
  onFailed: (message: string) => void;
}) {
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (code: string) => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      onSignedIn(
        await completeCodexBrowserAuthorization({ code, authorization })
      );
    } catch (error) {
      if (
        error instanceof CodexAuthApiError &&
        error.code === "invalid_grant"
      ) {
        onFailed(
          "This sign-in link has already been used or has expired. Start again."
        );
      } else {
        onFailed(errorMessage(error, "Sign-in failed. Try again."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (value: string) => {
    setPasted(value);
    if (!value.trim()) {
      setPasteError(null);
      return;
    }
    const parsed = parseCodexRedirect(value, authorization);
    if (parsed.ok) {
      setPasteError(null);
      void submit(parsed.code);
      return;
    }
    setPasteError(
      parsed.reason === "state_mismatch"
        ? "This link belongs to a different sign-in attempt. Start again."
        : parsed.reason === "missing_code"
          ? "That address has no authorization code. Copy the whole address from the localhost:1455 tab."
          : "That doesn't look like the ChatGPT redirect. Copy the whole address from the localhost:1455 tab."
    );
  };

  return (
    <Flex direction="column" gap="size-100">
      <ol css={stepListCSS}>
        <li>
          <Flex direction="column" alignItems="start" gap="size-50">
            <Text>Sign in to ChatGPT in a new tab.</Text>
            <ExternalLinkButton
              href={authorization.authorization_url}
              size="S"
              variant="primary"
              leadingVisual={<Icon svg={<Icons.ExternalLink />} />}
            >
              Open ChatGPT sign-in
            </ExternalLinkButton>
          </Flex>
        </li>
        <li>
          <Text>
            After signing in, that tab lands on a <code>localhost:1455</code>{" "}
            page that cannot load. That is expected: OpenAI&rsquo;s Codex client
            only redirects to the local Codex CLI. Copy the full address from
            its address bar and paste it here.
          </Text>
        </li>
      </ol>
      <TextField
        value={pasted}
        onChange={handleChange}
        isInvalid={pasteError != null}
        isDisabled={isSubmitting}
        autoFocus
      >
        <Label>Redirect address</Label>
        <Input
          placeholder="http://localhost:1455/auth/callback?code=…"
          autoComplete="off"
          spellCheck={false}
        />
        <Text slot="description" color={pasteError ? "danger" : "text-500"}>
          {isSubmitting
            ? "Completing sign-in…"
            : (pasteError ??
              "Sign-in completes as soon as a valid address is pasted.")}
        </Text>
      </TextField>
    </Flex>
  );
}

function DeviceCodeSignInPanel({
  start,
  startedAt,
  onSignedIn,
  onFailed,
}: {
  start: CodexDeviceAuthorization;
  startedAt: number;
  onSignedIn: (auth: CodexAuth) => void;
  onFailed: (message: string) => void;
}) {
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    const expiresAt = startedAt + start.expires_in * 1000;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) {
        return;
      }
      if (Date.now() > expiresAt) {
        onFailed("The sign-in code expired. Start again to get a new one.");
        return;
      }
      try {
        const auth = await pollCodexDeviceAuthorization(start.device_code);
        if (cancelled) {
          return;
        }
        if (auth) {
          onSignedIn(auth);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          onFailed(errorMessage(error, "Sign-in failed. Try again."));
        }
        return;
      }
      setShowNudge(Date.now() - startedAt > DEVICE_CODE_NUDGE_MS);
      timer = setTimeout(tick, Math.max(1, start.interval) * 1000);
    };
    timer = setTimeout(tick, Math.max(1, start.interval) * 1000);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [start, startedAt, onSignedIn, onFailed]);

  return (
    <Flex direction="column" gap="size-100">
      <ol css={stepListCSS}>
        <li>
          <Flex direction="column" alignItems="start" gap="size-50">
            <Text>Copy this code.</Text>
            <Flex direction="row" alignItems="center" gap="size-100">
              <span css={userCodeCSS}>{start.user_code}</span>
              <CopyToClipboardButton text={start.user_code} size="S" />
            </Flex>
          </Flex>
        </li>
        <li>
          <Flex direction="column" alignItems="start" gap="size-50">
            <Text>Open the ChatGPT device page and enter the code.</Text>
            <ExternalLinkButton
              href={start.verification_uri}
              size="S"
              variant="primary"
              leadingVisual={<Icon svg={<Icons.ExternalLink />} />}
            >
              Open ChatGPT device page
            </ExternalLinkButton>
          </Flex>
        </li>
        <li>
          <Text>Return here. Sign-in completes automatically.</Text>
        </li>
      </ol>
      {showNudge ? (
        <Alert variant="warning">
          Still waiting. If ChatGPT asked you to contact your workspace admin,
          device code sign-in is turned off for your account. Cancel and use
          &ldquo;Sign in with ChatGPT&rdquo; instead.
        </Alert>
      ) : null}
    </Flex>
  );
}

function DeviceCodeInfo() {
  return (
    <TooltipTrigger delay={0}>
      <Pressable>
        <span
          role="button"
          tabIndex={0}
          css={infoTriggerCSS}
          aria-label="About device code sign-in"
        >
          <Icon svg={<Icons.Info />} />
        </span>
      </Pressable>
      <RichTooltip>
        <TooltipArrow />
        <RichTooltipTitle>Sign-in Options</RichTooltipTitle>
        <RichTooltipDescription>
          <Flex direction="column" gap="size-75">
            <Text size="XS">
              Device codes provide a smoother login experience, but require
              configuration inside ChatGPT.
            </Text>
            <Text size="XS">
              <strong>For personal accounts:</strong> ChatGPT → Settings →
              Security → “Device code authorization for Codex”.
            </Text>
            <Text size="XS">
              <strong>For team, enterprise, edu accounts:</strong> a workspace
              admin turns on “Allow device code login” under Workspace settings
              → Permissions.
            </Text>
          </Flex>
        </RichTooltipDescription>
      </RichTooltip>
    </TooltipTrigger>
  );
}
