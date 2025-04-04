import path from "path";
import fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { glob } from "glob";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

interface ReadmeResourcesOptions {
  server: McpServer;
}

/**
 * Recursively finds all README files up to 5 directories deep from current file
 * and exposes them as MCP resources
 */
export async function initializeReadmeResources({
  server,
}: ReadmeResourcesOptions): Promise<void> {
  // Start from the directory where this file is located
  const baseDir = path.dirname(path.resolve(__dirname, "../../../.."));

  // Find all README files recursively (case insensitive)
  const readmeFiles = await glob("**/README*", {
    cwd: baseDir,
    ignore: ["**/node_modules/**", "**/dist/**"],
    nodir: true,
  });

  /* eslint-disable-next-line no-console */
  console.error(`Found ${readmeFiles.length} README files`);

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
        const fullPath = path.join(baseDir, filePath);

        try {
          // Check if the requested file is in our readmeFiles list
          const matchingFile = readmeFiles.find(
            (file) => file.replace(baseDir, "").replace(/^\//, "") === filePath
          );

          if (!matchingFile) {
            throw new Error(`Resource not found: ${uri}`);
          }

          const content = await fs.promises.readFile(fullPath, "utf-8");

          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: content,
              },
            ],
          };
        } catch (error) {
          /* eslint-disable-next-line no-console */
          console.error(`Error reading README file ${uri}:`, error);
          throw new Error(`Failed to read README file: ${uri}`);
        }
      } else {
        throw new Error(`Unsupported resource URI scheme: ${uri}`);
      }
    }
  );
}
