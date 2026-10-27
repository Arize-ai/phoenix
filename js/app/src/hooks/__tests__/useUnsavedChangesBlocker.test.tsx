import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";

import {
  UnsavedChangesProvider,
  useUnsavedChangesBlocker,
} from "../useUnsavedChangesBlocker";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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

function Guard({
  name,
  hasUnsavedChanges,
  scope,
}: {
  name: string;
  hasUnsavedChanges: boolean;
  scope?: string;
}) {
  const blocker = useUnsavedChangesBlocker({
    hasUnsavedChanges,
    scope,
    confirmUnload: false,
  });
  return <output data-guard={name}>{blocker.state}</output>;
}

function renderGuards(guards: ReactNode, initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <UnsavedChangesProvider>
            {guards}
            <Outlet />
          </UnsavedChangesProvider>
        ),
        children: [{ path: "*", element: null }],
      },
    ],
    { initialEntries: [initialPath] }
  );
  act(() => {
    root.render(<RouterProvider router={router} />);
  });
  return router;
}

async function navigate(
  router: ReturnType<typeof createMemoryRouter>,
  to: string
) {
  await act(async () => {
    await router.navigate(to);
  });
}

function blockerState(name: string) {
  return container.querySelector(`[data-guard="${name}"]`)?.textContent;
}

describe("useUnsavedChangesBlocker", () => {
  it("lets navigation within its scope through", async () => {
    const router = renderGuards(
      <Guard name="header" hasUnsavedChanges scope="/datasets/1" />,
      "/datasets/1/experiments"
    );
    await navigate(router, "/datasets/1/examples");
    expect(router.state.location.pathname).toBe("/datasets/1/examples");
    expect(blockerState("header")).toBe("unblocked");
  });

  it("blocks navigation that leaves its scope", async () => {
    const router = renderGuards(
      <Guard name="header" hasUnsavedChanges scope="/datasets/1" />,
      "/datasets/1/experiments"
    );
    await navigate(router, "/datasets/10");
    expect(router.state.location.pathname).toBe("/datasets/1/experiments");
    expect(blockerState("header")).toBe("blocked");
  });

  it("blocks any pathname change without a scope", async () => {
    const router = renderGuards(
      <Guard name="table" hasUnsavedChanges />,
      "/datasets/1/examples"
    );
    await navigate(router, "/datasets/1/examples?filter=a");
    expect(router.state.location.search).toBe("?filter=a");
    await navigate(router, "/datasets/1/examples/2");
    expect(blockerState("table")).toBe("blocked");
  });

  it("honors every guard and hands the block to the one that objected", async () => {
    const router = renderGuards(
      <>
        <Guard name="header" hasUnsavedChanges scope="/datasets/1" />
        <Guard name="table" hasUnsavedChanges={false} />
      </>,
      "/datasets/1/examples"
    );
    await navigate(router, "/datasets");
    expect(router.state.location.pathname).toBe("/datasets/1/examples");
    expect(blockerState("header")).toBe("blocked");
    expect(blockerState("table")).toBe("unblocked");
  });
});
