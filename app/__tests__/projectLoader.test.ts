import type * as ReactRelay from "react-relay";
import { fetchQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

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

function makeLoaderArgs(
  projectId: string,
  url: string
): LoaderFunctionArgs<unknown> {
  return {
    params: { projectId },
    request: new Request(url),
    context: undefined,
  } as unknown as LoaderFunctionArgs<unknown>;
}

describe("projectLoader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects name-based project routes to the global-id route", async () => {
    vi.mocked(fetchQuery).mockReturnValueOnce({
      toPromise: vi.fn().mockResolvedValue({
        getProjectByName: {
          id: "UHJvamVjdDox",
          name: "default",
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
