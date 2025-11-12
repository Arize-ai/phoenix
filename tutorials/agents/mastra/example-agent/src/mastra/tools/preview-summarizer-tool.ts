import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { ArizeExporter } from "@mastra/arize";

export const previewSummarizerTool = {
  name: "previewSummarizer",
  description:
    "Given one or more movie titles, returns 1-2 sentence summaries describing each movie.",
  parameters: z.object({
    movies: z
      .array(z.string())
      .describe("An array of movie titles to summarize"),
  }),
  execute: async ({ movies }: { movies: string[] }) => {
    const model = openai("gpt-4o-mini");

    const moviesList = movies.join(", ");
    const promptText = `Write a 1-2 sentence summary for each of the following movies: ${moviesList}. 
Format your response as a JSON object where each key is a movie title and each value is its summary.`;

    try {
      const result = await model.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: promptText }] },
        ],
        temperature: 0.7,
      });

      const text =
        result.content.find((part) => part.type === "text")?.text || "";

      try {
        const summaries = JSON.parse(text);
        return { summaries };
      } catch {
        return { summaries: text };
      }
    } catch {
      return { summaries: {} };
    }
  },
};
