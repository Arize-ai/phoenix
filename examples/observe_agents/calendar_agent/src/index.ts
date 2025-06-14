import dotenv from "dotenv";
import { google, calendar_v3 } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import {
  isOpenInferenceSpan,
  OpenInferenceOTLPTraceExporter,
} from "@arizeai/openinference-mastra";

// ----------------------------------------------------------------------------
// Environment setup & instrumentation
// ----------------------------------------------------------------------------

dotenv.config();

// ----------------------------------------------------------------------------
// Google Calendar helper
// ----------------------------------------------------------------------------

function getCalendarClient(): calendar_v3.Calendar {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyPath) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var not set");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

// ----------------------------------------------------------------------------
// Mastra tools
// ----------------------------------------------------------------------------

const listAvailabilityTool = createTool({
  id: "list_availability",
  description:
    "Return busy blocks between timeMin and timeMax (ISO) for a Google Calendar.",
  inputSchema: z.object({
    calendarId: z.string().default("primary"),
    timeMin: z.string().describe("ISO8601 start"),
    timeMax: z.string().describe("ISO8601 end"),
  }),
  outputSchema: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
    }),
  ),
  execute: async ({
    context,
  }: {
    context: { calendarId: string; timeMin: string; timeMax: string };
  }) => {
    const calendar = getCalendarClient();
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: context.timeMin,
        timeMax: context.timeMax,
        items: [{ id: context.calendarId }],
      },
    });

    const busy =
      (
        res.data.calendars?.[context.calendarId]?.busy as
          | Array<{
              start: string;
              end: string;
            }>
          | undefined
      )?.map((b) => ({
        start: b.start,
        end: b.end,
      })) || [];

    return busy;
  },
});

const createEventTool = createTool({
  id: "create_event",
  description: "Create a calendar event and return its ID.",
  inputSchema: z.object({
    calendarId: z.string().default("primary"),
    summary: z.string(),
    description: z.string().optional(),
    start: z.string().describe("ISO start"),
    end: z.string().describe("ISO end"),
    attendees: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({ eventId: z.string() }),
  execute: async ({
    context,
  }: {
    context: {
      calendarId: string;
      summary: string;
      description?: string;
      start: string;
      end: string;
      attendees?: string[];
    };
  }) => {
    const calendar = getCalendarClient();
    const res = await calendar.events.insert({
      calendarId: context.calendarId,
      requestBody: {
        summary: context.summary,
        description: context.description,
        start: { dateTime: context.start },
        end: { dateTime: context.end },
        attendees: context.attendees?.map((email) => ({ email })),
        id: uuidv4().replace(/-/g, ""),
      },
    });

    return { eventId: res.data.id! };
  },
});

// Stub tools for completeness
const updateEventTool = createTool({
  id: "update_event",
  description: "Update an existing calendar event – not yet implemented.",
  inputSchema: z.object({
    calendarId: z.string().default("primary"),
    eventId: z.string(),
    updates: z.any(),
  }),
  execute: async () => ({ status: "not_implemented" }),
});

const deleteEventTool = createTool({
  id: "delete_event",
  description: "Delete an existing calendar event – not yet implemented.",
  inputSchema: z.object({
    calendarId: z.string().default("primary"),
    eventId: z.string(),
  }),
  execute: async () => ({ status: "not_implemented" }),
});

// ----------------------------------------------------------------------------
// Expose tools via MCPServer (stdio transport) with Phoenix tracing
// ----------------------------------------------------------------------------

const server = new MCPServer({
  name: "Calendar Agent",
  version: "0.2.0",
  description: "Google Calendar utilities (list, create, update, delete)",
  tools: {
    list_availability: listAvailabilityTool,
    create_event: createEventTool,
    update_event: updateEventTool,
    delete_event: deleteEventTool,
  },
  // Configure telemetry for Phoenix tracing
  telemetry: {
    enabled: true,
    serviceName: "calendar-agent",
    export: {
      type: "custom",
      exporter: new OpenInferenceOTLPTraceExporter({
        url: "http://localhost:4317",
        spanFilter: isOpenInferenceSpan,
      }),
    },
  },
});

// Start the server over stdio so Cursor or other MCP clients can spawn it
(async () => {
  await server.startStdio();
})();
