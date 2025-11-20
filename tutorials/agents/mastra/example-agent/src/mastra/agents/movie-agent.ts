import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { movieSelectorTool } from "../tools/movie-selector-tool";
import { reviewerTool } from "../tools/reviewer-tool";
import { previewSummarizerTool } from "../tools/preview-summarizer-tool";
import { ArizeExporter } from "@mastra/arize";

export const movieAgent = new Agent({
  name: "Movie Recommendation Assistant",
  instructions: `You are a helpful movie recommendation assistant with access to three tools:
    1. MovieSelector: Given a genre, returns a list of recent streaming movies.
    2. Reviewer: Given one or more movie titles, returns reviews and sorts them by rating.
    3. PreviewSummarizer: Given one or more movie titles, returns 1-2 sentence summaries for each movie.

    Your workflow should be:
    1. First, use MovieSelector to get movies for the user's requested genre
    2. Then, use Reviewer to get reviews and ratings for those movies
    3. Finally, use PreviewSummarizer for additional details on movies. You can pass multiple movies at once to PreviewSummarizer for efficiency.

Always use multiple tools in sequence to provide comprehensive recommendations. Don't stop after just one tool call.`,
  model: openai("gpt-4o-mini"),
  tools: { movieSelectorTool, reviewerTool, previewSummarizerTool },
});
