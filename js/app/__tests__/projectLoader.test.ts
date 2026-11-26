import type * as ReactRelay from "react-relay";
import { fetchQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { createMemoryRouter } from "react-router";

import { projectLoader } from "@phoenix/pages/project/projectLoader";

vi.mock("@phoenix/RelayEnvironment", () => ({
  default: {},
}));

vi.mock("react-relay", async () => {
  const actual = await vi.importActual<typeof ReactRelay>("react-relay");
  return {
    ...actual,
    fetchQuery: vi.fn(),
  };
});

function makeLoaderArgs(projectId: string, url: string): LoaderFunctionArgs {
  return {
    params: { projectId },
    request: new Request(url),
    context: undefined,
  } as unknown as LoaderFunctionArgs;
}

const PROJECT_ID = "UHJvamVjdDox";

/**
 * Runs the loader through a real router so redirects are followed the way the
 * app follows them. A name that resolves maps to PROJECT_ID.
 */
async function navigateWithRouter({
  entry,
  basename,
  knownName,
}: {
  entry: string;
  basename?: string;
  knownName?: string;
}) {
  window.Config = { ...window.Config, basename: basename ?? "" };
  vi.mocked(fetchQuery).mockImplementation(((
    _environment: unknown,
    _query: unknown,
    variables: { name?: string; id?: string }
  ) => ({
    toPromise: () => {
      // A redirect loop would otherwise run until the worker is out of memory.
      expect(nameLookupCount()).toBeLessThan(5);
      return Promise.resolve(
        variables.name !== undefined
          ? {
              getProjectByName:
                variables.name === knownName ? { id: PROJECT_ID } : null,
            }
          : { project: { id: variables.id, name: knownName } }
      );
    },
  })) as never);
  const router = createMemoryRouter(
    [
      {
        id: "project",
        path: "/projects/:projectId",
        loader: projectLoader,
        children: [{ path: "traces", element: null }],
      },
    ],
    { basename, initialEntries: [entry] }
  );
  await vi.waitFor(() => {
    expect(router.state.initialized).toBe(true);
    expect(router.state.navigation.state).toBe("idle");
  });
  const { location, errors } = router.state;
  router.dispose();
  return { location, errors };
}

function nameLookupCount() {
  return vi
    .mocked(fetchQuery)
    .mock.calls.filter(([, , variables]) => "name" in (variables as object))
    .length;
}

describe("projectLoader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["a space", "My Project", "My%20Project"],
    ["a slash", "a/b", "a%2Fb"],
    ["non-ASCII characters", "café", "caf%C3%A9"],
  ])(
    "redirects once for a project name with %s",
    async (_label, knownName, encodedName) => {
      const { location } = await navigateWithRouter({
        entry: `/projects/${encodedName}/traces?filter=a`,
        knownName,
      });

      expect(location.pathname).toBe(`/projects/${PROJECT_ID}/traces`);
      expect(location.search).toBe("?filter=a");
      expect(nameLookupCount()).toBe(1);
    }
  );

  it("keeps a single basename when redirecting under a root path", async () => {
    const { location, errors } = await navigateWithRouter({
      entry: "/base/projects/default/traces",
      basename: "/base",
      knownName: "default",
    });

    expect(errors).toBeNull();
    expect(location.pathname).toBe(`/base/projects/${PROJECT_ID}/traces`);
  });

  it("responds with the project not-found error for an unknown name", async () => {
    const { errors } = await navigateWithRouter({
      entry: "/projects/nonexistent/traces",
    });

    expect(errors?.project).toMatchObject({
      status: 404,
      data: { kind: "project-onboarding", projectName: "nonexistent" },
    });
    expect(fetchQuery).toHaveBeenCalledTimes(1);
  });

  it("redirects name-based project routes to the global-id route", async () => {
    vi.mocked(fetchQuery).mockReturnValueOnce({
      toPromise: vi.fn().mockResolvedValue({
        getProjectByName: {
          id: "UHJvamVjdDox",
        },
      }),
    } as never);

    const response = await projectLoader(
      makeLoaderArgs("default", "http://localhost:6006/projects/default/traces")
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe(
      "/projects/UHJvamVjdDox/traces"
    );
    expect(fetchQuery).toHaveBeenCalledTimes(1);
  });

  it("loads project data directly when the route already uses a global id", async () => {
    const projectResponse = {
      project: {
        id: "UHJvamVjdDox",
        name: "default",
      },
    };
    vi.mocked(fetchQuery).mockReturnValueOnce({
      toPromise: vi.fn().mockResolvedValue(projectResponse),
    } as never);

    const response = await projectLoader(
      makeLoaderArgs(
        "UHJvamVjdDox",
        "http://localhost:6006/projects/UHJvamVjdDox/traces"
      )
    );

    expect(response).toEqual(projectResponse);
    expect(fetchQuery).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchQuery).mock.calls[0]?.[2]).toEqual({
      id: "UHJvamVjdDox",
    });
  });
});
