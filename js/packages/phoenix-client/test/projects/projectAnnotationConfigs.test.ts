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

const LIST_PATH = "/v1/projects/{project_identifier}/annotation_configs";
const CONFIG_PATH =
  "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}";

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  server.use(
    http.get("/arize_phoenix_version", ({ response }) =>
      response.untyped(new Response("17.16.0", { status: 200 }))
    )
  );
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
      http.get(LIST_PATH, ({ params, request, response }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        requests.push({ projectIdentifier: params.project_identifier, cursor });
        return cursor
          ? response(200).json({ data: [HELPFULNESS], next_cursor: null })
          : response(200).json({ data: [CORRECTNESS], next_cursor: "page-2" });
      })
    );

    const configs = await listProjectAnnotationConfigs({
      client: createTestClient(),
      projectName: "support-bot",
    });

    expect(configs).toEqual([CORRECTNESS, HELPFULNESS]);
    expect(requests).toEqual([
      { projectIdentifier: "support-bot", cursor: null },
      { projectIdentifier: "support-bot", cursor: "page-2" },
    ]);
  });

  it("surfaces a missing project as an HttpError", async () => {
    server.use(
      http.get(LIST_PATH, ({ response }) =>
        response(404).text("Project not found")
      )
    );

    const result = listProjectAnnotationConfigs({
      client: createTestClient(),
      project: "missing",
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});

describe("assignProjectAnnotationConfig", () => {
  it.each([
    { identifier: { config: "correctness" }, expected: "correctness" },
    { identifier: { configName: "correctness" }, expected: "correctness" },
    { identifier: { configId: CORRECTNESS.id }, expected: CORRECTNESS.id },
  ])(
    "sends $identifier as the config path segment",
    async ({ identifier, expected }) => {
      let received: { project: string; config: string } | undefined;
      server.use(
        http.put(CONFIG_PATH, ({ params, response }) => {
          received = {
            project: params.project_identifier,
            config: params.config_identifier,
          };
          return response(200).json({ data: CORRECTNESS });
        })
      );

      const config = await assignProjectAnnotationConfig({
        client: createTestClient(),
        projectId: "UHJvamVjdDox",
        ...identifier,
      });

      expect(config).toEqual(CORRECTNESS);
      expect(received).toEqual({ project: "UHJvamVjdDox", config: expected });
    }
  );

  it("surfaces a missing config as an HttpError", async () => {
    server.use(
      http.put(CONFIG_PATH, ({ response }) => response(404).text("Not found"))
    );

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
  it("sends the project and config identifiers in the path", async () => {
    let received: { project: string; config: string } | undefined;
    server.use(
      http.delete(CONFIG_PATH, ({ params, response }) => {
        received = {
          project: params.project_identifier,
          config: params.config_identifier,
        };
        return response(204).empty();
      })
    );

    await expect(
      unassignProjectAnnotationConfig({
        client: createTestClient(),
        projectName: "support-bot",
        configName: "correctness",
      })
    ).resolves.toBeUndefined();
    expect(received).toEqual({ project: "support-bot", config: "correctness" });
  });

  it("surfaces permission errors", async () => {
    server.use(
      http.delete(CONFIG_PATH, ({ response }) =>
        response(403).text("Forbidden")
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
  it("sends the config IDs and returns the resulting assignments", async () => {
    let received: { project: string; body: unknown } | undefined;
    server.use(
      http.put(LIST_PATH, async ({ params, request, response }) => {
        received = {
          project: params.project_identifier,
          body: await request.json(),
        };
        return response(200).json({ data: [CORRECTNESS, HELPFULNESS] });
      })
    );

    const configs = await setProjectAnnotationConfigs({
      client: createTestClient(),
      projectName: "support-bot",
      configIds: [CORRECTNESS.id, HELPFULNESS.id],
    });

    expect(configs).toEqual([CORRECTNESS, HELPFULNESS]);
    expect(received).toEqual({
      project: "support-bot",
      body: { annotation_config_ids: [CORRECTNESS.id, HELPFULNESS.id] },
    });
  });

  it("surfaces unknown config IDs as an HttpError", async () => {
    server.use(
      http.put(LIST_PATH, ({ response }) =>
        response(422).text("Annotation config not found")
      )
    );

    const result = setProjectAnnotationConfigs({
      client: createTestClient(),
      projectName: "support-bot",
      configIds: ["not-a-config"],
    });

    await expect(result).rejects.toBeInstanceOf(HttpError);
    await expect(result).rejects.toMatchObject({ status: 422 });
  });
});

describe("server version requirement", () => {
  const client = createTestClient();

  it.each([
    [
      "listProjectAnnotationConfigs",
      () =>
        listProjectAnnotationConfigs({ client, projectName: "support-bot" }),
    ],
    [
      "assignProjectAnnotationConfig",
      () =>
        assignProjectAnnotationConfig({
          client,
          projectName: "support-bot",
          configName: "correctness",
        }),
    ],
    [
      "unassignProjectAnnotationConfig",
      () =>
        unassignProjectAnnotationConfig({
          client,
          projectName: "support-bot",
          configName: "correctness",
        }),
    ],
    [
      "setProjectAnnotationConfigs",
      () =>
        setProjectAnnotationConfigs({
          client,
          projectName: "support-bot",
          configIds: [],
        }),
    ],
  ])("%s requires Phoenix server >= 17.16.0", async (_name, call) => {
    server.use(
      http.get("/arize_phoenix_version", ({ response }) =>
        response.untyped(new Response("17.15.0", { status: 200 }))
      )
    );

    await expect(call()).rejects.toThrow(
      /requires Phoenix server >= 17\.16\.0/
    );
  });
});
