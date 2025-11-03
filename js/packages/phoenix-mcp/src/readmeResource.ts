import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { glob } from "glob";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";
import z from "zod";

const _dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

interface ReadmeResourcesOptions {
  server: McpServer;
}

/**
 * Recursively finds all README files up to 5 directories deep from current file
 * and exposes them as MCP resources and tools
 */
export async function initializeReadmeResources({
  server,
}: ReadmeResourcesOptions): Promise<void> {
  // Start from the directory where this file is located
  const baseDir = path.dirname(path.resolve(_dirname, "../../.."));

  // TODO: Refactor to fetch from public github repo instead of filesystem
  // Find all README files recursively (case insensitive)
  const readmeFiles = await glob("**/README*", {
    cwd: baseDir,
    ignore: ["**/node_modules/**", "**/dist/**"],
    nodir: true,
  });

  /* eslint-disable-next-line no-console */
  console.error(`Found ${readmeFiles.length} README files`);

  // Shared function to read a README file
  const readReadmeFile = async (filePath: string) => {
    const fullPath = path.join(baseDir, filePath);
    try {
      const content = await fs.promises.readFile(fullPath, "utf-8");
      return { content, fullPath };
    } catch (error) {
      /* eslint-disable-next-line no-console */
      console.error(`Error reading README file ${filePath}:`, error);
      throw new Error(`Failed to read README file: ${filePath}`);
    }
  };

  // Register resource capabilities
  server.server.registerCapabilities({
    resources: {
      list: true,
      read: true,
    },
  });

  // Register handlers for resource operations
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: readmeFiles.map((file) => {
        const relativePath = file.replace(baseDir, "").replace(/^\//, "");
        return {
          uri: `readme://${relativePath}`,
          name: relativePath,
          description: `README file at ${relativePath}`,
          mimeType: "text/markdown",
        };
      }),
    };
  });

  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      const uri = request.params.uri;

      // Parse the URI to get the file path
      if (uri.startsWith("readme://")) {
        const filePath = uri.replace("readme://", "");

        // Check if the requested file is in our readmeFiles list
        const matchingFile = readmeFiles.find(
          (file) => file.replace(baseDir, "").replace(/^\//, "") === filePath
        );

        if (!matchingFile) {
          throw new Error(`Resource not found: ${uri}`);
        }

        const { content } = await readReadmeFile(filePath);

        return {
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        };
      } else {
        throw new Error(`Unsupported resource URI scheme: ${uri}`);
      }
    }
  );

  // Register tools for README files
  server.tool(
    "list-readmes",
    "Get a list of all available README files",
    {},
    async () => {
      return {
        content: readmeFiles
          .map((file) => file.replace(baseDir, ""))
          .map((file) => ({
            type: "text",
            text: file,
          })),
      };
    }
  );

  server.tool(
    "get-readme",
    "Get the contents of a specific README file by its path",
    {
      readme_path: z.string(),
    },
    async ({ readme_path }) => {
      const { content } = await readReadmeFile(readme_path);
      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    }
  );
}
