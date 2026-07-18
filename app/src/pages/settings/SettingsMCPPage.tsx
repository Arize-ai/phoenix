import { css } from "@emotion/react";

import {
  Alert,
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
import { BASE_URL } from "@phoenix/config";

const MCP_DOCS_URL = "https://arize.com/docs/phoenix/integrations/remote-mcp";

const statusItemCSS = css`
  white-space: nowrap;
  .mcp-status__icon--enabled {
    color: var(--global-color-success);
  }
  .mcp-status__icon--disabled {
    color: var(--global-text-color-500);
  }
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
        className={
          isEnabled ? "mcp-status__icon--enabled" : "mcp-status__icon--disabled"
        }
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

export function SettingsMCPPage() {
  const { mcpServerEnabled, mcpCodeModeEnabled } = window.Config;
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
  const codexConfig = [
    "[mcp_servers.phoenix]",
    `url = "${mcpUrl}"`,
    'bearer_token_env_var = "PHOENIX_API_KEY"',
  ].join("\n");
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

  return (
    <Card
      title="Model Context Protocol"
      // The settings tab panel is a flex column; without this the card
      // flex-shrinks to the panel height and clips its own header once the
      // setup content is taller than the viewport.
      flex="none"
      extra={
        <Flex direction="row" alignItems="center" gap="size-200">
          <StatusItem isEnabled={mcpServerEnabled} label="MCP server" />
          <StatusItem isEnabled={mcpCodeModeEnabled} label="Code mode" />
        </Flex>
      }
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
          <section css={sectionCSS}>
            <CopyField value={mcpUrl}>
              <Label>MCP Server URL</Label>
              <CopyInput />
              <Text slot="description">
                Point any MCP-compatible client (Claude Code, Cursor, VS Code,
                and others) at this URL. Clients authenticate with OAuth — a
                browser login with your Phoenix account — or with a Phoenix API
                key.
              </Text>
            </CopyField>
            <Text size="S" color="text-700">
              {mcpServerEnabled
                ? mcpCodeModeEnabled
                  ? "Code mode is enabled: clients see a compact set of discovery tools plus a sandboxed execute tool that composes Phoenix operations in one step. "
                  : "Code mode is disabled: Phoenix operations are exposed as plain MCP tools, grouped by category and revealed on demand. "
                : null}
              <ExternalLink href={MCP_DOCS_URL}>
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
            <DisclosureGroup defaultExpandedKeys={["claude-code"]}>
              <Disclosure id="claude-code">
                <DisclosureTrigger arrowPosition="start">
                  Claude Code
                </DisclosureTrigger>
                <DisclosurePanel>
                  <Flex direction="column" gap="size-100">
                    <BashBlockWithCopy
                      value={`claude mcp add --transport http phoenix ${mcpUrl}`}
                    />
                    <Text size="S" color="text-700">
                      Then run /mcp inside Claude Code, select phoenix, and
                      complete the browser login.
                    </Text>
                  </Flex>
                </DisclosurePanel>
              </Disclosure>
              <Disclosure id="claude-desktop">
                <DisclosureTrigger arrowPosition="start">
                  Claude Desktop
                </DisclosureTrigger>
                <DisclosurePanel>
                  <Flex direction="column" gap="size-100">
                    <Text size="S" color="text-700">
                      Go to Settings → Connectors → Add custom connector and
                      enter the name Phoenix with the URL below. Claude Desktop
                      opens the browser login the first time you use the
                      connector.
                    </Text>
                    <CopyField value={mcpUrl} aria-label="Phoenix MCP URL">
                      <CopyInput />
                    </CopyField>
                  </Flex>
                </DisclosurePanel>
              </Disclosure>
              <Disclosure id="cursor">
                <DisclosureTrigger arrowPosition="start">
                  Cursor
                </DisclosureTrigger>
                <DisclosurePanel>
                  <Flex direction="column" gap="size-100">
                    <Text size="S" color="text-700">
                      Add to ~/.cursor/mcp.json (or the project&apos;s
                      .cursor/mcp.json). Cursor prompts you to log in via the
                      browser on first use.
                    </Text>
                    <JSONBlockWithCopy value={cursorConfig} />
                  </Flex>
                </DisclosurePanel>
              </Disclosure>
              <Disclosure id="vscode">
                <DisclosureTrigger arrowPosition="start">
                  VS Code
                </DisclosureTrigger>
                <DisclosurePanel>
                  <Flex direction="column" gap="size-100">
                    <Text size="S" color="text-700">
                      Run MCP: Add Server from the Command Palette, or add to
                      .vscode/mcp.json. VS Code walks you through the browser
                      login when the server first starts.
                    </Text>
                    <JSONBlockWithCopy value={vsCodeConfig} />
                  </Flex>
                </DisclosurePanel>
              </Disclosure>
              <Disclosure id="codex">
                <DisclosureTrigger arrowPosition="start">
                  Codex (OpenAI)
                </DisclosureTrigger>
                <DisclosurePanel>
                  <Flex direction="column" gap="size-100">
                    <Text size="S" color="text-700">
                      Codex authenticates with an API key. Create a Phoenix API
                      key, export it as PHOENIX_API_KEY, and add to
                      ~/.codex/config.toml:
                    </Text>
                    <TomlBlockWithCopy value={codexConfig} />
                  </Flex>
                </DisclosurePanel>
              </Disclosure>
              <Disclosure id="other">
                <DisclosureTrigger arrowPosition="start">
                  Other clients
                </DisclosureTrigger>
                <DisclosurePanel>
                  <Flex direction="column" gap="size-100">
                    <Text size="S" color="text-700">
                      Any client that supports streamable HTTP and OAuth works —
                      configure the URL above and complete the login prompt on
                      first use. For headless environments or clients that
                      can&apos;t complete a browser login, pass a Phoenix API
                      key as a Bearer header instead:
                    </Text>
                    <JSONBlockWithCopy value={apiKeyConfig} />
                  </Flex>
                </DisclosurePanel>
              </Disclosure>
            </DisclosureGroup>
          </section>
        </Flex>
      </View>
    </Card>
  );
}
