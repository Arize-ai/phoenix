import { z } from "zod";

import { normalizeAliases } from "@phoenix/agent/tools/playgroundPrompt";

export const savePromptInputSchema = z
  .preprocess(
    (input) =>
      normalizeAliases(input == null ? {} : input, {
        instanceId: ["instance_id"],
        promptId: ["prompt_id"],
        name: ["promptName", "prompt_name"],
        tags: ["tagNames", "tag_names"],
      }),
    z.object({
      instanceId: z.number().int().optional(),
      promptId: z.string().trim().min(1).optional(),
      name: z.string().trim().min(1).optional(),
      description: z.string().optional(),
      tags: z.array(z.string().trim().min(1)).optional(),
    })
  )
  .transform(({ instanceId, promptId, name, description, tags }) => ({
    ...(typeof instanceId === "number" ? { instanceId } : {}),
    ...(promptId !== undefined ? { promptId } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(tags !== undefined ? { tags } : {}),
  }));
