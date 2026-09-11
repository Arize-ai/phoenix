import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import { setProjectRetentionPolicy } from "../../src/projects";
import { createTestClient } from "../testUtils";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("setProjectRetentionPolicy", () => {
  it("assigns an existing policy to a project selected by name", async () => {
    const policyId = "UHJvamVjdFRyYWNlUmV0ZW50aW9uUG9saWN5OjI=";
    let receivedProjectIdentifier: string | undefined;
    let receivedBody: unknown;

    server.use(
      http.patch(
        "/v1/projects/:projectIdentifier/retention",
        async ({ params, request, response }) => {
          receivedProjectIdentifier = String(params.projectIdentifier);
          receivedBody = await request.json();
          return response(200).json({
            data: {
              project_id: "UHJvamVjdDox",
              policy_id: policyId,
            },
          });
        }
      )
    );

    const assignment = await setProjectRetentionPolicy({
      client: createTestClient(),
      projectName: "support-bot",
      policyId,
    });

    expect(receivedProjectIdentifier).toBe("support-bot");
    expect(receivedBody).toEqual({ policy_id: policyId });
    expect(assignment).toEqual({
      project_id: "UHJvamVjdDox",
      policy_id: policyId,
    });
  });

  it("resets a project selected by GlobalID to the default policy", async () => {
    const projectId = "UHJvamVjdDox";
    let receivedProjectIdentifier: string | undefined;
    let receivedBody: unknown;

    server.use(
      http.patch(
        "/v1/projects/:projectIdentifier/retention",
        async ({ params, request, response }) => {
          receivedProjectIdentifier = String(params.projectIdentifier);
          receivedBody = await request.json();
          return response(200).json({
            data: {
              project_id: projectId,
              policy_id: null,
            },
          });
        }
      )
    );

    const assignment = await setProjectRetentionPolicy({
      client: createTestClient(),
      projectId,
      policyId: null,
    });

    expect(receivedProjectIdentifier).toBe(projectId);
    expect(receivedBody).toEqual({ policy_id: null });
    expect(assignment).toEqual({
      project_id: projectId,
      policy_id: null,
    });
  });

  it("surfaces retention-policy validation errors", async () => {
    server.use(
      http.patch("/v1/projects/:projectIdentifier/retention", ({ response }) =>
        response(422).text("Invalid retention policy ID")
      )
    );

    const error = await setProjectRetentionPolicy({
      client: createTestClient(),
      projectName: "support-bot",
      policyId: "not-a-global-id",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 422 });
  });

  it("surfaces permission errors for non-admin callers", async () => {
    server.use(
      http.patch("/v1/projects/:projectIdentifier/retention", ({ response }) =>
        response(403).text("Forbidden")
      )
    );

    const error = await setProjectRetentionPolicy({
      client: createTestClient(),
      projectName: "support-bot",
      policyId: null,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 403 });
  });

  it("throws when a successful response omits assignment data", async () => {
    server.use(
      http.patch("/v1/projects/:projectIdentifier/retention", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      setProjectRetentionPolicy({
        client: createTestClient(),
        projectName: "support-bot",
        policyId: null,
      })
    ).rejects.toThrow("Failed to set project retention policy");
  });
});
