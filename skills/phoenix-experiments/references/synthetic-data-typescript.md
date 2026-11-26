# Synthetic examples in TypeScript

Use synthetic examples when real traffic is thin, before launch, or to cover a
failure that real traces show rarely. The method is in
[synthetic-data-python](synthetic-data-python.md): name the dimensions that change
behavior, pick combinations, and turn each into a natural request with its own model
call.

```typescript
import { openai } from "@ai-sdk/openai";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import { generateText } from "ai";

const combinations: Array<{ dish: string; constraint: string; skill: string }> = [
  { dish: "bread", constraint: "no oven", skill: "beginner" },
  { dish: "curry", constraint: "vegan", skill: "experienced" },
];

const examples = await Promise.all(
  combinations.map(async (combo) => {
    const { text } = await generateText({
      model: openai("gpt-6-luna"),
      prompt: `Write one realistic message a ${combo.skill} cook might send a recipe assistant about ${combo.dish} with this constraint: ${combo.constraint}. Write it the way a person types, not as a template.`,
    });
    return { input: { question: text }, metadata: combo };
  })
);

await createDataset({
  name: "recipe-synthetic",
  description: "Synthetic recipe questions by dish, constraint, and skill level",
  examples,
});
```

Before uploading, remove empty, templated, or near-duplicate requests, and count
examples per dimension value. Keeping the dimensions in `metadata` lets you compare
results per slice.
