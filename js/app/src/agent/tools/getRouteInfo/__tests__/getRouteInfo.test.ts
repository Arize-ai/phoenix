import type { RouteObject } from "react-router";

import {
  buildRouteInfoCatalog,
  getRouteInfoFromCatalog,
  parseGetRouteInfoInput,
} from "../index";

const metadata = {
  label: "Settings",
  description: "Configure Phoenix settings.",
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

  it("returns data retention policy route within the default matches", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "data retention policy", limit: 5 },
      contexts: [],
    });

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/settings/data",
          label: "Data Retention",
          link: "/settings/data",
          missingParams: [],
        }),
      ])
    );
  });

  it("does not return removed keywords metadata in matches", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "data retention policy", limit: 5 },
      contexts: [],
    });

    expect(result.matches[0]).not.toHaveProperty("keywords");
  });

  it("excludes agent route metadata with removed keywords field", () => {
    const routes: RouteObject[] = [
      {
        path: "/settings",
        handle: {
          agentRoute: {
            ...metadata,
            keywords: ["settings"],
          },
        },
      },
    ];

    expect(buildRouteInfoCatalog(routes)).toEqual([]);
  });

  it("keeps project traces within default matches when context can fill params", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "project traces", limit: 5 },
      contexts: [
        {
          type: "project",
          projectNodeId: "UHJvamVjdDo0Nw==",
        },
      ],
    });

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/projects/:projectId/traces",
          link: "/projects/UHJvamVjdDo0Nw==/traces",
          missingParams: [],
        }),
      ])
    );
  });

  it("restores id padding without decoding structural URL escapes", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "project traces", limit: 5 },
      contexts: [
        {
          type: "project",
          projectNodeId: "abc/def==",
        },
      ],
    });

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/projects/:projectId/traces",
          link: "/projects/abc%2Fdef==/traces",
          missingParams: [],
        }),
      ])
    );
  });

  it("keeps span playground within default matches when context can fill params", () => {
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

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/playground/spans/:spanId",
          link: "/playground/spans/U3Bhbjox",
          missingParams: [],
        }),
      ])
    );
  });

  it("keeps missing project params within default matches instead of inventing links", () => {
    const catalog = buildRouteInfoCatalog(appRouteObjects);
    const result = getRouteInfoFromCatalog({
      catalog,
      input: { query: "project traces", limit: 5 },
      contexts: [],
    });

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/projects/:projectId/traces",
          link: null,
          missingParams: ["projectId"],
        }),
      ])
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

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/playground/spans/:spanId",
          link: null,
          missingParams: ["spanId"],
        }),
      ])
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
