import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NavBreadcrumb } from "../NavBreadcrumb";
import { NavTitle } from "../NavTitle";

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
});

/** A promise settled from the test, standing in for a loader's deferred name. */
function deferName() {
  let resolve!: (name: string) => void;
  const promise = new Promise<string>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Renders the trail and title under a memory router at `/projects/:projectId`,
 * where the project's crumb is the promise its loader hands over.
 */
async function renderTrail({
  initialPath,
  nameFor,
}: {
  initialPath: string;
  nameFor: (projectId: string) => Promise<string>;
}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        handle: { crumb: () => "Projects" },
        element: (
          <>
            <NavTitle />
            <NavBreadcrumb />
            <Outlet />
          </>
        ),
        children: [
          {
            path: "projects/:projectId",
            loader: ({ params }) => ({ name: nameFor(params.projectId!) }),
            handle: { crumb: (data: { name: Promise<string> }) => data.name },
            element: <output>page</output>,
          },
        ],
      },
    ],
    { initialEntries: [initialPath] }
  );
  // The router runs the loader before its first render, sync as it is.
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  return router;
}

const linkTexts = () =>
  [...container.querySelectorAll("a")].map((link) => link.textContent);
const pendingCrumbs = () => container.querySelectorAll("[role='status']");
const documentTitle = () => document.querySelector("title")?.textContent;

describe("NavBreadcrumb and NavTitle", () => {
  it("shows the loaded crumbs around a placeholder until a deferred name resolves", async () => {
    const deferred = deferName();
    await renderTrail({
      initialPath: "/projects/p1",
      nameFor: () => deferred.promise,
    });

    expect(linkTexts()).toEqual(["Projects"]);
    expect(pendingCrumbs()).toHaveLength(1);
    expect(documentTitle()).toBe("Projects");

    await act(async () => {
      deferred.resolve("Checkout flow");
    });

    expect(linkTexts()).toEqual(["Projects", "Checkout flow"]);
    expect(pendingCrumbs()).toHaveLength(0);
    expect(documentTitle()).toBe("Checkout flow - Projects");
  });

  it("drops the previous name for a placeholder as soon as the route changes", async () => {
    const deferredByProject: Record<string, ReturnType<typeof deferName>> = {
      p1: deferName(),
      p2: deferName(),
    };
    const router = await renderTrail({
      initialPath: "/projects/p1",
      nameFor: (projectId) => deferredByProject[projectId].promise,
    });
    await act(async () => {
      deferredByProject.p1.resolve("Checkout flow");
    });
    expect(linkTexts()).toEqual(["Projects", "Checkout flow"]);

    // The router commits the navigation inside a transition; the trail must
    // not hold the old name, and the page with it, until the new one lands.
    await act(async () => {
      await router.navigate("/projects/p2");
    });

    expect(linkTexts()).toEqual(["Projects"]);
    expect(pendingCrumbs()).toHaveLength(1);
    expect(documentTitle()).toBe("Projects");

    await act(async () => {
      deferredByProject.p2.resolve("Support bot");
    });

    expect(linkTexts()).toEqual(["Projects", "Support bot"]);
    expect(documentTitle()).toBe("Support bot - Projects");
  });
});
