import { Command } from "commander";

import type { PhoenixConfig } from "../config";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { renderCurlCommand } from "../curl";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput } from "../io";

/**
 * Returns true if the query string is a GraphQL mutation or subscription.
 * Strips # comments first to avoid false positives.
 */
export function isNonQuery({ query }: { query: string }): boolean {
  const stripped = query.replace(/#[^\n]*/g, "");
  return /^\s*(mutation|subscription)[\s({]/m.test(stripped);
}

interface ApiGraphqlOptions {
  endpoint?: string;
  apiKey?: string;
  curl?: boolean;
  showToken?: boolean;
}

export interface ApiGraphqlRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

/**
 * Builds the exact outbound GraphQL request used by both live execution and
 * `--curl` preview mode so the two paths cannot drift apart.
 */
export function buildGraphqlRequest({
  query,
  config,
}: {
  query: string;
  config: PhoenixConfig;
}): ApiGraphqlRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.headers ?? {}),
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  return {
    url: `${config.endpoint?.replace(/\/$/, "")}/graphql`,
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  };
}

async function apiGraphqlHandler(
  query: string,
  options: ApiGraphqlOptions
): Promise<void> {
  try {
    if (options.showToken && !options.curl) {
      writeError({
        message: "Error: --show-token can only be used with --curl.",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // 1. Reject mutations and subscriptions
    if (isNonQuery({ query })) {
      writeError({
        message:
          "Error: Only queries are permitted. Mutations and subscriptions are not allowed.",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // 2. Resolve config (endpoint only — no project required)
    const config = resolveConfig({
      cliOptions: { endpoint: options.endpoint, apiKey: options.apiKey },
    });

    if (!config.endpoint) {
      writeError({
        message: getConfigErrorMessage({
          errors: [
            "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
          ],
        }),
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    const request = buildGraphqlRequest({
      query,
      config,
    });

    if (options.curl) {
      writeOutput({
        message: renderCurlCommand({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
          maskTokens: !options.showToken,
        }),
      });
      return;
    }

    // 4. POST using Node 22 built-in fetch
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    if (!response.ok) {
      writeError({
        message: `Error: HTTP ${response.status} ${response.statusText} from ${request.url}`,
      });
      if (response.status === 401 || response.status === 403) {
        process.exit(ExitCode.AUTH_REQUIRED);
      }
      process.exit(ExitCode.FAILURE);
    }

    // 5. Parse and output response
    const json = (await response.json()) as {
      data?: unknown;
      errors?: Array<{ message: string }>;
    };

    if (json.errors && json.errors.length > 0) {
      const msgs = json.errors.map((e) => `  • ${e.message}`).join("\n");
      writeError({ message: `GraphQL Errors:\n${msgs}` });
    }

    // Always write full response to stdout (2-space indent, pipeable)
    writeOutput({ message: JSON.stringify(json, null, 2) });

    if (json.errors && json.errors.length > 0 && json.data == null) {
      process.exit(ExitCode.FAILURE);
    }
  } catch (error) {
    writeError({
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

function createApiGraphqlCommand(): Command {
  return new Command("graphql")
    .description(
      "Execute a GraphQL query against the Phoenix API.\n" +
        "\n" +
        "  Only queries are permitted — mutations are rejected.\n" +
        "\n" +
        "  Examples:\n" +
        "\n" +
        "    # List project names\n" +
        "    px api graphql '{ projects { edges { node { name } } } }'\n" +
        "\n" +
        "    # Filter inline\n" +
        "    px api graphql '{ datasets(first: 5) { edges { node { name } } } }'\n" +
        "\n" +
        "    # Pipe to jq to extract fields\n" +
        "    px api graphql '{ projects { edges { node { name } } } }' | \\\n" +
        "      jq '.data.projects.edges[].node.name'\n" +
        "\n" +
        "    # Print the equivalent curl command without executing it\n" +
        "    px api graphql '{ projects { edges { node { name } } } }' --curl\n" +
        "\n" +
        "    # Reveal the raw token in curl output\n" +
        "    px api graphql '{ projects { edges { node { name } } } }' --curl --show-token\n" +
        "\n" +
        "  Curl mode prints the request without executing it.\n" +
        "  Auth tokens are masked by default. Use --show-token with --curl to reveal them."
    )
    .argument("<query>", "GraphQL query string")
    .option("--endpoint <url>", "Phoenix API endpoint (or set PHOENIX_HOST)")
    .option("--api-key <key>", "Phoenix API key (or set PHOENIX_API_KEY)")
    .option(
      "--curl",
      "Print the equivalent curl command instead of executing the request"
    )
    .option(
      "--show-token",
      "Show the raw Authorization token in curl output (requires --curl)"
    )
    .action(apiGraphqlHandler);
}

export function createApiCommand(): Command {
  const command = new Command("api");
  command.description("Make authenticated requests to the Phoenix API");
  command.addCommand(createApiGraphqlCommand());
  return command;
}
