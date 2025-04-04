import path from "path";
import fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { glob } from "glob";
import z from "zod";

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
    maxDepth: 5, // Only go 5 directories deep
  });

  // Create a tool for the list of readmes
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

  // Create a tool to get a specific readme by its path
  server.tool(
    "get-readme",
    "Get the contents of a specific README file by its path",
    {
      readme_path: z.string(),
    },
    async ({ readme_path }) => {
      try {
        const fullPath = path.join(baseDir, readme_path);
        const content = await fs.promises.readFile(fullPath, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error) {
        /* eslint-disable-next-line no-console */
        console.error(`Error reading README file ${readme_path}:`, error);
        throw new Error(`Failed to read README file: ${readme_path}`);
      }
    }
  );

  /* eslint-disable-next-line no-console */
  console.error(`Registered ${readmeFiles.length} README files`);
}
