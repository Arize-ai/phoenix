import { authenticateForeman } from "@/mcp/auth";
import { WorkerError } from "@/workers/config";
import { sendSessionMessage } from "@/workers/requests";
import {
  findSessions,
  findSessionsSchema,
  getSession,
  getSessionSchema,
} from "@/workers/sessions";
import { startSession, startSessionSchema } from "@/workers/start";
import Anthropic from "@anthropic-ai/sdk";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export const runtime = "nodejs";

async function handleRequest(request: Request): Promise<Response> {
  let foremanId: string | undefined;
  try {
    foremanId = await authenticateForeman(request);
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    return Response.json(
      { error: "Service is not configured." },
      { status: 503 }
    );
  }
  if (!foremanId)
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  const authenticatedForeman = foremanId;
  const handler = createMcpHandler(() => {
    const server = new McpServer({
      name: "factory-message-service",
      version: "0.1.0",
    });
    server.registerTool(
      "find_sessions",
      {
        description:
          "Scan one page of Factory worker sessions. Follow next_cursor even if matches are empty. Issue/PR filters require repo.",
        inputSchema: findSessionsSchema,
        annotations: { readOnlyHint: true },
      },
      async (input) => executeTool(() => findSessions(input))
    );
    server.registerTool(
      "get_session",
      {
        description:
          "Read worker details and a page of recent conversation, newest first.",
        inputSchema: getSessionSchema,
        annotations: { readOnlyHint: true },
      },
      async (input) => executeTool(() => getSession(input))
    );
    server.registerTool(
      "send_session_message",
      {
        description:
          "Send a message to a worker, including while running. Acceptance is not completion; tagged replies return to this Foreman asynchronously. Never blindly retry uncertain delivery.",
        inputSchema: z.object({
          session_id: z.string().min(1).max(128),
          message: z.string().trim().min(1).max(20000),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
        },
      },
      async (input) =>
        executeTool(async () => {
          const result = await sendSessionMessage({
            foremanId: authenticatedForeman,
            sessionId: input.session_id,
            message: input.message,
          });
          return result;
        })
    );
    server.registerTool(
      "start_session",
      {
        description:
          "Queue an existing Factory GitHub Actions workflow. bug/feature/docs require exactly one issue; review/finish require exactly one PR. Returns a queued workflow link, not a worker session ID; admission and results are asynchronous.",
        inputSchema: startSessionSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
        },
      },
      async (input) =>
        executeTool(async () => {
          const result = await startSession({
            foremanId: authenticatedForeman,
            input,
          });
          return result;
        })
    );
    return server;
  });
  return handler.fetch(request);
}

async function executeTool(
  operation: () => Promise<unknown>
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  try {
    return {
      content: [{ type: "text", text: JSON.stringify(await operation()) }],
    };
  } catch (error) {
    let text: string;
    if (error instanceof WorkerError) text = error.message;
    else if (error instanceof Anthropic.APIError)
      text =
        "Worker service request failed; delivery may be uncertain. Do not retry writes automatically.";
    else if (error instanceof z.ZodError || error instanceof SyntaxError)
      text = "Worker service configuration is invalid.";
    else throw new Error("Factory operation failed.", { cause: error });
    return { isError: true, content: [{ type: "text", text }] };
  }
}

export { handleRequest as POST, handleRequest as GET, handleRequest as DELETE };
