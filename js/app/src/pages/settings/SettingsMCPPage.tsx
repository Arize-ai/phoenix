import { css } from "@emotion/react";

import {
  Alert,
  Badge,
  Card,
  CopyField,
  CopyInput,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  ExternalLink,
  Flex,
  Heading,
  Icon,
  Icons,
  Label,
  Text,
  View,
} from "@phoenix/components";
import {
  BashBlockWithCopy,
  JSONBlockWithCopy,
  TomlBlockWithCopy,
} from "@phoenix/components/code";
import {
  AntigravitySVG,
  ClaudeSVG,
  CursorSVG,
  McpSVG,
  OpenAISVG,
  OpenCodeSVG,
  VSCodeSVG,
} from "@phoenix/components/project/IntegrationIcons";
import { BASE_URL } from "@phoenix/config";
import { PHOENIX_DOCUMENTATION_LINKS } from "@phoenix/constants";

const statusItemCSS = css`
  white-space: nowrap;
`;

/**
 * A compact enabled/disabled indicator shown in the card header so the state
 * of the deployment is legible before reading any setup instructions.
 */
function StatusItem({
  isEnabled,
  label,
}: {
  isEnabled: boolean;
  label: string;
}) {
  return (
    <Flex direction="row" alignItems="center" gap="size-50" css={statusItemCSS}>
      <Icon
        svg={
          isEnabled ? <Icons.CheckmarkCircleFilled /> : <Icons.MinusCircle />
        }
        color={isEnabled ? "success" : "gray-500"}
        aria-hidden
      />
      <Text size="S" color="text-700">
        {`${label}: ${isEnabled ? "enabled" : "disabled"}`}
      </Text>
    </Flex>
  );
}

const sectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

// The disclosure panel renders flush by default; indent its content to align
// with the trigger label and give it breathing room.
const panelContentCSS = css`
  padding: var(--global-dimension-size-200);
`;

const mcpUrl = `${BASE_URL}/mcp`;

const cursorConfig = JSON.stringify(
  { mcpServers: { phoenix: { url: mcpUrl } } },
  null,
  2
);
const vsCodeConfig = JSON.stringify(
  { servers: { phoenix: { type: "http", url: mcpUrl } } },
  null,
  2
);
// Mirrors the fragment the px CLI writes via `px setup mcp --agent opencode`.
const opencodeConfig = JSON.stringify(
  {
    $schema: "https://opencode.ai/config.json",
    mcp: { phoenix: { type: "remote", url: mcpUrl, enabled: true } },
  },
  null,
  2
);
const apiKeyConfig = JSON.stringify(
  {
    mcpServers: {
      phoenix: {
        url: mcpUrl,
        headers: { Authorization: "Bearer <your-api-key>" },
      },
    },
  },
  null,
  2
);

// One entry per MCP client rendered in the "Connect a client" disclosure
// group. The copy differs by deployment: with auth enabled each client walks
// through its login flow; without auth the URL alone is a complete config.
function getClients({ isAuthEnabled }: { isAuthEnabled: boolean }) {
  const codexConfig = [
    "[mcp_servers.phoenix]",
    `url = "${mcpUrl}"`,
    ...(isAuthEnabled ? ['bearer_token_env_var = "PHOENIX_API_KEY"'] : []),
  ].join("\n");
  // Antigravity has no OAuth flow for third-party MCP servers — remote servers
  // use `serverUrl` plus a Bearer header when the deployment requires auth.
  const antigravityConfig = JSON.stringify(
    {
      mcpServers: {
        phoenix: {
          serverUrl: mcpUrl,
          ...(isAuthEnabled
            ? { headers: { Authorization: "Bearer <your-api-key>" } }
            : {}),
        },
      },
    },
    null,
    2
  );
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      icon: <ClaudeSVG />,
      content: (
        <>
          <BashBlockWithCopy
            value={`claude mcp add --transport http phoenix ${mcpUrl}`}
          />
          <Text size="S" color="text-700">
            {isAuthEnabled
              ? "Then run /mcp inside Claude Code, select phoenix, and complete the browser login."
              : "Then run /mcp inside Claude Code and select phoenix to verify the connection."}
          </Text>
        </>
      ),
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      icon: <ClaudeSVG />,
      content: (
        <>
          <Text size="S" color="text-700">
            Go to Settings → Connectors → Add custom connector and enter the
            name Phoenix with the URL below.
            {isAuthEnabled &&
              " Claude Desktop opens the browser login the first time you use the connector."}
          </Text>
          <CopyField value={mcpUrl} aria-label="Phoenix MCP URL">
            <CopyInput />
          </CopyField>
        </>
      ),
    },
    {
      id: "antigravity",
      label: "Antigravity",
      icon: <AntigravitySVG />,
      content: (
        <>
          <Text size="S" color="text-700">
            {isAuthEnabled
              ? "Antigravity authenticates with an API key. Create a Phoenix API key and add to ~/.gemini/config/mcp_config.json:"
              : "Add to ~/.gemini/config/mcp_config.json:"}
          </Text>
          <JSONBlockWithCopy value={antigravityConfig} />
          <Text size="S" color="text-700">
            Antigravity reloads the config automatically when you save.
          </Text>
        </>
      ),
    },
    {
      id: "codex",
      label: "Codex",
      icon: <OpenAISVG />,
      content: (
        <>
          <Text size="S" color="text-700">
            {isAuthEnabled
              ? "Codex authenticates with an API key. Create a Phoenix API key, export it as PHOENIX_API_KEY, and add to ~/.codex/config.toml:"
              : "Add to ~/.codex/config.toml:"}
          </Text>
          <TomlBlockWithCopy value={codexConfig} />
        </>
      ),
    },
    {
      id: "cursor",
      label: "Cursor",
      icon: <CursorSVG />,
      content: (
        <>
          <Text size="S" color="text-700">
            Add to ~/.cursor/mcp.json (or the project&apos;s .cursor/mcp.json).
            {isAuthEnabled &&
              " Cursor prompts you to log in via the browser on first use."}
          </Text>
          <JSONBlockWithCopy value={cursorConfig} />
        </>
      ),
    },
    {
      id: "opencode",
      label: "OpenCode",
      icon: <OpenCodeSVG />,
      content: (
        <>
          <Text size="S" color="text-700">
            Add to ~/.config/opencode/opencode.json (or the project&apos;s
            opencode.json).
            {isAuthEnabled &&
              " OpenCode prompts you to log in via the browser on first use."}
          </Text>
          <JSONBlockWithCopy value={opencodeConfig} />
        </>
      ),
    },
    {
      id: "vscode",
      label: "VS Code",
      icon: <VSCodeSVG />,
      content: (
        <>
          <Text size="S" color="text-700">
            Run MCP: Add Server from the Command Palette, or add to
            .vscode/mcp.json.
            {isAuthEnabled &&
              " VS Code walks you through the browser login when the server first starts."}
          </Text>
          <JSONBlockWithCopy value={vsCodeConfig} />
        </>
      ),
    },
    {
      id: "other",
      label: "Other clients",
      icon: <McpSVG />,
      content: isAuthEnabled ? (
        <>
          <Text size="S" color="text-700">
            Any client that supports streamable HTTP and OAuth works — configure
            the URL above and complete the login prompt on first use. For
            headless environments or clients that can&apos;t complete a browser
            login, pass a Phoenix API key as a Bearer header instead:
          </Text>
          <JSONBlockWithCopy value={apiKeyConfig} />
        </>
      ) : (
        <Text size="S" color="text-700">
          Any client that supports streamable HTTP works — configuring the URL
          above is all it takes; no credentials are required on this deployment.
        </Text>
      ),
    },
  ];
}

