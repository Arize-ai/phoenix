import { StructuredTool } from "@langchain/core/tools";
import * as z from "zod";

function compact(text: string, limit: number = 200): string {
  const cleaned = text.split(/\s+/).join(" ");
  return cleaned.length <= limit
    ? cleaned
    : cleaned.slice(0, limit).split(" ").slice(0, -1).join(" ");
}

async function searchApi(query: string): Promise<string | null> {
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!tavilyKey) {
    throw new Error(
      "TAVILY_API_KEY environment variable is not set. Please set it with: export TAVILY_API_KEY=your-key-here",
    );
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        max_results: 3,
        search_depth: "basic",
        include_answer: true,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Tavily API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      answer?: string;
      results?: Array<{ content?: string }>;
    };
    const answer = data.answer || "";
    const snippets = (data.results || []).map((r) => r.content || "").join(" ");
    const combined = `${answer} ${snippets}`.trim();
    return combined.slice(0, 400) || null;
  } catch (error) {
    throw error;
  }
}

const destinationSchema = z.string().min(1, "Destination is required").max(100);
const durationSchema = z
  .string()
  .regex(/^\d+\s*days?$/i, "Duration must be like '3 days' or '7 days'");
const interestsSchema = z.string().min(1, "Interests are required").max(200);

class EssentialInfoTool extends StructuredTool {
  name = "essential_info";
  description =
    "Required. Fetches weather, best time to visit, top attractions, and etiquette for a destination. Call this first when building a trip plan. Do not use for budget or local experiences.";
  schema = z.object({
    destination: destinationSchema.describe(
      "The travel destination (e.g., 'Japan', 'Portugal'). Required.",
    ),
  });

  async _call({ destination }: { destination: string }): Promise<string> {
    const dest = destination.trim();
    if (!dest) return "Error: destination is required.";
    const query = `${dest} travel essentials weather best time top attractions etiquette`;
    const result = await searchApi(query);
    if (result) {
      return `${dest} essentials: ${compact(result)}`;
    }
    return `${dest} is a popular travel destination. Expect local culture, cuisine, and landmarks worth exploring.`;
  }
}

class BudgetBasicsTool extends StructuredTool {
  name = "budget_basics";
  description =
    "Required. Fetches travel cost breakdown (lodging, food, transport, activities) for a destination and trip duration. Call with the exact duration the user asked for (e.g., '5 days'). Do not use for essentials or local experiences.";
  schema = z.object({
    destination: destinationSchema.describe(
      "The travel destination. Required.",
    ),
    duration: durationSchema.describe(
      "Trip duration in the form 'N days' (e.g., '5 days', '7 days'). Required.",
    ),
  });

  async _call({
    destination,
    duration,
  }: {
    destination: string;
    duration: string;
  }): Promise<string> {
    const dest = destination.trim();
    const dur = duration.trim();
    if (!dest || !dur) return "Error: destination and duration are required.";
    const query = `${dest} travel budget average daily costs ${dur}`;
    const result = await searchApi(query);
    if (result) {
      return `${dest} budget (${dur}): ${compact(result)}`;
    }
    return `Budget for ${dur} in ${dest} depends on lodging, meals, transport, and attractions.`;
  }
}

class LocalFlavorTool extends StructuredTool {
  name = "local_flavor";
  description =
    "Required. Fetches authentic local experiences and cultural highlights for a destination. Call with the user's stated interests (e.g., 'food, culture', 'beaches, wine'). Do not use for essentials or budget.";
  schema = z.object({
    destination: destinationSchema.describe(
      "The travel destination. Required.",
    ),
    interests: interestsSchema.describe(
      "The user's interests (e.g., 'food, culture', 'beaches, wine'). Required—use the exact interests from the request.",
    ),
  });

  async _call({
    destination,
    interests,
  }: {
    destination: string;
    interests: string;
  }): Promise<string> {
    const dest = destination.trim();
    const intr = interests.trim() || "local culture";
    if (!dest) return "Error: destination is required.";
    const query = `${dest} authentic local experiences ${intr}`;
    const result = await searchApi(query);
    if (result) {
      return `${dest} ${intr}: ${compact(result)}`;
    }
    return `Explore ${dest}'s unique ${intr} through markets, neighborhoods, and local eateries.`;
  }
}

export const essentialInfoTool = new EssentialInfoTool();
export const budgetBasicsTool = new BudgetBasicsTool();
export const localFlavorTool = new LocalFlavorTool();

export const travelTools = [
  essentialInfoTool,
  budgetBasicsTool,
  localFlavorTool,
];
