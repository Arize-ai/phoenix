import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface TimezoneResponse {
  timezone: string;
  datetime: string;
  utc_datetime: string;
  utc_offset: string;
  day_of_week: number;
  day_of_year: number;
  week_number: number;
}

export const timeTool = createTool({
  id: "get-time",
  description:
    "Get current time for locations, convert between timezones, and calculate time differences",
  inputSchema: z.object({
    action: z
      .enum(["current_time", "convert_timezone", "time_difference"])
      .describe("Action to perform"),
    location: z
      .string()
      .optional()
      .describe('Location name (e.g., "New York", "London", "Tokyo")'),
    timezone: z
      .string()
      .optional()
      .describe(
        'Timezone identifier (e.g., "America/New_York", "Europe/London")',
      ),
    from_timezone: z
      .string()
      .optional()
      .describe("Source timezone for conversion"),
    to_timezone: z
      .string()
      .optional()
      .describe("Target timezone for conversion"),
    time: z
      .string()
      .optional()
      .describe('Time to convert (ISO format or "HH:MM")'),
  }),
  outputSchema: z.object({
    result: z.string(),
    timezone: z.string(),
    utc_time: z.string(),
    local_time: z.string(),
    offset: z.string(),
    additional_info: z
      .object({
        day_of_week: z.string(),
        day_of_year: z.number(),
        week_number: z.number(),
      })
      .optional(),
  }),
  execute: async ({ context }) => {
    return await handleTimeOperation(context);
  },
});

const handleTimeOperation = async (context: any) => {
  switch (context.action) {
    case "current_time":
      return await getCurrentTime(context.location || context.timezone);
    case "convert_timezone":
      return await convertTimezone(
        context.from_timezone,
        context.to_timezone,
        context.time,
      );
    case "time_difference":
      return await calculateTimeDifference(
        context.from_timezone || context.location,
        context.to_timezone,
      );
    default:
      throw new Error("Invalid action specified");
  }
};

const getCurrentTime = async (locationOrTimezone: string) => {
  try {
    // First try to get timezone from location
    let timezone = locationOrTimezone;

    if (!locationOrTimezone.includes("/")) {
      // It's likely a location name, try to map it to a timezone
      timezone = mapLocationToTimezone(locationOrTimezone);
    }

    const response = await fetch(
      `https://worldtimeapi.org/api/timezone/${timezone}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get time for ${locationOrTimezone}`);
    }

    const data = (await response.json()) as TimezoneResponse;

    const localTime = new Date(data.datetime).toLocaleString("en-US", {
      timeZone: data.timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    return {
      result: `Current time in ${locationOrTimezone}: ${localTime}`,
      timezone: data.timezone,
      utc_time: data.utc_datetime,
      local_time: data.datetime,
      offset: data.utc_offset,
      additional_info: {
        day_of_week: dayNames[data.day_of_week],
        day_of_year: data.day_of_year,
        week_number: data.week_number,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to get time: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const convertTimezone = async (
  fromTimezone: string,
  toTimezone: string,
  time?: string,
) => {
  try {
    if (!fromTimezone || !toTimezone) {
      throw new Error("Both source and target timezones are required");
    }

    // If no time specified, use current time
    let dateTime: Date;
    if (time) {
      // Handle different time formats
      if (time.includes("T") || time.includes("-")) {
        dateTime = new Date(time);
      } else {
        // Assume it's just time (HH:MM or HH:MM:SS)
        const today = new Date();
        const [hours, minutes, seconds = "0"] = time.split(":");
        dateTime = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          parseInt(hours),
          parseInt(minutes),
          parseInt(seconds),
        );
      }
    } else {
      dateTime = new Date();
    }

    const fromTime = dateTime.toLocaleString("en-US", {
      timeZone: fromTimezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });

    const toTime = dateTime.toLocaleString("en-US", {
      timeZone: toTimezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });

    return {
      result: `${fromTime} (${fromTimezone}) = ${toTime} (${toTimezone})`,
      timezone: toTimezone,
      utc_time: dateTime.toISOString(),
      local_time: toTime,
      offset: "Converted",
    };
  } catch (error) {
    throw new Error(
      `Failed to convert timezone: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const calculateTimeDifference = async (
  timezone1: string,
  timezone2: string,
) => {
  try {
    const now = new Date();

    // Get current time in both timezones
    const time1Response = await fetch(
      `https://worldtimeapi.org/api/timezone/${timezone1}`,
    );
    const time2Response = await fetch(
      `https://worldtimeapi.org/api/timezone/${timezone2}`,
    );

    if (!time1Response.ok || !time2Response.ok) {
      throw new Error("Failed to fetch timezone data");
    }

    const data1 = (await time1Response.json()) as TimezoneResponse;
    const data2 = (await time2Response.json()) as TimezoneResponse;

    const date1 = new Date(data1.datetime);
    const date2 = new Date(data2.datetime);

    const diffMs = Math.abs(date1.getTime() - date2.getTime());
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const time1Str = date1.toLocaleString("en-US", {
      timeZone: data1.timezone,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const time2Str = date2.toLocaleString("en-US", {
      timeZone: data2.timezone,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    return {
      result: `Time difference: ${diffHours}h ${diffMinutes}m. ${timezone1}: ${time1Str}, ${timezone2}: ${time2Str}`,
      timezone: timezone2,
      utc_time: now.toISOString(),
      local_time: time2Str,
      offset: `${diffHours}h ${diffMinutes}m difference`,
    };
  } catch (error) {
    throw new Error(
      `Failed to calculate time difference: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const mapLocationToTimezone = (location: string): string => {
  const locationMap: Record<string, string> = {
    // Major US cities
    "new york": "America/New_York",
    nyc: "America/New_York",
    "los angeles": "America/Los_Angeles",
    la: "America/Los_Angeles",
    chicago: "America/Chicago",
    miami: "America/New_York",
    denver: "America/Denver",
    phoenix: "America/Phoenix",
    seattle: "America/Los_Angeles",
    "san francisco": "America/Los_Angeles",

    // International cities
    london: "Europe/London",
    paris: "Europe/Paris",
    berlin: "Europe/Berlin",
    tokyo: "Asia/Tokyo",
    sydney: "Australia/Sydney",
    melbourne: "Australia/Melbourne",
    beijing: "Asia/Shanghai",
    shanghai: "Asia/Shanghai",
    mumbai: "Asia/Kolkata",
    delhi: "Asia/Kolkata",
    moscow: "Europe/Moscow",
    dubai: "Asia/Dubai",
    singapore: "Asia/Singapore",
    "hong kong": "Asia/Hong_Kong",
    toronto: "America/Toronto",
    vancouver: "America/Vancouver",
    "mexico city": "America/Mexico_City",
    "sao paulo": "America/Sao_Paulo",
    rio: "America/Sao_Paulo",
    cairo: "Africa/Cairo",
    johannesburg: "Africa/Johannesburg",
  };

  const normalizedLocation = location.toLowerCase().trim();
  return locationMap[normalizedLocation] || location;
};