export function SettingsMCPPage() {
  const { mcpServerEnabled, mcpCodeModeEnabled, authenticationEnabled } =
    window.Config;
  const clients = getClients({ isAuthEnabled: authenticationEnabled });

  return (
    <Card
      title="Model Context Protocol"
      extra={<Badge variant="info">Beta</Badge>}
    >
      {!mcpServerEnabled && (
        <Alert variant="warning" banner>
          The MCP server is disabled on this deployment. Set
          PHOENIX_ENABLE_MCP_SERVER=true on the Phoenix server and restart it to
          serve the /mcp endpoint.
        </Alert>
      )}
      <View padding="size-200">
        <Flex direction="column" gap="size-300">
          <Flex direction="row" alignItems="center" gap="size-200">
            <StatusItem isEnabled={mcpServerEnabled} label="MCP server" />
            <StatusItem isEnabled={mcpCodeModeEnabled} label="Code mode" />
          </Flex>
          <section css={sectionCSS}>
            <CopyField value={mcpUrl}>
              <Label>MCP Server URL</Label>
              <CopyInput />
            </CopyField>
            <Text size="S" color="text-700">
              Point any MCP-compatible client at this URL.{" "}
              {authenticationEnabled
                ? "Clients authenticate with OAuth or a Phoenix API key. "
                : "Authentication is disabled on this deployment, so clients connect without credentials. "}
              {mcpServerEnabled
                ? mcpCodeModeEnabled
                  ? "Code mode is enabled: clients see a compact set of discovery tools plus a sandboxed execute tool that composes Phoenix operations in one step. "
                  : "Code mode is disabled: Phoenix operations are exposed as plain MCP tools, grouped by category and revealed on demand. "
                : null}
              <ExternalLink href={PHOENIX_DOCUMENTATION_LINKS.remoteMcpServer}>
                Learn more in the docs
              </ExternalLink>
            </Text>
          </section>
          <section css={sectionCSS}>
            <Heading level={4} weight="heavy">
              Quick setup
            </Heading>
            <Text size="S" color="text-700">
              The px CLI infers your endpoint and writes your coding
              agent&apos;s MCP config for you:
            </Text>
            <BashBlockWithCopy
              value={
                "px setup mcp --agent claude  # or codex, gemini, cursor, opencode, vscode"
              }
            />
          </section>
          <section css={sectionCSS}>
            <Heading level={4} weight="heavy">
              Connect a client
            </Heading>
            <Text size="S" color="text-700">
              Prefer to configure by hand? Follow the steps for your client
              below.
            </Text>
            <View
              borderWidth="thin"
              borderColor="default"
              borderRadius="medium"
            >
              <DisclosureGroup defaultExpandedKeys={["claude-code"]}>
                {clients.map((client) => (
                  <Disclosure id={client.id} key={client.id}>
                    <DisclosureTrigger arrowPosition="start">
                      <Icon svg={client.icon} aria-hidden />
                      {client.label}
                    </DisclosureTrigger>
                    <DisclosurePanel>
                      <Flex
                        direction="column"
                        gap="size-100"
                        css={panelContentCSS}
                      >
                        {client.content}
                      </Flex>
                    </DisclosurePanel>
                  </Disclosure>
                ))}
              </DisclosureGroup>
            </View>
          </section>
        </Flex>
      </View>
    </Card>
  );
}
