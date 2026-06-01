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
      description: z.string().trim().min(1),
      tags: z.array(z.string().trim().min(1)).optional(),
    })
  )
  .transform(({ instanceId, promptId, name, description, tags }) => ({
    ...(typeof instanceId === "number" ? { instanceId } : {}),
    ...(promptId !== undefined ? { promptId } : {}),
    ...(name !== undefined ? { name } : {}),
    description,
    ...(tags !== undefined ? { tags } : {}),
  }));

/**
 * Shape of a successful save_prompt tool output. The tool output is serialized
 * to JSON for the agent transcript and re-parsed here, so it is validated
 * rather than trusted. Unknown keys (e.g. the `approvalStatus`/`acceptedBy`
 * fields added on approval) are stripped.
 */
export const savePromptOutputSchema = z.object({
  status: z.literal("saved"),
  mode: z.enum(["create", "update"]),
  instanceId: z.number(),
  label: z.string(),
  promptId: z.string(),
  promptName: z.string(),
  promptVersionId: z.string(),
  tag: z.string().nullable(),
  dirtyBeforeSave: z.boolean(),
  message: z.string(),
});
