import { defineCommand, type CommandContext } from "just-bash";

import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

import { BASH_TOOL_WORKSPACE_ROOT } from "./bashToolFilesystemPolicy";

const DEFAULT_SPILL_THRESHOLD_BYTES = 128 * 1024;
const PHOENIX_GQL_HELP_TEXT = `Usage: phoenix-gql [query] [options] [query-or-file]

Execute a read-only GraphQL query against Phoenix.

Recommended flow:
  1. cat /phoenix/agent-start.md
  2. if needed, cat /phoenix/graphql/current-page.md
  3. start with a tiny query or a file from /phoenix/graphql/recipes/ or /phoenix/graphql/examples/
  4. add filters, sorting, and deeper fields only after the base query works

Options:
  --vars <json>         JSON object of GraphQL variables
  --variables <json>    Alias for --vars
  --vars-file <path>    Read GraphQL variables from a file
  --output <path>       Write JSON response to a file instead of stdout
  --data-only           Print only the .data payload
  --stdout              Disable automatic spill-to-file for large responses
  --help                Show this help text

Examples:
  phoenix-gql '{ projects { edges { node { name } } } }'
  cat query.graphql | phoenix-gql --vars '{"id":"abc"}'
  phoenix-gql query.graphql --vars-file vars.json | jq '.data'
`;

type ParsedPhoenixGqlArgs = {
  querySource: string | null;
  variablesText: string | null;
  variablesFilePath: string | null;
  outputPath: string | null;
  dataOnly: boolean;
  forceStdout: boolean;
  showHelp: boolean;
};

function normalizeArgs(args: string[]) {
  if (args[0] === "query") {
    args = args.slice(1);
  }

  return args.map((arg) => (arg === "--variables" ? "--vars" : arg));
}

