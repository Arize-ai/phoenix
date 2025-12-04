import { z } from "zod";
import { openai } from "@ai-sdk/openai";

export const reviewerTool = {
  name: "reviewer",
  description:
    "Given one or more movie titles, returns reviews and sorts them by rating from highest to lowest.",
  parameters: z.object({
    movies: z.union([
      z.string().describe("A single movie title"),
      z.array(z.string()).describe("An array of movie titles"),
    ]),
  }),
  execute: async ({ movies }: { movies: string | string[] }) => {
    const model = openai("gpt-4o-mini");

    const promptText = Array.isArray(movies)
      ? `Sort the following movies by rating from highest to lowest and provide a short review for each:\n${movies.join(", ")}`
      : `Provide a short review and rating for the movie: ${movies}`;

    try {
      const result = await model.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: promptText }] },
        ],
        temperature: 0.7,
      });

      const text =
        result.content.find((part) => part.type === "text")?.text || "";
      return { review: text };
    } catch {
      return { review: "" };
    }
  },
};
