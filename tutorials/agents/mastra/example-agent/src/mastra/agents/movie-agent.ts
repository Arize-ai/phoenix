import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { movieSelectorTool } from "../tools/movie-selector-tool";
import { reviewerTool } from "../tools/reviewer-tool";
import { previewSummarizerTool } from "../tools/preview-summarizer-tool";

export const movieAgent = new Agent({
  name: "Movie Recommendation Assistant",
  instructions: `You are a helpful movie recommendation assistant with access to three tools:
    1. MovieSelector: Given a genre, returns a list of recent streaming movies.
    2. Reviewer: Given one or more movie titles, returns reviews and sorts them by rating.
    3. PreviewSummarizer: Given a movie title, returns a 1-2 sentence summary.

    Your workflow should be:
    1. First, use MovieSelector to get movies for the user's requested genre
    2. Then, use Reviewer to get reviews and ratings for those movies
    3. Finally, use PreviewSummarizer for additional details on specific movies. 

Always use multiple tools in sequence to provide comprehensive recommendations. Don't stop after just one tool call.`,
  model: openai("gpt-4o-mini"),
  tools: { movieSelectorTool, reviewerTool, previewSummarizerTool },
});

