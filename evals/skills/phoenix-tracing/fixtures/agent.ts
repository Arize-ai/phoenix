import OpenAI from "openai";

const client = new OpenAI();

export async function summarize(text: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Summarize the user's text in two sentences." },
      { role: "user", content: text },
    ],
  });
  return response.choices[0]?.message.content ?? "";
}

summarize(process.argv[2] ?? "").then(console.log);
