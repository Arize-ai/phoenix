/* eslint-disable no-console */
import { formatTemplate, getTemplateVariables } from "../src";

async function main() {
  const template = [
    {
      role: "system" as const,
      content: "Answer using the provided context only.",
    },
    {
      role: "user" as const,
      content: "Question: {{question}}\nContext: {{context}}",
    },
  ];

  const variables = getTemplateVariables({ template });
  console.log("Variables:", variables);

  const rendered = formatTemplate({
    template,
    variables: {
      question: "What is Phoenix?",
      context: "Phoenix is an AI observability platform from Arize.",
    },
  });

  console.log(JSON.stringify(rendered, null, 2));
}

main().catch(console.error);
