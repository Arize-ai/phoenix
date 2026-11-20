import { z } from "zod";

import { type laneSchema, WorkerError } from "./config";

const workflowConfigSchema = z.object({
  FACTORY_GITHUB_TOKEN: z.string().trim().min(1),
  FACTORY_WORKFLOW_REF: z.string().trim().min(1).max(255).default("main"),
  ANTHROPIC_WORKSPACE_ID: z.string().min(1),
});

async function requestGitHub({
  path,
  token,
  body,
}: {
  path: string;
  token: string;
  body?: object;
}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/${path}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2026-03-10",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (
      !(error instanceof TypeError) &&
      !(error instanceof DOMException && error.name === "TimeoutError")
    )
      throw error;
    throw new WorkerError(
      "GitHub request failed; workflow dispatch may be uncertain. Check Actions before retrying."
    );
  }
  if (!response.ok)
    throw new WorkerError(
      "GitHub rejected the workflow request; check dispatcher permissions and workflow configuration."
    );
  return response;
}

export async function dispatchWorkerWorkflow({
  repo,
  lane,
  targetNumber,
  requesters,
  instruction,
  replyBinding,
}: {
  repo: string;
  lane: z.infer<typeof laneSchema>;
  targetNumber: number;
  requesters: string[];
  instruction: string;
  replyBinding: string;
}): Promise<{ workflow_run_id: number; workflow_url: string }> {
  const config = workflowConfigSchema.parse(process.env);
  for (const login of requesters) {
    const response = await requestGitHub({
      path: `repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`,
      token: config.FACTORY_GITHUB_TOKEN,
    });
    const permission = z
      .object({ permission: z.string() })
      .parse(await response.json());
    if (permission.permission !== "write" && permission.permission !== "admin")
      throw new WorkerError(
        "Every permitted participant needs repository write access to start work."
      );
  }
  const isPrLane = lane === "review" || lane === "finish";
  const workflow = isPrLane ? `factory-${lane}.yml` : "factory-dispatch.yml";
  const response = await requestGitHub({
    path: `repos/${repo}/actions/workflows/${workflow}/dispatches`,
    token: config.FACTORY_GITHUB_TOKEN,
    body: {
      ref: config.FACTORY_WORKFLOW_REF,
      inputs: {
        [isPrLane ? "pr" : "issue"]: String(targetNumber),
        ...(!isPrLane ? { lane } : {}),
        message_request: JSON.stringify({
          requesters,
          instruction,
          reply_binding: replyBinding,
          workspace_id: config.ANTHROPIC_WORKSPACE_ID,
        }),
      },
    },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError) && !(error instanceof TypeError))
      throw error;
    throw new WorkerError(
      "Workflow dispatch delivery is uncertain. Check Actions before retrying."
    );
  }
  const result = z
    .object({ workflow_run_id: z.number().int().positive() })
    .safeParse(body);
  if (!result.success)
    throw new WorkerError(
      "Workflow dispatch delivery is uncertain. Check Actions before retrying."
    );
  return {
    workflow_run_id: result.data.workflow_run_id,
    workflow_url: `https://github.com/${repo}/actions/runs/${result.data.workflow_run_id}`,
  };
}
