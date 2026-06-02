import type { RouteObject } from "react-router";

import {
  buildRouteInfoCatalog,
  getRouteInfoFromCatalog,
  parseGetRouteInfoInput,
} from "../index";

const metadata = {
  label: "Settings",
  description: "Configure Phoenix settings.",
  keywords: ["settings", "configuration"],
};

const appRouteObjects: RouteObject[] = [
  {
    path: "/",
    children: [
      {
        path: "/settings",
        handle: {
          agentRoute: metadata,
        },
        children: [
          {
            path: "data",
            handle: {
              agentRoute: {
                label: "Data Retention",
                description:
                  "Manage trace retention policies and retention policy configuration.",
                keywords: [
                  "data retention",
                  "data retention policy settings",
                  "retention policy",
                  "retention policy configuration",
                  "trace retention",
                  "purge traces",
                  "delete old traces",
                  "storage retention",
                ],
              },
            },
          },
        ],
      },
      {
        path: "/projects",
        handle: {
          agentRoute: {
            label: "Projects",
            description:
              "Browse Phoenix projects and open project-specific observability views.",
            keywords: ["projects", "project list", "observability projects"],
          },
        },
        children: [
          {
            path: ":projectId",
            children: [
              {
                path: "traces",
                handle: {
                  agentRoute: {
                    label: "Project Traces",
                    description: "Inspect traces for a project.",
                    keywords: ["traces", "project traces", "trace table"],
                  },
                },
              },
            ],
          },
        ],
      },
      {
        path: "/playground",
        handle: {
          agentRoute: {
            label: "Playground",
            description:
              "Experiment with prompts, models, variables, and prompt runs.",
            keywords: ["playground", "prompt playground", "prompt testing"],
          },
        },
        children: [
          {
            path: "spans/:spanId",
            handle: {
              agentRoute: {
                label: "Span Playground",
                description:
                  "Open a span in the playground for prompt experimentation.",
                keywords: ["span playground", "playground span"],
              },
            },
          },
        ],
      },
    ],
  },
];

describe("getRouteInfo", () => {
  it("extracts only routes with agent route metadata and flattens nested paths", () => {
    const routes: RouteObject[] = [
      {
        path: "/",
        children: [
          {
            path: "settings",
            children: [
              {
                index: true,
                handle: { agentRoute: metadata },
              },
              {
                path: "data",
                handle: {
                  agentRoute: {
                    label: "Data Retention",
                    description: "Manage trace retention policies.",
                    keywords: ["data retention", "retention policy"],
                  },
                },
              },
              {
                path: "hidden",
              },
            ],
          },
        ],
      },
    ];

    expect(buildRouteInfoCatalog(routes).map((entry) => entry.path)).toEqual([
      "/settings",
      "/settings/data",
    ]);
  });

  it("excludes agent route metadata with unsupported fields", () => {
    const routes: RouteObject[] = [
      {
        path: "/settings",
        handle: {
          agentRoute: {
            ...metadata,
            actions: ["configure retention"],
          },
        },
      },
    ];

    expect(buildRouteInfoCatalog(routes)).toEqual([]);
  });

  it("ranks data retention policy queries to the settings data route", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "data retention policy", limit: 5 },
      contexts: [],
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        path: "/settings/data",
        label: "Data Retention",
        link: "/settings/data",
        missingParams: [],
      })
    );
  });

  it("returns bounded empty results for unknown queries", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "zzqxv blorpt ninetynine", limit: 5 },
      contexts: [],
    });

    expect(result.matches).toEqual([]);
  });

  it("uses current contexts to generate links for parameterized routes", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "project traces", limit: 5 },
      contexts: [
        {
          type: "project",
          projectNodeId: "UHJvamVjdDox",
        },
      ],
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        path: "/projects/:projectId/traces",
        link: "/projects/UHJvamVjdDox/traces",
        missingParams: [],
      })
    );
  });

  it("uses span node ids for playground span route links", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "span playground", limit: 5 },
      contexts: [
        {
          type: "span",
          spanNodeId: "U3Bhbjox",
        },
      ],
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        path: "/playground/spans/:spanId",
        link: "/playground/spans/U3Bhbjox",
        missingParams: [],
      })
    );
  });

  it("does not use otel span ids for playground span route links", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "span playground", limit: 5 },
      contexts: [
        {
          type: "span",
          otelSpanId: "0123456789abcdef",
        },
      ],
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        path: "/playground/spans/:spanId",
        link: null,
        missingParams: ["spanId"],
      })
    );
  });

  it("reports missing params instead of inventing links", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "project traces", limit: 5 },
      contexts: [],
    });

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        path: "/projects/:projectId/traces",
        link: null,
        missingParams: ["projectId"],
      })
    );
  });

  it("parses optional query, path, and bounded limit input", () => {
    expect(
      parseGetRouteInfoInput({
        query: "settings",
        path: "/settings/data",
        limit: 100,
      })
    ).toEqual({
      query: "settings",
      path: "/settings/data",
      limit: 10,
    });
  });

  it("rejects invalid input", () => {
    expect(parseGetRouteInfoInput({ query: 123 })).toBeNull();
    expect(parseGetRouteInfoInput({ path: 123 })).toBeNull();
    expect(parseGetRouteInfoInput({ limit: 0 })).toBeNull();
  });
});
