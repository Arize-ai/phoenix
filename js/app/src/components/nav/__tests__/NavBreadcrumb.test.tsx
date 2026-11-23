import copy from "copy-to-clipboard";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createMemoryRouter,
  type RouteObject,
  RouterProvider,
} from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";
import { projectLoader } from "@phoenix/pages/project/projectLoader";
import { appRouteObjects } from "@phoenix/Routes";

import { NavBreadcrumb } from "../NavBreadcrumb";

vi.mock("copy-to-clipboard", () => ({ default: vi.fn() }));

installTestMatchMedia();

const PROJECT_ID = "UHJvamVjdDox";

function findRouteByLoader({
  routes,
  loader,
}: {
  routes: RouteObject[];
  loader: unknown;
}): RouteObject | undefined {
  for (const route of routes) {
    if (route.loader === loader) {
      return route;
    }
    const childRoute = findRouteByLoader({
      routes: route.children ?? [],
      loader,
    });
    if (childRoute) {
      return childRoute;
    }
  }
  return undefined;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.mocked(copy).mockClear();
});

describe("NavBreadcrumb", () => {
  it("shows the project crumb loading, then copies its resolved name", async () => {
    const projectRoute = findRouteByLoader({
      routes: appRouteObjects,
      loader: projectLoader,
    });
    if (!projectRoute) {
      throw new Error("Expected a route with the project loader");
    }
    let resolveProjectName: (name: string) => void = () => {};
    const projectName = new Promise<string>((resolve) => {
      resolveProjectName = resolve;
    });
    const router = createMemoryRouter(
      [
        {
          path: "/projects/:projectId",
          loader: () => ({ projectId: PROJECT_ID, projectName }),
          handle: projectRoute.handle,
          element: <NavBreadcrumb />,
        },
      ],
      { initialEntries: [`/projects/${PROJECT_ID}`] }
    );
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="dark">
          <RouterProvider router={router} />
        </ThemeProvider>
      );
    });

    expect(
      container.querySelector('[role="status"][aria-label="loading"]')
    ).not.toBeNull();
    expect(container.querySelector('button[aria-label="Copy"]')).toBeNull();

    await act(async () => resolveProjectName("support-chatbot"));

    expect(container.querySelector("a")?.textContent).toBe("support-chatbot");
    const copyButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy"]'
    );
    if (!copyButton) {
      throw new Error("Expected a copy button on the resolved crumb");
    }
    const user = userEvent.setup();
    await act(async () => user.click(copyButton));
    const copyNameItem = Array.from(
      document.querySelectorAll('[role="menuitem"]')
    ).find((menuItem) => menuItem.textContent?.trim() === "Project Name");
    if (!copyNameItem) {
      throw new Error("Expected a Project Name copy item");
    }
    await act(async () => user.click(copyNameItem));

    expect(copy).toHaveBeenCalledWith("support-chatbot");
  });
});
