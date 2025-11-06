import { z } from "zod";
import { openai } from "@ai-sdk/openai";

export const previewSummarizerTool = {
  name: "previewSummarizer",
  description: "Given a movie title, returns a 1-2 sentence summary describing the movie.",
  parameters: z.object({
    movie: z.string().describe("The movie title"),
  }),
  execute: async ({ movie }: { movie: string }) => {
    const model = openai("gpt-4o-mini");
    
    const promptText = `Write a 1-2 sentence summary describing the movie '${movie}'.`;
    
    try {
      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: promptText }] }],
        temperature: 0.7,
      });
      
      const text = result.content.find((part) => part.type === "text")?.text || "";
      return { summary: text };
    } catch {
      return { summary: "" };
    }
  },
};