function stripGraphQLComments(query: string) {
  return query.replace(/#[^\n]*/g, "");
}

function isNonQueryOperation(query: string) {
  const stripped = stripGraphQLComments(query);
  return /^\s*(mutation|subscription)[\s({]/m.test(stripped);
}

function parseArgs(args: string[]): ParsedPhoenixGqlArgs {
  args = normalizeArgs(args);
  let querySource: string | null = null;
  let variablesText: string | null = null;
  let variablesFilePath: string | null = null;
  let outputPath: string | null = null;
  let dataOnly = false;
  let forceStdout = false;
  let showHelp = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help") {
      showHelp = true;
      continue;
    }

    if (arg === "--data-only") {
      dataOnly = true;
      continue;
    }

    if (arg === "--stdout") {
      forceStdout = true;
      continue;
    }

    if (arg === "--vars") {
      variablesText = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--vars-file") {
      variablesFilePath = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--output") {
      outputPath = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (querySource !== null) {
      throw new Error("Expected a single query string or query file path");
    }

    querySource = arg;
  }

  return {
    querySource,
    variablesText,
    variablesFilePath,
    outputPath,
    dataOnly,
    forceStdout,
    showHelp,
  };
}

function getByteLength(content: string) {
  return new TextEncoder().encode(content).byteLength;
}

async function resolveQueryText({
  querySource,
  stdin,
  cwd,
  fs,
}: {
  querySource: string | null;
  stdin: string;
  cwd: string;
  fs: CommandContext["fs"];
}) {
  if (querySource) {
    const resolvedPath = fs.resolvePath(cwd, querySource);

    if (await fs.exists(resolvedPath)) {
      return fs.readFile(resolvedPath, "utf8");
    }

    return querySource;
  }

  const pipedQuery = stdin.trim();

  if (!pipedQuery) {
    throw new Error("Provide a GraphQL query string, file path, or stdin");
  }

  return pipedQuery;
}

async function resolveVariables({
  variablesText,
  variablesFilePath,
  cwd,
  fs,
}: {
  variablesText: string | null;
  variablesFilePath: string | null;
  cwd: string;
  fs: CommandContext["fs"];
}) {
  const resolvedVariablesText = variablesFilePath
    ? await fs.readFile(fs.resolvePath(cwd, variablesFilePath), "utf8")
    : variablesText;

  if (!resolvedVariablesText) {
    return undefined;
  }

  const parsed = JSON.parse(resolvedVariablesText) as unknown;

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("GraphQL variables must be a JSON object");
  }

  return parsed;
}

function getAutomaticSpillPath() {
  return `${BASH_TOOL_WORKSPACE_ROOT}/phoenix-gql-result-${Date.now()}.json`;
}

function formatGraphqlErrors(errors: Array<{ message: string }>) {
  return `GraphQL errors:\n${errors.map((error) => `- ${error.message}`).join("\n")}\n`;
}

export const phoenixGqlCommand = defineCommand(
  "phoenix-gql",
  async (args, ctx) => {
    try {
      const parsedArgs = parseArgs(args);

      if (parsedArgs.showHelp) {
        return {
          stdout: PHOENIX_GQL_HELP_TEXT,
          stderr: "",
          exitCode: 0,
        };
      }

      const query = await resolveQueryText({
        querySource: parsedArgs.querySource,
        stdin: ctx.stdin,
        cwd: ctx.cwd,
        fs: ctx.fs,
      });

      if (isNonQueryOperation(query)) {
        throw new Error(
          "Only GraphQL queries are permitted; mutations and subscriptions are not allowed"
        );
      }

      const variables = await resolveVariables({
        variablesText: parsedArgs.variablesText,
        variablesFilePath: parsedArgs.variablesFilePath,
        cwd: ctx.cwd,
        fs: ctx.fs,
      });

      const response = await authFetch(`${BASE_URL}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!(response instanceof Response)) {
        throw new Error("Expected authFetch to return a Response");
      }

      if (!response.ok) {
        throw new Error(
          `GraphQL request failed with HTTP ${response.status} ${response.statusText}`
        );
      }

      const payload = (await response.json()) as {
        data?: unknown;
        errors?: Array<{ message: string }>;
      };
      const graphqlErrorText = payload.errors?.length
        ? formatGraphqlErrors(payload.errors)
        : "";
      const hasOnlyErrors = payload.errors?.length && payload.data == null;

      const outputPayload = parsedArgs.dataOnly
        ? (payload.data ?? null)
        : payload;
      const serializedOutput = `${JSON.stringify(outputPayload, null, 2)}\n`;

      if (parsedArgs.outputPath) {
        const outputPath = ctx.fs.resolvePath(ctx.cwd, parsedArgs.outputPath);
        const parentPath =
          outputPath.slice(0, outputPath.lastIndexOf("/")) || "/";

        if (!(await ctx.fs.exists(parentPath))) {
          await ctx.fs.mkdir(parentPath, { recursive: true });
        }

        await ctx.fs.writeFile(outputPath, serializedOutput);

        return {
          stdout: `${outputPath}\n`,
          stderr: payload.errors?.length
            ? `${graphqlErrorText}Response written to ${outputPath}\n`
            : "",
          exitCode: hasOnlyErrors ? 1 : 0,
        };
      }

      if (
        !parsedArgs.forceStdout &&
        getByteLength(serializedOutput) > DEFAULT_SPILL_THRESHOLD_BYTES
      ) {
        const spillPath = getAutomaticSpillPath();
        await ctx.fs.writeFile(spillPath, serializedOutput);

        return {
          stdout: `${JSON.stringify(
            {
              spilled: true,
              path: spillPath,
              bytes: getByteLength(serializedOutput),
            },
            null,
            2
          )}\n`,
          stderr:
            "Response exceeded stdout budget and was written to a workspace file. Re-run with --stdout to force raw output.\n",
          exitCode: 0,
        };
      }

      return {
        stdout: serializedOutput,
        stderr: graphqlErrorText,
        exitCode: hasOnlyErrors ? 1 : 0,
      };
    } catch (error) {
      return {
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`,
        exitCode: 1,
      };
    }
  }
);
