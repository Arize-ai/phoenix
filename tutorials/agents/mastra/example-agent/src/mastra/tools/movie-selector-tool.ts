import { z } from "zod";
import { openai } from "@ai-sdk/openai";

export const movieSelectorTool = {
  name: "movieSelector",
  description: "Given a genre, returns a list of recent popular streaming movies in that genre.",
  parameters: z.object({
    genre: z.string().describe("The movie genre (e.g., 'action', 'comedy', 'drama', 'sci-fi')"),
  }),
  execute: async ({ genre }: { genre: string }) => {
    const model = openai("gpt-4o-mini");
    
    const promptText = `List up to 5 recent popular streaming movies in the ${genre} genre. Provide only movie titles as a list of strings.`;
    
    try {
      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: promptText }] }],
        temperature: 0.7,
      });
      
      const text = result.content.find((part) => part.type === "text")?.text || "";
      return { movies: text };
    } catch {
      return { movies: "" };
    }
  },
};

