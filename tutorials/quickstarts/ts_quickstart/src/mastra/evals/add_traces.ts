import "dotenv/config";
import { MastraClient } from "@mastra/client-js";

const mastraClient = new MastraClient({
  baseUrl: "http://localhost:4111",
});

const agent = mastraClient.getAgent("financialOrchestratorAgent");

const questions = [
  "Research NVDA with focus on valuation metrics and growth prospects",
  "Research AAPL, MSFT with focus on comparative financial analysis",
  "Research META, SNAP, PINS with focus on social media sector trends",
  "Research RIVN with focus on financial health and viability",
  "Research KO with focus on dividend yield and stability",
  "Research META with focus on latest developments and stock performance",
  "Research AAPL, MSFT, GOOGL, AMZN, META with focus on big tech comparison and market outlook",
];

for (const question of questions) {
  const response = await agent.generate({
    messages: [{ role: "user", content: question }],
  });
  console.log(`Completed: ${question}`);
}

console.log("done");
