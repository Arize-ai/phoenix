import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import { HttpError } from "../../src/errors";
import {
  type AnnotationConfig,
  assignProjectAnnotationConfig,
  listProjectAnnotationConfigs,
  setProjectAnnotationConfigs,
  unassignProjectAnnotationConfig,
} from "../../src/projects";
import { createTestClient } from "../testUtils";

const http = createHttp();

const CORRECTNESS: AnnotationConfig = {
  id: "RnJlZWZvcm1Bbm5vdGF0aW9uQ29uZmlnOjE=",
  name: "correctness",
  type: "FREEFORM",
};

const HELPFULNESS: AnnotationConfig = {
  id: "RnJlZWZvcm1Bbm5vdGF0aW9uQ29uZmlnOjI=",
  name: "helpfulness",
  type: "FREEFORM",
};

const KNOWN_CONFIGS = [CORRECTNESS, HELPFULNESS];

function serverVersionHandler(version: string) {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

/**
 * Registers handlers that model the server's project assignment state, so
 * tests can observe the effect of repeated and replacing calls.
 */
function useAssignmentState(initial: AnnotationConfig[] = []) {
  const assigned = new Map(initial.map((config) => [config.id, config]));
  const findConfig = (identifier: string) =>
    KNOWN_CONFIGS.find(
      (config) => config.id === identifier || config.name === identifier
    );

  server.use(
    http.get(
      "/v1/projects/{project_identifier}/annotation_configs",
      ({ response }) =>
        response(200).json({
          data: [...assigned.values()],
          next_cursor: null,
        })
    ),
    http.put(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      ({ params, response }) => {
        const config = findConfig(params.config_identifier);
        if (!config) return response(404).text("Not found");
        assigned.set(config.id, config);
        return response(200).json({ data: config });
      }
    ),
    http.delete(
      "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
      ({ params, response }) => {
        const config = findConfig(params.config_identifier);
        if (!config) return response(404).text("Not found");
        assigned.delete(config.id);
        return response(204).empty();
      }
    ),
    http.put(
      "/v1/projects/{project_identifier}/annotation_configs",
      async ({ request, response }) => {
        const body = await request.json();
        const desired = body.annotation_config_ids.map((id) =>
          KNOWN_CONFIGS.find((config) => config.id === id)
        );
        if (desired.some((config) => config === undefined)) {
          return response(422).text("Annotation config not found");
        }
        assigned.clear();
        for (const config of desired) {
          if (config) assigned.set(config.id, config);
        }
        return response(200).json({ data: [...assigned.values()] });
      }
    )
  );

  return assigned;
}

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  server.use(serverVersionHandler("17.16.0"));
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("listProjectAnnotationConfigs", () => {
  it("follows cursors until every page is fetched", async () => {
    const requests: { projectIdentifier: string; cursor: string | null }[] = [];
    server.use(
      http.get(
        "/v1/projects/{project_identifier}/annotation_configs",
        ({ params, request, response }) => {
          const cursor = new URL(request.url).searchParams.get("cursor");
          requests.push({
            projectIdentifier: params.project_identifier,
            cursor,
          });
          return cursor
            ? response(200).json({ data: [HELPFULNESS], next_cursor: null })
            : response(200).json({
                data: [CORRECTNESS],
                next_cursor: HELPFULNESS.id,
              });
        }
      )
    );

    const configs = await listProjectAnnotationConfigs({
      client: createTestClient(),
      projectName: "support-bot",
    });

    expect(configs).toEqual([CORRECTNESS, HELPFULNESS]);
    expect(requests).toEqual([
      { projectIdentifier: "support-bot", cursor: null },
      { projectIdentifier: "support-bot", cursor: HELPFULNESS.id },
    ]);
  });

  it("surfaces a missing project as an HttpError", async () => {
    server.use(
      http.get(
        "/v1/projects/{project_identifier}/annotation_configs",
        ({ response }) => response(404).text("Project not found")
      )
    );

    const result = listProjectAnnotationConfigs({
      client: createTestClient(),
      project: "missing",
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status: 404 });
  });

  it("requires a server that supports project annotation configs", async () => {
    server.use(serverVersionHandler("17.15.0"));

    await expect(
      listProjectAnnotationConfigs({
        client: createTestClient(),
        projectName: "support-bot",
      })
    ).rejects.toThrow(/requires Phoenix server >= 17\.16\.0/);
  });
});

describe("assignProjectAnnotationConfig", () => {
  it("sends the project and config identifiers in the path", async () => {
    const captured: { project?: string; config?: string } = {};
    server.use(
      http.put(
        "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
        ({ params, response }) => {
          captured.project = params.project_identifier;
          captured.config = params.config_identifier;
          return response(200).json({ data: CORRECTNESS });
        }
      )
    );

    const config = await assignProjectAnnotationConfig({
      client: createTestClient(),
      projectId: "UHJvamVjdDox",
      configName: "correctness",
    });

    expect(config).toEqual(CORRECTNESS);
    expect(captured).toEqual({
      project: "UHJvamVjdDox",
      config: "correctness",
    });
  });

  it("is idempotent when the config is already assigned", async () => {
    const client = createTestClient();
    const assigned = useAssignmentState();

    const first = await assignProjectAnnotationConfig({
      client,
      projectName: "support-bot",
      config: CORRECTNESS.id,
    });
    const second = await assignProjectAnnotationConfig({
      client,
      projectName: "support-bot",
      config: CORRECTNESS.id,
    });

    expect(first).toEqual(CORRECTNESS);
    expect(second).toEqual(CORRECTNESS);
    expect([...assigned.values()]).toEqual([CORRECTNESS]);
    await expect(
      listProjectAnnotationConfigs({ client, projectName: "support-bot" })
    ).resolves.toEqual([CORRECTNESS]);
  });

  it("surfaces a missing config as an HttpError", async () => {
    useAssignmentState();

    const result = assignProjectAnnotationConfig({
      client: createTestClient(),
      projectName: "support-bot",
      configName: "missing",
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});

describe("unassignProjectAnnotationConfig", () => {
  it("is idempotent when the config is not assigned", async () => {
    const client = createTestClient();
    const assigned = useAssignmentState([CORRECTNESS, HELPFULNESS]);

    await expect(
      unassignProjectAnnotationConfig({
        client,
        projectName: "support-bot",
        configName: "correctness",
      })
    ).resolves.toBeUndefined();
    await expect(
      unassignProjectAnnotationConfig({
        client,
        projectName: "support-bot",
        configName: "correctness",
      })
    ).resolves.toBeUndefined();

    expect([...assigned.values()]).toEqual([HELPFULNESS]);
  });

  it("surfaces permission errors", async () => {
    server.use(
      http.delete(
        "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
        ({ response }) => response(403).text("Forbidden")
      )
    );

    const result = unassignProjectAnnotationConfig({
      client: createTestClient(),
      projectName: "support-bot",
      configName: "correctness",
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status: 403 });
  });
});

describe("setProjectAnnotationConfigs", () => {
  it("replaces the assigned set with the given config IDs", async () => {
    const assigned = useAssignmentState([CORRECTNESS]);

    const configs = await setProjectAnnotationConfigs({
      client: createTestClient(),
      projectName: "support-bot",
      configIds: [HELPFULNESS.id],
    });

    expect(configs).toEqual([HELPFULNESS]);
    expect([...assigned.values()]).toEqual([HELPFULNESS]);
  });

  it("clears every assignment when given an empty list", async () => {
    let receivedBody: unknown;
    server.use(
      http.put(
        "/v1/projects/{project_identifier}/annotation_configs",
        async ({ request, response }) => {
          receivedBody = await request.json();
          return response(200).json({ data: [] });
        }
      )
    );

    const configs = await setProjectAnnotationConfigs({
      client: createTestClient(),
      projectName: "support-bot",
      configIds: [],
    });

    expect(receivedBody).toEqual({ annotation_config_ids: [] });
    expect(configs).toEqual([]);
  });

  it("surfaces unknown config IDs as an HttpError", async () => {
    useAssignmentState();

    const result = setProjectAnnotationConfigs({
      client: createTestClient(),
      projectName: "support-bot",
      configIds: ["not-a-config"],
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status: 422 });
  });

  it("throws when a successful response omits config data", async () => {
    server.use(
      http.put(
        "/v1/projects/{project_identifier}/annotation_configs",
        ({ response }) =>
          response.untyped(
            new Response("{}", {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          )
      )
    );

    await expect(
      setProjectAnnotationConfigs({
        client: createTestClient(),
        projectName: "support-bot",
        configIds: [],
      })
    ).rejects.toThrow("Failed to set project annotation configs");
  });
});
