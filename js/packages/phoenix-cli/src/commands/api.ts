import { Command } from "commander";

import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput } from "../io";

/**
 * Returns true if the query string is a GraphQL mutation.
 * Strips # comments first to avoid false positives.
 */
export function isMutation({ query }: { query: string }): boolean {
  const stripped = query.replace(/#[^\n]*/g, "");
  return /^\s*mutation[\s({]/m.test(stripped);
}

interface ApiGraphqlOptions {
  endpoint?: string;
  apiKey?: string;
}

async function apiGraphqlHandler(
  query: string,
  options: ApiGraphqlOptions
): Promise<void> {
  try {
    // 1. Reject mutations
    if (isMutation({ query })) {
      writeError({
        message: "Error: Mutations are not allowed. Only queries are permitted.",
      });
      process.exit(1);
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
      process.exit(1);
    }

    // 3. Build URL and auth headers
    const graphqlUrl = `${config.endpoint.replace(/\/$/, "")}/graphql`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(config.headers ?? {}),
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    // 4. POST using Node 22 built-in fetch
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      writeError({
        message: `Error: HTTP ${response.status} ${response.statusText} from ${graphqlUrl}`,
      });
      process.exit(1);
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

    if (json.errors && json.errors.length > 0 && json.data === undefined) {
      process.exit(1);
    }
  } catch (error) {
    writeError({
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(1);
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
        "      jq '.data.projects.edges[].node.name'"
    )
    .argument("<query>", "GraphQL query string")
    .option("--endpoint <url>", "Phoenix API endpoint (or set PHOENIX_HOST)")
    .option("--api-key <key>", "Phoenix API key (or set PHOENIX_API_KEY)")
    .action(apiGraphqlHandler);
}

export function createApiCommand(): Command {
  const command = new Command("api");
  command.description("Make authenticated requests to the Phoenix API");
  command.addCommand(createApiGraphqlCommand());
  return command;
}
