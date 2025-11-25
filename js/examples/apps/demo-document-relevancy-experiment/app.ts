import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

import "dotenv/config";

import OpenAI from "openai";

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SPACE_KNOWLEDGE_BASE = [
  {
    id: 1,
    text: "Europa is one of Jupiter's moons believed to have a subsurface ocean beneath its icy crust.",
  },
  {
    id: 2,
    text: "Venus rotates in the opposite direction of most planets in the Solar System, a phenomenon called retrograde rotation.",
  },
  {
    id: 3,
    text: "The Sun accounts for approximately 99.8% of the Solar System's total mass.",
  },
  {
    id: 4,
    text: "The Kuiper Belt contains icy bodies and dwarf planets beyond Neptune's orbit, including Pluto.",
  },
  {
    id: 5,
    text: "Mars experiences planet-wide dust storms that can last for months and cover the entire planet.",
  },
  {
    id: 6,
    text: "No spacecraft has landed on Venus and survived for longer than a few hours due to extreme heat and pressure.",
  },
  {
    id: 7,
    text: "Saturn's moon Titan has lakes and rivers made of liquid methane and ethane, not water.",
  },
  {
    id: 8,
    text: "Jupiter's Great Red Spot is a massive storm that has been raging for at least 400 years.",
  },
  {
    id: 9,
    text: "Neptune has the fastest winds in the Solar System, reaching speeds up to 2,100 kilometers per hour.",
  },
  {
    id: 10,
    text: "Mercury has extreme temperature variations, ranging from 427°C during the day to -173°C at night.",
  },
];

export async function spaceKnowledgeApplication(query: string) {
  const knowledgeBaseText = SPACE_KNOWLEDGE_BASE.map((item) => item.text).join(
    "\n"
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a retrieval system. Given a query and a knowledge base, you MUST select and return 1-3 most relevant pieces of information from the knowledge base. CRITICAL: You must ALWAYS return at least 1 piece of information. If nothing seems directly relevant to the query, you must still return the most tangentially related piece from the knowledge base. Never return an empty context array. Return ONLY a JSON object with "context" (array of 1-3 knowledge base texts). Do not provide an answer, only return the retrieved context.`,
      },
      {
        role: "user",
        content: `Knowledge Base:\n${knowledgeBaseText}\n\nQuery: ${query}\n\nReturn JSON with only the "context" array containing 1-3 most relevant knowledge base texts. REQUIRED: The context array must contain at least 1 item. If no direct match exists, return the most related item from the knowledge base.`,
      },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}
