import { randomUUID } from "crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const TARGETS = [
  { target: "SPAN", noun: "spans" },
  { target: "TRACE", noun: "traces" },
  { target: "SESSION", noun: "sessions" },
] as const;

async function createProject(page: Page, name: string): Promise<string> {
  const response = await page.request.post("/v1/projects", {
    data: { name },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.id;
}

async function createDecisionEvaluator(
  page: Page,
  name: string
): Promise<string> {
  const decisionResponse = await page.request.post("/graphql", {
    data: {
      operationName: "CreateCompareDecisionForTest",
      query: `
        mutation CreateCompareDecisionForTest($input: CreateDecisionInput!) {
          createDecision(input: $input) {
            version {
              id
            }
          }
        }
      `,
      variables: {
        input: {
          name,
          version: {
            templateFormat: "MUSTACHE",
            state: { json: "{{input}}" },
            questions: [
              {
                predicate: {
                  name: "is_helpful",
                  instructions: "Is the response helpful?",
                },
              },
            ],
            modelProvider: "OPENAI",
            modelName: "gpt-4o-mini",
          },
        },
      },
    },
  });
  expect(decisionResponse.ok()).toBeTruthy();
  const decisionBody = await decisionResponse.json();
  expect(decisionBody.errors).toBeUndefined();
  const evaluatorResponse = await page.request.post("/v1/evaluators", {
    data: {
      type: "decision",
      name,
      decision: {
        selector: {
          type: "version",
          decision_version_id: decisionBody.data.createDecision.version.id,
        },
      },
    },
  });
  expect(evaluatorResponse.ok()).toBeTruthy();
  return (await evaluatorResponse.json()).data.id;
}

async function bindEvaluator(
  page: Page,
  {
    projectId,
    evaluatorId,
    name,
    target,
  }: {
    projectId: string;
    evaluatorId: string;
    name: string;
    target: (typeof TARGETS)[number]["target"];
  }
): Promise<string> {
  const response = await page.request.post(
    `/v1/projects/${encodeURIComponent(projectId)}/evaluators`,
    {
      data: {
        name,
        evaluator_id: evaluatorId,
        evaluation_target: target,
        sampling_rate: 1,
        enabled: false,
      },
    }
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.id;
}

test.describe("Project evaluator compare", () => {
  for (const { target, noun } of TARGETS) {
    test(`loads the matching ${noun} table`, async ({ page }) => {
      const suffix = randomUUID().slice(0, 8);
      const projectId = await createProject(page, `compare-${suffix}`);
      const evaluatorId = await createDecisionEvaluator(
        page,
        `compare-judge-${suffix}`
      );
      const evaluatorA = await bindEvaluator(page, {
        projectId,
        evaluatorId,
        name: "judge-a",
        target,
      });
      const evaluatorB = await bindEvaluator(page, {
        projectId,
        evaluatorId,
        name: "judge-b",
        target,
      });

      await page.goto(
        `/projects/${projectId}/evaluators/compare?evaluatorId=${evaluatorA}&evaluatorId=${evaluatorB}`
      );

      await expect(
        page.getByRole("heading", { name: `Matching ${noun}`, exact: true })
      ).toBeVisible();
      await expect(
        page.getByText(`No matching ${noun}`, { exact: true })
      ).toBeVisible();
      await expect(
        page.getByText("Could not load matching targets")
      ).toHaveCount(0);
    });
  }
});
