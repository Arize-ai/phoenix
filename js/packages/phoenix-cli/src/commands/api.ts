import { Command } from "commander";

import { getConfigErrorMessage, resolveConfig } from "../config";
import { writeError, writeOutput } from "../io";

/**
 * Parse an array of "key=value" strings into a record.
 * Splits only on the first `=` so values may contain `=`.
 */
export function parseFields({
  fields,
}: {
  fields: string[];
}): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const eqIndex = field.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid field format: "${field}". Expected key=value.`);
    }
    const key = field.slice(0, eqIndex);
    const value = field.slice(eqIndex + 1);
    if (!key) {
      throw new Error(
        `Invalid field format: "${field}". Key must not be empty.`
      );
    }
    result[key] = value;
  }
  return result;
}

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
  fields: string[],
  options: ApiGraphqlOptions
): Promise<void> {
  try {
    // 1. Parse key=value fields
    let parsed: Record<string, string>;
    try {
      parsed = parseFields({ fields });
    } catch (error) {
      writeError({
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      process.exit(1);
    }

    // 2. Require query field
    const query = parsed["query"];
    if (!query) {
      writeError({
        message:
          "Error: Missing required field \"query\".\n\nExample:\n  px api graphql query='{ serverStatus { status } }'",
      });
      process.exit(1);
    }

    // 3. Reject mutations
    if (isMutation({ query })) {
      writeError({
        message:
          "Error: Mutations are not allowed. Only queries are permitted.",
      });
      process.exit(1);
    }

    // 4. Resolve config (endpoint only — no project required)
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

    // 5. Build request body — all keys other than "query" become variables
    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key !== "query") {
        variables[key] = value;
      }
    }

    const body: Record<string, unknown> = { query };
    if (Object.keys(variables).length > 0) body.variables = variables;

    // 6. Build URL and auth headers
    const graphqlUrl = `${config.endpoint.replace(/\/$/, "")}/graphql`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(config.headers ?? {}),
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    // 7. POST using Node 22 built-in fetch
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      writeError({
        message: `Error: HTTP ${response.status} ${response.statusText} from ${graphqlUrl}`,
      });
      process.exit(1);
    }

    // 8. Parse and output response
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
        "  Pass arguments as key=value pairs. The 'query' field is required.\n" +
        "  All other key=value pairs become GraphQL variables.\n" +
        "  Only queries are permitted — mutations are rejected.\n" +
        "\n" +
        "  Examples:\n" +
        "\n" +
        "    # Check server status\n" +
        "    px api graphql query='{ serverStatus { status } }'\n" +
        "\n" +
        "    # List project names\n" +
        "    px api graphql query='{ projects { edges { node { name } } } }'\n" +
        "\n" +
        "    # Use a named query with variables\n" +
        "    px api graphql \\\n" +
        "      query='query GetDatasets($first: Int) { datasets(first: $first) { edges { node { name } } } }' \\\n" +
        "      first=5\n" +
        "\n" +
        "    # Pipe to jq to extract fields\n" +
        "    px api graphql query='{ projects { edges { node { name } } } }' | \\\n" +
        "      jq '.data.projects.edges[].node.name'"
    )
    .argument("[fields...]", "key=value pairs: query and any GraphQL variables")
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
